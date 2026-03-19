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

function readEnv(name) {
  try {
    if (typeof Netlify !== "undefined" && Netlify?.env?.get) {
      const value = Netlify.env.get(name);
      return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }
  } catch {
    // Fallback till process.env i lokala miljöer.
  }

  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isValidEmail(value) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function resolveResendApiKey() {
  const candidates = ["RESEND_API_KEY", "SNITCH_RESEND_API_KEY", "RESEND_KEY"];
  for (const envName of candidates) {
    const value = readEnv(envName);
    if (value) {
      return { key: value, source: envName };
    }
  }
  return { key: null, source: null };
}

const LAST_RESORT_NOTIFICATION_RECIPIENT = "snitchsweden@gmail.com";
const REPORT_MEDIA_BUCKET = (readEnv("VITE_REPORT_MEDIA_BUCKET") ?? "report-media").trim() || "report-media";

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function extractMissingColumn(error) {
  const message = error?.message || "";
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "?([a-zA-Z0-9_]+)"? does not exist/i,
    /Could not find column '([^']+)'/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

async function sendResendEmail({ apiKey, from, to, subject, html }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (response.ok) {
    return { ok: true, error: null };
  }

  const raw = await response.text();
  return { ok: false, error: raw.slice(0, 300) };
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function sendResendEmailWithRetry(params, maxAttempts = 3) {
  let lastResult = { ok: false, error: "Okänt e-postfel" };
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastResult = await sendResendEmail(params);
    if (lastResult.ok) {
      return lastResult;
    }
    if (attempt < maxAttempts) {
      await wait(250 * attempt);
    }
  }
  return lastResult;
}

function resolveNotificationRecipients(requestId) {
  const primaryConfigured = parseEmailList(readEnv("SNITCH_TO_EMAIL")).filter(isValidEmail);
  const fallbackConfigured = parseEmailList(readEnv("SNITCH_TO_EMAIL_FALLBACK")).filter(isValidEmail);

  let usedHardcodedFallback = false;
  let recipients = [...primaryConfigured, ...fallbackConfigured];

  if (recipients.length === 0 && isValidEmail(LAST_RESORT_NOTIFICATION_RECIPIENT)) {
    recipients = [LAST_RESORT_NOTIFICATION_RECIPIENT];
    usedHardcodedFallback = true;
    console.warn(`[${requestId}] Recipient env vars missing. Using hardcoded emergency fallback recipient.`, {
      fallback_recipient: LAST_RESORT_NOTIFICATION_RECIPIENT,
    });
  }

  const uniqueRecipients = [...new Set(recipients.map((entry) => entry.toLowerCase()))];
  const primaryRecipient =
    primaryConfigured[0]?.toLowerCase() ||
    fallbackConfigured[0]?.toLowerCase() ||
    (usedHardcodedFallback ? LAST_RESORT_NOTIFICATION_RECIPIENT.toLowerCase() : null);

  return {
    recipients: uniqueRecipients,
    primaryRecipient,
    usedHardcodedFallback,
  };
}

async function insertAdaptiveRecord(supabase, record) {
  const candidate = { ...record };
  let lastError = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await supabase.from("reports").insert(candidate).select("id").single();
    if (!error) {
      return { data, error: null, usedRecord: candidate };
    }

    lastError = error;
    const missingColumn = extractMissingColumn(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(candidate, missingColumn)) {
      delete candidate[missingColumn];
      continue;
    }

    break;
  }

  return { data: null, error: lastError, usedRecord: candidate };
}

