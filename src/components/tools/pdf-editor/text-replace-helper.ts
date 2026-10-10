import type { PDFPageProxy } from "pdfjs-dist"
import { normalizeExtractedText, readSfntInfo, weightFromName } from "@/lib/pdf/font-info"
import { loadPdfJs } from "@/lib/pdf/pdfjs"

interface RawPdfTextItem {
  str?: string
  transform?: number[]
  width?: number
  height?: number
  fontName?: string
  hasEOL?: boolean
}

interface RawPdfTextContent {
  items: unknown[]
  styles?: Record<string, { fontFamily?: string; ascent?: number; descent?: number; vertical?: boolean }>
}

/** One line of text drawn with a single font, in page space (0–1, y down). */
export interface EditableLine {
  id: string
  str: string
  /** Cover box (normalised) — glyph ascent to descent. */
  x: number
  y: number
  w: number
  h: number
  /** Baseline (normalised y). */
  baselineY: number
}

/** A heading / paragraph: consecutive lines sharing one font, size and colour. */
export interface EditableTextBlock {
  id: string
  lines: EditableLine[]
  /** Union of the line boxes (normalised). */
  x: number
  y: number
  w: number
  h: number
  fontSize: number
  /** Text matrix with the font size divided out. */
  matrix: [number, number, number, number]
  /** Baseline-to-baseline distance in points. */
  lineGap: number
  /** Font ascent/descent in em (descent positive, below the baseline). */
  ascent: number
  descent: number
  /** Browser FontFace family holding the original font (registered with its real weight/style). */
  fontFace: string
  /** Real family from the font program, e.g. "Calibri" (PDF names can be "CIDFont+F2"). */
  realFamily?: string
  /** Numeric weight (400 regular, 700 bold). */
  weight: number
  /** True when `fontFace` is our copy declared with the real weight/style (else pdf.js's, declared regular). */
  faceWeighted: boolean
  /** Code points the original embedded font contains. Empty = unknown. */
  coverage: Set<number>
  /** PDF font name (`/BaseFont`, may include a subset prefix). */
  pdfFontName: string
  /** Generic CSS fallback. */
  fontFallback: string
  fontFamily: "sans" | "serif" | "mono"
  fontWeight: "normal" | "bold"
  italic: boolean
  /** Exact fill colour from the PDF content, when it could be matched. */
  color: string | null
}

export function detectFontProperties(
  fontName = "",
  familyStyle = ""
): { fontFamily: "sans" | "serif" | "mono"; fontWeight: "normal" | "bold" } {
  const fStyle = familyStyle.toLowerCase().trim()
  const s = `${fontName.toLowerCase()} ${fStyle}`
  let fontFamily: "sans" | "serif" | "mono" = "sans"
  if (fStyle === "monospace" || /courier|mono|consolas|menlo|source\s*code|\bcode\b/.test(s)) {
    fontFamily = "mono"
  } else if (
    fStyle !== "sans-serif" &&
    !s.includes("sans") &&
    (fStyle === "serif" || /times|georgia|garamond|minion|cambria|palatino|baskerville|charter|bookman|didot|bodoni|century/.test(s))
  ) {
    fontFamily = "serif"
  }
  const isBold = /bold|black|heavy|semibold|demibold|extrabold|ultrabold|medium/.test(s)
  return { fontFamily, fontWeight: isBold ? "bold" : "normal" }
}

interface FontInfo {
  name?: string
  data?: Uint8Array
  bold?: boolean
  black?: boolean
  italic?: boolean
  loadedName?: string
}

interface TextRun {
  font: string
  text: string
  color: string
}

const stripSubset = (name: string) => name.replace(/^[A-Z]{6}\+/, "").replace(/^CIDFont\+F\d+$/, "")
const squash = (s: string) => s.replace(/\s+/g, "")

const faces = new Map<string, Promise<string | null>>()

/**
 * Register our own FontFace from pdf.js's font data, declared with the font's
 * real weight and style. CSS can then ask for e.g. weight 700 without the
 * browser faking bold on top, and glyphs missing from the subset fall back to
 * the next family in the stack at the same weight.
 */
