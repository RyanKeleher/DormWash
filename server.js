const http = require("http");

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    message: "DormWash server is running"
  }));
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
