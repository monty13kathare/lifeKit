import { todayString } from "@/lib/dates"
import { uploadToCloudRelay, buildPublicShareUrl } from "./cloud-relay"
import {
  PACKAGE_EXTENSION,
  PBKDF2_ITERATIONS,
  base64url,
  buildPackage,
  buildPlaintext,
  deriveKey,
  encodeHeader,
  importRawKey,
  parsePlaintext,
  protectionOf,
  randomBytes,
  readPackage,
  type PackageHeader,
} from "./package-format"
import {
  ShareError,
  type OpenedShare,
  type ShareOptions,
  type SharePackageInfo,
  type ShareResult,
  type ShareService,
  type ShareStage,
} from "./share-service"

/** Web Crypto encrypts in one pass in memory, so keep packages to a sane size. */
export const MAX_SHARE_BYTES = 250 * 1024 * 1024

function infoFrom(header: PackageHeader, encryptedSize: number, now = Date.now()): SharePackageInfo {
  return {
    version: header.version,
    createdAt: header.createdAt,
    expiresAt: header.expiresAt,
    expired: Date.parse(header.expiresAt) <= now,
    allowDownload: header.allowDownload,
    protection: protectionOf(header),
    fileCount: header.fileCount,
    encryptedSize,
  }
}

/**
 * Browser-first zero-knowledge implementation: AES-256-GCM encryption with a key
 * derived from the password (PBKDF2-SHA256) or a random 256-bit share key.
 * Files are encrypted in-memory before upload, generating end-to-end secure public links.
 */
export class LocalShareService implements ShareService {
  readonly kind = "local" as const
  readonly createsPublicLinks = true

  static isSupported(): boolean {
    return typeof crypto !== "undefined" && typeof crypto.subtle?.encrypt === "function"
  }

  async createShare(input: File | File[], options: ShareOptions): Promise<ShareResult> {
    const files = Array.isArray(input) ? input : [input]
    if (!files.length) throw new ShareError("invalid-package", "Choose at least one file.")
    if (!LocalShareService.isSupported()) {
      throw new ShareError("unsupported", "This browser can't encrypt files (Web Crypto is unavailable). Use https or a newer browser.")
    }
    const total = files.reduce((n, f) => n + f.size, 0)
    if (total > MAX_SHARE_BYTES) {
      throw new ShareError("too-large", "Files over 250 MB in total can't be encrypted in the browser.")
    }
    if (options.expiresAt.getTime() <= Date.now()) {
      throw new ShareError("expired", "The expiry time must be in the future.")
    }
    const stage = (s: ShareStage) => options.onStage?.(s)

    const iv = randomBytes(12)
    let key: CryptoKey
    let shareKey: string | undefined
    let kdf: PackageHeader["kdf"]
    if (options.password) {
      stage("deriving-key")
      const salt = randomBytes(16)
      key = await deriveKey(options.password, salt, PBKDF2_ITERATIONS)
      kdf = { name: "PBKDF2-SHA256", iterations: PBKDF2_ITERATIONS, salt: base64url.encode(salt) }
    } else {
      const raw = randomBytes(32)
      key = await importRawKey(raw)
      shareKey = base64url.encode(raw)
      kdf = { name: "none" }
    }

    const header: PackageHeader = {
      format: "lifekit-share",
      version: 1,
      cipher: "AES-256-GCM",
      kdf,
      iv: base64url.encode(iv),
      createdAt: new Date().toISOString(),
      expiresAt: options.expiresAt.toISOString(),
      allowDownload: options.allowDownload,
      fileCount: files.length,
    }
    const headerBytes = encodeHeader(header)

    stage("reading")
    const plaintext = await buildPlaintext(files, options.notes)
    stage("encrypting")
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: headerBytes }, key, plaintext)
    plaintext.fill(0)

    // Neutral file name: the real names are inside the encrypted part.
    const suffix = base64url.encode(randomBytes(3))
    const pkgName = `secure-share-${todayString()}-${suffix}${PACKAGE_EXTENSION}`
    const pkg = buildPackage(headerBytes, ciphertext, pkgName)

    let publicUrl: string | null = null
    let publiclyAccessible = false

    // If public link mode is requested (default), upload encrypted blob to zero-knowledge cloud relay
    if (options.isPublicLink !== false) {
      stage("uploading")
      const cloudRes = await uploadToCloudRelay(pkg, pkgName)
      publicUrl = buildPublicShareUrl(cloudRes.downloadUrl, shareKey, !!options.password)
      publiclyAccessible = true
    }

    stage("done")

    return {
      package: pkg,
      protection: shareKey ? "key" : "password",
      shareKey,
      expiresAt: header.expiresAt,
      allowDownload: header.allowDownload,
      fileCount: files.length,
      localUrl: URL.createObjectURL(pkg),
      publicUrl,
      publiclyAccessible,
    }
  }

  async inspectShare(pkg: Blob): Promise<SharePackageInfo> {
    const { header, body } = await readPackage(pkg)
    return infoFrom(header, body.size)
  }

  async openShare(pkg: Blob, secret: string, options?: { onStage?: (stage: ShareStage) => void }): Promise<OpenedShare> {
    if (!LocalShareService.isSupported()) {
      throw new ShareError("unsupported", "This browser can't decrypt files (Web Crypto is unavailable).")
    }
    const { header, headerBytes, body } = await readPackage(pkg)
    const info = infoFrom(header, body.size)
    // App-level policy check. The ciphertext itself has no notion of time.
    if (info.expired) throw new ShareError("expired", "This package has expired and can no longer be opened in LifeKit.")
    const trimmed = header.kdf.name === "none" ? secret.trim() : secret
    if (!trimmed) {
      throw new ShareError("wrong-secret", header.kdf.name === "none" ? "Enter the share key." : "Enter the password.")
    }

    let key: CryptoKey
    if (header.kdf.name === "none") {
      let raw: Uint8Array<ArrayBuffer>
      try {
        raw = base64url.decode(trimmed)
      } catch {
        throw new ShareError("wrong-secret", "That share key isn't valid. Check you copied all of it.")
      }
      if (raw.length !== 32) throw new ShareError("wrong-secret", "That share key isn't valid. Check you copied all of it.")
      key = await importRawKey(raw)
    } else {
      options?.onStage?.("deriving-key")
      key = await deriveKey(trimmed, base64url.decode(header.kdf.salt), header.kdf.iterations)
    }

    options?.onStage?.("decrypting")
    let plain: ArrayBuffer
    try {
      plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64url.decode(header.iv), additionalData: headerBytes },
        key,
        await body.arrayBuffer()
      )
    } catch {
      throw new ShareError(
        "wrong-secret",
        header.kdf.name === "none"
          ? "Couldn't decrypt: the share key is wrong, or the package was modified."
          : "Couldn't decrypt: the password is wrong, or the package was modified."
      )
    }
    const { meta, files } = parsePlaintext(new Uint8Array(plain))
    options?.onStage?.("done")
    return { info, files, notes: meta.notes }
  }

  release(result: ShareResult) {
    URL.revokeObjectURL(result.localUrl)
  }
}
