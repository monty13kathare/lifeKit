"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { BellRing, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useFocus } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { notificationSupport } from "@/lib/reminders"
import { FocusSettingsSheet } from "./focus-settings-sheet"
import { FocusStats } from "./focus-stats"
import { TaskLink } from "./task-link"
import { TimerPanel } from "./timer-panel"

/** Header action: opens the timer settings sheet. */
export function FocusSettingsButton() {
  const [open, setOpen] = useState(false)
  const { settings, updateSettings } = useFocus()
  return (
    <>
      <Button variant="outline" size="icon" aria-label="Timer settings" onClick={() => setOpen(true)}>
        <Settings2 aria-hidden />
      </Button>
      <FocusSettingsSheet open={open} onOpenChange={setOpen} settings={settings} onChange={updateSettings} />
    </>
  )
}

export function FocusTimer() {
  const hydrated = useHydrated()
  if (!hydrated) return <FocusSkeleton />
  return <FocusTimerInner />
}

function FocusTimerInner() {
  const { timer, settings } = useFocus()
  const [customMode, setCustomMode] = useState(() => !timer.taskId && !!timer.label)
  // Raw input text (the store keeps the trimmed label via setFocusLabel).
  const [customLabel, setCustomLabel] = useState(() => (!timer.taskId && timer.label) || "")

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-6"
    >
      <div className="space-y-4 lg:sticky lg:top-20">
        <TimerPanel timer={timer} settings={settings} />
        <TaskLink
          timer={timer}
          customMode={customMode}
          onCustomModeChange={setCustomMode}
          customLabel={customLabel}
          onCustomLabelChange={setCustomLabel}
        />
        <NotificationHint />
      </div>
      <FocusStats />
    </motion.div>
  )
}

function NotificationHint() {
  const [permission, setPermission] = useState(() => notificationSupport())
  const [busy, setBusy] = useState(false)
  if (permission !== "default") return null

  const enable = async () => {
    setBusy(true)
    try {
      const result = await Notification.requestPermission()
      if (result === "granted") toast.success("Notifications enabled")
      else if (result === "denied") toast.error("Notifications were blocked", { description: "You can change this in your browser's site settings." })
    } catch {
      toast.error("Couldn't request notification permission")
    } finally {
      setBusy(false)
      setPermission(notificationSupport())
    }
  }

  return (
    <Notice
      icon={BellRing}
      title="Get alerted when a session ends"
      action={
        <Button size="sm" variant="outline" onClick={enable} disabled={busy}>
          Enable notifications
        </Button>
      }
    >
      Allow notifications so the timer can let you know when a focus session or break finishes, even in another tab.
    </Notice>
  )
}

function FocusSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-6" aria-busy aria-label="Loading focus timer">
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-4 sm:p-6">
          <Skeleton className="h-10 w-64 rounded-full" />
          <Skeleton className="aspect-square w-full max-w-60 rounded-full sm:max-w-72" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-12 w-full max-w-sm rounded-lg" />
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
    </div>
  )
}
