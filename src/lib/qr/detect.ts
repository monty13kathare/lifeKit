/**
 * Barcode decoding in the browser. Prefers the native `BarcodeDetector`
 * (Chrome on Android/macOS/ChromeOS, Safari 17+ partially) and falls back to
 * ZXing (bundled with `html5-qrcode`, loaded on demand). Nothing leaves the device.
 */
import type { CodeFormat } from "./formats"

export interface DetectedCode {
  value: string
  format: CodeFormat | string
}

export type DecoderKind = "native" | "zxing"

export interface Decoder {
  kind: DecoderKind
  formats: CodeFormat[]
  /** Decode a single frame/image. Resolves `null` when nothing is found. */
  decode(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<DetectedCode | null>
  dispose(): void
}

type Source = HTMLVideoElement | HTMLCanvasElement | ImageBitmap

// ---- Native BarcodeDetector (not yet in TS's DOM lib) -----------------------
interface NativeDetectedBarcode {
  rawValue: string
  format: string
}
interface NativeBarcodeDetector {
  detect(source: CanvasImageSource | ImageBitmap): Promise<NativeDetectedBarcode[]>
}
interface NativeBarcodeDetectorCtor {
  new (options?: { formats: string[] }): NativeBarcodeDetector
  getSupportedFormats(): Promise<string[]>
}

function nativeCtor(): NativeBarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null
  return (window as unknown as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector ?? null
}

let nativeFormatsPromise: Promise<string[]> | null = null
export function nativeSupportedFormats(): Promise<string[]> {
  const Ctor = nativeCtor()
  if (!Ctor) return Promise.resolve([])
  if (!nativeFormatsPromise) nativeFormatsPromise = Ctor.getSupportedFormats().catch(() => [])
  return nativeFormatsPromise
}

function createNative(Ctor: NativeBarcodeDetectorCtor, formats: CodeFormat[]): NativeBarcodeDetector | null {
  try {
    return new Ctor({ formats })
  } catch {
    return null
  }
}

// ---- ZXing (the copy bundled inside html5-qrcode) ---------------------------
interface ZxPoint {
  getX(): number
  getY(): number
}
interface ZxResult {
  getText(): string
  getBarcodeFormat(): number
  getResultPoints(): ZxPoint[] | null
}
interface ZxReader {
  setHints(hints: Map<number, unknown>): void
  decodeWithState(bitmap: unknown): ZxResult
  reset(): void
}
interface ZxModule {
  BarcodeFormat: Record<string, number> & Record<number, string>
  DecodeHintType: Record<string, number>
  MultiFormatReader: new () => ZxReader
  RGBLuminanceSource: new (luminances: Uint8ClampedArray, width: number, height: number) => unknown
  InvertedLuminanceSource: new (source: unknown) => unknown
  HybridBinarizer: new (source: unknown) => unknown
  BinaryBitmap: new (binarizer: unknown) => unknown
}

let zxPromise: Promise<ZxModule> | null = null
function loadZxing(): Promise<ZxModule> {
  if (!zxPromise) {
    zxPromise = import("html5-qrcode/third_party/zxing-js.umd")
      .then((m) => ((m as unknown as { default?: ZxModule }).default ?? (m as unknown as ZxModule)))
      .catch((e) => {
        zxPromise = null
        throw e
      })
  }
  return zxPromise
}

/**
 * Formats the bundled ZXing build can read. (Its Code 93 and Codabar readers
 * are compiled out, so those only work where the native detector supports them.)
 */
const TO_ZXING: Partial<Record<CodeFormat, string>> = {
  qr_code: "QR_CODE",
  ean_13: "EAN_13",
  ean_8: "EAN_8",
  upc_a: "UPC_A",
  upc_e: "UPC_E",
  code_128: "CODE_128",
  code_39: "CODE_39",
  itf: "ITF",
  data_matrix: "DATA_MATRIX",
  pdf417: "PDF_417",
  aztec: "AZTEC",
}
export const ZXING_FORMATS = Object.keys(TO_ZXING) as CodeFormat[]

function fromZxingName(name: string | undefined): string {
  if (!name) return "unknown"
  const entry = Object.entries(TO_ZXING).find(([, z]) => z === name)
  return entry ? entry[0] : name.toLowerCase()
}

/** Which of `formats` this browser can actually decode (native ∪ ZXing). */
export async function supportedFormats(formats: CodeFormat[]): Promise<CodeFormat[]> {
  const native = await nativeSupportedFormats()
  return formats.filter((f) => native.includes(f) || ZXING_FORMATS.includes(f))
}

function sourceSize(source: Source) {
  if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) return { width: source.videoWidth, height: source.videoHeight }
  return { width: source.width, height: source.height }
}

