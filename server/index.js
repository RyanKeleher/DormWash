const express = require("express");
const app = express();
app.use(express.json());

// Temporary in-memory storage (swap for a database later)
const reports = [];

app.get("/", (req, res) => res.send("DormWash server is running"));

// Same rules as validate() in WasherTimerView.swift
const ISSUE_TYPES = ["Won't start", "Leaking", "Won't drain", "Door stuck", "Other"];
const MAX_MACHINE_ID_LENGTH = 10;
const MAX_DETAILS_LENGTH = 500;

// Counts characters the way a person would (emoji = 1), close to Swift's String.count
const charCount = (s) => [...s].length;

function validate(body) {
  const machineID = typeof body.machineID === "string" ? body.machineID.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";

  if (!machineID) return "Please enter the machine number.";
  if (charCount(machineID) > MAX_MACHINE_ID_LENGTH) return "Machine number is too long.";
  if (!ISSUE_TYPES.includes(body.issue)) return "Please choose what's wrong.";
  if (body.issue === "Other" && !details) return "Please describe the problem.";
  if (charCount(details) > MAX_DETAILS_LENGTH) return "Description is too long.";
  return null;
}

// The "Report a Problem" form sends here
app.post("/maintenance-requests", (req, res) => {
  const body = req.body || {};
  const error = validate(body);
  if (error) return res.status(400).json({ error });

  const report = {
    id: reports.length + 1,
    machineID: body.machineID.trim(),
    issue: body.issue,
    details: typeof body.details === "string" ? body.details.trim() : "",
    createdAt: new Date(),
  };
  reports.push(report);
  res.status(201).json(report);
});

app.get("/maintenance-requests", (req, res) => res.json(reports));

app.listen(process.env.PORT || 3000, () => console.log("Server started"));
