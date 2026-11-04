const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/xgia73743-svg\.github\.io$/,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
  /^http:\/\/localhost(?::\d+)?$/,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/
];

function getCorsOrigin(request) {
  const origin = request.headers.origin || "";
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin)) ? origin : "https://xgia73743-svg.github.io";
}

export default async function handler(request, response) {
  const origin = getCorsOrigin(request);
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Max-Age", "86400");
  response.setHeader("Vary", "Origin");
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (request.method !== "POST") {
    response.status(405).json({ error: { message: "Only POST is allowed." } });
    return;
  }

  const authorization = request.headers.authorization || "";
  if (!/^Bearer\s+(sk-|sk-proj-)/i.test(authorization)) {
    response.status(401).json({ error: { message: "Missing or invalid API key." } });
    return;
  }

  const payload = request.body;
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.input)) {
    response.status(400).json({ error: { message: "Invalid request body." } });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authorization
      },
      body: JSON.stringify({
        model: String(payload.model || "gpt-5-mini"),
        tools: Array.isArray(payload.tools) ? payload.tools : [],
        tool_choice: payload.tool_choice || "auto",
        text: payload.text,
        input: payload.input
      }),
      signal: controller.signal
    });

    const body = await upstream.text();
    response.status(upstream.status);
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    response.send(body);
  } catch (error) {
    const timedOut = error && error.name === "AbortError";
    response.status(timedOut ? 504 : 502).json({
      error: {
        message: timedOut ? "AI 请求超时，请稍后重试。" : "无法连接 AI 服务，请稍后重试。"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}
