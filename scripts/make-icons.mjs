// Genera los íconos de la app instalable (public/icons/*.png) a partir del mismo pixel art del
// favicon de index.html: el personaje con gorro azul sobre fondo azul noche.
//   node scripts/make-icons.mjs
// Sin dependencias: escribe los PNG a mano (zlib viene con Node).
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x1c, 0x2a, 0x48];
/** Grilla de 16×16 del favicon: [x, y, ancho, alto, color]. */
const SPRITE = [
  [3, 3, 10, 3, [0x2f, 0x6f, 0xd0]], // gorro
  [4, 6, 8, 4, [0xf0, 0xc8, 0xa0]], // cara
  [4, 10, 8, 4, [0xe0, 0x50, 0x50]], // polera
];
/** Ojos (no están en el favicon: a este tamaño se notan). */
const EYES = [
  [6, 7, 1, 1, [0x2a, 0x24, 0x33]],
  [9, 7, 1, 1, [0x2a, 0x24, 0x33]],
];

/**
 * `size` px de lado; el sprite ocupa `fill` del ancho (los íconos "maskable" dejan margen porque el
 * sistema los recorta en círculo o en gota).
 */
function icon(size, fill) {
  const px = Buffer.alloc(size * size * 4);
  const cell = Math.floor((size * fill) / 16);
  const off = Math.floor((size - cell * 16) / 2);
  const set = (x, y, [r, g, b]) => {
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = 255;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, BG);
  for (const [gx, gy, gw, gh, color] of [...SPRITE, ...EYES]) {
    for (let y = off + gy * cell; y < off + (gy + gh) * cell; y++) {
      for (let x = off + gx * cell; x < off + (gx + gw) * cell; x++) set(x, y, color);
    }
  }
  return png(size, size, px);
}

function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
const files = {
  'icon-192.png': icon(192, 1),
  'icon-512.png': icon(512, 1),
  'icon-maskable-512.png': icon(512, 0.62),
  'apple-touch-icon.png': icon(180, 0.84),
};
for (const [name, data] of Object.entries(files)) {
  writeFileSync(new URL(name, out), data);
  console.log(`public/icons/${name} (${data.length} bytes)`);
}
