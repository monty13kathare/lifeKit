import { useSyncExternalStore } from "react"
import { toast } from "sonner"
import { awardXp, completeLesson, learnState, levelInfo } from "@/lib/learn/progress"
import { CONFUSIONS } from "@/data/learn/english"

/* ------------------------------------------------------------------ XP */

/** Award English XP and show a toast (with a level-up celebration). */
export function grantXp(xp: number, label: string, opts: { quiet?: boolean } = {}) {
  const amount = Math.max(0, Math.round(xp))
  if (!amount) return
  const { levelUp, level } = awardXp("english", amount, label)
  if (levelUp) toast.success("Level up! 🎉", { description: `You reached English level ${level}.` })
  else if (!opts.quiet) toast.success(`+${amount} XP`, { description: label })
}

/** Complete a lesson (first time only) with toasts. Returns true when newly completed. */
export function finishLesson(lessonId: string, title: string, xp: number): boolean {
  const before = levelInfo(learnState().xp.english).level
  const done = completeLesson("english", lessonId, title, xp)
  if (!done) return false
  const after = levelInfo(learnState().xp.english).level
  if (after > before) toast.success("Level up! 🎉", { description: `You reached English level ${after}.` })
  else toast.success(`Lesson complete · +${xp} XP`, { description: title })
  return true
}

export function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Something went wrong. Please try again."
}

export const isAbort = (err: unknown) => (err as Error)?.name === "AbortError"

/* ------------------------------------------------------------- text bits */

export function countWords(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/** Lower-case, strip punctuation; for loose word comparison. */
export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9']/g, "")
}

/** Longest-common-subsequence table for two token arrays. */
function lcsTable<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): Uint16Array[] {
  const t: Uint16Array[] = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      t[i][j] = eq(a[i], b[j]) ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1])
    }
  }
  return t
}

export type DiffPart = { type: "same" | "removed" | "added"; text: string }

const DIFF_LIMIT = 1500

/**
 * Word-level diff between `before` and `after` using LCS. Adjacent parts of
 * the same type are merged. Returns null for very long texts.
 */
export function diffWords(before: string, after: string): DiffPart[] | null {
  const a = before.trim().split(/\s+/).filter(Boolean)
  const b = after.trim().split(/\s+/).filter(Boolean)
  if (a.length > DIFF_LIMIT || b.length > DIFF_LIMIT) return null
  const t = lcsTable(a, b, (x, y) => x === y)
  const parts: DiffPart[] = []
  const push = (type: DiffPart["type"], text: string) => {
    const last = parts[parts.length - 1]
    if (last && last.type === type) last.text += ` ${text}`
    else parts.push({ type, text })
  }
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i])
      i++
      j++
    } else if (t[i + 1][j] >= t[i][j + 1]) {
      push("removed", a[i++])
    } else {
      push("added", b[j++])
    }
  }
  while (i < a.length) push("removed", a[i++])
  while (j < b.length) push("added", b[j++])
  return parts
}

/**
 * Compare a spoken transcript with the target sentence. Returns each target
 * word with whether it was heard, and the overall word accuracy (0–100).
 */
export function compareSpoken(target: string, spoken: string): { words: { text: string; hit: boolean }[]; accuracy: number } {
  const targetWords = target.split(/\s+/).filter(Boolean)
  const a = targetWords.map(normalizeWord)
  const b = spoken.split(/\s+/).map(normalizeWord).filter(Boolean)
  const t = lcsTable(a, b, (x, y) => x === y)
  const hits = new Array<boolean>(a.length).fill(false)
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      hits[i] = true
      i++
      j++
    } else if (t[i + 1][j] >= t[i][j + 1]) i++
    else j++
  }
  const scorable = a.filter(Boolean).length || 1
  const hitCount = hits.filter((h, k) => h && a[k]).length
  return { words: targetWords.map((text, k) => ({ text, hit: hits[k] || !a[k] })), accuracy: Math.round((hitCount / scorable) * 100) }
}

/* ------------------------------------------------- offline writing check */

export interface OfflineIssue {
  type: string
  excerpt: string
  message: string
  suggestion?: string
}

/** Basic rule-based checks that run entirely in the browser. */
export function offlineCheck(text: string): OfflineIssue[] {
  const issues: OfflineIssue[] = []
  if (/ {2,}/.test(text)) issues.push({ type: "Spacing", excerpt: "double space", message: "There are double spaces between words.", suggestion: "Use a single space." })

  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  for (const s of sentences) {
    const first = s.match(/[A-Za-z]/)
    if (first && first[0] !== first[0].toUpperCase() && s.indexOf(first[0]) === 0) {
      issues.push({ type: "Capitalisation", excerpt: s.slice(0, 40), message: "A sentence should start with a capital letter." })
    }
    const words = countWords(s)
    if (words > 30) issues.push({ type: "Style", excerpt: `${s.slice(0, 50)}…`, message: `Long sentence (${words} words). Consider splitting it in two.` })
  }

  for (const m of text.matchAll(/\b(\w+)\s+\1\b/gi)) {
    if (m[1].toLowerCase() === "had" || m[1].toLowerCase() === "that") continue // "had had", "that that" can be correct
    issues.push({ type: "Repeated word", excerpt: m[0], message: `"${m[1]}" is repeated.`, suggestion: m[1] })
  }

  for (const m of text.matchAll(/(^|[\s"(])i(?=[\s',.!?]|$)/g)) {
    issues.push({ type: "Capitalisation", excerpt: `${m[0].trim()}`, message: "The pronoun \"I\" is always a capital letter.", suggestion: "I" })
    break
  }

  for (const c of CONFUSIONS) {
    for (const m of text.matchAll(c.pattern)) {
      issues.push({ type: "Word choice", excerpt: m[0], message: c.message, suggestion: c.suggestion })
    }
  }

  if (text.trim() && !/[.!?]["')]?\s*$/.test(text.trim())) {
    issues.push({ type: "Punctuation", excerpt: text.trim().slice(-30), message: "The last sentence has no full stop, question mark or exclamation mark." })
  }
  return issues
}

/* ---------------------------------------------------------------- speech */

export type Accent = "en-US" | "en-GB"

export const ACCENTS: { value: Accent; label: string }[] = [
  { value: "en-US", label: "US English" },
  { value: "en-GB", label: "UK English" },
]

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"
}

/** Speak text with the browser's speech synthesis (no network involved for most voices). */
export function speak(text: string, lang: Accent = "en-US", rate = 1) {
  if (!canSpeak()) return
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = rate
  const voices = synth.getVoices()
  const voice = voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.replace("_", "-").startsWith(lang))
  if (voice) u.voice = voice
  synth.speak(u)
}

const noopSubscribe = () => () => {}

/** Browser-only capability check that is `false` during SSR/hydration. */
export function useClientCheck(check: () => boolean): boolean {
  return useSyncExternalStore(noopSubscribe, check, () => false)
}
