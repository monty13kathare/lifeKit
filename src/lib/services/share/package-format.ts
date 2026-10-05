import { z } from "zod"
import { ShareError, type ShareProtection, type SharedFileInfo } from "./share-service"

/**
 * `.lifekit` package layout (all integers big-endian):
 *
 *   magic        8 bytes   "LKSHARE1"
 *   headerLen    4 bytes   uint32
 *   header       N bytes   UTF-8 JSON (unencrypted, but authenticated as AES-GCM AAD)
 *   ciphertext   rest      AES-256-GCM( metaLen:uint32 | meta JSON | file bytes… ) + 16-byte tag
 *
 * The header holds what the recipient needs before decrypting (KDF salt, IV,
 * expiry, allowDownload). File names, types, sizes and notes are inside the
 * encrypted part. Because the header is AAD, editing it (e.g. extending the
 * expiry) makes decryption fail.
 */

export const MAGIC = "LKSHARE1"
export const PACKAGE_EXTENSION = ".lifekit"
export const PBKDF2_ITERATIONS = 600_000
const MAX_HEADER = 64 * 1024

const b64 = {
  encode(bytes: Uint8Array): string {
    let s = ""
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  },
  decode(text: string): Uint8Array<ArrayBuffer> {
    const norm = text.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/")
    const bin = atob(norm + "=".repeat((4 - (norm.length % 4)) % 4))
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  },
}
export const base64url = b64

export const headerSchema = z.object({
  format: z.literal("lifekit-share"),
  version: z.number().int(),
  cipher: z.literal("AES-256-GCM"),
  kdf: z.discriminatedUnion("name", [
    z.object({ name: z.literal("PBKDF2-SHA256"), iterations: z.number().int().min(100_000).max(10_000_000), salt: z.string() }),
    z.object({ name: z.literal("none") }),
  ]),
  iv: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  allowDownload: z.boolean(),
  fileCount: z.number().int().min(1),
  notes: z.string().optional(),
})
export type PackageHeader = z.infer<typeof headerSchema>

export const metaSchema = z.object({
  files: z.array(
    z.object({ name: z.string(), type: z.string(), size: z.number().int().min(0), lastModified: z.number().optional() })
  ),
})
export type PackageMeta = { files: SharedFileInfo[] }

const enc = new TextEncoder()
const dec = new TextDecoder()

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(n)
  crypto.getRandomValues(b)
  return b
}

export async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(password.normalize("NFC")), "PBKDF2", false, ["deriveKey"])
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

export function importRawKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
}

/** Assemble the plaintext: metadata length + metadata + file bytes. */
export async function buildPlaintext(files: File[]): Promise<Uint8Array<ArrayBuffer>> {
  const meta: PackageMeta = {
    files: files.map((f) => ({ name: f.name, type: f.type, size: f.size, lastModified: f.lastModified })),
  }
  const metaBytes = enc.encode(JSON.stringify(meta))
  const total = 4 + metaBytes.length + files.reduce((n, f) => n + f.size, 0)
  const out = new Uint8Array(total)
  new DataView(out.buffer).setUint32(0, metaBytes.length)
  out.set(metaBytes, 4)
  let offset = 4 + metaBytes.length
  for (const f of files) {
    out.set(new Uint8Array(await f.arrayBuffer()), offset)
    offset += f.size
  }
  return out
}

export function parsePlaintext(plain: Uint8Array): { meta: PackageMeta; files: File[] } {
  const view = new DataView(plain.buffer, plain.byteOffset, plain.byteLength)
  const metaLen = view.getUint32(0)
  if (metaLen > plain.length - 4) throw new ShareError("invalid-package", "The package contents are damaged.")
  const parsed = metaSchema.safeParse(JSON.parse(dec.decode(plain.subarray(4, 4 + metaLen))))
  if (!parsed.success) throw new ShareError("invalid-package", "The package contents are damaged.")
  let offset = 4 + metaLen
  const files = parsed.data.files.map((f) => {
    const bytes = plain.slice(offset, offset + f.size)
    offset += f.size
    return new File([bytes], f.name, { type: f.type, lastModified: f.lastModified })
  })
  return { meta: parsed.data, files }
}

export function encodeHeader(header: PackageHeader): Uint8Array<ArrayBuffer> {
  return enc.encode(JSON.stringify(header))
}

export function buildPackage(headerBytes: Uint8Array<ArrayBuffer>, ciphertext: ArrayBuffer, fileName: string): File {
  const prefix = new Uint8Array(12)
  prefix.set(enc.encode(MAGIC), 0)
  new DataView(prefix.buffer).setUint32(8, headerBytes.length)
  return new File([prefix, headerBytes, ciphertext], fileName, { type: "application/octet-stream" })
}

export async function readPackage(pkg: Blob): Promise<{ header: PackageHeader; headerBytes: Uint8Array<ArrayBuffer>; body: Blob }> {
  if (pkg.size < 12 + 16) throw new ShareError("invalid-package", "This isn't a LifeKit package (the file is too small).")
  const prefix = new Uint8Array(await pkg.slice(0, 12).arrayBuffer())
  if (dec.decode(prefix.subarray(0, 8)) !== MAGIC) {
    throw new ShareError("invalid-package", "This isn't a LifeKit SecureShare package.")
  }
  const headerLen = new DataView(prefix.buffer).getUint32(8)
  if (headerLen <= 0 || headerLen > MAX_HEADER || 12 + headerLen >= pkg.size) {
    throw new ShareError("invalid-package", "The package header is damaged.")
  }
  const headerBytes = new Uint8Array(await pkg.slice(12, 12 + headerLen).arrayBuffer())
  let json: unknown
  try {
    json = JSON.parse(dec.decode(headerBytes))
  } catch {
    throw new ShareError("invalid-package", "The package header is damaged.")
  }
  const version = (json as { version?: unknown })?.version
  if (typeof version === "number" && version > 1) {
    throw new ShareError("unsupported-version", "This package was made by a newer version of LifeKit. Update the app and try again.")
  }
  const parsed = headerSchema.safeParse(json)
  if (!parsed.success) throw new ShareError("invalid-package", "The package header is damaged or not supported.")
  return { header: parsed.data, headerBytes, body: pkg.slice(12 + headerLen) }
}

export function protectionOf(header: PackageHeader): ShareProtection {
  return header.kdf.name === "none" ? "key" : "password"
}
