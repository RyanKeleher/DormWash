// Tests for the Dryer page (appComponents/dryer.html, shown at "/") and the
// shared dryer cycle it syncs to (/machines).
// Run with: npm test   (from the repo root)

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, getPage, postReport, pageFunction, issueOptions } = require("./helpers");

let server;
let html;

before(async () => {
  server = await startServer(4103);
  ({ html } = await getPage(server.base, "/"));
});

after(() => server && server.stop());

// ----- The page -----

test("GET / shows the dryer page", async () => {
  const { res, html } = await getPage(server.base, "/");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  assert.match(html, /<h1>Dryer 3B Status<\/h1>/);
});

test("unknown pages fall back to the dryer page", async () => {
  const { res, html } = await getPage(server.base, "/not-a-page");
  assert.equal(res.status, 200);
  assert.match(html, /Dryer 3B Status/);
});

test("dryer page has the Dryer / Washer / All tabs", () => {
  assert.match(html, /<nav class="dw-nav">/);
  assert.match(html, /href="\/all"/);
});

test("dryer reports are for machine 3B", () => {
  assert.match(html, /Dryer <span id="machineId">3B<\/span>/);
});

// ----- Shared dryer cycle -----

test("GET /machines returns the dryer's current cycle", async () => {
  const res = await fetch(`${server.base}/machines`);
  assert.equal(res.status, 200);
  const cycle = await res.json();
  assert.equal(cycle.machineName, "Dryer 3B");
  assert.equal(cycle.stage, "Drying");
  assert.equal(cycle.totalSeconds, 2700);
  assert.ok(cycle.remainingSeconds >= 0 && cycle.remainingSeconds <= 2700);
});

test("timeRemaining counts down from the synced cycle start", () => {
  const tenSecondsAgo = Date.now() - 10_000;
  const timeRemaining = pageFunction(html, "timeRemaining", { total: 2700, cycleStart: tenSecondsAgo });
  assert.equal(timeRemaining(), 2690);
});

test("timeRemaining starts over at 45:00 after the cycle ends", () => {
  const oneCycleAgo = Date.now() - 2701 * 1000;
  const timeRemaining = pageFunction(html, "timeRemaining", { total: 2700, cycleStart: oneCycleAgo });
  assert.equal(timeRemaining(), 2700);
});

test("timeString formats seconds as MM:SS", () => {
  const timeString = pageFunction(html, "timeString");
  assert.equal(timeString(2700), "45:00");
  assert.equal(timeString(125), "02:05");
});

// ----- Report a Problem form -----

test("dryer issue list includes dryer problems", () => {
  const issues = issueOptions(html);
  assert.deepEqual(issues, ["Won't start", "Not heating", "Door stuck", "Other"]);
});

test("the server accepts every issue the dryer form offers", async () => {
  for (const issue of issueOptions(html)) {
    const res = await postReport(server.base, { machineID: "3B", issue, details: "Test report" });
    assert.equal(res.status, 201, `server rejected "${issue}"`);
  }
});

test("a dryer report is saved and listed", async () => {
  const res = await postReport(server.base, { machineID: "3B", issue: "Not heating", details: "Clothes still wet" });
  assert.equal(res.status, 201);
  const report = await res.json();
  assert.equal(report.machineID, "3B");

  const reports = await (await fetch(`${server.base}/reports`)).json();
  assert.ok(reports.some((r) => r.id === report.id));
});
