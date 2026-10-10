/**
 * Re-use a font that is already embedded in the source PDF when drawing
 * replacement text, so the new words use the *exact* same font program
 * (family, weight, metrics, hinting) as the text around them.
 *
 * This module never imports `pdf-lib` itself — the exporter passes in the
 * lazily loaded module so the library stays out of route bundles.
 *
 * Embedded fonts are usually subsets: only glyphs used in the original
 * document exist. `encodeRuns` marks characters the font lacks so the
 * exporter can draw just those with a look-alike font.
 */
import type * as PdfLibModule from "pdf-lib"

type PdfLib = typeof PdfLibModule
type PDFDocument = PdfLibModule.PDFDocument
type PDFPage = PdfLibModule.PDFPage
type PDFDict = PdfLibModule.PDFDict
type PDFRef = PdfLibModule.PDFRef
type PDFObject = PdfLibModule.PDFObject

/** One run of encoded glyphs, or a gap (in 1/1000 em) where the font had no space glyph. */
export type EncodedPiece = { hex: string } | { gap: number }

/** A stretch of text the original font can draw, or one it can't. */
export type TextRun = { kind: "original"; pieces: EncodedPiece[] } | { kind: "missing"; text: string }

export interface ReusableFont {
  /** Resource name of the font on the target page (use with `Tf`). */
  key: PdfLibModule.PDFName
  /**
   * Split text into runs drawable with the original font and runs it lacks
   * glyphs for. `spaceExtra` (1/1000 em) widens each space, for justified lines.
   */
  encodeRuns(text: string, spaceExtra?: number): TextRun[]
  /** Advance of the characters this font has, in 1/1000 em (missing ones count 0); NaN when the PDF has no widths. */
  measure(text: string): number
}

/** "ABCDEF+Inter-Bold" → "Inter-Bold". */
export const stripSubsetPrefix = (name: string) => name.replace(/^[A-Z]{6}\+/, "")

// ---------------------------------------------------------------------------
// Encodings for simple (single-byte) fonts without a ToUnicode CMap
// ---------------------------------------------------------------------------

/** WinAnsi codes 0x80–0x9F; every other code maps to the same Latin-1 code point. */
const WIN_ANSI_HIGH: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
  0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018,
  0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc,
  0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
}

function baseEncoding(name: string | undefined): Map<number, string> {
  const map = new Map<number, string>()
  for (let c = 0x20; c < 0x7f; c++) map.set(c, String.fromCharCode(c))
  if (name === "WinAnsiEncoding") {
    for (let c = 0xa0; c <= 0xff; c++) map.set(c, String.fromCharCode(c))
    for (const [c, u] of Object.entries(WIN_ANSI_HIGH)) map.set(Number(c), String.fromCodePoint(u))
  } else if (!name || name === "StandardEncoding") {
    map.set(0x27, "’")
    map.set(0x60, "‘")
  }
  return map
}

/** Adobe glyph names for printable ASCII plus common typographic marks. */
const GLYPH_NAMES: Record<string, string> = {
  space: " ", exclam: "!", quotedbl: '"', numbersign: "#", dollar: "$", percent: "%", ampersand: "&",
  quotesingle: "'", quoteright: "’", quoteleft: "‘", parenleft: "(", parenright: ")", asterisk: "*",
  plus: "+", comma: ",", hyphen: "-", minus: "−", period: ".", slash: "/", zero: "0", one: "1", two: "2",
  three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", colon: ":", semicolon: ";",
  less: "<", equal: "=", greater: ">", question: "?", at: "@", bracketleft: "[", backslash: "\\",
  bracketright: "]", asciicircum: "^", underscore: "_", grave: "`", braceleft: "{", bar: "|", braceright: "}",
  asciitilde: "~", endash: "–", emdash: "—", bullet: "•", ellipsis: "…",
  quotedblleft: "“", quotedblright: "”", copyright: "©", registered: "®",
  trademark: "™", degree: "°", Euro: "€", fi: "ﬁ", fl: "ﬂ", nbspace: " ",
}

