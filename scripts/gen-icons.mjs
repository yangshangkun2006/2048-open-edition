// Generates all PWA PNG icons without dependencies: manual PNG encoding
// (zlib + CRC32) and a tiny 5×7 bitmap font for the digits 2/0/4/8.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- PNG encoding ---------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter none
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Bitmap digits (5×7) ---------------------------------------------------

const GLYPHS = {
  2: ['111', '001', '001', '111', '100', '100', '111'],
  0: ['111', '101', '101', '101', '101', '101', '111'],
  4: ['001', '011', '101', '111', '001', '001', '001'],
  8: ['111', '101', '101', '111', '101', '101', '111'],
};

const GOLD = [0xed, 0xc2, 0x2e, 0xff];
const INK = [0x3a, 0x2e, 0x12, 0xff];
const BEIGE = [0xfa, 0xf8, 0xef, 0xff];

function fillRect(rgba, w, x0, y0, rw, rh, color) {
  for (let y = y0; y < y0 + rh; y++) {
    for (let x = x0; x < x0 + rw; x++) {
      const i = (y * w + x) * 4;
      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = color[3];
    }
  }
}

function drawText(rgba, w, text, cx, cy, glyphPx, color) {
  const glyphW = 3;
  const glyphH = 7;
  const spacing = glyphPx;
  const totalW = text.length * glyphW * glyphPx + (text.length - 1) * spacing;
  let x0 = Math.round(cx - totalW / 2);
  const y0 = Math.round(cy - (glyphH * glyphPx) / 2);
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) throw new Error(`no glyph for ${ch}`);
    for (let gy = 0; gy < glyphH; gy++) {
      for (let gx = 0; gx < glyphW; gx++) {
        if (g[gy][gx] === '1') {
          fillRect(rgba, w, x0 + gx * glyphPx, y0 + gy * glyphPx, glyphPx, glyphPx, color);
        }
      }
    }
    x0 += glyphW * glyphPx + spacing;
  }
}

function makeIcon(size, opts = {}) {
  const { maskable = false, bg = GOLD, fg = INK } = opts;
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = bg[0];
    rgba[i * 4 + 1] = bg[1];
    rgba[i * 4 + 2] = bg[2];
    rgba[i * 4 + 3] = bg[3];
  }
  const fit = maskable ? 0.66 : 0.62;
  const glyphPx = Math.max(1, Math.floor((size * fit) / 24));
  drawText(rgba, size, '2048', Math.round(size / 2), Math.round(size / 2), glyphPx, fg);
  return encodePng(size, size, rgba);
}

function makeOg() {
  const w = 1200;
  const h = 630;
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = BEIGE[0];
    rgba[i * 4 + 1] = BEIGE[1];
    rgba[i * 4 + 2] = BEIGE[2];
    rgba[i * 4 + 3] = BEIGE[3];
  }
  const tile = 420;
  const tx = Math.round((w - tile) / 2);
  const ty = Math.round((h - tile) / 2);
  const radius = 48;
  for (let y = ty; y < ty + tile; y++) {
    for (let x = tx; x < tx + tile; x++) {
      const dx = Math.max(tx + radius - x, x - (tx + tile - radius), 0);
      const dy = Math.max(ty + radius - y, y - (ty + tile - radius), 0);
      if (dx * dx + dy * dy > radius * radius) continue;
      const i = (y * w + x) * 4;
      rgba[i] = GOLD[0];
      rgba[i + 1] = GOLD[1];
      rgba[i + 2] = GOLD[2];
      rgba[i + 3] = GOLD[3];
    }
  }
  const glyphPx = Math.floor((tile * 0.6) / 24);
  drawText(rgba, w, '2048', Math.round(w / 2), Math.round(h / 2), glyphPx, INK);
  return encodePng(w, h, rgba);
}

// ---- Output ------------------------------------------------------------------

const out = [
  ['public/icons/icon-192.png', makeIcon(192)],
  ['public/icons/icon-512.png', makeIcon(512)],
  ['public/icons/icon-maskable-512.png', makeIcon(512, { maskable: true })],
  ['public/icons/apple-touch-icon-180.png', makeIcon(180)],
  ['public/og-1200x630.png', makeOg()],
];

for (const [rel, buf] of out) {
  const abs = join(ROOT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, buf);
  console.log(`${rel}  ${buf.length} bytes`);
}
