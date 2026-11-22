import express from "express";
import { timingSafeEqual, randomBytes } from "node:crypto";
import { oauthConfigured, createAuthorizationUrl, exchangeAndIdentify } from "../social/oauth-adapters.js";
import { encryptSocialToken, sha256 } from "../social/token-crypto.js";
import { verifyTelegramDestination } from "../social/publish-adapters.js";
const PLATFORMS = ["instagram","youtube","telegram","rubika","facebook","x","tiktok","snapchat","whatsapp","eitaa"];
const POST_STATES = new Set(["draft","in_review","approved","scheduled","publishing","published","failed","cancelled"]);

export function createSocialOperationsRouter({ pool, getToken }) {
  const router = express.Router();
  function authorize(req,res,next) {
    const expected=getToken();
    const supplied=req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]||"";
    const suppliedBuffer=Buffer.from(supplied), expectedBuffer=Buffer.from(expected||"");
    if(!expected || suppliedBuffer.length!==expectedBuffer.length || !timingSafeEqual(suppliedBuffer,expectedBuffer)) {
      return res.status(401).json({ok:false,error:"دسترسی مدیر تأیید نشد."});
    }
    next();
  }
  // OAuth callbacks are public endpoints protected by one-time, short-lived state values.
  router.get("/oauth/:platform/callback",async(req,res)=>{
    const platform=String(req.params.platform||"").toLowerCase();
    const state=typeof req.query.state==="string"?req.query.state:"";
    const code=typeof req.query.code==="string"?req.query.code:"";
    const providerError=typeof req.query.error==="string"?req.query.error:"";
    const finish=kind=>res.redirect(302,"/social-studio.html?connection="+encodeURIComponent(kind));
    if(!pool)return finish("database_unavailable");
    if(providerError)return finish("provider_denied");
    if(!state||!code||!["instagram","facebook","youtube","tiktok","x"].includes(platform))return finish("invalid_callback");
    try{
      const consumed=await pool.query(
        "UPDATE suraya_social_oauth_states SET consumed_at=NOW() WHERE state_hash=$1 AND platform=$2 AND expires_at>NOW() AND consumed_at IS NULL RETURNING code_verifier",
        [sha256(state),platform]);
      if(!consumed.rowCount)return finish("invalid_or_expired_state");
      const result=await exchangeAndIdentify(platform,{code,codeVerifier:consumed.rows[0].code_verifier});
      for(const account of result.accounts){
        const encrypted=encryptSocialToken(account.token);
        await pool.query(
          "INSERT INTO suraya_social_accounts(platform,account_label,external_account_id,connection_status,token_ciphertext,token_key_version,scopes,account_metadata,connected_at,token_expires_at) VALUES($1,$2,$3,'connected',$4,'v1',$5,$6::jsonb,NOW(),$7) ON CONFLICT(platform,external_account_id) DO UPDATE SET account_label=EXCLUDED.account_label,connection_status='connected',token_ciphertext=EXCLUDED.token_ciphertext,token_key_version='v1',scopes=EXCLUDED.scopes,account_metadata=EXCLUDED.account_metadata,connected_at=NOW(),token_expires_at=EXCLUDED.token_expires_at,updated_at=NOW()",
          [account.platform,account.label,account.externalId,encrypted,result.scopes,JSON.stringify(account.metadata),result.expiresAt]);
      }
      await pool.query(
        "INSERT INTO suraya_social_audit_events(actor,action,resource_type,outcome,details) VALUES($1,'account.oauth_connected','social_account','success',$2::jsonb)",
        ["oauth:"+platform,JSON.stringify({count:result.accounts.length,platform})]);
      return finish("connected");
    }catch(error){
      console.error("Social OAuth callback failed:",platform,error.message);
      return finish("oauth_failed");
    }
  });

  router.use(authorize);
  router.use((_req,res,next)=>{ if(!pool) return res.status(503).json({ok:false,error:"پایگاه دادهٔ عملیات اجتماعی در دسترس نیست."}); next(); });

  async function audit(client,actor,action,type,id,outcome,details={}) {
    await client.query(
      "INSERT INTO suraya_social_audit_events(actor,action,resource_type,resource_id,outcome,details) VALUES($1,$2,$3,$4,$5,$6::jsonb)",
      [actor,action,type,id,outcome,JSON.stringify(details)]
    );
  }

  router.get("/plans",async(_req,res)=>{
    try {
      const r=await pool.query("SELECT code,name,monthly_price,currency,limits,features FROM suraya_subscription_plans WHERE active=TRUE ORDER BY monthly_price");
      res.json({ok:true,plans:r.rows,billingEnabled:false,note:"پلن‌ها و سقف‌ها تعریف شده‌اند؛ فعال‌سازی اشتراک و دریافت وجه تا اتصال درگاه پرداخت امن غیرفعال است."});
    } catch(e){ console.error("Social plans read failed:",e.message);res.status(500).json({ok:false,error:"دریافت پلن‌ها ناموفق بود."});}
  });

  router.get("/overview",async(_req,res)=>{
    try {
      const [accounts,posts,jobs,plans]=await Promise.all([
        pool.query("SELECT platform,connection_status,COUNT(*)::int AS count FROM suraya_social_accounts GROUP BY platform,connection_status ORDER BY platform"),
        pool.query("SELECT status,COUNT(*)::int AS count FROM suraya_social_posts GROUP BY status"),
        pool.query("SELECT status,COUNT(*)::int AS count FROM suraya_social_jobs GROUP BY status"),
        pool.query("SELECT COUNT(*)::int AS count FROM suraya_subscription_plans WHERE active=TRUE")
      ]);
      res.json({ok:true,platforms:PLATFORMS,accounts:accounts.rows,posts:posts.rows,jobs:jobs.rows,activePlans:plans.rows[0].count,automation:{publishing:false,liveControl:false,audienceSync:false,reason:"اتصال رسمی و مجوزهای پلتفرم‌ها هنوز پیکربندی نشده‌اند."}});
    } catch(e){console.error("Social overview failed:",e.message);res.status(500).json({ok:false,error:"دریافت نمای کلی ناموفق بود."});}
  });

  router.get("/accounts",async(_req,res)=>{
    try { const r=await pool.query("SELECT id,platform,account_label,external_account_id,connection_status,scopes,connected_at,token_expires_at,created_at,updated_at FROM suraya_social_accounts ORDER BY platform,created_at DESC");res.json({ok:true,accounts:r.rows,platforms:PLATFORMS});}
    catch(e){console.error("Social accounts read failed:",e.message);res.status(500).json({ok:false,error:"دریافت حساب‌ها ناموفق بود."});}
  });

  router.post("/accounts/:platform/connect",async(req,res)=>{
    const platform=String(req.params.platform||"").toLowerCase();
    if(!PLATFORMS.includes(platform)) return res.status(400).json({ok:false,error:"سکوی اجتماعی معتبر نیست."});
    if(platform==="telegram"){
      const botToken=process.env.SOCIAL_TELEGRAM_BOT_TOKEN||"",chatId=process.env.SOCIAL_TELEGRAM_CHAT_ID||"";
      if(!botToken||!chatId||!process.env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY) return res.status(503).json({ok:false,code:"TELEGRAM_NOT_CONFIGURED",error:"توکن ربات و شناسهٔ کانال تلگرام و کلید رمزنگاری باید در تنظیمات امن سرور پیکربندی شوند."});
      try{
        const verified=await verifyTelegramDestination(botToken,chatId);
        const encrypted=encryptSocialToken({botToken,chatId:String(verified.chat.id)});
        const saved=await pool.query(
          "INSERT INTO suraya_social_accounts(platform,account_label,external_account_id,connection_status,token_ciphertext,token_key_version,scopes,account_metadata,connected_at) VALUES('telegram',$1,$2,'connected',$3,'v1',$4,$5::jsonb,NOW()) ON CONFLICT(platform,external_account_id) DO UPDATE SET account_label=EXCLUDED.account_label,connection_status='connected',token_ciphertext=EXCLUDED.token_ciphertext,token_key_version='v1',scopes=EXCLUDED.scopes,account_metadata=EXCLUDED.account_metadata,connected_at=NOW(),updated_at=NOW() RETURNING id,platform,account_label,external_account_id,connection_status",
          [verified.chat.title||verified.chat.username||"Telegram destination",String(verified.chat.id),encrypted,["sendMessage","sendPhoto","sendVideo"],JSON.stringify({chatType:verified.chat.type,botUsername:verified.bot.username,botId:verified.bot.id})]);
        await pool.query("INSERT INTO suraya_social_audit_events(actor,action,resource_type,resource_id,outcome,details) VALUES('operator','account.telegram_connected','social_account',$1,'success',$2::jsonb)",[String(verified.chat.id),JSON.stringify({platform:"telegram"})]);
        return res.json({ok:true,account:saved.rows[0],provider:"telegram"});
      }catch(error){console.error("Telegram connection verification failed:",error.message);return res.status(502).json({ok:false,code:"TELEGRAM_VERIFY_FAILED",error:"اتصال ربات به مقصد تلگرام تأیید نشد؛ دسترسی ربات و شناسهٔ مقصد را بررسی کن."});}
    }
    if(!["instagram","facebook","youtube","tiktok","x"].includes(platform)) return res.status(501).json({ok:false,code:"OAUTH_ADAPTER_UNAVAILABLE",error:"اتصال رسمی این شبکه هنوز آداپتور قابل انتشار ندارد."});
    if(!oauthConfigured(platform)) return res.status(503).json({ok:false,code:"OAUTH_NOT_CONFIGURED",error:"اعتبارنامهٔ برنامهٔ توسعه‌دهنده، نشانی HTTPS سایت و کلید رمزنگاری ۳۲ بایتی سمت سرور باید در تنظیمات امن Render پیکربندی شوند."});
    try{
      const state=randomBytes(32).toString("base64url");
      const codeVerifier=platform==="x"?randomBytes(48).toString("base64url"):null;
      await pool.query(
        "INSERT INTO suraya_social_oauth_states(state_hash,platform,code_verifier,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '10 minutes')",
        [sha256(state),platform,codeVerifier]);
      const authorizationUrl=createAuthorizationUrl(platform,{state,codeVerifier});
      res.json({ok:true,authorizationUrl,expiresInSeconds:600,provider:platform});
    }catch(error){console.error("Social OAuth start failed:",platform,error.message);res.status(503).json({ok:false,error:"شروع اتصال امن این شبکه انجام نشد؛ تنظیمات OAuth را بررسی کن."});}
  });

  router.get("/posts",async(req,res)=>{
    const status=POST_STATES.has(req.query.status)?req.query.status:null;
    const limit=Math.min(100,Math.max(1,Number.parseInt(req.query.limit,10)||50));
    try {const r=await pool.query(
      "SELECT public_id,platform,title,caption,hashtags,script,media_url,media_type,status,scheduled_at,published_at,created_at,updated_at FROM suraya_social_posts WHERE ($1::text IS NULL OR status=$1) ORDER BY created_at DESC LIMIT $2",[status,limit]);
      res.json({ok:true,posts:r.rows});
    } catch(e){console.error("Social posts read failed:",e.message);res.status(500).json({ok:false,error:"دریافت محتواها ناموفق بود."});}
  });

  router.post("/posts",async(req,res)=>{
    const platform=String(req.body?.platform||"").toLowerCase();
    const title=typeof req.body?.title==="string"?req.body.title.trim():"";
    const caption=typeof req.body?.caption==="string"?req.body.caption.trim():"";
    const hashtags=typeof req.body?.hashtags==="string"?req.body.hashtags.trim():"";
    const script=typeof req.body?.script==="string"?req.body.script.trim():"";
    const mediaUrl=typeof req.body?.mediaUrl==="string"?req.body.mediaUrl.trim():"";
    const mediaType=["none","image","video","live"].includes(req.body?.mediaType)?req.body.mediaType:"none";
    if(!PLATFORMS.includes(platform)) return res.status(400).json({ok:false,error:"سکوی اجتماعی معتبر نیست."});
    if(title.length<2||title.length>240||caption.length>12000||hashtags.length>3000||script.length>12000||mediaUrl.length>2000) return res.status(400).json({ok:false,error:"محتوای ارسالی معتبر نیست یا از حد مجاز بیشتر است."});
    if(mediaUrl && !/^https:\/\//i.test(mediaUrl)) return res.status(400).json({ok:false,error:"نشانی رسانه باید HTTPS باشد."});
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      const r=await client.query(
        "INSERT INTO suraya_social_posts(platform,account_id,title,caption,hashtags,script,media_url,media_type,created_by) VALUES($1,(SELECT id FROM suraya_social_accounts WHERE platform=$1 AND connection_status='connected' ORDER BY connected_at DESC NULLS LAST LIMIT 1),$2,$3,$4,$5,$6,$7,'operator') RETURNING public_id,platform,title,status,created_at",
        [platform,title,caption,hashtags,script,mediaUrl||null,mediaType]);
      await audit(client,"operator","post.created","social_post",r.rows[0].public_id,"success",{platform,mediaType});
      await client.query("COMMIT");
      res.status(201).json({ok:true,post:r.rows[0]});
    } catch(e){await client.query("ROLLBACK").catch(()=>{});console.error("Social post create failed:",e.message);res.status(500).json({ok:false,error:"ذخیرهٔ پیش‌نویس ناموفق بود."});}
    finally{client.release();}
  });

  router.post("/posts/:publicId/approve",async(req,res)=>{
    const id=String(req.params.publicId||"");
    if(!/^SPOST-[A-F0-9]{12}$/.test(id)) return res.status(400).json({ok:false,error:"شناسهٔ محتوا معتبر نیست."});
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      const r=await client.query("UPDATE suraya_social_posts SET status='approved',approved_by='operator',approved_at=NOW(),updated_at=NOW() WHERE public_id=$1 AND status IN ('draft','in_review') RETURNING public_id,status,approved_at",[id]);
      if(!r.rowCount){await client.query("ROLLBACK");return res.status(409).json({ok:false,error:"محتوا پیدا نشد یا در وضعیت قابل تأیید نیست."});}
      await audit(client,"operator","post.approved","social_post",id,"success");
      await client.query("COMMIT");res.json({ok:true,post:r.rows[0],published:false});
    } catch(e){await client.query("ROLLBACK").catch(()=>{});console.error("Social post approval failed:",e.message);res.status(500).json({ok:false,error:"تأیید محتوا ناموفق بود."});}
    finally{client.release();}
  });

  router.post("/posts/:publicId/schedule",async(req,res)=>{
    const id=String(req.params.publicId||"");
    const when=Date.parse(req.body?.scheduledAt);
    if(!/^SPOST-[A-F0-9]{12}$/.test(id)||!Number.isFinite(when)||when<Date.now()+60000) return res.status(400).json({ok:false,error:"شناسه یا زمان‌بندی معتبر نیست؛ زمان باید حداقل یک دقیقه در آینده باشد."});
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      const r=await client.query("SELECT p.id,p.public_id,p.platform,p.status,a.id AS account_id,a.connection_status FROM suraya_social_posts p LEFT JOIN LATERAL (SELECT id,connection_status FROM suraya_social_accounts WHERE platform=p.platform AND connection_status='connected' ORDER BY connected_at DESC NULLS LAST LIMIT 1) a ON TRUE WHERE p.public_id=$1 FOR UPDATE",[id]);
      if(!r.rowCount){await client.query("ROLLBACK");return res.status(404).json({ok:false,error:"محتوا پیدا نشد."});}
      const row=r.rows[0];
      if(row.status!=="approved"){await client.query("ROLLBACK");return res.status(409).json({ok:false,error:"ابتدا باید محتوا تأیید شود."});}
      if(!row.account_id||row.connection_status!=="connected"){await client.query("ROLLBACK");return res.status(409).json({ok:false,code:"ACCOUNT_NOT_CONNECTED",error:"برای زمان‌بندی انتشار، ابتدا حساب رسمی این شبکه باید متصل شود."});}
      if(row.platform!=="telegram"){await client.query("ROLLBACK");return res.status(503).json({ok:false,code:"PUBLISH_ADAPTER_NOT_READY",error:"آداپتور انتشار این شبکه هنوز فعال نیست؛ فقط تلگرام در این نسخه به صف انتشار واقعی متصل شده است."});}
      const scheduledAt=new Date(when).toISOString();
      await client.query("UPDATE suraya_social_posts SET status='scheduled',scheduled_at=$2,account_id=$3,updated_at=NOW() WHERE id=$1",[row.id,scheduledAt,row.account_id]);
      await client.query("INSERT INTO suraya_social_jobs(job_type,post_id,status,run_after,max_attempts,idempotency_key,payload) VALUES('publish_post',$1,'queued',$2,1,$3,$4::jsonb) ON CONFLICT(idempotency_key) DO NOTHING",[row.id,scheduledAt,"publish:"+row.public_id,JSON.stringify({platform:row.platform})]);
      await audit(client,"operator","post.scheduled","social_post",id,"success",{platform:row.platform,scheduledAt});
      await client.query("COMMIT");
      res.json({ok:true,postId:id,status:"scheduled",scheduledAt,workerEnabled:true});
    } catch(e){await client.query("ROLLBACK").catch(()=>{});console.error("Social post schedule failed:",e.message);res.status(500).json({ok:false,error:"زمان‌بندی محتوا ناموفق بود."});}
    finally{client.release();}
  });

  router.get("/segments",async(_req,res)=>{
    try {const r=await pool.query("SELECT id,name,description,criteria,source,status,created_at,updated_at FROM suraya_social_segments ORDER BY updated_at DESC");res.json({ok:true,segments:r.rows,note:"ساختار بخش‌بندی آماده است؛ دادهٔ مخاطبان تا اتصال API رسمی شبکه‌ها جمع‌آوری نمی‌شود."});}
    catch(e){console.error("Social segments read failed:",e.message);res.status(500).json({ok:false,error:"دریافت بخش‌های مخاطبان ناموفق بود."});}
  });

  router.post("/segments",async(req,res)=>{
    const name=typeof req.body?.name==="string"?req.body.name.trim():"";
    const description=typeof req.body?.description==="string"?req.body.description.trim():"";
    const criteria=req.body?.criteria;
    if(name.length<2||name.length>160||description.length>500||!criteria||typeof criteria!=="object"||Array.isArray(criteria)||JSON.stringify(criteria).length>4000) return res.status(400).json({ok:false,error:"تعریف بخش مخاطبان معتبر نیست."});
    try {const r=await pool.query("INSERT INTO suraya_social_segments(name,description,criteria) VALUES($1,$2,$3::jsonb) RETURNING id,name,description,criteria,status,created_at",[name,description,JSON.stringify(criteria)]);res.status(201).json({ok:true,segment:r.rows[0],audienceDataConnected:false});}
    catch(e){console.error("Social segment create failed:",e.message);res.status(500).json({ok:false,error:"ذخیرهٔ بخش مخاطبان ناموفق بود."});}
  });

  router.get("/audit",async(req,res)=>{
    const limit=Math.min(100,Math.max(1,Number.parseInt(req.query.limit,10)||50));
    try {const r=await pool.query("SELECT actor,action,resource_type,resource_id,outcome,details,created_at FROM suraya_social_audit_events ORDER BY created_at DESC LIMIT $1",[limit]);res.json({ok:true,events:r.rows});}
    catch(e){console.error("Social audit read failed:",e.message);res.status(500).json({ok:false,error:"دریافت گزارش ممیزی ناموفق بود."});}
  });

  router.get("/calendar",async(req,res)=>{
    const from=typeof req.query.from==="string"?req.query.from:null;
    const to=typeof req.query.to==="string"?req.query.to:null;
    try {
      const r=await pool.query(
        "SELECT id,title,platform,scheduled_for,notes,post_public_id,status,created_at,updated_at FROM suraya_social_calendar_items WHERE ($1::timestamptz IS NULL OR scheduled_for >= $1) AND ($2::timestamptz IS NULL OR scheduled_for < $2) ORDER BY scheduled_for ASC LIMIT 500",
        [from,to]);
      res.json({ok:true,items:r.rows,storage:"postgresql"});
    } catch(e){console.error("Social calendar read failed:",e.message);res.status(500).json({ok:false,error:"دریافت تقویم ناموفق بود."});}
  });

  router.post("/calendar",async(req,res)=>{
    const title=typeof req.body?.title==="string"?req.body.title.trim():"";
    const platform=String(req.body?.platform||"").toLowerCase();
    const notes=typeof req.body?.notes==="string"?req.body.notes.trim():"";
    const when=Date.parse(req.body?.scheduledFor);
    if(title.length<2||title.length>240||!PLATFORMS.includes(platform)||!Number.isFinite(when)||when<Date.now()-86400000||notes.length>2000) return res.status(400).json({ok:false,error:"عنوان، شبکه، تاریخ یا یادداشت معتبر نیست."});
    try {
      const r=await pool.query(
        "INSERT INTO suraya_social_calendar_items(title,platform,scheduled_for,notes) VALUES($1,$2,$3,$4) RETURNING id,title,platform,scheduled_for,notes,status,created_at",
        [title,platform,new Date(when).toISOString(),notes]);
      res.status(201).json({ok:true,item:r.rows[0],storage:"postgresql",publishingScheduled:false});
    } catch(e){console.error("Social calendar create failed:",e.message);res.status(500).json({ok:false,error:"ثبت در تقویم ناموفق بود."});}
  });

  router.delete("/calendar/:id",async(req,res)=>{
    const id=Number.parseInt(req.params.id,10);
    if(!Number.isSafeInteger(id)||id<1) return res.status(400).json({ok:false,error:"شناسهٔ تقویم معتبر نیست."});
    try {
      const r=await pool.query("DELETE FROM suraya_social_calendar_items WHERE id=$1 RETURNING id",[id]);
      if(!r.rowCount) return res.status(404).json({ok:false,error:"مورد تقویم پیدا نشد."});
      res.json({ok:true,deletedId:id});
    } catch(e){console.error("Social calendar delete failed:",e.message);res.status(500).json({ok:false,error:"حذف مورد تقویم ناموفق بود."});}
  });

  return router;
}
