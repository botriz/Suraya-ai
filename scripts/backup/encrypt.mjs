import { createCipheriv, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [inputPath, outputPath] = process.argv.slice(2);
const keyHex = process.env.BACKUP_ENCRYPTION_KEY || "";
if (!inputPath || !outputPath) {
  throw new Error("Usage: node encrypt.mjs <input.dump> <output.dump.enc>");
}
if (!/^[a-f0-9]{64}$/i.test(keyHex)) {
  throw new Error("BACKUP_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.");
}

const key = Buffer.from(keyHex, "hex");
const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const plaintext = await readFile(inputPath);
const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const tag = cipher.getAuthTag();
const header = Buffer.from("SURAYA-PG-BACKUP-V1\n", "utf8");

await writeFile(outputPath, Buffer.concat([header, iv, tag, ciphertext]), { mode: 0o600 });
console.log("Encrypted PostgreSQL archive created.");
