import { deflateSync } from 'node:zlib';
import fs from 'node:fs';

/** Minimal RGB PNG encoder for the Deal With It app icons. */
function crc32(bytes) {
  let table = null;
  if (!crc32.table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let value = i;
      for (let j = 0; j < 8; j++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
      table[i] = value >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = (crc >>> 8) ^ crc32.table[(crc ^ b) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function encodePng(width, height, rgb) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0;
    rgb.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function renderLogo(size) {
  const pixels = Buffer.alloc(size * size * 3);
  const bg = [47, 111, 94]; // brand green
  const backCard = [200, 193, 178];
  const frontCard = [242, 234, 217];
  const dot = [47, 111, 94];

  const cardW = size * 0.34;
  const cardH = size * 0.46;

  const insideRect = (px, py, cx, cy, angle, w, h) => {
    const dx = px - cx;
    const dy = py - cy;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    return Math.abs(u) <= w / 2 && Math.abs(v) <= h / 2;
  };

  const deg = (d) => (d * Math.PI) / 180;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 3;
      let color = bg;
      if (insideRect(x + 0.5, y + 0.5, size * 0.42, size * 0.54, deg(14), cardW, cardH)) {
        color = backCard;
      }
      if (insideRect(x + 0.5, y + 0.5, size * 0.58, size * 0.44, deg(-8), cardW, cardH)) {
        color = frontCard;
        // small accent dot near the center of the front card
        const cx = size * 0.58;
        const cy = size * 0.44;
        const r = size * 0.06;
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) color = dot;
      }
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
    }
  }
  return pixels;
}

fs.mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) {
  const png = encodePng(size, size, renderLogo(size));
  fs.writeFileSync(`public/icons/icon-${size}.png`, png);
  console.log(`Wrote public/icons/icon-${size}.png (${png.length} bytes)`);
}
console.log('Icons generated.');
