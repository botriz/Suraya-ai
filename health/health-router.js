import express from "express";

export function createHealthRouter({ isDatabaseReady, isWorldDatabaseReady }) {
  const router = express.Router();

  // Liveness is intentionally independent of external dependencies.
  router.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "Suraya",
      check: "liveness",
      time: new Date().toISOString()
    });
  });

  // Readiness reports whether the service can accept its core database-backed work.
  // The world schema is an optional capability and is reported separately.
  router.get("/ready", (_req, res) => {
    const databaseReady = Boolean(isDatabaseReady());
    const worldReady = Boolean(isWorldDatabaseReady());
    const ready = databaseReady;

    res.status(ready ? 200 : 503).json({
      ok: ready,
      service: "Suraya",
      status: !ready ? "not_ready" : worldReady ? "ready" : "degraded",
      checks: {
        database: databaseReady ? "ready" : "unavailable",
        digitalWorld: worldReady ? "ready" : "degraded"
      },
      time: new Date().toISOString()
    });
  });

  return router;
}