interface Gray {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** Draw (part of) a source onto a canvas — optionally rotated 90° — and return luminance. */
function toGray(
  canvas: HTMLCanvasElement,
  source: Source,
  opts: { sx?: number; sy?: number; sw?: number; sh?: number; maxDim: number; rotate?: boolean }
): Gray | null {
  const { width, height } = sourceSize(source)
  const sx = opts.sx ?? 0
  const sy = opts.sy ?? 0
  const sw = opts.sw ?? width
  const sh = opts.sh ?? height
  if (!sw || !sh) return null
  const scale = Math.min(1, opts.maxDim / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))
  canvas.width = opts.rotate ? h : w
  canvas.height = opts.rotate ? w : h
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // Flatten transparency onto white so transparent PNG codes stay readable.
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (opts.rotate) {
    ctx.translate(canvas.width, 0)
    ctx.rotate(Math.PI / 2)
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const data = new Uint8ClampedArray(canvas.width * canvas.height)
  for (let i = 0, j = 0; j < data.length; i += 4, j++) data[j] = (img[i] * 77 + img[i + 1] * 150 + img[i + 2] * 29) >> 8
  return { data, width: canvas.width, height: canvas.height }
}

function zxReader(zx: ZxModule, formats: CodeFormat[], tryHarder: boolean): ZxReader {
  const reader = new zx.MultiFormatReader()
  const hints = new Map<number, unknown>()
  hints.set(
    zx.DecodeHintType.POSSIBLE_FORMATS,
    formats.map((f) => TO_ZXING[f]).filter(Boolean).map((n) => zx.BarcodeFormat[n as string])
  )
  if (tryHarder) hints.set(zx.DecodeHintType.TRY_HARDER, true)
  reader.setHints(hints)
  return reader
}

function zxDecodeOnce(zx: ZxModule, reader: ZxReader, gray: Gray, invert = false): ZxResult | null {
  try {
    let lum: unknown = new zx.RGBLuminanceSource(gray.data, gray.width, gray.height)
    if (invert) lum = new zx.InvertedLuminanceSource(lum)
    return reader.decodeWithState(new zx.BinaryBitmap(new zx.HybridBinarizer(lum)))
  } catch {
    return null
  } finally {
    reader.reset()
  }
}

/** Paint a decoded code white so the next pass can find the others in the same image. */
function maskResult(gray: Gray, result: ZxResult) {
  const pts = result.getResultPoints()?.filter(Boolean) ?? []
  if (!pts.length) return false
  const xs = pts.map((p) => p.getX())
  const ys = pts.map((p) => p.getY())
  let x0 = Math.min(...xs)
  let x1 = Math.max(...xs)
  let y0 = Math.min(...ys)
  let y1 = Math.max(...ys)
  const size = Math.max(x1 - x0, y1 - y0, 8)
  // 1D codes report two points on one scan line; mask a band around it.
  const linear = pts.length <= 2
  const padX = linear ? size * 0.08 : size * 0.3
  const padY = linear ? Math.max(size * 0.45, 24) : size * 0.3
  x0 = Math.max(0, Math.floor(x0 - padX))
  x1 = Math.min(gray.width - 1, Math.ceil(x1 + padX))
  y0 = Math.max(0, Math.floor(y0 - padY))
  y1 = Math.min(gray.height - 1, Math.ceil(y1 + padY))
  for (let y = y0; y <= y1; y++) gray.data.fill(255, y * gray.width + x0, y * gray.width + x1 + 1)
  return true
}

/** Decode every code ZXing can find in one luminance image (up to `max`). */
function zxDecodeAll(zx: ZxModule, reader: ZxReader, gray: Gray, max: number, invert = false): DetectedCode[] {
  const out: DetectedCode[] = []
  for (let i = 0; i < max; i++) {
    const r = zxDecodeOnce(zx, reader, gray, invert)
    if (!r) break
    out.push({ value: r.getText(), format: fromZxingName(zx.BarcodeFormat[r.getBarcodeFormat()]) })
    if (!maskResult(gray, r)) break
  }
  return out
}

async function createZxingDecoder(formats: CodeFormat[], maxDim = 1000): Promise<Decoder> {
  const zx = await loadZxing()
  const usable = formats.filter((f) => TO_ZXING[f])
  const reader = zxReader(zx, usable, false)
  const canvas = document.createElement("canvas")
  let busy = false
  let frame = 0

  return {
    kind: "zxing",
    formats: usable,
    async decode(source) {
      if (busy) return null
      busy = true
      try {
        // Every third frame is read rotated so vertical 1D barcodes still scan.
        const rotate = ++frame % 3 === 0
        const gray = toGray(canvas, source, { maxDim, rotate })
        if (!gray) return null
        const r = zxDecodeOnce(zx, reader, gray)
        return r ? { value: r.getText(), format: fromZxingName(zx.BarcodeFormat[r.getBarcodeFormat()]) } : null
      } finally {
        busy = false
      }
    },
    dispose() {
      canvas.width = canvas.height = 0
    },
  }
}

/**
 * Create the best available decoder for the requested formats. Uses native
 * detection when it supports at least the most important requested formats.
 */
export async function createDecoder(formats: CodeFormat[], opts: { maxDim?: number } = {}): Promise<Decoder> {
  const Ctor = nativeCtor()
  if (Ctor) {
    const supported = await nativeSupportedFormats()
    const usable = formats.filter((f) => supported.includes(f))
    // Require QR support when QR was requested; otherwise any overlap will do.
    const ok = usable.length > 0 && (!formats.includes("qr_code") || usable.includes("qr_code"))
    const detector = ok ? createNative(Ctor, usable) : null
    if (detector) {
      return {
        kind: "native",
        formats: usable,
        async decode(source) {
          try {
            const found = await detector.detect(source)
            const hit = found.find((b) => b.rawValue)
            return hit ? { value: hit.rawValue, format: hit.format } : null
          } catch {
            return null
          }
        },
        dispose() {},
      }
    }
  }
  return createZxingDecoder(formats, opts.maxDim)
}

// ---- Still images --------------------------------------------------------------

const MAX_IMAGE_DIM = 4096
const PASS_DIM = 1600

async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    throw new Error("This image couldn't be read. It may be corrupted or in a format this browser can't open (e.g. HEIC) — try a JPG or PNG.")
  }
  const big = Math.max(bitmap.width, bitmap.height)
  if (big <= MAX_IMAGE_DIM) return bitmap
  // Very large photos: downscale once so later passes stay fast and memory-safe.
  const k = MAX_IMAGE_DIM / big
  try {
    const scaled = await createImageBitmap(bitmap, { resizeWidth: Math.round(bitmap.width * k), resizeHeight: Math.round(bitmap.height * k), resizeQuality: "high" })
    bitmap.close()
    return scaled
  } catch {
    return bitmap
  }
}

