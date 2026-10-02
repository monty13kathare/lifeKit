/**
 * Read the EXIF orientation tag (1–8) from a JPEG. Returns 1 ("normal") when
 * absent or unreadable. Used to decide whether a JPEG can be embedded as-is.
 */
export function readJpegOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer)
  const len = view.byteLength
  if (len < 4 || view.getUint16(0) !== 0xffd8) return 1
  let offset = 2
  while (offset + 4 <= len) {
    const marker = view.getUint16(offset)
    if ((marker & 0xff00) !== 0xff00) return 1
    if (marker === 0xffda) return 1 // start of scan: no more metadata
    const size = view.getUint16(offset + 2)
    if (marker === 0xffe1) {
      const start = offset + 4
      if (start + 14 > len) return 1
      if (view.getUint32(start) === 0x45786966 /* "Exif" */) {
        const tiff = start + 6
        const little = view.getUint16(tiff) === 0x4949
        const ifd = tiff + view.getUint32(tiff + 4, little)
        if (ifd + 2 > len) return 1
        const entries = view.getUint16(ifd, little)
        for (let i = 0; i < entries; i++) {
          const entry = ifd + 2 + i * 12
          if (entry + 12 > len) return 1
          if (view.getUint16(entry, little) === 0x0112) {
            const value = view.getUint16(entry + 8, little)
            return value >= 1 && value <= 8 ? value : 1
          }
        }
        return 1
      }
    }
    offset += 2 + size
  }
  return 1
}
