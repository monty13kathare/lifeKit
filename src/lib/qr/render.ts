/** QR rendering (canvas + SVG) with optional centred logo. Loads `qrcode` lazily. */
import type { EccLevel } from "./capacity"

export interface QrStyle {
  fg: string
  bg: string
  size: number
  margin: number
  ecc: EccLevel
  /** Logo width as a fraction of the full image width (≤ 0.22). */
  logoRatio: number
}

export interface QrLogo {
  /** Decoded image for canvas drawing. */
  image: HTMLImageElement
  /** PNG data URL (downscaled) for SVG embedding. */
  dataUrl: string
}

type QrModule = typeof import("qrcode")
let mod: Promise<QrModule> | null = null
export function loadQrLib(): Promise<QrModule> {
  if (!mod) mod = import("qrcode").then((m) => (m as unknown as { default?: QrModule }).default ?? m)
  return mod
}

export const MAX_LOGO_RATIO = 0.22

function logoBox(total: number, ratio: number) {
  const s = Math.round(total * Math.min(ratio, MAX_LOGO_RATIO))
  const pad = Math.max(2, Math.round(s * 0.08))
  return { s, pad, x: Math.round((total - s) / 2), y: Math.round((total - s) / 2) }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Render to a canvas at `style.size` pixels. Throws when data doesn't fit. */
export async function renderQrCanvas(text: string, style: QrStyle, canvas: HTMLCanvasElement, logo?: QrLogo | null) {
  const QR = await loadQrLib()
  await QR.toCanvas(canvas, text, {
    errorCorrectionLevel: style.ecc,
    margin: style.margin,
    width: style.size,
    color: { dark: style.fg, light: style.bg },
  })
  if (logo) {
    const ctx = canvas.getContext("2d")!
    const { s, pad, x, y } = logoBox(canvas.width, style.logoRatio)
    ctx.fillStyle = style.bg
    roundRect(ctx, x - pad, y - pad, s + pad * 2, s + pad * 2, Math.round(s * 0.18))
    ctx.fill()
    const { naturalWidth: w, naturalHeight: h } = logo.image
    const k = Math.min(s / w, s / h)
    const dw = w * k
    const dh = h * k
    ctx.drawImage(logo.image, x + (s - dw) / 2, y + (s - dh) / 2, dw, dh)
  }
  return canvas
}

/** SVG string from `qrcode`, with the logo embedded as an <image> data URL. */
export async function renderQrSvg(text: string, style: QrStyle, logo?: QrLogo | null): Promise<string> {
  const QR = await loadQrLib()
  let svg = await QR.toString(text, {
    type: "svg",
    errorCorrectionLevel: style.ecc,
    margin: style.margin,
    width: style.size,
    color: { dark: style.fg, light: style.bg },
  })
  if (!logo) return svg
  const vb = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg)
  const total = vb ? Number(vb[1]) : 0
  if (!total) return svg
  const s = total * Math.min(style.logoRatio, MAX_LOGO_RATIO)
  const pad = Math.max(0.5, s * 0.08)
  const x = (total - s) / 2
  const r = s * 0.18
  const overlay =
    `<rect x="${(x - pad).toFixed(2)}" y="${(x - pad).toFixed(2)}" width="${(s + pad * 2).toFixed(2)}" height="${(s + pad * 2).toFixed(2)}" rx="${r.toFixed(2)}" fill="${style.bg}"/>` +
    `<image x="${x.toFixed(2)}" y="${x.toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" preserveAspectRatio="xMidYMid meet" href="${logo.dataUrl}" xlink:href="${logo.dataUrl}"/>`
  if (!svg.includes("xmlns:xlink")) svg = svg.replace("<svg ", '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ')
  return svg.replace(/<\/svg>\s*$/, `${overlay}</svg>`)
}

/** Friendly message for qrcode errors. */
export function qrErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/too big|amount of data/i.test(msg)) return "Too much data for one QR code. Shorten the content, lower the error correction, or remove the logo."
  if (/no input text/i.test(msg)) return "Nothing to encode yet."
  return "This QR code couldn't be generated."
}

/** Module count (side length) and version of the QR symbol for `text`, or null if it doesn't fit. */
export async function qrSymbolInfo(text: string, ecc: EccLevel): Promise<{ version: number; modules: number } | null> {
  const QR = await loadQrLib()
  try {
    const sym = QR.create(text, { errorCorrectionLevel: ecc })
    return { version: sym.version, modules: sym.modules.size }
  } catch {
    return null
  }
}
