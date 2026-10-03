import { addDays, format } from "date-fns"
import { toDateString } from "@/lib/dates"
import type { FocusSession, Task } from "@/types"

/** Local `yyyy-MM-dd` for an ISO instant. */
export const dayOf = (iso: string) => toDateString(new Date(iso))

const isFocus = (s: FocusSession) => s.phase === "focus"

export function sessionsOn(sessions: FocusSession[], day: string): FocusSession[] {
  return sessions
    .filter((s) => isFocus(s) && dayOf(s.endedAt) === day)
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
}

export const sumMinutes = (list: FocusSession[]) => list.reduce((n, s) => n + s.minutes, 0)

/** Consecutive days (ending today, or yesterday if today has none yet) with ≥1 completed focus session. */
export function focusStreak(sessions: FocusSession[], today: Date = new Date()): number {
  const days = new Set(sessions.filter((s) => isFocus(s) && s.completed).map((s) => dayOf(s.endedAt)))
  let cursor = today
  if (!days.has(toDateString(cursor))) cursor = addDays(cursor, -1)
  let streak = 0
  while (days.has(toDateString(cursor)) && streak < 3650) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export interface DayTotal {
  date: string
  /** Short weekday label, e.g. "Mon". */
  label: string
  /** Long label for screen readers, e.g. "Monday, Oct 3". */
  longLabel: string
  minutes: number
  isToday: boolean
}

export function lastNDays(sessions: FocusSession[], n = 7, today: Date = new Date()): DayTotal[] {
  const totals = new Map<string, number>()
  for (const s of sessions) {
    if (!isFocus(s)) continue
    const d = dayOf(s.endedAt)
    totals.set(d, (totals.get(d) ?? 0) + s.minutes)
  }
  const todayKey = toDateString(today)
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - (n - 1))
    const key = toDateString(date)
    return {
      date: key,
      label: format(date, "EEE"),
      longLabel: format(date, "EEEE, MMM d"),
      minutes: totals.get(key) ?? 0,
      isToday: key === todayKey,
    }
  })
}

export interface TaskBreakdown {
  key: string
  name: string
  minutes: number
  sessions: number
}

export function breakdownByTask(list: FocusSession[], tasks: Task[]): TaskBreakdown[] {
  const map = new Map<string, TaskBreakdown>()
  for (const s of list) {
    const key = s.taskId ? `t:${s.taskId}` : s.label ? `l:${s.label}` : "none"
    const name = (s.taskId && tasks.find((t) => t.id === s.taskId)?.title) || s.label || "No task"
    const row = map.get(key) ?? { key, name, minutes: 0, sessions: 0 }
    row.minutes += s.minutes
    row.sessions += 1
    map.set(key, row)
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes)
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export const timeOf = (iso: string) => format(new Date(iso), "h:mm a")

/** Open tasks: due today/overdue first (by date), then the rest (dated first, then newest). */
export function orderOpenTasks(tasks: Task[], today: string): { due: Task[]; other: Task[] } {
  const open = tasks.filter((t) => !t.completed)
  const byDue = (a: Task, b: Task) =>
    `${a.dueDate ?? "9999"} ${a.dueTime ?? "99"}`.localeCompare(`${b.dueDate ?? "9999"} ${b.dueTime ?? "99"}`) ||
    b.createdAt.localeCompare(a.createdAt)
  return {
    due: open.filter((t) => t.dueDate && t.dueDate <= today).sort(byDue),
    other: open.filter((t) => !t.dueDate || t.dueDate > today).sort(byDue),
  }
}
