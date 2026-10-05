import { differenceInCalendarDays, parseISO } from "date-fns"
import { todayString } from "@/lib/dates"
import { DEFAULT_FUN_STATS, funStatsStore } from "@/lib/storage/learn"
import type { FunMode, FunQuestion, FunStats } from "@/types"

/**
 * Learn with Fun game rules: scoring, levels and stats. UI components only
 * call these helpers; persistence goes through `funStatsStore`.
 */

export const XP_PER_LEVEL = 200
export const LIVES = 3
export const MAX_SAVED_QUIZZES = 30

/** Seconds per question in Speed Round. Stories need reading time. */
export const timeLimit = (q: FunQuestion) => (q.story ? 45 : 20)

const LEVEL_TITLES = [
  { en: "Curious Cub", hi: "जिज्ञासु शावक" },
  { en: "Quick Thinker", hi: "तेज़ विचारक" },
  { en: "Puzzle Pro", hi: "पहेली प्रो" },
  { en: "Word Wizard", hi: "शब्द जादूगर" },
  { en: "Brain Champion", hi: "दिमागी चैंपियन" },
  { en: "Grand Master", hi: "ग्रैंड मास्टर" },
]

export function levelInfo(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1
  const title = LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 3))]
  return { level, title, into: xp % XP_PER_LEVEL, pct: Math.round(((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100) }
}

/** XP for one correct answer. Combos and speed earn bonuses; study mode is lighter. */
export function answerXp({ mode, combo = 0, secondsLeft, usedHint }: { mode: FunMode; combo?: number; secondsLeft?: number; usedHint?: boolean }) {
  if (mode === "study") return 2
  let xp = 10
  if (combo >= 3) xp += 5
  if (mode === "timed" && secondsLeft) xp += Math.ceil(secondsLeft / 4)
  if (mode === "survival") xp += 2
  if (usedHint) xp -= 3
  return Math.max(1, xp)
}

/** 0–3 stars for a finished game. */
export function starsFor(pct: number) {
  return pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0
}

export interface FunGameResult {
  category: string
  answered: number
  correct: number
  xp: number
  bestCombo: number
}

/** Add a finished game to the stats and update the daily streak. */
export function recordFunGame(result: FunGameResult) {
  funStatsStore.set((prev) => {
    const s: FunStats = { ...DEFAULT_FUN_STATS, ...prev }
    const today = todayString()
    let dayStreak = s.dayStreak
    if (!s.lastPlayed) dayStreak = 1
    else {
      const gap = differenceInCalendarDays(parseISO(today), parseISO(s.lastPlayed))
      dayStreak = gap === 0 ? Math.max(1, dayStreak) : gap === 1 ? dayStreak + 1 : 1
    }
    const cat = s.categories[result.category] ?? { games: 0, answered: 0, correct: 0 }
    return {
      ...s,
      xp: s.xp + result.xp,
      games: s.games + 1,
      answered: s.answered + result.answered,
      correct: s.correct + result.correct,
      bestCombo: Math.max(s.bestCombo, result.bestCombo),
      dayStreak,
      lastPlayed: today,
      categories: {
        ...s.categories,
        [result.category]: { games: cat.games + 1, answered: cat.answered + result.answered, correct: cat.correct + result.correct },
      },
    }
  })
}

/** Award XP outside a quiz game (e.g. a Learning Zone lesson); keeps the daily streak going. */
export function awardXp(xp: number) {
  funStatsStore.set((prev) => {
    const s: FunStats = { ...DEFAULT_FUN_STATS, ...prev }
    const today = todayString()
    const gap = s.lastPlayed ? differenceInCalendarDays(parseISO(today), parseISO(s.lastPlayed)) : null
    const dayStreak = gap === null ? 1 : gap === 0 ? Math.max(1, s.dayStreak) : gap === 1 ? s.dayStreak + 1 : 1
    return { ...s, xp: s.xp + Math.max(0, Math.round(xp)), dayStreak, lastPlayed: today }
  })
}

/** Streak shown today: it lapses if the last game was before yesterday. */
export function liveDayStreak(stats: FunStats) {
  if (!stats.lastPlayed) return 0
  const gap = differenceInCalendarDays(parseISO(todayString()), parseISO(stats.lastPlayed))
  return gap <= 1 ? stats.dayStreak : 0
}

/** Shuffle a question's options (and its Hindi translation in the same order). */
export function shuffleOptions(q: FunQuestion): FunQuestion {
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5)
  const hindiOk = q.hindi && q.hindi.options.length === 4
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    answerIndex: order.indexOf(q.answerIndex),
    hindi: q.hindi ? { ...q.hindi, options: hindiOk ? order.map((i) => q.hindi!.options[i]) : [] } : undefined,
  }
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
