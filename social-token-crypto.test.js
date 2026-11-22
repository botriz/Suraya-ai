import test from "node:test";
import assert from "node:assert/strict";
import { encryptSocialToken, decryptSocialToken } from "./social/token-crypto.js";

test("social tokens are authenticated-encrypted and never stored as plaintext",()=>{
  const env={SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString("base64")};
  const secret={access_token:"private-provider-token",refresh_token:"private-refresh-token"};
  const ciphertext=encryptSocialToken(secret,env);
  assert.match(ciphertext,/^v1:/);
  assert.equal(ciphertext.includes(secret.access_token),false);
  assert.deepEqual(decryptSocialToken(ciphertext,env),secret);
});

test("social token decryption rejects modified ciphertext",()=>{
  const env={SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,9).toString("base64")};
  const ciphertext=encryptSocialToken({token:"private"},env);
  const parts=ciphertext.split(":");
  parts[3]=Buffer.from("tampered").toString("base64url");
  assert.throws(()=>decryptSocialToken(parts.join(":"),env));
});

test("social token encryption rejects a key that is not exactly 32 bytes",()=>{
  assert.throws(()=>encryptSocialToken({token:"private"},{SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY:"too-short"}));
});
