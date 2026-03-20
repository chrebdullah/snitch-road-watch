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
const REPORT_MEDIA_BUCKET = (process.env.VITE_REPORT_MEDIA_BUCKET || "report-media").trim() || "report-media";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_USER_AGENT = "SNITCH/1.0 (snitcha.se; snitchsweden@gmail.com)";

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function readHeader(event, headerName) {
  const headers = event?.headers || {};
  const direct = headers[headerName];
  if (typeof direct === "string" && direct.trim().length > 0) return direct.trim();
  const lower = headers[headerName.toLowerCase()];
  if (typeof lower === "string" && lower.trim().length > 0) return lower.trim();
  return null;
}

function parseOptionalNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function readFormString(form, key) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatCoordinateLabel(latitude, longitude) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function resolveLocationText({ address, locality, municipality, latitude, longitude }) {
  const normalizedAddress = normalizeText(address);
  if (normalizedAddress) return normalizedAddress;

  const normalizedLocality = normalizeText(locality);
  if (normalizedLocality) return normalizedLocality;

  const normalizedMunicipality = normalizeText(municipality);
  if (normalizedMunicipality) return normalizedMunicipality;

  if (latitude !== null && longitude !== null) {
    return `GPS ${formatCoordinateLabel(latitude, longitude)}`;
  }

  return "Plats saknas";
}

function pickFirstNonEmpty(values) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return "";
}

function buildAddressFallbackFromParts(addressParts) {
  if (!addressParts || typeof addressParts !== "object") return "";

  const road = pickFirstNonEmpty([
    addressParts.road,
    addressParts.pedestrian,
    addressParts.cycleway,
    addressParts.footway,
    addressParts.path,
    addressParts.residential,
  ]);
  const houseNumber = pickFirstNonEmpty([addressParts.house_number]);
  const neighborhood = pickFirstNonEmpty([
    addressParts.suburb,
    addressParts.neighbourhood,
    addressParts.city_district,
    addressParts.quarter,
    addressParts.hamlet,
  ]);
  const locality = pickFirstNonEmpty([
    addressParts.city,
    addressParts.town,
    addressParts.village,
    addressParts.locality,
  ]);
  const municipality = pickFirstNonEmpty([addressParts.municipality, addressParts.county]);

  if (road) return `${road}${houseNumber ? ` ${houseNumber}` : ""}`.trim();
  if (neighborhood) return neighborhood;
  if (locality) return locality;
  return municipality;
}

