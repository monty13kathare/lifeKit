/**
 * Read identity and coverage from an OpenType/TrueType font program (the
 * copies pdf.js builds from a PDF's embedded fonts, or the embedded files
 * themselves). PDFs from Word name fonts "CIDFont+F2", but the font's own
 * `name` table still says "Calibri Bold".
 */

export interface SfntInfo {
  /** Typographic family, e.g. "Calibri". */
  family?: string
  /** Subfamily, e.g. "Bold Italic". */
  subfamily?: string
  /** OS/2 usWeightClass (100–900). */
  weight?: number
  italic?: boolean
  /** Unicode code points the font's cmap can draw. */
  codePoints: Set<number>
}

function tables(data: Uint8Array) {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const map = new Map<string, number>()
  if (data.length < 12) return { dv, map }
  const n = dv.getUint16(4)
  for (let i = 0; i < n && 12 + 16 * i + 16 <= data.length; i++) {
    const o = 12 + 16 * i
    map.set(String.fromCharCode(data[o], data[o + 1], data[o + 2], data[o + 3]), dv.getUint32(o + 8))
  }
  return { dv, map }
}

function readNames(data: Uint8Array, dv: DataView, off: number) {
  const out: Record<number, string> = {}
  const count = dv.getUint16(off + 2)
  const strings = off + dv.getUint16(off + 4)
  for (let r = 0; r < count; r++) {
    const b = off + 6 + 12 * r
    const platform = dv.getUint16(b)
    const id = dv.getUint16(b + 6)
    const len = dv.getUint16(b + 8)
    const start = strings + dv.getUint16(b + 10)
    if (![1, 2, 16, 17].includes(id) || start + len > data.length) continue
    let s = ""
    if (platform === 0 || platform === 3) {
      for (let i = 0; i + 1 < len; i += 2) s += String.fromCharCode((data[start + i] << 8) | data[start + i + 1])
    } else {
      for (let i = 0; i < len; i++) s += String.fromCharCode(data[start + i])
    }
    // Prefer Windows/Unicode records over Mac ones.
    if (s && (!out[id] || platform !== 1)) out[id] = s
  }
  return out
}

function readCmap(dv: DataView, off: number, set: Set<number>) {
  const n = dv.getUint16(off + 2)
  for (let t = 0; t < n; t++) {
    const platform = dv.getUint16(off + 4 + t * 8)
    const encoding = dv.getUint16(off + 4 + t * 8 + 2)
    // Unicode subtables only (pdf.js puts the real code points there too).
    if (!(platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10)))) continue
    const sub = off + dv.getUint32(off + 4 + t * 8 + 4)
    const format = dv.getUint16(sub)
    if (format === 4) {
      const segX2 = dv.getUint16(sub + 6)
      const ends = sub + 14
      const starts = ends + segX2 + 2
      const deltas = starts + segX2
      const ranges = deltas + segX2
      for (let s = 0; s < segX2 / 2; s++) {
        const end = dv.getUint16(ends + 2 * s)
        const start = dv.getUint16(starts + 2 * s)
        const delta = dv.getInt16(deltas + 2 * s)
        const rangeOff = dv.getUint16(ranges + 2 * s)
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let glyph: number
          if (rangeOff === 0) glyph = (c + delta) & 0xffff
          else {
            const at = ranges + 2 * s + rangeOff + 2 * (c - start)
            glyph = at + 2 <= dv.byteLength ? dv.getUint16(at) : 0
            if (glyph) glyph = (glyph + delta) & 0xffff
          }
          if (glyph) set.add(c)
        }
      }
    } else if (format === 12) {
      const groups = dv.getUint32(sub + 12)
      for (let g = 0; g < groups; g++) {
        const start = dv.getUint32(sub + 16 + 12 * g)
        const end = Math.min(dv.getUint32(sub + 20 + 12 * g), start + 0xffff)
        if (dv.getUint32(sub + 24 + 12 * g) === 0 && start === end) continue
        for (let c = start; c <= end; c++) set.add(c)
      }
    }
  }
}

export function readSfntInfo(data: Uint8Array | null | undefined): SfntInfo {
  const info: SfntInfo = { codePoints: new Set() }
  if (!data) return info
  try {
    const { dv, map } = tables(data)
    const name = map.get("name")
    if (name !== undefined) {
      const n = readNames(data, dv, name)
      info.family = n[16] || n[1]
      info.subfamily = n[17] || n[2]
    }
    const os2 = map.get("OS/2")
    if (os2 !== undefined) {
      info.weight = dv.getUint16(os2 + 4)
      info.italic = (dv.getUint16(os2 + 62) & 1) === 1
    }
    const cmap = map.get("cmap")
    if (cmap !== undefined) readCmap(dv, cmap, info.codePoints)
  } catch {
    /* truncated or unusual font: return what we have */
  }
  if (info.subfamily && /italic|oblique/i.test(info.subfamily)) info.italic = true
  return info
}

