import test from "node:test";
import assert from "node:assert/strict";
import { createResearchEngine } from "./ai/research-engine.js";

const modelContent=JSON.stringify({title:"عنوان مستند",caption:"ادعای علمی [1] و [2]",hashtags:"#پژوهش",script:"سناریو با ارجاع [1]",cta:"منابع را بررسی کنید"});

test("research engine filters sources by trusted domains and cites returned sources",async()=>{
  const calls=[];
  const engine=createResearchEngine({aiApiKey:"ai-test",tavilyApiKey:"search-test",fetchImpl:async(url,options)=>{
    calls.push({url:String(url),body:options.body});
    if(String(url).includes("tavily.com"))return new Response(JSON.stringify({results:[
      {title:"Nature paper",url:"https://pubmed.ncbi.nlm.nih.gov/12345/",content:"A peer-reviewed scientific result."},
      {title:"WHO guidance",url:"https://www.who.int/example",content:"Public health guidance."},
      {title:"Unverified blog",url:"https://random-blog.example/post",content:"Unverified claims."}
    ]}),{status:200,headers:{"Content-Type":"application/json"}});
    return new Response(JSON.stringify({choices:[{message:{content:modelContent}}]}),{status:200,headers:{"Content-Type":"application/json"}});
  }});
  const result=await engine.generate({topic:"تأثیر آلودگی هوا بر سلامت",category:"health",platform:"instagram",language:"fa"});
  assert.equal(result.sourcePolicyPassed,true);
  assert.equal(result.sources.length,2);
  assert.ok(result.sources.every(source=>["pubmed.ncbi.nlm.nih.gov","who.int"].includes(source.domain)));
  assert.match(calls[1].body,/untrusted quoted data/i);
  assert.equal(result.draft.title,"عنوان مستند");
});

test("research engine refuses to draft when fewer than two trusted independent domains are found",async()=>{
  let modelCalled=false;
  const engine=createResearchEngine({aiApiKey:"ai-test",tavilyApiKey:"search-test",fetchImpl:async url=>{
    if(String(url).includes("tavily.com"))return new Response(JSON.stringify({results:[{title:"Blog",url:"https://example-blog.test/a",content:"Not a trusted source."}]}),{status:200,headers:{"Content-Type":"application/json"}});
    modelCalled=true;return new Response(JSON.stringify({choices:[]}),{status:200});
  }});
  await assert.rejects(()=>engine.generate({topic:"موضوع علمی",category:"science"}),error=>error.code==="INSUFFICIENT_TRUSTED_SOURCES");
  assert.equal(modelCalled,false);
});

test("research engine fails closed when provider credentials are missing",async()=>{
  const engine=createResearchEngine({aiApiKey:"",tavilyApiKey:""});
  await assert.rejects(()=>engine.generate({topic:"موضوع عمومی",category:"general"}),error=>error.code==="RESEARCH_NOT_CONFIGURED");
});
