const http = require("http");
const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.resolve(__dirname, "../../output");
const SCRIPTS_AEP_DIR = path.resolve(__dirname, "../scripts/aep");
const AEP_TO_CURRENT_FRAME_AND_MP4_SH = path.resolve(__dirname, "../utils/aep_to_current_frame_and_mp4.sh");
const PORT = 3131;

const renderJobs = new Map(); // outputName → { status, stage, frameReady, framePath, outputName, log }

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".json": "application/json",
};

// SSE clients for auto-refresh
const sseClients = new Set();

function broadcastSse(data) {
  for (const res of sseClients) res.write(`data: ${data}\n\n`);
}

function updateRenderJob(outputName, patch) {
  const job = renderJobs.get(outputName);
  if (!job) return;
  Object.assign(job, patch);
  broadcastSse(`render-job:${outputName}`);
}

function appendRenderOutput(outputName, chunk) {
  const job = renderJobs.get(outputName);
  if (!job) return;

  const text = chunk.toString();
  job.log += text;

  let didChange = false;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const stageMatch = line.match(/^JOB_STAGE:\s*([a-z_]+)/);
    if (stageMatch) {
      job.stage = stageMatch[1];
      didChange = true;
    }
    if (/^JOB_FRAME_READY:\s*1/.test(line)) {
      job.frameReady = true;
      didChange = true;
    }
    const errorStageMatch = line.match(/^JOB_ERROR_STAGE:\s*([a-z_]+)/);
    if (errorStageMatch) {
      job.errorStage = errorStageMatch[1];
      didChange = true;
    }
  }

  if (didChange) broadcastSse(`render-job:${outputName}`);
}

fs.watch(OUTPUT_DIR, { persistent: true }, (_eventType, filename) => {
  if (!filename) return;
  const ext = path.extname(filename.toString());
  if (ext === ".mp4") {
    broadcastSse("refresh");
  }
});

if (fs.existsSync(SCRIPTS_AEP_DIR)) {
  fs.watch(SCRIPTS_AEP_DIR, { persistent: true }, (_eventType, filename) => {
    if (!filename) return;
    const ext = path.extname(filename.toString());
    if (ext === ".aep") {
      const aepPath = path.join(SCRIPTS_AEP_DIR, filename.toString());
      broadcastSse(`aep-changed:${aepPath}`);
    }
  });
}

