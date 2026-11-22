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


test("Instagram publishing creates, processes and publishes a media container",async()=>{
  const original=globalThis.fetch,envKey=process.env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY;
  process.env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,5).toString("base64");
  const encrypted=encryptSocialToken({access_token:"meta-page-token"});
  globalThis.fetch=async(url,options={})=>{
    const value=String(url);
    if(value.endsWith("/media"))return new Response(JSON.stringify({id:"container-1"}),{status:200,headers:{"Content-Type":"application/json"}});
    if(value.includes("/container-1?"))return new Response(JSON.stringify({status_code:"FINISHED"}),{status:200,headers:{"Content-Type":"application/json"}});
    if(value.endsWith("/media_publish"))return new Response(JSON.stringify({id:"instagram-post-1"}),{status:200,headers:{"Content-Type":"application/json"}});
    throw new Error("Unexpected Meta request "+value);
  };
  try{
    const result=await publishSocialPost({platform:"instagram",tokenCiphertext:encrypted,accountMetadata:{instagramId:"ig-123"},post:{caption:"A caption",hashtags:"#test",media_url:"https://cdn.example.test/reel.mp4",media_type:"video"}});
    assert.equal(result.externalPostId,"instagram-post-1");
  }finally{globalThis.fetch=original;if(envKey===undefined)delete process.env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY;else process.env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY=envKey}
});

test("X text publishing sends a post through the authenticated v2 API",async()=>{
  const original=globalThis.fetch,envKey=process.env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY;
  process.env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,6).toString("base64");
  const encrypted=encryptSocialToken({access_token:"x-user-token"});
  let sent;
  globalThis.fetch=async(url,options)=>{sent={url:String(url),headers:options.headers,body:JSON.parse(options.body)};return new Response(JSON.stringify({data:{id:"x-post-1"}}),{status:201,headers:{"Content-Type":"application/json"}})};
  try{
    const result=await publishSocialPost({platform:"x",tokenCiphertext:encrypted,post:{title:"Title",caption:"Short post",hashtags:"#suraya",media_type:"none"}});
    assert.equal(result.externalPostId,"x-post-1");
    assert.equal(sent.headers.Authorization,"Bearer x-user-token");
    assert.equal(sent.body.text,"Short post\\n\\n#suraya");
  }finally{globalThis.fetch=original;if(envKey===undefined)delete process.env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY;else process.env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY=envKey}
});

test("YouTube upload uses a resumable upload and only fetches allowlisted HTTPS media",async()=>{
  const original=globalThis.fetch,keys=["SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY","SURAYA_MEDIA_ALLOWED_HOSTS","SOCIAL_YOUTUBE_CLIENT_ID","SOCIAL_YOUTUBE_CLIENT_SECRET"];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  process.env.SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,8).toString("base64");
  process.env.SURAYA_MEDIA_ALLOWED_HOSTS="cdn.example.test";
  process.env.SOCIAL_YOUTUBE_CLIENT_ID="youtube-client";
  process.env.SOCIAL_YOUTUBE_CLIENT_SECRET="youtube-secret";
  const encrypted=encryptSocialToken({refresh_token:"refresh-token"});
  const calls=[];
  globalThis.fetch=async(url,options={})=>{
    const value=String(url);calls.push({url:value,method:options.method||"GET"});
    if(value==="https://cdn.example.test/video.mp4")return new Response(new Uint8Array([1,2,3]),{status:200,headers:{"Content-Type":"video/mp4","Content-Length":"3"}});
    if(value==="https://oauth2.googleapis.com/token")return new Response(JSON.stringify({access_token:"fresh-google-token"}),{status:200,headers:{"Content-Type":"application/json"}});
    if(value.startsWith("https://www.googleapis.com/upload/youtube/v3/videos?"))return new Response(null,{status:200,headers:{Location:"https://upload.youtube.test/session/1"}});
    if(value==="https://upload.youtube.test/session/1")return new Response(JSON.stringify({id:"youtube-video-1",snippet:{channelId:"channel-1"}}),{status:200,headers:{"Content-Type":"application/json"}});
    throw new Error("Unexpected YouTube request "+value);
  };
  try{
    const result=await publishSocialPost({platform:"youtube",tokenCiphertext:encrypted,accountMetadata:{channelId:"channel-1"},post:{title:"Video",caption:"Description",media_url:"https://cdn.example.test/video.mp4",media_type:"video"}});
    assert.equal(result.externalPostId,"youtube-video-1");
    assert.ok(calls.some(x=>x.method==="PUT"&&x.url.includes("upload.youtube.test")));
  }finally{globalThis.fetch=original;for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k]}}
});
