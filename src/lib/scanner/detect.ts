import {
  clamp01,
  convexHull,
  insetQuad,
  largestInscribedQuad,
  orderQuad,
  polygonArea,
  simplifyHull,
} from "./geometry"
import type { DetectResult, Pixels, Point, Quad } from "./types"

/**
 * Lightweight edge-based document detector (no OpenCV).
 *
 * 1. grayscale + 5-tap gaussian blur
 * 2. Sobel gradient magnitude, adaptive threshold → binary edge map, dilate
 * 3. connected components of edge pixels
 * 4. per component (and the union of big components): convex hull → largest inscribed quad
 * 5. score each candidate by area, how rectangular the hull is, and edge support along the quad
 *
 * Input should already be small (~300–400px longest side). Pure TS — runs in a worker.
 */
export function detectDocument(src: Pixels): DetectResult {
  const { width: w, height: h, data } = src
  const fallback: DetectResult = { quad: insetQuad(0.05), confidence: 0 }
  if (w < 16 || h < 16) return fallback
  const n = w * h

  // 1. grayscale
  const gray = new Float32Array(n)
  for (let i = 0, j = 0; i < n; i++, j += 4) gray[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]
  const blurred = gaussianBlur(gray, w, h)

  // 2. Sobel magnitude + histogram
  const mag = new Float32Array(n)
  const hist = new Uint32Array(256)
  let count = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const a = blurred[i - w - 1], b = blurred[i - w], c = blurred[i - w + 1]
      const d = blurred[i - 1], f = blurred[i + 1]
      const g = blurred[i + w - 1], hh = blurred[i + w], k = blurred[i + w + 1]
      const gx = c + 2 * f + k - a - 2 * d - g
      const gy = g + 2 * hh + k - a - 2 * b - c
      const m = Math.sqrt(gx * gx + gy * gy)
      mag[i] = m
      hist[Math.min(255, m >> 2)]++
      count++
    }
  }
  // threshold at the ~88th percentile, but never below an absolute floor
  let acc = 0
  let p = 255
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= count * 0.88) {
      p = v
      break
    }
  }
  // try a strict and a lenient edge threshold (text-heavy pages vs faint borders)
  const thresholds = [Math.max(36, p * 4), Math.max(24, p * 1.5)]
  let best: Candidate | null = null
  for (const t of thresholds) {
    const c = bestQuadAt(mag, w, h, t)
    if (c && (!best || c.score > best.score)) best = c
  }
  if (!best || best.confidence < 0.45) return { ...fallback, confidence: best?.confidence ?? 0 }

  return {
    quad: best.quad.map((pt) => ({ x: clamp01(pt.x / (w - 1)), y: clamp01(pt.y / (h - 1)) })) as Quad,
    confidence: best.confidence,
  }
}

interface Candidate {
  quad: Quad
  score: number
  confidence: number
}

function bestQuadAt(mag: Float32Array, w: number, h: number, thresh: number): Candidate | null {
  const n = w * h
  const edges = new Uint8Array(n)
  for (let i = 0; i < n; i++) if (mag[i] >= thresh) edges[i] = 1
  const dil = dilate(edges, w, h)

  // 3. connected components (8-connected)
  const labels = new Int32Array(n)
  const stack = new Int32Array(n)
  const comps: { pixels: number[]; minX: number; maxX: number; minY: number; maxY: number }[] = []
  let label = 0
  for (let s = 0; s < n; s++) {
    if (!dil[s] || labels[s]) continue
    label++
    let top = 0
    stack[top++] = s
    labels[s] = label
    const pixels: number[] = []
    let minX = w, maxX = 0, minY = h, maxY = 0
    while (top) {
      const i = stack[--top]
      pixels.push(i)
      const x = i % w
      const y = (i - x) / w
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          const j = yy * w + xx
          if (dil[j] && !labels[j]) {
            labels[j] = label
            stack[top++] = j
          }
        }
      }
    }
    const bw = maxX - minX
    const bh = maxY - minY
    if (bw > w * 0.2 && bh > h * 0.2) comps.push({ pixels, minX, maxX, minY, maxY })
  }
  if (!comps.length) return null

  // 4. candidates: each big component, plus their union (handles broken borders)
  const candidates: number[][] = comps.map((c) => c.pixels)
  if (comps.length > 1) candidates.push(comps.flatMap((c) => c.pixels))

  let best: Candidate | null = null
  for (const pix of candidates) {
    const hull = hullFromPixels(pix, w, h)
    if (hull.length < 4) continue
    const hullArea = Math.abs(polygonArea(hull))
    const quadPts = largestInscribedQuad(simplifyHull(hull, 40))
    if (!quadPts) continue
    const quad = orderQuad(quadPts)
    const area = Math.abs(polygonArea(quad))
    const areaFrac = area / (w * h)
    if (areaFrac < 0.12 || areaFrac > 0.985) continue
    const fill = hullArea > 0 ? area / hullArea : 0
    const support = edgeSupport(quad, edges, w, h)
    const confidence = clamp01(support * Math.min(1, fill / 0.92) * (areaFrac < 0.2 ? areaFrac / 0.2 : 1))
    const score = confidence * Math.sqrt(areaFrac)
    if (!best || score > best.score) best = { quad, score, confidence }
  }
  return best
}

