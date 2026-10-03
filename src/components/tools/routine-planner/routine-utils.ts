import { format } from "date-fns"
import { fromDateString } from "@/lib/dates"
import type { RoutineItem } from "@/types"

export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"]
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
export const WEEKDAYS = [1, 2, 3, 4, 5]
export const WEEKENDS = [0, 6]

export const DAY_PRESETS = [
  { label: "Every day", days: ALL_DAYS },
  { label: "Weekdays", days: WEEKDAYS },
  { label: "Weekends", days: WEEKENDS },
]

export type RoutineSort = "time" | "custom"

export const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function formatClock(minutes: number): string {
  const d = new Date(2000, 0, 1, 0, 0)
  d.setMinutes(minutes)
  return format(d, "h:mm a")
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

const sameDays = (a: number[], b: number[]) => a.length === b.length && b.every((d) => a.includes(d))

export function repeatLabel(days: number[]): string {
  if (sameDays(days, ALL_DAYS)) return "Every day"
  if (sameDays(days, WEEKDAYS)) return "Weekdays"
  if (sameDays(days, WEEKENDS)) return "Weekends"
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d].slice(0, 3))
    .join(", ")
}

export const weekdayOf = (date: string) => fromDateString(date).getDay()

export const itemsForDate = (items: RoutineItem[], date: string) => {
  const wd = weekdayOf(date)
  return items.filter((i) => i.repeatDays.includes(wd))
}

export function sortRoutine(items: RoutineItem[], mode: RoutineSort): RoutineItem[] {
  return [...items].sort((a, b) =>
    mode === "time"
      ? toMinutes(a.time) - toMinutes(b.time) || a.order - b.order
      : a.order - b.order || toMinutes(a.time) - toMinutes(b.time)
  )
}

/** Is `nowMinutes` within the item's [start, start+duration) window (handles past-midnight spans)? */
export function isActiveAt(item: RoutineItem, nowMinutes: number): boolean {
  const start = toMinutes(item.time)
  const end = start + item.durationMinutes
  return (nowMinutes >= start && nowMinutes < end) || (end > 1440 && nowMinutes + 1440 < end)
}

/**
 * Re-assign `order` for the visible items so they appear in `orderedIds`
 * sequence, reusing their existing order slots so hidden items keep their place.
 * Returns id → new order for changed items.
 */
export function reorderPatch(visible: RoutineItem[], orderedIds: string[]): Map<string, number> {
  const slots = visible.map((i) => i.order).sort((a, b) => a - b)
  // Make slots strictly increasing so ties don't collapse the new sequence.
  for (let i = 1; i < slots.length; i++) if (slots[i] <= slots[i - 1]) slots[i] = slots[i - 1] + 1
  const patch = new Map<string, number>()
  orderedIds.forEach((id, idx) => {
    const item = visible.find((v) => v.id === id)
    if (item && item.order !== slots[idx]) patch.set(id, slots[idx])
  })
  return patch
}

/** Other items that share a day with `draft` and whose time windows overlap it. */
export function findOverlaps(
  draft: { time: string; durationMinutes: number; repeatDays: number[] },
  others: RoutineItem[]
): RoutineItem[] {
  if (!/^\d{2}:\d{2}$/.test(draft.time) || !Number.isFinite(draft.durationMinutes) || draft.durationMinutes <= 0) return []
  const s = toMinutes(draft.time)
  const e = s + draft.durationMinutes
  return others.filter((o) => {
    if (!o.repeatDays.some((d) => draft.repeatDays.includes(d))) return false
    const os = toMinutes(o.time)
    const oe = os + o.durationMinutes
    return s < oe && os < e
  })
}
