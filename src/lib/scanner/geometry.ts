import type { Point, Quad } from "./types"

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/** Default quad: the whole image inset by `inset` (normalised coordinates). */
export function insetQuad(inset = 0.04): Quad {
  const a = inset
  const b = 1 - inset
  return [
    { x: a, y: a },
    { x: b, y: a },
    { x: b, y: b },
    { x: a, y: b },
  ]
}

/** Signed area of a polygon (shoelace). Positive for clockwise in screen coords. */
export function polygonArea(pts: readonly Point[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    s += p.x * q.y - q.x * p.y
  }
  return s / 2
}

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

/** True if the four corners form a convex, non-degenerate quadrilateral (either winding). */
export function isConvex(q: Quad): boolean {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const c = cross(q[i], q[(i + 1) % 4], q[(i + 2) % 4])
    if (Math.abs(c) < 1e-9) return false
    const s = Math.sign(c)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

/**
 * Re-order arbitrary corners into TL, TR, BR, BL. Sorts by angle around the
 * centroid (robust for rotated documents), then starts from the corner with
 * the smallest x+y.
 */
export function orderQuad(points: readonly Point[]): Quad {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length
  const sorted = [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))
  // atan2 order in screen coords (y down) is clockwise: starting near -PI (left).
  let start = 0
  let best = Infinity
  sorted.forEach((p, i) => {
    if (p.x + p.y < best) {
      best = p.x + p.y
      start = i
    }
  })
  const out = [0, 1, 2, 3].map((k) => sorted[(start + k) % 4])
  return out as Quad
}

/** Monotone-chain convex hull. Returns hull in clockwise order (screen coords). */
export function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points.slice()
  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y)
  const lower: Point[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Point[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  upper.pop()
  lower.pop()
  return lower.concat(upper)
}

/** Largest-area quadrilateral whose vertices lie on the given convex hull. O(n³), keep n small. */
export function largestInscribedQuad(hull: Point[]): Point[] | null {
  const n = hull.length
  if (n < 4) return null
  const tri = (a: Point, b: Point, c: Point) => Math.abs(cross(a, b, c)) / 2
  let best = -1
  let res: Point[] | null = null
  for (let i = 0; i < n; i++) {
    for (let k = i + 2; k < n; k++) {
      let bj = -1
      let aj = -1
      for (let j = i + 1; j < k; j++) {
        const a = tri(hull[i], hull[j], hull[k])
        if (a > aj) {
          aj = a
          bj = j
        }
      }
      let bl = -1
      let al = -1
      for (let l = k + 1; l < n + i; l++) {
        const li = l % n
        const a = tri(hull[i], hull[k], hull[li])
        if (a > al) {
          al = a
          bl = li
        }
      }
      if (bj < 0 || bl < 0) continue
      if (aj + al > best) {
        best = aj + al
        res = [hull[i], hull[bj], hull[k], hull[bl]]
      }
    }
  }
  return res
}

/** Reduce a hull to at most `max` points by keeping the sharpest corners. */
export function simplifyHull(hull: Point[], max = 48): Point[] {
  let pts = hull.slice()
  while (pts.length > max) {
    // remove the vertex whose removal loses the least area
    let minA = Infinity
    let idx = 0
    for (let i = 0; i < pts.length; i++) {
      const a = Math.abs(cross(pts[(i - 1 + pts.length) % pts.length], pts[i], pts[(i + 1) % pts.length]))
      if (a < minA) {
        minA = a
        idx = i
      }
    }
    pts = pts.slice(0, idx).concat(pts.slice(idx + 1))
  }
  return pts
}

/** Output rectangle size for a quad in pixel coordinates (average opposing edge lengths). */
export function outputSize(q: Quad, maxSide = 2400): { width: number; height: number } {
  const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2
  const h = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2
  const scale = Math.min(1, maxSide / Math.max(w, h, 1))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

/** Solve an n×n linear system with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    if (Math.abs(M[p][c]) < 1e-12) throw new Error("Degenerate corners — adjust the crop.")
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((row, i) => row[n] / row[i])
}

/**
 * Homography H (row-major 3×3, h33 = 1) mapping `from[i]` → `to[i]`.
 * x' = (h0 x + h1 y + h2) / (h6 x + h7 y + 1), y' = (h3 x + h4 y + h5) / (h6 x + h7 y + 1)
 */
export function homography(from: readonly Point[], to: readonly Point[]): number[] {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]
    const { x: u, y: v } = to[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  return [...solve(A, b), 1]
}

export const denormalize = (q: Quad, w: number, h: number): Quad =>
  q.map((p) => ({ x: p.x * w, y: p.y * h })) as Quad

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
