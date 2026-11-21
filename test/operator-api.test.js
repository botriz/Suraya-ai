import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createOperatorRouter } from "../routes/operator-api.js";

let server, baseUrl;
const orders = [{ public_id: "SUR-ABCDEF1234", customer_name: "Test", service_title: "Test service", status: "pending" }];
const pool = {
  async query(sql, params) { assert.match(sql, /FROM suraya_orders/); return { rows: orders }; },
  async connect() { return {
    async query(sql, params) {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rowCount: 0, rows: [] };
      if (/UPDATE suraya_orders/.test(sql)) return { rowCount: 1, rows: [{ public_id: params[0], status: params[1] }] };
      if (/INSERT INTO suraya_order_events/.test(sql)) return { rowCount: 1, rows: [] };
      throw new Error("Unexpected SQL");
    },
    release() {}
  }; }
};
before(async()=>{const app=express();app.use(express.json());app.use("/api/operator/v1",createOperatorRouter({pool,getToken:()=>"test-secret",planner:{isConfigured:()=>true,plan:async({goal,systemContext})=>({planId:"plan-test",goal,mode:"advisory",executionEnabled:false,steps:[{action:"inspect_health",description:"Check service health",requiresApproval:true}],context:systemContext})},getSystemSnapshot:()=>({orderIntake:true})}));server=createServer(app);await new Promise(r=>server.listen(0,"127.0.0.1",r));baseUrl="http://127.0.0.1:"+server.address().port;});
after(async()=>{if(server)await new Promise((r,j)=>server.close(e=>e?j(e):r()));});
test("operator API rejects missing token",async()=>{const r=await fetch(baseUrl+"/api/operator/v1/orders");assert.equal(r.status,401);});
test("operator API lists orders with valid token",async()=>{const r=await fetch(baseUrl+"/api/operator/v1/orders",{headers:{Authorization:"Bearer test-secret"}});const b=await r.json();assert.equal(r.status,200);assert.equal(b.orders.length,1);});
test("operator API validates order status",async()=>{const r=await fetch(baseUrl+"/api/operator/v1/orders/SUR-ABCDEF1234",{method:"PATCH",headers:{Authorization:"Bearer test-secret","Content-Type":"application/json"},body:JSON.stringify({status:"paid"})});assert.equal(r.status,400);});
test("operator API records approved status changes transactionally",async()=>{const r=await fetch(baseUrl+"/api/operator/v1/orders/SUR-ABCDEF1234",{method:"PATCH",headers:{Authorization:"Bearer test-secret","Content-Type":"application/json"},body:JSON.stringify({status:"quoted",quotedAmount:12,quotedCurrency:"USD",operatorNote:"Scope confirmed"})});const b=await r.json();assert.equal(r.status,200);assert.equal(b.order.status,"quoted");});

test("operator API rejects an incorrect token and never caches protected responses",async()=>{
  const rejected=await fetch(baseUrl+"/api/operator/v1/orders",{headers:{Authorization:"Bearer wrong-secret"}});
  assert.equal(rejected.status,401);
  assert.equal(rejected.headers.get("cache-control"),"no-store");
});
test("operator API fails closed when no token is configured",async()=>{
  const app=express();app.use("/api/operator/v1",createOperatorRouter({pool,getToken:()=>undefined}));
  const isolated=createServer(app);await new Promise(r=>isolated.listen(0,"127.0.0.1",r));
  try { const r=await fetch("http://127.0.0.1:"+isolated.address().port+"/api/operator/v1/orders",{headers:{Authorization:"Bearer test-secret"}});assert.equal(r.status,401); }
  finally { await new Promise((r,j)=>isolated.close(e=>e?j(e):r())); }
});

test("central status is advisory-only and exposes no execution capability",async()=>{
  const r=await fetch(baseUrl+"/api/operator/v1/central/status",{headers:{Authorization:"Bearer test-secret"}});
  const b=await r.json();assert.equal(r.status,200);assert.equal(b.mode,"advisory");assert.equal(b.executionEnabled,false);assert.equal(b.plannerConfigured,true);assert.equal(r.headers.get("cache-control"),"no-store");
});
test("central planner returns a bounded proposal without executing it",async()=>{
  const r=await fetch(baseUrl+"/api/operator/v1/central/plan",{method:"POST",headers:{Authorization:"Bearer test-secret","Content-Type":"application/json"},body:JSON.stringify({goal:"Inspect the current service health"})});
  const b=await r.json();assert.equal(r.status,200);assert.equal(b.plan.executionEnabled,false);assert.equal(b.plan.steps[0].requiresApproval,true);
});
test("central planner validates short goals",async()=>{
  const r=await fetch(baseUrl+"/api/operator/v1/central/plan",{method:"POST",headers:{Authorization:"Bearer test-secret","Content-Type":"application/json"},body:JSON.stringify({goal:"bad"})});
  assert.equal(r.status,400);
});
