import express from "express";
import { timingSafeEqual } from "node:crypto";

const publicIdPattern = /^SUR-[A-F0-9]{10}$/;
const currencies = new Set(["IRR", "IRT"]);

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function createManualPaymentsRouter({ pool, getToken, rateLimit = (_req, _res, next) => next() }) {
  const router = express.Router();

  function authorize(req, res, next) {
    const expected = getToken();
    const supplied = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || "";
    if (!safeEqual(supplied, expected)) {
      return res.status(401).json({ ok: false, error: "دسترسی مدیر تأیید نشد." });
    }
    next();
  }

  router.get("/instructions", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      paymentMethod: "manual_bank_transfer",
      bank: {
        name: process.env.PAYMENT_BANK_NAME || "",
        accountHolder: process.env.PAYMENT_ACCOUNT_HOLDER || "",
        cardNumber: process.env.PAYMENT_CARD_NUMBER || "",
        iban: process.env.PAYMENT_IBAN || "",
        accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || ""
      },
      note: "فقط پس از مشاهده و تأیید واریز در حساب بانکی، پرداخت قطعی محسوب می‌شود."
    });
  });

  router.get("/orders/:publicId", rateLimit, async (req, res) => {
    if (!pool) return res.status(503).json({ ok: false, error: "سامانه سفارش در دسترس نیست." });
    const publicId = String(req.params.publicId || "").trim().toUpperCase();
    if (!publicIdPattern.test(publicId)) return res.status(400).json({ ok: false, error: "کد سفارش معتبر نیست." });
    try {
      const result = await pool.query(
        `SELECT public_id, customer_name, service_title, status, quoted_amount, quoted_currency, created_at
         FROM suraya_orders WHERE public_id = $1`,
        [publicId]
      );
      if (!result.rowCount) return res.status(404).json({ ok: false, error: "سفارش پیدا نشد." });
      const payment = await pool.query(
        `SELECT id, status, amount, currency, reference_code, paid_at, created_at
         FROM suraya_manual_payments WHERE public_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [publicId]
      );
      res.set("Cache-Control", "no-store");
      res.json({ ok: true, order: result.rows[0], latestPayment: payment.rows[0] || null });
    } catch (error) {
      console.error("Manual payment order lookup failed:", error.message);
      res.status(500).json({ ok: false, error: "دریافت وضعیت سفارش ناموفق بود." });
    }
  });

  router.post("/manual", rateLimit, async (req, res) => {
    if (!pool) return res.status(503).json({ ok: false, error: "سامانه سفارش در دسترس نیست." });
    const publicId = typeof req.body?.orderId === "string" ? req.body.orderId.trim().toUpperCase() : "";
    const payerName = typeof req.body?.payerName === "string" ? req.body.payerName.trim() : "";
    const referenceCode = typeof req.body?.referenceCode === "string" ? req.body.referenceCode.trim() : "";
    const amount = Number(req.body?.amount);
    const currency = typeof req.body?.currency === "string" ? req.body.currency.trim().toUpperCase() : "";
    const paidAt = typeof req.body?.paidAt === "string" ? req.body.paidAt : "";
    if (!publicIdPattern.test(publicId)) return res.status(400).json({ ok: false, error: "کد سفارش معتبر نیست." });
    if (payerName.length < 2 || payerName.length > 120) return res.status(400).json({ ok: false, error: "نام پرداخت‌کننده معتبر نیست." });
    if (referenceCode.length < 4 || referenceCode.length > 100) return res.status(400).json({ ok: false, error: "کد پیگیری واریز معتبر نیست." });
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000000) return res.status(400).json({ ok: false, error: "مبلغ پرداخت معتبر نیست." });
    if (!currencies.has(currency)) return res.status(400).json({ ok: false, error: "واحد پول باید ریال یا تومان باشد." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt) || Number.isNaN(Date.parse(paidAt))) return res.status(400).json({ ok: false, error: "تاریخ واریز معتبر نیست." });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const order = await client.query(
        `SELECT public_id, status, quoted_amount, quoted_currency
         FROM suraya_orders WHERE public_id = $1 FOR UPDATE`,
        [publicId]
      );
      if (!order.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ ok: false, error: "سفارش پیدا نشد." });
      }
      const current = order.rows[0];
      if (["cancelled", "delivered"].includes(current.status)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ ok: false, error: "برای این سفارش امکان ثبت پرداخت وجود ندارد." });
      }
      if (current.quoted_amount === null || current.quoted_amount === undefined) {
        await client.query("ROLLBACK");
        return res.status(409).json({ ok: false, error: "ابتدا باید مبلغ نهایی سفارش توسط مدیر اعلام شود." });
      }
      const expectedCurrency = String(current.quoted_currency || "").toUpperCase();
      const normalizedAmount = currency === "IRT" ? amount * 10 : amount;
      const expectedAmount = Number(current.quoted_amount);
      const expectedInRial = expectedCurrency === "IRT" ? expectedAmount * 10 : expectedAmount;
      if (!Number.isFinite(expectedInRial) || !["IRR", "IRT"].includes(expectedCurrency) ||
          Math.round(normalizedAmount) !== Math.round(expectedInRial)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ ok: false, error: "مبلغ یا واحد پول با فاکتور سفارش مطابقت ندارد." });
      }
      const existingPayment = await client.query(
        `SELECT id, status FROM suraya_manual_payments
         WHERE public_id = $1 AND status IN ('pending_review', 'confirmed')
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [publicId]
      );
      if (existingPayment.rowCount) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          ok: false,
          error: existingPayment.rows[0].status === "confirmed"
            ? "پرداخت این سفارش قبلاً تأیید شده است."
            : "یک پرداخت برای این سفارش در انتظار بررسی مدیر است."
        });
      }
      const inserted = await client.query(
        `INSERT INTO suraya_manual_payments
          (public_id, payer_name, amount, currency, reference_code, paid_at, status)
         VALUES ($1, $2, $3, $4, $5, $6::date, 'pending_review')
         RETURNING id, status, created_at`,
        [publicId, payerName, amount, currency, referenceCode, paidAt]
      );
      await client.query(
        `INSERT INTO suraya_order_events (public_id, event_type, details)
         VALUES ($1, 'payment.manual_submitted', $2::jsonb)`,
        [publicId, JSON.stringify({ paymentId: inserted.rows[0].id, amount, currency, referenceCode })]
      );
      await client.query("COMMIT");
      res.status(201).json({
        ok: true,
        payment: inserted.rows[0],
        message: "اطلاعات پرداخت ثبت شد و پس از بررسی گردش حساب توسط مدیر تأیید یا رد می‌شود."
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Manual payment submission failed:", error.message);
      res.status(500).json({ ok: false, error: "ثبت اطلاعات پرداخت ناموفق بود." });
    } finally {
      client.release();
    }
  });

  router.get("/admin/manual", authorize, async (_req, res) => {
    if (!pool) return res.status(503).json({ ok: false, error: "پایگاه داده در دسترس نیست." });
    try {
      const result = await pool.query(
        `SELECT p.id, p.public_id, o.customer_name, o.service_title, p.payer_name,
                p.amount, p.currency, p.reference_code, p.paid_at, p.status, p.created_at
         FROM suraya_manual_payments p
         JOIN suraya_orders o ON o.public_id = p.public_id
         ORDER BY p.created_at DESC LIMIT 100`
      );
      res.json({ ok: true, payments: result.rows });
    } catch (error) {
      console.error("Manual payment admin listing failed:", error.message);
      res.status(500).json({ ok: false, error: "دریافت پرداخت‌ها ناموفق بود." });
    }
  });

  router.patch("/admin/manual/:paymentId", authorize, async (req, res) => {
    if (!pool) return res.status(503).json({ ok: false, error: "پایگاه داده در دسترس نیست." });
    const paymentId = Number.parseInt(req.params.paymentId, 10);
    const action = req.body?.action;
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    if (!Number.isSafeInteger(paymentId) || paymentId < 1 || !["confirm", "reject"].includes(action)) {
      return res.status(400).json({ ok: false, error: "درخواست تأیید یا رد معتبر نیست." });
    }
    if (note.length > 1000) return res.status(400).json({ ok: false, error: "یادداشت بیش از حد طولانی است." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const payment = await client.query(
        "SELECT id, public_id, status FROM suraya_manual_payments WHERE id = $1 FOR UPDATE",
        [paymentId]
      );
      if (!payment.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ ok: false, error: "پرداخت پیدا نشد." });
      }
      if (payment.rows[0].status !== "pending_review") {
        await client.query("ROLLBACK");
        return res.status(409).json({ ok: false, error: "این پرداخت قبلاً بررسی شده است." });
      }
      const status = action === "confirm" ? "confirmed" : "rejected";
      await client.query(
        "UPDATE suraya_manual_payments SET status = $2, reviewed_at = NOW(), review_note = $3 WHERE id = $1",
        [paymentId, status, note]
      );
      if (action === "confirm") {
        await client.query(
          "UPDATE suraya_orders SET status = 'accepted', updated_at = NOW() WHERE public_id = $1 AND status NOT IN ('cancelled', 'delivered')",
          [payment.rows[0].public_id]
        );
      }
      await client.query(
        "INSERT INTO suraya_order_events (public_id, event_type, details) VALUES ($1, $2, $3::jsonb)",
        [payment.rows[0].public_id, `payment.manual_${status}`, JSON.stringify({ paymentId, note })]
      );
      await client.query("COMMIT");
      res.json({ ok: true, paymentId, status });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Manual payment review failed:", error.message);
      res.status(500).json({ ok: false, error: "بررسی پرداخت ناموفق بود." });
    } finally {
      client.release();
    }
  });

  return router;
}
