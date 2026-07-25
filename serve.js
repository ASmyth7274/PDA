/* Static server for putting the unit on the phone.
   HTTPS if certs/ exists (required for the service worker and
   Add-to-Home-Screen over LAN), plain HTTP otherwise.
       node serve.js            -> http://<lan-ip>:8080
       node tools/make-cert.js  -> then HTTPS on :8443            */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = __dirname;
const CERT_DIR = path.join(ROOT, "certs");
const useTLS = fs.existsSync(path.join(CERT_DIR, "cert.pem")) &&
               fs.existsSync(path.join(CERT_DIR, "key.pem"));
const PORT = Number(process.env.PORT) || (useTLS ? 8443 : 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".css": "text/css; charset=utf-8",
  ".md": "text/plain; charset=utf-8"
};

function handler(req, res) {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const file = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ""));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end("no"); return; }

  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }).end("404"); return; }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      /* never let the phone cache the shell - the SW handles offline */
      "Cache-Control": "no-store",
      "Service-Worker-Allowed": "/"
    });
    res.end(buf);
  });
}

const server = useTLS
  ? https.createServer({
      key: fs.readFileSync(path.join(CERT_DIR, "key.pem")),
      cert: fs.readFileSync(path.join(CERT_DIR, "cert.pem"))
    }, handler)
  : http.createServer(handler);

server.listen(PORT, "0.0.0.0", () => {
  const proto = useTLS ? "https" : "http";
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name in nets)
    for (const n of nets[name])
      if (n.family === "IPv4" && !n.internal) ips.push(n.address);

  console.log("\n  C.A.T. PDA served over " + proto.toUpperCase() + "\n");
  console.log("    " + proto + "://localhost:" + PORT);
  ips.forEach(ip => console.log("    " + proto + "://" + ip + ":" + PORT + "   <- on the iPhone"));
  if (!useTLS) {
    console.log("\n  NOTE: plain HTTP. The service worker (offline mode) will NOT");
    console.log("        register over a LAN IP. Run `node tools/make-cert.js`");
    console.log("        for HTTPS if you want offline + Add to Home Screen.\n");
  }
});
