"use client"

import Link from "next/link"
import { useMemo } from "react"
import { addDays, format, isToday, isTomorrow, startOfDay } from "date-fns"
import { CalendarDays, Check, ChevronRight, Droplets, Footprints, HeartPulse, ListTodo, Moon, Sunrise } from "lucide-react"
import { motion } from "framer-motion"
import { ProgressRing } from "@/components/common/progress-ring"
import { Skeleton } from "@/components/ui/skeleton"
import { useCalendar, useRoutines, useTasks, useWellness } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { expandEvents, formatTime12, fromDateString, todayString } from "@/lib/dates"
import { emptyWellnessDay } from "@/lib/storage"
import { cn } from "@/lib/utils"
import { nextDueDate } from "@/components/tools/todo/task-utils"
import { toast } from "sonner"

function Widget({
  title,
  href,
  icon: Icon,
  children,
  className,
}: {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col rounded-2xl border bg-card p-4 sm:p-5", className)} aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Icon className="size-4.5 text-primary" aria-hidden />
          {title}
        </h3>
        <Link
          href={href}
          className="-mr-2 inline-flex h-8 items-center gap-0.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          View <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="flex-1">{children}</div>
    </section>
  )
}

function WidgetSkeleton() {
  return (
    <div className="space-y-2.5">
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-10 w-2/3 rounded-xl" />
    </div>
  )
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="flex h-full min-h-24 flex-col items-start justify-center gap-2 rounded-xl bg-surface-muted p-4">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link href={href} className="text-sm font-medium text-primary hover:underline">
        {cta}
      </Link>
    </div>
  )
}

