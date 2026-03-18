import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Backup-Key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function unauthorized() {
  return {
    statusCode: 401,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ error: "Ogiltig nyckel." }),
  };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const requiredKey = process.env.REPORT_BACKUP_ACCESS_KEY;
  if (!requiredKey) {
    return {
      statusCode: 503,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "REPORT_BACKUP_ACCESS_KEY saknas." }),
    };
  }

  const suppliedKey = event.headers["x-backup-key"] || event.queryStringParameters?.key;
  if (suppliedKey !== requiredKey) {
    return unauthorized();
  }

  const limitRaw = Number(event.queryStringParameters?.limit ?? "20");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 20;
  const store = getStore("snitch-report-backups");

  try {
    const { blobs } = await store.list({ prefix: "reports/" });
    const baseReportKeys = blobs
      .map((blob) => blob.key)
      .filter((key) => !key.endsWith("/delivery"))
      .sort()
      .reverse()
      .slice(0, limit);

    const reports = [];
    for (const key of baseReportKeys) {
      const report = await store.get(key, { type: "json" });
      if (report) {
        reports.push(report);
      }
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        count: reports.length,
        reports,
      }),
    };
  } catch {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Kunde inte läsa backup-rapporter." }),
    };
  }
};
