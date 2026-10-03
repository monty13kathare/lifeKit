/**
 * Local, offline quick-add parser for Tasks. Pure TS — no network, no AI.
 *
 * Understands:
 *  - dates: `today`, `tonight`, `tomorrow`/`tmr`, weekday names (`friday`,
 *    `fri`, `next friday`, `on friday`), `in 3 days`, `in 2 weeks`
 *  - times: `at 6pm`, `6:30pm`, `10am`, `18:00`, `at 18:00`, `noon`
 *  - priority: `!high` `!medium` `!low`, `!1` `!2` `!3`, `!h` `!m` `!l`
 *  - category: `#Work` (matches existing categories case-insensitively)
 *  - repeat: `every day|week|month`, `daily`, `weekly`, `monthly`,
 *    `every monday` (weekly, starting on the next Monday)
 *
 * Matched tokens are stripped from the title. When no date token is found the
 * due date defaults to today (the quick-add's historical behaviour).
 */
import { addDays, addWeeks, format } from "date-fns"
import type { Task, TaskPriority } from "@/types"

export interface QuickParseResult {
  title: string
  dueDate: string
  dueTime?: string
  priority?: TaskPriority
  category?: string
  recurrence: Task["recurrence"]
  /** True when the user typed an explicit date token. */
  hasDate: boolean
  /** True when anything at all was recognised. */
  recognised: boolean
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const WEEKDAY_RE = "(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)"

// Token boundaries: start/whitespace before, end/whitespace/punctuation after.
const B = "(?<=^|\\s)"
const E = "(?=$|[\\s,.;!?])"

const toDate = (d: Date) => format(d, "yyyy-MM-dd")
const pad = (n: number) => String(n).padStart(2, "0")

function weekdayIndex(word: string): number {
  const w = word.toLowerCase().slice(0, 3)
  return WEEKDAYS.findIndex((d) => d.startsWith(w))
}

/** Next occurrence of a weekday strictly after `from` (a Friday typed on a Friday means next week). */
function nextWeekday(from: Date, idx: number, allowToday = false): Date {
  let diff = (idx - from.getDay() + 7) % 7
  if (diff === 0 && !allowToday) diff = 7
  return addDays(from, diff)
}

function to24h(hour: number, minute: number, meridiem?: string): string | null {
  if (minute > 59) return null
  if (meridiem) {
    if (hour < 1 || hour > 12) return null
    const pm = meridiem.toLowerCase().startsWith("p")
    hour = (hour % 12) + (pm ? 12 : 0)
  } else if (hour > 23) return null
  return `${pad(hour)}:${pad(minute)}`
}

export function quickParse(input: string, opts: { now?: Date; categories?: readonly string[] } = {}): QuickParseResult {
  const now = opts.now ?? new Date()
  let text = ` ${input.replace(/\s+/g, " ").trim()} `
  let dueDate: string | undefined
  let dueTime: string | undefined
  let priority: TaskPriority | undefined
  let category: string | undefined
  let recurrence: Task["recurrence"] = "none"

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = text.match(re)
    if (!m || m.index === undefined) return
    if (fn(m) === false) return
    text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`
  }

  // Priority
  take(new RegExp(`${B}!(high|hi|h|urgent|1|medium|med|m|2|low|lo|l|3)${E}`, "i"), (m) => {
    const v = m[1].toLowerCase()
    priority = ["high", "hi", "h", "urgent", "1"].includes(v) ? "high" : ["low", "lo", "l", "3"].includes(v) ? "low" : "medium"
  })

  // Category
  take(new RegExp(`${B}#([\\p{L}\\p{N}][\\p{L}\\p{N}_-]{0,39})${E}`, "iu"), (m) => {
    const raw = m[1].replace(/[-_]+/g, " ").trim()
    const existing = opts.categories?.find((c) => c.toLowerCase() === raw.toLowerCase())
    category = existing ?? raw.charAt(0).toUpperCase() + raw.slice(1)
  })

  // Recurrence (before weekdays so "every monday" isn't read as a plain date)
  take(new RegExp(`${B}every\\s+${WEEKDAY_RE}${E}`, "i"), (m) => {
    const idx = weekdayIndex(m[1])
    if (idx < 0) return false
    recurrence = "weekly"
    dueDate = toDate(nextWeekday(now, idx, true))
  })
  take(new RegExp(`${B}(?:every\\s+(day|week|month)|(daily|weekly|monthly))${E}`, "i"), (m) => {
    const v = (m[1] ?? m[2]).toLowerCase()
    recurrence = v.startsWith("d") ? "daily" : v.startsWith("w") ? "weekly" : "monthly"
  })

  // Time — "noon"/"midnight", 12h with am/pm, or 24h "18:00"
  take(new RegExp(`${B}(?:at\\s+|@\\s*)?(noon|midnight)${E}`, "i"), (m) => {
    dueTime = m[1].toLowerCase() === "noon" ? "12:00" : "00:00"
  })
  if (!dueTime)
    take(new RegExp(`${B}(?:at\\s+|@\\s*)?(\\d{1,2})(?:[:.](\\d{2}))?\\s?(am|pm|a\\.m\\.|p\\.m\\.)${E}`, "i"), (m) => {
      const t = to24h(Number(m[1]), Number(m[2] ?? 0), m[3])
      if (!t) return false
      dueTime = t
    })
  if (!dueTime)
    take(new RegExp(`${B}(?:at\\s+|@\\s*)?([01]?\\d|2[0-3]):([0-5]\\d)${E}`, "i"), (m) => {
      dueTime = to24h(Number(m[1]), Number(m[2])) ?? undefined
    })

  // Date
  if (!dueDate) {
    take(new RegExp(`${B}(?:(?:on|by|due)\\s+)?(today|tonight|tod)${E}`, "i"), (m) => {
      dueDate = toDate(now)
      if (m[1].toLowerCase() === "tonight" && !dueTime) dueTime = "20:00"
    })
  }
  if (!dueDate) take(new RegExp(`${B}(?:(?:on|by|due)\\s+)?(tomorrow|tmrw?|tmr)${E}`, "i"), () => void (dueDate = toDate(addDays(now, 1))))
  if (!dueDate)
    take(new RegExp(`${B}in\\s+(\\d{1,3})\\s+(day|days|week|weeks)${E}`, "i"), (m) => {
      const n = Number(m[1])
      dueDate = toDate(m[2].toLowerCase().startsWith("w") ? addWeeks(now, n) : addDays(now, n))
    })
  if (!dueDate)
    take(new RegExp(`${B}(?:(?:on|by|due|this|next)\\s+)?${WEEKDAY_RE}${E}`, "i"), (m) => {
      const idx = weekdayIndex(m[1])
      if (idx < 0) return false
      dueDate = toDate(nextWeekday(now, idx))
    })

  const hasDate = !!dueDate
  let title = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,;:\-–—\s]+|[,;:\-–—\s]+$/g, "")
    .trim()
  const recognised = hasDate || !!dueTime || !!priority || !!category || recurrence !== "none"
  if (!title) title = input.trim()

  return {
    title: title.slice(0, 200),
    dueDate: dueDate ?? toDate(now),
    dueTime,
    priority,
    category,
    recurrence,
    hasDate,
    recognised,
  }
}
