import express from "express";

const router = express.Router();

const manifest = {
  world: "Suraya",
  apiVersion: "v1",
  worldVersion: "0.1.0",
  stage: "foundation",
  locale: { default: "azb-Arab", available: ["azb-Arab", "fa-IR", "en"] },
  officialLanguage: { name: "Azerbaijani Turkic", dialect: "Tabrizi", script: "Persian" },
  firstPlannedCity: { name: "Tabriz", status: "planned" },
  simulationLayers: ["nature", "time", "geography", "environment"],
  activation: {
    publicReadApi: true,
    visitorAccounts: false,
    citizenRegistration: false,
    characters: false,
    autonomousActions: false,
    virtualLedger: false,
    realPayments: false
  }
};

export function createWorldRouter({ pool, isDatabaseReady }) {
  router.get("/status", (_req, res) => {
    const ready = Boolean(pool && isDatabaseReady());
    res.status(200).json({
      ok: true,
      world: "Suraya",
      apiVersion: "v1",
      stage: "foundation",
      storage: ready ? "ready" : "unavailable",
      writable: false,
      timestamp: new Date().toISOString()
    });
  });

  router.get("/manifest", (_req, res) => {
    res.set("Cache-Control", "public, max-age=60");
    res.json({ ok: true, manifest });
  });

  router.get("/events", async (req, res) => {
    if (!pool || !isDatabaseReady()) {
      return res.status(503).json({ ok: false, error: "World event storage is not ready." });
    }

    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
    try {
      const result = await pool.query(
        `SELECT event_id, event_type, schema_version, occurred_at, payload
         FROM world_events
         WHERE visibility = 'public'
         ORDER BY occurred_at DESC
         LIMIT $1`,
        [limit]
      );
      return res.json({ ok: true, events: result.rows });
    } catch (error) {
      console.error("World events query failed:", error.message);
      return res.status(503).json({ ok: false, error: "World events are temporarily unavailable." });
    }
  });

  return router;
}
