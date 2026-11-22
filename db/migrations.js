import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MIGRATIONS = Object.freeze([
  "001_world_foundation.sql",
  "002_revenue_operations.sql",
  "003_social_operations.sql"
]);

const LOCK_NAMESPACE = 741203;
const LOCK_KEY = 1;

export async function runMigrations(pool, {
  migrationsDir,
  migrations = DEFAULT_MIGRATIONS,
  logger = console
} = {}) {
  if (!pool || typeof pool.connect !== "function") {
    throw new TypeError("A PostgreSQL pool is required to run migrations");
  }
  if (!migrationsDir || !Array.isArray(migrations) || migrations.length === 0) {
    throw new TypeError("A migrations directory and ordered migration list are required");
  }

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS suraya_schema_migrations (
        version VARCHAR(120) PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [LOCK_NAMESPACE, LOCK_KEY]);

    const applied = [];
    const skipped = [];
    for (const filename of migrations) {
      if (typeof filename !== "string" || !/^\d{3}_[a-z0-9_-]+\.sql$/.test(filename)) {
        throw new Error(`Invalid migration filename: ${String(filename)}`);
      }
      const version = filename.slice(0, -4);
      const sql = await readFile(path.join(migrationsDir, filename), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query(
        "SELECT checksum FROM suraya_schema_migrations WHERE version = $1",
        [version]
      );

      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Migration checksum mismatch for ${version}; applied migrations must be immutable`);
        }
        skipped.push(version);
        continue;
      }

      await client.query(sql);
      await client.query(
        "INSERT INTO suraya_schema_migrations(version, checksum) VALUES ($1, $2)",
        [version, checksum]
      );
      applied.push(version);
    }

    await client.query("COMMIT");
    transactionOpen = false;
    logger.info?.(`Suraya database migrations complete (applied: ${applied.length}, already applied: ${skipped.length})`);
    return { applied, skipped };
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
