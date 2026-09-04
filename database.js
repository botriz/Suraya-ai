const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'ata.db'));

// ایجاد جداول
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    plan TEXT DEFAULT 'free',
    plan_expire INTEGER,
    wallet INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS usage_limits (
    user_id TEXT,
    service TEXT,
    used INTEGER DEFAULT 0,
    reset_at INTEGER,
    PRIMARY KEY (user_id, service)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    amount INTEGER,
    type TEXT,
    description TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS plans (
    code TEXT PRIMARY KEY,
    name TEXT,
    price INTEGER,
    duration_days INTEGER,
    limits TEXT
  );
`);

// پلن‌های پیش‌فرض
const insertPlan = db.prepare(`
  INSERT OR REPLACE INTO plans (code, name, price, duration_days, limits)
  VALUES (?, ?, ?, ?, ?)
`);

insertPlan.run('free', 'رایگان', 0, 30, JSON.stringify({
  chat: 20,
  content: 5,
  code: 3,
  article: 2
}));

insertPlan.run('pro', 'حرفه‌ای', 199000, 30, JSON.stringify({
  chat: 9999,
  content: 200,
  code: 100,
  article: 50
}));

insertPlan.run('org', 'سازمانی', 499000, 30, JSON.stringify({
  chat: 99999,
  content: 9999,
  code: 9999,
  article: 9999
}));

// ساخت ادمین پیش‌فرض
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(process.env.ADMIN_EMAIL || 'admin@ata.ai');
if (!adminExists) {
  const id = require('uuid').v4();
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'AtaAdmin1403!', 10);
  db.prepare(`
    INSERT INTO users (id, email, password, name, plan, is_admin, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(id, process.env.ADMIN_EMAIL || 'admin@ata.ai', hash, 'مدیر آتا', 'org', Date.now());
}

module.exports = db;
