import { createDecipheriv } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [inputPath, outputPath] = process.argv.slice(2);
const keyHex = process.env.BACKUP_ENCRYPTION_KEY || "";
if (!inputPath || !outputPath) {
  throw new Error("Usage: node decrypt.mjs <input.dump.enc> <output.dump>");
}
if (!/^[a-f0-9]{64}$/i.test(keyHex)) {
  throw new Error("BACKUP_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.");
}

const data = await readFile(inputPath);
const header = Buffer.from("SURAYA-PG-BACKUP-V1\n", "utf8");
if (data.length < header.length + 28 || !data.subarray(0, header.length).equals(header)) {
  throw new Error("Backup file format is invalid.");
}
const key = Buffer.from(keyHex, "hex");
const ivStart = header.length;
const iv = data.subarray(ivStart, ivStart + 12);
const tag = data.subarray(ivStart + 12, ivStart + 28);
const ciphertext = data.subarray(ivStart + 28);
const decipher = createDecipheriv("aes-256-gcm", key, iv);
decipher.setAuthTag(tag);
const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
await writeFile(outputPath, plaintext, { mode: 0o600 });
console.log("Backup archive decrypted and authenticated.");
