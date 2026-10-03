"use client"

import { useMemo } from "react"
import { Flame, History, Target, Timer, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { ProgressRing } from "@/components/common/progress-ring"
import { Button } from "@/components/ui/button"
import { useFocus, useTasks } from "@/hooks/use-lifekit-data"
import { todayString } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { FocusSession } from "@/types"
import { breakdownByTask, focusStreak, formatMinutes, lastNDays, sessionsOn, sumMinutes, timeOf } from "./focus-utils"

export function FocusStats() {
  const { sessions, settings, removeSession, upsertSession } = useFocus()
  const { tasks, update: updateTask } = useTasks()
  const today = todayString()

  const todays = useMemo(() => sessionsOn(sessions, today), [sessions, today])
  const todayMinutes = sumMinutes(todays)
  const completedToday = todays.filter((s) => s.completed).length
  const streak = useMemo(() => focusStreak(sessions), [sessions])
  const week = useMemo(() => lastNDays(sessions, 7), [sessions])
  const breakdown = useMemo(() => breakdownByTask(todays, tasks), [todays, tasks])
  const goal = Math.max(1, settings.dailyGoalMinutes)
  const hasAny = sessions.some((s) => s.phase === "focus")

  const deleteSession = (s: FocusSession) => {
    removeSession(s.id)
    const adjustTask = (delta: number) => {
      if (!s.taskId || !tasks.some((t) => t.id === s.taskId)) return
      updateTask(s.taskId, (t) => ({ ...t, focusMinutes: Math.max(0, (t.focusMinutes ?? 0) + delta) }))
    }
    adjustTask(-s.minutes)
    toast("Session deleted", {
      description: `${s.minutes} min${s.label ? ` · ${s.label}` : ""}`,
      action: {
        label: "Undo",
        onClick: () => {
          upsertSession(s)
          adjustTask(s.minutes)
        },
      },
    })
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="focus-today-heading" className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <h2 id="focus-today-heading" className="sr-only">
          Today
        </h2>
        <div className="flex items-center gap-4">
          <ProgressRing value={todayMinutes / goal} size={84} stroke={8} label="Daily focus goal">
            <Target className="size-6 text-primary" aria-hidden />
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Today</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMinutes(todayMinutes)}
              <span className="text-base font-normal text-muted-foreground"> / {formatMinutes(goal)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {todayMinutes >= goal ? "Daily goal reached. Nice work!" : `${formatMinutes(goal - todayMinutes)} to go`}
            </p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-muted p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Timer className="size-3.5" aria-hidden />
              Sessions today
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{completedToday}</dd>
          </div>
          <div className="rounded-xl bg-surface-muted p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Flame className="size-3.5" aria-hidden />
              Streak
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {streak} {streak === 1 ? "day" : "days"}
            </dd>
          </div>
        </dl>
      </section>

      {hasAny ? (
        <>
          <WeekChart week={week} />

          {breakdown.length ? (
            <section aria-labelledby="focus-breakdown-heading" className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
              <h2 id="focus-breakdown-heading" className="mb-3 text-base font-semibold">
                Today by task
              </h2>
              <ul className="space-y-2.5">
                {breakdown.map((b) => (
                  <li key={b.key}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{b.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{formatMinutes(b.minutes)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(4, (b.minutes / Math.max(1, todayMinutes)) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="focus-history-heading" className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
            <h2 id="focus-history-heading" className="mb-2 text-base font-semibold">
              Today&apos;s sessions
            </h2>
            {todays.length ? (
              <ul className="divide-y">
                {todays.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.label || "Focus session"}</p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {timeOf(s.startedAt)} – {timeOf(s.endedAt)}
                        </span>
                        <span aria-hidden>·</span>
                        <span className="tabular-nums">{s.minutes} min</span>
                        {!s.completed ? (
                          <span className="rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning-foreground dark:text-warning">
                            Stopped early
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Delete session ${s.label ?? ""} at ${timeOf(s.startedAt)}`}
                      onClick={() => deleteSession(s)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No sessions yet today. Start one to build your streak.</p>
            )}
          </section>
        </>
      ) : (
        <EmptyState
          icon={History}
          title="No focus sessions yet"
          description="Finish a focus session and your minutes, streak and history will show up here."
        />
      )}
    </div>
  )
}

function WeekChart({ week }: { week: ReturnType<typeof lastNDays> }) {
  const max = Math.max(30, ...week.map((d) => d.minutes))
  const total = week.reduce((n, d) => n + d.minutes, 0)
  return (
    <section aria-labelledby="focus-week-heading" className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="focus-week-heading" className="text-base font-semibold">
          Last 7 days
        </h2>
        <span className="text-xs text-muted-foreground">{formatMinutes(total)} total</span>
      </div>
      <div className="flex h-36 items-end gap-2" aria-hidden>
        {week.map((d) => (
          <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[0.65rem] tabular-nums text-muted-foreground">{d.minutes || ""}</span>
            <div
              className={cn("w-full max-w-9 rounded-t-md", d.minutes ? "" : "bg-muted")}
              style={{
                height: d.minutes ? `${Math.max(4, (d.minutes / max) * 100)}%` : "3px",
                background: d.minutes ? (d.isToday ? "var(--primary)" : "color-mix(in oklch, var(--chart-1) 55%, transparent)") : undefined,
              }}
            />
            <span className={cn("text-xs", d.isToday ? "font-semibold text-foreground" : "text-muted-foreground")}>{d.label}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Focus minutes for the last 7 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Minutes</th>
          </tr>
        </thead>
        <tbody>
          {week.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.longLabel}{d.isToday ? " (today)" : ""}</th>
              <td>{d.minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
