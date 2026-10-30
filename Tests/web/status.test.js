const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("./helpers");

let server;

before(async () => {
  server = await startServer(4105);
});

after(() => server && server.stop());

test("GET /status confirms the DormWash server is running", async () => {
  const res = await fetch(`${server.base}/status`);

  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/json/);

  const data = await res.json();
  assert.equal(data.message, "DormWash server is running");
});
