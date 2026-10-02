import { decodeImage, disposeCanvas, encodeCanvas, hasTransparency, renderRotated, type Rotation } from "@/lib/image/canvas"
import { readJpegOrientation } from "@/lib/image/exif"
import { mimeOf } from "@/lib/image/formats"

export type PageSize = "a4" | "letter" | "legal" | "fit"
export type PageOrientation = "auto" | "portrait" | "landscape"
export type PageMargin = "none" | "small" | "medium" | "large"

export interface PdfOptions {
  pageSize: PageSize
  orientation: PageOrientation
  margin: PageMargin
  title?: string
}

export interface PdfSource {
  file: File
  rotation: Rotation
}

/** Page sizes in PDF points (1/72 inch). */
const SIZES: Record<Exclude<PageSize, "fit">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
}

/** Margins in points: 0, ¼", ½", 1". */
export const MARGIN_PT: Record<PageMargin, number> = { none: 0, small: 18, medium: 36, large: 72 }

/** CSS px → PDF pt at 96 dpi, used for "Fit to image" pages. */
const PX_TO_PT = 0.75

interface Prepared {
  bytes: Uint8Array
  kind: "jpg" | "png"
}

/**
 * Get bytes pdf-lib can embed (JPG/PNG). Untouched JPG/PNG files are embedded
 * as-is (no quality loss); rotated, EXIF-rotated or other formats go through a canvas.
 */
async function prepare({ file, rotation }: PdfSource, forceCanvas = false): Promise<Prepared> {
  const mime = mimeOf(file)
  if (!forceCanvas && rotation === 0 && (mime === "image/png" || mime === "image/jpeg")) {
    const buf = await file.arrayBuffer()
    if (mime === "image/png") return { bytes: new Uint8Array(buf), kind: "png" }
    if (readJpegOrientation(buf) === 1) return { bytes: new Uint8Array(buf), kind: "jpg" }
  }
  const img = await decodeImage(file)
  try {
    const canvas = renderRotated(img, rotation)
    try {
      const keepPng = mime === "image/png" || (mime !== "image/jpeg" && hasTransparency(canvas))
      const blob = keepPng
        ? await encodeCanvas(canvas, "image/png")
        : await encodeCanvas(canvas, "image/jpeg", 0.92)
      return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: keepPng ? "png" : "jpg" }
    } finally {
      disposeCanvas(canvas)
    }
  } finally {
    img.release()
  }
}

export async function buildPdf(
  sources: PdfSource[],
  options: PdfOptions,
  onProgress?: (done: number, total: number) => void
): Promise<{ blob: Blob; pages: number }> {
  const { PDFDocument } = await import("pdf-lib")
  const pdf = await PDFDocument.create()
  pdf.setTitle(options.title || "Images")
  pdf.setCreator("LifeKit")
  pdf.setProducer("LifeKit (pdf-lib)")

  const margin = MARGIN_PT[options.margin]
  const total = sources.length

  for (let i = 0; i < total; i++) {
    onProgress?.(i, total)
    // Let the progress UI paint between images.
    await new Promise((r) => setTimeout(r, 0))

    const src = sources[i]
    let embedded
    try {
      const prepared = await prepare(src)
      embedded = prepared.kind === "png" ? await pdf.embedPng(prepared.bytes) : await pdf.embedJpg(prepared.bytes)
    } catch {
      // Some PNG/JPEG variants trip pdf-lib — re-encode via canvas and retry once.
      try {
        const prepared = await prepare(src, true)
        embedded = prepared.kind === "png" ? await pdf.embedPng(prepared.bytes) : await pdf.embedJpg(prepared.bytes)
      } catch {
        throw new Error(`“${src.file.name}” couldn't be added. It may be corrupted or in an unsupported format.`)
      }
    }

    const iw = embedded.width * PX_TO_PT
    const ih = embedded.height * PX_TO_PT
    let pw: number
    let ph: number
    if (options.pageSize === "fit") {
      pw = iw + margin * 2
      ph = ih + margin * 2
    } else {
      ;[pw, ph] = SIZES[options.pageSize]
      const landscape = options.orientation === "landscape" || (options.orientation === "auto" && iw > ih)
      if (landscape) [pw, ph] = [ph, pw]
    }
    const boxW = pw - margin * 2
    const boxH = ph - margin * 2
    const scale = Math.min(boxW / iw, boxH / ih)
    const w = iw * scale
    const h = ih * scale
    const page = pdf.addPage([pw, ph])
    page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
  }

  onProgress?.(total, total)
  const bytes = await pdf.save()
  return { blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), pages: pdf.getPageCount() }
}
