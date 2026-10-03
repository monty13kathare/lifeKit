"use client"

import { useMemo } from "react"
import { addDays, format, isSameDay, startOfDay } from "date-fns"
import { useCalendar, useFocus, useReminders, useRoutines, useTasks } from "@/hooks/use-lifekit-data"
import { combineDateTime, expandEvents, formatTime12, todayString } from "@/lib/dates"
import { nextOccurrence } from "@/lib/reminders"

export type AgendaKind = "event" | "routine" | "task" | "reminder"

export interface AgendaItem {
  key: string
  kind: AgendaKind
  title: string
  at: Date
  /** e.g. "10:00 AM – 10:30 AM" */
  timeLabel: string
  meta?: string
  href: string
  done: boolean
  /** Routine item id / task id for quick toggling. */
  refId: string
  /** Repeating task (completing it rolls the due date forward in Tasks). */
  recurring?: boolean
}

/**
 * Everything happening today, merged from tasks, events, routine and reminders.
 * Shared by the My Life stat strip, the "Up next" timeline and the AI planner.
 */
export function useToday(now: Date) {
  const { tasks } = useTasks()
  const { events } = useCalendar()
  const { routines } = useRoutines()
  const { reminders } = useReminders()
  const { sessions, settings: focusSettings } = useFocus()
  const minuteKey = format(now, "yyyy-MM-dd HH:mm")

  return useMemo(() => {
    const today = todayString()
    const dayStart = startOfDay(now)
    const dayEnd = addDays(dayStart, 1)

    const openTasks = tasks.filter((t) => !t.completed)
    const dueToday = tasks.filter((t) => t.dueDate && t.dueDate <= today && (!t.completed || t.completedAt?.startsWith(today)))
    const tasksDone = dueToday.filter((t) => t.completed || (t.completedAt?.startsWith(today) ?? false)).length
    const overdue = openTasks.filter((t) => t.dueDate && t.dueDate < today)

    const routineToday = routines.filter((r) => r.repeatDays.includes(now.getDay())).sort((a, b) => a.time.localeCompare(b.time))
    const routineDone = routineToday.filter((r) => r.completedDates.includes(today)).length

    const eventOccurrences = expandEvents(events, dayStart, dayEnd)
    const focusMinutesToday = sessions
      .filter((s) => s.phase === "focus" && s.endedAt.slice(0, 10) === today)
      .reduce((sum, s) => sum + s.minutes, 0)

    const items: AgendaItem[] = []
    for (const o of eventOccurrences) {
      items.push({
        key: `e:${o.key}`,
        kind: "event",
        title: o.event.title,
        at: o.event.allDay ? dayStart : o.start,
        timeLabel: o.event.allDay ? "All day" : `${format(o.start, "h:mm a")} – ${format(o.end, "h:mm a")}`,
        meta: o.event.location,
        href: "/tools/calendar",
        done: !o.event.allDay && o.end < now,
        refId: o.event.id,
      })
    }
    for (const r of routineToday) {
      const at = combineDateTime(today, r.time)
      items.push({
        key: `r:${r.id}`,
        kind: "routine",
        title: r.title,
        at,
        timeLabel: formatTime12(r.time),
        meta: `${r.durationMinutes} min`,
        href: "/tools/routine-planner",
        done: r.completedDates.includes(today),
        refId: r.id,
      })
    }
    for (const t of dueToday) {
      if (!t.dueTime || t.dueDate !== today) continue
      items.push({
        key: `t:${t.id}`,
        kind: "task",
        title: t.title,
        at: combineDateTime(today, t.dueTime),
        timeLabel: formatTime12(t.dueTime),
        meta: `${t.priority} priority`,
        recurring: t.recurrence !== "none",
        href: "/tools/todo",
        done: t.completed,
        refId: t.id,
      })
    }
    for (const r of reminders) {
      if (r.done) continue
      const next = nextOccurrence(r, dayStart)
      if (!next || !isSameDay(next, now)) continue
      items.push({
        key: `m:${r.id}`,
        kind: "reminder",
        title: r.title,
        at: next,
        timeLabel: format(next, "h:mm a"),
        href: "/tools/reminders",
        done: next < now,
        refId: r.id,
      })
    }
    items.sort((a, b) => a.at.getTime() - b.at.getTime())

    const untimedTasks = dueToday.filter((t) => !t.completed && (!t.dueTime || t.dueDate! < today))
    const nextEvent = eventOccurrences.find((o) => o.start > now && !o.event.allDay)

    return {
      today,
      openTasks,
      dueToday,
      tasksDone,
      overdue,
      routineToday,
      routineDone,
      eventOccurrences,
      nextEvent,
      focusMinutesToday,
      focusGoal: focusSettings.dailyGoalMinutes,
      items,
      untimedTasks,
    }
    // minuteKey re-evaluates time-dependent parts once a minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, events, routines, reminders, sessions, focusSettings, minuteKey])
}
