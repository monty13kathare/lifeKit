/**
 * File sharing behind an interface. The local implementation encrypts files
 * into a self-contained `.lifekit` package in the browser; a future backend
 * implementation could upload that package and return a real public link
 * without changing the UI.
 */

export interface ShareOptions {
  /** When the package should stop opening. Enforced by the app, not by cryptography. */
  expiresAt: Date
  /** Optional password. Without one, a random share key is generated. */
  password?: string
  /** Whether recipients are offered a download button (cannot be enforced client-side). */
  allowDownload: boolean
  /** Private note, encrypted together with the files. */
  notes?: string
  /** Progress callback for long operations. */
  onStage?: (stage: ShareStage) => void
}

export type ShareStage = "reading" | "deriving-key" | "encrypting" | "decrypting" | "done"

export type ShareProtection = "password" | "key"

export interface ShareResult {
  /** The encrypted package, ready to download or share. */
  package: File
  protection: ShareProtection
  /** Random key the recipient needs when no password was set. Show once; never stored. */
  shareKey?: string
  expiresAt: string
  allowDownload: boolean
  fileCount: number
  /** A URL that only works in this browser tab (`blob:`) — never reachable by others. */
  localUrl: string
  /** A link other people can open. Always null for the local implementation. */
  publicUrl: string | null
  publiclyAccessible: boolean
}

export interface SharedFileInfo {
  name: string
  type: string
  size: number
  lastModified?: number
}

/** What can be read from a package *without* the password. */
export interface SharePackageInfo {
  version: number
  createdAt: string
  expiresAt: string
  expired: boolean
  allowDownload: boolean
  protection: ShareProtection
  fileCount: number
  encryptedSize: number
}

export interface OpenedShare {
  info: SharePackageInfo
  files: File[]
  notes?: string
}

export type ShareErrorCode = "invalid-package" | "unsupported-version" | "expired" | "wrong-secret" | "too-large" | "unsupported"

export class ShareError extends Error {
  constructor(
    readonly code: ShareErrorCode,
    message: string
  ) {
    super(message)
    this.name = "ShareError"
  }
}

export interface ShareService {
  readonly kind: "local" | "remote"
  /** Whether this implementation can produce links that work on other devices. */
  readonly createsPublicLinks: boolean
  createShare(files: File | File[], options: ShareOptions): Promise<ShareResult>
  /** Read the unencrypted header (expiry, protection, …) of a package. */
  inspectShare(pkg: Blob): Promise<SharePackageInfo>
  /** Check expiry, decrypt with the password or share key, and return the files. */
  openShare(pkg: Blob, secret: string, options?: { onStage?: (stage: ShareStage) => void }): Promise<OpenedShare>
  /** Release resources (e.g. revoke the local blob URL). */
  release(result: ShareResult): void
}