/** Weight implied by a style/font name ("Bold", "SemiBold", "-Black"), if any. */
export function weightFromName(name: string): number | undefined {
  const s = name.toLowerCase()
  if (/black|heavy/.test(s)) return 900
  if (/extra\s*bold|ultra\s*bold/.test(s)) return 800
  if (/semi\s*bold|demi\s*bold/.test(s)) return 600
  if (/bold/.test(s)) return 700
  if (/medium/.test(s)) return 500
  if (/extra\s*light|ultra\s*light/.test(s)) return 200
  if (/light/.test(s)) return 300
  if (/thin|hairline/.test(s)) return 100
  if (/regular|normal|book|roman/.test(s)) return 400
  return undefined
}

/**
 * Word writes ligatures (ti, tf, tt…) with odd ToUnicode values. Turn them
 * back into plain letters so the editor shows readable text.
 */
export function normalizeExtractedText(s: string): string {
  return s
    .replace(/Ɵ/g, "ti")
    .replace(/ƞ/g, "tf")
    .replace(/Ʃ/g, "tt")
    .replace(/[ﬀ-ﬆ]/g, (c) => c.normalize("NFKD"))
}

/**
 * Open fonts that look like (and are metric-compatible with) common fonts.
 * Values are Fontsource ids served by jsDelivr.
 */
const LOOKALIKES: Record<string, string> = {
  calibri: "carlito",
  cambria: "caladea",
  arial: "arimo",
  helvetica: "arimo",
  "helvetica neue": "arimo",
  "liberation sans": "arimo",
  "times new roman": "tinos",
  times: "tinos",
  "liberation serif": "tinos",
  "courier new": "cousine",
  courier: "cousine",
  "liberation mono": "cousine",
  georgia: "gelasio",
  "segoe ui": "open-sans",
  verdana: "dejavu-sans",
  tahoma: "dejavu-sans",
}

/** Fontsource id to borrow missing glyphs from, for a font family name. */
export function lookalikeFontId(family: string | undefined): string | undefined {
  if (!family) return undefined
  const key = family.toLowerCase().replace(/\s+(mt|ps|std|pro)$/i, "").trim()
  if (LOOKALIKES[key]) return LOOKALIKES[key]
  // Most Google Fonts families are on Fontsource under their own name.
  if (/^[a-z0-9 ]+$/.test(key) && !/emoji|symbol|wingdings|webdings|dingbat/.test(key)) return key.replace(/\s+/g, "-")
  return undefined
}

/** Fontsource TTF URL for a family/weight/style/subset. */
export function lookalikeFontUrl(id: string, weight: number, italic: boolean, subset = "latin") {
  const w = Math.min(900, Math.max(100, Math.round(weight / 100) * 100))
  return `https://cdn.jsdelivr.net/fontsource/fonts/${id}@latest/${subset}-${w}-${italic ? "italic" : "normal"}.ttf`
}

/** Fontsource subsets tried in order when looking for a glyph. */
export const LOOKALIKE_SUBSETS = ["latin", "latin-ext", "cyrillic", "greek", "vietnamese"]

export interface LookalikeFile {
  bytes: Uint8Array
  url: string
  has(codePoint: number): boolean
}

const fileCache = new Map<string, Promise<LookalikeFile | null>>()

/**
 * Download a look-alike font file (only the font — never the user's PDF).
 * Falls back to the nearest available weight/style. Resolves null offline.
 */
export function loadLookalikeFile(id: string, weight: number, italic: boolean, subset: string) {
  const key = `${id}:${weight}:${italic}:${subset}`
  let job = fileCache.get(key)
  if (!job) {
    job = (async () => {
      const weights = [...new Set([Math.round(weight / 100) * 100, weight >= 600 ? 700 : 400, 400])]
      for (const w of weights) {
        for (const it of italic ? [true, false] : [false]) {
          const url = lookalikeFontUrl(id, w, it, subset)
          try {
            const res = await fetch(url)
            if (!res.ok) continue
            const bytes = new Uint8Array(await res.arrayBuffer())
            const info = readSfntInfo(bytes)
            if (!info.codePoints.size) continue
            return { bytes, url, has: (cp: number) => info.codePoints.has(cp) }
          } catch {
            // offline or blocked: try the next candidate
          }
        }
      }
      return null
    })()
    fileCache.set(key, job)
  }
  return job
}
