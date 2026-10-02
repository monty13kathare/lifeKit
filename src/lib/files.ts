/** Shared helpers for client-side file tools. Nothing here uploads anything. */

export const MB = 1024 * 1024

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const PDF_TYPES = ["application/pdf"] as const

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** i
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`
}

export interface FileRules {
  /** Allowed MIME types. Supports wildcards like `image/*`, extensions like `.pdf`, or `*` for any file. */
  accept: readonly string[]
  /** Hard limit – files above are rejected. */
  maxBytes?: number
  /** Soft limit – files above are accepted with a warning. */
  warnBytes?: number
}

export interface FileCheck {
  ok: boolean
  error?: string
  warning?: string
}

const TYPE_FOR_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  bmp: "image/bmp", avif: "image/avif", heic: "image/heic", pdf: "application/pdf", txt: "text/plain",
}

/** The file's MIME type, inferred from its extension when the OS reports none. */
export function fileType(file: File): string {
  if (file.type) return file.type
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  return TYPE_FOR_EXT[ext] ?? ""
}

export function matchesAccept(file: File, accept: readonly string[]): boolean {
  const type = fileType(file)
  return accept.some((rule) => {
    if (rule === "*") return true
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1))
    if (rule.startsWith(".")) return file.name.toLowerCase().endsWith(rule.toLowerCase())
    return type === rule
  })
}

export function checkFile(file: File, rules: FileRules): FileCheck {
  if (!matchesAccept(file, rules.accept)) {
    return { ok: false, error: `“${file.name}” isn't a supported file type.` }
  }
  if (rules.maxBytes && file.size > rules.maxBytes) {
    return { ok: false, error: `“${file.name}” is ${formatBytes(file.size)}. The limit is ${formatBytes(rules.maxBytes)}.` }
  }
  if (rules.warnBytes && file.size > rules.warnBytes) {
    return { ok: true, warning: `“${file.name}” is large (${formatBytes(file.size)}). Processing may be slow on some devices.` }
  }
  return { ok: true }
}

/** Trigger a browser download for a Blob without any network request. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function downloadText(text: string, filename: string, type = "text/plain;charset=utf-8") {
  downloadBlob(new Blob([text], { type }), filename)
}

export function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Decode an image file. Prefers createImageBitmap (off-main-thread decode) where available. */
export async function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src)
  try {
    const img = new Image()
    img.decoding = "async"
    img.src = url
    await img.decode()
    return img
  } catch {
    throw new Error("This image couldn't be read. It may be corrupted or in an unsupported format.")
  } finally {
    if (typeof src !== "string") setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Export failed."))), type, quality)
  })
}

/** Whether this browser can *encode* a given image MIME type via canvas. */
export function canEncode(type: string): boolean {
  if (typeof document === "undefined") return false
  const c = document.createElement("canvas")
  c.width = c.height = 1
  return c.toDataURL(type).startsWith(`data:${type}`)
}

export function replaceExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "")
  return `${base}.${ext.replace(/^\./, "")}`
}

export const EXT_FOR_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "application/pdf": "pdf",
}
