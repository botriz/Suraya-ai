import test from "node:test";
import assert from "node:assert/strict";
import { createCentralPlanner } from "../core/central-planner.js";

function fakeFetch(content, status = 200) {
  return async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.response_format.type, "json_object");
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return { choices: [{ message: { content: JSON.stringify(content) } }] };
      }
    };
  };
}

test("central planner returns advisory plans with approval gates", async () => {
  const planner = createCentralPlanner({
    apiKey: "test-key",
    fetchImpl: fakeFetch({
      summary: "Inspect service readiness",
      steps: [{ action: "inspect_health", description: "Read the health endpoint" }]
    })
  });
  const result = await planner.plan({ goal: "Inspect service readiness" });
  assert.equal(result.mode, "advisory");
  assert.equal(result.executionEnabled, false);
  assert.equal(result.steps[0].requiresApproval, true);
  assert.equal(result.steps[0].action, "inspect_health");
});

test("central planner rejects actions outside its allowlist", async () => {
  const planner = createCentralPlanner({
    apiKey: "test-key",
    fetchImpl: fakeFetch({
      summary: "Deploy the app",
      steps: [{ action: "deploy_production", description: "Deploy to production" }]
    })
  });
  await assert.rejects(
    planner.plan({ goal: "Deploy the current website" }),
    error => error.code === "CENTRAL_UNSUPPORTED_ACTION"
  );
});

test("central planner fails closed when provider configuration is missing", async () => {
  const planner = createCentralPlanner({ apiKey: "", fetchImpl: async () => { throw new Error("must not run"); } });
  assert.equal(planner.isConfigured(), false);
  await assert.rejects(
    planner.plan({ goal: "Inspect the website" }),
    error => error.code === "CENTRAL_NOT_CONFIGURED"
  );
});

test("central planner validates goal length before calling provider", async () => {
  let called = false;
  const planner = createCentralPlanner({
    apiKey: "test-key",
    fetchImpl: async () => { called = true; throw new Error("must not run"); }
  });
  await assert.rejects(planner.plan({ goal: "short" }), error => error.code === "CENTRAL_INVALID_GOAL");
  assert.equal(called, false);
});
