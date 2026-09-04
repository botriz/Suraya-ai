import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import compression from "compression";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "localhost";

// ============================================
// 🛡️ SECURITY MIDDLEWARE
// ============================================

app.use(helmet()); // سرصحافی امنیتی
app.use(compression()); // فشرده‌سازی

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["*"],
  credentials: true,
}));

// Body Parser
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// ============================================
// 📊 LOGGING
// ============================================

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// 🗂️ STATIC FILES
// ============================================

app.use(express.static(path.join(__dirname, "public")));

// ============================================
// 📡 API ROUTES
// ============================================

// AI - تولید متن
app.post("/api/ai/generate-text", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "موضوع الزامی است" });
    }
    
    // TODO: پیاده‌سازی تولید متن
    res.json({ 
      text: "متن تولید شده برای موضوع: " + topic,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("❌ خطا:", err);
    res.status(500).json({ error: err.message });
  }
});

// AI - تولید تصویر
app.post("/api/ai/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "توضیح تصویر الزامی است" });
    }
    
    // TODO: پیاده‌سازی تولید تصویر
    res.json({ 
      url: "https://placeholder-image.com/image.jpg",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("❌ خطا:", err);
    res.status(500).json({ error: err.message });
  }
});

// AI - تولید ویدئو
app.post("/api/ai/generate-video", async (req, res) => {
  try {
    const { script } = req.body;
    if (!script) {
      return res.status(400).json({ error: "متن سناریو الزامی است" });
    }
    
    // TODO: پیاده‌سازی تولید ویدئو
    res.json({ 
      url: "https://placeholder-video.com/video.mp4",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("❌ خطا:", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin - پنل ادمین
app.post("/api/admin/unlock", (req, res) => {
  try {
    const { key } = req.body;
    if (!key) {
      return res.status(401).json({ error: "کلید ادمین الزامی است" });
    }
    
    // TODO: اعتبارسنجی کلید ادمین
    res.json({ 
      authorized: true,
      message: "ادمین شناسایی شد"
    });
  } catch (err) {
    console.error("❌ خطا:", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin - دسترسی به کور ثریا
app.get("/api/admin/suraya-core", (req, res) => {
  try {
    // TODO: بررسی احراز‌هویت ادمین
    res.json({
      status: "ثریا کور فعال است",
      version: process.env.SURAYA_VERSION || "1.0.0",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("❌ خطا:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 📊 STATUS & HEALTH CHECK
// ============================================

app.get("/api/status", (req, res) => {
  res.json({
    status: "🟢 فعال",
    server: "ثریا AI",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    nodeVersion: process.version
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// ============================================
// 📄 HTML PAGES
// ============================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard.html"));
});

// ============================================
// ❌ 404 ERROR HANDLER
// ============================================

app.use((req, res) => {
  res.status(404).json({
    error: "صفحه پیدا نشد",
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ⚠️ GLOBAL ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
  console.error("❌ خطای سرور:", err);
  res.status(500).json({
    error: "خطای داخلی سرور",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// 🚀 SERVER START
// ============================================

const server = app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║            🌟 SURAYA AI SERVER 🌟                        ║
║                                                            ║
║  ✅ سرور در حال اجرا است                                 ║
║  📍 آدرس: http://${HOST}:${PORT}                          ║
║  🟢 وضعیت: فعال                                          ║
║                                                            ║
║  مسیرهای دسترسی‌پذیر:                                    ║
║  GET    /                        - صفحهٔ اصلی              ║
║  GET    /admin                   - پنل ادمین              ║
║  GET    /api/status              - وضعیت سرور             ║
║  POST   /api/ai/generate-text    - تولید متن             ║
║  POST   /api/ai/generate-image   - تولید تصویر           ║
║  POST   /api/ai/generate-video   - تولید ویدئو           ║
║  POST   /api/admin/unlock        - ورود ادمین            ║
║  GET    /api/admin/suraya-core   - کور ثریا              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful Shutdown
process.on("SIGTERM", () => {
  console.log("📴 درخواست خاموشی دریافت شد...");
  server.close(() => {
    console.log("✅ سرور خاموش شد");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("📴 سرور متوقف شد");
  process.exit(0);
});

export default app;
