import test from "node:test";
import assert from "node:assert/strict";
import { verifyTelegramDestination, publishSocialPost } from "./social/publish-adapters.js";
import { encryptSocialToken } from "./social/token-crypto.js";

test("Telegram destination verification requires bot channel administrator rights",async()=>{
  const original=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async url=>{
    calls.push(String(url));
    const method=String(url).split("/").pop().split("?")[0];
    const payload=method==="getMe"?{ok:true,result:{id:77,username:"suraya_test_bot"}}:
      method==="getChat"?{ok:true,result:{id:-100123,title:"Suraya Channel",type:"channel"}}:
      {ok:true,result:{status:"member"}};
    return new Response(JSON.stringify(payload),{status:200,headers:{"Content-Type":"application/json"}});
  };
  try{
    await assert.rejects(()=>verifyTelegramDestination("fake-bot-token","-100123"),/administrator/);
    assert.equal(calls.length,3);
  }finally{globalThis.fetch=original}
});

test("Telegram video publishing uses the encrypted bot token and public media URL",async()=>{
  const original=globalThis.fetch;
  const env={SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,4).toString("base64")};
  const tokenCiphertext=encryptSocialToken({botToken:"secret-bot-token",chatId:"-100123"},env);
  let requestUrl="",requestBody;
  process.env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY=env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY;
  globalThis.fetch=async(url,options)=>{
    requestUrl=String(url);requestBody=JSON.parse(options.body);
    return new Response(JSON.stringify({ok:true,result:{message_id:456}}),{status:200,headers:{"Content-Type":"application/json"}});
  };
  try{
    const result=await publishSocialPost({platform:"telegram",tokenCiphertext,post:{title:"Title",caption:"Caption",hashtags:"#test",media_url:"https://cdn.example.test/video.mp4",media_type:"video"}});
    assert.match(requestUrl,/sendVideo$/);
    assert.equal(requestBody.chat_id,"-100123");
    assert.equal(requestBody.video,"https://cdn.example.test/video.mp4");
    assert.equal(result.externalPostId,"456");
  }finally{globalThis.fetch=original;delete process.env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY}
});
