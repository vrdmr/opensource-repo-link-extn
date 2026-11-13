import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  body.copy(result, 4);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}

function icon(size) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const frame =
        u >= 0.19 && u <= 0.67 && v >= 0.35 && v <= 0.81 &&
        (u <= 0.28 || u >= 0.58 || v <= 0.44 || v >= 0.72);
      const arrow =
        (u >= 0.48 && u <= 0.82 && v >= 0.18 && v <= 0.27) ||
        (u >= 0.73 && u <= 0.82 && v >= 0.18 && v <= 0.52) ||
        (u >= 0.40 && u <= 0.78 && v >= 0.22 && v <= 0.60 &&
          Math.abs(u + v - 1) < 0.065);
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      const color = frame || arrow ? [255, 255, 255] : [25, 82, 133];
      pixels.set([...color, 255], offset);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const directory = new URL("../public/icons/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await writeFile(new URL(`icon${size}.png`, directory), icon(size));
}
