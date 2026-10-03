"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { latestOccurrence, showReminderNotification } from "@/lib/reminders"
import { format } from "date-fns"
import { expandEvents } from "@/lib/dates"
import { eventsStore, remindersStore } from "@/lib/storage"

const CHECK_INTERVAL = 20_000
/** Don't fire notifications for occurrences older than this (e.g. app was closed for days). */
const STALE_AFTER = 12 * 60 * 60 * 1000

/**
 * Checks local reminders while LifeKit is open and fires an in-app toast plus a
 * browser notification (when permitted). Browsers do not run this while the
 * app is fully closed — the Reminders page explains that limitation.
 */
export function ReminderScheduler() {
  useEffect(() => {
    const check = () => {
      const now = new Date()
      for (const r of remindersStore.get()) {
        if (r.done) continue
        const occ = latestOccurrence(r, now)
        if (!occ) continue
        const occIso = occ.toISOString()
        if (r.lastFiredFor === occIso) continue
        if (now.getTime() - occ.getTime() > STALE_AFTER) {
          remindersStore.update(r.id, { lastFiredFor: occIso })
          continue
        }
        remindersStore.update(r.id, { lastFiredFor: occIso })
        toast(r.title, { description: r.notes || "Reminder", duration: 10_000 })
        void showReminderNotification(r.title, r.notes)
      }
      checkEventAlerts(now)
    }
    check()
    const id = window.setInterval(check, CHECK_INTERVAL)
    const onVisible = () => document.visibilityState === "visible" && check()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])
  return null
}

/** Calendar events with `alertMinutes` notify that many minutes before each occurrence. */
function checkEventAlerts(now: Date) {
  const events = eventsStore.get().filter((e) => e.alertMinutes != null && e.alertMinutes >= 0)
  if (!events.length) return
  // Look ahead far enough for the largest alert lead time (max one day).
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 60_000)
  for (const occ of expandEvents(events, new Date(now.getTime() - 60 * 60 * 1000), horizon)) {
    const ev = occ.event
    const lead = (ev.alertMinutes ?? 0) * 60_000
    const alertAt = occ.start.getTime() - lead
    const occIso = occ.start.toISOString()
    // Fire once per occurrence, within a window from the alert time until the event starts (+5 min grace).
    if (now.getTime() < alertAt || now.getTime() > occ.start.getTime() + 5 * 60_000) continue
    if (ev.lastAlertedFor && ev.lastAlertedFor >= occIso) continue
    eventsStore.update(ev.id, { lastAlertedFor: occIso })
    const minsLeft = Math.round((occ.start.getTime() - now.getTime()) / 60_000)
    const when = minsLeft > 0 ? `in ${formatLead(minsLeft)}` : "now"
    const body = `${ev.allDay ? "All day" : `Starts ${when} · ${format(occ.start, "h:mm a")}`}${ev.location ? ` · ${ev.location}` : ""}`
    toast(ev.title, { description: body, duration: 10_000 })
    void showReminderNotification(ev.title, body, "/tools/calendar")
  }
}

function formatLead(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.round(minutes / 60)} h`
  return "1 day"
}
