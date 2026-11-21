import crypto from "node:crypto";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const ALLOWED_ACTIONS = new Set([
  "inspect_health",
  "inspect_capabilities",
  "draft_content",
  "review_orders"
]);

function parsePlan(content) {
  if (typeof content !== "string" || !content.trim()) {
    const error = new Error("The planning model returned an empty response.");
    error.code = "CENTRAL_INVALID_RESPONSE";
    throw error;
  }
  let value;
  try {
    const cleaned = content.trim().replace(/^`{3}(?:json)?\s*/i, "").replace(/\s*`{3}$/i, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    value = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
  } catch {
    const error = new Error("The planning model returned invalid structured data.");
    error.code = "CENTRAL_INVALID_RESPONSE";
    throw error;
  }
  if (typeof value.summary !== "string" || !value.summary.trim() ||
      !Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 6) {
    const error = new Error("The planning model returned an incomplete plan.");
    error.code = "CENTRAL_INVALID_RESPONSE";
    throw error;
  }
  const steps = value.steps.map((step) => {
    if (!step || !ALLOWED_ACTIONS.has(step.action) ||
        typeof step.description !== "string" || !step.description.trim() ||
        step.description.length > 500) {
      const error = new Error("The plan requested an unsupported or invalid action.");
      error.code = "CENTRAL_UNSUPPORTED_ACTION";
      throw error;
    }
    return {
      action: step.action,
      description: step.description.trim(),
      requiresApproval: true
    };
  });
  return { summary: value.summary.trim().slice(0, 1000), steps };
}

export function createCentralPlanner({
  apiKey = process.env.AI_API_KEY,
  baseUrl = process.env.AI_BASE_URL || DEFAULT_BASE_URL,
  model = process.env.AI_MODEL || "gpt-4o-mini",
  fetchImpl = globalThis.fetch
} = {}) {
  return {
    isConfigured() {
      return Boolean(apiKey && baseUrl && model && typeof fetchImpl === "function");
    },
    async plan({ goal, systemContext = {} } = {}) {
      if (typeof goal !== "string" || goal.trim().length < 6 || goal.trim().length > 1200) {
        const error = new Error("Goal must contain between 6 and 1200 characters.");
        error.code = "CENTRAL_INVALID_GOAL";
        throw error;
      }
      if (!this.isConfigured()) {
        const error = new Error("Central planning is not configured.");
        error.code = "CENTRAL_NOT_CONFIGURED";
        throw error;
      }
      const safeContext = {
        service: typeof systemContext.service === "string" ? systemContext.service.slice(0, 80) : "Suraya",
        capabilities: systemContext.capabilities && typeof systemContext.capabilities === "object"
          ? Object.fromEntries(Object.entries(systemContext.capabilities).filter(([, v]) => typeof v === "boolean").slice(0, 20))
          : {}
      };
      const prompt = [
        "Create a conservative, advisory-only plan for the Suraya operations console.",
        "Return ONLY JSON with: summary (string), steps (array of {action, description}).",
        "Allowed action values are exactly: inspect_health, inspect_capabilities, draft_content, review_orders.",
        "Never propose deployments, payments, transfers, credential changes, deletion, publishing, arbitrary code execution, or database writes.",
        "Plans are proposals only. No action is executed by this endpoint.",
        "Use only the supplied system context; do not invent service status or capabilities.",
        "Keep the plan short, concrete, and relevant to the requested goal.",
        "System context: " + JSON.stringify(safeContext),
        "Goal: " + goal.trim()
      ].join("\n");
      let response;
      try {
        response = await fetchImpl(baseUrl.replace(/\/+$/, "") + "/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: "You are a bounded planning assistant. Return strict JSON only." },
              { role: "user", content: prompt }
            ],
            temperature: 0.2,
            response_format: { type: "json_object" }
          }),
          signal: AbortSignal.timeout(30000)
        });
      } catch {
        const error = new Error("The central planning provider is unavailable.");
        error.code = "CENTRAL_PROVIDER_UNAVAILABLE";
        throw error;
      }
      if (!response.ok) {
        const error = new Error(response.status === 429
          ? "The central planning provider rate limit was reached."
          : "The central planning provider rejected the request.");
        error.code = "CENTRAL_PROVIDER_ERROR";
        throw error;
      }
      let payload;
      try { payload = await response.json(); }
      catch {
        const error = new Error("The central planning provider returned unreadable data.");
        error.code = "CENTRAL_INVALID_RESPONSE";
        throw error;
      }
      const parsed = parsePlan(payload?.choices?.[0]?.message?.content);
      return {
        planId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        goal: goal.trim(),
        summary: parsed.summary,
        steps: parsed.steps,
        mode: "advisory",
        executionEnabled: false
      };
    }
  };
}
