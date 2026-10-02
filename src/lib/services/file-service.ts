import { downloadBlob } from "@/lib/files"

/**
 * File operations behind an interface so a backend (e.g. a NestJS API with
 * object storage) can replace the local implementation without UI changes.
 */
export interface FileService {
  /** Where files live. `local` = this browser only. */
  readonly kind: "local" | "remote"
  /** Persist a file and return a handle. Local: an in-memory object URL. */
  upload(file: Blob, name: string): Promise<StoredFile>
  download(file: Blob, name: string): Promise<void>
  /** Share via the OS share sheet when available. Resolves false if unsupported or cancelled. */
  share(input: { files?: File[]; title?: string; text?: string; url?: string }): Promise<boolean>
  canShareFiles(files: File[]): boolean
}

export interface StoredFile {
  id: string
  name: string
  size: number
  type: string
  /** A URL that works in *this* browser session only for the local adapter. */
  url: string
  /** Whether `url` is reachable by other people/devices. Always false locally. */
  publiclyAccessible: boolean
}

export class LocalFileService implements FileService {
  readonly kind = "local" as const

  async upload(file: Blob, name: string): Promise<StoredFile> {
    return {
      id: crypto.randomUUID(),
      name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
      publiclyAccessible: false,
    }
  }

  async download(file: Blob, name: string) {
    downloadBlob(file, name)
  }

  canShareFiles(files: File[]) {
    return typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files })
  }

  async share(input: { files?: File[]; title?: string; text?: string; url?: string }) {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false
    if (input.files?.length && !this.canShareFiles(input.files)) return false
    try {
      await navigator.share(input)
      return true
    } catch (err) {
      // AbortError = user cancelled the share sheet; not an error worth surfacing.
      if ((err as DOMException)?.name !== "AbortError") console.warn("[LifeKit] share failed", err)
      return false
    }
  }
}
