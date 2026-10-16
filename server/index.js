const express = require("express");
const app = express();
app.use(express.json());

// Temporary in-memory storage (swap for a database later)
const reports = [];

app.get("/", (req, res) => res.send("DormWash server is running"));

// Your "Report a Problem" form will send here
app.post("/maintenance-requests", (req, res) => {
  const { machineID, issue, details } = req.body;
  if (!machineID) return res.status(400).json({ error: "Please enter the machine number." });
  const report = { id: reports.length + 1, machineID, issue, details, createdAt: new Date() };
  reports.push(report);
  res.status(201).json(report);
});

app.get("/maintenance-requests", (req, res) => res.json(reports));

app.listen(process.env.PORT || 3000, () => console.log("Server started"));
