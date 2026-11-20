import test from "node:test";
import assert from "node:assert/strict";
import { buildCapabilities } from "../health/capabilities.js";

test("capability status only enables database-backed functions when ready", () => {
  const result = buildCapabilities({
    databaseReady: true,
    worldDatabaseReady: true,
    contentEngineReady: true,
    operatorTokenConfigured: true
  });
  assert.equal(result.orderIntake, true);
  assert.equal(result.operatorDesk, true);
  assert.equal(result.digitalWorldReadApi, true);
  assert.equal(result.contentGeneration, true);
});

test("unconfigured integrations stay explicitly disabled", () => {
  const result = buildCapabilities({ databaseReady: true });
  assert.equal(result.orderIntake, true);
  assert.equal(result.contentGeneration, false);
  assert.equal(result.operatorDesk, false);
  assert.equal(result.payments, false);
  assert.equal(result.socialOAuth, false);
  assert.equal(result.cryptoWallet, false);
  assert.equal(result.personalWallet, false);
  assert.equal(result.persistentUserAccounts, false);
  assert.equal(result.automaticPublishing, false);
});

test("database-dependent operator and world functions fail closed", () => {
  const result = buildCapabilities({
    databaseReady: false,
    worldDatabaseReady: true,
    operatorTokenConfigured: true
  });
  assert.equal(result.orderIntake, false);
  assert.equal(result.operatorDesk, false);
  assert.equal(result.digitalWorldReadApi, false);
});
