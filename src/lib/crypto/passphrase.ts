/**
 * Passphrase-based encryption using the Web Crypto API.
 *
 *   key  = PBKDF2-SHA256(passphrase, random 16-byte salt, 310 000 iterations) → AES-GCM 256
 *   data = AES-GCM(key, random 12-byte IV, JSON.stringify(secret))
 *
 * Nothing leaves the browser. The passphrase is never stored; a lost
 * passphrase means the data cannot be recovered.
 */
import type { EncryptedPayload } from "@/types"

export const PBKDF2_ITERATIONS = 310_000
const SALT_BYTES = 16
const IV_BYTES = 12

export class DecryptError extends Error {
  constructor(message = "Wrong passphrase or damaged data") {
    super(message)
    this.name = "DecryptError"
  }
}

export function isCryptoSupported(): boolean {
  return typeof window !== "undefined" && !!window.crypto?.subtle && typeof window.crypto.getRandomValues === "function"
}

function toBase64(bytes: Uint8Array): string {
  let s = ""
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(s.length))
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"])
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function encryptJson(value: unknown, passphrase: string): Promise<EncryptedPayload> {
  if (!isCryptoSupported()) throw new Error("Encryption isn't supported in this browser")
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(SALT_BYTES)))
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(IV_BYTES)))
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS)
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext))
  return { salt: toBase64(salt), iv: toBase64(iv), cipher: toBase64(cipher), iterations: PBKDF2_ITERATIONS }
}

export async function decryptJson<T>(payload: EncryptedPayload, passphrase: string): Promise<T> {
  if (!isCryptoSupported()) throw new Error("Encryption isn't supported in this browser")
  try {
    // Older payloads have no iteration count; they were all written with 310k.
    const key = await deriveKey(passphrase, fromBase64(payload.salt), payload.iterations ?? 310_000)
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(payload.iv) }, key, fromBase64(payload.cipher))
    return JSON.parse(new TextDecoder().decode(plain)) as T
  } catch {
    // AES-GCM authentication failure → wrong passphrase (or tampered data).
    throw new DecryptError()
  }
}
