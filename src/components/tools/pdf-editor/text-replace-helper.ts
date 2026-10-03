export interface RawPdfTextItem {
  str?: string
  transform?: number[]
  width?: number
  height?: number
  fontName?: string
  dir?: string
  [key: string]: unknown
}

export interface RawPdfTextContent {
  items: (RawPdfTextItem | unknown)[]
  styles?: Record<string, { fontFamily?: string; [key: string]: unknown }>
}

export interface ExtractedTextItem {
  id: string
  str: string
  x: number // 0-1 page space
  y: number // 0-1 page space
  w: number // 0-1 page space
  h: number // 0-1 page space
  baselineY: number // 0-1 page space (y position of baseline)
  fontSize: number // points
  fontName: string
  fontFamily: "sans" | "serif" | "mono"
  fontWeight: "normal" | "bold"
}

export function detectFontProperties(
  fontName = "",
  familyStyle = ""
): { fontFamily: "sans" | "serif" | "mono"; fontWeight: "normal" | "bold" } {
  const fStyle = (familyStyle || "").toLowerCase().trim()
  const fName = (fontName || "").toLowerCase().trim()
  const s = `${fName} ${fStyle}`

  let fontFamily: "sans" | "serif" | "mono" = "sans"

  // 1. Check monospace first
  if (
    fStyle === "monospace" ||
    /courier|mono|consolas|menlo|source\s*code|fira|\bcode\b|dejavu\s*sans\s*mono/i.test(s)
  ) {
    fontFamily = "mono"
  } else if (
    fStyle === "sans-serif" ||
    /sans|arial|helvetica|calibri|roboto|inter|verdana|tahoma|trebuchet|lato|poppins|segoe|gothic|noto/i.test(s)
  ) {
    // If it mentions sans or sans-serif, it's definitively sans
    fontFamily = "sans"
  } else if (
    (fStyle === "serif" ||
      /\bserif\b|times|georgia|garamond|minion|cambria|palatino|baskerville|charter|bookman|didot|bodoni|century/i.test(
        s
      )) &&
    !s.includes("sans")
  ) {
    fontFamily = "serif"
  } else {
    fontFamily = "sans"
  }

  // 2. Weight detection: look for bold keywords in font name or style
  const isBold = /bold|black|heavy|semi|medi|demi|700|800|900|\-bd\b|\-b\b|_b\b/i.test(s)
  return { fontFamily, fontWeight: isBold ? "bold" : "normal" }
}

export function extractPageTextItems(
  textContent: RawPdfTextContent | unknown,
  pageWidth: number,
  pageHeight: number
): ExtractedTextItem[] {
  const items: ExtractedTextItem[] = []
  const tc = textContent as RawPdfTextContent | null
  if (!tc || !tc.items) return items

  let counter = 0
  for (const raw of tc.items) {
    if (!raw || typeof raw !== "object" || !("str" in raw)) continue
    const item = raw as RawPdfTextItem
    if (!item.str || !item.str.trim()) continue

    const transform = item.transform || [12, 0, 0, 12, 0, 0]
    const tx = transform[4] || 0
    const ty = transform[5] || 0
    const fontSize = Math.hypot(transform[0] || 12, transform[1] || 0) || item.height || 12
    const widthPt = item.width || fontSize * item.str.length * 0.5
    const heightPt = item.height || fontSize

    // Convert from PDF coordinate space (y-up, 0 at bottom) to page space (y-down, 0 at top)
    const normX = Math.max(0, Math.min(1, tx / pageWidth))
    const normY = Math.max(0, Math.min(1, (pageHeight - ty - heightPt) / pageHeight))
    const normBaselineY = Math.max(0, Math.min(1, (pageHeight - ty) / pageHeight))
    const normW = Math.max(0.001, Math.min(1 - normX, widthPt / pageWidth))
    const normH = Math.max(0.001, Math.min(1 - normY, heightPt / pageHeight))

    const style = tc.styles?.[item.fontName || ""]
    const { fontFamily, fontWeight } = detectFontProperties(item.fontName, style?.fontFamily)

    items.push({
      id: `text-item-${counter++}`,
      str: item.str,
      x: normX,
      y: normY,
      w: normW,
      h: normH,
      baselineY: normBaselineY,
      fontSize: Math.round(fontSize * 10) / 10,
      fontName: item.fontName || "",
      fontFamily,
      fontWeight,
    })
  }

  return items
}

/**
 * Samples the rendered page canvas to extract the dominant background color
 * and text glyph color for the given normalized bounding box.
 */
