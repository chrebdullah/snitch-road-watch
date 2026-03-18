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

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const backupStore = getStore("snitch-report-backups");

  if (!supabaseUrl || !supabaseKey) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Servern saknar Supabase-konfiguration." }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Felaktig JSON i request." }),
    };
  }

  const regNumber = payload.reg_number?.trim().toUpperCase() ?? "";
  const address = payload.address?.trim() || null;
  const comment = payload.comment?.trim() || null;
  const latitude = typeof payload.latitude === "number" && Number.isFinite(payload.latitude) ? payload.latitude : null;
  const longitude = typeof payload.longitude === "number" && Number.isFinite(payload.longitude) ? payload.longitude : null;
  const mediaPath = payload.media_path?.trim() || null;

  if (!regNumber) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Registreringsnummer saknas." }),
    };
  }

  if ((latitude === null || longitude === null) && !address) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Plats saknas. Tillåt GPS eller skriv adress." }),
    };
  }

  const happenedOn = toDateOnlyIso(payload.happened_at);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: insertedReport, error: insertError } = await supabase
      .from("reports")
      .insert({
        reg_number: regNumber,
        masked_reg: maskRegNumber(regNumber),
        latitude,
        longitude,
        address,
        comment,
        happened_on: happenedOn,
        media_url: mediaPath,
        approved: true,
        source: "web",
      })
      .select("id")
      .single();

    if (insertError) {
      return {
        statusCode: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Kunde inte spara rapporten i databasen." }),
      };
    }

    let mediaSignedUrl = null;
    if (mediaPath) {
      const { data: signedUrlData } = await supabase.storage
        .from("report-media")
        .createSignedUrl(mediaPath, 60 * 60 * 24 * 7);
      mediaSignedUrl = signedUrlData?.signedUrl ?? null;
    }

    const backupKey = `reports/${new Date().toISOString().slice(0, 10)}/${insertedReport.id}`;
    let backupSaved = false;
    let backupError = null;
    let emailSent = false;
    let emailError = null;
    const locationText = address || (latitude !== null && longitude !== null ? `${latitude}, ${longitude}` : "-");

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

    if (resendApiKey) {
      const recipients = [
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
      }
    } else {
      emailError = "RESEND_API_KEY saknas i miljövariabler.";
    }

    if (!emailSent) {
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

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        id: insertedReport?.id ?? null,
        backup_saved: backupSaved,
        backup_key: backupSaved ? backupKey : null,
        backup_error: backupError,
        email_sent: emailSent,
        email_error: emailError,
      }),
    };
  } catch {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Något gick fel i servern vid rapportering." }),
    };
  }
};
