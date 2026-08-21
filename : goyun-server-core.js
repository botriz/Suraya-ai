// GoyunServer – بک‌اند هستهٔ مالی و هویت سورایا
// نصب لازم در سرور: node + npm
// پکیج‌ها: express, cors, body-parser, uuid, bcryptjs, jsonwebtoken

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// تنظیمات پایه
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'ANA_GOYUN_SECRET';

// حافظهٔ موقت (در نسخهٔ واقعی باید DB باشد)
const state = {
  owner: {
    id: 'OWNER-ANA',
    name: 'Ahmad',
    motherWallet: null,
    motherShare: 10,
    canChangeShare: true
  },
  users: [],       // {id,name,userId,phone,deviceId,location,kyc, wallets:{}, verified}
  incomes: [],     // {id,userId,amount,currency,raw,motherPart,userPart}
  globalFinance: { // اتصال به شبکهٔ مالی جهانی
    apiAna: null,
    apiPul: null,
    apiGlobal: null,
    keysGlobal: null
  }
};

// توکن مدیر
function signOwner() {
  return jwt.sign({ role: 'owner', id: state.owner.id }, JWT_SECRET, { expiresIn: '7d' });
}

// میدل‌ویر احراز هویت مدیر
function requireOwner(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'NO_AUTH' });
  const token = auth.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'owner') return res.status(403).json({ error: 'NOT_OWNER' });
    next();
  } catch (e) {
    return res.status(401).json({ error: 'BAD_TOKEN' });
  }
}

// میدل‌ویر احراز هویت کاربر
function requireUser(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'NO_AUTH' });
  const token = auth.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'user') return res.status(403).json({ error: 'NOT_USER' });
    req.userId = decoded.id;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'BAD_TOKEN' });
  }
}

// ورود مدیر (نمایشی)
app.get('/api/owner/login', (req, res) => {
  return res.json({ token: signOwner(), owner: state.owner });
});

// تنظیم حساب مادر و سهم سیستم (فقط مدیر)
app.post('/api/owner/mother-config', requireOwner, (req, res) => {
  const { motherWallet, motherShare } = req.body;
  if (!motherWallet || typeof motherShare !== 'number') {
    return res.status(400).json({ error: 'BAD_INPUT' });
  }
  state.owner.motherWallet = motherWallet;
  if (state.owner.canChangeShare) {
    state.owner.motherShare = motherShare;
  }
  return res.json({ ok: true, owner: state.owner });
});

// تنظیم اتصال مالی جهانی (فقط مدیر)
app.post('/api/owner/global-finance', requireOwner, (req, res) => {
  const { apiAna, apiPul, apiGlobal, keysGlobal } = req.body;
  if (!apiAna || !apiPul || !apiGlobal || !keysGlobal) {
    return res.status(400).json({ error: 'BAD_INPUT' });
  }
  state.globalFinance.apiAna = apiAna;
  state.globalFinance.apiPul = apiPul;
  state.globalFinance.apiGlobal = apiGlobal;
  state.globalFinance.keysGlobal = keysGlobal;
  return res.json({ ok: true, globalFinance: state.globalFinance });
});

// ثبت کاربر + اتصال به دستگاه
app.post('/api/user/register', async (req, res) => {
  const { name, userId, phone, deviceId, location, kyc } = req.body;
  if (!name || !userId || !phone || !deviceId || !location || !kyc) {
    return res.status(400).json({ error: 'BAD_INPUT' });
  }

  // هر دستگاه فقط یک حساب
  const existingDevice = state.users.find(u => u.deviceId === deviceId);
  if (existingDevice) {
    return res.status(409).json({ error: 'DEVICE_ALREADY_REGISTERED' });
  }

  const id = uuidv4();
  const user = {
    id,
    name,
    userId,
    phone,
    deviceId,
    location,
    kyc,
    wallets: {},   // بعداً پر می‌شود
    verified: false
  };
  state.users.push(user);

  const token = jwt.sign({ role: 'user', id }, JWT_SECRET, { expiresIn: '30d' });
  return res.json({ ok: true, user, token });
});

// تنظیم کیف‌پول چندارزی کاربر
app.post('/api/user/wallets', requireUser, (req, res) => {
  const { currencies } = req.body; // {ANA:"addr",BTC:"addr",...}
  if (!currencies || typeof currencies !== 'object') {
    return res.status(400).json({ error: 'BAD_INPUT' });
  }
  const user = state.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  user.wallets = currencies;
  return res.json({ ok: true, wallets: user.wallets });
});

// ثبت درآمد خام کاربر و محاسبهٔ سهم‌ها
app.post('/api/finance/income', requireUser, (req, res) => {
  const { amount, currency, source } = req.body;
  if (typeof amount !== 'number' || !currency) {
    return res.status(400).json({ error: 'BAD_INPUT' });
  }
  const user = state.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  const share = state.owner.motherShare || 10;
  const motherPart = amount * (share / 100);
  const userPart = amount - motherPart;

  const income = {
    id: uuidv4(),
    userId: user.id,
    amount,
    currency,
    source: source || 'unknown',
    raw: amount,
    motherPart,
    userPart,
    ts: Date.now()
  };
  state.incomes.push(income);

  // اینجا در نسخهٔ واقعی:
  // - انتقال motherPart به کیف‌پول مادر (state.owner.motherWallet)
  // - انتقال userPart به کیف‌پول کاربر (user.wallets[currency])
  // از طریق API شبکهٔ مالی داخلی/جهانی انجام می‌شود.

  return res.json({ ok: true, income });
});

// درخواست برداشت کاربر
app.post('/api/finance/withdraw', requireUser, (req, res) => {
  const { currency, amount, target } = req.body;
  if (!currency || typeof amount !== 'number' || !target) {
    return res.status(400).json({ error: 'BAD_INPUT' });
  }
  const user = state.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  // اینجا باید موجودی واقعی کاربر چک شود (در نسخهٔ واقعی)
  // فعلاً نمایشی:
  return res.json({
    ok: true,
    info: 'WITHDRAW_REQUEST_ACCEPTED',
    currency,
    amount,
    to: target
  });
});

// وضعیت سادهٔ سیستم برای تست
app.get('/api/status', (req, res) => {
  return res.json({
    owner: state.owner,
    usersCount: state.users.length,
    incomesCount: state.incomes.length,
    globalFinance: state.globalFinance
  });
});

app.listen(PORT, () => {
  console.log('GoyunServer running on port', PORT);
});
