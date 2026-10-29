const http = require("http");
const fs = require("fs");
const path = require("path");

// Tabs added to the top of each page so you can switch between them.
// They hide themselves when a page is shown inside the "/all" screen.
const navBar = `
  <style>
    .dw-nav { display: flex; gap: 4px; padding: 4px; margin-bottom: 24px; border-radius: 999px;
      background: rgba(127,127,127,.14); font: 600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .dw-nav a { color: inherit; text-decoration: none; padding: 7px 14px; border-radius: 999px; opacity: .7; }
    .dw-nav a:hover { opacity: 1; }
    .dw-nav a.on { background: rgba(127,127,127,.28); opacity: 1; }
    .dw-embedded .dw-nav { display: none; }
  </style>
  <nav class="dw-nav"><a href="/">Dryer</a><a href="/washer">Washer</a><a href="/all">All</a></nav>
  <script>
    if (window.top !== window.self) document.documentElement.classList.add("dw-embedded");
    document.querySelectorAll(".dw-nav a").forEach(a => {
      if (a.getAttribute("href") === location.pathname) a.classList.add("on");
    });
  </script>`;

function withNav(html) {
  return html.replace("<body>", "<body>" + navBar);
}

// The web pages live in appComponents/ next to the Swift screens
const pagesDir = path.join(__dirname, "appComponents");

// Web version of WasherTimerView.swift, shown at "/washer"
const washerPage = withNav(fs.readFileSync(path.join(pagesDir, "washer.html"), "utf8"));

// Dryer page (a copy of the washer page, synced to the shared dryer cycle), shown at "/"
const dryerPage = withNav(fs.readFileSync(path.join(pagesDir, "dryer.html"), "utf8"));

// Dryer page, washer page and reports together, shown at "/all"
const allPage = withNav(fs.readFileSync(path.join(pagesDir, "all.html"), "utf8"));

// Maintenance reports sent from the washer and dryer pages (kept in memory for now,
// so they reset whenever Render restarts the server)
const reports = [];
const ISSUES = ["Won't start", "Leaking", "Won't drain", "Not heating", "Door stuck", "Other"];

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

  if (req.url === "/all" && req.method === "GET") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.writeHead(200);
    res.end(allPage);
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
  res.end(dryerPage);
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
