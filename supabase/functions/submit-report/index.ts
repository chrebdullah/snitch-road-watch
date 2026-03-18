import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const IP_SALT = "snitch-salt-2026";
const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_FROM = "onboarding@resend.dev";
const RESEND_TO = "snitchsweden@gmail.com";

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

async function sendNotificationEmail(payload: {
  reportId: string;
  regNumber: string;
  createdAt: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  comment: string | null;
  vehicleType: string;
}) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) throw new Error("RESEND_API_KEY saknas");

  const locationText = payload.address?.trim()
    ? payload.address
    : payload.latitude !== null && payload.longitude !== null
      ? `${payload.latitude}, ${payload.longitude}`
      : "Ej angiven";

  const html = `
    <h2>Ny rapport inkommen - SNITCH</h2>
    <p><strong>Regnummer:</strong> ${payload.regNumber}</p>
    <p><strong>Adress:</strong> ${locationText}</p>
    <p><strong>Tid:</strong> ${payload.createdAt}</p>
    <p><strong>Kommentar:</strong> ${payload.comment?.trim() || "Ingen kommentar"}</p>
    <p><strong>Fordonstyp:</strong> ${payload.vehicleType}</p>
    <p><strong>Rapport-ID:</strong> ${payload.reportId}</p>
  `;

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [RESEND_TO],
      subject: "🚨 Ny rapport inkommen – SNITCH",
      html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Resend misslyckades (${response.status}): ${responseText}`);
  }

  const responseJson = await response.json();
  console.info("Resend email sent", { id: responseJson?.id ?? null, to: RESEND_TO });
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
        return new Response(JSON.stringify({ error: "Max 5 rapporter per timme. Försök igen senare." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabase.from("rate_limit_ips").update({ report_count: rateData.report_count + 1 }).eq("id", rateData.id);
    } else {
      await supabase.from("rate_limit_ips").delete().lt("expires_at", now.toISOString());
      await supabase.from("rate_limit_ips").insert({ ip_hash: ipHash, report_count: 1, window_start: now.toISOString(), expires_at: new Date(now.getTime() + RATE_WINDOW_MS).toISOString() });
    }

    // Parse fields
    const regNumber = (formData.get("reg_number") as string)?.trim().toUpperCase() || "ANON";
    const vehicleType = (formData.get("vehicle_type") as string) || "car";
    const latStr = formData.get("latitude") as string;
    const lngStr = formData.get("longitude") as string;
    const address = (formData.get("address") as string) || null;
    const comment = (formData.get("comment") as string) || null;
    const happenedAt = formData.get("happened_at") as string;
    const file = formData.get("file") as File | null;

    // File upload
    let mediaUrl: string | null = null;
    if (file && file.size > 0) {
      let fileBuffer = new Uint8Array(await file.arrayBuffer());
      const contentType = file.type;
      if (contentType === "image/jpeg" || contentType === "image/jpg") fileBuffer = stripExifFromJpeg(fileBuffer);
      const ext = file.name.split(".").pop() ?? "bin";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("report-media").upload(fileName, fileBuffer, { contentType });
      if (!uploadError) mediaUrl = fileName;
    }

    const latitude = latStr ? parseFloat(latStr) : null;
    const longitude = lngStr ? parseFloat(lngStr) : null;

    const { data: insertedReport, error: insertError } = await supabase
      .from("reports")
      .insert({
        reg_number: "ANON",
        masked_reg: "***",
        vehicle_type: vehicleType,
        address,
        comment,
        latitude,
        longitude,
        city: null,
        media_url: mediaUrl,
        is_public: false,
        approved: false,
        happened_on: happenedAt ? new Date(happenedAt).toISOString().split("T")[0] : null,
      })
      .select("id, created_at, address, latitude, longitude, comment, vehicle_type")
      .single();

    if (insertError || !insertedReport) throw insertError ?? new Error("Rapport kunde inte skapas");

    await sendNotificationEmail({
      reportId: insertedReport.id,
      regNumber,
      createdAt: insertedReport.created_at,
      address: insertedReport.address,
      latitude: insertedReport.latitude,
      longitude: insertedReport.longitude,
      comment: insertedReport.comment,
      vehicleType: insertedReport.vehicle_type,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("submit-report error:", err);
    return new Response(JSON.stringify({ error: "Något gick fel. Försök igen." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