async function reverseGeocodeWithNominatim(latitude, longitude, requestId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const url = new URL(NOMINATIM_REVERSE_URL);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "sv,en");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[${requestId}] reverse geocoding failed`, {
        service: "nominatim",
        status: response.status,
      });
      return null;
    }

    const payload = await response.json();
    const addressParts = payload?.address && typeof payload.address === "object" ? payload.address : {};
    const locality = pickFirstNonEmpty([
      addressParts.city,
      addressParts.town,
      addressParts.village,
      addressParts.locality,
    ]);
    const municipality = pickFirstNonEmpty([addressParts.municipality, addressParts.county]);
    const displayName = normalizeText(payload?.display_name);
    const addressFallback = buildAddressFallbackFromParts(addressParts);
    const resolvedAddress = displayName || addressFallback || "";

    return {
      address: resolvedAddress || null,
      locality: locality || null,
      city: locality || null,
      municipality: municipality || null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.warn(`[${requestId}] reverse geocoding exception`, {
      service: "nominatim",
      reason,
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeImageExtension(fileName, mimeType) {
  const fromName = fileName?.split(".").pop()?.toLowerCase() || "";
  const sanitizedFromName = fromName.replace(/[^a-z0-9]/g, "");
  if (sanitizedFromName) return sanitizedFromName;

  const mimeToExt = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "image/svg+xml": "svg",
  };

  return mimeToExt[mimeType?.toLowerCase?.() || ""] || "jpg";
}

async function parseIncomingPayload(event) {
  const contentType = readHeader(event, "content-type") || "";
  const isMultipart = contentType.toLowerCase().includes("multipart/form-data");

  if (!event.body) {
    return {
      reg_number: "",
      address: null,
      manual_address: null,
      location_mode: null,
      comment: null,
      latitude: null,
      longitude: null,
      happened_at: null,
      file: null,
      file_name: null,
      file_type: null,
      file_size: null,
    };
  }

  if (isMultipart) {
    const bodyBuffer = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body, "binary");
    const request = new Request("http://localhost/.netlify/functions/submit-report", {
      method: "POST",
      headers: { "content-type": contentType },
      body: bodyBuffer,
    });
    const form = await request.formData();
    const imageEntry = form.get("image");
    const file = imageEntry && typeof imageEntry === "object" && "arrayBuffer" in imageEntry ? imageEntry : null;

    const latRaw = readFormString(form, "lat") || readFormString(form, "latitude");
    const lngRaw = readFormString(form, "lng") || readFormString(form, "longitude");
    const happenedAtRaw = readFormString(form, "happened_at");
    const regNumberRaw = readFormString(form, "reg_number");
    const addressRaw = readFormString(form, "address");
    const manualAddressRaw = readFormString(form, "manual_address");
    const locationModeRaw = readFormString(form, "location_mode");
    const commentRaw = readFormString(form, "comment");

    return {
      reg_number: regNumberRaw.trim().toUpperCase(),
      address: addressRaw.trim() || null,
      manual_address: manualAddressRaw.trim() || null,
      location_mode: locationModeRaw.trim() || null,
      comment: commentRaw.trim() || null,
      latitude: parseOptionalNumber(latRaw),
      longitude: parseOptionalNumber(lngRaw),
      happened_at: happenedAtRaw.trim() || null,
      file,
      file_name: file?.name || null,
      file_type: file?.type || null,
      file_size: typeof file?.size === "number" ? file.size : null,
    };
  }

  const payload = JSON.parse(event.body || "{}");
  const regNumber = payload.reg_number?.trim().toUpperCase() ?? "";
  const address = payload.address?.trim() || null;
  const manualAddress = payload.manual_address?.trim() || null;
  const locationMode = payload.location_mode?.trim() || null;
  const comment = payload.comment?.trim() || null;
  const latitude = parseOptionalNumber(payload.latitude ?? payload.lat);
  const longitude = parseOptionalNumber(payload.longitude ?? payload.lng);

  return {
    reg_number: regNumber,
    address,
    manual_address: manualAddress,
    location_mode: locationMode,
    comment,
    latitude,
    longitude,
    happened_at: typeof payload.happened_at === "string" ? payload.happened_at.trim() || null : null,
    file: null,
    file_name: null,
    file_type: null,
    file_size: null,
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
    city: baseRecord.city,
    locality: baseRecord.locality,
    municipality: baseRecord.municipality,
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
    city: baseRecord.city,
    locality: baseRecord.locality,
    municipality: baseRecord.municipality,
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
  const supabaseUrl = readEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
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

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error(`[${requestId}] Missing required server-side Supabase configuration`, {
      has_supabase_url: Boolean(supabaseUrl),
      has_service_role_key: Boolean(supabaseServiceRoleKey),
    });
    return jsonResponse(500, { error: "Servern saknar Supabase server-konfiguration." });
  }

  let payload;
  try {
    payload = await parseIncomingPayload(event);
  } catch {
    return jsonResponse(400, { error: "Felaktigt formulärinnehåll i request." });
  }

  const regNumber = payload.reg_number;
  const manualAddress = normalizeText(payload.manual_address) || null;
  const selectedLocationMode = normalizeText(payload.location_mode) || null;
  const submittedAddress = normalizeText(payload.address) || null;
  let address = manualAddress || submittedAddress;
  const comment = payload.comment;
  const latitude = payload.latitude;
  const longitude = payload.longitude;
  const happenedAt = payload.happened_at;
  let city = null;
  let locality = null;
  let municipality = null;

  if (!regNumber) {
    return jsonResponse(400, { error: "Registreringsnummer saknas." });
  }

  if ((latitude === null || longitude === null) && !address) {
    return jsonResponse(400, { error: "Plats saknas. Tillåt GPS eller skriv adress." });
  }

  if (latitude !== null && longitude !== null && !manualAddress && !address) {
    const geocoded = await reverseGeocodeWithNominatim(latitude, longitude, requestId);
    if (geocoded) {
      address = normalizeText(geocoded.address) || null;
      city = normalizeText(geocoded.city) || null;
      locality = normalizeText(geocoded.locality) || null;
      municipality = normalizeText(geocoded.municipality) || null;
    }
  }

  if (!address && latitude !== null && longitude !== null) {
    address = `GPS ${formatCoordinateLabel(latitude, longitude)}`;
  }

  if (selectedLocationMode === "manual" && manualAddress) {
    address = manualAddress;
  }

  const happenedOn = toDateOnlyIso(happenedAt);
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    let mediaPath = null;

    if (payload.file) {
      console.info(`[${requestId}] file received`, {
        file_name: payload.file_name,
        file_type: payload.file_type,
        file_size: payload.file_size,
      });
      console.info(`[${requestId}] file metadata`, {
        type: payload.file_type || "application/octet-stream",
        size: payload.file_size ?? 0,
      });

      const extension = normalizeImageExtension(payload.file_name, payload.file_type);
      mediaPath = `uploads/${Date.now()}-${crypto.randomUUID()}.${extension}`;

      try {
        const fileArrayBuffer = await payload.file.arrayBuffer();
        const fileBytes = new Uint8Array(fileArrayBuffer);
        const { error: uploadError } = await supabase.storage.from(REPORT_MEDIA_BUCKET).upload(mediaPath, fileBytes, {
          upsert: false,
          contentType: payload.file_type || "application/octet-stream",
        });

        if (uploadError) {
          console.error(`[${requestId}] upload failure`, {
            bucket: REPORT_MEDIA_BUCKET,
            media_path: mediaPath,
            file_type: payload.file_type,
            file_size: payload.file_size,
            error: uploadError.message || "unknown upload error",
            status_code: uploadError.statusCode ?? uploadError.status ?? null,
          });
          return jsonResponse(500, { error: "Bilduppladdning misslyckades i backend." });
        }

        console.info(`[${requestId}] upload success`, {
          bucket: REPORT_MEDIA_BUCKET,
          media_path: mediaPath,
          file_type: payload.file_type,
          file_size: payload.file_size,
        });
      } catch (uploadException) {
        console.error(`[${requestId}] upload failure`, {
          bucket: REPORT_MEDIA_BUCKET,
          media_path: mediaPath,
          file_type: payload.file_type,
          file_size: payload.file_size,
          error: uploadException instanceof Error ? uploadException.message : "unknown upload exception",
        });
        return jsonResponse(500, { error: "Bilduppladdning misslyckades i backend." });
      }
    } else {
      console.info(`[${requestId}] file received`, {
        file_name: null,
        file_type: null,
        file_size: 0,
      });
    }

    const { data: insertedReport, error: insertError, schema: insertSchema, fields: insertFields } = await insertReportWithSchemaFallback(supabase, {
      reg_number: regNumber,
      masked_reg: maskRegNumber(regNumber),
      latitude,
      longitude,
      address,
      city,
      locality,
      municipality,
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
        console.info(`[${requestId}] Attempting signed URL generation`, {
          supabase_url: supabaseUrl,
          bucket: REPORT_MEDIA_BUCKET,
          media_path: mediaPath,
        });
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from(REPORT_MEDIA_BUCKET)
          .createSignedUrl(mediaPath, 3600);

        if (signedUrlError || !signedUrlData?.signedUrl) {
          const signedUrlStatusCode =
            signedUrlError?.statusCode ??
            signedUrlError?.status ??
            signedUrlError?.originalError?.status ??
            null;
          const signedUrlErrorMessage =
            signedUrlError?.message ??
            (signedUrlData?.signedUrl ? null : "missing signedUrl in response");
          console.warn(`[${requestId}] Signed URL generation failed`, {
            supabase_url: supabaseUrl,
            bucket: REPORT_MEDIA_BUCKET,
            media_path: mediaPath,
            supabase_error_message: signedUrlErrorMessage,
            status_code: signedUrlStatusCode,
            troubleshooting:
              "Kontrollera att objektet finns i bucketen, att media_path matchar exakt, och att SUPABASE_SERVICE_ROLE_KEY tillhor samma projekt som SUPABASE_URL.",
          });
          const { data: publicUrlData } = supabase.storage.from(REPORT_MEDIA_BUCKET).getPublicUrl(mediaPath);
          if (publicUrlData?.publicUrl) {
            imageUrl = publicUrlData.publicUrl;
            console.info(`[${requestId}] signed URL result`, {
              status: "fallback_public_url",
              bucket: REPORT_MEDIA_BUCKET,
              media_path: mediaPath,
            });
          } else {
            console.warn(`[${requestId}] signed URL result`, {
              status: "missing_signed_and_public_url",
              bucket: REPORT_MEDIA_BUCKET,
              media_path: mediaPath,
            });
          }
        } else {
          imageUrl = signedUrlData.signedUrl;
          console.info(`[${requestId}] Signed URL generation succeeded`, {
            bucket: REPORT_MEDIA_BUCKET,
            media_path: mediaPath,
          });
          console.info(`[${requestId}] signed URL result`, {
            status: "signed_url_success",
            bucket: REPORT_MEDIA_BUCKET,
            media_path: mediaPath,
          });
        }
      } catch (error) {
        const statusCode =
          error?.statusCode ??
          error?.status ??
          error?.cause?.status ??
          null;
        console.warn(`[${requestId}] Signed URL generation failed`, {
          supabase_url: supabaseUrl,
          bucket: REPORT_MEDIA_BUCKET,
          media_path: mediaPath,
          supabase_error_message: error instanceof Error ? error.message : "unknown error",
          status_code: statusCode,
          troubleshooting:
            "Kontrollera att objektet finns i bucketen, att media_path matchar exakt, och att SUPABASE_SERVICE_ROLE_KEY tillhor samma projekt som SUPABASE_URL.",
        });
        const { data: publicUrlData } = supabase.storage.from(REPORT_MEDIA_BUCKET).getPublicUrl(mediaPath);
        if (publicUrlData?.publicUrl) {
          imageUrl = publicUrlData.publicUrl;
          console.info(`[${requestId}] signed URL result`, {
            status: "fallback_public_url_after_exception",
            bucket: REPORT_MEDIA_BUCKET,
            media_path: mediaPath,
          });
        } else {
          console.warn(`[${requestId}] signed URL result`, {
            status: "signed_url_exception_no_public_url",
            bucket: REPORT_MEDIA_BUCKET,
            media_path: mediaPath,
          });
        }
      }

      if (!imageUrl) {
        console.warn(`[${requestId}] No image URL available for email`, {
          bucket: REPORT_MEDIA_BUCKET,
          media_path: mediaPath,
          troubleshooting:
            "Signed URL saknas. Kontrollera tidigare loggrad 'Signed URL generation failed' for exakt Supabase-fel.",
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
    const locationText = resolveLocationText({
      address,
      locality,
      municipality,
      latitude,
      longitude,
    });

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
          city,
          locality,
          municipality,
          latitude,
          longitude,
          location_text: locationText,
          comment,
          happened_at: happenedAt,
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
                <p><strong>Tid:</strong> ${escapeHtml(happenedAt || "just nu")}</p>
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
