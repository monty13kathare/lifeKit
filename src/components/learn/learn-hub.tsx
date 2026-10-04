"use client"

import Link from "next/link"
import { useMemo } from "react"
import { format, subDays } from "date-fns"
import { motion } from "framer-motion"
import { ChevronRight, Flame, GraduationCap, Minus, Plus, Sparkles, Target, Trophy } from "lucide-react"
import { ProgressRing } from "@/components/common/progress-ring"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toolsByCategory } from "@/data/tools"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useLearn } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { toDateString } from "@/lib/dates"
import { currentStreak, levelInfo, setDailyGoal, xpToday, type LearnTrack } from "@/lib/learn/progress"
import { cn } from "@/lib/utils"

const TRACK_OF: Record<string, LearnTrack> = {
  "learn-english": "english",
  "learn-logic": "logic",
}

const TRACK_BLURB: Record<LearnTrack, string[]> = {
  english: ["Vocabulary flashcards (spaced repetition)", "Grammar lessons & quizzes", "AI writing coach & speaking practice"],
  logic: ["Daily puzzle & puzzle bank", "60-second mental maths", "Patterns & thinking skills"],
}

export function LearnHub() {
  const hydrated = useHydrated()
  const state = useLearn()
  const ai = useAiStatus()

  const totalXp = state.xp.english + state.xp.logic
  const overall = levelInfo(totalXp)
  const streak = currentStreak(state)
  const today = xpToday(state)

  const week = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i))
    return days.map((d) => {
      const key = toDateString(d)
      return { key, label: format(d, "EEE"), xp: state.history.filter((h) => h.date === key).reduce((s, h) => s + h.xp, 0) }
    })
  }, [state.history])
  const maxWeek = Math.max(state.dailyGoalXp, ...week.map((d) => d.xp))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-start gap-4">
        <span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 sm:flex dark:text-amber-300">
          <GraduationCap className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Learn Skills</h1>
          <p className="mt-1 text-muted-foreground">
            Build English and logic skills a few minutes a day. Progress stays on this device.
          </p>
        </div>
      </header>

      {!hydrated ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <section aria-label="Your progress" className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="grid grid-cols-3 gap-3 md:grid-cols-1 md:grid-rows-3 lg:grid-cols-3 lg:grid-rows-1">
            <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border bg-card p-3 text-center sm:p-4">
              <Trophy className="size-5 text-warning" aria-hidden />
              <p className="text-xl font-semibold tabular-nums">Lv {overall.level}</p>
              <p className="text-[11px] text-muted-foreground">{totalXp.toLocaleString()} XP total</p>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border bg-card p-3 text-center sm:p-4">
              <Flame className={streak ? "size-5 text-orange-500" : "size-5 text-muted-foreground"} aria-hidden />
              <p className="text-xl font-semibold tabular-nums">{streak}</p>
              <p className="text-[11px] text-muted-foreground">day streak · best {state.streak.best}</p>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border bg-card p-3 text-center sm:p-4">
              <ProgressRing value={today / state.dailyGoalXp} size={44} stroke={5} label="Daily goal" color={today >= state.dailyGoalXp ? "var(--success)" : "var(--primary)"}>
                <Target className="size-4 text-muted-foreground" aria-hidden />
              </ProgressRing>
              <p className="text-sm font-semibold tabular-nums">
                {today}/{state.dailyGoalXp} XP
              </p>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Lower daily goal" onClick={() => setDailyGoal(state.dailyGoalXp - 10)}>
                  <Minus />
                </Button>
                <span className="text-[11px] text-muted-foreground">daily goal</span>
                <Button variant="ghost" size="icon-sm" aria-label="Raise daily goal" onClick={() => setDailyGoal(state.dailyGoalXp + 10)}>
                  <Plus />
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <p className="mb-3 text-sm font-medium">This week</p>
            <div className="flex h-28 items-end gap-2" role="img" aria-label={`XP per day this week: ${week.map((d) => `${d.label} ${d.xp}`).join(", ")}`}>
              {week.map((d) => (
                <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{d.xp || ""}</span>
                  <div className="relative w-full flex-1 overflow-hidden rounded-md bg-muted">
                    <div
                      className={cn("absolute inset-x-0 bottom-0 rounded-md transition-[height] duration-500", d.xp >= state.dailyGoalXp ? "bg-success" : "bg-primary")}
                      style={{ height: `${(d.xp / maxWeek) * 100}%` }}
                    />
                  </div>
                  <span className={cn("text-[11px] text-muted-foreground", d.key === toDateString(new Date()) && "font-semibold text-foreground")}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {ai && !ai.configured && (
        <p className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2.5 text-sm text-muted-foreground">
          <Sparkles className="size-4 shrink-0" aria-hidden />
          Lessons, quizzes and drills work offline. Add a Gemini key to unlock AI grading, the writing coach and generated puzzles.
        </p>
      )}

      <section aria-labelledby="tracks-title">
        <h2 id="tracks-title" className="mb-3 text-lg font-semibold">
          Skill tracks
        </h2>
        <motion.ul
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          {toolsByCategory("learn").map((tool) => {
            const track = TRACK_OF[tool.id]
            const info = levelInfo(state.xp[track] ?? 0)
            const Icon = tool.icon
            return (
              <motion.li key={tool.id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                <Link
                  href={tool.href}
                  className="group flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn("flex size-12 items-center justify-center rounded-2xl", tool.accent)}>
                      <Icon className="size-6" aria-hidden />
                    </span>
                    {hydrated && <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium">Level {info.level}</span>}
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{tool.name}</p>
                    <p className="text-sm text-muted-foreground">{tool.description}</p>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {TRACK_BLURB[track].map((b) => (
                      <li key={b} className="flex gap-2">
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${hydrated ? info.progress * 100 : 0}%` }} />
                    </div>
                    <p className="mt-2 flex items-center justify-between text-sm font-medium text-primary">
                      {hydrated && (state.xp[track] ?? 0) > 0 ? "Continue" : "Start learning"}
                      <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </p>
                  </div>
                </Link>
              </motion.li>
            )
          })}
        </motion.ul>
      </section>

      {hydrated && state.history.length > 0 && (
        <section aria-labelledby="activity-title">
          <h2 id="activity-title" className="mb-3 text-lg font-semibold">
            Recent activity
          </h2>
          <ul className="divide-y rounded-2xl border bg-card">
            {state.history.slice(0, 8).map((h, i) => (
              <li key={`${h.at}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{h.label}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(h.at), "EEE d MMM, h:mm a")}</span>
                </span>
                <span className="shrink-0 font-semibold text-success tabular-nums">+{h.xp} XP</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