function registerFace(loadedName: string, data: Uint8Array | undefined, weight: number, italic: boolean) {
  if (!data || typeof FontFace === "undefined" || typeof document === "undefined") return Promise.resolve(null)
  let job = faces.get(loadedName)
  if (!job) {
    const family = `lk-${loadedName}`
    const face = new FontFace(family, data.slice(), { weight: String(weight), style: italic ? "italic" : "normal" })
    job = face
      .load()
      .then(() => {
        document.fonts.add(face)
        return family
      })
      .catch(() => null)
    faces.set(loadedName, job)
  }
  return job
}

/**
 * Walk pdf.js's operator list to learn the exact fill colour each text run was
 * drawn with. pdf.js converts every colour space to `setFillRGBColor` + hex.
 */
async function collectTextRuns(page: PDFPageProxy): Promise<TextRun[]> {
  const { OPS } = await loadPdfJs()
  const list = await page.getOperatorList()
  const runs: TextRun[] = []
  let color = "#000000"
  let font = ""
  const stack: { color: string; font: string }[] = []
  for (let i = 0; i < list.fnArray.length; i++) {
    const fn = list.fnArray[i]
    const args = list.argsArray[i] as unknown[] | null
    if (fn === OPS.save) stack.push({ color, font })
    else if (fn === OPS.restore) ({ color, font } = stack.pop() ?? { color, font })
    else if (fn === OPS.setFillRGBColor && typeof args?.[0] === "string") color = args[0]
    else if (fn === OPS.setFont && typeof args?.[0] === "string") font = args[0]
    else if (fn === OPS.showText || fn === OPS.showSpacedText) {
      const glyphs = (args?.[0] ?? []) as unknown[]
      let text = ""
      for (const g of glyphs) {
        if (g && typeof g === "object" && "unicode" in g) text += String((g as { unicode: string }).unicode ?? "")
      }
      if (squash(text)) runs.push({ font, text: squash(text), color })
    }
  }
  return runs
}

/**
 * Turn pdf.js text content into editable lines and paragraph blocks.
 * Only horizontal text is offered for editing.
 */
