"use client"

import { Flame, Target, Trophy } from "lucide-react"
import { AiLanguageToggle } from "@/components/common/ai-language-toggle"
import { Skeleton } from "@/components/ui/skeleton"
import { useLearn } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { currentStreak, levelInfo, TRACKS, xpToday, type LearnTrack } from "@/lib/learn/progress"

/**
 * Level / XP / streak / daily-goal summary shown at the top of every Learn
 * track. Reads the shared Learn progress store, so it updates live as XP is awarded.
 */
export function TrackHeader({ track }: { track: LearnTrack }) {
  const hydrated = useHydrated()
  const state = useLearn()
  if (!hydrated) return <Skeleton className="h-24 rounded-2xl" />

  const info = levelInfo(state.xp[track])
  const streak = currentStreak(state)
  const today = xpToday(state)
  const goalPct = Math.min(1, today / state.dailyGoalXp)

  return (
    <section aria-label={`${TRACKS[track].name} progress`} className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="flex items-center gap-2 font-semibold">
            <Trophy className="size-4.5 text-warning" aria-hidden /> Level {info.level}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {info.xpIntoLevel}/{info.xpForNext} XP to level {info.level + 1}
          </p>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Level progress"
          aria-valuemin={0}
          aria-valuemax={info.xpForNext}
          aria-valuenow={info.xpIntoLevel}
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${info.progress * 100}%` }} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{state.xp[track].toLocaleString()} XP total in {TRACKS[track].name}</p>
          <AiLanguageToggle />
        </div>
      </div>
      <div className="flex gap-2 sm:gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-surface-muted px-3 py-2 sm:flex-none">
          <Flame className={streak ? "size-5 text-orange-500" : "size-5 text-muted-foreground"} aria-hidden />
          <div>
            <p className="text-sm font-semibold tabular-nums">{streak} day{streak === 1 ? "" : "s"}</p>
            <p className="text-[11px] text-muted-foreground">streak</p>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-surface-muted px-3 py-2 sm:flex-none">
          <Target className={goalPct >= 1 ? "size-5 text-success" : "size-5 text-muted-foreground"} aria-hidden />
          <div>
            <p className="text-sm font-semibold tabular-nums">
              {today}/{state.dailyGoalXp}
            </p>
            <p className="text-[11px] text-muted-foreground">XP today</p>
          </div>
        </div>
      </div>
    </section>
  )
}
