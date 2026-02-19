import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RATE_LIMIT = 3; // max reports per window
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const IP_SALT = "snitch-salt-2026"; // static salt for IP hashing

async function hashIP(ip: string): Promise<string> {
  const data = new TextEncoder().encode(IP_SALT + ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function maskRegNumber(reg: string): string {
  const clean = reg.replace(/\s/g, "").toUpperCase();
  if (clean.length <= 4) return clean;
  const start = clean.slice(0, 2);
  const end = clean.slice(-2);
  return `${start}***${end}`;
}

function validateSwedishReg(reg: string): boolean {
  // Swedish formats: ABC123, ABC 123, AB1234, AB 1234
  const clean = reg.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{2,3}[0-9]{2,4}$/.test(clean) && clean.length >= 4 && clean.length <= 7;
}

// Strip EXIF by re-encoding JPEG/PNG through canvas-like byte manipulation
// For server-side: we strip EXIF from JPEG by removing APP1 segments
function stripExifFromJpeg(buffer: Uint8Array): Uint8Array {
  // JPEG starts with FF D8
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return buffer;

  const result: number[] = [0xff, 0xd8];
  let i = 2;

  while (i < buffer.length) {
    if (buffer[i] !== 0xff) break;
    const marker = buffer[i + 1];

    // APP0 (JFIF), APP1 (EXIF/XMP), APP2–APP15 (various metadata)
    if (marker >= 0xe0 && marker <= 0xef) {
      // Skip this APP segment (contains metadata)
      const length = (buffer[i + 2] << 8) | buffer[i + 3];
      // Keep APP0 (JFIF baseline info), strip everything else
      if (marker === 0xe0) {
        for (let j = i; j < i + 2 + length; j++) result.push(buffer[j]);
      }
      i += 2 + length;
    } else {
      // Keep all other segments (actual image data)
      if (marker === 0xda) {
        // Start of scan – rest is image data, copy everything
        for (let j = i; j < buffer.length; j++) result.push(buffer[j]);
        break;
      }
      const length = (buffer[i + 2] << 8) | buffer[i + 3];
      for (let j = i; j < i + 2 + length; j++) result.push(buffer[j]);
      i += 2 + length;
    }
  }

  return new Uint8Array(result);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const formData = await req.formData();

    // Honeypot check: if 'website' field has a value, it's a bot
    const honeypot = formData.get("website") as string;
    if (honeypot && honeypot.trim() !== "") {
      // Silently accept but don't store
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting via hashed IP
    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const ipHash = await hashIP(clientIP);

    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_WINDOW_MS);

    // Check current count
    const { data: rateData } = await supabase
      .from("rate_limit_ips")
      .select("id, report_count, window_start")
      .eq("ip_hash", ipHash)
      .gte("expires_at", now.toISOString())
      .maybeSingle();

    if (rateData) {
      if (rateData.report_count >= RATE_LIMIT) {
        return new Response(
          JSON.stringify({ error: "För många rapporter. Försök igen om en timme." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Increment count
      await supabase
        .from("rate_limit_ips")
        .update({ report_count: rateData.report_count + 1 })
        .eq("id", rateData.id);
    } else {
      // Clean up old entries and insert new
      await supabase
        .from("rate_limit_ips")
        .delete()
        .lt("expires_at", now.toISOString());

      await supabase.from("rate_limit_ips").insert({
        ip_hash: ipHash,
        report_count: 1,
        window_start: now.toISOString(),
        expires_at: new Date(now.getTime() + RATE_WINDOW_MS).toISOString(),
      });
    }

    // Parse fields
    const regNumber = (formData.get("reg_number") as string)?.trim().toUpperCase().replace(/\s/g, "") ?? "";
    const latStr = formData.get("latitude") as string;
    const lngStr = formData.get("longitude") as string;
    const isPublic = formData.get("is_public") === "true";
    const file = formData.get("file") as File | null;

    // Validate reg number
    if (!regNumber || !validateSwedishReg(regNumber)) {
      return new Response(
        JSON.stringify({ error: "Ogiltigt registreringsnummer. Exempel: ABC 123" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let mediaUrl: string | null = null;

    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      let fileBuffer = new Uint8Array(arrayBuffer);
      let contentType = file.type;

      // Strip EXIF from JPEGs
      if (contentType === "image/jpeg" || contentType === "image/jpg") {
        fileBuffer = stripExifFromJpeg(fileBuffer);
      }

      const ext = file.name.split(".").pop() ?? "bin";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("report-media")
        .upload(fileName, fileBuffer, { contentType });

      if (!uploadError) {
        mediaUrl = fileName;
      }
    }

    const masked = maskRegNumber(regNumber);

    // Only store lat/lng if user explicitly provided them (no EXIF extraction)
    const latitude = latStr ? parseFloat(latStr) : null;
    const longitude = lngStr ? parseFloat(lngStr) : null;

    const { error } = await supabase.from("reports").insert({
      reg_number: regNumber,
      masked_reg: masked,
      latitude,
      longitude,
      city: null,
      media_url: mediaUrl,
      is_public: isPublic,
      approved: false,
    });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("submit-report error:", err);
    return new Response(JSON.stringify({ error: "Något gick fel. Försök igen." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
