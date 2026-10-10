/**
 * PDF editor model + exporter. Everything runs in the browser; `pdf-lib` is
 * loaded lazily inside `exportEditedPdf` so importing this module is cheap.
 *
 * Coordinate model
 * ----------------
 * Annotations live in *page space*: normalised 0–1 coordinates relative to the
 * page's crop box **before** any rotation is applied, origin top-left, y down.
 * Sizes (font size, stroke width, image size) are in PDF points.
 *
 * A page's `rotation` is its total visual rotation (clockwise, like the PDF
 * `/Rotate` key). The editor renders the unrotated page and rotates it with
 * CSS, so annotations rotate together with the page — exactly what a PDF
 * viewer does with content drawn in page space plus `/Rotate`.
 *
 * Text and images carry their own `rotation` (clockwise, page space) so that
 * they can be upright on screen when placed on a rotated page.
 */

import { LOOKALIKE_SUBSETS, loadLookalikeFile, lookalikeFontId } from "./font-info"
import type { TextSpacing } from "./content-strip"
import type { TextRun } from "./font-reuse"

export type Rotation = 0 | 90 | 180 | 270

export interface EditorPage {
  id: string
  /** 0-based index of the page in the source PDF. */
  srcIndex: number
  /** Unrotated crop-box size in PDF points. */
  width: number
  height: number
  /** Total visual rotation (clockwise). Initialised from the source `/Rotate`. */
  rotation: Rotation
}

export interface TextAnnotation {
  id: string
  type: "text"
  x: number
  y: number
  text: string
  fontSize: number
  color: string
  rotation: Rotation
}

export interface InkAnnotation {
  id: string
  type: "ink"
  points: [number, number][]
  color: string
  /** Stroke width in points. */
  width: number
}

export interface HighlightAnnotation {
  id: string
  type: "highlight"
  x: number
  y: number
  w: number
  h: number
  color: string
}

export interface ImageAnnotation {
  id: string
  type: "image"
  x: number
  y: number
  /** Size in points (in the image's own, possibly rotated, frame). */
  width: number
  height: number
  rotation: Rotation
  /** PNG data URL. */
  src: string
}

export interface TextReplaceAnnotation {
  id: string
  type: "text-replace"
  /** Normalised 0-1 page space coordinates of the cover rectangle */
  x: number
  y: number
  w: number
  h: number
  baselineY?: number
  text: string
  originalText?: string
  fontSize: number
  color: string
  bgColor: string
  /** Fallback family/weight, used when the original font can't draw the new text. */
  fontFamily: "sans" | "serif" | "mono"
  fontWeight: "normal" | "bold"
  rotation: Rotation
  /** Font name of the original text (PDF `/BaseFont`); the exporter re-uses that embedded font. */
  pdfFontName?: string
  /** CSS family of pdf.js's loaded copy of the original font, for the on-screen preview. */
  fontFace?: string
  /** Real family name from the embedded font program, e.g. "Calibri". */
  fontRealFamily?: string
  /** Numeric weight of the original font (400 regular, 700 bold). */
  fontWeightValue?: number
  italic?: boolean
  /** True when `fontFace` is declared with the real weight/style (so CSS weight should match it). */
  faceWeighted?: boolean
  /** Generic CSS family to fall back to on screen ("sans-serif", "serif", "monospace"). */
  fontFallback?: string
  /** Draw with the original embedded font when it has the glyphs (default true). */
  useOriginalFont?: boolean
  /** Original text matrix with the font size divided out: [a, b, c, d]. */
  matrix?: [number, number, number, number]
  /** Distance between baselines for multi-line text, in points. */
  lineGap?: number
  /** Horizontal shift (pt) of the redrawn text, when an edit earlier on the line changed its width. */
  shiftX?: number
  /** Width (pt) a justified line's text should fill (spaces widen/narrow); used on export. */
  targetWidth?: number
  /** Extra word spacing (pt) of a justified original line, for the on-screen preview. */
  wordSpacing?: number
  /** Font ascent/descent in em, used to place the on-screen baseline. */
  ascent?: number
  descent?: number
  /** Original lines this replaces (normalised x/w/baseline, size in pt), removed from the page content on export. */
  stripLines?: { x: number; w: number; baselineY: number; size: number }[]
  /** Id of the editable text line/block this replaces (`…-b3` block or `…-b3-l1` line). */
  sourceId?: string
}

