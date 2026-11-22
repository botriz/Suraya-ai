import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { createSocialOperationsRouter } from "./routes/social-operations-api.js";

async function withServer(fn, poolOverride) {
  const app=express();
  app.use(express.json());
  const pool=poolOverride||{
    async query(sql,params=[]) {
      if(sql.includes("FROM suraya_subscription_plans")) return {rows:[{code:"starter",name:"شروع",monthly_price:"0",currency:"USD",limits:{connected_accounts:1},features:{content_drafts:true}}]};
      if(sql.includes("FROM suraya_social_calendar_items")) return {rows:[]};
      if(sql.includes("INSERT INTO suraya_social_calendar_items")) return {rows:[{id:7,title:params[0],platform:params[1],scheduled_for:params[2],notes:params[3],status:"planned"}]};
      throw new Error("Unexpected SQL in test: "+sql);
    }
  };
  app.use("/api/social/v1",createSocialOperationsRouter({pool,getToken:()=>"test-operator-token"}));
  const server=app.listen(0,"127.0.0.1");
  await once(server,"listening");
  const base="http://127.0.0.1:"+server.address().port;
  try{await fn(base)}finally{await new Promise(resolve=>server.close(resolve))}
}

test("social operations API rejects requests without the operator token",async()=>{
 await withServer(async base=>{
  const response=await fetch(base+"/api/social/v1/plans");
  assert.equal(response.status,401);
  assert.equal((await response.json()).ok,false);
 });
});

test("social operations API returns the subscription catalog to an authorized operator",async()=>{
 await withServer(async base=>{
  const response=await fetch(base+"/api/social/v1/plans",{headers:{Authorization:"Bearer test-operator-token"}});
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.billingEnabled,false);
  assert.equal(data.plans[0].code,"starter");
 });
});

test("social operations API persists calendar items through the database adapter",async()=>{
 await withServer(async base=>{
  const response=await fetch(base+"/api/social/v1/calendar",{method:"POST",headers:{Authorization:"Bearer test-operator-token","Content-Type":"application/json"},body:JSON.stringify({title:"آموزش امنیت دیجیتال",platform:"instagram",scheduledFor:new Date(Date.now()+86400000).toISOString(),notes:"بازبینی منابع قبل از انتشار"})});
  const data=await response.json();
  assert.equal(response.status,201);
  assert.equal(data.storage,"postgresql");
  assert.equal(data.publishingScheduled,false);
  assert.equal(data.item.id,7);
 });
});


test("media confirmation requires matching content type and exact object size",async()=>{
 const originalFetch=globalThis.fetch;
 const asset={id:9,public_url:"https://cdn.example.test/social/file.mp4",size_bytes:"1024",content_type:"video/mp4",status:"pending"};
 const pool={async query(sql){if(sql.includes("SELECT id,public_url,size_bytes,content_type,status"))return {rowCount:1,rows:[asset]};if(sql.includes("UPDATE suraya_social_media_assets"))return {rowCount:1,rows:[{...asset,status:"uploaded"}]};throw new Error("Unexpected SQL in test: "+sql);}};
 try{
  globalThis.fetch=async()=>new Response(null,{status:200,headers:{"content-length":"1024","content-type":"video/mp4"}});
  await withServer(async base=>{const response=await fetch(base+"/api/social/v1/media/9/confirm",{method:"POST",headers:{Authorization:"Bearer test-operator-token","Content-Type":"application/json"},body:"{}"});assert.equal(response.status,200);assert.equal((await response.json()).asset.status,"uploaded");},pool);
  globalThis.fetch=async()=>new Response(null,{status:200,headers:{"content-length":"1024","content-type":"image/png"}});
  await withServer(async base=>{const response=await fetch(base+"/api/social/v1/media/9/confirm",{method:"POST",headers:{Authorization:"Bearer test-operator-token","Content-Type":"application/json"},body:"{}"});assert.equal(response.status,409);},pool);
 }finally{globalThis.fetch=originalFetch;}
});