export function TodayTasksWidget() {
  const hydrated = useHydrated()
  const { tasks, update, upsert } = useTasks()
  const today = todayString()
  const todays = useMemo(
    () =>
      tasks
        .filter((t) => t.dueDate && t.dueDate <= today && (!t.completed || t.completedAt?.startsWith(today)))
        .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99")),
    [tasks, today]
  )
  const done = todays.filter((t) => t.completed).length

  return (
    <Widget title="Today's Tasks" href="/tools/todo" icon={ListTodo}>
      {!hydrated ? (
        <WidgetSkeleton />
      ) : todays.length === 0 ? (
        <Empty text="Nothing due today. Enjoy the calm." href="/tools/todo" cta="Add a task" />
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {done} of {todays.length} done
          </p>
          <ul className="space-y-1.5">
            {todays.slice(0, 4).map((t) => {
              const overdue = !t.completed && t.dueDate! < today
              return (
                <li key={t.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/60">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={t.completed}
                      onChange={() => {
                        if (t.completed) return update(t.id, { completed: false, completedAt: undefined })
                        const stamp = new Date().toISOString()
                        if (t.recurrence === "none") return update(t.id, { completed: true, completedAt: stamp })
                        // Repeating tasks roll forward to their next due date, as in the Tasks tool.
                        const next = nextDueDate(t, today)
                        update(t.id, {
                          dueDate: next,
                          completedAt: stamp,
                          subtasks: t.subtasks.map((s) => ({ ...s, done: false })),
                        })
                        toast.success(`Next due ${format(fromDateString(next), "EEE, MMM d")}`, {
                          description: t.title,
                          action: { label: "Undo", onClick: () => upsert(t) },
                        })
                      }}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-5.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                        t.completed ? "border-success bg-success text-success-foreground" : "border-input",
                        t.priority === "high" && !t.completed && "border-destructive/70"
                      )}
                    >
                      {t.completed && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <Check className="size-3.5" strokeWidth={3} />
                        </motion.span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm", t.completed && "text-muted-foreground line-through")}>
                        {t.title}
                      </span>
                      {(overdue || t.dueTime) && (
                        <span className={cn("block text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                          {overdue ? "Overdue" : formatTime12(t.dueTime!)}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {todays.length > 4 && (
            <p className="mt-2 px-2 text-xs text-muted-foreground">+{todays.length - 4} more</p>
          )}
        </>
      )}
    </Widget>
  )
}

export function TodayRoutineWidget() {
  const hydrated = useHydrated()
  const { routines, update } = useRoutines()
  const now = new Date()
  const today = todayString()
  const weekday = now.getDay()
  const nowHm = format(now, "HH:mm")
  const items = routines.filter((r) => r.repeatDays.includes(weekday)).sort((a, b) => a.time.localeCompare(b.time))
  const done = items.filter((r) => r.completedDates.includes(today)).length
  // Show from the item currently in progress onward.
  const currentIdx = Math.max(0, items.findLastIndex((r) => r.time <= nowHm))
  const visible = items.slice(currentIdx, currentIdx + 4)

  return (
    <Widget title="Today's Routine" href="/tools/routine-planner" icon={Sunrise}>
      {!hydrated ? (
        <WidgetSkeleton />
      ) : items.length === 0 ? (
        <Empty text="No routine for today yet." href="/tools/routine-planner" cta="Build your routine" />
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${(done / items.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {done}/{items.length}
            </span>
          </div>
          <ol className="relative space-y-1 before:absolute before:top-2 before:bottom-2 before:left-[4.6rem] before:w-px before:bg-border">
            {visible.map((r, i) => {
              const isDone = r.completedDates.includes(today)
              const isCurrent = i === 0 && r.time <= nowHm
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() =>
                      update(r.id, {
                        completedDates: isDone
                          ? r.completedDates.filter((d) => d !== today)
                          : [...r.completedDates, today],
                      })
                    }
                    aria-pressed={isDone}
                    aria-label={`${r.title} at ${formatTime12(r.time)}: ${isDone ? "done" : "mark done"}`}
                    className="flex min-h-10 w-full items-center gap-3 rounded-xl px-2 py-1 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">{formatTime12(r.time)}</span>
                    <span
                      className={cn(
                        "relative z-10 size-2.5 shrink-0 rounded-full ring-4 ring-card",
                        isDone ? "bg-success" : isCurrent ? "bg-primary" : "bg-muted-foreground/40"
                      )}
                    />
                    <span className={cn("truncate text-sm", isDone && "text-muted-foreground line-through", isCurrent && !isDone && "font-medium")}>
                      {r.title}
                    </span>
                    {isCurrent && !isDone && (
                      <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Now</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </Widget>
  )
}

export function UpcomingEventsWidget() {
  const hydrated = useHydrated()
  const { events } = useCalendar()
  const occurrences = useMemo(() => {
    const now = new Date()
    return expandEvents(events, now, addDays(startOfDay(now), 8)).slice(0, 4)
  }, [events])

  const dayLabel = (d: Date) => (isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEE, d MMM"))

  return (
    <Widget title="Upcoming Events" href="/tools/calendar" icon={CalendarDays}>
      {!hydrated ? (
        <WidgetSkeleton />
      ) : occurrences.length === 0 ? (
        <Empty text="Your calendar is clear for the week." href="/tools/calendar" cta="Create an event" />
      ) : (
        <ul className="space-y-2">
          {occurrences.map((o) => (
            <li key={o.key} className="flex items-center gap-3 rounded-xl bg-surface-muted p-2.5">
              <div className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-card py-1 shadow-xs">
                <span className="text-[10px] font-medium text-primary uppercase">{format(o.start, "MMM")}</span>
                <span className="text-base leading-tight font-semibold tabular-nums">{format(o.start, "d")}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{o.event.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {dayLabel(o.start)} · {o.event.allDay ? "All day" : format(o.start, "h:mm a")}
                  {o.event.location ? ` · ${o.event.location}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}

export function WellnessWidget() {
  const hydrated = useHydrated()
  const { days, goals } = useWellness()
  const today = todayString()
  const day = days.find((d) => d.id === today) ?? emptyWellnessDay(today)
  const metrics = [
    { label: "Water", icon: Droplets, value: day.waterGlasses, goal: goals.waterGlasses, unit: "glasses", color: "var(--chart-2)" },
    { label: "Steps", icon: Footprints, value: day.steps, goal: goals.steps, unit: "steps", color: "var(--chart-3)" },
    { label: "Sleep", icon: Moon, value: day.sleepHours, goal: goals.sleepHours, unit: "hrs", color: "var(--chart-1)" },
  ]

  return (
    <Widget title="Wellness Progress" href="/tools/wellness" icon={HeartPulse}>
      {!hydrated ? (
        <WidgetSkeleton />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {metrics.map(({ label, icon: Icon, value, goal, unit, color }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-muted px-1 py-3 text-center">
              <ProgressRing value={goal ? value / goal : 0} color={color} label={label} size={52}>
                <Icon className="size-4.5 text-muted-foreground" aria-hidden />
              </ProgressRing>
              <span className="text-sm font-semibold tabular-nums">
                {value.toLocaleString()}
                <span className="font-normal text-muted-foreground">/{goal.toLocaleString()}</span>
              </span>
              <span className="text-[11px] text-muted-foreground">{unit}</span>
            </div>
          ))}
        </div>
      )}
    </Widget>
  )
}