export async function extractEditableBlocks(page: PDFPageProxy, keyPrefix: string): Promise<EditableTextBlock[]> {
  const [tc, runs] = await Promise.all([
    page.getTextContent() as Promise<unknown> as Promise<RawPdfTextContent>,
    // Also resolves every font into `commonObjs`, which we read below.
    collectTextRuns(page).catch(() => [] as TextRun[]),
  ])
  const [vx0, , , vy1] = page.view
  const W = page.view[2] - page.view[0]
  const H = page.view[3] - page.view[1]

  const fontInfo = (loadedName: string): FontInfo => {
    try {
      if (page.commonObjs.has(loadedName)) return page.commonObjs.get(loadedName) as FontInfo
    } catch {
      /* not resolved */
    }
    return {}
  }

  // ---- 1. raw items → positioned pieces (+ exact colour by run order) ----
  interface Piece {
    str: string
    x: number // pt from left
    base: number // pt from top
    width: number
    size: number
    font: string
    matrix: [number, number, number, number]
    color: string | null
  }
  const pieces: Piece[] = []
  let cursor = 0
  for (const raw of tc.items) {
    const item = raw as RawPdfTextItem
    if (!item || typeof item.str !== "string" || !item.str.trim() || !item.transform) continue
    const [a, b, c, d, e, f] = item.transform
    const size = Math.hypot(a, b)
    if (!size || Math.abs(b) > 1e-3 * size || Math.abs(c) > 1e-3 * size || a <= 0 || d <= 0) continue
    const font = item.fontName ?? ""

    let color: string | null = null
    const key = squash(item.str).slice(0, 12)
    for (let k = 0; k < 2 && color === null; k++) {
      const from = k === 0 ? cursor : 0
      const to = k === 0 ? Math.min(runs.length, cursor + 300) : cursor
      for (let r = from; r < to; r++) {
        const run = runs[r]
        if (run.font === font && (run.text.includes(key) || key.includes(run.text))) {
          color = run.color
          cursor = r
          break
        }
      }
    }

    pieces.push({
      str: item.str,
      x: e - vx0,
      base: vy1 - f,
      width: item.width ?? size * item.str.length * 0.5,
      size,
      font,
      matrix: [a / size, b / size, c / size, d / size],
      color,
    })
  }

  // ---- 2. pieces → lines (same font/size/colour on one baseline) ----
  interface Line {
    str: string
    x: number
    base: number
    right: number
    size: number
    font: string
    matrix: [number, number, number, number]
    color: string | null
  }
  const lines: Line[] = []
  for (const p of pieces) {
    const prev = lines[lines.length - 1]
    const gap = prev ? p.x - prev.right : 0
    if (
      prev &&
      prev.font === p.font &&
      Math.abs(prev.size - p.size) < 0.3 &&
      prev.color === p.color &&
      Math.abs(prev.base - p.base) < p.size * 0.2 &&
      gap > -p.size * 0.3 &&
      gap < p.size * 0.6
    ) {
      const needsSpace = gap > p.size * 0.12 && !/\s$/.test(prev.str) && !/^\s/.test(p.str)
      prev.str += (needsSpace ? " " : "") + p.str
      prev.right = Math.max(prev.right, p.x + p.width)
    } else {
      lines.push({ ...p, right: p.x + p.width })
    }
  }

  // ---- 3. lines → blocks (paragraphs with a steady line gap) ----
  const blocks: EditableTextBlock[] = []
  let current: { lines: Line[]; gap: number | null } | null = null
  const sfntCache = new Map<string, ReturnType<typeof readSfntInfo>>()
  const flush = () => {
    if (!current) return
    const first = current.lines[0]
    const style = tc.styles?.[first.font]
    const info = fontInfo(first.font)
    const sfnt = sfntCache.get(first.font) ?? readSfntInfo(info.data)
    sfntCache.set(first.font, sfnt)
    const ascent = Math.min(0.95, Math.max(0.7, style?.ascent ?? 0.8))
    const descent = Math.min(0.3, Math.max(0.15, Math.abs(style?.descent ?? -0.22)))
    const pdfFontName = info.name ?? ""
    const guess = detectFontProperties(`${sfnt.family ?? ""} ${sfnt.subfamily ?? ""} ${pdfFontName}`, style?.fontFamily)
    // Style names beat OS/2: pdf.js rewrites broken OS/2 tables with a default weight of 500.
    const weight =
      weightFromName(`${sfnt.subfamily ?? ""} ${stripSubset(pdfFontName)}`) ??
      (sfnt.weight && sfnt.weight !== 500 ? sfnt.weight : undefined) ??
      (info.black ? 900 : info.bold || guess.fontWeight === "bold" ? 700 : 400)
    const bold = weight >= 600
    const italic = sfnt.italic ?? (Boolean(info.italic) || /italic|oblique/i.test(pdfFontName))
    const blockId = `${keyPrefix}-b${blocks.length}`

    const editLines: EditableLine[] = current.lines.map((l, i) => {
      const top = l.base - ascent * l.size
      const bottom = l.base + descent * l.size
      return {
        id: `${blockId}-l${i}`,
        str: normalizeExtractedText(l.str).replace(/\s+$/, ""),
        x: Math.max(0, l.x / W),
        y: Math.max(0, top / H),
        w: Math.min(1, (l.right - l.x) / W),
        h: Math.min(1, (bottom - top) / H),
        baselineY: l.base / H,
      }
    })
    const x0 = Math.min(...editLines.map((l) => l.x))
    const y0 = Math.min(...editLines.map((l) => l.y))
    const x1 = Math.max(...editLines.map((l) => l.x + l.w))
    const y1 = Math.max(...editLines.map((l) => l.y + l.h))

    blocks.push({
      id: blockId,
      lines: editLines,
      x: x0,
      y: y0,
      w: x1 - x0,
      h: y1 - y0,
      fontSize: Math.round(first.size * 100) / 100,
      matrix: first.matrix,
      lineGap: current.gap ?? first.size * 1.2,
      ascent,
      descent,
      fontFace: info.loadedName ?? first.font,
      faceWeighted: false,
      realFamily: sfnt.family,
      weight,
      coverage: sfnt.codePoints,
      pdfFontName,
      fontFallback: style?.fontFamily ?? "sans-serif",
      fontFamily: guess.fontFamily,
      fontWeight: bold ? "bold" : "normal",
      italic,
      color: first.color,
    })
    current = null
  }

  for (const l of lines) {
    if (current) {
      const last = current.lines[current.lines.length - 1]
      const first = current.lines[0]
      const gap = l.base - last.base
      const sameStyle =
        l.font === first.font && Math.abs(l.size - first.size) < 0.3 && l.color === first.color
      const steady = current.gap === null ? gap > l.size * 0.95 && gap < l.size * 1.9 : Math.abs(gap - current.gap) < l.size * 0.15
      const aligned = Math.abs(l.x - first.x) < l.size * 1.5
      if (sameStyle && steady && aligned) {
        current.lines.push(l)
        current.gap ??= gap
        continue
      }
      flush()
    }
    current = { lines: [l], gap: null }
  }
  flush()

  // Swap in our weight-aware FontFace copies where the browser accepts them.
  await Promise.all(
    blocks.map(async (b) => {
      const info = fontInfo(b.fontFace)
      const family = await registerFace(b.fontFace, info.data, b.weight, b.italic)
      if (family) {
        b.fontFace = family
        b.faceWeighted = true
      }
    })
  )
  return blocks
}

