import express from "express";
import { timingSafeEqual } from "node:crypto";
import { createContentEngine } from "../ai/content-engine.js";
import { createResearchEngine } from "../ai/research-engine.js";

export function createCreatorRouter({ engine = createContentEngine(), researchEngine = createResearchEngine(), pool = null, getOperatorToken = () => process.env.SURAYA_OPERATOR_TOKEN, rateLimit = (_req, _res, next) => next() } = {}) {
  const router = express.Router();
  function requireOperator(req,res,next){
    const expected=getOperatorToken();
    const supplied=req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]||"";
    const a=Buffer.from(supplied),b=Buffer.from(expected||"");
    if(!expected||a.length!==b.length||!timingSafeEqual(a,b))return res.status(401).json({ok:false,error:"برای پژوهش منبع‌محور، ورود مدیر الزامی است."});
    next();
  }

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

  router.post("/research-draft", rateLimit, requireOperator, async (req, res) => {
    const topic=typeof req.body?.topic==="string"?req.body.topic.trim():"";
    const category=typeof req.body?.category==="string"?req.body.category:"general";
    const audience=typeof req.body?.audience==="string"?req.body.audience.trim():"";
    const objective=typeof req.body?.objective==="string"?req.body.objective:"engagement";
    const brandVoice=typeof req.body?.brandVoice==="string"?req.body.brandVoice.trim():"";
    const platform=typeof req.body?.platform==="string"?req.body.platform:"instagram";
    const tone=typeof req.body?.tone==="string"?req.body.tone:"professional";
    const language=typeof req.body?.language==="string"?req.body.language:"fa";
    if(topic.length<4||topic.length>1200)return res.status(400).json({ok:false,error:"موضوع باید بین ۴ تا ۱۲۰۰ نویسه باشد."});
    if(audience.length>240||brandVoice.length>240)return res.status(400).json({ok:false,error:"اطلاعات مخاطب یا لحن برند بیش از حد طولانی است."});
    if(!["general","science","health","law","finance","technology"].includes(category))return res.status(400).json({ok:false,error:"حوزهٔ پژوهش معتبر نیست."});
    if(!["awareness","engagement","leads","sales","education"].includes(objective))return res.status(400).json({ok:false,error:"هدف کمپین معتبر نیست."});
    if(!["instagram","youtube","rubika","telegram","facebook","x","tiktok","snapchat","whatsapp","eitaa"].includes(platform))return res.status(400).json({ok:false,error:"سکوی اجتماعی پشتیبانی نمی‌شود."});
    if(!["professional","friendly","educational","sales"].includes(tone)||!["fa","en","ar","tr"].includes(language))return res.status(400).json({ok:false,error:"لحن یا زبان معتبر نیست."});
    if(!pool)return res.status(503).json({ok:false,error:"ذخیره‌سازی پژوهش در پایگاه داده در دسترس نیست."});
    if(!researchEngine.isConfigured())return res.status(503).json({ok:false,code:"RESEARCH_NOT_CONFIGURED",error:"برای پژوهش منبع‌محور، AI_API_KEY و TAVILY_API_KEY باید در تنظیمات امن سرور فعال باشند."});
    try{
      const result=await researchEngine.generate({topic,category,audience,objective,brandVoice,platform,tone,language});
      const saved=await pool.query(
        "INSERT INTO suraya_social_research_runs(query_text,topic_category,provider,source_policy_passed,sources,generated_draft) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb) RETURNING public_id,created_at",
        [topic,category,result.provider,result.sourcePolicyPassed,JSON.stringify(result.sources),JSON.stringify(result.draft)]);
      return res.json({ok:true,draft:result.draft,sources:result.sources,researchId:saved.rows[0].public_id,sourcePolicyPassed:result.sourcePolicyPassed,createdAt:saved.rows[0].created_at,reviewRequired:true});
    }catch(error){
      console.error("Source-grounded research failed:",error.code||"UNKNOWN",error.message);
      const status=error.code==="RESEARCH_NOT_CONFIGURED"?503:error.code==="INSUFFICIENT_TRUSTED_SOURCES"?422:502;
      return res.status(status).json({ok:false,code:error.code||"RESEARCH_FAILED",error:error.message||"پژوهش منبع‌محور انجام نشد."});
    }
  });
  return router;
}
