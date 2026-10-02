"use client"

import { canvasToBlob } from "@/lib/files"
import { detectQuad, enhancePixels, warpQuad } from "./client"
import { denormalize, insetQuad, isConvex, orderQuad, outputSize } from "./geometry"
import { blobToPixels, drawScaled, pixelsToBlob, pixelsToCanvas, prepareSource, thumbnailBlob } from "./image"
import { DEFAULT_ENHANCE, type EnhanceSettings, type Pixels, type Quad } from "./types"

/** Max long side of a perspective-corrected page (~A4 at 290 dpi). */
export const PAGE_MAX = 2400
/** Max long side of the live enhance preview. */
export const PREVIEW_MAX = 1000

export interface ScanPage {
  id: string
  source: Blob
  sourceUrl: string
  sourceW: number
  sourceH: number
  /** Normalised crop corners (TL, TR, BR, BL). */
  quad: Quad
  /** Detector result, used by "Auto detect". */
  autoQuad: Quad
  confidence: number
  settings: EnhanceSettings
  /** Perspective-corrected, un-enhanced page. */
  warped?: Blob
  /** Final page image (JPEG). */
  processed?: Blob
  processedW?: number
  processedH?: number
  thumbUrl?: string
  status: "new" | "processing" | "ready" | "error"
  error?: string
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** Decode, normalise and auto-detect the document in a photo. */
export async function createPage(
  input: Blob | CanvasImageSource,
  w?: number,
  h?: number,
  knownQuad?: { quad: Quad; confidence: number }
): Promise<ScanPage> {
  const src = await prepareSource(input, w, h)
  let det = knownQuad
  if (!det) {
    try {
      det = await detectQuad(src.detect)
    } catch {
      det = { quad: insetQuad(0.05), confidence: 0 }
    }
  }
  return {
    id: uid(),
    source: src.blob,
    sourceUrl: URL.createObjectURL(src.blob),
    sourceW: src.width,
    sourceH: src.height,
    quad: det.quad,
    autoQuad: det.quad,
    confidence: det.confidence,
    settings: { ...DEFAULT_ENHANCE },
    status: "new",
  }
}

/** Re-run detection on an existing page's source. */
export async function redetect(page: ScanPage) {
  const px = await blobToPixels(page.source, 360)
  return detectQuad(px)
}

export interface WarpOutput {
  warped: Blob
  preview: Pixels
}

/** Perspective-correct a page using its (normalised) quad. */
export async function warpPage(page: Pick<ScanPage, "source">, quad: Quad): Promise<WarpOutput> {
  const ordered = orderQuad(quad)
  if (!isConvex(ordered)) throw new Error("The corners cross over. Drag them so they outline the page.")
  const src = await blobToPixels(page.source)
  const q = denormalize(ordered, src.width - 1, src.height - 1)
  const { width, height } = outputSize(q, PAGE_MAX)
  const res = await warpQuad(src, q, width, height, PREVIEW_MAX)
  const warped = await pixelsToBlob(res.full, "image/jpeg", 0.95)
  return { warped, preview: res.preview ?? res.full }
}

export interface RenderOutput {
  processed: Blob
  processedW: number
  processedH: number
  thumb: Blob
}

/** Apply enhancement settings at full resolution. */
export async function renderPage(warped: Blob, settings: EnhanceSettings): Promise<RenderOutput> {
  const px = await blobToPixels(warped)
  const out = await enhancePixels(px, settings)
  const [processed, thumb] = await Promise.all([pixelsToBlob(out, "image/jpeg", 0.92), thumbnailBlob(out)])
  return { processed, processedW: out.width, processedH: out.height, thumb }
}

/** Crop + warp + enhance in one go (batch uploads, quick-capture mode). */
export async function processPage(page: ScanPage): Promise<ScanPage> {
  const { warped } = await warpPage(page, page.quad)
  const r = await renderPage(warped, page.settings)
  return {
    ...page,
    warped,
    processed: r.processed,
    processedW: r.processedW,
    processedH: r.processedH,
    thumbUrl: URL.createObjectURL(r.thumb),
    status: "ready",
    error: undefined,
  }
}

export function revokePage(page: ScanPage) {
  URL.revokeObjectURL(page.sourceUrl)
  if (page.thumbUrl) URL.revokeObjectURL(page.thumbUrl)
}

// ---------------------------------------------------------------- PDF

export type PageSize = "a4" | "letter" | "fit"
export type PdfQuality = "high" | "balanced" | "small"

const SIZES: Record<Exclude<PageSize, "fit">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
}

const QUALITY: Record<PdfQuality, { q: number; max: number }> = {
  high: { q: 0.9, max: PAGE_MAX },
  balanced: { q: 0.78, max: 2000 },
  small: { q: 0.6, max: 1500 },
}

export async function buildPdf(
  pages: { blob: Blob; width: number; height: number }[],
  opts: { size: PageSize; quality: PdfQuality; title?: string },
  onProgress?: (done: number, total: number) => void
): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib")
  const doc = await PDFDocument.create()
  doc.setTitle(opts.title ?? "Scanned document")
  doc.setCreator("LifeKit PDF Scanner")
  doc.setProducer("LifeKit")
  const { q, max } = QUALITY[opts.quality]

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    let jpeg: Blob = p.blob
    if (opts.quality !== "high" || Math.max(p.width, p.height) > max) {
      const px = await blobToPixels(p.blob)
      const c = pixelsToCanvas(px)
      jpeg = await canvasToBlob(drawScaled(c, c.width, c.height, max), "image/jpeg", q)
    }
    const img = await doc.embedJpg(new Uint8Array(await jpeg.arrayBuffer()))
    const landscape = img.width > img.height
    let pw: number
    let ph: number
    if (opts.size === "fit") {
      // assume ~200 dpi so a full-page scan lands near A4 size
      pw = (img.width * 72) / 200
      ph = (img.height * 72) / 200
    } else {
      const [a, b] = SIZES[opts.size]
      ;[pw, ph] = landscape ? [b, a] : [a, b]
    }
    const page = doc.addPage([pw, ph])
    const s = Math.min(pw / img.width, ph / img.height)
    const dw = img.width * s
    const dh = img.height * s
    page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh })
    onProgress?.(i + 1, pages.length)
    await new Promise((r) => setTimeout(r, 0))
  }
  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: "application/pdf" })
}
