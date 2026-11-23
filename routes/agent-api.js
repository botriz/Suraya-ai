import express from "express";
import { randomUUID } from "node:crypto";

function authorized(req, token) {
  const supplied = req.get("authorization") || "";
  if (!token || !supplied.startsWith("Bearer ")) return false;
  const actual = Buffer.from(supplied.slice(7));
  const expected = Buffer.from(token);
  return actual.length === expected.length && actual.length > 0 &&
    (awaitSafeEqual(actual, expected));
}
function awaitSafeEqual(a, b) {
  // timingSafeEqual is synchronous and only called after equal-length validation.
  return requireTimingSafeEqual(a, b);
}
import { timingSafeEqual as requireTimingSafeEqual } from "node:crypto";

export function createAgentRouter({ agent, getToken = () => process.env.SURAYA_OPERATOR_TOKEN } = {}) {
  const router = express.Router();
  router.use((req, res, next) => {
    if (!authorized(req, getToken())) return res.status(401).json({ ok: false, error: "Unauthorized" });
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get("/status", (_req, res) => res.json({
    ok: true,
    mode: "autonomous",
    scope: "branch",
    configured: Boolean(agent?.isConfigured?.()),
    mergeAllowed: false,
    deployAllowed: false,
    publicationAllowed: false
  }));
  router.post("/tasks", async (req, res) => {
    const goal = typeof req.body?.goal === "string" ? req.body.goal.trim() : "";
    if (goal.length < 8 || goal.length > 4000) return res.status(400).json({ ok: false, error: "هدف باید بین ۸ تا ۴۰۰۰ نویسه باشد." });
    try {
      const id = await agent.enqueue(goal);
      return res.status(202).json({ ok: true, taskId: id, status: "queued" });
    } catch (error) {
      return res.status(error.code === "AGENT_NOT_CONFIGURED" ? 503 : 500).json({
        ok: false, code: error.code || "AGENT_ERROR", error: error.message || "ثبت وظیفه انجام نشد."
      });
    }
  });
  router.get("/tasks/:id", async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ ok: false, error: "شناسه وظیفه معتبر نیست." });
    const task = await agent.getTask(req.params.id);
    return task ? res.json({ ok: true, task }) : res.status(404).json({ ok: false, error: "وظیفه پیدا نشد." });
  });
  return router;
}
