# ثریا | Suraya

سامانه خدمات عمومی هوش مصنوعی و زیرساخت مرحله‌ای جهان دیجیتال ثریا.

## وضعیت فعلی

این مخزن در حال حاضر یک **هسته خدمات عمومی عملیاتی با قابلیت ثبت سفارش در PostgreSQL** و یک **بنیاد فقط‌خواندنی برای API جهان دیجیتال** را فراهم می‌کند. وجود پوشه‌ها یا قراردادهای هوشمند به‌تنهایی به معنی فعال بودن آن قابلیت‌ها در محیط عملیاتی نیست.

### قابلیت‌های قابل استفاده در این نسخه

- صفحه عمومی خدمات فارسی در مسیر `/`.
- فهرست خدمات در `GET /api/services`.
- وضعیت سرویس در `GET /api/status`.
- سلامت فرایند در `GET /health`.
- آمادگی پایگاه داده و وضعیت جهان دیجیتال در `GET /ready`.
- ثبت درخواست خدمات در `POST /api/order`، فقط در صورت آماده بودن PostgreSQL.
- API بنیاد جهان دیجیتال در `/api/world/v1`؛ خواندنی و بدون فعال‌سازی اقدامات خودکار یا پرداخت واقعی.

## راه‌اندازی محلی

نیازمندی: Node.js 20 یا جدیدتر و npm.

```bash
npm install
cp .env.example .env
```

مقدار `DATABASE_URL` را در فایل `.env` با نشانی PostgreSQL خود جایگزین کنید. بدون پایگاه داده، صفحه عمومی اجرا می‌شود اما ثبت سفارش با پاسخ 503 غیرفعال می‌ماند.

اجرای توسعه با بارگذاری مجدد خودکار:

```bash
npm run dev
```

اجرای عادی:

```bash
npm start
```

اجرای بررسی‌ها و تست‌ها:

```bash
npm run check
```

## مسیرهای API

| روش | مسیر | کاربرد |
|---|---|---|
| GET | `/health` | زنده بودن فرایند |
| GET | `/ready` | آمادگی پایگاه داده و قابلیت جهان دیجیتال |
| GET | `/api/status` | وضعیت سرویس و ثبت سفارش |
| GET | `/api/services` | کاتالوگ خدمات |
| POST | `/api/order` | ثبت درخواست مشتری |
| GET | `/api/world/v1/status` | وضعیت بنیاد جهان دیجیتال |
| GET | `/api/world/v1/manifest` | مشخصات نسخه و قابلیت‌های فعال |
| GET | `/api/world/v1/events` | رویدادهای عمومی ثبت‌شده |

## استقرار Render

- Build command: `npm install`
- Start command: `npm start`
- متغیر ضروری: `DATABASE_URL` با ترجیح نشانی Internal Database URL در همان منطقه.
- `DATABASE_SSL=true` را فقط در صورت نیاز ارائه‌دهنده پایگاه داده تنظیم کنید.

پس از استقرار، مسیرهای `/health`، `/ready` و `/api/status` را بررسی کنید. برای آزمون ثبت سفارش، از یک درخواست آزمایشی استفاده کرده و وجود رکورد متناظر در جدول `suraya_orders` را تأیید کنید.

## مرزهای امنیتی و عملیاتی

- پرداخت واقعی تا زمان پیاده‌سازی تأیید سمت سرور و اعتبارسنجی امضای webhook فعال نیست.
- API جهان دیجیتال در مرحله بنیاد و فقط‌خواندنی است.
- کیف پول و کلیدهای خصوصی نباید در پاسخ API یا مخزن کد قرار گیرند.
- محدودکننده درخواست فعلی درون‌حافظه‌ای و مناسب یک نمونه سرور است؛ برای چند نمونه به محدودسازی توزیع‌شده نیاز است.
- ماژول‌های قدیمی در پوشه‌های دیگر تا زمان تبدیل به ماژول‌های سازگار با ESM، افزودن وابستگی‌های لازم و تست مستقل، بخشی از مسیر اجرایی اصلی محسوب نمی‌شوند.
- متغیرهای محرمانه را فقط در تنظیمات امن محیط میزبانی قرار دهید و هرگز در Git commit نکنید.

## اسناد

- [راهنمای استقرار](DEPLOYMENT.md)
- [مستندات API جهان دیجیتال](docs/digital-world-api-v1.md)
- [نقشه راه جهان دیجیتال](docs/digital-world-roadmap.md)
- [مالکیت پروژه](OWNERSHIP.md)


## Legacy setup scripts

The old `setup.js`, `suraya-master-setup.js`, and `setup-revenue.js` bootstrappers are disabled. They previously overwrote application files, generated placeholder credentials, or created simulated wallet/payment state. Do not run them. The active service is deployed from reviewed Git commits and uses PostgreSQL migrations.


## Revenue operations v1

- Public order intake is available at `POST /api/order`.
- Private operator endpoints are mounted at `/api/operator/v1` and require `Authorization: Bearer <SURAYA_OPERATOR_TOKEN>`.
- The operator desk is served at `/operator.html`; it supports listing/filtering orders, quoting, status transitions, internal notes, and delivery timestamps.
- Migration `002_revenue_operations.sql` adds quote fields and an immutable event history for operator changes.
- Configure a long random `SURAYA_OPERATOR_TOKEN` in the Render service environment before using the operator desk. The operator API intentionally fails closed when it is missing.
- This release does not charge customers, send invoices, deliver generated AI content, or activate subscriptions. Quotes and fulfilment remain manual until a payment provider and production AI provider are configured and tested.


## Creator content engine

- Creator UI: `/creator.html`.
- API: `POST /api/creator/v1/draft`.
- Configure `AI_API_KEY` in the hosting environment. Optional: `AI_BASE_URL` (OpenAI-compatible API base URL) and `AI_MODEL`.
- The engine validates topic, platform, tone, language and model output. It fails closed without a provider key and never publishes content automatically.
- Supported platform targets: Instagram, YouTube, Rubika, Telegram and LinkedIn. Supported languages: Persian, English, Arabic and Turkish.
- This code integration is not a claim that the provider is configured or that generation is live. Provider credentials and billing/quota must be configured separately.
