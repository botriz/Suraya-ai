# عامل توسعه خودمختار ثریا

## محدوده و مجوزها

- حالت اجرا: `autonomous`؛ وظایف ثبت‌شده را بدون تأیید مرحله‌به‌مرحله تحلیل و پیگیری می‌کند.
- محدوده Git: فقط مخزن `botriz/Suraya-ai` و شاخه پایه `feat/botriz-autonomous-creator-studio`.
- خروجی تغییر کد: شاخه مستقل با پیشوند `suraya-agent/task-` و Pull Request از نوع Draft.
- عامل مجاز به Merge، Deploy، انتشار محتوا، پرداخت، تغییر اسرار یا دسترسی به شاخه اصلی نیست.
- مسیرهای امنیتی عامل، مسیرهای احراز هویت اپراتور، فایل‌های migration، package.json و workflowهای CI در allowlist نوشتن عامل قرار ندارند.

## API

تمام مسیرها به `Authorization: Bearer <SURAYA_OPERATOR_TOKEN>` نیاز دارند:

- `GET /api/agent/v1/status` — وضعیت پیکربندی و مرزهای مجوز.
- `POST /api/agent/v1/tasks` با بدنه `{"goal":"..." }` — ثبت وظیفه.
- `GET /api/agent/v1/tasks/:id` — وضعیت، گزارش، فایل‌های تغییرکرده، PR و نتیجه CI.

وضعیت‌ها: `queued`, `running`, `awaiting_ci`, `needs_review`, `failed`, `cancelled`.

## راه‌اندازی امن

۱. در Render برای سرویس وب، متغیرهای `AI_API_KEY`، `AI_BASE_URL` و `AI_MODEL` را از ارائه‌دهنده مورد اعتماد تنظیم کنید.
۲. یک GitHub fine-grained token فقط برای مخزن `botriz/Suraya-ai` بسازید. حداقل دسترسی لازم: Contents (Read and write)، Pull requests (Read and write)، Checks (Read). از توکن سازمانی یا دسترسی همه مخازن استفاده نکنید.
۳. در تنظیمات محافظت‌شده Render این مقادیر را قرار دهید:
   - `SURAYA_AGENT_ENABLED=true`
   - `SURAYA_AGENT_REPOSITORY=botriz/Suraya-ai`
   - `SURAYA_AGENT_BASE_BRANCH=feat/botriz-autonomous-creator-studio`
   - `SURAYA_AGENT_GITHUB_TOKEN=<secret>`
۴. مطمئن شوید `SURAYA_OPERATOR_TOKEN` امن و فعال است؛ API عامل فقط با همین توکن محافظت می‌شود.
۵. ابتدا روی Preview با پایگاه داده جداگانه آزمایش کنید. سرویس Preview نباید به پایگاه داده تولید متصل باشد.

تا زمانی که متغیرها در محیط میزبانی تنظیم نشده و نسخه جدید با تأیید مالک مستقر نشده باشد، عامل غیرفعال می‌ماند. این تغییرات به‌تنهایی هیچ استقرار یا تغییر محیطی انجام نمی‌دهند.

## چرخه اجرا و آزمون

- worker وظایف را از PostgreSQL با `FOR UPDATE SKIP LOCKED` دریافت می‌کند.
- عامل فقط مجموعه محدودی از فایل‌های کد/تست/مستندات را می‌خواند و برای تغییر، allowlist مسیر و سقف اندازه را اعمال می‌کند.
- هر تغییر در شاخه مستقل commit و به شکل Draft PR باز می‌شود.
- workflow اختصاصی `Suraya Agent CI` دستور `npm run check` را اجرا می‌کند.
- نتیجه CI در گزارش وظیفه ثبت می‌شود؛ موفقیت CI فقط به معنی آماده بودن برای بازبینی است، نه اجازه Merge.
- مالک پروژه باید تغییرات و CI را بررسی کند و جداگانه درباره Merge و Deploy تصمیم بگیرد.

## محدودیت فعلی

اجرای worker نیازمند پیکربندی رازها و اجرای نسخه جدید در محیط میزبانی است. در این مرحله کد و API در شاخه توسعه قرار می‌گیرند؛ اتصال زنده GitHub از داخل سرویس تا زمان افزودن توکن امن و Deploy تأییدشده فعال نخواهد شد.
