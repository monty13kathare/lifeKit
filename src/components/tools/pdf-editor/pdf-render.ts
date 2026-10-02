import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist"

/**
 * Cancellable page renderer. Unlike the shared `renderPdfPage` helper this one
 * takes an explicit rotation (the editor renders pages unrotated and rotates
 * them with CSS) and can be cancelled when the zoom/page changes mid-render.
 */
export function renderPage(doc: PDFDocumentProxy, pageNumber: number, scale: number, rotation = 0) {
  let task: RenderTask | null = null
  let cancelled = false
  const promise = (async (): Promise<HTMLCanvasElement | null> => {
    const page = await doc.getPage(pageNumber)
    if (cancelled) return null
    const viewport = page.getViewport({ scale, rotation })
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    task = page.render({ canvas, viewport })
    try {
      await task.promise
    } catch (err) {
      if (cancelled || (err instanceof Error && err.name === "RenderingCancelledException")) return null
      throw err
    }
    return cancelled ? null : canvas
  })()
  return {
    promise,
    cancel() {
      cancelled = true
      task?.cancel()
    },
  }
}

/** Limits concurrent thumbnail renders so a long document doesn't flood the worker. */
const MAX_CONCURRENT = 2
let active = 0
const queue: (() => void)[] = []

export async function withRenderSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => queue.push(resolve))
  active++
  try {
    return await fn()
  } finally {
    active--
    queue.shift()?.()
  }
}

/** Keep canvases under ~16 MP (iOS Safari's hard limit). */
export function capScale(width: number, height: number, scale: number, maxPixels = 16_000_000) {
  const pixels = width * scale * height * scale
  return pixels > maxPixels ? scale * Math.sqrt(maxPixels / pixels) : scale
}
