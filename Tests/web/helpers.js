// Shared helpers for the web page tests (all.test.js, washer.test.js, dryer.test.js).
// Each test file starts its own copy of server.js on its own port, so the
// files can run at the same time without sharing reports.

const { spawn } = require("node:child_process");
const path = require("node:path");

const SERVER = path.join(__dirname, "..", "..", "server.js");

// Starts server.js on `port` and waits up to 10 seconds for it to answer.
// Returns { base, stop }.
async function startServer(port) {
  const server = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "ignore", "inherit"],
  });
  const base = `http://127.0.0.1:${port}`;

  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`${base}/status`);
      return { base, stop: () => server.kill() };
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  server.kill();
  throw new Error("server.js did not start");
}

async function getPage(base, route) {
  const res = await fetch(base + route);
  return { res, html: await res.text() };
}

function postReport(base, body) {
  return fetch(`${base}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// Pulls `function name(...) { ... }` out of a page's <script> so its logic can
// be tested here. `globals` are the page variables the function reads.
function pageFunction(html, name, globals = {}) {
  const start = html.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`function ${name} not found in page`);
  let depth = 0;
  let end = html.indexOf("{", start);
  for (; end < html.length; end++) {
    if (html[end] === "{") depth++;
    if (html[end] === "}" && --depth === 0) break;
  }
  const source = html.slice(start, end + 1);
  const names = Object.keys(globals);
  return new Function(...names, `${source}\nreturn ${name};`)(...Object.values(globals));
}

// The options in the page's "What's wrong?" dropdown.
function issueOptions(html) {
  const select = html.match(/<select id="issue">([\s\S]*?)<\/select>/);
  return [...select[1].matchAll(/<option>(.*?)<\/option>/g)].map((m) => m[1]);
}

module.exports = { startServer, getPage, postReport, pageFunction, issueOptions };
