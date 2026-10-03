"use client"

import { CalendarCheck, Flame, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { useLearn } from "@/hooks/use-lifekit-data"
import { todayString } from "@/lib/dates"
import { DAILY_BONUS_XP, puzzleXp } from "@/data/learn/logic"
import { dailyPuzzle, dailyStreak } from "./generators"
import { PuzzleSolver } from "./puzzle-solver"
import { completeLogic } from "./shared"

export function DailyPuzzle() {
  const { completedLessons } = useLearn()
  const today = todayString()
  const puzzle = dailyPuzzle(today)
  const dailyId = `logic:daily:${today}`
  const solvedToday = completedLessons.includes(dailyId)
  const puzzleSolvedBefore = completedLessons.includes(`puzzle:${puzzle.id}`)
  const streak = dailyStreak(completedLessons, today)

  function onSolve(hintUsed: boolean) {
    let xp = 0
    if (completeLogic(`puzzle:${puzzle.id}`, puzzle.title, puzzleXp(puzzle.difficulty, hintUsed))) xp += puzzleXp(puzzle.difficulty, hintUsed)
    if (completeLogic(dailyId, "Daily puzzle", DAILY_BONUS_XP)) xp += DAILY_BONUS_XP
    toast.success(`Daily puzzle solved! +${xp} XP`, { description: "Come back tomorrow for a new one." })
    return xp
  }

  const dateLabel = new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
          <p className="font-medium">
            Solve today&apos;s puzzle for a <span className="text-primary">+{DAILY_BONUS_XP} XP</span> bonus.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2" aria-label={`Daily puzzle streak: ${streak} days`}>
          <Flame className={streak ? "size-5 text-orange-500" : "size-5 text-muted-foreground"} aria-hidden />
          <span className="text-sm font-semibold tabular-nums">{streak}</span>
          <span className="text-xs text-muted-foreground">day{streak === 1 ? "" : "s"} in a row</span>
        </div>
      </div>

      {solvedToday ? (
        <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6" aria-live="polite">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
              <CalendarCheck className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Solved — come back tomorrow!</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A new daily puzzle unlocks at midnight. {streak > 1 ? `Keep your ${streak}-day streak going!` : "Start a streak by solving again tomorrow."}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-surface-muted p-4 text-sm">
            <p className="font-medium">{puzzle.title}</p>
            <p className="mt-1 text-muted-foreground">{puzzle.puzzle}</p>
            <p className="mt-3">
              Answer: <span className="font-medium">{puzzle.answer}</span>
            </p>
            <p className="mt-1 text-muted-foreground">{puzzle.explanation}</p>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-primary" aria-hidden /> Want more? Try the Puzzles, Patterns or Mental maths tabs.
          </p>
        </section>
      ) : (
        <PuzzleSolver
          key={puzzle.id + today}
          puzzle={puzzle}
          solvedBefore={false}
          onSolve={onSolve}
          badge={<Badge>Daily</Badge>}
        />
      )}
      {!solvedToday && puzzleSolvedBefore ? (
        <p className="text-xs text-muted-foreground">You&apos;ve solved this one before in the bank — you&apos;ll still get the daily bonus.</p>
      ) : null}
    </div>
  )
}
