import type { FunQuizSet, FunStats } from "@/types"
import { createCollectionStore, createValueStore } from "./core"

export const DEFAULT_FUN_STATS: FunStats = {
  xp: 0,
  games: 0,
  answered: 0,
  correct: 0,
  bestCombo: 0,
  dayStreak: 0,
  categories: {},
}

/** Learn with Fun: XP, streaks and per-category accuracy. */
export const funStatsStore = createValueStore<FunStats>("learn-fun-stats", DEFAULT_FUN_STATS)
/** Quizzes the user chose to save for replay. */
export const funQuizSetsStore = createCollectionStore<FunQuizSet>("learn-fun-quizzes")
