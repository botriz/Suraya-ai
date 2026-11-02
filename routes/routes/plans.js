const express = require('express');
const db = require('../database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// فهرست پلن‌ها؛ نمایش پلن به معنی امکان خرید یا فعال‌سازی نیست.
router.get('/', (req, res) => {
  const plans = db.prepare('SELECT * FROM plans').all();
  res.json(plans.map(p => ({
    ...p,
    limits: JSON.parse(p.limits)
  })));
});

// فعال‌سازی پولی بدون تراکنش تأییدشده ممنوع است.
router.post('/subscribe', auth, (_req, res) => {
  return res.status(503).json({
    error: 'خرید و فعال‌سازی اشتراک تا زمان اتصال درگاه واقعی و تأیید سمت سرور غیرفعال است.'
  });
});

module.exports = router;
