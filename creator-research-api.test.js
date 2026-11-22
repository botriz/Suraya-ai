import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { createCreatorRouter } from "./routes/creator-api.js";

async function withServer(fn){
  const app=express();app.use(express.json());
  const pool={async query(sql,params){assert.match(sql,/INSERT INTO suraya_social_research_runs/);assert.equal(params[3],true);return {rows:[{public_id:"SRES-123456789ABC",created_at:"2026-11-22T00:00:00Z"}]}}};
  let researchCalls=0;
  const researchEngine={isConfigured:()=>true,async generate(input){researchCalls++;return {draft:{title:"عنوان",caption:"متن [1] [2]",hashtags:"#test",script:"سناریو [1] [2]",cta:"بیشتر بخوانید"},sources:[{title:"Source 1",url:"https://who.int/a",domain:"who.int"},{title:"Source 2",url:"https://pubmed.ncbi.nlm.nih.gov/1",domain:"pubmed.ncbi.nlm.nih.gov"}],category:input.category,sourcePolicyPassed:true,provider:"test"}}};
  app.use("/api/creator/v1",createCreatorRouter({researchEngine,pool,getOperatorToken:()=>"operator-test-token",rateLimit:(_req,_res,next)=>next()}));
  const server=app.listen(0,"127.0.0.1");await once(server,"listening");
  const base="http://127.0.0.1:"+server.address().port;
  try{await fn(base,()=>researchCalls)}finally{await new Promise(resolve=>server.close(resolve))}
}

test("research draft endpoint requires operator authorization",async()=>{
  await withServer(async base=>{
    const response=await fetch(base+"/api/creator/v1/research-draft",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:"موضوع علمی",category:"science"})});
    assert.equal(response.status,401);
  });
});

test("authorized source-grounded draft is persisted with source metadata",async()=>{
  await withServer(async(base,calls)=>{
    const response=await fetch(base+"/api/creator/v1/research-draft",{method:"POST",headers:{Authorization:"Bearer operator-test-token","Content-Type":"application/json"},body:JSON.stringify({topic:"اثر آلودگی هوا",category:"health",platform:"instagram",language:"fa"})});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.researchId,"SRES-123456789ABC");
    assert.equal(data.sources.length,2);
    assert.equal(calls(),1);
  });
});