export function sampleColorsFromCanvas(
  canvas: HTMLCanvasElement | null,
  normX: number,
  normY: number,
  normW: number,
  normH: number
): { textColor: string; bgColor: string } {
  if (!canvas) return { textColor: "#111827", bgColor: "#ffffff" }

  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return { textColor: "#111827", bgColor: "#ffffff" }

  const sx = Math.max(0, Math.min(canvas.width - 1, Math.floor(normX * canvas.width)))
  const sy = Math.max(0, Math.min(canvas.height - 1, Math.floor(normY * canvas.height)))
  const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil(normW * canvas.width)))
  const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil(normH * canvas.height)))

  try {
    const imgData = ctx.getImageData(sx, sy, sw, sh)
    const data = imgData.data

    if (!data.length) return { textColor: "#111827", bgColor: "#ffffff" }

    // 1. Gather perimeter samples (top/bottom rows + left/right columns) for accurate background detection
    const borderSamples: [number, number, number][] = []
    const stepX = Math.max(1, Math.floor(sw / 10))
    const stepY = Math.max(1, Math.floor(sh / 5))

    for (let x = 0; x < sw; x += stepX) {
      // Top row
      const iTop = x * 4
      borderSamples.push([data[iTop], data[iTop + 1], data[iTop + 2]])
      // Bottom row
      const iBot = ((sh - 1) * sw + x) * 4
      if (iBot < data.length - 3) {
        borderSamples.push([data[iBot], data[iBot + 1], data[iBot + 2]])
      }
    }
    for (let y = 0; y < sh; y += stepY) {
      // Left column
      const iLeft = y * sw * 4
      borderSamples.push([data[iLeft], data[iLeft + 1], data[iLeft + 2]])
      // Right column
      const iRight = (y * sw + sw - 1) * 4
      if (iRight < data.length - 3) {
        borderSamples.push([data[iRight], data[iRight + 1], data[iRight + 2]])
      }
    }

    // Default to white
    let bgR = 255
    let bgG = 255
    let bgB = 255

    if (borderSamples.length > 0) {
      // Sort border samples by luminance and pick median to ignore any stray glyph edges
      borderSamples.sort((a, b) => {
        const lumA = a[0] * 0.299 + a[1] * 0.587 + a[2] * 0.114
        const lumB = b[0] * 0.299 + b[1] * 0.587 + b[2] * 0.114
        return lumA - lumB
      })
      const mid = Math.floor(borderSamples.length / 2)
      bgR = borderSamples[mid][0]
      bgG = borderSamples[mid][1]
      bgB = borderSamples[mid][2]

      // Snap near-white to pure #ffffff for clean document backgrounds
      if (bgR > 248 && bgG > 248 && bgB > 248) {
        bgR = 255
        bgG = 255
        bgB = 255
      }
    }

    // 2. Identify candidate text glyph pixels inside the region
    const textPixels: [number, number, number][] = []
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const dist = Math.hypot(r - bgR, g - bgG, b - bgB)
      if (dist > 35) {
        textPixels.push([r, g, b])
      }
    }

    let textR = 17
    let textG = 24
    let textB = 39

    if (textPixels.length > 0) {
      // Sort by distance to background (highest contrast core glyph pixels first)
      textPixels.sort((a, b) => {
        const da = Math.hypot(a[0] - bgR, a[1] - bgG, a[2] - bgB)
        const db = Math.hypot(b[0] - bgR, b[1] - bgG, b[2] - bgB)
        return db - da
      })

      // Take top 20% highest-contrast pixels to avoid anti-aliasing edge artifacts
      const topCount = Math.max(1, Math.floor(textPixels.length * 0.2))
      let sumR = 0
      let sumG = 0
      let sumB = 0
      for (let i = 0; i < topCount; i++) {
        sumR += textPixels[i][0]
        sumG += textPixels[i][1]
        sumB += textPixels[i][2]
      }
      textR = Math.round(sumR / topCount)
      textG = Math.round(sumG / topCount)
      textB = Math.round(sumB / topCount)

      // Snap near-black to pure #111827 or #000000
      if (textR < 25 && textG < 25 && textB < 25) {
        textR = 17
        textG = 24
        textB = 39
      }
    }

    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")
    return {
      textColor: `#${toHex(textR)}${toHex(textG)}${toHex(textB)}`,
      bgColor: `#${toHex(bgR)}${toHex(bgG)}${toHex(bgB)}`,
    }
  } catch {
    return { textColor: "#111827", bgColor: "#ffffff" }
  }
}
