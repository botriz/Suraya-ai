import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

test("PostgreSQL migrations are repeatable and support order-event persistence", {
  skip: !connectionString
}, async () => {
  const client = new pg.Client({ connectionString });
  const schema = "suraya_ci_" + process.pid;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);
    await client.query(`
      CREATE TABLE suraya_orders (
        id BIGSERIAL PRIMARY KEY,
        public_id TEXT UNIQUE NOT NULL,
        customer_name VARCHAR(120) NOT NULL,
        customer_email VARCHAR(254),
        service_code VARCHAR(60) NOT NULL,
        service_title VARCHAR(160) NOT NULL,
        details TEXT NOT NULL DEFAULT '',
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const revenueMigration = await readFile(new URL("../migrations/002_revenue_operations.sql", import.meta.url), "utf8");
    const worldMigration = await readFile(new URL("../migrations/001_world_foundation.sql", import.meta.url), "utf8");
    const agentMigration = await readFile(new URL("../migrations/004_autonomous_agent.sql", import.meta.url), "utf8");

    await client.query(revenueMigration);
    await client.query(worldMigration);
    await client.query(agentMigration);
    await client.query(revenueMigration);
    await client.query(worldMigration);
    await client.query(agentMigration);

    const inserted = await client.query(
      "INSERT INTO suraya_orders (public_id, customer_name, service_code, service_title) VALUES ($1, $2, $3, $4) RETURNING public_id",
      ["SUR-CI12345678", "CI Test", "social_content", "CI test order"]
    );
    await client.query(
      "INSERT INTO suraya_order_events (public_id, event_type, details) VALUES ($1, $2, $3)",
      [inserted.rows[0].public_id, "ci.migration_verified", JSON.stringify({ ok: true })]
    );

    const result = await client.query(`
      SELECT o.public_id, o.quoted_currency, e.event_type
      FROM suraya_orders o
      JOIN suraya_order_events e USING (public_id)
      WHERE o.public_id = $1
    `, ["SUR-CI12345678"]);
    assert.equal(result.rowCount, 1);
    assert.equal(result.rows[0].quoted_currency, null);
    assert.equal(result.rows[0].event_type, "ci.migration_verified");

    const agentTable = await client.query("SELECT to_regclass($1) AS tasks", [schema + ".suraya_agent_tasks"]);
    assert.ok(agentTable.rows[0].tasks);

    const worldTables = await client.query(
      "SELECT to_regclass($1) AS regions, to_regclass($2) AS events",
      [schema + ".world_regions", schema + ".world_events"]
    );
    assert.ok(worldTables.rows[0].regions);
    assert.ok(worldTables.rows[0].events);
  } finally {
    await client.query("RESET search_path").catch(() => {});
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    await client.end();
  }
});
