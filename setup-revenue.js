import fs from "fs";

// اطمینان از وجود پوشه‌ها
fs.mkdirSync("models", { recursive: true });

// مدل کاربران + کیف‌پول + تراکنش‌ها
fs.writeFileSync("models/users.json", JSON.stringify({
  users: []
}, null, 2));

fs.writeFileSync("models/transactions.json", JSON.stringify({
  transactions: []
}, null, 2));

fs.writeFileSync("models/plans.json", JSON.stringify({
  plans: [
    {
      id: "basic",
      name: "پلن پایه",
      price: 50000,
      currency: "IRR",
      dailyLimit: 5
    },
    {
      id: "pro",
      name: "پلن حرفه‌ای",
      price: 150000,
      currency: "IRR",
      dailyLimit: 20
    }
  ]
}, null, 2));

// به‌روزرسانی server.js برای اضافه کردن سیستم درآمدی
const serverCode = `
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import axios from "axios";

import { generateScript } from "./ai/textGenerator.js";
import { generateImage } from "./ai/imageGenerator.js";
import { generateVideo } from "./ai/videoGenerator.js";
import { composeVideo } from "./ai/videoComposer.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// ابزارهای ساده برای خواندن/نوشتن مدل‌ها
function readJSON(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}
function writeJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

// گرفتن یا ساختن کاربر
function getOrCreateUser(userId) {
  const db = readJSON("models/users.json");
  let user = db.users.find(u => u.id === userId);
  if (!user) {
    user = {
      id: userId,
      wallet: 0,
      planId: null,
      usageToday: 0,
      lastUsageDate: null
    };
    db.users.push(user);
    writeJSON("models/users.json", db);
  }
  return user;
}

// ثبت تراکنش
function addTransaction(userId, type, amount, meta = {}) {
  const db = readJSON("models/transactions.json");
  const tx = {
    id: "tx_" + Date.now(),
    userId,
    type,
    amount,
    meta,
    createdAt: new Date().toISOString()
  };
  db.transactions.push(tx);
  writeJSON("models/transactions.json", db);
  return tx;
}

// گرفتن پلن
function getPlan(planId) {
  const db = readJSON("models/plans.json");
  return db.plans.find(p => p.id === planId) || null;
}

// ریست مصرف روزانه
function resetUsageIfNeeded(user) {
  const today = new Date().toISOString().slice(0, 10);
  if (user.lastUsageDate !== today) {
    user.usageToday = 0;
    user.lastUsageDate = today;
    const db = readJSON("models/users.json");
    const idx = db.users.findIndex(u => u.id === user.id);
    db.users[idx] = user;
    writeJSON("models/users.json", db);
  }
}

// API: شارژ کیف‌پول (شبیه‌سازی پرداخت موفق)
app.post("/wallet/topup", (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ error: "پارامتر نامعتبر" });
    }
    const db = readJSON("models/users.json");
    let user = db.users.find(u => u.id === userId);
    if (!user) {
      user = getOrCreateUser(userId);
    }
    user.wallet += amount;
    const idx = db.users.findIndex(u => u.id === user.id);
    db.users[idx] = user;
    writeJSON("models/users.json", db);

    const tx = addTransaction(userId, "wallet_topup", amount, { simulated: true });

    res.json({ ok: true, wallet: user.wallet, transaction: tx });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: خرید پلن اشتراک
app.post("/plans/subscribe", (req, res) => {
  try {
    const { userId, planId } = req.body;
    if (!userId || !planId) {
      return res.status(400).json({ error: "پارامتر نامعتبر" });
    }

    const plan = getPlan(planId);
    if (!plan) {
      return res.status(404).json({ error: "پلن یافت نشد" });
    }

    const db = readJSON("models/users.json");
    let user = db.users.find(u => u.id === userId);
    if (!user) {
      user = getOrCreateUser(userId);
    }

    if (user.wallet < plan.price) {
      return res.status(400).json({ error: "موجودی کیف‌پول کافی نیست" });
    }

    user.wallet -= plan.price;
    user.planId = plan.id;
    user.usageToday = 0;
    user.lastUsageDate = new Date().toISOString().slice(0, 10);

    const idx = db.users.findIndex(u => u.id === user.id);
    db.users[idx] = user;
    writeJSON("models/users.json", db);

    const tx = addTransaction(userId, "plan_subscribe", plan.price, { planId: plan.id });

    res.json({ ok: true, user, transaction: tx, plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// میدل‌ور چک کردن مجوز استفاده از تولید محتوا
async function checkAccess(req, res, next) {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId لازم است" });
    }

    let user = getOrCreateUser(userId);
    resetUsageIfNeeded(user);

    if (!user.planId) {
      return res.status(403).json({ error: "پلن فعال نیست" });
    }

    const plan = getPlan(user.planId);
    if (!plan) {
      return res.status(403).json({ error: "پلن نامعتبر" });
    }

    if (user.usageToday >= plan.dailyLimit) {
      return res.status(403).json({ error: "سقف استفاده روزانه تمام شده است" });
    }

    user.usageToday += 1;
    const db = readJSON("models/users.json");
    const idx = db.users.findIndex(u => u.id === user.id);
    db.users[idx] = user;
    writeJSON("models/users.json", db);

    addTransaction(userId, "content_usage", 0, { planId: plan.id });

    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// تولید متن با کنترل دسترسی
app.post("/generate-text", checkAccess, async (req, res) => {
  try {
    const { topic } = req.body;
    const result = await generateScript(topic);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تولید تصویر با کنترل دسترسی
app.post("/generate-image", checkAccess, async (req, res) => {
  try {
    const { prompt } = req.body;
    const url = await generateImage(prompt);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تولید ویدیو با کنترل دسترسی
app.post("/generate-video", checkAccess, async (req, res) => {
  try {
    const { script } = req.body;
    const url = await generateVideo(script);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// مونتاژ ویدیو با کنترل دسترسی
app.post("/compose-video", checkAccess, async (req, res) => {
  try {
    const { imageUrl, text, userId } = req.body;

    const imagePath = "temp_image_" + userId + ".jpg";
    const outputPath = "final_video_" + userId + ".mp4";

    const img = await axios.get(imageUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(imagePath, img.data);

    const result = await composeVideo(imagePath, text, outputPath);

    res.json({ video: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// گزارش سادهٔ وضعیت کاربر
app.post("/user/status", (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId لازم است" });

    const dbUsers = readJSON("models/users.json");
    const dbPlans = readJSON("models/plans.json");
    const dbTx = readJSON("models/transactions.json");

    const user = dbUsers.users.find(u => u.id === userId) || getOrCreateUser(userId);
    const plan = user.planId ? dbPlans.plans.find(p => p.id === user.planId) : null;
    const txs = dbTx.transactions.filter(t => t.userId === userId);

    res.json({ user, plan, transactions: txs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Suraya AI Content Engine with Revenue System running on port 3000");
});
`;

fs.writeFileSync("server.js", serverCode);

console.log("سیستم درآمدی، کیف‌پول، پلن‌ها و کنترل دسترسی اضافه شد.");
console.log("حالا فقط npm install و بعد node server.js را اجرا کن.");
