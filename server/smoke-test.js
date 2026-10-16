// Smoke test for the DormWash server.
// Starts index.js on a spare port, hits each endpoint, then shuts it down.
// Run it with: npm test   (from the server folder)

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
let server;

before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, "index.js")], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "inherit",
  });

  // Wait up to 10 seconds for the server to answer.
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(BASE);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error("Server did not start");
});

after(() => server && server.kill());

test("GET / says the server is running", async () => {
  const res = await fetch(BASE);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /DormWash server is running/);
});

test("POST /maintenance-requests saves a report", async () => {
  const res = await fetch(`${BASE}/maintenance-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ machineID: "W4", issue: "Leaking", details: "Water on the floor" }),
  });
  assert.equal(res.status, 201);
  const report = await res.json();
  assert.equal(report.machineID, "W4");
  assert.ok(report.id);
});

test("POST /maintenance-requests without a machine is rejected", async () => {
  const res = await fetch(`${BASE}/maintenance-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issue: "Leaking" }),
  });
  assert.equal(res.status, 400);
});

test("GET /maintenance-requests lists saved reports", async () => {
  const res = await fetch(`${BASE}/maintenance-requests`);
  assert.equal(res.status, 200);
  const reports = await res.json();
  assert.ok(Array.isArray(reports));
  assert.ok(reports.some((r) => r.machineID === "W4"));
});
