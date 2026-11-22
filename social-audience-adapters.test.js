import test from "node:test";
import assert from "node:assert/strict";
import { fetchVerifiedAudienceSnapshot } from "./social/audience-adapters.js";

test("TikTok audience snapshot is based on the authenticated aggregate profile response",async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async url=>{
    assert.match(String(url),/user\/info/);
    return new Response(JSON.stringify({data:{user:{open_id:"user-123",display_name:"Creator",follower_count:1200,following_count:80,likes_count:9400,video_count:35}}}),{status:200,headers:{"Content-Type":"application/json"}});
  };
  try{
    const result=await fetchVerifiedAudienceSnapshot({platform:"tiktok",external_account_id:"user-123"},{access_token:"provider-access-token"});
    assert.equal(result.verified,true);
    assert.equal(result.source,"tiktok_user_info_api");
    assert.equal(result.metrics.followers,1200);
    assert.equal(result.metrics.videoCount,35);
  }finally{globalThis.fetch=original}
});

test("unsupported social platforms do not receive invented audience metrics",async()=>{
  await assert.rejects(()=>fetchVerifiedAudienceSnapshot({platform:"telegram",external_account_id:"-1001"},{botToken:"private"}),/not available/);
});
