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
  fontFamily: "sans" | "serif" | "mono"
  fontWeight: "normal" | "bold"
  rotation: Rotation
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
  } = await import("pdf-lib")

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
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold)
  const times = await out.embedFont(StandardFonts.TimesRoman)
  const timesBold = await out.embedFont(StandardFonts.TimesRomanBold)
  const courier = await out.embedFont(StandardFonts.Courier)
  const courierBold = await out.embedFont(StandardFonts.CourierBold)
  let replaced = false
  const encodable = new Map<string, boolean>()
  const sanitize = (text: string) =>
    Array.from(text.replace(/\t/g, "    "))
      .map((ch) => {
        let ok = encodable.get(ch)
        if (ok === undefined) {
          try {
            font.encodeText(ch)
            font.widthOfTextAtSize(ch, 10)
            ok = true
          } catch {
            ok = false
          }
          encodable.set(ch, ok)
        }
        if (!ok) replaced = true
        return ok ? ch : "?"
      })
      .join("")

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
    const crop = page.getCropBox()
    const W = crop.width
    const H = crop.height
    const toPdf = (nx: number, ny: number) => ({ x: crop.x + nx * W, y: crop.y + H - ny * H })
    const [VW, VH] = rotation % 180 === 0 ? [W, H] : [H, W]
    const visToPdf = (vx: number, vy: number) => {
      const [nx, ny] = viewToPage(vx / VW, vy / VH, rotation)
      return toPdf(nx, ny)
    }

    for (const a of annotations[meta.id] ?? []) {
      switch (a.type) {
        case "text-replace": {
          // 1. Draw solid background cover over the original text to erase it completely
          // Tiny bleed ensures full coverage of anti-aliased edge pixels without overlapping nearby lines
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

          if (!a.text || !a.text.trim()) break

          // 2. Select matching vector font based on family and weight
          const chosenFont =
            a.fontFamily === "serif"
              ? a.fontWeight === "bold"
                ? timesBold
                : times
              : a.fontFamily === "mono"
                ? a.fontWeight === "bold"
                  ? courierBold
                  : courier
                : a.fontWeight === "bold"
                  ? fontBold
                  : font

          // 3. Draw replacement text in the exact position
          const rad = (a.rotation * Math.PI) / 180
          const down = { x: -Math.sin(rad), y: -Math.cos(rad) }
          const anchor = toPdf(a.x, a.y)
          const baselinePdfY = a.baselineY !== undefined ? crop.y + H - a.baselineY * H : null

          a.text
            .split(/\r?\n/)
            .map(sanitize)
            .forEach((line, li) => {
              if (!line.trim()) return
              const textY =
                baselinePdfY !== null
                  ? baselinePdfY + down.y * (li * a.fontSize * TEXT_LINE_HEIGHT)
                  : anchor.y + down.y * a.fontSize * (TEXT_BASELINE + li * TEXT_LINE_HEIGHT)
              const textX = anchor.x + down.x * (li * a.fontSize * TEXT_LINE_HEIGHT)

              page.drawText(line, {
                x: textX,
                y: textY,
                size: a.fontSize,
                font: chosenFont,
                color: color(a.color),
                rotate: degrees(-a.rotation),
              })
            })
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
  return { bytes: result, replacedCharacters: replaced }
}
