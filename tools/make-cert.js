/* Self-signed cert covering this machine's LAN IPs, so the phone
   gets a secure context (service worker + Add to Home Screen).
   iOS will still warn once; accept it, then install the profile
   under Settings > General > VPN & Device Management if you want
   the warning gone for good.
       node tools/make-cert.js                                    */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "certs");

const CANDIDATES = [
  "C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe",
  "C:\\Program Files\\Git\\usr\\bin\\openssl.exe",
  "openssl"
];
const openssl = CANDIDATES.find(p => {
  try { execFileSync(p, ["version"], { stdio: "ignore" }); return true; } catch (e) { return false; }
});
if (!openssl) {
  console.error("openssl not found. Install Git for Windows, or run serve.js over plain HTTP.");
  process.exit(1);
}

const ips = [];
const nets = os.networkInterfaces();
for (const name in nets)
  for (const n of nets[name])
    if (n.family === "IPv4" && !n.internal) ips.push(n.address);

const alt = ["DNS:localhost", "IP:127.0.0.1"].concat(ips.map(ip => "IP:" + ip)).join(",");

fs.mkdirSync(OUT, { recursive: true });
const cnf = path.join(OUT, "openssl.cnf");
fs.writeFileSync(cnf, [
  "[req]",
  "distinguished_name=dn",
  "x509_extensions=ext",
  "prompt=no",
  "[dn]",
  "CN=cat-pda.local",
  "O=JOUST ELECTRONICS",
  "[ext]",
  "subjectAltName=" + alt,
  "basicConstraints=CA:FALSE",
  "keyUsage=digitalSignature,keyEncipherment",
  "extendedKeyUsage=serverAuth"
].join("\n"));

execFileSync(openssl, [
  "req", "-x509", "-nodes", "-newkey", "rsa:2048",
  "-keyout", path.join(OUT, "key.pem"),
  "-out", path.join(OUT, "cert.pem"),
  "-days", "825", "-config", cnf
], { stdio: "inherit" });

console.log("\n  certs/ written for: " + alt);
console.log("  now run:  node serve.js\n");
