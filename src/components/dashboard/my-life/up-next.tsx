"use client"

import Link from "next/link"
import { Bell, CalendarDays, Check, CircleDashed, ListTodo, Sunrise } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useRoutines, useTasks } from "@/hooks/use-lifekit-data"
import { cn } from "@/lib/utils"
import type { AgendaItem, AgendaKind } from "./use-today"

const KIND: Record<AgendaKind, { icon: typeof Bell; label: string; dot: string }> = {
  event: { icon: CalendarDays, label: "Event", dot: "bg-sky-500" },
  routine: { icon: Sunrise, label: "Routine", dot: "bg-orange-500" },
  task: { icon: ListTodo, label: "Task", dot: "bg-indigo-500" },
  reminder: { icon: Bell, label: "Reminder", dot: "bg-amber-500" },
}

interface UpNextProps {
  hydrated: boolean
  now: Date
  items: AgendaItem[]
  untimedCount: number
  today: string
}

/** Today's remaining timeline across calendar, routine, timed tasks and reminders. */
export function UpNext({ hydrated, now, items, untimedCount, today }: UpNextProps) {
  const { update: updateRoutine, routines } = useRoutines()
  const { update: updateTask } = useTasks()
  // Upcoming = not finished or still in progress; keep the item happening now visible.
  const upcoming = items.filter((i) => !i.done && (i.at >= new Date(now.getTime() - 60 * 60 * 1000) || i.kind === "task"))
  const visible = upcoming.slice(0, 8)
  const doneCount = items.filter((i) => i.done).length

  const toggle = (item: AgendaItem) => {
    if (item.kind === "routine") {
      const r = routines.find((x) => x.id === item.refId)
      if (!r) return
      const has = r.completedDates.includes(today)
      updateRoutine(r.id, { completedDates: has ? r.completedDates.filter((d) => d !== today) : [...r.completedDates, today] })
    } else if (item.kind === "task") {
      updateTask(item.refId, (t) =>
        ({ ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined })
      )
    }
  }

  return (
    <section aria-labelledby="up-next-title" className="flex flex-col rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="up-next-title" className="font-semibold">
          Up next today
        </h2>
        {hydrated && items.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {doneCount}/{items.length} done
          </span>
        )}
      </div>
      {!hydrated ? (
        <div className="space-y-2">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 w-2/3 rounded-xl" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-1 rounded-xl bg-surface-muted p-4">
          <p className="text-sm font-medium">{items.length ? "You're done for today 🎉" : "Nothing scheduled for the rest of today."}</p>
          <p className="text-sm text-muted-foreground">Use Quick capture above to add something.</p>
        </div>
      ) : (
        <ol className="relative space-y-1 before:absolute before:top-3 before:bottom-3 before:left-[1.1rem] before:w-px before:bg-border">
          {visible.map((item) => {
            const meta = KIND[item.kind]
            const Icon = meta.icon
            const isNow = item.kind !== "task" && item.at <= now && !item.done
            // Repeating tasks roll forward in the Tasks tool, so they link there instead of toggling.
            const canToggle = item.kind === "routine" || (item.kind === "task" && !item.recurring)
            return (
              <li key={item.key} className="relative flex items-center gap-3 rounded-xl py-1.5 pr-1">
                {canToggle ? (
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    aria-label={`${item.done ? "Mark not done" : "Mark done"}: ${item.title}`}
                    className={cn(
                      "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 bg-card transition-colors",
                      item.done ? "border-success bg-success text-success-foreground" : "border-input hover:border-primary"
                    )}
                  >
                    {item.done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <CircleDashed className="size-4 text-muted-foreground" aria-hidden />}
                  </button>
                ) : (
                  <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border bg-card">
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                )}
                <Link href={item.href} className="-my-1 min-w-0 flex-1 rounded-lg px-2 py-1 transition-colors hover:bg-muted/60">
                  <span className={cn("block truncate text-sm font-medium", item.done && "text-muted-foreground line-through")}>{item.title}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
                    {meta.label} · {item.timeLabel}
                    {item.meta ? <span className="truncate"> · {item.meta}</span> : null}
                  </span>
                </Link>
                {isNow && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Now</span>}
              </li>
            )
          })}
        </ol>
      )}
      {hydrated && untimedCount > 0 && (
        <Link href="/tools/todo" className="mt-3 block rounded-xl bg-surface-muted px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          + {untimedCount} task{untimedCount === 1 ? "" : "s"} due today without a time →
        </Link>
      )}
    </section>
  )
}
