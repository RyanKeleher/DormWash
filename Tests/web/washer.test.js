// Tests for the Washer page (appComponents/washer.html, shown at "/washer").
// Run with: npm test   (from the repo root)

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, getPage, postReport, pageFunction, issueOptions } = require("./helpers");

let server;
let html;

before(async () => {
  server = await startServer(4102);
  ({ html } = await getPage(server.base, "/washer"));
});

after(() => server && server.stop());

// ----- The page -----

test("GET /washer shows the washer page", async () => {
  const { res, html } = await getPage(server.base, "/washer");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  assert.match(html, /<h1>Washer #1 Status<\/h1>/);
});

test("washer page has the Dryer / Washer / All tabs", () => {
  assert.match(html, /<nav class="dw-nav">/);
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/washer"/);
  assert.match(html, /href="\/all"/);
});

test("washer page starts the timer at 45:00", () => {
  assert.match(html, /<div class="time" id="time">45:00<\/div>/);
});

test("washer reports are for machine W4", () => {
  assert.match(html, /Washer <span id="machineId">W4<\/span>/);
});

// ----- Timer -----

test("timeString formats seconds as MM:SS", () => {
  const timeString = pageFunction(html, "timeString");
  assert.equal(timeString(2700), "45:00");
  assert.equal(timeString(65), "01:05");
  assert.equal(timeString(0), "00:00");
});

test("Smart Cycle Prediction adds 5 minutes to the shown time", () => {
  assert.match(html, /ai\.checked \? timeRemaining \+ 300 : timeRemaining/);
});

// ----- Report a Problem form -----

test("washer issue list includes washer problems", () => {
  const issues = issueOptions(html);
  assert.deepEqual(issues, ["Won't start", "Leaking", "Won't drain", "Door stuck", "Other"]);
});

test("form validation matches the Swift rules", () => {
  const validate = pageFunction(html, "validate", { MAX_DETAILS: 500 });
  assert.equal(validate({ machineID: "W4", issue: "Leaking", details: "" }), null);
  assert.equal(validate({ machineID: "  ", issue: "Leaking", details: "" }), "Please enter the machine number.");
  assert.equal(validate({ machineID: "W".repeat(11), issue: "Leaking", details: "" }), "Machine number is too long.");
  assert.equal(validate({ machineID: "W4", issue: "Other", details: " " }), "Please describe the problem.");
  assert.equal(validate({ machineID: "W4", issue: "Other", details: "Smells like smoke" }), null);
  assert.equal(validate({ machineID: "W4", issue: "Leaking", details: "a".repeat(501) }), "Description is too long.");
});

test("the server accepts every issue the washer form offers", async () => {
  for (const issue of issueOptions(html)) {
    const res = await postReport(server.base, { machineID: "W4", issue, details: "Test report" });
    assert.equal(res.status, 201, `server rejected "${issue}"`);
  }
});

test("a washer report is saved and listed", async () => {
  const res = await postReport(server.base, { machineID: "W4", issue: "Won't drain", details: "Water left in the drum" });
  assert.equal(res.status, 201);
  const report = await res.json();
  assert.equal(report.machineID, "W4");
  assert.equal(report.issue, "Won't drain");

  const reports = await (await fetch(`${server.base}/reports`)).json();
  assert.ok(reports.some((r) => r.id === report.id));
});
