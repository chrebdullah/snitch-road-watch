import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const IP_SALT = "snitch-salt-2026";
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_NOTIFICATION_TO = "snitchsweden@gmail.com";
const DEFAULT_NOTIFICATION_FROM = "SNITCH Reports <onboarding@resend.dev>";

async function hashIP(ip: string): Promise<string> {
  const data = new TextEncoder().encode(IP_SALT + ip);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function stripExifFromJpeg(buffer: Uint8Array): Uint8Array {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return buffer;
  const result: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < buffer.length) {
    if (buffer[i] !== 0xff) break;
    const marker = buffer[i + 1];
    if (marker >= 0xe0 && marker <= 0xef) {
      const length = (buffer[i + 2] << 8) | buffer[i + 3];
      if (marker === 0xe0) for (let j = i; j < i + 2 + length; j++) result.push(buffer[j]);
      i += 2 + length;
    } else {
      if (marker === 0xda) { for (let j = i; j < buffer.length; j++) result.push(buffer[j]); break; }
      const length = (buffer[i + 2] << 8) | buffer[i + 3];
      for (let j = i; j < i + 2 + length; j++) result.push(buffer[j]);
      i += 2 + length;
    }
  }
  return new Uint8Array(result);
}

function uint8ToBase64(buffer: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

type NotificationPayload = {
  regNumber: string;
  locationText: string;
  timeOfReport: string;
  vehicleType: string | null;
  comment: string | null;
  attachment: { filename: string; contentType: string; base64Content: string } | null;
};

async function sendNotificationEmail(payload: NotificationPayload): Promise<void> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    throw new Error("RESEND_API_KEY is missing");
  }

  const toAddress = Deno.env.get("REPORT_NOTIFICATION_TO") || DEFAULT_NOTIFICATION_TO;
  const fromAddress = Deno.env.get("REPORT_NOTIFICATION_FROM") || DEFAULT_NOTIFICATION_FROM;

  const lines = [
    "En ny rapport skickades in.",
    "",
    `Registreringsnummer: ${payload.regNumber}`,
    `Plats: ${payload.locationText}`,
    `Tidpunkt: ${payload.timeOfReport}`,
    `Fordonstyp: ${payload.vehicleType || "Ej angiven"}`,
    `Kommentar: ${payload.comment || "Ingen"}`,
  ];

  const body: Record<string, unknown> = {
    from: fromAddress,
    to: [toAddress],
    subject: `Ny SNITCH-rapport: ${payload.regNumber}`,
    text: lines.join("\n"),
  };

  if (payload.attachment) {
    body.attachments = [
      {
        filename: payload.attachment.filename,
        content: payload.attachment.base64Content,
        type: payload.attachment.contentType,
      },
    ];
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend request failed: ${response.status} ${errorText}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const formData = await req.formData();

    // Honeypot
    const honeypot = formData.get("website") as string;
    if (honeypot?.trim()) return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Rate limit
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const ipHash = await hashIP(clientIP);
    const now = new Date();

    const { data: rateData } = await supabase
      .from("rate_limit_ips").select("id, report_count").eq("ip_hash", ipHash).gte("expires_at", now.toISOString()).maybeSingle();

    if (rateData) {
      if (rateData.report_count >= RATE_LIMIT) {
        return new Response(JSON.stringify({ error: "Max 10 rapporter per timme. Försök igen senare." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabase.from("rate_limit_ips").update({ report_count: rateData.report_count + 1 }).eq("id", rateData.id);
    } else {
      await supabase.from("rate_limit_ips").delete().lt("expires_at", now.toISOString());
      await supabase.from("rate_limit_ips").insert({ ip_hash: ipHash, report_count: 1, window_start: now.toISOString(), expires_at: new Date(now.getTime() + RATE_WINDOW_MS).toISOString() });
    }

    // Parse fields
    const regNumber = ((formData.get("reg_number") as string) || "").trim().toUpperCase();
    const vehicleType = (formData.get("vehicle_type") as string) || null;
    const latStr = formData.get("latitude") as string;
    const lngStr = formData.get("longitude") as string;
    const address = (formData.get("address") as string) || null;
    const comment = (formData.get("comment") as string) || null;
    const happenedAt = formData.get("happened_at") as string;
    const file = formData.get("file") as File | null;

    if (!regNumber) {
      return new Response(JSON.stringify({ error: "Registreringsnummer krävs." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // File upload
    let mediaUrl: string | null = null;
    let notificationAttachment: NotificationPayload["attachment"] = null;
    if (file && file.size > 0) {
      let fileBuffer = new Uint8Array(await file.arrayBuffer());
      const contentType = file.type;
      if (contentType === "image/jpeg" || contentType === "image/jpg") fileBuffer = stripExifFromJpeg(fileBuffer);
      const ext = file.name.split(".").pop() ?? "bin";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("report-media").upload(fileName, fileBuffer, { contentType });
      if (!uploadError) mediaUrl = fileName;
      if ((contentType || "").startsWith("image/")) {
        notificationAttachment = {
          filename: file.name || `report-image.${ext}`,
          contentType: contentType || "application/octet-stream",
          base64Content: uint8ToBase64(fileBuffer),
        };
      }
    }

    const latitude = latStr ? parseFloat(latStr) : null;
    const longitude = lngStr ? parseFloat(lngStr) : null;

    const { error } = await supabase.from("reports").insert({
      reg_number: regNumber,
      masked_reg: "***",
      vehicle_type: vehicleType || "car",
      address,
      comment,
      latitude,
      longitude,
      city: null,
      media_url: mediaUrl,
      is_public: false,
      approved: false,
      happened_on: happenedAt ? new Date(happenedAt).toISOString().split("T")[0] : null,
    });

    if (error) throw error;

    const locationText =
      latitude !== null && longitude !== null
        ? `${latitude}, ${longitude}`
        : address || "Ej angiven";

    await sendNotificationEmail({
      regNumber,
      locationText,
      timeOfReport: happenedAt || new Date().toISOString(),
      vehicleType,
      comment,
      attachment: notificationAttachment,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("submit-report error:", err);
    return new Response(JSON.stringify({ error: "Något gick fel. Försök igen." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
