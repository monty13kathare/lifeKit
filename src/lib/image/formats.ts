import { canEncode, MB } from "@/lib/files"

export type ImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/avif"
/** "keep" means: same as the input when the browser can encode it. */
export type OutputChoice = "keep" | ImageMime

export const FORMAT_INFO: Record<ImageMime, { label: string; ext: string; lossy: boolean }> = {
  "image/jpeg": { label: "JPG", ext: "jpg", lossy: true },
  "image/png": { label: "PNG", ext: "png", lossy: false },
  "image/webp": { label: "WebP", ext: "webp", lossy: true },
  "image/avif": { label: "AVIF", ext: "avif", lossy: true },
}

/** Common upload limits for the image tools. */
export const IMAGE_MAX_BYTES = 50 * MB
export const IMAGE_WARN_BYTES = 15 * MB

/** Input formats any modern browser can usually decode. Extensions cover files with an empty MIME type. */
export const BASIC_IMAGE_ACCEPT = ["image/jpeg", "image/png", "image/webp", ".jpg", ".jpeg", ".png", ".webp"] as const
export const EXTENDED_IMAGE_ACCEPT = [
  ...BASIC_IMAGE_ACCEPT,
  "image/gif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/avif",
  ".gif",
  ".bmp",
  ".avif",
] as const

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  avif: "image/avif",
}

/** MIME type of a file, falling back to its extension when the browser reports none. */
export function mimeOf(file: File): string {
  if (file.type) return file.type === "image/x-ms-bmp" ? "image/bmp" : file.type
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  return EXT_TO_MIME[ext] ?? ""
}

export function shortFormatLabel(mime: string): string {
  if (mime in FORMAT_INFO) return FORMAT_INFO[mime as ImageMime].label
  return mime.replace("image/", "").toUpperCase() || "Image"
}

/** Formats this browser can encode via canvas, in display order. */
export function detectEncodableFormats(): ImageMime[] {
  const out: ImageMime[] = ["image/jpeg", "image/png"]
  if (canEncode("image/webp")) out.push("image/webp")
  if (canEncode("image/avif")) out.push("image/avif")
  return out
}

/** Resolve an output choice to a concrete MIME type for a given input. */
export function resolveOutput(choice: OutputChoice, inputMime: string, encodable: readonly ImageMime[]): ImageMime {
  if (choice !== "keep") return choice
  if ((encodable as readonly string[]).includes(inputMime)) return inputMime as ImageMime
  return "image/png"
}

export function isLossy(mime: ImageMime) {
  return FORMAT_INFO[mime].lossy
}

export function percentSaved(before: number, after: number) {
  if (before <= 0) return 0
  return Math.round(((before - after) / before) * 100)
}
