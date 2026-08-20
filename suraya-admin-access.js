// فایل: suraya-admin-access.js
// فقط این فایل را بساز، کپی کن، بعد: node suraya-admin-access.js

import fs from "fs";

const ADMIN_ID = "Admin.ahmad";

fs.mkdirSync("models", { recursive: true });

const securityPath = "models/security.json";
const baseSecurity = {
  adminId: ADMIN_ID,
  roles: {
    admin: {
      id: "admin",
      name: "مدیر کل",
      permissions: [
        "manage_plans",
        "manage_users",
        "manage_wallet",
        "manage_subscriptions",
        "manage_content",
        "manage_social",
        "view_transactions",
        "view_security",
        "override_limits",
        "lock_user",
        "unlock_user",
        "set_rate_limits",
        "set_plan_limits"
      ]
    },
    user: {
      id: "user",
      name: "کاربر عادی",
      permissions: [
        "use_content_with_plan",
        "use_social_with_plan",
        "view_own_status",
        "charge_wallet",
        "buy_plan"
      ]
    }
  },
  rateLimits: {
    contentPerMinute: 10,
    socialPerMinute: 5
  },
  locks: {
    users: []
  }
};

fs.writeFileSync(securityPath, JSON.stringify(baseSecurity, null, 2));

const serverEnhance = `
import fs from "fs";

const securityPath = "models/security.json";

function readSecurity() {
  return JSON.parse(fs.readFileSync(securityPath, "utf8"));
}

function writeSecurity(data) {
  fs.writeFileSync(securityPath, JSON.stringify(data, null, 2));
}

function isAdmin(userId) {
  const sec = readSecurity();
  return userId === sec.adminId;
}

function getRole(userId) {
  const sec = readSecurity();
  if (userId === sec.adminId) return sec.roles.admin;
  return sec.roles.user;
}

function hasPermission(userId, perm) {
  const role = getRole(userId);
  return role.permissions.includes(perm);
}

function isLocked(userId) {
  const sec = readSecurity();
  return sec.locks.users.includes(userId);
}

export function guardAdmin(req, res, next) {
  const { userId } = req.body;
  if (!userId || !isAdmin(userId)) {
    return res.status(403).json({ error: "دسترسی مدیر لازم است" });
  }
  next();
}

export function guardPermission(perm) {
  return (req, res, next) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId لازم است" });
    if (isLocked(userId)) return res.status(403).json({ error: "حساب کاربری قفل شده است" });
    if (!hasPermission(userId, perm)) {
      return res.status(403).json({ error: "اجازهٔ انجام این عملیات را ندارید" });
    }
    next();
  };
}

export function adminLockUser(req, res) {
  const { userId, targetId } = req.body;
  if (!userId || !targetId) return res.status(400).json({ error: "پارامتر نامعتبر" });
  if (!isAdmin(userId)) return res.status(403).json({ error: "فقط مدیر می‌تواند کاربر را قفل کند" });
  const sec = readSecurity();
  if (!sec.locks.users.includes(targetId)) sec.locks.users.push(targetId);
  writeSecurity(sec);
  return res.json({ ok: true, locked: targetId });
}

export function adminUnlockUser(req, res) {
  const { userId, targetId } = req.body;
  if (!userId || !targetId) return res.status(400).json({ error: "پارامتر نامعتبر" });
  if (!isAdmin(userId)) return res.status(403).json({ error: "فقط مدیر می‌تواند کاربر را آزاد کند" });
  const sec = readSecurity();
  sec.locks.users = sec.locks.users.filter(u => u !== targetId);
  writeSecurity(sec);
  return res.json({ ok: true, unlocked: targetId });
}

export function adminSetRateLimits(req, res) {
  const { userId, contentPerMinute, socialPerMinute } = req.body;
  if (!userId) return res.status(400).json({ error: "userId لازم است" });
  if (!isAdmin(userId)) return res.status(403).json({ error: "فقط مدیر می‌تواند Rate Limit را تنظیم کند" });
  const sec = readSecurity();
  if (contentPerMinute) sec.rateLimits.contentPerMinute = contentPerMinute;
  if (socialPerMinute) sec.rateLimits.socialPerMinute = socialPerMinute;
  writeSecurity(sec);
  return res.json({ ok: true, rateLimits: sec.rateLimits });
}
`;

fs.writeFileSync("security-admin.js", serverEnhance);

console.log("سیستم دسترسی مدیر با شناسه Admin.ahmad ساخته شد. security.json و security-admin.js آماده استفاده در سرور هستند.");
