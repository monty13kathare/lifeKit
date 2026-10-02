/**
 * Cryptographically secure password / passphrase generation.
 * Uses `crypto.getRandomValues` with rejection sampling so every character
 * is equally likely (no modulo bias). Nothing here is ever persisted.
 */

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const LOWER = "abcdefghijklmnopqrstuvwxyz"
const DIGITS = "0123456789"
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?/~|"
/** Characters that are easy to confuse when read or typed. */
export const AMBIGUOUS = "Il1|O0o`'\""

export type CharSet = "upper" | "lower" | "digits" | "symbols"

export const CHARSETS: { id: CharSet; label: string; sample: string; chars: string }[] = [
  { id: "upper", label: "Uppercase", sample: "A–Z", chars: UPPER },
  { id: "lower", label: "Lowercase", sample: "a–z", chars: LOWER },
  { id: "digits", label: "Numbers", sample: "0–9", chars: DIGITS },
  { id: "symbols", label: "Symbols", sample: "!@#$", chars: SYMBOLS },
]

export interface PasswordOptions {
  length: number
  sets: Record<CharSet, boolean>
  excludeAmbiguous: boolean
}

const BUFFER_SIZE = 256
let buffer = new Uint32Array(0)
let cursor = 0

function nextUint32(): number {
  if (cursor >= buffer.length) {
    buffer = new Uint32Array(BUFFER_SIZE)
    crypto.getRandomValues(buffer)
    cursor = 0
  }
  return buffer[cursor++]
}

/** Uniform integer in [0, max) via rejection sampling. */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) throw new RangeError("max out of range")
  // Largest multiple of `max` that fits in 2^32; values at or above it are rejected.
  const limit = Math.floor(2 ** 32 / max) * max
  let v = nextUint32()
  while (v >= limit) v = nextUint32()
  return v % max
}

export function secureShuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function pick(chars: string): string {
  return chars[randomInt(chars.length)]
}

export function activeSets(opts: PasswordOptions): string[] {
  return CHARSETS.filter((s) => opts.sets[s.id]).map((s) =>
    opts.excludeAmbiguous ? [...s.chars].filter((c) => !AMBIGUOUS.includes(c)).join("") : s.chars
  )
}

export function poolSize(opts: PasswordOptions): number {
  return activeSets(opts).reduce((n, s) => n + s.length, 0)
}

export function validateOptions(opts: PasswordOptions): string | null {
  const sets = activeSets(opts)
  if (!sets.length) return "Select at least one character type."
  if (opts.length < sets.length) return `Length must be at least ${sets.length} to include every selected type.`
  return null
}

/** One password that contains at least one character from every selected set. */
export function generatePassword(opts: PasswordOptions): string {
  const sets = activeSets(opts)
  const pool = sets.join("")
  const chars = sets.map(pick)
  while (chars.length < opts.length) chars.push(pick(pool))
  return secureShuffle(chars).join("")
}

export interface PassphraseOptions {
  words: number
  separator: string
  capitalize: boolean
  addNumber: boolean
}

export function generatePassphrase(opts: PassphraseOptions, list: readonly string[]): string {
  const words = Array.from({ length: opts.words }, () => {
    const w = list[randomInt(list.length)]
    return opts.capitalize ? w[0].toUpperCase() + w.slice(1) : w
  })
  if (opts.addNumber) {
    const i = randomInt(words.length)
    words[i] = words[i] + String(randomInt(100))
  }
  return words.join(opts.separator)
}

export function passwordEntropy(opts: PasswordOptions): number {
  const pool = poolSize(opts)
  return pool > 0 ? opts.length * Math.log2(pool) : 0
}

export function passphraseEntropy(opts: PassphraseOptions, listSize: number): number {
  let bits = opts.words * Math.log2(listSize)
  if (opts.addNumber) bits += Math.log2(100) + Math.log2(opts.words)
  return bits
}

export interface Strength {
  label: string
  tone: "destructive" | "warning" | "success" | "primary"
  /** 0–1 for the meter. */
  score: number
}

export function strengthFor(bits: number): Strength {
  const score = Math.min(1, bits / 128)
  if (bits < 28) return { label: "Very weak", tone: "destructive", score }
  if (bits < 36) return { label: "Weak", tone: "destructive", score }
  if (bits < 60) return { label: "Fair", tone: "warning", score }
  if (bits < 80) return { label: "Strong", tone: "success", score }
  return { label: "Very strong", tone: "primary", score }
}

/** Guesses per second for an offline attack on a fast hash with a GPU rig. */
export const GUESSES_PER_SECOND = 1e10

/** Rough average time to brute-force (half the keyspace). */
export function crackTime(bits: number): string {
  const seconds = 2 ** (bits - 1) / GUESSES_PER_SECOND
  if (seconds < 1) return "instantly"
  if (seconds / 31_557_600 > 1.38e10) return "longer than the age of the universe"
  const steps: [string, string, number][] = [
    ["second", "seconds", 60],
    ["minute", "minutes", 60],
    ["hour", "hours", 24],
    ["day", "days", 365.25],
    ["year", "years", 100],
    ["century", "centuries", 10],
    ["millennium", "millennia", Infinity],
  ]
  let value = seconds
  for (const [one, many, factor] of steps) {
    if (value < factor) {
      const n = Math.floor(value)
      return `about ${n.toLocaleString()} ${n === 1 ? one : many}`
    }
    value /= factor
  }
  return "longer than the age of the universe"
}
