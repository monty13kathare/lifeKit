/**
 * Glyph widths for the 14 standard PDF fonts, which PDFs may use without a
 * `/Widths` array (viewers have the metrics built in). Lets the content
 * stripper measure text drawn in, e.g., plain Helvetica.
 */
const STANDARD = new Set([
  "Courier",
  "Courier-Bold",
  "Courier-Oblique",
  "Courier-BoldOblique",
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "Times-Roman",
  "Times-Bold",
  "Times-Italic",
  "Times-BoldItalic",
])

/** Common aliases viewers map onto the standard fonts. */
const ALIASES: Record<string, string> = {
  Arial: "Helvetica",
  "Arial,Bold": "Helvetica-Bold",
  "Arial-BoldMT": "Helvetica-Bold",
  ArialMT: "Helvetica",
  "Helvetica,Bold": "Helvetica-Bold",
  TimesNewRoman: "Times-Roman",
  TimesNewRomanPSMT: "Times-Roman",
  "TimesNewRoman,Bold": "Times-Bold",
  "TimesNewRomanPS-BoldMT": "Times-Bold",
  CourierNew: "Courier",
  CourierNewPSMT: "Courier",
}

export type StandardWidths = (baseFont: string) => ((code: number) => number | undefined) | null

export async function loadStandardWidths(): Promise<StandardWidths> {
  const { Font, Encodings } = await import("@pdf-lib/standard-fonts")
  // WinAnsi code → glyph name (the usual encoding for these fonts in practice).
  const glyphForCode = new Map<number, string>()
  for (const cp of Encodings.WinAnsi.supportedCodePoints) {
    const { code, name } = Encodings.WinAnsi.encodeUnicodeCodePoint(cp)
    if (!glyphForCode.has(code)) glyphForCode.set(code, name)
  }
  const cache = new Map<string, ((code: number) => number | undefined) | null>()
  return (baseFont) => {
    const plain = baseFont.replace(/^[A-Z]{6}\+/, "")
    const name = STANDARD.has(plain) ? plain : ALIASES[plain]
    if (!name) return null
    if (!cache.has(name)) {
      const font = Font.load(name as Parameters<typeof Font.load>[0])
      cache.set(name, (code) => {
        const glyph = glyphForCode.get(code)
        const w = glyph ? font.getWidthOfGlyph(glyph) : undefined
        return typeof w === "number" ? w : undefined
      })
    }
    return cache.get(name)!
  }
}
