import express from "express";

const allowedStatuses = new Set(["pending", "quoted", "accepted", "in_progress", "delivered", "cancelled"]);

export function createOperatorRouter({ pool, getToken }) {
  const router = express.Router();

  function authorize(req, res, next) {
    const expected = getToken();
    const supplied = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || "";
    if (!expected || supplied.length !== expected.length ||
        !Buffer.from(supplied).equals(Buffer.from(expected))) {
      return res.status(401).json({ ok: false, error: "دسترسی مدیر تأیید نشد." });
    }
    next();
  }

  router.use(authorize);

  router.get("/orders", async (req, res) => {
    if (!pool) return res.status(503).json({ ok: false, error: "پایگاه داده در دسترس نیست." });
    const status = typeof req.query.status === "string" && allowedStatuses.has(req.query.status) ? req.query.status : null;
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    try {
      const result = await pool.query(
        `SELECT public_id, customer_name, customer_email, service_code, service_title,
                details, status, quoted_amount, quoted_currency, operator_note,
                created_at, updated_at, delivered_at
         FROM suraya_orders
         WHERE ($1::text IS NULL OR status = $1)
         ORDER BY created_at DESC
         LIMIT $2`,
        [status, limit]
      );
      res.json({ ok: true, orders: result.rows });
    } catch (error) {
      console.error("Operator order listing failed:", error.message);
      res.status(500).json({ ok: false, error: "دریافت سفارش‌ها ناموفق بود." });
    }
  });

  router.patch("/orders/:publicId", async (req, res) => {
    if (!pool) return res.status(503).json({ ok: false, error: "پایگاه داده در دسترس نیست." });
    const publicId = String(req.params.publicId || "").trim();
    const status = req.body?.status;
    const note = typeof req.body?.operatorNote === "string" ? req.body.operatorNote.trim() : null;
    const amount = req.body?.quotedAmount === null || req.body?.quotedAmount === undefined || req.body?.quotedAmount === ""
      ? null : Number(req.body.quotedAmount);
    const currency = typeof req.body?.quotedCurrency === "string" ? req.body.quotedCurrency.trim().toUpperCase() : null;
    if (!/^SUR-[A-F0-9]{10}$/.test(publicId)) return res.status(400).json({ ok: false, error: "کد سفارش معتبر نیست." });
    if (!allowedStatuses.has(status)) return res.status(400).json({ ok: false, error: "وضعیت سفارش معتبر نیست." });
    if (note !== null && note.length > 2000) return res.status(400).json({ ok: false, error: "یادداشت بیش از حد طولانی است." });
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000)) return res.status(400).json({ ok: false, error: "مبلغ پیشنهادی معتبر نیست." });
    if (amount !== null && !currency) return res.status(400).json({ ok: false, error: "برای ثبت مبلغ، واحد پول را صریح انتخاب کنید." });
    if (currency && !["USD", "IRR", "IRT", "EUR"].includes(currency)) return res.status(400).json({ ok: false, error: "واحد پول پشتیبانی نمی‌شود." });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(
        `UPDATE suraya_orders
         SET status = $2,
             operator_note = COALESCE($3, operator_note),
             quoted_amount = COALESCE($4, quoted_amount),
             quoted_currency = CASE WHEN $4::numeric IS NULL THEN quoted_currency ELSE $5 END,
             updated_at = NOW(),
             delivered_at = CASE WHEN $2 = 'delivered' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END
         WHERE public_id = $1
         RETURNING public_id, status, quoted_amount, quoted_currency, operator_note, updated_at, delivered_at`,
        [publicId, status, note, amount, currency]
      );
      if (!updated.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ ok: false, error: "سفارشی با این کد پیدا نشد." });
      }
      await client.query(
        "INSERT INTO suraya_order_events (public_id, event_type, details) VALUES ($1, $2, $3)",
        [publicId, "operator.status_changed", JSON.stringify({ status, note, amount, currency })]
      );
      await client.query("COMMIT");
      res.json({ ok: true, order: updated.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Operator order update failed:", error.message);
      res.status(500).json({ ok: false, error: "به‌روزرسانی سفارش ناموفق بود." });
    } finally {
      client.release();
    }
  });

  return router;
}