export type Annotation = TextAnnotation | InkAnnotation | HighlightAnnotation | ImageAnnotation | TextReplaceAnnotation
export type AnnotationMap = Record<string, Annotation[]>

export interface WatermarkSettings {
  enabled: boolean
  text: string
  /** 0–1 */
  opacity: number
  fontSize: number
  /** Counter-clockwise visual angle in degrees (45 = diagonal). */
  angle: number
  color: string
}

export type PageNumberPosition = "bottom-center" | "bottom-left" | "bottom-right" | "top-center" | "top-left" | "top-right"
export type PageNumberFormat = "n" | "page-n" | "n-of-total" | "page-n-of-total"

export interface PageNumberSettings {
  enabled: boolean
  position: PageNumberPosition
  format: PageNumberFormat
  start: number
  fontSize: number
  color: string
}

export const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: false,
  text: "CONFIDENTIAL",
  opacity: 0.2,
  fontSize: 64,
  angle: 45,
  color: "#dc2626",
}

export const DEFAULT_PAGE_NUMBERS: PageNumberSettings = {
  enabled: false,
  position: "bottom-center",
  format: "page-n-of-total",
  start: 1,
  fontSize: 11,
  color: "#111827",
}

/** Line height (× font size) shared by the on-screen text and the exporter. */
export const TEXT_LINE_HEIGHT = 1.2
/** Distance from the top of a line box to the baseline (× font size). */
export const TEXT_BASELINE = 0.92
/** Margin of page numbers from the page edge, in points. */
export const PAGE_NUMBER_MARGIN = 28
/** CSS font stack that approximates the PDF's Helvetica. */
export const PDF_FONT_STACK = "Helvetica, Arial, 'Liberation Sans', sans-serif"

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export function normalizeRotation(deg: number): Rotation {
  return ((((Math.round(deg / 90) * 90) % 360) + 360) % 360) as Rotation
}

/** Visual (rotated) size of a page in points. */
export function visualSize(page: Pick<EditorPage, "width" | "height" | "rotation">): [number, number] {
  return page.rotation % 180 === 0 ? [page.width, page.height] : [page.height, page.width]
}

/** Visual normalised (u, v) → page-space normalised (x, y). */
export function viewToPage(u: number, v: number, rotation: Rotation): [number, number] {
  switch (rotation) {
    case 90:
      return [v, 1 - u]
    case 180:
      return [1 - u, 1 - v]
    case 270:
      return [1 - v, u]
    default:
      return [u, v]
  }
}

/** Page-space normalised (x, y) → visual normalised (u, v). */
export function pageToView(x: number, y: number, rotation: Rotation): [number, number] {
  switch (rotation) {
    case 90:
      return [1 - y, x]
    case 180:
      return [1 - x, 1 - y]
    case 270:
      return [y, 1 - x]
    default:
      return [x, y]
  }
}

export function pageNumberLabel(format: PageNumberFormat, n: number, total: number): string {
  switch (format) {
    case "n":
      return String(n)
    case "page-n":
      return `Page ${n}`
    case "n-of-total":
      return `${n} / ${total}`
    default:
      return `Page ${n} of ${total}`
  }
}

