import { createClient } from "@supabase/supabase-js";
import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function maskRegNumber(regNumber) {
  const clean = regNumber.replace(/\s+/g, "").toUpperCase();
  if (clean.length <= 3) return "***";
  if (clean.length <= 5) return `${clean.slice(0, 1)}***${clean.slice(-1)}`;
  return `${clean.slice(0, 2)}***${clean.slice(-2)}`;
}

function toDateOnlyIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0] ?? null;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseEmailList(value) {
  if (!value) return [];
  return value
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const REQUIRED_NOTIFICATION_RECIPIENTS = [
  "snitchsweden@gmail.com",
  "christianremrod@gmail.com",
];

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function insertReportWithSchemaFallback(supabase, baseRecord) {
  const primaryRecord = {
    reg_number: baseRecord.reg_number,
    masked_reg: baseRecord.masked_reg,
    latitude: baseRecord.latitude,
    longitude: baseRecord.longitude,
    address: baseRecord.address,
    comment: baseRecord.comment,
    happened_on: baseRecord.happened_on,
    media_url: baseRecord.media_path,
    approved: true,
    source: "web",
  };

  const { data: primaryData, error: primaryError } = await supabase
    .from("reports")
    .insert(primaryRecord)
    .select("id")
    .single();

  if (!primaryError) {
    return { data: primaryData, error: null, schema: "modern" };
  }

  const fallbackRecord = {
    reg_number: baseRecord.reg_number,
    masked_reg: baseRecord.masked_reg,
    lat: baseRecord.latitude,
    lng: baseRecord.longitude,
    address: baseRecord.address,
    comment: baseRecord.comment,
    happened_on: baseRecord.happened_on,
    image_url: baseRecord.media_path,
    approved: true,
    source: "web",
  };

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("reports")
    .insert(fallbackRecord)
    .select("id")
    .single();

  if (!fallbackError) {
    return { data: fallbackData, error: null, schema: "legacy" };
  }

  return { data: null, error: primaryError, schema: "failed" };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  let backupStore = null;
  try {
    backupStore = getStore("snitch-report-backups");
  } catch {
    // Blobs kan vara otillgängligt i vissa miljöer; rapporten ska ändå kunna sparas.
    backupStore = null;
  }

  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse(500, { error: "Servern saknar Supabase-konfiguration." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Felaktig JSON i request." });
  }

  const regNumber = payload.reg_number?.trim().toUpperCase() ?? "";
  const address = payload.address?.trim() || null;
  const comment = payload.comment?.trim() || null;
  const latitude = typeof payload.latitude === "number" && Number.isFinite(payload.latitude) ? payload.latitude : null;
  const longitude = typeof payload.longitude === "number" && Number.isFinite(payload.longitude) ? payload.longitude : null;
  const mediaPath = payload.media_path?.trim() || null;

  if (!regNumber) {
    return jsonResponse(400, { error: "Registreringsnummer saknas." });
  }

  if ((latitude === null || longitude === null) && !address) {
    return jsonResponse(400, { error: "Plats saknas. Tillåt GPS eller skriv adress." });
  }

  const happenedOn = toDateOnlyIso(payload.happened_at);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: insertedReport, error: insertError, schema: insertSchema } = await insertReportWithSchemaFallback(supabase, {
      reg_number: regNumber,
      masked_reg: maskRegNumber(regNumber),
      latitude,
      longitude,
      address,
      comment,
      happened_on: happenedOn,
      media_path: mediaPath,
    });

    if (insertError) {
      return jsonResponse(500, {
        error: "Kunde inte spara rapporten i databasen.",
        details: insertError.message?.slice(0, 220) || "Okänt databasfel",
      });
    }

    let mediaSignedUrl = null;
    if (mediaPath) {
      try {
        const { data: signedUrlData } = await supabase.storage
          .from("report-media")
          .createSignedUrl(mediaPath, 60 * 60 * 24 * 7);
        mediaSignedUrl = signedUrlData?.signedUrl ?? null;
      } catch {
        mediaSignedUrl = null;
      }
    }

    const backupKey = `reports/${new Date().toISOString().slice(0, 10)}/${insertedReport.id}`;
    let backupSaved = false;
    let backupError = backupStore ? null : "Backup-lagring ej tillgänglig i denna miljö.";
    let emailSent = false;
    let emailError = null;
    const locationText = address || (latitude !== null && longitude !== null ? `${latitude}, ${longitude}` : "-");

    if (backupStore) {
      try {
        await backupStore.setJSON(backupKey, {
          id: insertedReport?.id ?? null,
          created_at: new Date().toISOString(),
          reg_number: regNumber,
          address,
          latitude,
          longitude,
          location_text: locationText,
          comment,
          happened_at: payload.happened_at ?? null,
          media_path: mediaPath,
        });
        backupSaved = true;
      } catch (error) {
        backupError = error instanceof Error ? error.message.slice(0, 300) : "Kunde inte spara backup.";
      }
    }

    if (resendApiKey) {
      const recipients = [
        ...REQUIRED_NOTIFICATION_RECIPIENTS,
        ...parseEmailList(process.env.SNITCH_TO_EMAIL || "snitchsweden@gmail.com"),
        ...parseEmailList(process.env.SNITCH_TO_EMAIL_FALLBACK),
      ];
      const uniqueRecipients = [...new Set(recipients)];
      const mediaSection = mediaSignedUrl
        ? `<p><strong>Bild:</strong> <a href="${escapeHtml(mediaSignedUrl)}">Öppna bilaga</a></p>`
        : "<p><strong>Bild:</strong> Ingen</p>";
      if (uniqueRecipients.length === 0) {
        emailError = "SNITCH_TO_EMAIL saknas i miljövariabler.";
      } else {
        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: process.env.SNITCH_FROM_EMAIL || "onboarding@resend.dev",
              to: uniqueRecipients,
              subject: "Ny rapport inkommen - SNITCH",
              html: `<h2>Ny rapport</h2>
                <p><strong>Regnr:</strong> ${escapeHtml(regNumber)}</p>
                <p><strong>Plats:</strong> ${escapeHtml(locationText)}</p>
                <p><strong>Tid:</strong> ${escapeHtml(payload.happened_at || "just nu")}</p>
                <p><strong>Kommentar:</strong> ${escapeHtml(comment || "-")}</p>
                ${mediaSection}
                <p><strong>Rapport-ID:</strong> ${escapeHtml(insertedReport?.id || "okand")}</p>`,
            }),
          });

          if (emailResponse.ok) {
            emailSent = true;
          } else {
            const raw = await emailResponse.text();
            emailError = `Email misslyckades: ${raw.slice(0, 300)}`;
          }
        } catch (error) {
          emailError = error instanceof Error ? `Email misslyckades: ${error.message.slice(0, 220)}` : "Email misslyckades.";
        }
      }
    } else {
      emailError = "RESEND_API_KEY saknas i miljövariabler.";
    }

    if (!emailSent && backupStore) {
      try {
        await backupStore.setJSON(`${backupKey}/delivery`, {
          id: insertedReport?.id ?? null,
          email_sent: false,
          email_error: emailError,
          saved_at: new Date().toISOString(),
        });
      } catch {
        // Silent: rapporten är redan sparad i Supabase.
      }
    }

    return jsonResponse(200, {
      ok: true,
      id: insertedReport?.id ?? null,
      schema: insertSchema,
      backup_saved: backupSaved,
      backup_key: backupSaved ? backupKey : null,
      backup_error: backupError,
      email_sent: emailSent,
      email_error: emailError,
    });
  } catch (error) {
    return jsonResponse(500, {
      error: "Något gick fel i servern vid rapportering.",
      details: error instanceof Error ? error.message.slice(0, 220) : "Okänt serverfel",
    });
  }
};
