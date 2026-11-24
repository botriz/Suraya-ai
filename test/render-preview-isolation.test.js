import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

test("Render pull request previews do not connect to inherited production resources", async () => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: "0",
      HOST: "127.0.0.1",
      IS_PULL_REQUEST: "true",
      DATABASE_URL: "postgresql://preview:preview@db.example.invalid:5432/production",
      DATABASE_SSL: "true",
      AI_API_KEY: "preview-must-not-use-this-key",
      SURAYA_OPERATOR_TOKEN: "preview-must-not-use-this-token",
      SURAYA_AGENT_ENABLED: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  let port;
  try {
    port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("preview server startup timed out\n" + output)), 10000);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", chunk => {
        output += chunk;
        const match = output.match(/Suraya listening on 127\.0\.0\.1:(\d+)/);
        if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
      });
      child.stderr.on("data", chunk => { output += chunk; });
      child.once("error", error => { clearTimeout(timeout); reject(error); });
      child.once("exit", code => { clearTimeout(timeout); reject(new Error("server exited before startup: " + code + "\n" + output)); });
    });
    assert.equal(output.includes("Suraya database initialization failed"), false);
    const base = "http://127.0.0.1:" + port;
    assert.equal((await fetch(base + "/health")).status, 200);
    assert.equal((await fetch(base + "/api/status")).status, 503);
    const capabilities = (await (await fetch(base + "/api/capabilities")).json()).capabilities;
    assert.equal(capabilities.orderIntake, false);
    assert.equal(capabilities.operatorDesk, false);
    assert.equal(capabilities.contentGeneration, false);
    assert.equal(capabilities.digitalWorldReadApi, false);
    const order = await fetch(base + "/api/order", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Preview Test", service: "social_content" })
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