function gaussianBlur(src: Float32Array, w: number, h: number): Float32Array {
  const k = [1, 4, 6, 4, 1]
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let t = -2; t <= 2; t++) {
        const xx = Math.min(w - 1, Math.max(0, x + t))
        s += src[row + xx] * k[t + 2]
      }
      tmp[row + x] = s / 16
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let t = -2; t <= 2; t++) {
        const yy = Math.min(h - 1, Math.max(0, y + t))
        s += tmp[yy * w + x] * k[t + 2]
      }
      out[y * w + x] = s / 16
    }
  }
  return out
}

function dilate(src: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(src.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!src[y * w + x]) continue
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx >= 0 && xx < w) out[yy * w + xx] = 1
        }
      }
    }
  }
  return out
}

/** Convex hull using only each row's leftmost/rightmost pixel (same hull, far fewer points). */
function hullFromPixels(pixels: number[], w: number, h: number): Point[] {
  const minX = new Int32Array(h).fill(w)
  const maxX = new Int32Array(h).fill(-1)
  for (const i of pixels) {
    const x = i % w
    const y = (i - x) / w
    if (x < minX[y]) minX[y] = x
    if (x > maxX[y]) maxX[y] = x
  }
  const pts: Point[] = []
  for (let y = 0; y < h; y++) {
    if (maxX[y] < 0) continue
    pts.push({ x: minX[y], y })
    if (maxX[y] !== minX[y]) pts.push({ x: maxX[y], y })
  }
  return convexHull(pts)
}

/**
 * Edge support of a quad: the fraction of samples along its sides that hit an
 * edge pixel, discounted by how often samples offset to either side also hit
 * one. Clutter/noise hits everywhere; a real page border hits only on the line.
 */
function edgeSupport(q: Quad, edges: Uint8Array, w: number, h: number): number {
  const hitAt = (x: number, y: number, r: number) => {
    const cx = Math.round(x)
    const cy = Math.round(y)
    for (let dy = -r; dy <= r; dy++) {
      const yy = cy + dy
      if (yy < 0 || yy >= h) continue
      for (let dx = -r; dx <= r; dx++) {
        const xx = cx + dx
        if (xx >= 0 && xx < w && edges[yy * w + xx]) return true
      }
    }
    return false
  }
  const off = Math.max(4, Math.min(w, h) * 0.025)
  let on = 0
  let side = 0
  let sideTotal = 0
  let total = 0
  for (let e = 0; e < 4; e++) {
    const a = q[e]
    const b = q[(e + 1) % 4]
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / len
    const ny = (b.x - a.x) / len
    const steps = 40
    for (let s = 2; s < steps - 1; s++) {
      const t = s / steps
      const x = a.x + (b.x - a.x) * t
      const y = a.y + (b.y - a.y) * t
      total++
      if (hitAt(x, y, 2)) on++
      for (const sign of [-1, 1]) {
        const ox = x + nx * off * sign
        const oy = y + ny * off * sign
        if (ox < 1 || oy < 1 || ox > w - 2 || oy > h - 2) continue
        sideTotal++
        if (hitAt(ox, oy, 2)) side++
      }
    }
  }
  if (!total) return 0
  const onFrac = on / total
  const sideFrac = sideTotal ? side / sideTotal : 0
  // how much more often the line itself is on an edge than its surroundings
  if (sideFrac >= 0.98) return 0
  return Math.max(0, (onFrac - sideFrac) / (1 - sideFrac))
}
