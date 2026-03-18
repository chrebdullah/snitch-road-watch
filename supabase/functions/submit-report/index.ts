import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateOnlyIso(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0] ?? null;
}

function maskRegNumber(regNumber: string): string {
  const clean = regNumber.replace(/\s+/g, "").toUpperCase();
  if (clean.length <= 3) return "***";
  if (clean.length <= 5) return `${clean.slice(0, 1)}***${clean.slice(-1)}`;
  return `${clean.slice(0, 2)}***${clean.slice(-2)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const formData = await req.formData();

    const regNumber = formData.get("reg_number")?.toString().trim().toUpperCase() ?? "";
    const latitudeRaw = formData.get("latitude")?.toString() ?? null;
    const longitudeRaw = formData.get("longitude")?.toString() ?? null;
    const address = formData.get("address")?.toString().trim() ?? "";
    const comment = formData.get("comment")?.toString().trim() ?? "";
    const happenedAtRaw = formData.get("happened_at")?.toString() ?? null;

    if (!regNumber) {
      return new Response(JSON.stringify({ error: "reg_number saknas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const latitude = toNumber(latitudeRaw);
    const longitude = toNumber(longitudeRaw);
    const happenedOn = toDateOnlyIso(happenedAtRaw);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: insertedReport, error: insertError } = await supabase
      .from("reports")
      .insert({
        reg_number: regNumber,
        masked_reg: maskRegNumber(regNumber),
        latitude,
        longitude,
        address: address || null,
        comment: comment || null,
        happened_on: happenedOn,
        approved: true,
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const locationText = address || (latitude !== null && longitude !== null ? `${latitude}, ${longitude}` : "–");

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: "snitchsweden@gmail.com",
        subject: "Ny rapport inkommen - SNITCH",
        html: `<h2>Ny rapport</h2>
          <p><strong>Regnr:</strong> ${regNumber}</p>
          <p><strong>Plats:</strong> ${locationText}</p>
          <p><strong>Tid:</strong> ${happenedAtRaw || "just nu"}</p>
          <p><strong>Kommentar:</strong> ${comment || "-"}</p>
          <p><strong>Rapport-ID:</strong> ${insertedReport?.id ?? "okand"}</p>`,
      }),
    });

    if (!emailResponse.ok) {
      const emailError = await emailResponse.text();
      return new Response(JSON.stringify({ error: `Email misslyckades: ${emailError}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: insertedReport?.id ?? null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("submit-report error", error);
    return new Response(JSON.stringify({ error: "Något gick fel" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
