const http = require("http");

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/machines" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify({
      machineName: "Washer 3B",
      stage: "Washing",
      remainingSeconds: 1590
    }));
    return;
  }

  res.writeHead(200);
  res.end(JSON.stringify({
    message: "DormWash server is running"
  }));
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
