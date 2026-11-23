import test from "node:test";
import assert from "node:assert/strict";
import { createAgentRouter } from "../routes/agent-api.js";
import express from "express";
import { createServer } from "node:http";

async function serve(agent, token = "test-token") {
  const app = express();
  app.use(express.json());
  app.use("/api/agent/v1", createAgentRouter({ agent, getToken: () => token }));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { url: "http://127.0.0.1:" + server.address().port, close: () => new Promise(resolve => server.close(resolve)) };
}

test("agent status explicitly disables merge, deploy and publication", async () => {
  const app = await serve({ isConfigured: () => true, enqueue: async () => "id", getTask: async () => null });
  try {
    const response = await fetch(app.url + "/api/agent/v1/status", { headers: { Authorization: "Bearer test-token" } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, "autonomous");
    assert.equal(body.scope, "branch");
    assert.equal(body.mergeAllowed, false);
    assert.equal(body.deployAllowed, false);
    assert.equal(body.publicationAllowed, false);
  } finally { await app.close(); }
});

test("agent API rejects requests without operator authentication", async () => {
  const app = await serve({ isConfigured: () => true });
  try {
    const response = await fetch(app.url + "/api/agent/v1/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: "Improve tests" }) });
    assert.equal(response.status, 401);
  } finally { await app.close(); }
});

test("agent API validates task goal and queues valid requests", async () => {
  let saved;
  const app = await serve({ isConfigured: () => true, enqueue: async goal => { saved = goal; return "12345678-1234-1234-1234-123456789012"; }, getTask: async () => null });
  try {
    const headers = { Authorization: "Bearer test-token", "Content-Type": "application/json" };
    const bad = await fetch(app.url + "/api/agent/v1/tasks", { method: "POST", headers, body: JSON.stringify({ goal: "short" }) });
    assert.equal(bad.status, 400);
    const good = await fetch(app.url + "/api/agent/v1/tasks", { method: "POST", headers, body: JSON.stringify({ goal: "Add robust health checks" }) });
    assert.equal(good.status, 202);
    assert.equal(saved, "Add robust health checks");
  } finally { await app.close(); }
});
