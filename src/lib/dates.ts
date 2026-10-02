import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns"
import type { CalendarEvent, EventOccurrence, Recurrence } from "@/types"

export const toDateString = (d: Date) => format(d, "yyyy-MM-dd")
export const todayString = () => toDateString(new Date())

/** Parse a `yyyy-MM-dd` string as a local date (not UTC). */
export const fromDateString = (s: string) => parseISO(s)

/** Combine a `yyyy-MM-dd` date and `HH:mm` time into a local Date. */
export function combineDateTime(date: string, time = "00:00"): Date {
  const [y, m, d] = date.split("-").map(Number)
  const [hh, mm] = time.split(":").map(Number)
  return new Date(y, m - 1, d, hh || 0, mm || 0)
}

export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return format(d, "h:mm a")
}

export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 5) return "Good night"
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

export function stepRecurrence(date: Date, recurrence: Recurrence, n = 1): Date {
  switch (recurrence) {
    case "daily":
      return addDays(date, n)
    case "weekly":
      return addWeeks(date, n)
    case "monthly":
      return addMonths(date, n)
    case "yearly":
      return addYears(date, n)
    default:
      return date
  }
}

/**
 * Expand events (including recurring ones) into concrete occurrences that
 * overlap [rangeStart, rangeEnd). Results are sorted by start time.
 */
export function expandEvents(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): EventOccurrence[] {
  const out: EventOccurrence[] = []
  for (const event of events) {
    const baseStart = parseISO(event.start)
    const baseEnd = parseISO(event.end)
    const duration = Math.max(0, baseEnd.getTime() - baseStart.getTime())
    const until = event.recurrenceUntil ? addDays(fromDateString(event.recurrenceUntil), 1) : null

    const push = (start: Date) => {
      const end = new Date(start.getTime() + duration)
      if (isBefore(start, rangeEnd) && isAfter(end.getTime() === start.getTime() ? addMinutesSafe(end) : end, rangeStart)) {
        out.push({ event, start, end, key: `${event.id}:${start.toISOString()}` })
      }
    }

    if (event.recurrence === "none") {
      push(baseStart)
      continue
    }

    // Jump close to the range start for daily/weekly recurrences to avoid long loops.
    let n = 0
    if (event.recurrence === "daily" || event.recurrence === "weekly") {
      const step = event.recurrence === "daily" ? 1 : 7
      const gap = differenceInCalendarDays(rangeStart, baseStart)
      if (gap > step) n = Math.floor(gap / step) - 1
    }
    for (let guard = 0; guard < 1000; guard++, n++) {
      const start = stepRecurrence(baseStart, event.recurrence, n)
      if (!isBefore(start, rangeEnd)) break
      if (until && !isBefore(start, until)) break
      push(start)
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}

function addMinutesSafe(d: Date) {
  return new Date(d.getTime() + 60_000)
}

/** Whether a recurring task/reminder anchored at `anchor` occurs on `date`. */
export function occursOn(anchor: string, recurrence: Recurrence, date: string): boolean {
  if (recurrence === "none") return anchor === date
  const a = fromDateString(anchor)
  const d = fromDateString(date)
  if (isBefore(d, a)) return false
  switch (recurrence) {
    case "daily":
      return true
    case "weekly":
      return differenceInCalendarDays(d, a) % 7 === 0
    case "monthly":
      return a.getDate() === d.getDate()
    case "yearly":
      return a.getDate() === d.getDate() && a.getMonth() === d.getMonth()
  }
}
