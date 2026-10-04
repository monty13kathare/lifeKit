/**
 * Shared progress for the Learn Skills section: XP per track, levels, daily
 * streak, daily goal, completed lessons, spaced-repetition cards and a short
 * activity history. Persisted locally via `learnStore`.
 */
import { differenceInCalendarDays, parseISO } from "date-fns"
import { todayString } from "@/lib/dates"
import { createValueStore } from "@/lib/storage/core"

export type LearnTrack = "english" | "logic"

export const TRACKS: Record<LearnTrack, { name: string; href: string }> = {
  english: { name: "English", href: "/learn/english" },
  logic: { name: "Logic & Reasoning", href: "/learn/logic" },
}

export interface LearnActivity {
  date: string
  at: string
  track: LearnTrack
  xp: number
  /** Short human label, e.g. "Prompt Lab: 82/100" */
  label: string
}

/** Leitner-box spaced repetition state for a flashcard. */
export interface CardState {
  box: number
  /** yyyy-MM-dd when the card is next due. */
  due: string
  /** yyyy-MM-dd the card was first studied (for the daily new-card limit). */
  introduced?: string
}

export interface LearnState {
  xp: Record<LearnTrack, number>
  completedLessons: string[]
  streak: { current: number; best: number; lastDate?: string }
  dailyGoalXp: number
  /** cardId -> state (English vocabulary etc.) */
  cards: Record<string, CardState>
  /** Most recent first, capped. */
  history: LearnActivity[]
  /** Best scores per activity key (e.g. "logic:mental-math"). */
  bests: Record<string, number>
}

export const DEFAULT_LEARN_STATE: LearnState = {
  xp: { english: 0, logic: 0 },
  completedLessons: [],
  streak: { current: 0, best: 0 },
  dailyGoalXp: 50,
  cards: {},
  history: [],
  bests: {},
}

export const learnStore = createValueStore<LearnState>("learn", DEFAULT_LEARN_STATE)

const HISTORY_CAP = 300

export function learnState(): LearnState {
  const s = learnStore.get()
  return { ...DEFAULT_LEARN_STATE, ...s, xp: { ...DEFAULT_LEARN_STATE.xp, ...s.xp }, streak: { ...DEFAULT_LEARN_STATE.streak, ...s.streak } }
}

/** XP needed to reach `level` (level 1 starts at 0). Grows gently: 100, 250, 450, 700… */
export function xpForLevel(level: number): number {
  return level <= 1 ? 0 : 50 * (level - 1) * (level + 2) / 2
}

export function levelInfo(xp: number) {
  let level = 1
  while (xp >= xpForLevel(level + 1)) level++
  const floor = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, xpIntoLevel: xp - floor, xpForNext: next - floor, progress: (xp - floor) / (next - floor) }
}

/** Streak value as of today (a streak breaks after a full missed day). */
export function currentStreak(s: LearnState, today = todayString()): number {
  if (!s.streak.lastDate) return 0
  const gap = differenceInCalendarDays(parseISO(today), parseISO(s.streak.lastDate))
  return gap <= 1 ? s.streak.current : 0
}

export function xpToday(s: LearnState, today = todayString()): number {
  return s.history.filter((h) => h.date === today).reduce((sum, h) => sum + h.xp, 0)
}

/**
 * Award XP for a learning activity. Updates the track XP, daily streak and
 * history. Returns whether the user levelled up in that track.
 */
export function awardXp(track: LearnTrack, xp: number, label: string): { levelUp: boolean; level: number } {
  const amount = Math.max(0, Math.round(xp))
  const prev = learnState()
  const today = todayString()
  const before = levelInfo(prev.xp[track]).level
  let { current, best, lastDate } = prev.streak
  if (lastDate !== today) {
    const gap = lastDate ? differenceInCalendarDays(parseISO(today), parseISO(lastDate)) : Infinity
    current = gap === 1 ? current + 1 : 1
    lastDate = today
    best = Math.max(best, current)
  }
  const nextXp = prev.xp[track] + amount
  learnStore.set({
    ...prev,
    xp: { ...prev.xp, [track]: nextXp },
    streak: { current, best, lastDate },
    history: [{ date: today, at: new Date().toISOString(), track, xp: amount, label }, ...prev.history].slice(0, HISTORY_CAP),
  })
  const after = levelInfo(nextXp).level
  return { levelUp: after > before, level: after }
}

/** Mark a lesson complete (idempotent). Awards XP only the first time. */
export function completeLesson(track: LearnTrack, lessonId: string, title: string, xp = 20, label = `Lesson: ${title}`): boolean {
  const prev = learnState()
  if (prev.completedLessons.includes(lessonId)) return false
  learnStore.set({ ...prev, completedLessons: [...prev.completedLessons, lessonId] })
  awardXp(track, xp, label)
  return true
}

/** Record a best score; returns true if it's a new personal best. */
export function recordBest(key: string, score: number): boolean {
  const prev = learnState()
  if ((prev.bests[key] ?? -Infinity) >= score) return false
  learnStore.set({ ...prev, bests: { ...prev.bests, [key]: score } })
  return true
}

export function setDailyGoal(xp: number) {
  const prev = learnState()
  learnStore.set({ ...prev, dailyGoalXp: Math.min(500, Math.max(10, Math.round(xp))) })
}

/* ------------------------------------------------ spaced repetition */

/** Days until review for each Leitner box (box 0 = new/forgotten). */
export const BOX_INTERVALS = [0, 1, 3, 7, 14, 30]

export function isCardDue(state: CardState | undefined, today = todayString()): boolean {
  return !state || state.due <= today
}

/** Grade a card: correct → next box, wrong → back to box 0 (due today). */
export function reviewCard(cardId: string, correct: boolean) {
  const prev = learnState()
  const existing = prev.cards[cardId]
  const old = existing ?? { box: 0, due: todayString() }
  const box = correct ? Math.min(BOX_INTERVALS.length - 1, old.box + 1) : 0
  const d = new Date()
  d.setDate(d.getDate() + BOX_INTERVALS[box])
  const due = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  learnStore.set({ ...prev, cards: { ...prev.cards, [cardId]: { box, due, introduced: existing?.introduced ?? todayString() } } })
}

export function resetLearnProgress() {
  learnStore.reset()
}

/** How many cards were studied for the first time on `date` (defaults to today). */
export function cardsIntroducedOn(cards: Record<string, CardState>, date = todayString()): number {
  return Object.values(cards).filter((c) => c.introduced === date).length
}
