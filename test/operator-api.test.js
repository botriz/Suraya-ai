import test from "node:test";
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
before(async()=>{const app=express();app.use(express.json());app.use("/api/operator/v1",createOperatorRouter({pool,getToken:()=>"test-secret"}));server=createServer(app);await new Promise(r=>server.listen(0,"127.0.0.1",r));baseUrl="http://127.0.0.1:"+server.address().port;});
after(async()=>{if(server)await new Promise((r,j)=>server.close(e=>e?j(e):r()));});
test("operator API rejects missing token",async()=>{const r=await fetch(baseUrl+"/api/operator/v1/orders");assert.equal(r.status,401);});
test("operator API lists orders with valid token",async()=>{const r=await fetch(baseUrl+"/api/operator/v1/orders",{headers:{Authorization:"Bearer test-secret"}});const b=await r.json();assert.equal(r.status,200);assert.equal(b.orders.length,1);});
test("operator API validates order status",async()=>{const r=await fetch(baseUrl+"/api/operator/v1/orders/SUR-ABCDEF1234",{method:"PATCH",headers:{Authorization:"Bearer test-secret","Content-Type":"application/json"},body:JSON.stringify({status:"paid"})});assert.equal(r.status,400);});
test("operator API records approved status changes transactionally",async()=>{const r=await fetch(baseUrl+"/api/operator/v1/orders/SUR-ABCDEF1234",{method:"PATCH",headers:{Authorization:"Bearer test-secret","Content-Type":"application/json"},body:JSON.stringify({status:"quoted",quotedAmount:12,quotedCurrency:"USD",operatorNote:"Scope confirmed"})});const b=await r.json();assert.equal(r.status,200);assert.equal(b.order.status,"quoted");});
