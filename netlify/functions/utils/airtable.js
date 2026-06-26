const allowedMethods = "GET,POST,PUT,DELETE,OPTIONS";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-password",
    "Access-Control-Allow-Methods": allowedMethods
  };
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function requireMethod(event, method) {
  if (event.httpMethod === "OPTIONS") {
    return response(204, {});
  }
  if (event.httpMethod !== method) {
    return response(405, { error: `Method ${event.httpMethod} not allowed.` });
  }
  return null;
}

function requireAdmin(event) {
  const expected = process.env.ADMIN_PASSWORD;
  const received = event.headers["x-admin-password"] || event.headers["X-Admin-Password"];
  if (!expected) {
    return response(500, { error: "ADMIN_PASSWORD environment variable is missing." });
  }
  if (received !== expected) {
    return response(401, { error: "Invalid admin password." });
  }
  return null;
}

function getEnv() {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || "Questions";
  if (!token || !baseId || !tableName) {
    throw new Error("Airtable environment variables are not configured.");
  }
  return { token, baseId, tableName };
}

function tableUrl(tableNameOverride) {
  const { baseId, tableName } = getEnv();
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableNameOverride || tableName)}`;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
    "Content-Type": "application/json"
  };
}

async function airtableFetch(url, options = {}) {
  const result = await fetch(url, {
    ...options,
    headers: {
      ...headers(),
      ...(options.headers || {})
    }
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) {
    throw new Error(payload.error?.message || `Airtable returned ${result.status}`);
  }
  return payload;
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

function validateQuestion(input) {
  if (!input.question || !input.correctAnswer) {
    throw new Error("Question and CorrectAnswer are required.");
  }
  const options = Array.isArray(input.options) ? input.options.filter(Boolean) : [];
  if ((input.type || "mcq") !== "short" && options.length < 2) {
    throw new Error("At least two options are required.");
  }
  return {
    Question: String(input.question).trim(),
    Option1: options[0] || "",
    Option2: options[1] || "",
    Option3: options[2] || "",
    Option4: options[3] || "",
    CorrectAnswer: String(input.correctAnswer).trim(),
    Explanation: String(input.explanation || "").trim(),
    Subject: String(input.subject || "Science").trim(),
    Type: String(input.type || "mcq").trim(),
    CreatedAt: input.createdAt || new Date().toISOString()
  };
}

function mapQuestion(record) {
  const fields = record.fields || {};
  return {
    id: record.id,
    question: fields.Question || "",
    options: [fields.Option1, fields.Option2, fields.Option3, fields.Option4].filter(Boolean),
    correctAnswer: fields.CorrectAnswer || "",
    explanation: fields.Explanation || "",
    subject: fields.Subject || "Science",
    type: fields.Type || "mcq",
    createdAt: fields.CreatedAt || record.createdTime
  };
}

module.exports = {
  airtableFetch,
  corsHeaders,
  mapQuestion,
  parseBody,
  requireAdmin,
  requireMethod,
  response,
  tableUrl,
  validateQuestion
};
