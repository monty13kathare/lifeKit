"use client"

import Link from "next/link"
import { ChevronRight, SquareCheck } from "lucide-react"
import { formatTime12 } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { Task } from "@/types"

/** Incomplete tasks with a due date, grouped by `yyyy-MM-dd`. */
export function groupTasksByDay(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const t of tasks) {
    if (t.completed || !t.dueDate) continue
    const list = map.get(t.dueDate)
    if (list) list.push(t)
    else map.set(t.dueDate, [t])
  }
  for (const list of map.values()) list.sort((a, b) => (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99"))
  return map
}

const PRIORITY_DOT: Record<Task["priority"], string> = {
  high: "bg-destructive",
  medium: "bg-warning",
  low: "bg-muted-foreground/50",
}

/** "Tasks due" list for a day (read-only, links to the To-do tool). */
export function TasksDueList({ tasks, className }: { tasks: Task[]; className?: string }) {
  if (!tasks.length) return null
  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <SquareCheck className="size-3.5" aria-hidden /> Tasks due
      </h4>
      <ul className="space-y-1.5">
        {tasks.map((t) => (
          <li key={t.id}>
            <Link
              href="/tools/todo"
              className="flex min-h-11 items-center gap-2.5 rounded-xl border border-dashed bg-surface px-3 py-2 text-sm transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <SquareCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              {t.dueTime ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatTime12(t.dueTime)}</span> : null}
              <span className={cn("size-2 shrink-0 rounded-full", PRIORITY_DOT[t.priority])} aria-label={`${t.priority} priority`} />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Compact task chip for the week/day all-day row. */
export function TaskChip({ task }: { task: Task }) {
  return (
    <Link
      href="/tools/todo"
      title={`Task due: ${task.title}`}
      className="flex w-full min-w-0 items-center gap-1 rounded-md border border-dashed bg-surface px-1.5 py-0.5 text-left text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <SquareCheck className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">Task due: </span>
      <span className="truncate">{task.title}</span>
    </Link>
  )
}
