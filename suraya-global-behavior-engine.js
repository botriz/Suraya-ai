// فایل: suraya-behavior-engine.js
// فقط این فایل را بساز، کپی کن، بعد: node suraya-behavior-engine.js

import fs from "fs";

fs.mkdirSync("models", { recursive: true });
fs.mkdirSync("config", { recursive: true });

// تنظیمات چندزبانه و جهانی
fs.writeFileSync(
  "config/i18n.json",
  JSON.stringify(
    {
      defaultLanguage: "en",
      supportedLanguages: ["en", "fa", "ar", "fr", "de", "es", "ru", "tr", "zh", "hi"],
      uiTexts: {
        en: {
          appName: "Suraya AI",
          dashboardTitle: "Global Behavior & Growth Engine",
          planBasic: "Basic Plan",
          planPro: "Pro Plan",
          planUltra: "Ultra Plan"
        },
        fa: {
          appName: "ثریا هوش",
          dashboardTitle: "موتور رفتار و رشد جهانی",
          planBasic: "پلن پایه",
          planPro: "پلن حرفه‌ای",
          planUltra: "پلن فوق‌حرفه‌ای"
        },
        ar: {
          appName: "سوريا للذكاء الاصطناعي",
          dashboardTitle: "محرك السلوك والنمو العالمي",
          planBasic: "الخطة الأساسية",
          planPro: "الخطة الاحترافية",
          planUltra: "الخطة الفائقة"
        },
        fr: {
          appName: "Suraya IA",
          dashboardTitle: "Moteur global de comportement et de croissance",
          planBasic: "Forfait Basique",
          planPro: "Forfait Pro",
          planUltra: "Forfait Ultra"
        },
        de: {
          appName: "Suraya KI",
          dashboardTitle: "Globales Verhaltens- und Wachstumsmodul",
          planBasic: "Basis-Paket",
          planPro: "Pro-Paket",
          planUltra: "Ultra-Paket"
        },
        es: {
          appName: "Suraya IA",
          dashboardTitle: "Motor global de comportamiento y crecimiento",
          planBasic: "Plan Básico",
          planPro: "Plan Pro",
          planUltra: "Plan Ultra"
        },
        ru: {
          appName: "Suraya ИИ",
          dashboardTitle: "Глобальный модуль поведения и роста",
          planBasic: "Базовый план",
          planPro: "Профессиональный план",
          planUltra: "Ультра план"
        },
        tr: {
          appName: "Suraya Yapay Zeka",
          dashboardTitle: "Küresel Davranış ve Büyüme Motoru",
          planBasic: "Temel Paket",
          planPro: "Pro Paket",
          planUltra: "Ultra Paket"
        },
        zh: {
          appName: "Suraya 智能",
          dashboardTitle: "全球行为与增长引擎",
          planBasic: "基础套餐",
          planPro: "专业套餐",
          planUltra: "旗舰套餐"
        },
        hi: {
          appName: "Suraya एआई",
          dashboardTitle: "वैश्विक व्यवहार और वृद्धि इंजन",
          planBasic: "बेसिक प्लान",
          planPro: "प्रो प्लान",
          planUltra: "अल्ट्रा प्लान"
        }
      }
    },
    null,
    2
  )
);

// مدل رفتار کاربران جهانی
fs.writeFileSync(
  "models/behavior.json",
  JSON.stringify(
    {
      users: [],
      events: [],
      profiles: [],
      growthHints: []
    },
    null,
    2
  )
);

