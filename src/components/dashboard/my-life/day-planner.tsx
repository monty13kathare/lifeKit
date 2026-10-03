"use client"

import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { LoaderCircle, RefreshCw, Sparkles, Wand2 } from "lucide-react"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import type { AssistOutput } from "@/lib/ai/assist-schemas"
import { aiAssist } from "@/lib/ai/client"
import type { useToday } from "./use-today"

type Plan = AssistOutput<"plan-day">

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`
type Today = ReturnType<typeof useToday>

/** Build the minimal JSON the planner needs — titles and times only, no notes. */
function planInput(t: Today, now: Date): string {
  return JSON.stringify({
    now: format(now, "EEEE h:mm a"),
    tasks: [...t.overdue, ...t.dueToday.filter((x) => !x.completed), ...t.openTasks.filter((x) => !x.dueDate)]
      .filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i)
      .slice(0, 20)
      .map((x) => ({ title: x.title, priority: x.priority, due: x.dueDate ?? "no date", time: x.dueTime ?? null, overdue: !!x.dueDate && x.dueDate < t.today })),
    events: t.eventOccurrences.map((o) => ({
      title: o.event.title,
      time: o.event.allDay ? "all day" : `${format(o.start, "h:mm a")}–${format(o.end, "h:mm a")}`,
    })),
    routine: t.routineToday.map((r) => ({ title: r.title, time: r.time, minutes: r.durationMinutes, done: r.completedDates.includes(t.today) })),
    focus: { goalMinutes: t.focusGoal, doneMinutes: t.focusMinutesToday },
  })
}

/** AI "Plan my day" briefing. Only rendered when Gemini is configured. */
export function DayPlanner({ today }: { today: Today }) {
  const [plan, setPlan] = useState<{ data: Plan; at: Date } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  const nothingToPlan = today.openTasks.length === 0 && today.eventOccurrences.length === 0 && today.routineToday.length === 0

  const run = async () => {
    controller.current?.abort()
    const ctl = new AbortController()
    controller.current = ctl
    setBusy(true)
    setError(null)
    try {
      const data = await aiAssist("plan-day", planInput(today, new Date()), ctl.signal)
      if (!ctl.signal.aborted) setPlan({ data, at: new Date() })
    } catch (err) {
      if (!ctl.signal.aborted) setError(err instanceof Error ? err.message : "Couldn't plan your day.")
    } finally {
      if (!ctl.signal.aborted) setBusy(false)
    }
  }

  return (
    <section aria-labelledby="planner-title" className="flex flex-col rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="planner-title" className="flex items-center gap-2 font-semibold">
          <Wand2 className="size-4.5 text-primary" aria-hidden /> Plan my day
        </h2>
        {plan && (
          <Button variant="ghost" size="sm" onClick={() => void run()} disabled={busy} aria-label="Regenerate plan">
            <RefreshCw className={busy ? "animate-spin" : undefined} aria-hidden /> Refresh
          </Button>
        )}
      </div>

      <div aria-live="polite" className="flex flex-1 flex-col">
        {error && (
          <Notice tone="danger" title="Planning failed" className="mb-3">
            {error}
          </Notice>
        )}

        {!plan ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-3 rounded-xl bg-surface-muted p-4">
            <p className="text-sm text-muted-foreground">
              {nothingToPlan
                ? "Add a few tasks, events or routine items and Gemini will turn them into a realistic plan."
                : `Gemini looks at your ${plural(today.openTasks.length, "open task")}, ${plural(today.eventOccurrences.length, "event")} today and your routine, then suggests priorities and a schedule.`}
            </p>
            <Button onClick={() => void run()} disabled={busy || nothingToPlan}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              {busy ? "Planning…" : "Plan my day"}
            </Button>
            <p className="text-xs text-muted-foreground">Sends task, event and routine titles and times to Google Gemini. Notes aren&apos;t sent.</p>
          </div>
        ) : (
          <div className={busy ? "opacity-60 transition-opacity" : undefined}>
            <p className="text-sm font-medium">{plan.data.headline}</p>
            {plan.data.priorities.length > 0 && (
              <div className="mt-3">
                <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Top priorities</h3>
                <ol className="space-y-1 text-sm">
                  {plan.data.priorities.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{i + 1}</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {plan.data.schedule.length > 0 && (
              <div className="mt-3">
                <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Suggested schedule</h3>
                <ul className="divide-y rounded-xl border text-sm">
                  {plan.data.schedule.map((s, i) => (
                    <li key={i} className="flex gap-3 px-3 py-2">
                      <span className="w-[4.5rem] shrink-0 text-muted-foreground tabular-nums">{s.time}</span>
                      <span className="min-w-0">{s.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {plan.data.tip && <p className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-sm">💡 {plan.data.tip}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              Generated by Gemini at {format(plan.at, "h:mm a")} · AI suggestions can be wrong — use your judgement.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