function glyphNameToUnicode(name: string): string | undefined {
  if (GLYPH_NAMES[name]) return GLYPH_NAMES[name]
  if (/^[A-Za-z]$/.test(name)) return name
  const uni = /^uni([0-9A-Fa-f]{4})$/.exec(name) ?? /^u([0-9A-Fa-f]{4,6})$/.exec(name)
  if (uni) return String.fromCodePoint(parseInt(uni[1], 16))
  return undefined
}

// ---------------------------------------------------------------------------
// ToUnicode CMap
// ---------------------------------------------------------------------------

function utf16HexToString(hex: string): string {
  const units: number[] = []
  for (let i = 0; i + 4 <= hex.length; i += 4) units.push(parseInt(hex.slice(i, i + 4), 16))
  if (hex.length === 2) units.push(parseInt(hex, 16))
  return String.fromCharCode(...units)
}

/** Parse `bfchar`/`bfrange` sections into code → text, plus the code width in bytes. */
export function parseToUnicode(src: string): { map: Map<number, string>; bytes: number } {
  const map = new Map<number, string>()
  let bytes = 1
  const clean = (h: string) => h.replace(/\s+/g, "")

  for (const block of src.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9A-Fa-f\s]+)>\s*<([0-9A-Fa-f\s]*)>/g)) {
      const code = clean(m[1])
      bytes = Math.max(bytes, code.length / 2)
      map.set(parseInt(code, 16), utf16HexToString(clean(m[2])))
    }
  }
  for (const block of src.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const re = /<([0-9A-Fa-f\s]+)>\s*<([0-9A-Fa-f\s]+)>\s*(?:<([0-9A-Fa-f\s]*)>|\[([^\]]*)\])/g
    for (const m of block[1].matchAll(re)) {
      const loHex = clean(m[1])
      bytes = Math.max(bytes, loHex.length / 2)
      const lo = parseInt(loHex, 16)
      const hi = Math.min(parseInt(clean(m[2]), 16), lo + 0xffff)
      if (m[3] !== undefined) {
        const dst = clean(m[3])
        if (!dst) continue
        const head = dst.slice(0, -4)
        const last = parseInt(dst.slice(-4), 16)
        for (let c = lo; c <= hi; c++) {
          map.set(c, utf16HexToString(head + (last + c - lo).toString(16).padStart(4, "0")))
        }
      } else {
        const list = [...m[4].matchAll(/<([0-9A-Fa-f\s]*)>/g)].map((x) => clean(x[1]))
        list.forEach((dst, i) => lo + i <= hi && map.set(lo + i, utf16HexToString(dst)))
      }
    }
  }
  return { map, bytes }
}

// ---------------------------------------------------------------------------
// Font lookup + encoder
// ---------------------------------------------------------------------------

interface FontCandidate {
  value: PDFObject
  dict: PDFDict
  names: string[]
}