async function insertReportWithSchemaFallback(supabase, baseRecord) {
  const modernRecord = {
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

  const legacyRecord = {
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

  const minimalRecord = {
    reg_number: baseRecord.reg_number,
    masked_reg: baseRecord.masked_reg,
    approved: true,
  };

  const attempts = [
    { schema: "modern", record: modernRecord },
    { schema: "legacy", record: legacyRecord },
    { schema: "minimal", record: minimalRecord },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    const { data, error, usedRecord } = await insertAdaptiveRecord(supabase, attempt.record);
    if (!error) {
      return { data, error: null, schema: attempt.schema, fields: Object.keys(usedRecord) };
    }
    lastError = error;
  }

  return { data: null, error: lastError, schema: "failed", fields: [] };
}

async function updateDeliveryFieldsWithFallback(supabase, reportId, deliveryFields) {
  const candidate = { ...deliveryFields };
  let lastError = null;

  while (Object.keys(candidate).length > 0) {
    const { error } = await supabase.from("reports").update(candidate).eq("id", reportId);
    if (!error) {
      return { error: null, fields: Object.keys(candidate) };
    }

    lastError = error;
    const missingColumn = extractMissingColumn(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(candidate, missingColumn)) {
      delete candidate[missingColumn];
      continue;
    }
    break;
  }

  return { error: lastError, fields: Object.keys(candidate) };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const requestId = `submit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const supabaseUrl = readEnv("SUPABASE_URL") ?? readEnv("VITE_SUPABASE_URL");
  const supabasePublicBaseUrl = readEnv("SUPABASE_URL");
  const supabaseKey =
    readEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    readEnv("SUPABASE_ANON_KEY") ??
    readEnv("VITE_SUPABASE_ANON_KEY") ??
    readEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  const { key: resendApiKey, source: resendApiKeySource } = resolveResendApiKey();
  console.info(`[${requestId}] Incoming submit-report request`);
  console.info(`[${requestId}] Resend key status: ${resendApiKey ? "exists" : "missing"}${resendApiKeySource ? ` (${resendApiKeySource})` : ""}`);
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
  const mediaFieldCandidates = [
    { key: "media_path", value: payload.media_path },
    { key: "image_path", value: payload.image_path },
    { key: "image_url", value: payload.image_url },
    { key: "media_url", value: payload.media_url },
  ];
  const matchedMediaField = mediaFieldCandidates.find(
    (entry) => typeof entry.value === "string" && entry.value.trim().length > 0
  );
  const mediaPath = matchedMediaField ? matchedMediaField.value.trim() : null;
  console.info(`[${requestId}] backend received image field`, {
    media_field: matchedMediaField?.key ?? null,
    media_path: mediaPath,
  });

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
    const { data: insertedReport, error: insertError, schema: insertSchema, fields: insertFields } = await insertReportWithSchemaFallback(supabase, {
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

    let imageUrl = null;
    if (mediaPath) {
      try {
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from(REPORT_MEDIA_BUCKET)
          .createSignedUrl(mediaPath, 3600);

        if (signedUrlError || !signedUrlData?.signedUrl) {
          console.warn(`[${requestId}] Signed URL generation failed`, {
            bucket: REPORT_MEDIA_BUCKET,
            media_path: mediaPath,
            reason: signedUrlError?.message?.slice(0, 220) ?? "missing signedUrl in response",
          });
        } else {
          imageUrl = signedUrlData.signedUrl;
          console.info(`[${requestId}] Signed URL generation succeeded`, {
            bucket: REPORT_MEDIA_BUCKET,
            media_path: mediaPath,
          });
        }
      } catch (error) {
        console.warn(`[${requestId}] Signed URL generation failed`, {
          bucket: REPORT_MEDIA_BUCKET,
          media_path: mediaPath,
          reason: error instanceof Error ? error.message.slice(0, 220) : "unknown error",
        });
      }

      if (!imageUrl && supabasePublicBaseUrl) {
        imageUrl = `${supabasePublicBaseUrl}/storage/v1/object/public/${REPORT_MEDIA_BUCKET}/${mediaPath}`;
      }

      if (!imageUrl) {
        console.warn(`[${requestId}] No image URL available for email`, {
          media_path: mediaPath,
          has_supabase_url: Boolean(supabasePublicBaseUrl),
        });
      }
    }

    const backupKey = `reports/${new Date().toISOString().slice(0, 10)}/${insertedReport.id}`;
    let backupSaved = false;
    let backupError = backupStore ? null : "Backup-lagring ej tillgänglig i denna miljö.";
    let emailSent = false;
    let emailSentAt = null;
    let emailError = null;
    let emailRecipients = [];
    let emailRecipient = null;
    let supabaseDeliveryError = null;
    let supabaseDeliveryFields = [];
    const locationText = address || (latitude !== null && longitude !== null ? `${latitude}, ${longitude}` : "-");

    if (backupStore) {
      try {
        console.info(`[${requestId}] backup object image field`, {
          media_path: mediaPath,
        });
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
      const { recipients: uniqueRecipients, primaryRecipient, usedHardcodedFallback } =
        resolveNotificationRecipients(requestId);
      emailRecipients = uniqueRecipients;
      emailRecipient = uniqueRecipients.join(", ").slice(0, 240) || null;
      console.info(`[${requestId}] Email recipient list resolved`, {
        count: uniqueRecipients.length,
        recipients: uniqueRecipients,
        primary_recipient: primaryRecipient,
        hardcoded_fallback_used: usedHardcodedFallback,
      });
      const mediaSection = imageUrl
        ? `<p><strong>Bild:</strong> <a href="${escapeHtml(imageUrl)}">Öppna bilaga</a></p>`
        : mediaPath
        ? `<p><strong>Bild:</strong> Ingen giltig bild-URL kunde skapas</p>`
        : "<p><strong>Bild:</strong> Ingen</p>";
      console.info(`[${requestId}] email rendering of image field`, {
        media_path: mediaPath,
        image_url: imageUrl,
        rendered_value: imageUrl ? "image_url" : mediaPath ? "missing_url" : "none",
      });
      if (uniqueRecipients.length === 0) {
        emailError = "Inga giltiga email-mottagare konfigurerade.";
        console.error(`[${requestId}] Email sending skipped: recipient list empty`);
      } else {
        try {
          const from = readEnv("SNITCH_FROM_EMAIL") || "onboarding@resend.dev";
          const subject = "Ny rapport inkommen - SNITCH";
          const html = `<h2>Ny rapport</h2>
                <p><strong>Regnr:</strong> ${escapeHtml(regNumber)}</p>
                <p><strong>Plats:</strong> ${escapeHtml(locationText)}</p>
                <p><strong>Tid:</strong> ${escapeHtml(payload.happened_at || "just nu")}</p>
                <p><strong>Kommentar:</strong> ${escapeHtml(comment || "-")}</p>
                ${mediaSection}
                <p><strong>Rapport-ID:</strong> ${escapeHtml(insertedReport?.id || "okand")}</p>`;

          const batchResult = await sendResendEmailWithRetry({
            apiKey: resendApiKey,
            from,
            to: uniqueRecipients,
            subject,
            html,
          });

          if (batchResult.ok) {
            emailSent = Boolean(primaryRecipient);
            emailSentAt = emailSent ? new Date().toISOString() : null;
            if (!primaryRecipient) {
              emailError = "Primär mottagare kunde inte avgöras från konfigurationen.";
            }
            console.info(`[${requestId}] Resend send success`, { recipients: uniqueRecipients });
          } else {
            const successfulRecipients = [];
            const failedRecipients = [];

            for (const recipient of uniqueRecipients) {
              const singleResult = await sendResendEmailWithRetry({
                apiKey: resendApiKey,
                from,
                to: [recipient],
                subject,
                html,
              });
              if (singleResult.ok) {
                successfulRecipients.push(recipient);
              } else {
                failedRecipients.push({
                  recipient,
                  error: singleResult.error || "Okänt e-postfel",
                });
              }
            }

            emailSent = primaryRecipient ? successfulRecipients.includes(primaryRecipient) : false;
            if (emailSent) {
              emailSentAt = new Date().toISOString();
            }

            if (emailSent && failedRecipients.length > 0) {
              emailError = `Vissa mottagare misslyckades: ${failedRecipients
                .map(({ recipient, error }) => `${recipient}: ${error}`)
                .join(" | ")
                .slice(0, 300)}`;
            } else if (!emailSent) {
              emailError = `Email misslyckades: ${failedRecipients
                .map(({ recipient, error }) => `${recipient}: ${error}`)
                .join(" | ")
                .slice(0, 300)}`;
            }
            console.error(`[${requestId}] Resend send failure`, {
              email_sent: emailSent,
              email_error: emailError,
              failed_recipients: failedRecipients.map((entry) => entry.recipient),
            });
          }
        } catch (error) {
          emailError = error instanceof Error ? `Email misslyckades: ${error.message.slice(0, 220)}` : "Email misslyckades.";
          console.error(`[${requestId}] Resend request threw exception`, {
            error: emailError,
            recipients: uniqueRecipients,
          });
        }
      }
    } else {
      emailError = "Resend API-nyckel saknas (RESEND_API_KEY/SNITCH_RESEND_API_KEY/RESEND_KEY).";
      console.error(`[${requestId}] Resend key missing. Email not sent.`);
    }

    if (insertedReport?.id) {
      const deliveryUpdate = {
        email_sent: emailSent,
        email_error: emailError,
        email_recipient: emailRecipient,
        email_sent_at: emailSentAt,
      };
      const { error: deliveryError, fields } = await updateDeliveryFieldsWithFallback(
        supabase,
        insertedReport.id,
        deliveryUpdate
      );
      supabaseDeliveryFields = fields;
      if (deliveryError) {
        supabaseDeliveryError = deliveryError.message?.slice(0, 220) || "Kunde inte uppdatera email-fält i Supabase.";
        console.error(`[${requestId}] Supabase delivery update failed`, {
          report_id: insertedReport.id,
          error: supabaseDeliveryError,
        });
      } else {
        console.info(`[${requestId}] Supabase delivery update success`, {
          report_id: insertedReport.id,
          fields,
          email_sent: emailSent,
        });
      }
    }

    if (backupStore) {
      try {
        await backupStore.setJSON(`${backupKey}/delivery`, {
          id: insertedReport?.id ?? null,
          email_sent: emailSent,
          email_error: emailError,
          email_recipient: emailRecipient,
          email_sent_at: emailSentAt,
          email_recipient_count: emailRecipients.length,
          email_recipients: emailRecipients,
          resend_api_key_status: resendApiKey ? "exists" : "missing",
          resend_api_key_source: resendApiKeySource,
          supabase_delivery_saved_fields: supabaseDeliveryFields,
          supabase_delivery_error: supabaseDeliveryError,
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
      fields: insertFields,
      backup_saved: backupSaved,
      backup_key: backupSaved ? backupKey : null,
      backup_error: backupError,
      email_sent: emailSent,
      email_error: emailError,
      email_recipient: emailRecipient,
      email_sent_at: emailSentAt,
      supabase_delivery_error: supabaseDeliveryError,
      notification_status: "accepted",
    });
  } catch (error) {
    return jsonResponse(500, {
      error: "Något gick fel i servern vid rapportering.",
      details: error instanceof Error ? error.message.slice(0, 220) : "Okänt serverfel",
    });
  }
};
