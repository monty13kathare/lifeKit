"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { latestOccurrence, showReminderNotification } from "@/lib/reminders"
import { remindersStore } from "@/lib/storage"

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