// Watch index.html — send reload event to all clients on change
fs.watch(path.join(__dirname, "index.html"), () => {
  broadcastSse("dev-reload");
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

function parseRangeHeader(rangeHeader, fileSize) {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=") || fileSize <= 0) return null;
  const spec = rangeHeader.slice("bytes=".length).split(",")[0]?.trim();
  if (!spec) return null;

  const [rawStart, rawEnd] = spec.split("-");
  if (rawStart === undefined || rawEnd === undefined) return null;

  let start;
  let end;

  if (rawStart === "") {
    const suffixLength = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else {
    start = Number.parseInt(rawStart, 10);
    end = rawEnd ? Number.parseInt(rawEnd, 10) : fileSize - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  }

  if (start < 0 || start >= fileSize) return null;
  end = Math.min(end, fileSize - 1);
  if (end < start) return null;

  return { start, end };
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

  if (url.pathname === "/api/open-aep") {
    if (req.method !== "POST") {
      res.writeHead(405, { "Access-Control-Allow-Origin": "*" });
      res.end();
      return;
    }
    const name = path.basename(url.searchParams.get("name") || "");
    const file = path.join(OUTPUT_DIR, "aep", `${name}.aep`);
    if (!name || !fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ok: false, error: "AEP not found" }));
      return;
    }
    execFile("open", [file], err => {
      if (err) {
        res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ ok: false, error: "Failed to open AEP" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // API: list open AE projects (reads current project via JSX)
  if (url.pathname === "/api/open-projects") {
    const tmpOut = `/tmp/ae_open_projects_${Date.now()}.txt`;
    const tmpJsx = `/tmp/ae_open_projects_${Date.now()}.jsx`;
    const jsx = `(function(){var f=new File("${tmpOut}");f.open("w");if(app.project.file){f.writeln(app.project.file.fsName+"\\t"+app.project.file.name);}else{f.writeln("\\t");}f.close();})();`;
    fs.writeFileSync(tmpJsx, jsx);
    execFile("osascript", ["-e", `tell application "Adobe After Effects 2026" to DoScriptFile "${tmpJsx}"`], { timeout: 5000 }, (err) => {
      try { fs.unlinkSync(tmpJsx); } catch {}
      let projects = [];
      try {
        const lines = fs.readFileSync(tmpOut, "utf8").trim().split(/[\r\n]+/).filter(Boolean);
        try { fs.unlinkSync(tmpOut); } catch {}
        projects = lines.map(line => {
          const tab = line.indexOf("\t");
          const filePath = tab >= 0 ? line.slice(0, tab).trim() : "";
          const name = tab >= 0 ? line.slice(tab + 1).trim() : "";
          return filePath ? { path: filePath, name } : null;
        }).filter(Boolean);
      } catch {}
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(projects));
    });
    return;
  }

  // API: list comps in the currently open AE project
  if (url.pathname === "/api/open-project-comps") {
    const tmpOut = `/tmp/ae_comps_${Date.now()}.txt`;
    const tmpJsx = `/tmp/ae_comps_${Date.now()}.jsx`;
    const jsx = `(function(){var f=new File("${tmpOut}");f.open("w");for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);if(item instanceof CompItem){f.writeln(item.name);}}f.close();})();`;
    fs.writeFileSync(tmpJsx, jsx);
    execFile("osascript", ["-e", `tell application "Adobe After Effects 2026" to DoScriptFile "${tmpJsx}"`], { timeout: 5000 }, () => {
      try { fs.unlinkSync(tmpJsx); } catch {}
      let comps = [];
      try {
        comps = fs.readFileSync(tmpOut, "utf8").trim().split(/[\r\n]+/).filter(Boolean);
        try { fs.unlinkSync(tmpOut); } catch {}
      } catch {}
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(comps));
    });
    return;
  }

  // API: render an open AE project
  if (url.pathname === "/api/render-open") {
    if (req.method !== "POST") {
      res.writeHead(405, { "Access-Control-Allow-Origin": "*" });
      res.end();
      return;
    }
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      let aepPath, compName, outputName, frame;
      try {
        ({ aepPath, compName, outputName, frame } = JSON.parse(body));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ ok: false, error: "Bad JSON" }));
        return;
      }
      const frameNumber = Number.parseInt(frame, 10);
      if (!aepPath || !compName || !outputName || !Number.isFinite(frameNumber) || frameNumber < 0) {
        res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ ok: false, error: "Missing params" }));
        return;
      }
      // sanitise outputName — no path separators
      const safeName = path.basename(outputName).replace(/[^a-zA-Z0-9_\-]/g, "_");
      if (renderJobs.get(safeName)?.status === "running") {
        res.writeHead(409, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ ok: false, error: "Already rendering" }));
        return;
      }
      renderJobs.set(safeName, {
        status: "running",
        stage: "queued",
        frameReady: false,
        framePath: `/output/${safeName}_current_frame.png`,
        outputName: safeName,
        log: "",
        errorStage: "",
      });
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ok: true, outputName: safeName }));
      broadcastSse(`render-job:${safeName}`);
      const child = spawn(AEP_TO_CURRENT_FRAME_AND_MP4_SH, [aepPath, "--comp", compName, "--frame", String(frameNumber)], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      const appendLog = d => appendRenderOutput(safeName, d);
      child.stdout.on("data", appendLog);
      child.stderr.on("data", appendLog);
      child.on("close", code => {
        if (code === 0) {
          updateRenderJob(safeName, { status: "done", stage: "done", frameReady: false });
        } else {
          updateRenderJob(safeName, { status: "error", stage: "error" });
        }
        broadcastSse("refresh");
      });
    });
    return;
  }

  // API: poll render job status
  if (url.pathname === "/api/render-status") {
    const name = url.searchParams.get("name") || "";
    const job = renderJobs.get(name);
    if (!job) {
      res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ok: false, error: "Not found" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({
      ok: true,
      status: job.status,
      stage: job.stage,
      frameReady: !!job.frameReady,
      framePath: job.framePath,
      outputName: job.outputName,
      errorStage: job.errorStage,
      log: job.log,
    }));
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
      const parsedRange = parseRangeHeader(range, stat.size);
      if (!parsedRange) {
        res.writeHead(416, {
          "Content-Range": `bytes */${stat.size}`,
          "Accept-Ranges": "bytes",
        });
        res.end();
        return;
      }
      const { start, end } = parsedRange;
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
