const express = require('express');
const db = require('../database');
const { auth } = require('../middleware/auth');

const router = express.Router();

function checkLimit(userId, service) {
  const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(userId);
  const plan = db.prepare('SELECT limits FROM plans WHERE code = ?').get(user.plan);
  const limits = JSON.parse(plan.limits);
  const max = limits[service] || 0;

  let usage = db.prepare('SELECT * FROM usage_limits WHERE user_id = ? AND service = ?').get(userId, service);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  if (!usage || now > usage.reset_at) {
    db.prepare(`
      INSERT OR REPLACE INTO usage_limits (user_id, service, used, reset_at)
      VALUES (?, ?, 0, ?)
    `).run(userId, service, now + day);
    usage = { used: 0 };
  }

  if (usage.used >= max) {
    return { allowed: false, used: usage.used, max };
  }

  db.prepare('UPDATE usage_limits SET used = used + 1 WHERE user_id = ? AND service = ?')
    .run(userId, service);

  return { allowed: true, used: usage.used + 1, max };
}

// استفاده از خدمت
router.post('/use', auth, (req, res) => {
  const { service, prompt } = req.body;

  if (!service) {
    return res.status(400).json({ error: 'نام خدمت الزامی است' });
  }

  const result = checkLimit(req.user.id, service);

  if (!result.allowed) {
    return res.status(403).json({
      error: 'سقف استفاده از این خدمت تمام شده است',
      used: result.used,
      max: result.max,
      message: 'برای ادامه، پلن خود را ارتقا دهید'
    });
  }

  // اینجا در آینده به مدل هوش مصنوعی واقعی وصل می‌شود
  res.json({
    message: 'درخواست پذیرفته شد',
    service,
    used: result.used,
    max: result.max,
    response: `پاسخ آزمایشی برای: ${prompt || service}\n\n(در نسخه بعدی به مدل واقعی متصل می‌شود)`
  });
});

// وضعیت محدودیت‌ها
router.get('/limits', auth, (req, res) => {
  const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(req.user.id);
  const plan = db.prepare('SELECT limits FROM plans WHERE code = ?').get(user.plan);
  const limits = JSON.parse(plan.limits);

  const usages = db.prepare('SELECT service, used, reset_at FROM usage_limits WHERE user_id = ?').all(req.user.id);

  res.json({ plan: user.plan, limits, usages });
});

module.exports = router;
