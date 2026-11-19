const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function parseDraft(content) {
  if (typeof content !== "string" || !content.trim()) throw new Error("مدل خروجی متنی معتبری برنگرداند.");
  const cleaned = content.trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/i, "");
  const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const value = JSON.parse(candidate);
  const fields = ["title", "caption", "hashtags", "script", "cta"];
  for (const field of fields) {
    if (typeof value[field] !== "string" || !value[field].trim()) {
      throw new Error("خروجی مدل ناقص است؛ دوباره تلاش کنید.");
    }
  }
  return Object.fromEntries(fields.map(field => [field, value[field].trim()]));
}

export function createContentEngine({
  apiKey = process.env.AI_API_KEY,
  baseUrl = process.env.AI_BASE_URL || DEFAULT_BASE_URL,
  model = process.env.AI_MODEL || "gpt-4o-mini",
  fetchImpl = globalThis.fetch
} = {}) {
  return {
    isConfigured() {
      return Boolean(apiKey && baseUrl && model && typeof fetchImpl === "function");
    },
    async generate({ topic, platform = "instagram", tone = "professional", language = "fa" }) {
      if (!this.isConfigured()) {
        const error = new Error("موتور هوش مصنوعی هنوز پیکربندی نشده است.");
        error.code = "AI_NOT_CONFIGURED";
        throw error;
      }
      const prompt = [
        "You are Suraya, a professional multilingual social content studio.",
        "Create an original short-form social content package.",
        "Return ONLY a valid JSON object with string fields: title, caption, hashtags, script, cta.",
        "Do not invent facts, statistics, testimonials, prices, or guarantees.",
        "Respect the requested language and platform conventions.",
        `Language: ${language}; platform: ${platform}; tone: ${tone}; topic: ${topic}`,
        "Make the script practical, engaging, and ready for human review before publishing."
      ].join("\n");
      let response;
      try {
        response = await fetchImpl(baseUrl.replace(/\/+$/, "") + "/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: "Return strict JSON only. No markdown fences." }, { role: "user", content: prompt }],
            temperature: 0.7,
            response_format: { type: "json_object" }
          }),
          signal: AbortSignal.timeout(45000)
        });
      } catch (cause) {
        const error = new Error("ارتباط با سرویس هوش مصنوعی برقرار نشد.");
        error.code = "AI_PROVIDER_UNAVAILABLE";
        throw error;
      }
      if (!response.ok) {
        const error = new Error(response.status === 401 || response.status === 403
          ? "کلید یا مجوز سرویس هوش مصنوعی معتبر نیست."
          : response.status === 429 ? "سهمیه سرویس هوش مصنوعی موقتاً تمام شده است."
          : "سرویس هوش مصنوعی موقتاً پاسخ‌گو نیست.");
        error.code = "AI_PROVIDER_ERROR";
        error.status = response.status;
        throw error;
      }
      let payload;
      try { payload = await response.json(); }
      catch { throw new Error("پاسخ سرویس هوش مصنوعی قابل خواندن نیست."); }
      return parseDraft(payload?.choices?.[0]?.message?.content);
    }
  };
}
