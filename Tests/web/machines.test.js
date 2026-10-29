// Tests for the machine list: machines.js, GET /machines/all and the Hall page
// (appComponents/hall.html, shown at "/hall").
// Run with: npm test   (from the repo root)   or   npm run test:hall

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, getPage, pageFunction } = require("./helpers");
const {
  MACHINES, CYCLE_SECONDS, DONE_SECONDS, SCHEDULE_SECONDS,
  statusAt, getMachines, isValidMachine, summarize,
} = require("../../machines");

let server;
let html;

before(async () => {
  server = await startServer(4104);
  ({ html } = await getPage(server.base, "/hall"));
});

after(() => server && server.stop());

// A fixed moment to test against, so results don't depend on when tests run.
// 4,200,000 s is a whole number of schedules, so every machine is at its offset.
const T0 = SCHEDULE_SECONDS * 1000 * 1000;
const at = (seconds) => T0 + seconds * 1000;
const machine = (id) => MACHINES.find((m) => m.id === id);

// ----- The machine list -----

test("there are washers and dryers", () => {
  const types = new Set(getMachines(T0).map((m) => m.type));
  assert.deepEqual([...types].sort(), ["dryer", "washer"]);
});

test("machine ids are all different", () => {
  const ids = MACHINES.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every machine is valid at every minute of a full schedule", () => {
  for (let s = 0; s < SCHEDULE_SECONDS; s += 60) {
    for (const m of getMachines(at(s))) {
      assert.ok(isValidMachine(m), `${m.id} is invalid at ${s}s: ${JSON.stringify(m)}`);
    }
  }
});

test("at least one machine is always free", () => {
  for (let s = 0; s < SCHEDULE_SECONDS; s += 30) {
    assert.ok(summarize(getMachines(at(s))).free >= 1, `nothing free at ${s}s`);
  }
});

// ----- One machine's status over time -----

test("a machine goes running, then done, then free, then running again", () => {
  const w1 = machine("W1");
  assert.equal(statusAt(w1, at(0)).status, "running");
  assert.equal(statusAt(w1, at(CYCLE_SECONDS)).status, "done");
  assert.equal(statusAt(w1, at(CYCLE_SECONDS + DONE_SECONDS)).status, "free");
  assert.equal(statusAt(w1, at(SCHEDULE_SECONDS)).status, "running");
});

test("a running machine counts down one second per second", () => {
  const w1 = machine("W1");
  assert.equal(statusAt(w1, at(0)).remainingSeconds, CYCLE_SECONDS);
  assert.equal(statusAt(w1, at(10)).remainingSeconds, CYCLE_SECONDS - 10);
});

test("free and done machines have no countdown", () => {
  const w1 = machine("W1");
  assert.equal(statusAt(w1, at(CYCLE_SECONDS)).remainingSeconds, undefined);
  assert.equal(statusAt(w1, at(CYCLE_SECONDS + DONE_SECONDS)).remainingSeconds, undefined);
});

test("Dryer 3B is always running", () => {
  for (let s = 0; s < SCHEDULE_SECONDS; s += 60) {
    assert.equal(statusAt(machine("3B"), at(s)).status, "running");
  }
});

// ----- isValidMachine -----

test("isValidMachine accepts a good running machine", () => {
  assert.ok(isValidMachine({ id: "W9", name: "Washer 9", type: "washer", status: "running", remainingSeconds: 60, totalSeconds: 2700 }));
});

test("isValidMachine rejects an unknown status", () => {
  assert.equal(isValidMachine({ id: "W9", name: "Washer 9", type: "washer", status: "broken" }), false);
});

test("isValidMachine rejects an unknown type", () => {
  assert.equal(isValidMachine({ id: "X1", name: "Oven", type: "oven", status: "free" }), false);
});

test("isValidMachine rejects a missing id or name", () => {
  assert.equal(isValidMachine({ id: "", name: "Washer 9", type: "washer", status: "free" }), false);
  assert.equal(isValidMachine({ id: "W9", name: "  ", type: "washer", status: "free" }), false);
});

test("isValidMachine rejects a running machine without a valid countdown", () => {
  assert.equal(isValidMachine({ id: "W9", name: "Washer 9", type: "washer", status: "running" }), false);
  assert.equal(isValidMachine({ id: "W9", name: "Washer 9", type: "washer", status: "running", remainingSeconds: -5, totalSeconds: 2700 }), false);
  assert.equal(isValidMachine({ id: "W9", name: "Washer 9", type: "washer", status: "running", remainingSeconds: 3000, totalSeconds: 2700 }), false);
});

test("isValidMachine rejects things that aren't machines", () => {
  assert.equal(isValidMachine(null), false);
  assert.equal(isValidMachine("W1"), false);
});

// ----- summarize -----

test("summarize counts free, running and done machines", () => {
  const list = [{ status: "free" }, { status: "running" }, { status: "running" }, { status: "done" }];
  assert.deepEqual(summarize(list), { free: 1, running: 2, done: 1 });
});

test("summarize of an empty list is all zeros", () => {
  assert.deepEqual(summarize([]), { free: 0, running: 0, done: 0 });
});

// ----- GET /machines/all -----

test("GET /machines/all returns every machine as JSON", async () => {
  const res = await fetch(`${server.base}/machines/all`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/json/);
  const list = await res.json();
  assert.equal(list.length, MACHINES.length);
  for (const m of list) assert.ok(isValidMachine(m), `bad machine from server: ${JSON.stringify(m)}`);
});

test("Dryer 3B in the list matches the Dryer page's timer", async () => {
  const list = await (await fetch(`${server.base}/machines/all`)).json();
  const cycle = await (await fetch(`${server.base}/machines`)).json();
  const dryer = list.find((m) => m.id === "3B");
  assert.ok(Math.abs(dryer.remainingSeconds - cycle.remainingSeconds) <= 1);
});

// ----- The Hall page -----

test("GET /hall shows the laundry room page", async () => {
  const { res, html } = await getPage(server.base, "/hall");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  assert.match(html, /<h1>Laundry Room<\/h1>/);
});

test("Hall page reads from /machines/all", () => {
  assert.match(html, /fetch\("\/machines\/all"\)/);
});

test("every page has the Hall tab", async () => {
  for (const route of ["/", "/washer", "/hall", "/all"]) {
    const { html } = await getPage(server.base, route);
    assert.match(html, /<a href="\/hall">Hall<\/a>/, `no Hall tab on ${route}`);
  }
});

test("timeString formats the countdown as MM:SS", () => {
  const timeString = pageFunction(html, "timeString");
  assert.equal(timeString(2700), "45:00");
  assert.equal(timeString(65), "01:05");
  assert.equal(timeString(0), "00:00");
});

test("secondsLeft counts down from when the list was loaded, and stops at 0", () => {
  const syncedAt = 1_000_000;
  const secondsLeft = pageFunction(html, "secondsLeft", { syncedAt });
  const m = { remainingSeconds: 100 };
  assert.equal(secondsLeft(m, syncedAt), 100);
  assert.equal(secondsLeft(m, syncedAt + 30_000), 70);
  assert.equal(secondsLeft(m, syncedAt + 500_000), 0);
});

test("escapeHtml makes machine names safe to show", () => {
  const escapeHtml = pageFunction(html, "escapeHtml");
  assert.equal(escapeHtml('<b>"W1"</b>'), "&lt;b&gt;&quot;W1&quot;&lt;/b&gt;");
});
