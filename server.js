import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = Number(process.env.PORT) || 10000;
const HOST = "0.0.0.0";

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "Ata AI",
    time: new Date().toISOString()
  });
});

app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    service: "Ata AI",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.post("/api/order", (req, res) => {
  const { name, email, service, details } = req.body;

  if (!name || !service) {
    return res.status(400).json({
      ok: false,
      error: "نام و نوع خدمت الزامی است."
    });
  }

  const orderId =
    "ATA-" +
    Date.now().toString(36).toUpperCase();

  console.log("NEW ORDER", {
    orderId,
    name,
    email,
    service,
    details,
    createdAt: new Date().toISOString()
  });

  res.json({
    ok: true,
    orderId,
    message:
      "سفارش ثبت شد. برای تکمیل سفارش با ما تماس بگیرید."
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not found"
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Ata AI running on ${HOST}:${PORT}`);
});
