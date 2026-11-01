import { deflateSync } from 'node:zlib';

/**
 * Tiny original PNG generator for test fixtures (no third-party assets).
 * Produces valid 8-bit RGB PNGs of arbitrary size/color.
 */
export function makePng(width: number, height: number, rgb: [number, number, number]): Uint8Array {
  const crcTable = getCrcTable();
  function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (const b of bytes) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ b) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type: string, data: Uint8Array): number[] {
    const typeBytes = [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)];
    const out = [
      (data.length >>> 24) & 255,
      (data.length >>> 16) & 255,
      (data.length >>> 8) & 255,
      data.length & 255,
      ...typeBytes
    ];
    const crc = crc32(new Uint8Array([...typeBytes, ...data]));
    out.push((crc >>> 24) & 255, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255);
    return [...out, ...Array.from(data)];
  }

  const ihdr = [
    (width >>> 24) & 255,
    (width >>> 16) & 255,
    (width >>> 8) & 255,
    width & 255,
    (height >>> 24) & 255,
    (height >>> 16) & 255,
    (height >>> 8) & 255,
    height & 255,
    8, // bit depth
    2, // color type: RGB
    0, 0, 0
  ];

  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      raw[rowStart + 1 + x * 3] = rgb[0];
      raw[rowStart + 2 + x * 3] = rgb[1];
      raw[rowStart + 3 + x * 3] = rgb[2];
    }
  }

  const bytes = [
    137, 80, 78, 71, 13, 10, 26, 10,
    ...chunk('IHDR', new Uint8Array(ihdr)),
    ...chunk('IDAT', deflateSync(raw)),
    ...chunk('IEND', new Uint8Array([]))
  ];
  return new Uint8Array(bytes);
}

let table: Uint32Array | null = null;
function getCrcTable(): Uint32Array {
  if (table) return table;
  table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let j = 0; j < 8; j++) {
      value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
}
