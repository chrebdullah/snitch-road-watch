import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function readEnv(name) {
  try {
    if (typeof Netlify !== "undefined" && Netlify?.env?.get) {
      const value = Netlify.env.get(name);
      if (typeof value === "string" && value.trim().length > 0) return value.trim();
    }
  } catch {
    // Fallback for local runtimes.
  }

  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatCoordinateLabel(latitude, longitude) {
  return `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}

function resolveLocationLabel(row) {
  const city = normalizeText(row.city);
  if (city) return city;

  const address = normalizeText(row.address);
  if (address) return address;

  const latitude = toFiniteNumber(row.latitude ?? row.lat);
  const longitude = toFiniteNumber(row.longitude ?? row.lng);
  if (latitude !== null && longitude !== null) {
    return `GPS ${formatCoordinateLabel(latitude, longitude)}`;
  }

  return "Okänd plats";
}

function normalizeIncident(row) {
  const latitude = toFiniteNumber(row.latitude ?? row.lat);
  const longitude = toFiniteNumber(row.longitude ?? row.lng);

  return {
    id: row.id,
    created_at: row.created_at,
    masked_reg: row.masked_reg || "***",
    location_label: resolveLocationLabel(row),
    latitude,
    longitude,
    approved: Boolean(row.approved),
  };
}

async function queryLatestReports(supabase) {
  const modern = await supabase
    .from("reports")
    .select("id, created_at, masked_reg, city, address, latitude, longitude, approved")
    .order("created_at", { ascending: false })
    .limit(8);

  if (!modern.error) {
    return { rows: modern.data || [], schema: "modern" };
  }

  const legacy = await supabase
    .from("reports")
    .select("id, created_at, masked_reg, city, address, lat, lng, approved")
    .order("created_at", { ascending: false })
    .limit(8);

  if (!legacy.error) {
    return { rows: legacy.data || [], schema: "legacy" };
  }

  return { rows: [], schema: "unknown", error: legacy.error || modern.error };
}

async function queryLocationRows(supabase) {
  const modern = await supabase
    .from("reports")
    .select("city, address, latitude, longitude")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (!modern.error) {
    return { rows: modern.data || [], schema: "modern" };
  }

  const legacy = await supabase
    .from("reports")
    .select("city, address, lat, lng")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (!legacy.error) {
    return { rows: legacy.data || [], schema: "legacy" };
  }

  return { rows: [], schema: "unknown", error: legacy.error || modern.error };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const supabaseUrl = readEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: "Servern saknar Supabase server-konfiguration." });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: totalCount, error: totalError }, { count: last24hCount, error: last24hError }, latestResult, locationsResult] =
    await Promise.all([
      supabase.from("reports").select("id", { head: true, count: "exact" }),
      supabase.from("reports").select("id", { head: true, count: "exact" }).gte("created_at", sinceIso),
      queryLatestReports(supabase),
      queryLocationRows(supabase),
    ]);

  if (totalError || last24hError || latestResult.error || locationsResult.error) {
    console.error("dashboard-stats query error", {
      total_error: totalError?.message || null,
      last24h_error: last24hError?.message || null,
      latest_error: latestResult.error?.message || null,
      locations_error: locationsResult.error?.message || null,
    });
    return jsonResponse(500, { error: "Kunde inte läsa dashboard-statistik." });
  }

  const uniqueLocationLabels = new Set(
    locationsResult.rows.map((row) => resolveLocationLabel(row)).filter((label) => label !== "Okänd plats")
  );

  const latestIncidents = latestResult.rows.map(normalizeIncident);

  // Previous logic used reports_public + city-only counting; that excluded unmoderated rows
  // and collapsed location count to zero when address/city was empty but coordinates existed.
  const debug = {
    data_source: "public.reports",
    includes_unmoderated: true,
    last_24h_field: "created_at",
    location_fallbacks: ["city", "address", "rounded_coordinates"],
    schema_for_latest: latestResult.schema,
    schema_for_locations: locationsResult.schema,
  };

  console.info("dashboard-stats resolved", {
    total_reports: totalCount ?? 0,
    last_24h_reports: last24hCount ?? 0,
    unique_locations: uniqueLocationLabels.size,
    latest_incidents: latestIncidents.length,
    ...debug,
  });

  return jsonResponse(200, {
    total_reports: totalCount ?? 0,
    last_24h_reports: last24hCount ?? 0,
    unique_locations: uniqueLocationLabels.size,
    latest_incidents: latestIncidents,
    debug,
  });
};
