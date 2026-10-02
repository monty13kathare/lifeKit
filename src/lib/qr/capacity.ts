/** QR capacity helpers (byte mode, version 40). */

export type EccLevel = "L" | "M" | "Q" | "H"

/** Maximum bytes in byte mode at version 40 per error-correction level. */
export const QR_BYTE_CAPACITY: Record<EccLevel, number> = { L: 2953, M: 2331, Q: 1663, H: 1273 }

export const ECC_LABELS: Record<EccLevel, string> = {
  L: "Low (7%)",
  M: "Medium (15%)",
  Q: "Quartile (25%)",
  H: "High (30%)",
}

export function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length
}

/** Largest binary file that fits as a base64 data URL with the given MIME type. */
export function maxEmbeddableBytes(mime: string, ecc: EccLevel): number {
  const header = `data:${mime};base64,`.length
  const chars = QR_BYTE_CAPACITY[ecc] - header
  return Math.max(0, Math.floor(chars / 4) * 3)
}

/** WCAG relative luminance contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex)
    if (!m) return 0
    const n = parseInt(m[1], 16)
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  }
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

export function luminanceOf(hex: string): number {
  return contrastRatio(hex, "#000000")
}