function addUnique(into: DetectedCode[], found: DetectedCode[]) {
  for (const c of found) if (!into.some((x) => x.value === c.value && x.format === c.format)) into.push(c)
}

/**
 * Find every code in a still image. Tries the native detector, then ZXing on the
 * whole image, rotated 90°, in overlapping tiles (small or multiple codes) and
 * inverted (light-on-dark). Large photos are downscaled.
 */
export async function scanImageFileAll(file: Blob, formats: CodeFormat[], opts: { max?: number } = {}): Promise<DetectedCode[]> {
  const max = opts.max ?? 8
  const bitmap = await loadBitmap(file)
  const found: DetectedCode[] = []
  try {
    const Ctor = nativeCtor()
    if (Ctor) {
      const supported = await nativeSupportedFormats()
      const usable = formats.filter((f) => supported.includes(f))
      const detector = usable.length ? createNative(Ctor, usable) : null
      if (detector) {
        try {
          addUnique(found, (await detector.detect(bitmap)).filter((b) => b.rawValue).map((b) => ({ value: b.rawValue, format: b.format })))
        } catch {
          /* fall back to ZXing */
        }
      }
    }
    if (found.length) return found.slice(0, max)

    const usable = formats.filter((f) => TO_ZXING[f])
    if (!usable.length) return []
    const zx = await loadZxing()
    const reader = zxReader(zx, usable, true)
    const canvas = document.createElement("canvas")
    const { width: W, height: H } = bitmap
    const pass = (o: Omit<Parameters<typeof toGray>[2], "maxDim">, invert = false) => {
      const gray = toGray(canvas, bitmap, { ...o, maxDim: PASS_DIM })
      if (gray) addUnique(found, zxDecodeAll(zx, reader, gray, max - found.length, invert))
      return found.length > 0
    }
    // Yield between passes so the UI stays responsive.
    const tick = () => new Promise((r) => setTimeout(r, 0))

    if (pass({})) return found
    await tick()
    if (pass({ rotate: true })) return found
    // Tiles: halves then quadrants, overlapping so codes on a seam are still whole.
    const tiles: Array<[number, number, number, number]> = []
    const ov = 0.15
    if (W >= H) tiles.push([0, 0, W * (0.5 + ov), H], [W * (0.5 - ov), 0, W * (0.5 + ov), H])
    else tiles.push([0, 0, W, H * (0.5 + ov)], [0, H * (0.5 - ov), W, H * (0.5 + ov)])
    if (Math.max(W, H) > 900) {
      for (const [qx, qy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ])
        tiles.push([qx * W * (0.5 - ov), qy * H * (0.5 - ov), W * (0.5 + ov), H * (0.5 + ov)])
    }
    for (const [sx, sy, sw, sh] of tiles) {
      await tick()
      pass({ sx, sy, sw, sh })
      if (found.length >= max) break
    }
    if (found.length) return found
    await tick()
    pass({}, true)
    return found
  } finally {
    bitmap.close()
  }
}

/** Decode a still image file (upload / photo). Returns the first code found. */
export async function scanImageFile(file: File, formats: CodeFormat[]): Promise<DetectedCode | null> {
  return (await scanImageFileAll(file, formats, { max: 1 }))[0] ?? null
}
