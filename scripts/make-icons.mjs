// Genera los iconos PNG provisionales con las olas de la pantalla "Entrar".
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [0xf0, 0xea, 0xff];
const WAVES = [
  { top: 0.42, color: [0xcd, 0xb6, 0xff] },
  { top: 0.54, color: [0xff, 0xa8, 0xd2] },
  { top: 0.66, color: [0x98, 0xeb, 0xc6] },
  { top: 0.78, color: [0xcd, 0xf5, 0x6b] },
];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const bump = size / 10; // ancho de cada "burbuja" de la ola
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let col = BG;
      for (const w of WAVES) {
        const cx = (Math.floor(x / bump) + 0.5) * bump;
        const r = bump / 2;
        const top = w.top * size;
        const dx = x - cx;
        const crest = top - Math.sqrt(Math.max(0, r * r - dx * dx));
        if (y >= crest) col = w.color;
      }
      const i = y * (size * 3 + 1) + 1 + x * 3;
      raw[i] = col[0];
      raw[i + 1] = col[1];
      raw[i + 2] = col[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

writeFileSync("public/apple-touch-icon.png", png(180));
writeFileSync("public/icon-192.png", png(192));
writeFileSync("public/icon-512.png", png(512));
console.log("Iconos generados en public/");
