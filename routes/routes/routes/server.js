require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

const authRoutes = require('./routes/auth');
const planRoutes = require('./routes/plans');
const serviceRoutes = require('./routes/services');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// مسیرها
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/payments', paymentRoutes);

// وضعیت سرور
app.get('/api/status', (req, res) => {
  res.json({
    status: 'فعال',
    name: 'آتا ای‌آی',
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

// صفحه اصلی
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║         آتا ای‌آی  |  Ata AI          ║
║     سرور با موفقیت راه‌اندازی شد      ║
║     http://localhost:${PORT}            ║
╚════════════════════════════════════════╝
  `);
});
