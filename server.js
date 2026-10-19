const http = require("http");
const fs = require("fs");
const path = require("path");

// Web version of WasherTimerView.swift, shown at "/washer"
const washerPage = fs.readFileSync(path.join(__dirname, "washer.html"), "utf8");

// Maintenance reports sent from the washer page (kept in memory for now,
// so they reset whenever Render restarts the server)
const reports = [];
const ISSUES = ["Won't start", "Leaking", "Won't drain", "Door stuck", "Other"];

// Same rules as validate() in WasherTimerView.swift
function validateReport(r) {
  const id = String(r.machineID || "").trim();
  const details = String(r.details || "").trim();
  if (!id) return "Please enter the machine number.";
  if (id.length > 10) return "Machine number is too long.";
  if (!ISSUES.includes(r.issue)) return "Please pick what's wrong.";
  if (r.issue === "Other" && !details) return "Please describe the problem.";
  if (details.length > 500) return "Description is too long.";
  return null;
}

const port = process.env.PORT || 3000;

// Web page shown at "/": a live board that reads from /machines
const boardPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DormWash Live Board</title>
  <style>
    :root {
      --bg: #f4f5f7; --card: #ffffff; --text: #16181d; --muted: #6b7280;
      --ring: #e5e7eb; --washing: #2563eb; --drying: #d97706; --done: #16a34a;
    }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #0f1115; --card: #1a1d23; --text: #f3f4f6; --muted: #9ca3af; --ring: #2c3038; }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; background: var(--bg); color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column; align-items: center; padding: 32px 16px;
    }
    h1 { margin: 0 0 4px; font-size: 28px; }
    .sub { color: var(--muted); margin: 0 0 28px; font-size: 14px; }
    .card {
      width: 100%; max-width: 360px; background: var(--card); border-radius: 24px;
      padding: 28px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,.08);
    }
    .ring { position: relative; width: 200px; height: 200px; margin: 0 auto 20px; }
    .ring svg { transform: rotate(-90deg); }
    .ring .inner {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
    }
    .time { font-size: 38px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .stage { font-weight: 600; margin-top: 4px; }
    .machine { font-size: 18px; font-weight: 600; }
    .status { color: var(--muted); font-size: 14px; margin-top: 4px; }
    .footer { color: var(--muted); font-size: 12px; margin-top: 20px; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; background: var(--muted); }
    .dot.live { background: var(--done); }
  </style>
</head>
<body>
  <h1>DormWash</h1>
  <p class="sub">Live laundry status</p>

  <div class="card">
    <div class="ring">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="88" fill="none" stroke="var(--ring)" stroke-width="12"/>
        <circle id="progress" cx="100" cy="100" r="88" fill="none" stroke="var(--drying)"
                stroke-width="12" stroke-linecap="round" stroke-dasharray="553" stroke-dashoffset="553"/>
      </svg>
      <div class="inner">
        <div class="time" id="time">--:--</div>
        <div class="stage" id="stage">Loading…</div>
      </div>
    </div>
    <div class="machine" id="machine">&nbsp;</div>
    <div class="status" id="status">&nbsp;</div>
  </div>

  <p class="footer"><span class="dot" id="dot"></span><span id="updated">Connecting…</span></p>

  <script>
    const CIRCUMFERENCE = 2 * Math.PI * 88;
    const colors = { Washing: "var(--washing)", Drying: "var(--drying)", Done: "var(--done)" };
    let remaining = 0, total = 2700, stage = "Drying", loaded = false;
    let cycleStart = 0;   // the moment (in ms) the current cycle showed 45:00

    // Work out the time left from the clock, so the countdown stays right
    // even if the browser pauses the page (background tab, sleep, etc.).
    // A cycle shows every second from 45:00 down to 0:00, then starts over.
    function timeLeft() {
      const period = total + 1;
      const elapsed = Math.floor((Date.now() - cycleStart) / 1000);
      return total - (((elapsed % period) + period) % period);
    }

    function render() {
      const m = String(Math.floor(remaining / 60)).padStart(2, "0");
      const s = String(remaining % 60).padStart(2, "0");
      document.getElementById("time").textContent = m + ":" + s;
      const shownStage = remaining === 0 ? "Done" : stage;
      const stageEl = document.getElementById("stage");
      stageEl.textContent = shownStage;
      stageEl.style.color = colors[shownStage] || "var(--text)";
      document.getElementById("status").textContent = shownStage === "Done" ? "Ready to pick up" : "In progress";
      const ring = document.getElementById("progress");
      ring.style.stroke = colors[shownStage] || "var(--washing)";
      ring.style.strokeDashoffset = CIRCUMFERENCE * (remaining / total);
    }

    async function load() {
      try {
        const res = await fetch("/machines");
        const data = await res.json();
        total = data.totalSeconds || 2700;
        cycleStart = Date.now() - (total - data.remainingSeconds) * 1000;
        remaining = timeLeft();
        stage = data.stage;
        loaded = true;
        document.getElementById("machine").textContent = data.machineName;
        document.getElementById("dot").className = "dot live";
        document.getElementById("updated").textContent = "Live · updated " + new Date().toLocaleTimeString();
        render();
      } catch (err) {
        document.getElementById("dot").className = "dot";
        document.getElementById("updated").textContent = "Can't reach server — retrying…";
      }
    }

    // Update the display a few times a second, re-sync with the server every
    // 30 seconds, and re-sync right away when you come back to the tab
    setInterval(() => {
      if (!loaded) return;
      const next = timeLeft();
      if (next !== remaining) { remaining = next; render(); }
    }, 250);
    setInterval(load, 30000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") load();
    });
    load();
  </script>
</body>
</html>`;

// Demo cycle: runs 45:00 down to 0:00, then starts over at 45:00.
// It's based on the clock, so every viewer sees the same time and
// a server restart doesn't reset it.
const CYCLE_SECONDS = 45 * 60;

function secondsLeftInCycle() {
  // CYCLE_SECONDS + 1 steps so both 45:00 and 0:00 are shown
  const elapsed = Math.floor(Date.now() / 1000) % (CYCLE_SECONDS + 1);
  return CYCLE_SECONDS - elapsed;
}

const server = http.createServer((req, res) => {
  if (req.url === "/machines" && req.method === "GET") {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify({
      machineName: "Dryer 3B",
      stage: "Drying",
      remainingSeconds: secondsLeftInCycle(),
      totalSeconds: CYCLE_SECONDS
    }));
    return;
  }

  if (req.url === "/status" && req.method === "GET") {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify({
      message: "DormWash server is running"
    }));
    return;
  }

  if (req.url === "/washer" && req.method === "GET") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.writeHead(200);
    res.end(washerPage);
    return;
  }

  if (req.url === "/reports" && req.method === "GET") {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify(reports));
    return;
  }

  if (req.url === "/reports" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 10000) req.destroy();   // ignore oversized requests
    });
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      let data;
      try { data = JSON.parse(body); } catch { data = null; }
      const problem = data ? validateReport(data) : "Invalid request.";
      if (problem) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: problem }));
        return;
      }
      const report = {
        id: reports.length + 1,
        machineID: data.machineID.trim(),
        issue: data.issue,
        details: String(data.details || "").trim(),
        createdAt: new Date().toISOString()
      };
      reports.push(report);
      res.writeHead(201);
      res.end(JSON.stringify(report));
    });
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.writeHead(200);
  res.end(boardPage);
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
