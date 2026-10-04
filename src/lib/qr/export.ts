/** Print-ready exports for generated QR codes. Heavy libraries load on demand. */
import { canvasToBlob } from "@/lib/files"

const A4 = { width: 595.28, height: 841.89 } // points
const MM = 72 / 25.4

/** Wrap text to at most `maxLines` lines that fit `maxWidth` on the given context. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = []
  for (const para of text.split(/\r?\n/)) {
    let line = ""
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width <= maxWidth || !line) line = next
      else {
        lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s*\S*$/, "")}…`
    return kept
  }
  return lines
}

/**
 * Compose the QR (and an optional caption under it) onto one white canvas.
 * The caption is drawn with the system font, so any language/script works.
 */
export function composeWithCaption(qr: HTMLCanvasElement, caption: string): HTMLCanvasElement {
  const text = caption.trim()
  if (!text) return qr
  const w = qr.width
  const fontPx = Math.max(16, Math.round(w * 0.05))
  const out = document.createElement("canvas")
  const ctx = out.getContext("2d")!
  ctx.font = `600 ${fontPx}px system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif`
  const lines = wrap(ctx, text, w * 0.9, 3)
  const lineH = Math.round(fontPx * 1.3)
  out.width = w
  out.height = qr.height + lines.length * lineH + Math.round(fontPx * 0.8)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(qr, 0, 0)
  ctx.font = `600 ${fontPx}px system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif`
  ctx.fillStyle = "#111827"
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  lines.forEach((l, i) => ctx.fillText(l, w / 2, qr.height + i * lineH))
  return out
}

/** One A4 page with the QR centred (about 120 mm wide) and an optional caption. */
export async function buildQrPdf(qr: HTMLCanvasElement, caption: string, title = "QR code"): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib")
  const doc = await PDFDocument.create()
  doc.setTitle(title)
  doc.setCreator("LifeKit")
  const page = doc.addPage([A4.width, A4.height])
  const composed = composeWithCaption(qr, caption)
  const png = await doc.embedPng(await (await canvasToBlob(composed)).arrayBuffer())
  const targetW = Math.min(120 * MM, A4.width - 30 * MM)
  const scale = targetW / png.width
  const w = png.width * scale
  const h = png.height * scale
  page.drawImage(png, { x: (A4.width - w) / 2, y: (A4.height - h) / 2, width: w, height: h })
  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: "application/pdf" })
}
