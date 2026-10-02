import { addMonths, differenceInCalendarDays } from "date-fns"
import { combineDateTime } from "@/lib/dates"
import type { Reminder } from "@/types"

/** Most recent occurrence at or before `now`, or null if the first one is still in the future. */
export function latestOccurrence(r: Reminder, now = new Date()): Date | null {
  const anchor = combineDateTime(r.date, r.time)
  if (anchor > now) return null
  if (r.repeat === "none") return anchor
  if (r.repeat === "daily" || r.repeat === "weekly") {
    const step = r.repeat === "daily" ? 1 : 7
    const days = differenceInCalendarDays(now, anchor)
    let n = Math.floor(days / step)
    let occ = new Date(anchor)
    occ.setDate(anchor.getDate() + n * step)
    if (occ > now) {
      n -= 1
      occ = new Date(anchor)
      occ.setDate(anchor.getDate() + n * step)
    }
    return occ
  }
  // monthly
  let occ = anchor
  for (let i = 1; i < 1200; i++) {
    const next = addMonths(anchor, i)
    if (next > now) break
    occ = next
  }
  return occ
}

/** Next occurrence strictly after `now`, or null for a past one-off reminder. */
export function nextOccurrence(r: Reminder, now = new Date()): Date | null {
  const anchor = combineDateTime(r.date, r.time)
  if (anchor > now) return anchor
  if (r.repeat === "none") return null
  const latest = latestOccurrence(r, now) ?? anchor
  const next = new Date(latest)
  if (r.repeat === "daily") next.setDate(next.getDate() + 1)
  else if (r.repeat === "weekly") next.setDate(next.getDate() + 7)
  else return addMonths(latest, 1)
  return next
}

export type ReminderState = "upcoming" | "due" | "missed" | "done"

/** In-app status used for badges. "due" = fired within the last hour and not handled. */
export function reminderState(r: Reminder, now = new Date()): ReminderState {
  if (r.done) return "done"
  const latest = latestOccurrence(r, now)
  if (!latest) return "upcoming"
  if (r.repeat !== "none") return now.getTime() - latest.getTime() < 60 * 60 * 1000 ? "due" : "upcoming"
  return now.getTime() - latest.getTime() < 60 * 60 * 1000 ? "due" : "missed"
}

export function notificationSupport(): "unsupported" | NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported"
  return Notification.permission
}

export async function showReminderNotification(title: string, body?: string) {
  if (notificationSupport() !== "granted") return false
  const options: NotificationOptions = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: `lifekit-${title}`,
    data: { url: "/tools/reminders" },
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, options)
    else new Notification(title, options)
    return true
  } catch {
    return false
  }
}
