// Generates PWA icons from the LifeKit mark. Run: node scripts/generate-icons.mjs
import sharp from "sharp"
import { writeFileSync } from "node:fs"

const mark = (pad = 0, rounded = true) => {
  // Glyph drawn on a 512 canvas; `pad` shrinks it for maskable safe-zone.
  const s = 512, inner = s - pad * 2, scale = inner / 512
  const g = (x) => pad + x * scale
  const tile = (x, y, r = 28) =>
    `<rect x="${g(x)}" y="${g(y)}" width="${118 * scale}" height="${118 * scale}" rx="${r * scale}" fill="#fff"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="#4f46e5"/>
  ${tile(128, 128)}${tile(266, 128)}${tile(128, 266)}
  <circle cx="${g(325)}" cy="${g(325)}" r="${59 * scale}" fill="#c7d2fe"/>
</svg>`
}

writeFileSync("public/icons/icon.svg", mark())
const out = [
  ["public/icons/icon-192.png", 192, mark()],
  ["public/icons/icon-512.png", 512, mark()],
  ["public/icons/maskable-192.png", 192, mark(64, false)],
  ["public/icons/maskable-512.png", 512, mark(64, false)],
  ["public/icons/apple-touch-icon.png", 180, mark(24, false)],
  ["src/app/icon.png", 64, mark()],
]
for (const [file, size, svg] of out) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file)
}
console.log("icons generated")

// favicon.ico: an ICO container wrapping a single 32×32 PNG (supported by all modern browsers).
const png32 = await sharp(Buffer.from(mark())).resize(32, 32).png().toBuffer()
const header = Buffer.alloc(22)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(1, 4) // image count
header.writeUInt8(32, 6) // width
header.writeUInt8(32, 7) // height
header.writeUInt16LE(1, 10) // colour planes
header.writeUInt16LE(32, 12) // bits per pixel
header.writeUInt32LE(png32.length, 14) // image size
header.writeUInt32LE(22, 18) // image offset
writeFileSync("src/app/favicon.ico", Buffer.concat([header, png32]))
console.log("favicon.ico generated")
