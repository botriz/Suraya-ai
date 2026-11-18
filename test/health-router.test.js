import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createHealthRouter } from "../health/health-router.js";

const servers = [];
const urls = [];

async function startServer(databaseReady, worldReady) {
  const app = express();
  app.use(createHealthRouter({
    isDatabaseReady: () => databaseReady,
    isWorldDatabaseReady: () => worldReady
  }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

before(async () => {
  urls.push(await startServer(false, false));
  urls.push(await startServer(true, false));
  urls.push(await startServer(true, true));
});

after(async () => {
  await Promise.all(servers.map((server) =>
    new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  ));
});

test("liveness stays healthy while dependencies are unavailable", async () => {
  const response = await fetch(`${urls[0]}/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.check, "liveness");
});

test("readiness fails closed when the primary database is unavailable", async () => {
  const response = await fetch(`${urls[0]}/ready`);
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.status, "not_ready");
  assert.equal(body.checks.database, "unavailable");
});

test("readiness distinguishes an optional digital-world degradation", async () => {
  const response = await fetch(`${urls[1]}/ready`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "degraded");
  assert.equal(body.checks.digitalWorld, "degraded");
});

test("readiness reports full capability when both stores are ready", async () => {
  const response = await fetch(`${urls[2]}/ready`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "ready");
  assert.equal(body.checks.digitalWorld, "ready");
});