// ماژول رفتار و رشد جهانی برای استفاده در سرور
fs.writeFileSync(
  "behavior-engine.js",
  `
import fs from "fs";

const behaviorPath = "models/behavior.json";
const i18nPath = "config/i18n.json";

function readBehavior() {
  return JSON.parse(fs.readFileSync(behaviorPath, "utf8"));
}
function writeBehavior(data) {
  fs.writeFileSync(behaviorPath, JSON.stringify(data, null, 2));
}
function readI18n() {
  return JSON.parse(fs.readFileSync(i18nPath, "utf8"));
}

export function trackEvent(userId, locale, platform, type, meta = {}) {
  const db = readBehavior();
  const ev = {
    id: "ev_" + Date.now(),
    userId,
    locale: locale || "en",
    platform, // instagram, youtube, tiktok, telegram, pinterest, etc.
    type, // view, click, publish, like, comment, share, subscribe, etc.
    meta,
    at: new Date().toISOString()
  };
  db.events.push(ev);
  writeBehavior(db);
  return ev;
}

export function updateProfile(userId, locale, platforms, interests) {
  const db = readBehavior();
  let profile = db.profiles.find(p => p.userId === userId);
  if (!profile) {
    profile = {
      userId,
      locale: locale || "en",
      platforms: platforms || [],
      interests: interests || [],
      activityScore: 0,
      revenueScore: 0,
      growthScore: 0
    };
    db.profiles.push(profile);
  } else {
    profile.locale = locale || profile.locale;
    profile.platforms = platforms || profile.platforms;
    profile.interests = interests || profile.interests;
  }
  writeBehavior(db);
  return profile;
}

export function analyzeUserBehavior(userId) {
  const db = readBehavior();
  const events = db.events.filter(e => e.userId === userId);
  const profile = db.profiles.find(p => p.userId === userId) || {
    userId,
    locale: "en",
    platforms: [],
    interests: [],
    activityScore: 0,
    revenueScore: 0,
    growthScore: 0
  };

  let activityScore = 0;
  let revenueScore = 0;
  let growthScore = 0;

  events.forEach(e => {
    if (["view", "click", "like", "comment", "share"].includes(e.type)) {
      activityScore += 1;
    }
    if (["subscribe", "purchase", "plan_upgrade"].includes(e.type)) {
      revenueScore += 5;
    }
    if (["publish", "auto_publish", "campaign"].includes(e.type)) {
      growthScore += 3;
    }
  });

  profile.activityScore = activityScore;
  profile.revenueScore = revenueScore;
  profile.growthScore = growthScore;

  const db2 = readBehavior();
  db2.profiles = db2.profiles.filter(p => p.userId !== userId);
  db2.profiles.push(profile);
  writeBehavior(db2);

  return { profile, eventsCount: events.length };
}

export function suggestGrowthStrategy(userId) {
  const { profile } = analyzeUserBehavior(userId);
  const i18n = readI18n();
  const lang = i18n.uiTexts[profile.locale] ? profile.locale : i18n.defaultLanguage;
  const texts = i18n.uiTexts[lang];

  const hints = [];

  if (profile.activityScore < 10) {
    hints.push({
      code: "low_activity",
      message: "Increase posting frequency and engage more with your audience."
    });
  } else {
    hints.push({
      code: "good_activity",
      message: "Your activity is good. Focus on optimizing content quality."
    });
  }

  if (profile.revenueScore < 5) {
    hints.push({
      code: "low_revenue",
      message: "Consider promoting high-value content and using paid campaigns."
    });
  } else {
    hints.push({
      code: "good_revenue",
      message: "Revenue potential is good. Try advanced monetization strategies."
    });
  }

  if (profile.growthScore < 8) {
    hints.push({
      code: "low_growth",
      message: "Use auto-publishing across multiple platforms to boost growth."
    });
  } else {
    hints.push({
      code: "good_growth",
      message: "Growth is strong. Maintain consistency and test new formats."
    });
  }

  const db = readBehavior();
  db.growthHints = db.growthHints.filter(h => h.userId !== userId);
  db.growthHints.push({
    userId,
    locale: lang,
    appName: texts.appName,
    dashboardTitle: texts.dashboardTitle,
    hints,
    updatedAt: new Date().toISOString()
  });
  writeBehavior(db);

  return { locale: lang, appName: texts.appName, dashboardTitle: texts.dashboardTitle, hints };
}

export function globalBehaviorStatus() {
  const db = readBehavior();
  return {
    usersTracked: db.profiles.length,
    eventsTracked: db.events.length,
    hintsGenerated: db.growthHints.length
  };
}
`
);

// نمونهٔ ادغام در سرور جهانی (برای استفاده در هر برنامه معروف در جهان)
fs.writeFileSync(
  "server-behavior-hooks.js",
  `
import { trackEvent, updateProfile, suggestGrowthStrategy, globalBehaviorStatus } from "./behavior-engine.js";

// این توابع را می‌توان در هر سرور Node/Express در هر جای دنیا، برای هر برنامهٔ معروف، استفاده کرد:

export async function onUserAction(userId, locale, platform, type, meta) {
  return trackEvent(userId, locale, platform, type, meta);
}

export async function onUserProfileUpdate(userId, locale, platforms, interests) {
  return updateProfile(userId, locale, platforms, interests);
}

export async function onRequestGrowthHints(userId) {
  return suggestGrowthStrategy(userId);
}

export async function onGlobalBehaviorOverview() {
  return globalBehaviorStatus();
}
`
);

console.log("ماژول هوش رفتاری جهانی، چندزبانه و قابل استفاده در برنامه‌های مختلف ساخته شد.");
