const http = require("http");

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
    let remaining = 0, total = 2700, stage = "Drying";

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
        remaining = data.remainingSeconds;
        total = data.totalSeconds || 2700;
        stage = data.stage;
        document.getElementById("machine").textContent = data.machineName;
        document.getElementById("dot").className = "dot live";
        document.getElementById("updated").textContent = "Live · updated " + new Date().toLocaleTimeString();
        render();
      } catch (err) {
        document.getElementById("dot").className = "dot";
        document.getElementById("updated").textContent = "Can't reach server — retrying…";
      }
    }

    // Count down every second, re-sync with the server every 30 seconds
    setInterval(() => { if (remaining > 0) { remaining--; render(); } }, 1000);
    setInterval(load, 30000);
    load();
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === "/machines" && req.method === "GET") {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify({
      machineName: "Dryer 3B",
      stage: "Drying",
      remainingSeconds: 1590,
      totalSeconds: 2700
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

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.writeHead(200);
  res.end(boardPage);
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
