/* Generates the unit's app icons.
   Reuses the GLYPH table straight out of index.html so the icon
   type can never drift from the firmware's typeface.
   Run:  node tools/make-icons.js                                  */
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const ROOT = path.join(__dirname, "..");

/* ---- pull the 5x7 font out of the app ------------------------- */
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const mGl = html.match(/const GLYPH = \{[\s\S]*?\n\};/);
if (!mGl) throw new Error("GLYPH table not found in index.html");
const GLYPH = eval("(" + mGl[0].replace(/^const GLYPH = /, "").replace(/;$/, "") + ")");
const GW = 5, GH = 7;

/* ---- minimal PNG writer (RGBA, filter 0) ---------------------- */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return buf => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 6;      // truecolour + alpha
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;                        // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/* ---- a tiny raster surface ------------------------------------ */
function surface(w, h) {
  const buf = Buffer.alloc(w * h * 4);
  const px = (x, y, c) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c.length > 3 ? c[3] : 255;
  };
  const rect = (x, y, rw, rh, c) => {
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) px(x + i, y + j, c);
  };
  const text = (s, x, y, cell, c) => {
    s = String(s).toUpperCase();
    for (let n = 0; n < s.length; n++) {
      const g = GLYPH[s[n]] || GLYPH["?"];
      for (let r = 0; r < GH; r++)
        for (let col = 0; col < GW; col++)
          if ((g[r] >> (GW - 1 - col)) & 1)
            rect(x + (n * (GW + 1) + col) * cell, y + r * cell, cell, cell, c);
    }
    return s.length * (GW + 1) * cell - cell;
  };
  return { buf, px, rect, text };
}

const OLIVE = [0x00, 0x00, 0x00];   /* panel base */
const LITE  = [0xff, 0xff, 0xff];   /* light band */
const INK   = [0x00, 0x00, 0x00];   /* text plate */

/* The icon is the panel itself: olive field, the signature light
   stripes, and the unit's initials. Content is kept inside the
   middle 80% so maskable/rounded crops never clip it.            */
function icon(size) {
  const s = surface(size, size);
  s.rect(0, 0, size, size, OLIVE);

  const band = Math.max(2, Math.round(size / 14));
  for (let y = 0; y < size; y += band * 2) s.rect(0, y, size, band, LITE);

  // One recessed plate carrying both lines, so the type never has to
  // sit on a stripe boundary (black-on-black would vanish).
  const cell = Math.max(1, Math.round(size / 34));
  const c2   = Math.max(1, Math.round(size / 64));
  const l1 = "CAT", l2 = "P.D.A.";
  const tw1 = l1.length * (GW + 1) * cell - cell, th1 = GH * cell;
  const tw2 = l2.length * (GW + 1) * c2 - c2,     th2 = GH * c2;

  const plateW = Math.max(tw1, tw2) + cell * 6;
  const plateH = th1 + th2 + cell * 3 + cell * 6;
  const plateX = Math.round((size - plateW) / 2);
  const plateY = Math.round((size - plateH) / 2);
  s.rect(plateX, plateY, plateW, plateH, INK);

  s.text(l1, Math.round((size - tw1) / 2), plateY + cell * 3, cell, LITE);
  s.text(l2, Math.round((size - tw2) / 2), plateY + cell * 3 + th1 + cell * 3, c2, LITE);

  return png(size, size, s.buf);
}

[192, 512, 180, 1024].forEach(sz => {
  const name = sz === 180 ? "icon-180.png" : `icon-${sz}.png`;
  fs.writeFileSync(path.join(ROOT, name), icon(sz));
  console.log("wrote", name);
});
