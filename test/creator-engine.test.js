import test from "node:test";
import assert from "node:assert/strict";
import { createContentEngine } from "../ai/content-engine.js";
import { createCreatorRouter } from "../routes/creator-api.js";
import express from "express";
import { createServer } from "node:http";

const good = { title:"عنوان", caption:"کپشن", hashtags:"#آموزش", script:"متن سناریو", cta:"دعوت به اقدام" };
test("engine fails closed without an API key", async()=>{const e=createContentEngine({apiKey:"",fetchImpl:async()=>{throw Error("must not call")}});assert.equal(e.isConfigured(),false);await assert.rejects(()=>e.generate({topic:"موضوع"}),{code:"AI_NOT_CONFIGURED"});});
test("engine parses strict JSON response", async()=>{const e=createContentEngine({apiKey:"test",fetchImpl:async(url,options)=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(good)}}]})})});assert.deepEqual(await e.generate({topic:"آموزش"}),good);});
test("engine rejects incomplete model output", async()=>{const e=createContentEngine({apiKey:"test",fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({title:"x"})}}]})})});await assert.rejects(()=>e.generate({topic:"آموزش"}),/خروجی مدل ناقص/);});
test("engine handles provider rate limits without exposing provider body", async()=>{const e=createContentEngine({apiKey:"test",fetchImpl:async()=>({ok:false,status:429})});await assert.rejects(()=>e.generate({topic:"آموزش"}),/سهمیه سرویس/);});
test("creator route validates input and returns draft for configured provider",async()=>{const app=express();app.use(express.json());app.use("/api/creator/v1",createCreatorRouter({engine:{isConfigured:()=>true,generate:async()=>good}}));const server=createServer(app);await new Promise(r=>server.listen(0,"127.0.0.1",r));try{const base="http://127.0.0.1:"+server.address().port;const invalid=await fetch(base+"/api/creator/v1/draft",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:"abc"})});assert.equal(invalid.status,400);const valid=await fetch(base+"/api/creator/v1/draft",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:"معرفی محصول جدید",platform:"rubika"})});const body=await valid.json();assert.equal(valid.status,200);assert.deepEqual(body.draft,good);assert.equal(body.reviewRequired,true);}finally{await new Promise(r=>server.close(e=>e?e():r()));}});
