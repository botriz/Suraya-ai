const express = require('express');
const db = require('../database');
const { auth } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// لیست پلن‌ها
router.get('/', (req, res) => {
  const plans = db.prepare('SELECT * FROM plans').all();
  res.json(plans.map(p => ({
    ...p,
    limits: JSON.parse(p.limits)
  })));
});

// خرید پلن (فعال‌سازی فوری در حالت تست)
router.post('/subscribe', auth, (req, res) => {
  const { plan_code } = req.body;
  const plan = db.prepare('SELECT * FROM plans WHERE code = ?').get(plan_code);

  if (!plan) {
    return res.status(404).json({ error: 'پلن یافت نشد' });
  }

  if (plan.price > 0) {
    // در نسخه واقعی اینجا به درگاه زرین‌پال وصل می‌شود
    // فعلاً برای تست، مستقیم فعال می‌کنیم
  }

  const expire = Date.now() + (plan.duration_days * 24 * 60 * 60 * 1000);

  db.prepare(`
    UPDATE users SET plan = ?, plan_expire = ? WHERE id = ?
  `).run(plan_code, expire, req.user.id);

  // ثبت تراکنش
  db.prepare(`
    INSERT INTO transactions (id, user_id, amount, type, description, created_at)
    VALUES (?, ?, ?, 'subscribe', ?, ?)
  `).run(uuidv4(), req.user.id, plan.price, `خرید پلن ${plan.name}`, Date.now());

  res.json({
    message: `پلن ${plan.name} با موفقیت فعال شد`,
    plan: plan_code,
    expire
  });
});

module.exports = router;
