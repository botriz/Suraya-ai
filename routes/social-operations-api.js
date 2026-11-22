import express from "express";
import { timingSafeEqual } from "node:crypto";
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
    // OAuth adapters are intentionally fail-closed until the platform app credentials,
    // redirect URI, scopes and token-encryption key are configured and verified.
    const configured=Boolean(process.env[`SOCIAL_${platform.toUpperCase()}_CLIENT_ID`] && process.env[`SOCIAL_${platform.toUpperCase()}_CLIENT_SECRET`] && process.env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY);
    if(!configured) return res.status(503).json({ok:false,code:"OAUTH_NOT_CONFIGURED",error:"اتصال رسمی این شبکه هنوز پیکربندی نشده است؛ ابتدا اپلیکیشن توسعه‌دهنده و کلید رمزنگاری امن سمت سرور لازم است."});
    return res.status(501).json({ok:false,code:"OAUTH_ADAPTER_PENDING",error:"اعتبارنامه موجود است اما آداپتور و بازبینی OAuth این پلتفرم هنوز فعال نشده است."});
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
        "INSERT INTO suraya_social_posts(platform,title,caption,hashtags,script,media_url,media_type,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,'operator') RETURNING public_id,platform,title,status,created_at",
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
    // No fake scheduling: queue only if an actual publishing adapter and connected account exist.
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      const r=await client.query("SELECT p.id,p.platform,p.status,a.id AS account_id,a.connection_status FROM suraya_social_posts p LEFT JOIN LATERAL (SELECT id,connection_status FROM suraya_social_accounts WHERE platform=p.platform AND connection_status='connected' ORDER BY connected_at DESC NULLS LAST LIMIT 1) a ON TRUE WHERE p.public_id=$1 FOR UPDATE",[id]);
      if(!r.rowCount){await client.query("ROLLBACK");return res.status(404).json({ok:false,error:"محتوا پیدا نشد."});}
      const row=r.rows[0];
      if(row.status!=="approved"){await client.query("ROLLBACK");return res.status(409).json({ok:false,error:"ابتدا باید محتوا تأیید شود."});}
      if(!row.account_id||row.connection_status!=="connected"){await client.query("ROLLBACK");return res.status(409).json({ok:false,code:"ACCOUNT_NOT_CONNECTED",error:"برای زمان‌بندی انتشار، ابتدا حساب رسمی این شبکه باید متصل شود."});}
      await client.query("ROLLBACK");
      return res.status(503).json({ok:false,code:"PUBLISH_ADAPTER_NOT_READY",error:"حساب متصل است اما آداپتور رسمی انتشار و صف اجرایی هنوز برای این شبکه فعال نشده است؛ انتشار انجام نشد."});
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
