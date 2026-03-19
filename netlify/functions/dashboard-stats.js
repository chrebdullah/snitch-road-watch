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

function resolveLocality(row) {
  return normalizeText(row.city) || normalizeText(row.locality);
}

function resolveLatestIncidentLocationLabel(row) {
  const address = normalizeText(row.address);
  if (address) return address;

  const locality = resolveLocality(row);
  if (locality) return locality;

  const municipality = normalizeText(row.municipality);
  if (municipality) return municipality;

  const latitude = toFiniteNumber(row.latitude ?? row.lat);
  const longitude = toFiniteNumber(row.longitude ?? row.lng);
  if (latitude !== null && longitude !== null) {
    return `GPS ${formatCoordinateLabel(latitude, longitude)}`;
  }

  return "Plats saknas";
}

function resolveStatisticsLocationLabel(row) {
  const locality = resolveLocality(row);
  if (locality) return locality;

  const municipality = normalizeText(row.municipality);
  if (municipality) return municipality;

  const address = normalizeText(row.address);
  if (address) return address;

  const latitude = toFiniteNumber(row.latitude ?? row.lat);
  const longitude = toFiniteNumber(row.longitude ?? row.lng);
  if (latitude !== null && longitude !== null) {
    return `GPS ${formatCoordinateLabel(latitude, longitude)}`;
  }

  return "Plats saknas";
}

function normalizeIncident(row) {
  const latitude = toFiniteNumber(row.latitude ?? row.lat);
  const longitude = toFiniteNumber(row.longitude ?? row.lng);

  return {
    id: row.id,
    created_at: row.created_at,
    masked_reg: row.masked_reg || "***",
    location_label: resolveLatestIncidentLocationLabel(row),
    latitude,
    longitude,
    approved: Boolean(row.approved),
  };
}

function compactError(error) {
  if (!error) return null;
  return {
    message: error.message || "Unknown Supabase error",
    details: error.details || null,
    hint: error.hint || null,
    code: error.code || null,
    status: error.status || error.statusCode || null,
  };
}

function extractMissingColumn(error) {
  const message = error?.message || "";
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column \"?([a-zA-Z0-9_.]+)\"? does not exist/i,
    /Could not find column '([^']+)'/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const raw = match[1];
      return raw.includes(".") ? raw.split(".").pop() : raw;
    }
  }
  return null;
}

async function queryReportsWithColumnFallback(supabase, requestedColumns, limit) {
  let columns = [...requestedColumns];
  let lastError = null;
  const removedColumns = [];

  while (columns.length > 0) {
    const selectColumns = columns.join(", ");
    const result = await supabase
      .from("reports")
      .select(selectColumns)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!result.error) {
      return {
        rows: result.data || [],
        requested_columns: requestedColumns,
        used_columns: columns,
        removed_columns: removedColumns,
      };
    }

    lastError = result.error;
    const missingColumn = extractMissingColumn(result.error);
    if (missingColumn && columns.includes(missingColumn)) {
      columns = columns.filter((column) => column !== missingColumn);
      removedColumns.push(missingColumn);
      continue;
    }

    break;
  }

  return {
    rows: [],
    error: lastError,
    requested_columns: requestedColumns,
    used_columns: columns,
    removed_columns: removedColumns,
  };
}

async function queryLatestReports(supabase) {
  return queryReportsWithColumnFallback(
    supabase,
    ["id", "created_at", "masked_reg", "city", "locality", "municipality", "address", "latitude", "longitude", "lat", "lng", "approved"],
    8
  );
}

async function queryLocationRows(supabase) {
  return queryReportsWithColumnFallback(supabase, ["city", "locality", "municipality", "address", "latitude", "longitude", "lat", "lng"], 5000);
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const requestId = `dashboard-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  console.info(`[${requestId}] dashboard-stats invoked`, {
    method: event.httpMethod,
    path: event.path || null,
  });

  const supabaseUrl = readEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  console.info(`[${requestId}] Supabase URL`, {
    supabase_url: supabaseUrl || null,
    has_service_role_key: Boolean(supabaseServiceRoleKey),
  });

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    const missingError = "Servern saknar Supabase server-konfiguration (SUPABASE_URL och/eller SUPABASE_SERVICE_ROLE_KEY).";
    console.error(`[${requestId}] dashboard-stats configuration error`, {
      has_supabase_url: Boolean(supabaseUrl),
      has_service_role_key: Boolean(supabaseServiceRoleKey),
      error: missingError,
    });
    return jsonResponse(500, { error: missingError });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  console.info(`[${requestId}] dashboard-stats query start`, {
    table: "public.reports",
    since_iso: sinceIso,
  });

  const [{ count: totalCount, error: totalError }, { count: last24hCount, error: last24hError }, latestResult, locationsResult] =
    await Promise.all([
      supabase.from("reports").select("id", { head: true, count: "exact" }),
      supabase.from("reports").select("id", { head: true, count: "exact" }).gte("created_at", sinceIso),
      queryLatestReports(supabase),
      queryLocationRows(supabase),
    ]);

  console.info(`[${requestId}] dashboard-stats query result counts`, {
    total_count: totalCount ?? null,
    last_24h_count: last24hCount ?? null,
    latest_rows: latestResult.rows.length,
    location_rows: locationsResult.rows.length,
    latest_columns_used: latestResult.used_columns || [],
    latest_columns_removed: latestResult.removed_columns || [],
    locations_columns_used: locationsResult.used_columns || [],
    locations_columns_removed: locationsResult.removed_columns || [],
  });

  if (totalError || last24hError || latestResult.error || locationsResult.error) {
    const totalErr = compactError(totalError);
    const last24hErr = compactError(last24hError);
    const latestErr = compactError(latestResult.error);
    const locationsErr = compactError(locationsResult.error);
    const firstError = totalErr || last24hErr || latestErr || locationsErr;

    console.error(`[${requestId}] dashboard-stats Supabase error`, {
      total_error: totalErr,
      last24h_error: last24hErr,
      latest_error: latestErr,
      locations_error: locationsErr,
      failure_message: firstError?.message || "Unknown Supabase error",
    });

    return jsonResponse(500, {
      error: firstError?.message || "Unknown Supabase error",
      details: firstError?.details || null,
      hint: firstError?.hint || null,
      code: firstError?.code || null,
      source: "dashboard-stats",
      request_id: requestId,
    });
  }

  const uniqueLocationLabels = new Set(
    locationsResult.rows.map((row) => resolveStatisticsLocationLabel(row)).filter((label) => label !== "Plats saknas")
  );

  const latestIncidents = latestResult.rows.map(normalizeIncident);

  const debug = {
    data_source: "public.reports",
    total_count_column: "id",
    last_24h_filter_column: "created_at",
    places_columns: locationsResult.used_columns,
    recent_incidents_columns: latestResult.used_columns,
    removed_place_columns: locationsResult.removed_columns,
    removed_recent_incident_columns: latestResult.removed_columns,
  };

  console.info(`[${requestId}] dashboard-stats resolved`, {
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
    request_id: requestId,
  });
};
