const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = express.Router();

// ثبت‌نام
router.post('/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'ایمیل و رمز عبور الزامی است' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) {
    return res.status(400).json({ error: 'این ایمیل قبلاً ثبت شده' });
  }

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  const now = Date.now();

  db.prepare(`
    INSERT INTO users (id, email, password, name, plan, created_at)
    VALUES (?, ?, ?, ?, 'free', ?)
  `).run(id, email, hash, name || '', now);

  const token = jwt.sign(
    { id, email, is_admin: 0, plan: 'free' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    message: 'ثبت‌نام موفق',
    token,
    user: { id, email, name, plan: 'free' }
  });
});

// ورود
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'ایمیل یا رمز عبور اشتباه است' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, is_admin: user.is_admin, plan: user.plan },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    message: 'ورود موفق',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      wallet: user.wallet,
      is_admin: user.is_admin
    }
  });
});

// اطلاعات کاربر جاری
router.get('/me', require('../middleware/auth').auth, (req, res) => {
  const user = db.prepare('SELECT id, email, name, plan, wallet, is_admin, plan_expire FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

module.exports = router;
