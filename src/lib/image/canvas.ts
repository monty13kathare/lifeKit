/**
 * Canvas helpers shared by the image tools. Everything runs locally in the
 * browser — nothing here makes a network request.
 */
import { canvasToBlob, loadImage } from "@/lib/files"

/** iOS Safari refuses canvases above ~16.7 MP; keep every tool under it. */
export const MAX_CANVAS_PIXELS = 16_777_216
/** Hard per-side limit most browsers share. */
export const MAX_CANVAS_SIDE = 16_384

export type FitMode = "cover" | "contain" | "stretch"
export type Rotation = 0 | 90 | 180 | 270

export interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  /** Free decoded pixel memory. */
  release: () => void
}

/** Decode any browser-readable image, honouring EXIF orientation. */
export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" })
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() }
    } catch {
      // Fall through to <img> decoding (older Safari, some formats).
    }
  }
  const img = await loadImage(blob)
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    release: () => {
      img.src = ""
    },
  }
}

export function checkCanvasSize(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return "Width and height must be at least 1 pixel."
  }
  if (width > MAX_CANVAS_SIDE || height > MAX_CANVAS_SIDE) {
    return `Each side must be ${MAX_CANVAS_SIDE.toLocaleString()} px or less.`
  }
  if (width * height > MAX_CANVAS_PIXELS) {
    return `That's ${((width * height) / 1e6).toFixed(1)} megapixels — too large for browsers to process (max ${(MAX_CANVAS_PIXELS / 1e6).toFixed(1)} MP).`
  }
  return null
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const err = checkCanvasSize(width, height)
  if (err) throw new Error(err)
  const c = document.createElement("canvas")
  c.width = Math.round(width)
  c.height = Math.round(height)
  return c
}

export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Your browser couldn't create an image canvas. Try a smaller image.")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  return ctx
}

/** Release a canvas' backing store early (helps Safari's memory limits). */
export function disposeCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

/**
 * Draw `source` (cropped to sx/sy/sw/sh) into `ctx` at dx/dy/dw/dh, halving the
 * image in steps when shrinking a lot. Step-down halving avoids the aliasing
 * that a single large downscale produces in some browsers.
 */
export function drawHighQuality(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  let src: CanvasImageSource = source
  let cx = sx
  let cy = sy
  let cw = sw
  let ch = sh
  const temps: HTMLCanvasElement[] = []
  while (cw / 2 >= dw && ch / 2 >= dh && cw >= 2 && ch >= 2) {
    const t = document.createElement("canvas")
    t.width = Math.max(1, Math.round(cw / 2))
    t.height = Math.max(1, Math.round(ch / 2))
    context2d(t).drawImage(src, cx, cy, cw, ch, 0, 0, t.width, t.height)
    src = t
    cx = 0
    cy = 0
    cw = t.width
    ch = t.height
    temps.push(t)
  }
  ctx.drawImage(src, cx, cy, cw, ch, dx, dy, dw, dh)
  temps.forEach(disposeCanvas)
}

export interface RenderOptions {
  width: number
  height: number
  fit?: FitMode
  /** Fill colour behind the image (padding / transparency). `null` keeps transparency. */
  background?: string | null
}

/** Resize an image into a new canvas using the given fit mode. */
export function renderResized(img: DecodedImage, { width, height, fit = "stretch", background }: RenderOptions) {
  const W = Math.round(width)
  const H = Math.round(height)
  const canvas = createCanvas(W, H)
  const ctx = context2d(canvas)
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, W, H)
  }
  const iw = img.width
  const ih = img.height
  if (fit === "stretch") {
    drawHighQuality(ctx, img.source, 0, 0, iw, ih, 0, 0, W, H)
  } else if (fit === "cover") {
    const scale = Math.max(W / iw, H / ih)
    const sw = W / scale
    const sh = H / scale
    drawHighQuality(ctx, img.source, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, W, H)
  } else {
    const scale = Math.min(W / iw, H / ih)
    const dw = Math.max(1, Math.round(iw * scale))
    const dh = Math.max(1, Math.round(ih * scale))
    drawHighQuality(ctx, img.source, 0, 0, iw, ih, Math.round((W - dw) / 2), Math.round((H - dh) / 2), dw, dh)
  }
  return canvas
}

/** Draw an image at full size, rotated clockwise by `rotation` degrees. */
export function renderRotated(img: DecodedImage, rotation: Rotation, background?: string | null) {
  const swap = rotation === 90 || rotation === 270
  const W = swap ? img.height : img.width
  const H = swap ? img.width : img.height
  const canvas = createCanvas(W, H)
  const ctx = context2d(canvas)
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, W, H)
  }
  ctx.translate(W / 2, H / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(img.source, -img.width / 2, -img.height / 2)
  return canvas
}

/** Rough check for transparent pixels (samples at most ~4 MP). */
export function hasTransparency(canvas: HTMLCanvasElement): boolean {
  const ctx = context2d(canvas)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = canvas.width * canvas.height
  const step = Math.max(1, Math.floor(pixels / 4_000_000))
  for (let i = 3; i < data.length; i += 4 * step) {
    if (data[i] < 255) return true
  }
  return false
}

/**
 * Encode a canvas, verifying the browser really produced the requested type
 * (Safari silently falls back to PNG for formats it can't encode).
 */
export async function encodeCanvas(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  const blob = await canvasToBlob(canvas, type, quality)
  if (blob.type && blob.type !== type) {
    throw new Error(`This browser can't save images as ${type.replace("image/", "").toUpperCase()}.`)
  }
  return blob
}

/** Turn unknown errors into a sentence suitable for a toast. */
export function friendlyError(err: unknown, fallback = "Something went wrong while processing the image."): string {
  if (err instanceof Error && err.message) {
    if (/memory|allocation|too large/i.test(err.message) && !/megapixels/.test(err.message)) {
      return "Your device ran out of memory. Try a smaller image."
    }
    return err.message
  }
  return fallback
}
