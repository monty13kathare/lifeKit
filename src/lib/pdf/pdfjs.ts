/**
 * Lazy pdf.js loader shared by the PDF editor, OCR and other PDF consumers.
 * Always `await loadPdfJs()` inside an event handler/effect — never import
 * `pdfjs-dist` at module top level, so it stays out of other pages' bundles.
 */
type PdfJs = typeof import("pdfjs-dist")

let promise: Promise<PdfJs> | null = null

export function loadPdfJs(): Promise<PdfJs> {
  if (!promise) {
    // The legacy build bundles polyfills for very new JS APIs the modern build
    // assumes (e.g. Uint8Array.prototype.toHex, used by the worker), which many
    // current browsers don't ship yet. Main library and worker must match.
    promise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString()
      return pdfjs as unknown as PdfJs
    })
  }
  return promise
}

/**
 * Open a PDF from bytes. Pass a copy if you still need the original buffer (pdf.js detaches it).
 * `keepFontData` keeps each embedded font's program in memory (the PDF editor reads it to match fonts).
 */
export async function openPdf(data: ArrayBuffer | Uint8Array, opts: { keepFontData?: boolean } = {}) {
  const pdfjs = await loadPdfJs()
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  return pdfjs.getDocument({ data: bytes, fontExtraProperties: Boolean(opts.keepFontData) }).promise
}

/** Render one page (1-based) to a canvas at the given scale. */
export async function renderPdfPage(
  doc: Awaited<ReturnType<typeof openPdf>>,
  pageNumber: number,
  scale = 1.5,
  canvas: HTMLCanvasElement = document.createElement("canvas")
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  await page.render({ canvas, viewport }).promise
  return canvas
}
