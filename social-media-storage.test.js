import test from "node:test";
import assert from "node:assert/strict";
import { createPresignedMediaUpload } from "./social/media-storage.js";

test("media uploads use a short-lived HTTPS SigV4 URL and random object key",()=>{
  const result=createPresignedMediaUpload({
    originalName:"launch-video.mp4",contentType:"video/mp4",sizeBytes:1024,
    env:{SURAYA_S3_ENDPOINT:"https://acct.r2.cloudflarestorage.com",SURAYA_S3_PUBLIC_BASE_URL:"https://cdn.example.test",SURAYA_S3_BUCKET:"suraya-media",SURAYA_S3_REGION:"auto",SURAYA_S3_ACCESS_KEY_ID:"access-id",SURAYA_S3_SECRET_ACCESS_KEY:"secret-key"},
    now:new Date("2026-11-22T00:00:00.000Z")
  });
  const url=new URL(result.uploadUrl);
  assert.equal(url.protocol,"https:");
  assert.equal(url.searchParams.get("X-Amz-Expires"),"300");
  assert.equal(url.searchParams.get("X-Amz-Algorithm"),"AWS4-HMAC-SHA256");
  assert.ok(url.searchParams.get("X-Amz-Signature"));
  assert.equal(result.headers["Content-Type"],"video/mp4");
  assert.match(result.publicUrl,/^https:\/\/cdn\.example\.test\/social\//);
  assert.match(result.key,/\.mp4$/);
  assert.ok(!result.uploadUrl.includes("secret-key"));
});

test("media storage rejects unsupported file types and oversized uploads",()=>{
  const env={SURAYA_S3_ENDPOINT:"https://acct.r2.cloudflarestorage.com",SURAYA_S3_PUBLIC_BASE_URL:"https://cdn.example.test",SURAYA_S3_BUCKET:"media",SURAYA_S3_ACCESS_KEY_ID:"id",SURAYA_S3_SECRET_ACCESS_KEY:"secret"};
  assert.throws(()=>createPresignedMediaUpload({originalName:"file.exe",contentType:"application/octet-stream",sizeBytes:100,env}),/Unsupported media type/);
  assert.throws(()=>createPresignedMediaUpload({originalName:"huge.mp4",contentType:"video/mp4",sizeBytes:600*1024*1024,env}),/500 MB/);
});
