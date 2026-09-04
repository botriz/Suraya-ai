const express = require('express');
const db = require('../database');
const { auth } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// ایجاد درخواست پرداخت (آماده برای زرین‌پال)
router.post('/create', auth, (req, res) => {
  const { plan_code } = req.body;
  const plan = db.prepare('SELECT * FROM plans WHERE code = ?').get(plan_code);

  if (!plan || plan.price === 0) {
    return res.status(400).json({ error: 'پلن نامعتبر است' });
  }

  const paymentId = uuidv4();

  // در نسخه واقعی اینجا درخواست به زرین‌پال ارسال می‌شود
  // فعلاً برای تست، لینک فرضی برمی‌گردانیم

  res.json({
    message: 'درخواست پرداخت ایجاد شد',
    payment_id: paymentId,
    amount: plan.price,
    plan: plan.name,
    // در حالت واقعی: pay_url از زرین‌پال
    pay_url: `https://www.zarinpal.com/pg/StartPay/TEST-${paymentId}`,
    note: 'این لینک تست است. بعد از اتصال کلید واقعی زرین‌پال فعال می‌شود'
  });
});

// تأیید پرداخت (webhook یا بازگشت از درگاه)
router.post('/verify', auth, (req, res) => {
  const { payment_id, plan_code } = req.body;

  const plan = db.prepare('SELECT * FROM plans WHERE code = ?').get(plan_code);
  if (!plan) {
    return res.status(404).json({ error: 'پلن یافت نشد' });
  }

  const expire = Date.now() + (plan.duration_days * 24 * 60 * 60 * 1000);

  db.prepare(`UPDATE users SET plan = ?, plan_expire = ? WHERE id = ?`)
    .run(plan_code, expire, req.user.id);

  db.prepare(`
    INSERT INTO transactions (id, user_id, amount, type, description, created_at)
    VALUES (?, ?, ?, 'payment', ?, ?)
  `).run(uuidv4(), req.user.id, plan.price, `پرداخت پلن ${plan.name}`, Date.now());

  res.json({
    message: 'پرداخت با موفقیت تأیید و پلن فعال شد',
    plan: plan_code,
    expire
  });
});

module.exports = router;
