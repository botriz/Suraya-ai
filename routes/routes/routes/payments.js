const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();

// پرداخت تا زمان اتصال درگاه واقعی و پیاده‌سازی اعتبارسنجی سمت سرور غیرفعال است.
router.post('/create', auth, (_req, res) => {
  return res.status(503).json({
    error: 'پرداخت آنلاین هنوز راه‌اندازی نشده است؛ هیچ لینک پرداخت آزمایشی معتبر نیست.'
  });
});

// فعال‌سازی پلن فقط پس از تأیید معتبر تراکنش توسط درگاه مجاز امکان‌پذیر است.
router.post('/verify', auth, (_req, res) => {
  return res.status(503).json({
    error: 'تأیید پرداخت تا زمان اتصال درگاه واقعی و اعتبارسنجی امضای callback غیرفعال است.'
  });
});

module.exports = router;
