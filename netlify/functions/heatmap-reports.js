import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BASE_COLUMNS = ["id", "created_at", "approved"];
const COORD_COLUMNS = ["latitude", "longitude", "lat", "lng"];

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

async function queryRowsWithColumnFallback(supabase) {
  let selectedCoords = [...COORD_COLUMNS];
  const removedColumns = [];

  while (true) {
    const selectedColumns = [...BASE_COLUMNS, ...selectedCoords].join(", ");
    const result = await supabase
      .from("reports")
      .select(selectedColumns)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (!result.error) {
      return {
        rows: result.data || [],
        used_columns: selectedCoords,
        removed_columns: removedColumns,
        error: null,
      };
    }

    const missingColumn = extractMissingColumn(result.error);
    if (missingColumn && selectedCoords.includes(missingColumn)) {
      selectedCoords = selectedCoords.filter((column) => column !== missingColumn);
      removedColumns.push(missingColumn);
      if (selectedCoords.length === 0) {
        return {
          rows: [],
          used_columns: selectedCoords,
          removed_columns: removedColumns,
          error: result.error,
        };
      }
      continue;
    }

    return {
      rows: [],
      used_columns: selectedCoords,
      removed_columns: removedColumns,
      error: result.error,
    };
  }
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const requestId = `heatmap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, {
      error: "Servern saknar Supabase server-konfiguration.",
      request_id: requestId,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const queryResult = await queryRowsWithColumnFallback(supabase);

  if (queryResult.error) {
    return jsonResponse(500, {
      error: queryResult.error.message || "Kunde inte läsa rapporter för heatmap.",
      details: queryResult.error.details || null,
      hint: queryResult.error.hint || null,
      code: queryResult.error.code || null,
      request_id: requestId,
    });
  }

  return jsonResponse(200, {
    rows: queryResult.rows,
    data_source: "public.reports",
    time_field: "created_at",
    coordinate_fields_supported: ["latitude/longitude", "lat/lng"],
    used_coordinate_columns: queryResult.used_columns,
    removed_coordinate_columns: queryResult.removed_columns,
    request_id: requestId,
  });
};
