// Tests for the All page (appComponents/all.html, shown at "/all"): the dryer,
// the washer and the maintenance reports on one screen.
// Run with: npm test   (from the repo root)

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, getPage, postReport, pageFunction } = require("./helpers");

let server;
let html;

before(async () => {
  server = await startServer(4101);
  ({ html } = await getPage(server.base, "/all"));
});

after(() => server && server.stop());

// ----- The page -----

test("GET /all shows the All Machines page", async () => {
  const { res, html } = await getPage(server.base, "/all");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  assert.match(html, /<title>.*All Machines<\/title>/);
});

test("all page has the Dryer / Washer / All tabs", () => {
  assert.match(html, /<nav class="dw-nav">/);
  assert.match(html, /href="\/all"/);
});

test("all page embeds the dryer and washer pages", () => {
  assert.match(html, /<iframe src="\/" title="Dryer page">/);
  assert.match(html, /<iframe src="\/washer" title="Washer page">/);
});

test("the embedded pages load", async () => {
  for (const route of ["/", "/washer"]) {
    const { res } = await getPage(server.base, route);
    assert.equal(res.status, 200, `${route} did not load`);
  }
});

test("all page has a maintenance reports panel", () => {
  assert.match(html, /Maintenance reports/);
  assert.match(html, /id="reports"/);
  assert.match(html, /fetch\("\/reports"\)/);
});

// ----- Reports shown on the page -----

test("GET /reports returns a list", async () => {
  const res = await fetch(`${server.base}/reports`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(await res.json()));
});

test("reports from both machines show up in the list", async () => {
  await postReport(server.base, { machineID: "W4", issue: "Leaking", details: "" });
  await postReport(server.base, { machineID: "3B", issue: "Not heating", details: "" });

  const reports = await (await fetch(`${server.base}/reports`)).json();
  assert.ok(reports.some((r) => r.machineID === "W4" && r.issue === "Leaking"));
  assert.ok(reports.some((r) => r.machineID === "3B" && r.issue === "Not heating"));
});

test("report text is escaped before it's shown", () => {
  const escapeHtml = pageFunction(html, "escapeHtml");
  assert.equal(escapeHtml("<script>alert('hi')</script>"), "&lt;script&gt;alert(&#39;hi&#39;)&lt;/script&gt;");
  assert.equal(escapeHtml('Tom & "Jerry"'), "Tom &amp; &quot;Jerry&quot;");
});

test("saved reports are trimmed", async () => {
  const res = await postReport(server.base, { machineID: "  W4  ", issue: "Other", details: "  Loud banging  " });
  assert.equal(res.status, 201);
  const report = await res.json();
  assert.equal(report.machineID, "W4");
  assert.equal(report.details, "Loud banging");
});

// ----- Bad reports are rejected -----

test("bad reports are rejected with a message", async () => {
  const cases = [
    [{ machineID: "", issue: "Leaking" }, "Please enter the machine number."],
    [{ machineID: "W".repeat(11), issue: "Leaking" }, "Machine number is too long."],
    [{ machineID: "W4", issue: "Exploded" }, "Please pick what's wrong."],
    [{ machineID: "W4", issue: "Other", details: " " }, "Please describe the problem."],
    [{ machineID: "W4", issue: "Leaking", details: "a".repeat(501) }, "Description is too long."],
    ["not json", "Invalid request."],
  ];
  for (const [body, message] of cases) {
    const res = await postReport(server.base, body);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, message);
  }
});
