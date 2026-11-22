import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey(env=process.env) {
  const raw=env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY||"";
  let key;
  if(/^[a-f0-9]{64}$/i.test(raw)) key=Buffer.from(raw,"hex");
  else { try{key=Buffer.from(raw,"base64")}catch{key=Buffer.alloc(0)} }
  if(key.length!==32) throw new Error("SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

export function isSocialEncryptionKeyValid(env=process.env) { try { encryptionKey(env); return true; } catch { return false; } }

export function encryptSocialToken(value,env=process.env) {
  const key=encryptionKey(env),iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);
  return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(":");
}

export function decryptSocialToken(payload,env=process.env) {
  const [version,iv,tag,data]=String(payload||"").split(":");
  if(version!=="v1"||!iv||!tag||!data) throw new Error("Stored social token format is invalid.");
  const decipher=createDecipheriv("aes-256-gcm",encryptionKey(env),Buffer.from(iv,"base64url"));
  decipher.setAuthTag(Buffer.from(tag,"base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,"base64url")),decipher.final()]).toString("utf8"));
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