export function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [0, 0, 0]
  let h = m[1]
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  const n = parseInt(h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

// ---------------------------------------------------------------------------
// Errors / detection
// ---------------------------------------------------------------------------

export class PdfEditError extends Error {
  constructor(
    public code: "encrypted" | "invalid" | "failed",
    message: string
  ) {
    super(message)
    this.name = "PdfEditError"
  }
}

/**
 * Cheap heuristic: does the file declare an `/Encrypt` dictionary? We look at
 * the head and the tail (trailer / xref stream) rather than parsing the file.
 */
export function looksEncrypted(bytes: ArrayBuffer): boolean {
  const view = new Uint8Array(bytes)
  const decoder = new TextDecoder("latin1")
  const head = decoder.decode(view.subarray(0, Math.min(view.length, 8192)))
  const tail = decoder.decode(view.subarray(Math.max(0, view.length - 131072)))
  return /\/Encrypt\s*\d+\s+\d+\s+R/.test(head) || /\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(tail)
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface ExportInput {
  bytes: ArrayBuffer
  pages: EditorPage[]
  annotations: AnnotationMap
  watermark: WatermarkSettings
  pageNumbers: PageNumberSettings
  onProgress?: (fraction: number, label: string) => void
}

export interface ExportResult {
  bytes: Uint8Array
  /** True when some characters couldn't be encoded in Helvetica and were replaced with "?". */
  replacedCharacters: boolean
  /** Number of text edits where some characters were missing from the embedded font. */
  substitutedFonts: number
  /** True when a look-alike font couldn't be loaded and a standard PDF font was used instead. */
  usedStandardFonts: boolean
}

/**
 * CSS font-family for replaced text: the PDF's own font first, then the real
 * family if installed (e.g. Calibri), then its open look-alike web font, then
 * a generic stack. The browser fills glyphs missing from the subset from the
 * next family, matching what the exporter does.
 */
export function replaceFontCss(
  a: Pick<TextReplaceAnnotation, "fontFace" | "fontFallback" | "fontFamily" | "useOriginalFont" | "fontRealFamily">
) {
  const stack =
    a.fontFamily === "serif"
      ? "'Times New Roman', Times, Georgia, serif"
      : a.fontFamily === "mono"
        ? "'Courier New', Courier, monospace"
        : PDF_FONT_STACK
  const lookalike = lookalikeFontId(a.fontRealFamily)
  const families = [
    a.fontFace && a.useOriginalFont !== false ? `"${a.fontFace}"` : null,
    a.fontRealFamily ? `"${a.fontRealFamily.replace(/"/g, "")}"` : null,
    lookalike ? `"lk-fb-${lookalike}"` : null,
    stack,
  ]
  return families.filter(Boolean).join(", ")
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

export async function exportEditedPdf({
  bytes,
  pages,
  annotations,
  watermark,
  pageNumbers,
  onProgress,
}: ExportInput): Promise<ExportResult> {
  const progress = (f: number, label: string) => onProgress?.(Math.max(0, Math.min(1, f)), label)
  progress(0.02, "Loading PDF tools…")
  const lib = await import("pdf-lib")
  const {
    PDFDocument,
    StandardFonts,
    rgb,
    degrees,
    BlendMode,
    LineCapStyle,
    LineJoinStyle,
    setLineJoin,
    pushGraphicsState,
    popGraphicsState,
  } = lib
  const { findReusableFont } = await import("./font-reuse")
  const { stripOriginalText } = await import("./content-strip")
  const standardWidths = await import("./standard-metrics").then((m) => m.loadStandardWidths()).catch(() => undefined)

  progress(0.06, "Reading the original file…")
  await tick()
  let src: Awaited<ReturnType<typeof PDFDocument.load>>
  try {
    src = await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (err) {
    if (err instanceof Error && err.name === "EncryptedPDFError") {
      throw new PdfEditError(
        "encrypted",
        "This PDF is encrypted (it has a password or editing restrictions), so an edited copy can't be saved. Remove the protection in the app that created it and try again."
      )
    }
    throw new PdfEditError("invalid", "This PDF couldn't be parsed for saving. It may be damaged.")
  }

  const out = await PDFDocument.create({ updateMetadata: false })
  out.setProducer("LifeKit PDF Editor")
  out.setCreator("LifeKit")
  const title = src.getTitle()
  if (title) out.setTitle(title)

  progress(0.12, "Copying pages…")
  await tick()
  // Copy first occurrences in one batch (shares fonts/images); duplicates get
  // their own copy so that drawing on one doesn't leak into the other.
  const seen = new Set<number>()
  const firstIdx: number[] = []
  for (const p of pages) {
    if (!seen.has(p.srcIndex)) {
      seen.add(p.srcIndex)
      firstIdx.push(p.srcIndex)
    }
  }
  const firstCopies = await out.copyPages(src, firstIdx)
  const firstMap = new Map(firstIdx.map((idx, i) => [idx, firstCopies[i]]))
  const used = new Set<number>()
  const outPages = []
  for (const p of pages) {
    let copy = firstMap.get(p.srcIndex)!
    if (used.has(p.srcIndex)) [copy] = await out.copyPages(src, [p.srcIndex])
    used.add(p.srcIndex)
    outPages.push(out.addPage(copy))
  }

  const font = await out.embedFont(StandardFonts.Helvetica)
  let replaced = false
  let substituted = 0
  let usedStandard = false
  type EmbeddedFont = typeof font
  type PdfPage = ReturnType<typeof out.addPage>

  // Standard fonts by family/weight/style, embedded on first use.
  const standards = new Map<string, Promise<EmbeddedFont>>()
  const standardFor = (a: TextReplaceAnnotation) => {
    const bold = (a.fontWeightValue ?? (a.fontWeight === "bold" ? 700 : 400)) >= 600
    const italic = Boolean(a.italic)
    const name =
      a.fontFamily === "serif"
        ? [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic]
        : a.fontFamily === "mono"
          ? [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique]
          : [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique]
    const pick = name[(bold ? 1 : 0) + (italic ? 2 : 0)]
    if (!standards.has(pick)) standards.set(pick, out.embedFont(pick))
    return standards.get(pick)!
  }

  // Look-alike open fonts (e.g. Carlito for Calibri) for glyphs a subset lacks.
  const lookalikes = new Map<string, Promise<EmbeddedFont | null>>()
  let fontkitRegistered = false
  const lookalikeFor = async (a: TextReplaceAnnotation, text: string): Promise<EmbeddedFont | null> => {
    const id = lookalikeFontId(a.fontRealFamily)
    if (!id) return null
    const weight = a.fontWeightValue ?? (a.fontWeight === "bold" ? 700 : 400)
    const italic = Boolean(a.italic)
    for (const subset of LOOKALIKE_SUBSETS) {
      const file = await loadLookalikeFile(id, weight, italic, subset)
      if (!file) continue
      if (!Array.from(text).every((ch) => /\s/.test(ch) || file.has(ch.codePointAt(0)!))) continue
      const key = `${id}:${weight}:${italic}:${subset}`
      if (!lookalikes.has(key)) {
        lookalikes.set(
          key,
          (async () => {
            if (!fontkitRegistered) {
              out.registerFontkit((await import("@pdf-lib/fontkit")).default)
              fontkitRegistered = true
            }
            return out.embedFont(file.bytes, { subset: false })
          })().catch(() => null)
        )
      }
      const f = await lookalikes.get(key)!
      if (f) return f
    }
    return null
  }

  // One resource name per font per page.
  const fontKeys = new WeakMap<object, Map<EmbeddedFont, ReturnType<PdfPage["node"]["newFontDictionary"]>>>()
  const fontKey = (page: PdfPage, f: EmbeddedFont) => {
    let m = fontKeys.get(page)
    if (!m) fontKeys.set(page, (m = new Map()))
    let k = m.get(f)
    if (!k) m.set(f, (k = page.node.newFontDictionary(f.name, f.ref)))
    return k
  }

  const encodable = new Map<string, boolean>()
  const sanitizeFor = (f: EmbeddedFont, text: string) =>
    Array.from(text.replace(/\t/g, "    "))
      .map((ch) => {
        const cacheKey = `${f.name}\u0000${ch}`
        let ok = encodable.get(cacheKey)
        if (ok === undefined) {
          try {
            f.encodeText(ch)
            f.widthOfTextAtSize(ch, 10)
            ok = true
          } catch {
            ok = false
          }
          encodable.set(cacheKey, ok)
        }
        if (!ok) replaced = true
        return ok ? ch : "?"
      })
      .join("")
  const sanitize = (text: string) => sanitizeFor(font, text)

  const color = (hex: string) => {
    const [r, g, b] = hexToRgb01(hex)
    return rgb(r, g, b)
  }

  const images = new Map<string, Awaited<ReturnType<typeof out.embedPng>>>()
  const total = pages.length
  const wmText = watermark.enabled ? sanitize(watermark.text.trim()) : ""
  const numberTotal = pageNumbers.start + total - 1

  for (let i = 0; i < total; i++) {
    const meta = pages[i]
    const page = outPages[i]
    progress(0.15 + (0.7 * i) / total, `Applying edits to page ${i + 1} of ${total}…`)
    if (i % 5 === 0) await tick()

    const rotation = meta.rotation
    page.setRotation(degrees(rotation))
    const pageAnnotations = annotations[meta.id] ?? []
    const crop = page.getCropBox()
    const W = crop.width
    const H = crop.height

    // Remove the original glyphs of edited lines from the content itself.
    // Lines we can't remove safely keep a cover box instead.
    const cleanReplace = new Set<string>()
    const spacingFor = new Map<string, TextSpacing>()
    const stripped = pageAnnotations.filter(
      (a): a is TextReplaceAnnotation => a.type === "text-replace" && Boolean(a.pdfFontName && a.stripLines?.length)
    )
    if (stripped.length) {
      const owners: string[] = []
      const targets = stripped.flatMap((a) =>
        a.stripLines!.map((l) => {
          owners.push(a.id)
          return {
            x0: crop.x + l.x * W,
            x1: crop.x + (l.x + l.w) * W,
            baseline: crop.y + H - l.baselineY * H,
            fontSize: l.size,
            fontName: a.pdfFontName!,
          }
        })
      )
      try {
        page.node.normalize()
        const { clean, spacing } = stripOriginalText(lib, out, page, targets, standardWidths)
        owners.forEach((id, k) => {
          const sp = spacing[k]
          if (sp && !spacingFor.has(id)) spacingFor.set(id, sp)
        })
        for (const a of stripped) {
          if (owners.every((id, k) => id !== a.id || clean[k])) cleanReplace.add(a.id)
        }
      } catch {
        // leave the content as is; covers are drawn below
      }
    }

    if (pageAnnotations.length || wmText || pageNumbers.enabled) {
      // Isolate the original content so an unbalanced transform in it can't shift our drawing.
      page.node.normalize()
      const start = out.context.register(out.context.flateStream("q\n"))
      const end = out.context.register(out.context.flateStream("\nQ\n"))
      page.node.wrapContentStreams(start, end)
    }
    const reusable = new Map<string, ReturnType<typeof findReusableFont>>()
    const originalFont = (name: string) => {
      if (!reusable.has(name)) {
        let f: ReturnType<typeof findReusableFont> = null
        try {
          f = findReusableFont(lib, out, page, name)
        } catch {
          f = null
        }
        reusable.set(name, f)
      }
      return reusable.get(name)!
    }
    const toPdf = (nx: number, ny: number) => ({ x: crop.x + nx * W, y: crop.y + H - ny * H })
    const [VW, VH] = rotation % 180 === 0 ? [W, H] : [H, W]
    const visToPdf = (vx: number, vy: number) => {
      const [nx, ny] = viewToPage(vx / VW, vy / VH, rotation)
      return toPdf(nx, ny)
    }

    // Covers for text we couldn't remove from the content, all drawn before any
    // redrawn text so a cover never hides text that was moved next to it.
    for (const a of pageAnnotations) {
      if (a.type !== "text-replace" || cleanReplace.has(a.id)) continue
      const bleedX = 1
      const bleedY = 1.2
      page.drawRectangle({
        x: crop.x + a.x * W - bleedX,
        y: crop.y + H - (a.y + a.h) * H - bleedY,
        width: a.w * W + bleedX * 2,
        height: a.h * H + bleedY * 2,
        color: color(a.bgColor || "#ffffff"),
        opacity: 1,
      })
    }

    for (const a of pageAnnotations) {
      switch (a.type) {
        case "text-replace": {
          // 1. The original text was removed above, or covered in the pass before this loop.
          if (!a.text || !a.text.trim()) break

          // 2. Redraw the text at the original text matrix. Characters the
          //    embedded font has use that font; any it lacks use a look-alike.
          const lineGap = a.lineGap ?? a.fontSize * TEXT_LINE_HEIGHT
          const [ma, mb, mc, md] = a.matrix ?? [1, 0, 0, 1]
          const upLen = Math.hypot(mc, md) || 1
          const up = { x: mc / upLen, y: md / upLen }
          // shiftX: moved along the line because an earlier edit on it changed width.
          const x0 = crop.x + a.x * W + (a.shiftX ?? 0)
          const y0 =
            a.baselineY !== undefined ? crop.y + H - a.baselineY * H : crop.y + H - a.y * H - a.fontSize * TEXT_BASELINE
          const reuse = a.pdfFontName && a.useOriginalFont !== false ? originalFont(a.pdfFontName) : null
          const [r, g, b] = hexToRgb01(a.color)
          page.pushOperators(
            pushGraphicsState(),
            lib.beginText(),
            lib.setFillingRgbColor(r, g, b),
            // Keep the original letter/word spacing (e.g. tracked headings).
            lib.setCharacterSpacing(spacingFor.get(a.id)?.charSpacing ?? 0),
            lib.setWordSpacing(spacingFor.get(a.id)?.wordSpacing ?? 0),
            lib.setCharacterSqueeze(100),
            lib.setTextRise(0),
            lib.setTextRenderingMode(lib.TextRenderingMode.Fill)
          )
          let borrowed = false
          const lines = a.text.split(/\r?\n/)
          const originalLines = (a.originalText ?? "").split(/\r?\n/)
          const spaces = (t: string) => (t.match(/ /g) ?? []).length
          const tracking = (t: string) => (spacingFor.get(a.id)?.charSpacing ?? 0) * Array.from(t).length
          for (let li = 0; li < lines.length; li++) {
            const line = lines[li]
            if (!line.trim()) continue
            const plain: TextRun[] = reuse ? reuse.encodeRuns(line) : [{ kind: "missing", text: line }]
            // Resolve fonts for characters the original font lacks.
            const fallbacks = new Map<number, { f: EmbeddedFont; text: string; look: boolean }>()
            for (let k = 0; k < plain.length; k++) {
              const run = plain[k]
              if (run.kind !== "missing") continue
              if (reuse) borrowed = true
              const look = await lookalikeFor(a, run.text)
              const f = look ?? (await standardFor(a))
              if (!look) usedStandard = true
              fallbacks.set(k, { f, text: look ? run.text : sanitizeFor(f, run.text), look: Boolean(look) })
            }

            // Justified original line: keep its width by widening the spaces.
            let spaceExtra = 0
            const strip = a.stripLines?.length === lines.length ? a.stripLines[li] : undefined
            const orig = originalLines.length === lines.length ? originalLines[li] : undefined
            if (reuse && strip && orig !== undefined && Math.abs(strip.size - a.fontSize) < 0.01 && spaces(orig) && spaces(line)) {
              const sx = Math.hypot(ma, mb) || 1
              const actual = (strip.w * W) / sx
              const perSpace = (actual - (reuse.measure(orig) * a.fontSize) / 1000 - tracking(orig)) / spaces(orig)
              // Reflowed lines say how wide this piece should now be; otherwise keep the original width.
              const target = lines.length === 1 && a.targetWidth !== undefined ? a.targetWidth / sx : actual
              if (Number.isFinite(perSpace) && perSpace > a.fontSize * 0.03) {
                let natural = (reuse.measure(line) * a.fontSize) / 1000 + tracking(line)
                for (const fb of fallbacks.values()) natural += fb.f.widthOfTextAtSize(fb.text, a.fontSize)
                // Same rule as the on-screen reflow: fill the target width (capped so a nearly empty line stays readable).
                const extra = Math.min(a.fontSize * 2, Math.max(0, (target - natural) / spaces(line)))
                spaceExtra = (extra * 1000) / a.fontSize
              }
            }
            const runs = spaceExtra && reuse ? reuse.encodeRuns(line, spaceExtra) : plain

            page.pushOperators(lib.setTextMatrix(ma, mb, mc, md, x0 - up.x * lineGap * li, y0 - up.y * lineGap * li))
            for (let k = 0; k < runs.length; k++) {
              const run = runs[k]
              if (run.kind === "original") {
                const arr = out.context.obj([])
                for (const p of run.pieces) arr.push("hex" in p ? lib.PDFHexString.of(p.hex) : lib.PDFNumber.of(-p.gap))
                page.pushOperators(
                  lib.setFontAndSize(reuse!.key, a.fontSize),
                  lib.PDFOperator.of(lib.PDFOperatorNames.ShowTextAdjusted, [arr])
                )
                continue
              }
              // Runs line up 1:1 with `plain`: spacing only changes inside original-font runs.
              const fb = fallbacks.get(k)
              if (!fb) continue
              page.pushOperators(lib.setFontAndSize(fontKey(page, fb.f), a.fontSize), lib.showText(fb.f.encodeText(fb.text)))
            }
          }
          page.pushOperators(lib.endText(), popGraphicsState())
          if (borrowed) substituted++
          break
        }
        case "highlight": {
          page.drawRectangle({
            x: crop.x + a.x * W,
            y: crop.y + H - (a.y + a.h) * H,
            width: a.w * W,
            height: a.h * H,
            color: color(a.color),
            opacity: 0.4,
            blendMode: BlendMode.Multiply,
          })
          break
        }
        case "ink": {
          if (!a.points.length) break
          const pts = a.points.length === 1 ? [a.points[0], [a.points[0][0] + 0.0005, a.points[0][1]]] : a.points
          const d = pts.map(([nx, ny], j) => `${j ? "L" : "M"}${(nx * W).toFixed(2)} ${(ny * H).toFixed(2)}`).join(" ")
          page.pushOperators(pushGraphicsState(), setLineJoin(LineJoinStyle.Round))
          page.drawSvgPath(d, {
            x: crop.x,
            y: crop.y + H,
            borderColor: color(a.color),
            borderWidth: a.width,
            borderLineCap: LineCapStyle.Round,
          })
          page.pushOperators(popGraphicsState())
          break
        }
        case "text": {
          const rad = (a.rotation * Math.PI) / 180
          // "Down" in the text's frame, expressed in PDF space (y up).
          const down = { x: -Math.sin(rad), y: -Math.cos(rad) }
          const anchor = toPdf(a.x, a.y)
          a.text
            .split(/\r?\n/)
            .map(sanitize)
            .forEach((line, li) => {
              if (!line.trim()) return
              const off = a.fontSize * (TEXT_BASELINE + li * TEXT_LINE_HEIGHT)
              page.drawText(line, {
                x: anchor.x + down.x * off,
                y: anchor.y + down.y * off,
                size: a.fontSize,
                font,
                color: color(a.color),
                rotate: degrees(-a.rotation),
              })
            })
          break
        }
        case "image": {
          let img = images.get(a.src)
          if (!img) {
            img = await out.embedPng(a.src)
            images.set(a.src, img)
          }
          const rad = (a.rotation * Math.PI) / 180
          const down = { x: -Math.sin(rad), y: -Math.cos(rad) }
          const anchor = toPdf(a.x, a.y)
          page.drawImage(img, {
            x: anchor.x + down.x * a.height,
            y: anchor.y + down.y * a.height,
            width: a.width,
            height: a.height,
            rotate: degrees(-a.rotation),
          })
          break
        }
      }
    }

    if (wmText) {
      const size = watermark.fontSize
      const tw = font.widthOfTextAtSize(wmText, size)
      const capH = font.heightAtSize(size, { descender: false })
      const c = visToPdf(VW / 2, VH / 2)
      const ang = ((watermark.angle + rotation) * Math.PI) / 180
      const dir = { x: Math.cos(ang), y: Math.sin(ang) }
      const perp = { x: -Math.sin(ang), y: Math.cos(ang) }
      page.drawText(wmText, {
        x: c.x - (dir.x * tw) / 2 - (perp.x * capH) / 2,
        y: c.y - (dir.y * tw) / 2 - (perp.y * capH) / 2,
        size,
        font,
        color: color(watermark.color),
        opacity: Math.max(0.02, Math.min(1, watermark.opacity)),
        rotate: degrees(watermark.angle + rotation),
      })
    }

    if (pageNumbers.enabled) {
      const label = pageNumberLabel(pageNumbers.format, pageNumbers.start + i, numberTotal)
      const size = pageNumbers.fontSize
      const tw = font.widthOfTextAtSize(label, size)
      const capH = font.heightAtSize(size, { descender: false })
      const [vertical, horizontal] = pageNumbers.position.split("-") as ["top" | "bottom", "left" | "center" | "right"]
      const m = PAGE_NUMBER_MARGIN
      const vx = horizontal === "left" ? m : horizontal === "right" ? VW - m - tw : (VW - tw) / 2
      const vy = vertical === "top" ? m + capH : VH - m
      const p = visToPdf(vx, vy)
      page.drawText(label, { x: p.x, y: p.y, size, font, color: color(pageNumbers.color), rotate: degrees(rotation) })
    }
  }

  progress(0.88, "Building the file…")
  await tick()
  const result = await out.save({ objectsPerTick: 100 })
  progress(1, "Done")
  return { bytes: result, replacedCharacters: replaced, substitutedFonts: substituted, usedStandardFonts: usedStandard }
}
