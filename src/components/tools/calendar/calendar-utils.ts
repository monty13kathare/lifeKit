import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isSameYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import type { EventOccurrence, Recurrence } from "@/types"

export type CalendarView = "month" | "week" | "day" | "agenda"

export const VIEW_ITEMS: { value: CalendarView; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "agenda", label: "Agenda" },
]

export const RECURRENCE_ITEMS: { value: Recurrence; label: string }[] = [
  { value: "none", label: "Doesn't repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "yearly", label: "Every year" },
]

export const AGENDA_DAYS = 30

export function viewRange(view: CalendarView, cursor: Date): { start: Date; end: Date } {
  switch (view) {
    case "month":
      // endOfWeek is Sat 23:59:59.999, so truncate to midnight to end exactly after Saturday.
      return { start: startOfWeek(startOfMonth(cursor)), end: startOfDay(addDays(endOfWeek(endOfMonth(cursor)), 1)) }
    case "week":
      return { start: startOfWeek(cursor), end: addDays(startOfWeek(cursor), 7) }
    case "day":
      return { start: startOfDay(cursor), end: addDays(startOfDay(cursor), 1) }
    case "agenda":
      return { start: startOfDay(cursor), end: addDays(startOfDay(cursor), AGENDA_DAYS) }
  }
}

export function shiftCursor(view: CalendarView, cursor: Date, dir: 1 | -1): Date {
  switch (view) {
    case "month":
      return addMonths(startOfMonth(cursor), dir)
    case "week":
      return addWeeks(cursor, dir)
    case "day":
      return addDays(cursor, dir)
    case "agenda":
      return addDays(cursor, dir * AGENDA_DAYS)
  }
}

export function viewTitle(view: CalendarView, cursor: Date): string {
  switch (view) {
    case "month":
      return format(cursor, "MMMM yyyy")
    case "week": {
      const s = startOfWeek(cursor)
      const e = addDays(s, 6)
      if (isSameMonth(s, e)) return `${format(s, "MMM d")} – ${format(e, "d, yyyy")}`
      if (isSameYear(s, e)) return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`
      return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`
    }
    case "day":
      return format(cursor, "EEEE, MMMM d, yyyy")
    case "agenda": {
      const e = addDays(cursor, AGENDA_DAYS - 1)
      return `${format(cursor, "MMM d")} – ${format(e, "MMM d, yyyy")}`
    }
  }
}

/** Does the occurrence overlap the local calendar day `day`? */
export function overlapsDay(o: EventOccurrence, day: Date): boolean {
  const s = startOfDay(day).getTime()
  const e = addDays(startOfDay(day), 1).getTime()
  const os = o.start.getTime()
  const oe = o.end.getTime()
  if (oe <= os) return os >= s && os < e
  return os < e && oe > s
}

export const occurrencesOn = (occs: EventOccurrence[], day: Date) => occs.filter((o) => overlapsDay(o, day))

export interface PositionedEvent {
  occurrence: EventOccurrence
  /** Minutes from local midnight (clipped to the day). */
  startMin: number
  endMin: number
  col: number
  cols: number
}

const MIN_VISUAL_MINUTES = 25

/** Lay out timed events for one day: overlapping events sit side by side. */
export function layoutDay(occs: EventOccurrence[], day: Date): PositionedEvent[] {
  const dayStart = startOfDay(day).getTime()
  const items = occs
    .filter((o) => !o.event.allDay && overlapsDay(o, day))
    .map((o) => {
      const startMin = Math.max(0, (o.start.getTime() - dayStart) / 60000)
      const endMin = Math.min(1440, (o.end.getTime() - dayStart) / 60000)
      return { occurrence: o, startMin, endMin: Math.max(endMin, startMin), col: 0, cols: 1 }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  const out: PositionedEvent[] = []
  let cluster: PositionedEvent[] = []
  let columns: number[] = [] // visual end minute per column
  let clusterEnd = -1

  const flush = () => {
    cluster.forEach((c) => (c.cols = columns.length))
    out.push(...cluster)
    cluster = []
    columns = []
  }

  for (const it of items) {
    const visualEnd = Math.max(it.endMin, it.startMin + MIN_VISUAL_MINUTES)
    if (cluster.length && it.startMin >= clusterEnd) flush()
    let col = columns.findIndex((end) => end <= it.startMin)
    if (col === -1) {
      col = columns.length
      columns.push(visualEnd)
    } else columns[col] = visualEnd
    it.col = col
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, visualEnd)
    if (cluster.length === 1) clusterEnd = visualEnd
  }
  flush()
  return out
}

export function occurrenceTimeLabel(o: EventOccurrence): string {
  if (o.event.allDay) return "All day"
  const sameDay = startOfDay(o.start).getTime() === startOfDay(o.end).getTime()
  const fmt = (d: Date) => format(d, d.getMinutes() ? "h:mm a" : "h a")
  if (sameDay) return `${fmt(o.start)} – ${fmt(o.end)}`
  return `${format(o.start, "MMM d")}, ${fmt(o.start)} – ${format(o.end, "MMM d")}, ${fmt(o.end)}`
}
