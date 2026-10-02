import { homography } from "./geometry"
import type { EnhanceSettings, Pixels, Quad } from "./types"

/**
 * Perspective-correct `quad` (pixel coords in `src`) into a `width`×`height`
 * rectangle using inverse mapping + bilinear sampling.
 */
export function warpPerspective(src: Pixels, quad: Quad, width: number, height: number): Pixels {
  const dst = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ]
  // maps destination → source
  const H = homography(dst, quad)
  const out = new Uint8ClampedArray(width * height * 4)
  const sw = src.width
  const sh = src.height
  const sd = src.data
  const maxX = sw - 1
  const maxY = sh - 1
  let o = 0
  for (let y = 0; y < height; y++) {
    // incremental evaluation along the row
    let nx = H[1] * y + H[2]
    let ny = H[4] * y + H[5]
    let dz = H[7] * y + 1
    for (let x = 0; x < width; x++) {
      const z = dz
      let sx = nx / z
      let sy = ny / z
      nx += H[0]
      ny += H[3]
      dz += H[6]
      if (sx < 0) sx = 0
      else if (sx > maxX) sx = maxX
      if (sy < 0) sy = 0
      else if (sy > maxY) sy = maxY
      const x0 = sx | 0
      const y0 = sy | 0
      const x1 = x0 < maxX ? x0 + 1 : x0
      const y1 = y0 < maxY ? y0 + 1 : y0
      const fx = sx - x0
      const fy = sy - y0
      const i00 = (y0 * sw + x0) * 4
      const i10 = (y0 * sw + x1) * 4
      const i01 = (y1 * sw + x0) * 4
      const i11 = (y1 * sw + x1) * 4
      const w00 = (1 - fx) * (1 - fy)
      const w10 = fx * (1 - fy)
      const w01 = (1 - fx) * fy
      const w11 = fx * fy
      out[o] = sd[i00] * w00 + sd[i10] * w10 + sd[i01] * w01 + sd[i11] * w11
      out[o + 1] = sd[i00 + 1] * w00 + sd[i10 + 1] * w10 + sd[i01 + 1] * w01 + sd[i11 + 1] * w11
      out[o + 2] = sd[i00 + 2] * w00 + sd[i10 + 2] * w10 + sd[i01 + 2] * w01 + sd[i11 + 2] * w11
      out[o + 3] = 255
      o += 4
    }
  }
  return { width, height, data: out }
}

/** Nearest-neighbour-free box downscale used for fast previews. */
export function downscale(src: Pixels, maxSide: number): Pixels {
  const scale = maxSide / Math.max(src.width, src.height)
  if (scale >= 1) return { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data) }
  const w = Math.max(1, Math.round(src.width * scale))
  const h = Math.max(1, Math.round(src.height * scale))
  const out = new Uint8ClampedArray(w * h * 4)
  const sx = src.width / w
  const sy = src.height / h
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy)
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy))
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx))
      let r = 0, g = 0, b = 0, c = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.width + xx) * 4
          r += src.data[i]
          g += src.data[i + 1]
          b += src.data[i + 2]
          c++
        }
      }
      const o = (y * w + x) * 4
      out[o] = r / c
      out[o + 1] = g / c
      out[o + 2] = b / c
      out[o + 3] = 255
    }
  }
  return { width: w, height: h, data: out }
}

const lum = (d: Uint8ClampedArray, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]

/** Per-channel percentile contrast stretch (also neutralises colour casts). */
function autoLevels(d: Uint8ClampedArray, n: number, lowPct = 0.01, highPct = 0.99) {
  const hists = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
  for (let i = 0; i < n * 4; i += 4) {
    hists[0][d[i]]++
    hists[1][d[i + 1]]++
    hists[2][d[i + 2]]++
  }
  const luts = hists.map((hist) => {
    let lo = 0
    let hi = 255
    let acc = 0
    for (let v = 0; v < 256; v++) {
      acc += hist[v]
      if (acc >= n * lowPct) {
        lo = v
        break
      }
    }
    acc = 0
    for (let v = 255; v >= 0; v--) {
      acc += hist[v]
      if (acc >= n * (1 - highPct)) {
        hi = v
        break
      }
    }
    if (hi - lo < 16) return null
    const lut = new Uint8ClampedArray(256)
    for (let v = 0; v < 256; v++) lut[v] = ((v - lo) * 255) / (hi - lo)
    return lut
  })
  for (let i = 0; i < n * 4; i += 4) {
    if (luts[0]) d[i] = luts[0][d[i]]
    if (luts[1]) d[i + 1] = luts[1][d[i + 1]]
    if (luts[2]) d[i + 2] = luts[2][d[i + 2]]
  }
}

