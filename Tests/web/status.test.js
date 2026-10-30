const test = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");

test("DormWash server status endpoint works", async () => {
  const port = 3456;

  const server = spawn("node", ["server.js"], {
    env: {
      ...process.env,
      PORT: String(port)
    }
  });

  try {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(`http://localhost:${port}/status`);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.message, "DormWash server is running");
  } finally {
    server.kill();
  }
});
