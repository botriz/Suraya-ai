import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT) || 10000;
const HOST = "0.0.0.0";

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));

const services = {
  social_content: { title: "بسته محتوای شبکه‌های اجتماعی", price: 5, currency: "USD" },
  business_content: { title: "بسته محتوای کسب‌وکار", price: 10, currency: "USD" },
  product_descriptions: { title: "توضیحات محصولات فروشگاه", price: 5, currency: "USD" }
};

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    })
  : null;

let databaseReady = false;
let databaseError = "DATABASE_URL is not configured";
const requestBuckets = new Map();

async function initializeDatabase() {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suraya_orders (
        id BIGSERIAL PRIMARY KEY,
        public_id TEXT UNIQUE NOT NULL,
        customer_name VARCHAR(120) NOT NULL,
        customer_email VARCHAR(254),
        service_code VARCHAR(60) NOT NULL,
        service_title VARCHAR(160) NOT NULL,
        details TEXT NOT NULL DEFAULT '',
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    databaseReady = true;
    databaseError = "";
    console.log("Suraya order database ready");
  } catch (error) {
    databaseReady = false;
    databaseError = error.message;
    console.error("Suraya database initialization failed:", error.message);
  }
}

function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const bucket = requestBuckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start > 10 * 60 * 1000) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  requestBuckets.set(key, bucket);
  if (requestBuckets.size > 5000) {
    for (const [ip, value] of requestBuckets) {
      if (now - value.start > 10 * 60 * 1000) requestBuckets.delete(ip);
    }
  }
  if (bucket.count > 8) {
    return res.status(429).json({ ok: false, error: "تعداد درخواست‌ها زیاد است؛ چند دقیقه دیگر دوباره تلاش کنید." });
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "Suraya", time: new Date().toISOString() });
});

app.get("/api/status", (_req, res) => {
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? "ready" : "degraded",
    service: "Suraya",
    version: "1.1.0",
    orderIntake: databaseReady,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/services", (_req, res) => {
  res.json({ ok: true, services });
});

app.post("/api/order", rateLimit, async (req, res) => {
  if (!databaseReady || !pool) {
    return res.status(503).json({
      ok: false,
      error: "ثبت سفارش هنوز فعال نشده است. پایگاه داده پایدار باید توسط مدیر سامانه متصل شود."
    });
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const serviceCode = typeof req.body?.service === "string" ? req.body.service : "";
  const details = typeof req.body?.details === "string" ? req.body.details.trim() : "";

  if (name.length < 2 || name.length > 120) {
    return res.status(400).json({ ok: false, error: "نام باید بین ۲ تا ۱۲۰ نویسه باشد." });
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return res.status(400).json({ ok: false, error: "نشانی ایمیل معتبر نیست." });
  }
  if (!Object.hasOwn(services, serviceCode)) {
    return res.status(400).json({ ok: false, error: "خدمت انتخاب‌شده معتبر نیست." });
  }
  if (details.length > 4000) {
    return res.status(400).json({ ok: false, error: "توضیحات نباید بیشتر از ۴۰۰۰ نویسه باشد." });
  }

  const service = services[serviceCode];
  try {
    const inserted = await pool.query(
      `INSERT INTO suraya_orders
        (public_id, customer_name, customer_email, service_code, service_title, details)
       VALUES ('SUR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
        $1, $2, $3, $4, $5)
       RETURNING public_id, created_at`,
      [name, email || null, serviceCode, service.title, details]
    );
    return res.status(201).json({
      ok: true,
      orderId: inserted.rows[0].public_id,
      createdAt: inserted.rows[0].created_at,
      message: "درخواست شما با موفقیت در سامانه ثبت شد. تیم ثریا برای هماهنگی با شما تماس می‌گیرد."
    });
  } catch (error) {
    console.error("Order persistence failed:", error.message);
    return res.status(500).json({ ok: false, error: "ثبت درخواست با خطا روبه‌رو شد؛ لطفاً بعداً تلاش کنید." });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

await initializeDatabase();
app.listen(PORT, HOST, () => {
  console.log(`Suraya running on ${HOST}:${PORT}`);
});

if (pool) {
  pool.on("error", (error) => {
    databaseReady = false;
    databaseError = error.message;
    console.error("Database pool error:", error.message);
  });
}