function toGray(d: Uint8ClampedArray, n: number) {
  for (let i = 0; i < n * 4; i += 4) {
    const v = lum(d, i)
    d[i] = d[i + 1] = d[i + 2] = v
  }
}

/** Unsharp mask with a 3×3 box blur. */
function sharpen(px: Pixels, amount = 0.9) {
  const { width: w, height: h, data: d } = px
  const src = new Uint8ClampedArray(d)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const k = i + c
        const blur =
          (src[k - w * 4 - 4] + src[k - w * 4] + src[k - w * 4 + 4] +
            src[k - 4] + src[k] + src[k + 4] +
            src[k + w * 4 - 4] + src[k + w * 4] + src[k + w * 4 + 4]) / 9
        d[k] = src[k] + amount * (src[k] - blur)
      }
    }
  }
}

function brightnessContrast(d: Uint8ClampedArray, n: number, brightness: number, contrast: number) {
  if (!brightness && !contrast) return
  const b = brightness * 1.28
  const c = Math.max(-254, Math.min(254, contrast * 1.28))
  const f = (259 * (c + 255)) / (255 * (259 - c))
  const lut = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v++) lut[v] = f * (v - 128) + 128 + b
  for (let i = 0; i < n * 4; i += 4) {
    d[i] = lut[d[i]]
    d[i + 1] = lut[d[i + 1]]
    d[i + 2] = lut[d[i + 2]]
  }
}

/**
 * Bradley–Roth adaptive threshold using an integral image. Pixels darker than
 * the local mean by more than `t` become black; everything else white.
 */
function adaptiveThreshold(px: Pixels, t = 0.12) {
  const { width: w, height: h, data: d } = px
  const integral = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += d[(y * w + x) * 4]
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row
    }
  }
  const s = Math.max(8, Math.round(Math.max(w, h) / 24))
  const half = s >> 1
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half)
    const y1 = Math.min(h - 1, y + half)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half)
      const x1 = Math.min(w - 1, x + half)
      const area = (x1 - x0 + 1) * (y1 - y0 + 1)
      const sum =
        integral[(y1 + 1) * (w + 1) + x1 + 1] -
        integral[y0 * (w + 1) + x1 + 1] -
        integral[(y1 + 1) * (w + 1) + x0] +
        integral[y0 * (w + 1) + x0]
      const i = (y * w + x) * 4
      const v = d[i] * area < sum * (1 - t) ? 0 : 255
      d[i] = d[i + 1] = d[i + 2] = v
    }
  }
}

export function rotate(px: Pixels, deg: 0 | 90 | 180 | 270): Pixels {
  if (deg === 0) return px
  const { width: w, height: h, data: d } = px
  const nw = deg === 180 ? w : h
  const nh = deg === 180 ? h : w
  const src32 = new Uint32Array(d.buffer, d.byteOffset, w * h)
  const out = new Uint8ClampedArray(nw * nh * 4)
  const out32 = new Uint32Array(out.buffer)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let nx: number, ny: number
      if (deg === 90) {
        nx = h - 1 - y
        ny = x
      } else if (deg === 180) {
        nx = w - 1 - x
        ny = h - 1 - y
      } else {
        nx = y
        ny = w - 1 - x
      }
      out32[ny * nw + nx] = src32[y * w + x]
    }
  }
  return { width: nw, height: nh, data: out }
}

/** Apply the full enhancement pipeline. Mutates and/or returns new pixels. */
export function enhance(px: Pixels, s: EnhanceSettings): Pixels {
  const n = px.width * px.height
  const d = px.data
  switch (s.filter) {
    case "auto":
      autoLevels(d, n)
      break
    case "grayscale":
      toGray(d, n)
      autoLevels(d, n, 0.005, 0.995)
      break
    case "bw":
      toGray(d, n)
      break
    default:
      break
  }
  if (s.sharpen) sharpen(px)
  brightnessContrast(d, n, s.brightness, s.contrast)
  if (s.filter === "bw") adaptiveThreshold(px)
  return rotate(px, s.rotation)
}
