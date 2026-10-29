// Machines in the laundry room and their current status.
// Used by GET /machines/all and the Hall page (appComponents/hall.html).
//
// Each machine's status comes from the clock, like the dryer timer: it repeats
// a demo schedule (running, then done waiting for pickup, then free), and each
// machine starts at a different point in it. So every viewer sees the same
// thing, and a server restart doesn't reset anything.

const STATUSES = ["free", "running", "done"];
const TYPES = ["washer", "dryer"];

const CYCLE_SECONDS = 45 * 60;  // one wash or dry
const DONE_SECONDS = 10 * 60;   // finished, waiting for pickup
const FREE_SECONDS = 15 * 60;   // empty and ready to use
const SCHEDULE_SECONDS = CYCLE_SECONDS + DONE_SECONDS + FREE_SECONDS;

// `offset` spreads the machines 700 seconds apart through the schedule, so
// there's always a mix of statuses and at least one machine is free.
// Dryer 3B is the dryer on the Dryer page: it is always running and shares
// that page's cycle (see secondsLeftInCycle in server.js).
const MACHINES = [
  { id: "W1", name: "Washer 1", type: "washer", offset: 0 },
  { id: "W2", name: "Washer 2", type: "washer", offset: 700 },
  { id: "W3", name: "Washer 3", type: "washer", offset: 1400 },
  { id: "W4", name: "Washer 4", type: "washer", offset: 2100 },
  { id: "D1", name: "Dryer 1", type: "dryer", offset: 2800 },
  { id: "D2", name: "Dryer 2", type: "dryer", offset: 3500 },
  { id: "3B", name: "Dryer 3B", type: "dryer", alwaysRunning: true },
];

// A machine's status at time `nowMs` (milliseconds, like Date.now()).
function statusAt(machine, nowMs = Date.now()) {
  const { id, name, type } = machine;
  const t = Math.floor(nowMs / 1000);

  if (machine.alwaysRunning) {
    // Same formula as the Dryer page: 45:00 down to 0:00, then repeat
    const remainingSeconds = CYCLE_SECONDS - (t % (CYCLE_SECONDS + 1));
    return { id, name, type, status: "running", remainingSeconds, totalSeconds: CYCLE_SECONDS };
  }

  const position = (t + machine.offset) % SCHEDULE_SECONDS;
  if (position < CYCLE_SECONDS) {
    return { id, name, type, status: "running", remainingSeconds: CYCLE_SECONDS - position, totalSeconds: CYCLE_SECONDS };
  }
  if (position < CYCLE_SECONDS + DONE_SECONDS) {
    return { id, name, type, status: "done" };
  }
  return { id, name, type, status: "free" };
}

// Every machine's status at time `nowMs`.
function getMachines(nowMs = Date.now()) {
  return MACHINES.map((m) => statusAt(m, nowMs));
}

// True if a machine has everything the Hall page needs.
function isValidMachine(m) {
  if (!m || typeof m !== "object") return false;
  if (typeof m.id !== "string" || !m.id.trim()) return false;
  if (typeof m.name !== "string" || !m.name.trim()) return false;
  if (!TYPES.includes(m.type)) return false;
  if (!STATUSES.includes(m.status)) return false;
  if (m.status === "running") {
    if (!Number.isInteger(m.remainingSeconds) || m.remainingSeconds < 0) return false;
    if (!Number.isInteger(m.totalSeconds) || m.remainingSeconds > m.totalSeconds) return false;
  }
  return true;
}

// How many machines are free, running and done.
function summarize(list) {
  const summary = { free: 0, running: 0, done: 0 };
  for (const m of list) {
    if (m.status in summary) summary[m.status]++;
  }
  return summary;
}

module.exports = {
  STATUSES, TYPES, CYCLE_SECONDS, DONE_SECONDS, FREE_SECONDS, SCHEDULE_SECONDS,
  MACHINES, statusAt, getMachines, isValidMachine, summarize,
};
