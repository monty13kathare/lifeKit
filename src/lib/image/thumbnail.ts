import { decodeImage, disposeCanvas, encodeCanvas, renderResized } from "./canvas"

export interface ImageInfo {
  width: number
  height: number
  /** Small preview image (JPEG/PNG), cheap to show in grids. */
  thumb: Blob
}

/**
 * Decode an image once to learn its real (EXIF-corrected) dimensions and make
 * a small thumbnail. Throws a friendly error if the browser can't decode it.
 */
export async function readImageInfo(file: Blob, maxSide = 360, transparent = false): Promise<ImageInfo> {
  let img
  try {
    img = await decodeImage(file)
  } catch {
    throw new Error("This browser can't read this image. It may be corrupted or in an unsupported format.")
  }
  try {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
    const canvas = renderResized(img, {
      width: Math.max(1, Math.round(img.width * scale)),
      height: Math.max(1, Math.round(img.height * scale)),
      fit: "stretch",
      background: transparent ? null : "#ffffff",
    })
    try {
      const thumb = transparent ? await encodeCanvas(canvas, "image/png") : await encodeCanvas(canvas, "image/jpeg", 0.8)
      return { width: img.width, height: img.height, thumb }
    } finally {
      disposeCanvas(canvas)
    }
  } finally {
    img.release()
  }
}
