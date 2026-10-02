/**
 * Barcode decoding in the browser. Prefers the native `BarcodeDetector`
 * (Chrome/Android, Safari 17+ partially) and falls back to `html5-qrcode`
 * (ZXing, loaded on demand). Nothing leaves the device.
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

// ---- ZXing via html5-qrcode -----------------------------------------------
type Html5Module = typeof import("html5-qrcode")

const TO_ZXING: Record<CodeFormat, keyof Html5Module["Html5QrcodeSupportedFormats"]> = {
  qr_code: "QR_CODE",
  ean_13: "EAN_13",
  ean_8: "EAN_8",
  upc_a: "UPC_A",
  upc_e: "UPC_E",
  code_128: "CODE_128",
  code_39: "CODE_39",
  code_93: "CODE_93",
  itf: "ITF",
  codabar: "CODABAR",
  data_matrix: "DATA_MATRIX",
  pdf417: "PDF_417",
  aztec: "AZTEC",
}

function fromZxingName(name: string | undefined): string {
  if (!name) return "unknown"
  const entry = Object.entries(TO_ZXING).find(([, z]) => z === name)
  return entry ? entry[0] : name.toLowerCase()
}

let zxingCounter = 0

async function createZxingDecoder(formats: CodeFormat[], maxDim = 1000): Promise<Decoder> {
  const mod = await import("html5-qrcode")
  // html5-qrcode needs a DOM element id even for file scans; keep it hidden.
  const host = document.createElement("div")
  host.id = `lk-zxing-${++zxingCounter}`
  host.setAttribute("aria-hidden", "true")
  host.style.cssText = "position:fixed;left:-9999px;top:0;width:400px;height:400px;overflow:hidden;opacity:0;pointer-events:none"
  document.body.appendChild(host)
  const scanner = new mod.Html5Qrcode(host.id, {
    verbose: false,
    formatsToSupport: formats.map((f) => mod.Html5QrcodeSupportedFormats[TO_ZXING[f]]),
    useBarCodeDetectorIfSupported: false,
  })
  const canvas = document.createElement("canvas")
  let busy = false

  return {
    kind: "zxing",
    formats,
    async decode(source) {
      if (busy) return null
      busy = true
      try {
        const { width, height } = sourceSize(source)
        if (!width || !height) return null
        // Downscale big frames: ZXing is CPU-bound and 1000px is plenty.
        const scale = Math.min(1, maxDim / Math.max(width, height))
        canvas.width = Math.round(width * scale)
        canvas.height = Math.round(height * scale)
        const ctx = canvas.getContext("2d")!
        // Flatten transparency onto white so transparent PNG codes stay readable.
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92))
        if (!blob) return null
        const file = new File([blob], "frame.jpg", { type: "image/jpeg" })
        const res = await scanner.scanFileV2(file, false)
        return { value: res.decodedText, format: fromZxingName(res.result.format?.formatName) }
      } catch {
        return null
      } finally {
        busy = false
      }
    },
    dispose() {
      try {
        scanner.clear()
      } catch {
        /* ignore */
      }
      host.remove()
    },
  }
}

function sourceSize(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap) {
  if (source instanceof HTMLVideoElement) return { width: source.videoWidth, height: source.videoHeight }
  return { width: source.width, height: source.height }
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
    if (ok) {
      try {
        const detector = new Ctor({ formats: usable })
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
      } catch {
        /* fall through to ZXing */
      }
    }
  }
  return createZxingDecoder(formats, opts.maxDim)
}

/** Decode a still image file (upload / photo). Tries native first, then ZXing. */
export async function scanImageFile(file: File, formats: CodeFormat[]): Promise<DetectedCode | null> {
  const decoder = await createDecoder(formats, { maxDim: 1600 })
  try {
    let bitmap: ImageBitmap | HTMLCanvasElement
    try {
      bitmap = await createImageBitmap(file)
    } catch {
      throw new Error("This image couldn't be read. It may be corrupted or in an unsupported format.")
    }
    let result = await decoder.decode(bitmap)
    if (!result && decoder.kind === "native") {
      // Native detection can miss what ZXing finds (and vice versa).
      const fallback = await createZxingDecoder(formats, 1600)
      try {
        result = await fallback.decode(bitmap)
      } finally {
        fallback.dispose()
      }
    }
    if ("close" in bitmap) bitmap.close()
    return result
  } finally {
    decoder.dispose()
  }
}
