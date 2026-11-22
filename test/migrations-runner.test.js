import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runMigrations } from "../db/migrations.js";

function fakePool() {
  const applied = new Map();
  const executed = [];
  let inTransaction = false;
  const client = {
    async query(sql, params = []) {
      const statement = String(sql).trim();
      if (statement === "BEGIN") { inTransaction = true; return { rowCount: null, rows: [] }; }
      if (statement === "COMMIT") { inTransaction = false; return { rowCount: null, rows: [] }; }
      if (statement === "ROLLBACK") { inTransaction = false; return { rowCount: null, rows: [] }; }
      if (statement.startsWith("CREATE TABLE IF NOT EXISTS suraya_schema_migrations")) return { rowCount: null, rows: [] };
      if (statement.startsWith("SELECT pg_advisory_xact_lock")) return { rowCount: null, rows: [] };
      if (statement.startsWith("SELECT checksum FROM suraya_schema_migrations")) {
        const checksum = applied.get(params[0]);
        return { rowCount: checksum ? 1 : 0, rows: checksum ? [{ checksum }] : [] };
      }
      if (statement.startsWith("INSERT INTO suraya_schema_migrations")) {
        applied.set(params[0], params[1]);
        return { rowCount: 1, rows: [] };
      }
      executed.push(statement);
      return { rowCount: null, rows: [] };
    },
    release() {}
  };
  return { connect: async () => client, applied, executed, get inTransaction() { return inTransaction; } };
}

test("migrations run once and are skipped on subsequent startup", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "suraya-migrations-"));
  try {
    await writeFile(path.join(dir, "001_first.sql"), "CREATE TABLE first_table(id INT);");
    await writeFile(path.join(dir, "002_second.sql"), "CREATE TABLE second_table(id INT);");
    const pool = fakePool();
    const options = { migrationsDir: dir, migrations: ["001_first.sql", "002_second.sql"], logger: {} };

    const first = await runMigrations(pool, options);
    const second = await runMigrations(pool, options);

    assert.deepEqual(first.applied, ["001_first", "002_second"]);
    assert.deepEqual(first.skipped, []);
    assert.deepEqual(second.applied, []);
    assert.deepEqual(second.skipped, ["001_first", "002_second"]);
    assert.equal(pool.executed.length, 2);
    assert.equal(pool.applied.size, 2);
    assert.equal(pool.inTransaction, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("an edited applied migration fails closed", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "suraya-migrations-"));
  try {
    const file = path.join(dir, "001_first.sql");
    await writeFile(file, "CREATE TABLE first_table(id INT);");
    const pool = fakePool();
    const options = { migrationsDir: dir, migrations: ["001_first.sql"], logger: {} };
    await runMigrations(pool, options);
    await writeFile(file, "CREATE TABLE first_table(id BIGINT);");
    await assert.rejects(() => runMigrations(pool, options), /checksum mismatch/);
    assert.equal(pool.inTransaction, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