/**
 * Samples the rendered page canvas for the background colour behind a box
 * and (as a fallback) the colour of the glyphs inside it.
 */
export function sampleColorsFromCanvas(
  canvas: HTMLCanvasElement | null,
  normX: number,
  normY: number,
  normW: number,
  normH: number
): { textColor: string; bgColor: string } {
  const fallback = { textColor: "#000000", bgColor: "#ffffff" }
  if (!canvas) return fallback
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return fallback

  const sx = Math.max(0, Math.min(canvas.width - 1, Math.floor(normX * canvas.width)))
  const sy = Math.max(0, Math.min(canvas.height - 1, Math.floor(normY * canvas.height)))
  const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil(normW * canvas.width)))
  const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil(normH * canvas.height)))

  try {
    const data = ctx.getImageData(sx, sy, sw, sh).data
    if (!data.length) return fallback
    const px = (i: number): [number, number, number] => [data[i], data[i + 1], data[i + 2]]
    const lum = (p: [number, number, number]) => p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114

    // Background: median of the box perimeter (ignores stray glyph edges).
    const border: [number, number, number][] = []
    for (let x = 0; x < sw; x += Math.max(1, Math.floor(sw / 24))) {
      border.push(px(x * 4), px(((sh - 1) * sw + x) * 4))
    }
    for (let y = 0; y < sh; y += Math.max(1, Math.floor(sh / 8))) {
      border.push(px(y * sw * 4), px((y * sw + sw - 1) * 4))
    }
    border.sort((a, b) => lum(a) - lum(b))
    let bg = border[Math.floor(border.length / 2)] ?? [255, 255, 255]
    if (bg.every((v) => v > 248)) bg = [255, 255, 255]

    // Text: median of the most contrasting 10% of pixels (the solid glyph cores).
    const ink: [number, number, number][] = []
    for (let i = 0; i < data.length; i += 4) {
      const p = px(i)
      if (Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]) > 40) ink.push(p)
    }
    const dist = (p: [number, number, number]) => Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2])
    ink.sort((a, b) => dist(b) - dist(a))
    const core = ink.slice(0, Math.max(1, Math.floor(ink.length * 0.1)))
    const median = (ch: 0 | 1 | 2) => core.map((p) => p[ch]).sort((a, b) => a - b)[Math.floor(core.length / 2)]
    let text: [number, number, number] = ink.length ? [median(0), median(1), median(2)] : [0, 0, 0]
    if (text.every((v) => v < 20)) text = [0, 0, 0]

    const hex = (p: [number, number, number]) => `#${p.map((n) => n.toString(16).padStart(2, "0")).join("")}`
    return { textColor: hex(text), bgColor: hex(bg) }
  } catch {
    return fallback
  }
}
