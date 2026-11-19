import fs from 'fs';
import zlib from 'zlib';

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

const crcTable = createCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writePng(width, height, isMaskable = false) {
  const rowSize = width * 4;
  const rawData = Buffer.alloc((rowSize + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowSize + 1);
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Dark slate background: #0f172a to #020617
      let r = 15;
      let g = 23;
      let b = 42;
      let a = 255;

      const cx = width / 2;
      const cy = height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Safe zone for maskable icons (80% circle)
      const maxR = (width / 2) * 0.75;

      // Draw a sleek stylized spreadsheet icon inside
      const gridLeft = cx - width * 0.3;
      const gridRight = cx + width * 0.3;
      const gridTop = cy - height * 0.3;
      const gridBottom = cy + height * 0.3;

      if (x >= gridLeft && x <= gridRight && y >= gridTop && y <= gridBottom) {
        // Table cell pattern
        const cellY = Math.floor((y - gridTop) / ((gridBottom - gridTop) / 4));
        const cellX = Math.floor((x - gridLeft) / ((gridRight - gridLeft) / 3));

        if (cellY === 0) {
          // Header row - Emerald / Indigo
          r = cellX === 0 ? 59 : cellX === 1 ? 2 : 16;
          g = cellX === 0 ? 130 : cellX === 1 ? 132 : 185;
          b = cellX === 0 ? 246 : cellX === 1 ? 199 : 129;
        } else {
          // Data row lines
          const isBorder = (x - gridLeft) % Math.floor((gridRight - gridLeft) / 3) <= 2 ||
                           (y - gridTop) % Math.floor((gridBottom - gridTop) / 4) <= 2;
          if (isBorder) {
            r = 71; g = 85; b = 105;
          } else {
            r = 30; g = 41; b = 59;
          }
        }
      }

      // Small accent spark in bottom right
      if (dist < maxR && dist > maxR - 4 && !isMaskable) {
        r = 16; g = 185; b = 129;
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // Build PNG chunks
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Deflate
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crcTarget = chunk.subarray(4, 8 + len);
  const crc = crc32(crcTarget);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// Generate files
fs.writeFileSync('public/pwa-192x192.png', writePng(192, 192, false));
fs.writeFileSync('public/pwa-512x512.png', writePng(512, 512, false));
fs.writeFileSync('public/pwa-maskable-512x512.png', writePng(512, 512, true));
fs.writeFileSync('public/apple-touch-icon.png', writePng(180, 180, false));
fs.writeFileSync('public/favicon.ico', writePng(32, 32, false));

console.log('Successfully generated all PWA PNG icons!');
