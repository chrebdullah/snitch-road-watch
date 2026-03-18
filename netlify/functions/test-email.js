const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Test-Email-Key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function readEnv(name) {
  try {
    if (typeof Netlify !== "undefined" && Netlify?.env?.get) {
      const value = Netlify.env.get(name);
      return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    }
  } catch {
    // Fallback till process.env lokalt.
  }

  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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

function isValidEmail(value) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseEmailList(value) {
  if (!value) return [];
  return value
    .split(/[;,]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const requestId = `test-email-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const requiredTestKey = readEnv("TEST_EMAIL_ACCESS_KEY") ?? readEnv("REPORT_BACKUP_ACCESS_KEY");
  const suppliedTestKey = event.headers?.["x-test-email-key"] || event.headers?.["X-Test-Email-Key"];
  if (!requiredTestKey) {
    console.error(`[${requestId}] TEST_EMAIL_ACCESS_KEY/REPORT_BACKUP_ACCESS_KEY missing`);
    return jsonResponse(503, { error: "Test-endpoint saknar access key-konfiguration." });
  }
  if (suppliedTestKey !== requiredTestKey) {
    console.error(`[${requestId}] Unauthorized test-email attempt`);
    return jsonResponse(401, { error: "Ogiltig testnyckel." });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Felaktig JSON i request." });
  }

  const { key: resendApiKey, source: resendApiKeySource } = resolveResendApiKey();
  console.info(`[${requestId}] Resend key status: ${resendApiKey ? "exists" : "missing"}${resendApiKeySource ? ` (${resendApiKeySource})` : ""}`);
  if (!resendApiKey) {
    return jsonResponse(500, {
      ok: false,
      error: "Resend API-nyckel saknas (RESEND_API_KEY/SNITCH_RESEND_API_KEY/RESEND_KEY).",
    });
  }

  const recipientRaw = typeof payload.recipient === "string" ? payload.recipient.trim().toLowerCase() : "";
  const configuredPrimary = parseEmailList(readEnv("SNITCH_TO_EMAIL")).filter(isValidEmail);
  const configuredFallback = parseEmailList(readEnv("SNITCH_TO_EMAIL_FALLBACK")).filter(isValidEmail);
  let recipient = null;
  let hardcodedFallbackUsed = false;

  if (isValidEmail(recipientRaw)) {
    recipient = recipientRaw;
  } else {
    recipient = configuredPrimary[0] || configuredFallback[0] || null;
  }

  if (!recipient) {
    recipient = "snitchsweden@gmail.com";
    hardcodedFallbackUsed = true;
    console.warn(`[${requestId}] Recipient env vars missing in test-email. Using hardcoded emergency fallback.`);
  }
  const from = readEnv("SNITCH_FROM_EMAIL") || "onboarding@resend.dev";

  console.info(`[${requestId}] Sending test email`, { recipient, hardcoded_fallback_used: hardcodedFallbackUsed });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: "SNITCH testmail från Netlify production",
      html: `<h2>Testmail från SNITCH</h2><p>Tid: ${new Date().toISOString()}</p><p>Detta bekräftar att Resend-kedjan är aktiv.</p>`,
    }),
  });

  if (!response.ok) {
    const raw = (await response.text()).slice(0, 300);
    console.error(`[${requestId}] Test email failed`, { recipient, error: raw });
    return jsonResponse(502, {
      ok: false,
      recipient,
      error: raw || "Resend returnerade fel vid testutskick.",
    });
  }

  const body = await response.json().catch(() => ({}));
  console.info(`[${requestId}] Test email success`, { recipient });
  return jsonResponse(200, {
    ok: true,
    recipient,
    resend_id: body?.id ?? null,
    resend_key_source: resendApiKeySource,
  });
};