export function findReusableFont(lib: PdfLib, doc: PDFDocument, page: PDFPage, fontName: string): ReusableFont | null {
  const { PDFDict, PDFName, PDFRef, PDFArray, PDFNumber, PDFRawStream, decodePDFRawStream } = lib
  const ctx = doc.context
  const lookupDict = (obj: PDFObject | undefined) => {
    const v = obj instanceof PDFRef ? ctx.lookup(obj) : obj
    return v instanceof PDFDict ? v : undefined
  }
  const nameOf = (obj: PDFObject | undefined) => {
    const v = obj instanceof PDFRef ? ctx.lookup(obj) : obj
    return v instanceof PDFName ? v.decodeText() : undefined
  }
  const numberOf = (obj: PDFObject | undefined) => {
    const v = obj instanceof PDFRef ? ctx.lookup(obj) : obj
    return v instanceof PDFNumber ? v.asNumber() : undefined
  }
  const arrayOf = (obj: PDFObject | undefined) => {
    const v = obj instanceof PDFRef ? ctx.lookup(obj) : obj
    return v instanceof PDFArray ? v : undefined
  }

  // 1. Collect every font reachable from the page (including inside form XObjects).
  const candidates: FontCandidate[] = []
  const seenRes = new Set<PDFDict>()
  const walk = (res: PDFDict | undefined, depth: number) => {
    if (!res || seenRes.has(res) || depth > 4) return
    seenRes.add(res)
    const fonts = lookupDict(res.get(PDFName.of("Font")))
    for (const [, value] of fonts?.entries() ?? []) {
      const dict = lookupDict(value)
      if (!dict) continue
      const names: string[] = []
      const base = nameOf(dict.get(PDFName.of("BaseFont")))
      if (base) names.push(base)
      const descendant = lookupDict(arrayOf(dict.get(PDFName.of("DescendantFonts")))?.get(0))
      const descriptor = lookupDict((descendant ?? dict).get(PDFName.of("FontDescriptor")))
      const fn = nameOf(descriptor?.get(PDFName.of("FontName")))
      if (fn) names.push(fn)
      candidates.push({ value, dict, names })
    }
    const xobjects = lookupDict(res.get(PDFName.of("XObject")))
    for (const [, value] of xobjects?.entries() ?? []) {
      const obj = value instanceof PDFRef ? ctx.lookup(value) : value
      const dict = obj && "dict" in obj ? (obj as { dict: PDFDict }).dict : undefined
      if (dict && nameOf(dict.get(PDFName.of("Subtype"))) === "Form") {
        walk(lookupDict(dict.get(PDFName.of("Resources"))), depth + 1)
      }
    }
  }
  walk(page.node.Resources(), 0)

  const wanted = fontName.trim()
  const match =
    candidates.find((c) => c.names.includes(wanted)) ??
    candidates.find((c) => c.names.some((n) => stripSubsetPrefix(n) === stripSubsetPrefix(wanted)))
  if (!match) return null

  // 2. Build a unicode → code table for this font.
  const { dict } = match
  const subtype = nameOf(dict.get(PDFName.of("Subtype")))
  const composite = subtype === "Type0"
  const encodingObj = dict.get(PDFName.of("Encoding"))
  if (composite) {
    const enc = nameOf(encodingObj)
    if (enc !== "Identity-H") return null // vertical or predefined CMaps: not worth the risk
  }

  let codeToText = new Map<number, string>()
  let codeBytes = composite ? 2 : 1
  const toUni = ctx.lookup(dict.get(PDFName.of("ToUnicode")) as PDFRef | undefined)
  if (toUni instanceof PDFRawStream) {
    try {
      const raw = decodePDFRawStream(toUni).decode()
      const parsed = parseToUnicode(new TextDecoder("latin1").decode(raw))
      codeToText = parsed.map
      if (composite) codeBytes = Math.max(2, parsed.bytes)
    } catch {
      /* fall through to the font's encoding */
    }
  }
  if (!codeToText.size) {
    if (composite) return null // Identity CIDs without ToUnicode can't be mapped back
    const encDict = lookupDict(encodingObj)
    codeToText = baseEncoding(encDict ? nameOf(encDict.get(PDFName.of("BaseEncoding"))) : nameOf(encodingObj))
    const diffs = arrayOf(encDict?.get(PDFName.of("Differences")))
    let code = 0
    for (let i = 0; diffs && i < diffs.size(); i++) {
      const item = diffs.get(i)
      const n = numberOf(item)
      if (n !== undefined) {
        code = n
        continue
      }
      const glyph = nameOf(item)
      const text = glyph ? glyphNameToUnicode(glyph) : undefined
      if (text) codeToText.set(code, text)
      else codeToText.delete(code)
      code++
    }
  }

  // Simple subset fonts often keep the full encoding but have zero widths for
  // glyphs that were dropped from the subset: treat those as missing.
  if (!composite) {
    const first = numberOf(dict.get(PDFName.of("FirstChar")))
    const widths = arrayOf(dict.get(PDFName.of("Widths")))
    if (first !== undefined && widths) {
      for (const code of [...codeToText.keys()]) {
        const w = numberOf(widths.get(code - first))
        if (w === undefined || (w === 0 && codeToText.get(code) !== " ")) codeToText.delete(code)
      }
    }
  }

  const textToCode = new Map<string, number>()
  for (const [code, text] of [...codeToText.entries()].sort((a, b) => a[0] - b[0])) {
    if (!textToCode.has(text)) textToCode.set(text, code)
  }
  if (!textToCode.size) return null
  // Non-breaking space and regular space are interchangeable for drawing.
  if (!textToCode.has(" ") && textToCode.has(" ")) textToCode.set(" ", textToCode.get(" ")!)

  // Glyph advances (1/1000 em) for justification.
  const widthOf = (() => {
    if (composite) {
      const desc = lookupDict(arrayOf(dict.get(PDFName.of("DescendantFonts")))?.get(0))
      const dw = numberOf(desc?.get(PDFName.of("DW"))) ?? 1000
      const map = new Map<number, number>()
      const w = arrayOf(desc?.get(PDFName.of("W")))
      for (let i = 0; w && i < w.size(); ) {
        const first = numberOf(w.get(i))
        const next = arrayOf(w.get(i + 1))
        if (first === undefined) break
        if (next) {
          for (let k = 0; k < next.size(); k++) map.set(first + k, numberOf(next.get(k)) ?? dw)
          i += 2
        } else {
          const last = numberOf(w.get(i + 1))
          const value = numberOf(w.get(i + 2))
          if (last === undefined || value === undefined) break
          for (let c = first; c <= last && c - first < 65536; c++) map.set(c, value)
          i += 3
        }
      }
      return (code: number) => map.get(code) ?? dw
    }
    const first = numberOf(dict.get(PDFName.of("FirstChar")))
    const widths = arrayOf(dict.get(PDFName.of("Widths")))
    // Standard-14 fonts may have no /Widths: unknown (NaN disables justification).
    return (code: number) => (first !== undefined && widths ? (numberOf(widths.get(code - first)) ?? 0) : NaN)
  })()

  const ref = match.value instanceof PDFRef ? match.value : ctx.register(match.dict)
  const key = page.node.newFontDictionary("LKOrig", ref)
  // Typical space advance when the subset has no space glyph (in 1/1000 em).
  const SPACE_GAP = 270

  return {
    key,
    measure(text) {
      let total = 0
      for (const ch of Array.from(text.replace(/\t/g, "    "))) {
        const code = textToCode.get(ch)
        if (code !== undefined) total += widthOf(code)
        else if (ch === " ") total += SPACE_GAP
      }
      return total
    },
    encodeRuns(text, spaceExtra = 0) {
      const runs: TextRun[] = []
      let pieces: EncodedPiece[] = []
      let hex = ""
      let missing = ""
      const flushOrig = () => {
        if (hex) pieces.push({ hex })
        hex = ""
        if (pieces.length) runs.push({ kind: "original", pieces })
        pieces = []
      }
      const flushMissing = () => {
        if (missing) runs.push({ kind: "missing", text: missing })
        missing = ""
      }
      for (const ch of Array.from(text.replace(/\t/g, "    "))) {
        const code = textToCode.get(ch)
        if (code !== undefined) {
          flushMissing()
          hex += code.toString(16).padStart(codeBytes * 2, "0")
          if (ch === " " && spaceExtra) {
            pieces.push({ hex })
            hex = ""
            pieces.push({ gap: spaceExtra })
          }
        } else if (ch === " " && !missing) {
          // No space glyph in the subset: advance by a typical space width instead.
          if (hex) pieces.push({ hex })
          hex = ""
          pieces.push({ gap: SPACE_GAP + spaceExtra })
        } else {
          flushOrig()
          missing += ch
        }
      }
      flushOrig()
      flushMissing()
      return runs
    },
  }
}
