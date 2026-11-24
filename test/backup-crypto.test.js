import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const encryptScript = path.join(root, "scripts/backup/encrypt.mjs");
const decryptScript = path.join(root, "scripts/backup/decrypt.mjs");

test("backup encryption round-trips authenticated binary data", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "suraya-backup-"));
  const key = randomBytes(32).toString("hex");
  const source = path.join(dir, "source.dump");
  const encrypted = path.join(dir, "source.dump.enc");
  const restored = path.join(dir, "restored.dump");
  const payload = Buffer.concat([Buffer.from("suraya-backup-test\0", "utf8"), randomBytes(257)]);
  try {
    await writeFile(source, payload);
    execFileSync(process.execPath, [encryptScript, source, encrypted], {
      env: { ...process.env, BACKUP_ENCRYPTION_KEY: key },
      stdio: "pipe"
    });
    execFileSync(process.execPath, [decryptScript, encrypted, restored], {
      env: { ...process.env, BACKUP_ENCRYPTION_KEY: key },
      stdio: "pipe"
    });
    assert.deepEqual(await readFile(restored), payload);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("backup decryption rejects tampered ciphertext", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "suraya-backup-tamper-"));
  const key = randomBytes(32).toString("hex");
  const source = path.join(dir, "source.dump");
  const encrypted = path.join(dir, "source.dump.enc");
  const tampered = path.join(dir, "tampered.dump.enc");
  const restored = path.join(dir, "restored.dump");
  try {
    await writeFile(source, "sensitive test payload");
    execFileSync(process.execPath, [encryptScript, source, encrypted], {
      env: { ...process.env, BACKUP_ENCRYPTION_KEY: key },
      stdio: "pipe"
    });
    const bytes = await readFile(encrypted);
    bytes[bytes.length - 1] ^= 1;
    await writeFile(tampered, bytes);
    const result = spawnSync(process.execPath, [decryptScript, tampered, restored], {
      env: { ...process.env, BACKUP_ENCRYPTION_KEY: key },
      encoding: "utf8"
    });
    assert.notEqual(result.status, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("backup encryption rejects missing or malformed keys", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "suraya-backup-key-"));
  const source = path.join(dir, "source.dump");
  const encrypted = path.join(dir, "source.dump.enc");
  try {
    await writeFile(source, "test");
    const result = spawnSync(process.execPath, [encryptScript, source, encrypted], {
      env: { ...process.env, BACKUP_ENCRYPTION_KEY: "not-a-key" },
      encoding: "utf8"
    });
    assert.notEqual(result.status, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
