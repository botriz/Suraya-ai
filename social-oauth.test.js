import test from "node:test";
import assert from "node:assert/strict";
import { createAuthorizationUrl, oauthConfigured, socialRedirectUri } from "./social/oauth-adapters.js";

test("X OAuth authorization uses the registered callback and PKCE S256 challenge",()=>{
  const keys=["SOCIAL_X_CLIENT_ID","SOCIAL_X_CLIENT_SECRET","SURAYA_PUBLIC_BASE_URL","SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY"];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try{
    process.env.SOCIAL_X_CLIENT_ID="test-client";
    process.env.SOCIAL_X_CLIENT_SECRET="test-secret";
    process.env.SURAYA_PUBLIC_BASE_URL="https://example.test";
    process.env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,3).toString("base64");
    assert.equal(oauthConfigured("x"),true);
    const verifier="test-verifier-value";
    const url=new URL(createAuthorizationUrl("x",{state:"one-time-state",codeVerifier:verifier}));
    assert.equal(url.origin,"https://twitter.com");
    assert.equal(url.searchParams.get("redirect_uri"),"https://example.test/api/social/v1/oauth/x/callback");
    assert.equal(url.searchParams.get("state"),"one-time-state");
    assert.equal(url.searchParams.get("code_challenge_method"),"S256");
    assert.ok(url.searchParams.get("code_challenge"));
  }finally{for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k]}}
});

test("OAuth callback URI rejects non-HTTPS public origins",()=>{
  assert.throws(()=>socialRedirectUri("youtube",{SURAYA_PUBLIC_BASE_URL:"http://example.test"}));
});
