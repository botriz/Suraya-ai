import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

test("Suraya starts without optional database, reports degraded readiness, and never accepts unpersisted orders", async () => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: "0", HOST: "127.0.0.1", DATABASE_URL: "", SURAYA_AGENT_ENABLED: "false" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  let port;
  try {
    port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("server startup timed out")), 10000);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", chunk => {
        output += chunk;
        const match = output.match(/Suraya listening on 127\.0\.0\.1:(\d+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(Number(match[1]));
        }
      });
      child.stderr.on("data", chunk => { output += chunk; });
      child.once("error", error => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("exit", code => {
        clearTimeout(timeout);
        reject(new Error("server exited before startup: " + code + "\n" + output));
      });
    });

    const base = "http://127.0.0.1:" + port;
    const health = await fetch(base + "/health");
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    const ready = await fetch(base + "/ready");
    assert.equal(ready.status, 503);

    const status = await fetch(base + "/api/status");
    assert.equal(status.status, 503);

    const catalog = await fetch(base + "/api/services");
    const services = (await catalog.json()).services;
    assert.ok(Object.values(services).every(item => item.price === null && item.billing === "quote"));

    const order = await fetch(base + "/api/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "CI Test", service: "social_content" })
    });
    assert.equal(order.status, 503);
  } finally {
    child.kill("SIGTERM");
    await new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
    });
  }
});
