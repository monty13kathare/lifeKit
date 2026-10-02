"use client"

/**
 * tesseract.js wrapper: lazy import, one cached worker per language set,
 * friendly progress messages, and image pre-processing helpers.
 */

export interface OcrLanguage {
  code: string
  label: string
  /** BCP-47 tag for speechSynthesis / translation hints. */
  bcp47: string
}

export const OCR_LANGUAGES: OcrLanguage[] = [
  { code: "eng", label: "English", bcp47: "en" },
  { code: "hin", label: "Hindi", bcp47: "hi-IN" },
  { code: "spa", label: "Spanish", bcp47: "es" },
  { code: "fra", label: "French", bcp47: "fr" },
  { code: "deu", label: "German", bcp47: "de" },
  { code: "ita", label: "Italian", bcp47: "it" },
  { code: "por", label: "Portuguese", bcp47: "pt" },
  { code: "nld", label: "Dutch", bcp47: "nl" },
  { code: "rus", label: "Russian", bcp47: "ru" },
  { code: "ukr", label: "Ukrainian", bcp47: "uk" },
  { code: "pol", label: "Polish", bcp47: "pl" },
  { code: "tur", label: "Turkish", bcp47: "tr" },
  { code: "ara", label: "Arabic", bcp47: "ar" },
  { code: "urd", label: "Urdu", bcp47: "ur" },
  { code: "ben", label: "Bengali", bcp47: "bn-IN" },
  { code: "mar", label: "Marathi", bcp47: "mr-IN" },
  { code: "guj", label: "Gujarati", bcp47: "gu-IN" },
  { code: "pan", label: "Punjabi", bcp47: "pa-IN" },
  { code: "tam", label: "Tamil", bcp47: "ta-IN" },
  { code: "tel", label: "Telugu", bcp47: "te-IN" },
  { code: "kan", label: "Kannada", bcp47: "kn-IN" },
  { code: "mal", label: "Malayalam", bcp47: "ml-IN" },
  { code: "chi_sim", label: "Chinese (Simplified)", bcp47: "zh-CN" },
  { code: "chi_tra", label: "Chinese (Traditional)", bcp47: "zh-TW" },
  { code: "jpn", label: "Japanese", bcp47: "ja" },
  { code: "kor", label: "Korean", bcp47: "ko" },
  { code: "vie", label: "Vietnamese", bcp47: "vi" },
  { code: "ind", label: "Indonesian", bcp47: "id" },
]

export function languageOf(code: string): OcrLanguage {
  return OCR_LANGUAGES.find((l) => l.code === code) ?? OCR_LANGUAGES[0]
}

export interface OcrProgress {
  status: string
  /** 0–1 for the current stage. */
  progress: number
}

const STATUS_LABELS: Record<string, string> = {
  "loading tesseract core": "Loading OCR engine",
  "initializing tesseract": "Starting OCR engine",
  "initialized tesseract": "OCR engine ready",
  "loading language traineddata": "Loading language data",
  "loading language traineddata (from cache)": "Loading language data (cached)",
  "loaded language traineddata": "Language data ready",
  "initializing api": "Preparing",
  "initialized api": "Ready",
  "recognizing text": "Reading text",
}

export function friendlyStatus(status: string): string {
  return STATUS_LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1)
}

type TesseractWorker = Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>

export interface OcrResult {
  text: string
  confidence: number
}

/** Owns at most one tesseract worker; recreated when languages change. */
export class OcrEngine {
  private worker: TesseractWorker | null = null
  private langKey = ""
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private onProgress: (p: OcrProgress) => void = () => {}

  setProgressHandler(fn: (p: OcrProgress) => void) {
    this.onProgress = fn
  }

  async recognize(image: HTMLCanvasElement, langs: string[]): Promise<OcrResult> {
    this.clearIdle()
    const key = langs.join("+")
    if (!this.worker || this.langKey !== key) {
      await this.terminate()
      const { createWorker } = await import("tesseract.js")
      this.onProgress({ status: "Loading OCR engine", progress: 0 })
      this.worker = await createWorker(langs, 1, {
        logger: (m) => this.onProgress({ status: friendlyStatus(m.status), progress: typeof m.progress === "number" ? m.progress : 0 }),
        errorHandler: () => {},
      })
      this.langKey = key
    }
    const { data } = await this.worker.recognize(image)
    this.scheduleIdle()
    return { text: data.text ?? "", confidence: Math.round(data.confidence ?? 0) }
  }

  /** Free the worker after a period of inactivity. */
  private scheduleIdle() {
    this.idleTimer = setTimeout(() => void this.terminate(), 120_000)
  }

  private clearIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
  }

  async terminate() {
    this.clearIdle()
    const w = this.worker
    this.worker = null
    this.langKey = ""
    if (w) await w.terminate().catch(() => undefined)
  }
}

/** Draw any image source to a canvas, upscaling small images (helps OCR) and capping huge ones. */
export function toCanvas(source: CanvasImageSource & { width: number; height: number }, naturalW?: number, naturalH?: number): HTMLCanvasElement {
  const w = naturalW ?? source.width
  const h = naturalH ?? source.height
  const longest = Math.max(w, h)
  const scale = longest < 1000 ? Math.min(2.5, 1600 / longest) : Math.min(1, 4000 / longest)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

export interface Preprocess {
  grayscale: boolean
  contrast: boolean
}

/** Grayscale + contrast stretch. Returns a new canvas; the source is untouched. */
export function preprocess(src: HTMLCanvasElement, opts: Preprocess): HTMLCanvasElement {
  if (!opts.grayscale && !opts.contrast) return src
  const canvas = document.createElement("canvas")
  canvas.width = src.width
  canvas.height = src.height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.drawImage(src, 0, 0)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  const factor = 1.6
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]
    let g = d[i + 1]
    let b = d[i + 2]
    if (opts.grayscale) r = g = b = 0.299 * r + 0.587 * g + 0.114 * b
    if (opts.contrast) {
      r = (r - 128) * factor + 128
      g = (g - 128) * factor + 128
      b = (b - 128) * factor + 128
    }
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}
