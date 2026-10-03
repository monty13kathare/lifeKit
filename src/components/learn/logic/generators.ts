/**
 * Pure helpers for the Logic & Reasoning track: answer checking, the daily
 * puzzle picker and the procedural generators for Mental maths and Patterns.
 * No eval — every answer is computed in TypeScript.
 */
import { PUZZLES, type LogicPuzzle } from "@/data/learn/logic"

/* ------------------------------------------------------------------ answer checking */

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
}
const FILLER = new Set([
  "the", "a", "an", "is", "are", "was", "it", "its", "answer", "i", "think", "my", "his", "her", "their",
  "place", "in", "degrees", "degree", "cents", "cent", "dollars", "dollar", "day", "minutes", "years", "old",
])

function isNumberWord(t: string) {
  return t in SMALL || t in TENS || t === "hundred" || t === "thousand"
}

/** Replace runs of number words ("twenty one", "one hundred and five") with digits. */
function numberWordsToDigits(tokens: string[]): string[] {
  const out: string[] = []
  let total = 0
  let current = 0
  let active = false
  const flush = () => {
    if (active) out.push(String(total + current))
    total = 0
    current = 0
    active = false
  }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t in SMALL) {
      current += SMALL[t]
      active = true
    } else if (t in TENS) {
      current += TENS[t]
      active = true
    } else if (t === "hundred" && active) {
      current = (current || 1) * 100
    } else if (t === "thousand" && active) {
      total += (current || 1) * 1000
      current = 0
    } else if (t === "and" && active && i + 1 < tokens.length && isNumberWord(tokens[i + 1])) {
      continue
    } else {
      flush()
      out.push(t in ORDINALS ? String(ORDINALS[t]) : t)
    }
  }
  flush()
  return out
}

