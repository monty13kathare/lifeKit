import { addDays, addHours, addMinutes, format, nextMonday, set } from "date-fns"
import { combineDateTime } from "@/lib/dates"
import type { Reminder } from "@/types"

/** "Repeats every day", "Repeats weekly on Sunday", "Repeats monthly on the 15th". */
export function describeRepeat(r: Pick<Reminder, "repeat" | "date" | "time">): string | null {
  if (r.repeat === "none") return null
  const anchor = combineDateTime(r.date, r.time)
  switch (r.repeat) {
    case "daily":
      return "Repeats every day"
    case "weekly":
      return `Repeats weekly on ${format(anchor, "EEEE")}`
    case "monthly":
      return anchor.getDate() > 28
        ? `Repeats monthly on the ${format(anchor, "do")} (or the last day of shorter months)`
        : `Repeats monthly on the ${format(anchor, "do")}`
  }
}

const at = (d: Date, hours: number, minutes = 0) => set(d, { hours, minutes, seconds: 0, milliseconds: 0 })

export interface TimePreset {
  id: string
  label: string
  compute: (now: Date) => Date
}

/** Quick date+time shortcuts for the reminder form. */
export const TIME_PRESETS: TimePreset[] = [
  { id: "15m", label: "In 15 min", compute: (now) => addMinutes(now, 15) },
  { id: "1h", label: "In 1 hour", compute: (now) => addHours(now, 1) },
  {
    id: "evening",
    label: "This evening 8 PM",
    compute: (now) => {
      const t = at(now, 20)
      return t > now ? t : addDays(t, 1)
    },
  },
  { id: "tomorrow", label: "Tomorrow 9 AM", compute: (now) => at(addDays(now, 1), 9) },
  { id: "monday", label: "Next Monday 9 AM", compute: (now) => at(nextMonday(now), 9) },
]
