"use client"

import { canvasToBlob, loadImage } from "@/lib/files"
import type { Pixels } from "./types"

/** Longest side kept for source photos (keeps memory sane on phones). */
export const SOURCE_MAX = 3000
/** Longest side of frames analysed by the document detector. */
export const DETECT_MAX = 360

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  return c
}

function ctx2d(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas isn't available in this browser.")
  return ctx
}

const fit = (w: number, h: number, max: number) => {
  const s = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) }
}

/** Draw any image source scaled to fit `maxSide` and return the canvas. */
export function drawScaled(src: CanvasImageSource, sw: number, sh: number, maxSide: number): HTMLCanvasElement {
  const { w, h } = fit(sw, sh, maxSide)
  const c = makeCanvas(w, h)
  const ctx = ctx2d(c)
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(src, 0, 0, w, h)
  return c
}

export function canvasPixels(c: HTMLCanvasElement): Pixels {
  const img = ctx2d(c).getImageData(0, 0, c.width, c.height)
  return { width: img.width, height: img.height, data: img.data }
}

export function pixelsToCanvas(p: Pixels, target?: HTMLCanvasElement): HTMLCanvasElement {
  const c = target ?? makeCanvas(p.width, p.height)
  c.width = p.width
  c.height = p.height
  const data = new Uint8ClampedArray(p.data.buffer as ArrayBuffer, p.data.byteOffset, p.data.length)
  ctx2d(c).putImageData(new ImageData(data, p.width, p.height), 0, 0)
  return c
}

export function pixelsToBlob(p: Pixels, type = "image/jpeg", quality = 0.92): Promise<Blob> {
  return canvasToBlob(pixelsToCanvas(p), type, quality)
}

interface Decoded {
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}

/** Decode a Blob, honouring EXIF orientation where the browser supports it. */
export async function decodeBlob(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" })
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
    } catch {
      // fall through to <img> decoding
    }
  }
  const img = await loadImage(blob)
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} }
}

export async function blobToPixels(blob: Blob, maxSide = Infinity): Promise<Pixels> {
  const d = await decodeBlob(blob)
  try {
    return canvasPixels(drawScaled(d.source, d.width, d.height, maxSide))
  } finally {
    d.close()
  }
}

export interface PreparedSource {
  blob: Blob
  width: number
  height: number
  /** Small frame for the detector. */
  detect: Pixels
}

/** Normalise an uploaded/captured image: cap its size, re-encode as JPEG, make a detector frame. */
export async function prepareSource(input: Blob | CanvasImageSource, w?: number, h?: number): Promise<PreparedSource> {
  let decoded: Decoded
  if (input instanceof Blob) {
    try {
      decoded = await decodeBlob(input)
    } catch {
      throw new Error("This image couldn't be read. Try a JPG, PNG or WebP photo.")
    }
  } else {
    decoded = { source: input, width: w ?? 0, height: h ?? 0, close: () => {} }
  }
  try {
    if (!decoded.width || !decoded.height) throw new Error("This image is empty.")
    const big = drawScaled(decoded.source, decoded.width, decoded.height, SOURCE_MAX)
    const blob = await canvasToBlob(big, "image/jpeg", 0.92)
    const detect = canvasPixels(drawScaled(big, big.width, big.height, DETECT_MAX))
    return { blob, width: big.width, height: big.height, detect }
  } finally {
    decoded.close()
  }
}

/** Small JPEG data for thumbnails. */
export async function thumbnailBlob(p: Pixels, maxSide = 320): Promise<Blob> {
  const full = pixelsToCanvas(p)
  return canvasToBlob(drawScaled(full, full.width, full.height, maxSide), "image/jpeg", 0.8)
}
