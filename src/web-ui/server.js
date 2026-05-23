const http = require("http");
const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.resolve(__dirname, "../../output");
const PORT = 3131;

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".mp4": "video/mp4",
  ".json": "application/json",
};

// SSE clients for auto-refresh
const sseClients = new Set();

fs.watch(OUTPUT_DIR, { persistent: true }, () => {
  for (const res of sseClients) {
    res.write("data: refresh\n\n");
  }
});

function getVideoPairs() {
  const files = fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR) : [];
  const lasts = new Set();
  const refs = new Set();

  for (const f of files) {
    if (f.endsWith("_last.mp4")) lasts.add(f.replace("_last.mp4", ""));
    if (f.endsWith("_ref.mp4")) refs.add(f.replace("_ref.mp4", ""));
  }

  const pairs = [];
  for (const name of lasts) {
    if (refs.has(name)) pairs.push(name);
  }
  return pairs.sort();
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // SSE endpoint
  if (url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(": connected\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  // API: list pairs
  if (url.pathname === "/api/pairs") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(getVideoPairs()));
    return;
  }

  // Serve video files
  if (url.pathname.startsWith("/output/")) {
    const file = path.join(OUTPUT_DIR, path.basename(url.pathname));
    if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    const stat = fs.statSync(file);
    const ext = path.extname(file);
    const range = req.headers.range;
    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": MIME[ext] || "application/octet-stream",
      });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Content-Length": stat.size });
      fs.createReadStream(file).pipe(res);
    }
    return;
  }

  // Serve index.html for everything else
  const indexFile = path.join(__dirname, "index.html");
  res.writeHead(200, { "Content-Type": "text/html" });
  fs.createReadStream(indexFile).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Web UI → http://localhost:${PORT}`);
});
