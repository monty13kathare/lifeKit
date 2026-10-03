import { addDays, differenceInCalendarDays, format, isSameYear } from "date-fns"
import { fromDateString, stepRecurrence, toDateString } from "@/lib/dates"
import type { Task, TaskPriority } from "@/types"

export const PRESET_CATEGORIES = ["Personal", "Work", "Home", "Shopping", "Health"] as const

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; rank: number; accent: string; badge: string; dot: string }
> = {
  high: {
    label: "High",
    rank: 0,
    accent: "border-l-rose-500",
    badge: "bg-rose-500/12 text-rose-700 dark:bg-rose-400/20 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  medium: {
    label: "Medium",
    rank: 1,
    accent: "border-l-amber-500",
    badge: "bg-amber-500/15 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  low: {
    label: "Low",
    rank: 2,
    accent: "border-l-sky-500",
    badge: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300",
    dot: "bg-sky-500",
  },
}

export const RECURRENCE_LABEL: Record<Task["recurrence"], string> = {
  none: "Doesn't repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
}

export type SortKey = "due" | "priority" | "created" | "title"

export const SORT_ITEMS: { value: SortKey; label: string }[] = [
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "created", label: "Newest" },
  { value: "title", label: "Title (A–Z)" },
]

const dueKey = (t: Task) => `${t.dueDate ?? "9999-99-99"} ${t.dueTime ?? "99:99"}`

export function sortTasks(tasks: Task[], key: SortKey): Task[] {
  const list = [...tasks]
  switch (key) {
    case "priority":
      return list.sort(
        (a, b) => PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank || dueKey(a).localeCompare(dueKey(b))
      )
    case "created":
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case "title":
      return list.sort((a, b) => a.title.localeCompare(b.title))
    default:
      return list.sort(
        (a, b) => dueKey(a).localeCompare(dueKey(b)) || PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank
      )
  }
}

/** Human due label relative to `today` (yyyy-MM-dd), e.g. "Today · 6:00 PM", "Overdue · Sep 30". */
export function dueLabel(task: Pick<Task, "dueDate" | "dueTime">, today: string): string | null {
  if (!task.dueDate) return null
  const d = fromDateString(task.dueDate)
  const diff = differenceInCalendarDays(d, fromDateString(today))
  let day: string
  if (diff === 0) day = "Today"
  else if (diff === 1) day = "Tomorrow"
  else if (diff === -1) day = "Yesterday"
  else if (diff > 1 && diff < 7) day = format(d, "EEEE")
  else day = format(d, isSameYear(d, fromDateString(today)) ? "EEE, MMM d" : "MMM d, yyyy")
  if (task.dueTime) {
    const [h, m] = task.dueTime.split(":").map(Number)
    const t = new Date(d)
    t.setHours(h, m)
    day += ` · ${format(t, "h:mm a")}`
  }
  return day
}

export const isOverdue = (t: Task, today: string) => !t.completed && !!t.dueDate && t.dueDate < today

/**
 * Next due date for a recurring task: one step after its current due date,
 * stepping further until it is not in the past (so an overdue daily task
 * doesn't stay overdue after being ticked).
 */
export function nextDueDate(task: Task, today: string): string {
  const base = task.dueDate ? fromDateString(task.dueDate) : fromDateString(today)
  let next = stepRecurrence(base, task.recurrence)
  let guard = 0
  while (toDateString(next) < today && guard++ < 1000) next = stepRecurrence(next, task.recurrence)
  return toDateString(next)
}

export type UpcomingGroup = "Tomorrow" | "This week" | "Later" | "No date"

export function upcomingGroup(task: Task, today: string): UpcomingGroup | null {
  if (!task.dueDate) return "No date"
  if (task.dueDate <= today) return null
  const t = fromDateString(today)
  if (task.dueDate === toDateString(addDays(t, 1))) return "Tomorrow"
  if (task.dueDate <= toDateString(addDays(t, 7))) return "This week"
  return "Later"
}

export const formatShortDate = (date: string) => format(fromDateString(date), "EEE, MMM d")

/** "45m", "1h 20m", "2h" — for focused-time meta on cards. */
export function formatFocusMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r}m`
  return r ? `${h}h ${r}m` : `${h}h`
}

/** Matches title, notes, subtask titles and category (case-insensitive). */
export function matchesQuery(task: Task, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    task.title.toLowerCase().includes(q) ||
    (task.notes ?? "").toLowerCase().includes(q) ||
    task.category.toLowerCase().includes(q) ||
    task.subtasks.some((s) => s.title.toLowerCase().includes(q))
  )
}