/** Lower-case, strip punctuation, convert number words → digits and drop filler words. */
export function normalizeAnswer(raw: string): string {
  const s = raw
    .toLowerCase()
    // Devanagari digits (०–९) → ASCII so Hindi numeric answers compare equal.
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[’'`]/g, "")
    .replace(/(\d),(\d{3})/g, "$1$2")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    // Keep letters (incl. vowel signs) from any script, e.g. Hindi answers.
    .replace(/[^\p{L}\p{M}\p{N}.\s]/gu, " ")
    .replace(/(\d+)(st|nd|rd|th)\b/g, "$1")
  const tokens = s.split(/\s+/).filter(Boolean)
  const words = numberWordsToDigits(tokens)
  const kept = words.filter((t) => !FILLER.has(t))
  // A bare "A" or "I" (e.g. a letter-sequence answer) must survive filler removal.
  return (kept.length ? kept : words).join(" ")
}

const NUMERIC = /^-?\d+(\.\d+)?$/

/**
 * Lenient local answer check: exact match after normalisation, a single number
 * equal to a numeric answer ("it's 42 sheep"), or a short reply that starts or
 * ends with a one-word answer ("Gus finished last").
 */
export function checkAnswer(userAnswer: string, answer: string, accepted: string[] = []): boolean {
  const user = normalizeAnswer(userAnswer)
  if (!user) return false
  const targets = [answer, ...accepted].map(normalizeAnswer).filter(Boolean)
  if (targets.includes(user)) return true

  const userNumbers = Array.from(new Set(user.match(/-?\d+(\.\d+)?/g) ?? [])).map(Number)
  const numericTargets = targets.filter((t) => NUMERIC.test(t)).map(Number)
  if (userNumbers.length === 1 && numericTargets.some((n) => Math.abs(n - userNumbers[0]) < 1e-9)) return true

  const words = user.split(" ")
  if (words.length <= 4 && !words.includes("or") && !words.includes("not")) {
    const singles = targets.filter((t) => !t.includes(" ") && !NUMERIC.test(t))
    if (singles.includes(words[0]) || singles.includes(words[words.length - 1])) return true
  }
  return false
}

/* ------------------------------------------------------------------ randomness */

export type Rng = () => number

/** Small deterministic PRNG (mulberry32) for date-seeded picks. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const int = (rng: Rng, min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min
const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ------------------------------------------------------------------ daily puzzle */

function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/**
 * The puzzle of the day: walks a fixed shuffled order of the bank so
 * consecutive days never repeat until the whole bank has been used.
 */
export function dailyPuzzle(date: string): LogicPuzzle {
  const n = dayNumber(date)
  const cycle = Math.floor(n / PUZZLES.length)
  const order = shuffle(PUZZLES, seededRng(0x10c1c + cycle))
  return order[((n % PUZZLES.length) + PUZZLES.length) % PUZZLES.length]
}

/** Consecutive days (ending today or yesterday) with a solved daily puzzle. */
export function dailyStreak(completed: string[], today: string): number {
  const days = new Set(completed.filter((id) => id.startsWith("logic:daily:")).map((id) => dayNumber(id.slice("logic:daily:".length))))
  let n = dayNumber(today)
  if (!days.has(n)) n -= 1
  let streak = 0
  while (days.has(n)) {
    streak++
    n--
  }
  return streak
}

/* ------------------------------------------------------------------ mental maths */

export type MathMode = "addsub" | "multiply" | "percent" | "mixed"
export type MathLevel = 1 | 2 | 3

export const MATH_MODES: { value: MathMode; label: string; description: string }[] = [
  { value: "addsub", label: "Add & subtract", description: "Sums and differences" },
  { value: "multiply", label: "Times tables", description: "Multiplication facts" },
  { value: "percent", label: "Percentages", description: "x% of a number" },
  { value: "mixed", label: "Mixed", description: "All of the above, plus division" },
]

export const MATH_LEVELS: { value: MathLevel; label: string }[] = [
  { value: 1, label: "Easy" },
  { value: 2, label: "Medium" },
  { value: 3, label: "Hard" },
]

export interface MathQuestion {
  text: string
  answer: number
}

function addSub(rng: Rng, level: MathLevel): MathQuestion {
  const [min, max] = level === 1 ? [1, 20] : level === 2 ? [10, 99] : [100, 999]
  const a = int(rng, min, max)
  const b = int(rng, min, max)
  if (rng() < 0.5) return { text: `${a} + ${b}`, answer: a + b }
  const [hi, lo] = a >= b ? [a, b] : [b, a]
  return { text: `${hi} − ${lo}`, answer: hi - lo }
}

function multiply(rng: Rng, level: MathLevel): MathQuestion {
  const a = level === 1 ? int(rng, 2, 5) : level === 2 ? int(rng, 2, 12) : int(rng, 6, 19)
  const b = level === 1 ? int(rng, 1, 10) : level === 2 ? int(rng, 2, 12) : int(rng, 3, 12)
  return rng() < 0.5 ? { text: `${a} × ${b}`, answer: a * b } : { text: `${b} × ${a}`, answer: a * b }
}

function divide(rng: Rng, level: MathLevel): MathQuestion {
  const m = multiply(rng, level)
  const [a, b] = m.text.split(" × ").map(Number)
  return { text: `${m.answer} ÷ ${a}`, answer: b }
}

function percent(rng: Rng, level: MathLevel): MathQuestion {
  const pcts = level === 1 ? [10, 50, 25, 100] : level === 2 ? [5, 10, 15, 20, 25, 50, 75] : [1, 2, 4, 12, 15, 30, 35, 40, 45, 60, 65, 80, 90, 120]
  for (let i = 0; i < 50; i++) {
    const p = pick(rng, pcts)
    const base = level === 1 ? int(rng, 1, 20) * 10 : level === 2 ? int(rng, 1, 40) * 10 : int(rng, 2, 60) * 25
    const ans = (p * base) / 100
    if (Number.isInteger(ans)) return { text: `${p}% of ${base}`, answer: ans }
  }
  return { text: "10% of 200", answer: 20 }
}

export function mathQuestion(mode: MathMode, level: MathLevel, rng: Rng = Math.random): MathQuestion {
  switch (mode) {
    case "addsub":
      return addSub(rng, level)
    case "multiply":
      return multiply(rng, level)
    case "percent":
      return percent(rng, level)
    default:
      return pick(rng, [addSub, addSub, multiply, divide, percent])(rng, level)
  }
}

/* ------------------------------------------------------------------ patterns */

export type PatternLevel = "easy" | "medium" | "hard"

export interface PatternQuestion {
  terms: string[]
  answer: string
  choices: string[]
  rule: string
  kind: string
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

function numericDistractors(rng: Rng, answer: number, near: number[]): string[] {
  const set = new Set<number>()
  for (const n of near) if (n !== answer && Number.isFinite(n)) set.add(n)
  const spread = Math.max(2, Math.round(Math.abs(answer) * 0.15))
  let guard = 0
  while (set.size < 6 && guard++ < 100) {
    const d = answer + (rng() < 0.5 ? -1 : 1) * int(rng, 1, spread)
    if (d !== answer) set.add(d)
  }
  return shuffle([...set], rng).slice(0, 3).map(String)
}

function finish(rng: Rng, terms: (number | string)[], answer: number | string, rule: string, kind: string, distractors: string[]): PatternQuestion {
  const a = String(answer)
  const unique = Array.from(new Set(distractors.filter((d) => d !== a))).slice(0, 3)
  return { terms: terms.map(String), answer: a, choices: shuffle([a, ...unique], rng), rule, kind }
}

type Gen = (rng: Rng, level: PatternLevel) => PatternQuestion

const arithmetic: Gen = (rng, level) => {
  const start = level === "easy" ? int(rng, 1, 20) : int(rng, -10, 60)
  const step = level === "easy" ? int(rng, 2, 9) : (rng() < 0.3 ? -1 : 1) * int(rng, 3, level === "hard" ? 25 : 15)
  const len = 5
  const terms = Array.from({ length: len }, (_, i) => start + step * i)
  const ans = start + step * len
  const sign = step >= 0 ? `adds ${step}` : `subtracts ${-step}`
  return finish(rng, terms, ans, `Each term ${sign}: ${terms[len - 1]} ${step >= 0 ? "+" : "−"} ${Math.abs(step)} = ${ans}.`, "Arithmetic", numericDistractors(rng, ans, [ans + step, ans - 1, ans + 1, terms[len - 1] + step * 2]))
}

const geometric: Gen = (rng, level) => {
  const ratio = level === "easy" ? pick(rng, [2, 3]) : level === "medium" ? pick(rng, [2, 3, 4, 5]) : pick(rng, [3, 4, 5, 6])
  const start = int(rng, 1, level === "hard" ? 6 : 4)
  const terms = Array.from({ length: 4 }, (_, i) => start * ratio ** i)
  const ans = start * ratio ** 4
  const last = terms[3]
  return finish(rng, terms, ans, `Each term is multiplied by ${ratio}: ${last} × ${ratio} = ${ans}.`, "Geometric", numericDistractors(rng, ans, [last + (last - terms[2]), last * (ratio + 1), last * (ratio - 1) || ans + ratio]))
}

const powers: Gen = (rng, level) => {
  const cube = level === "hard" && rng() < 0.5
  const offset = level === "easy" ? 0 : int(rng, 0, level === "hard" ? 4 : 2)
  const plus = level === "hard" ? int(rng, -3, 3) : 0
  const f = (n: number) => (cube ? n ** 3 : n ** 2) + plus
  const ns = Array.from({ length: 5 }, (_, i) => i + 1 + offset)
  const terms = ns.map(f)
  const next = ns[4] + 1
  const ans = f(next)
  const base = cube ? `${next}³` : `${next}²`
  const extra = plus ? ` ${plus > 0 ? "+" : "−"} ${Math.abs(plus)}` : ""
  return finish(rng, terms, ans, `These are ${cube ? "cube" : "square"} numbers${plus ? ` shifted by ${plus > 0 ? "+" : ""}${plus}` : ""}: ${base}${extra} = ${ans}.`, cube ? "Cubes" : "Squares", numericDistractors(rng, ans, [f(next + 1), ans - 1, terms[4] + (terms[4] - terms[3])]))
}

const fibonacciLike: Gen = (rng, level) => {
  const a = int(rng, 1, level === "easy" ? 3 : 9)
  const b = int(rng, a, a + (level === "hard" ? 9 : 4))
  const terms = [a, b]
  while (terms.length < 6) terms.push(terms[terms.length - 1] + terms[terms.length - 2])
  const ans = terms[5] + terms[4]
  return finish(rng, terms, ans, `Each term is the sum of the two before it: ${terms[4]} + ${terms[5]} = ${ans}.`, "Fibonacci-like", numericDistractors(rng, ans, [terms[5] * 2, terms[5] + (terms[5] - terms[4]), ans + 1]))
}

const growingSteps: Gen = (rng, level) => {
  const start = int(rng, 1, 15)
  const step = int(rng, 1, level === "hard" ? 6 : 4)
  const inc = level === "easy" ? 1 : int(rng, 1, 3)
  const terms = [start]
  let d = step
  while (terms.length < 5) {
    terms.push(terms[terms.length - 1] + d)
    d += inc
  }
  const ans = terms[4] + d
  return finish(rng, terms, ans, `The gaps grow by ${inc} each time (${step}, ${step + inc}, ${step + 2 * inc}…). The next gap is ${d}: ${terms[4]} + ${d} = ${ans}.`, "Growing gaps", numericDistractors(rng, ans, [terms[4] + d - inc, ans + inc, ans - 1]))
}

const alternating: Gen = (rng, level) => {
  const a0 = int(rng, 1, 20)
  const b0 = int(rng, 20, 60)
  const sa = int(rng, 1, level === "easy" ? 4 : 9)
  const sb = (level === "easy" ? 1 : -1) * int(rng, 1, level === "hard" ? 9 : 5)
  const terms: number[] = []
  for (let i = 0; i < 7; i++) terms.push(i % 2 === 0 ? a0 + sa * (i / 2) : b0 + sb * ((i - 1) / 2))
  // Term 8 is in the "b" series (odd index 7).
  const ans = b0 + sb * 3
  const fmt = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)
  return finish(rng, terms, ans, `Two sequences are interleaved: odd positions go ${fmt(sa)} and even positions go ${fmt(sb)}. The next term is in the second series: ${terms[5]} ${sb >= 0 ? "+" : "−"} ${Math.abs(sb)} = ${ans}.`, "Alternating", numericDistractors(rng, ans, [terms[6] + sa, terms[6] + sb, ans + 1]))
}

const letters: Gen = (rng, level) => {
  const step = level === "easy" ? int(rng, 1, 2) : level === "medium" ? int(rng, 2, 4) : int(rng, 3, 5)
  const backwards = level === "hard" && rng() < 0.4
  const len = 5
  const span = step * len
  const startMax = 25 - span
  const start = backwards ? int(rng, span, 25) : int(rng, 0, Math.max(0, startMax))
  const dir = backwards ? -1 : 1
  const idx = (i: number) => start + dir * step * i
  const terms = Array.from({ length: len }, (_, i) => LETTERS[idx(i)])
  const ans = LETTERS[idx(len)]
  const near = Array.from(new Set([idx(len) + 1, idx(len) - 1, idx(len) + dir * step, idx(len - 1)]))
    .filter((i) => i >= 0 && i < 26 && i !== idx(len))
    .map((i) => LETTERS[i])
    .slice(0, 3)
  let guard = 0
  while (near.length < 3 && guard++ < 50) {
    const l = LETTERS[int(rng, 0, 25)]
    if (l !== ans && !near.includes(l)) near.push(l)
  }
  return finish(rng, terms, ans, `Each letter moves ${step} place${step === 1 ? "" : "s"} ${backwards ? "back" : "forward"} in the alphabet: ${terms[len - 1]} → ${ans}.`, "Letters", near)
}

const GENERATORS: Record<PatternLevel, Gen[]> = {
  easy: [arithmetic, arithmetic, geometric, powers, letters, fibonacciLike],
  medium: [arithmetic, geometric, powers, fibonacciLike, growingSteps, alternating, letters],
  hard: [arithmetic, geometric, powers, fibonacciLike, growingSteps, alternating, alternating, letters],
}

export function patternQuestion(level: PatternLevel, rng: Rng = Math.random): PatternQuestion {
  return pick(rng, GENERATORS[level])(rng, level)
}
