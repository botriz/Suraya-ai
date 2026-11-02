import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createWorldRouter } from "../world/world-api.js";

let server;
let baseUrl;
let capturedLimit;

before(async () => {
  const app = express();
  const pool = {
    async query(_sql, params) {
      capturedLimit = params[0];
      return { rows: [{ event_id: 1, event_type: "world.foundation.created", schema_version: 1, payload: {} }] };
    }
  };
  app.use("/api/world/v1", createWorldRouter({ pool, isDatabaseReady: () => true }));
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/world/v1`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("status reports read-only foundation state", async () => {
  const response = await fetch(`${baseUrl}/status`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.stage, "foundation");
  assert.equal(body.writable, false);
  assert.equal(body.storage, "ready");
});

test("manifest keeps autonomous execution and payments disabled", async () => {
  const response = await fetch(`${baseUrl}/manifest`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.manifest.activation.autonomousActions, false);
  assert.equal(body.manifest.activation.realPayments, false);
  assert.equal(body.manifest.firstPlannedCity.name, "Tabriz");
});

test("events endpoint clamps requested page size and returns public events", async () => {
  const response = await fetch(`${baseUrl}/events?limit=500`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(capturedLimit, 50);
  assert.equal(body.events.length, 1);
});

test("events endpoint fails closed when storage is unavailable", async () => {
  const app = express();
  app.use("/api/world/v1", createWorldRouter({ pool: null, isDatabaseReady: () => false }));
  const isolated = createServer(app);
  await new Promise((resolve) => isolated.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${isolated.address().port}/api/world/v1/events`);
    assert.equal(response.status, 503);
  } finally {
    await new Promise((resolve, reject) => isolated.close((error) => error ? reject(error) : resolve()));
  }
});
