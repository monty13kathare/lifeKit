"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { focusSettings, PHASE_LABEL, playChime, tickFocus } from "@/lib/focus"
import { showReminderNotification } from "@/lib/reminders"

/**
 * Finishes Focus timer phases on time from anywhere in the app (mounted once
 * in providers), then chimes, toasts and sends a browser notification when
 * permitted.
 */
export function FocusTicker() {
  useEffect(() => {
    const id = window.setInterval(() => {
      const done = tickFocus()
      if (!done) return
      const title = done.finished === "focus" ? "Focus session complete" : "Break's over"
      const body =
        done.finished === "focus"
          ? `${done.label ? `“${done.label}” · ` : ""}Time for a ${PHASE_LABEL[done.next].toLowerCase()}.`
          : "Ready for the next focus session?"
      if (focusSettings().sound) playChime()
      toast.success(title, { description: body, duration: 8000 })
      void showReminderNotification(title, body, "/tools/focus")
    }, 1000)
    return () => window.clearInterval(id)
  }, [])
  return null
}
