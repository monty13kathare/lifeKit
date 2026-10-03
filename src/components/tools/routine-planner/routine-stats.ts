import { addDays, startOfWeek } from "date-fns"
import { fromDateString, toDateString } from "@/lib/dates"
import type { RoutineItem } from "@/types"
import { itemsForDate } from "./routine-utils"

/** Max days to look back when counting a streak. */
const STREAK_LIMIT = 730

/** null = nothing scheduled that day; otherwise whether every scheduled item was ticked off. */
function dayComplete(routines: RoutineItem[], date: string): boolean | null {
  const items = itemsForDate(routines, date)
  if (!items.length) return null
  return items.every((i) => i.completedDates.includes(date))
}

/**
 * "Perfect days": consecutive days up to today where every routine item
 * scheduled that weekday was completed. If today isn't finished yet, counting
 * starts from yesterday. Days with nothing scheduled don't break the streak
 * (and don't add to it).
 */
export function perfectDayStreak(routines: RoutineItem[], today: string): number {
  if (!routines.length) return 0
  let streak = 0
  let cursor = fromDateString(today)
  if (dayComplete(routines, today) !== true) cursor = addDays(cursor, -1)
  for (let i = 0; i < STREAK_LIMIT; i++) {
    const ds = toDateString(cursor)
    const state = dayComplete(routines, ds)
    if (state === false) break
    if (state === true) streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** Completion across this week (Sunday → today). `pct` is null when nothing was scheduled. */
export function weekCompletion(routines: RoutineItem[], today: string): { done: number; total: number; pct: number | null } {
  const end = fromDateString(today)
  let done = 0
  let total = 0
  for (let d = startOfWeek(end); d <= end; d = addDays(d, 1)) {
    const ds = toDateString(d)
    const items = itemsForDate(routines, ds)
    total += items.length
    done += items.filter((i) => i.completedDates.includes(ds)).length
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : null }
}
