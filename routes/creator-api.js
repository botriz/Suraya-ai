import express from "express";
import { createContentEngine } from "../ai/content-engine.js";

export function createCreatorRouter({ engine = createContentEngine(), rateLimit = (_req, _res, next) => next() } = {}) {
  const router = express.Router();
  router.post("/draft", rateLimit, async (req, res) => {
    const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
    const audience = typeof req.body?.audience === "string" ? req.body.audience.trim() : "";
    const objective = typeof req.body?.objective === "string" ? req.body.objective : "engagement";
    const brandVoice = typeof req.body?.brandVoice === "string" ? req.body.brandVoice.trim() : "";
    const platform = typeof req.body?.platform === "string" ? req.body.platform : "instagram";
    const tone = typeof req.body?.tone === "string" ? req.body.tone : "professional";
    const language = typeof req.body?.language === "string" ? req.body.language : "fa";
    if (topic.length < 4 || topic.length > 1200) return res.status(400).json({ ok: false, error: "موضوع باید بین ۴ تا ۱۲۰۰ نویسه باشد." });
    if (audience.length > 240) return res.status(400).json({ ok: false, error: "مخاطب هدف نباید بیشتر از ۲۴۰ نویسه باشد." });
    if (brandVoice.length > 240) return res.status(400).json({ ok: false, error: "راهنمای لحن برند نباید بیشتر از ۲۴۰ نویسه باشد." });
    if (!["awareness", "engagement", "leads", "sales", "education"].includes(objective)) return res.status(400).json({ ok: false, error: "هدف کمپین معتبر نیست." });
    if (!["instagram", "youtube", "rubika", "telegram", "facebook", "x", "tiktok", "snapchat", "whatsapp", "eitaa"].includes(platform)) return res.status(400).json({ ok: false, error: "سکوی انتخاب‌شده پشتیبانی نمی‌شود." });
    if (!["professional", "friendly", "educational", "sales"].includes(tone)) return res.status(400).json({ ok: false, error: "لحن انتخاب‌شده معتبر نیست." });
    if (!["fa", "en", "ar", "tr"].includes(language)) return res.status(400).json({ ok: false, error: "زبان انتخاب‌شده پشتیبانی نمی‌شود." });
    if (!engine.isConfigured()) return res.status(503).json({ ok: false, code: "AI_NOT_CONFIGURED", error: "موتور تولید محتوا هنوز به ارائه‌دهنده هوش مصنوعی متصل نشده است." });
    try {
      const draft = await engine.generate({ topic, audience, objective, brandVoice, platform, tone, language });
      return res.json({ ok: true, draft, reviewRequired: true });
    } catch (error) {
      console.error("Creator generation failed:", error.code || "UNKNOWN");
      return res.status(error.code === "AI_NOT_CONFIGURED" ? 503 : 502).json({
        ok: false, code: error.code || "AI_GENERATION_FAILED",
        error: error.message || "تولید محتوا انجام نشد."
      });
    }
  });
  return router;
}
