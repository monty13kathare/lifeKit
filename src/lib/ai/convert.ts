/**
 * Convert validated AI output into LifeKit records. Shared by every tool so
 * AI-created items behave exactly like manually created ones.
 */
import { addHours, format } from "date-fns"
import { combineDateTime } from "@/lib/dates"
import { createId } from "@/lib/storage/core"
import type { CalendarEvent, Note, Reminder, RoutineItem, Task } from "@/types"
import type { AiEvent, AiReminder, AiRoutineItem, AiTask } from "./assist-schemas"

const nowIso = () => new Date().toISOString()

export function aiTaskToTask(t: AiTask): Task {
  return {
    id: createId(),
    title: t.title.trim(),
    notes: t.notes?.trim() || undefined,
    priority: t.priority,
    dueDate: t.dueDate || undefined,
    dueTime: t.dueDate && t.dueTime ? t.dueTime : undefined,
    category: t.category?.trim() || "Personal",
    recurrence: t.recurrence,
    completed: false,
    subtasks: (t.subtasks ?? []).map((title) => ({ id: createId(), title, done: false })),
    createdAt: nowIso(),
  }
}

export function aiEventToEvent(e: AiEvent): CalendarEvent {
  const allDay = e.allDay || !e.startTime
  const start = combineDateTime(e.date, allDay ? "00:00" : e.startTime)
  let end = allDay ? combineDateTime(e.date, "23:59") : e.endTime ? combineDateTime(e.date, e.endTime) : addHours(start, 1)
  if (end <= start) end = addHours(start, 1) // e.g. "11pm–1am" or a bad parse
  return {
    id: createId(),
    title: e.title.trim(),
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
    color: "indigo",
    notes: e.notes?.trim() || undefined,
    location: e.location?.trim() || undefined,
    recurrence: e.recurrence,
    alertMinutes: e.alertMinutes != null && e.alertMinutes >= 0 ? e.alertMinutes : null,
  }
}

export function aiReminderToReminder(r: AiReminder): Reminder {
  return {
    id: createId(),
    title: r.title.trim(),
    date: r.date,
    time: r.time,
    repeat: r.repeat,
    notes: r.notes?.trim() || undefined,
    done: false,
    createdAt: nowIso(),
  }
}

export function aiNoteToNote(n: { title: string; content: string }): Note {
  const now = nowIso()
  return { id: createId(), title: n.title.trim(), content: n.content, source: "manual", createdAt: now, updatedAt: now }
}

export function aiRoutineToItems(items: AiRoutineItem[], startOrder = 0): RoutineItem[] {
  return [...items]
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((it, i) => ({
      id: createId(),
      title: it.title.trim(),
      time: it.time,
      durationMinutes: it.durationMinutes,
      repeatDays: [...new Set(it.repeatDays)].sort(),
      order: startOrder + i,
      color: it.color,
      completedDates: [],
    }))
}

/** Human summary of when an AI-parsed item is scheduled, for confirmation toasts. */
export function describeWhen(date?: string, time?: string): string {
  if (!date) return "No date"
  const d = combineDateTime(date, time || "00:00")
  return time ? format(d, "EEE d MMM, h:mm a") : format(d, "EEE d MMM")
}
