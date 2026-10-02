"use client"

import { useState, useSyncExternalStore } from "react"
import { BellOff, BellRing, Info } from "lucide-react"
import { toast } from "sonner"
import { Notice, UnsupportedNotice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useHydrated } from "@/hooks/use-store"
import { notificationSupport, showReminderNotification } from "@/lib/reminders"
import { cn } from "@/lib/utils"

/** Re-render when the browser reports a permission change (where the Permissions API supports it). */
function subscribePermission(cb: () => void) {
  let status: PermissionStatus | null = null
  let cancelled = false
  navigator.permissions
    ?.query({ name: "notifications" as PermissionName })
    .then((s) => {
      if (cancelled) return
      status = s
      s.addEventListener("change", cb)
    })
    .catch(() => {})
  return () => {
    cancelled = true
    status?.removeEventListener("change", cb)
  }
}
const serverPermission = () => "default" as const

function isIosBrowserTab() {
  if (typeof navigator === "undefined") return false
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia("(display-mode: standalone)").matches
  return ios && !standalone
}

const STATUS = {
  granted: { label: "Allowed", className: "bg-success/12 text-success" },
  denied: { label: "Blocked", className: "bg-destructive/12 text-destructive" },
  default: { label: "Not enabled", className: "bg-warning/15 text-warning-foreground dark:text-warning" },
  unsupported: { label: "Not supported", className: "bg-surface-muted text-muted-foreground" },
} as const

export function NotificationCard() {
  const hydrated = useHydrated()
  const permission = useSyncExternalStore(subscribePermission, notificationSupport, serverPermission)
  const [, setTick] = useState(0)
  const [busy, setBusy] = useState(false)

  const enable = async () => {
    if (!("Notification" in window)) return
    setBusy(true)
    try {
      const result = await Notification.requestPermission()
      if (result === "granted") toast.success("Notifications enabled")
      else if (result === "denied") toast.error("Notifications were blocked", { description: "You can change this in your browser's site settings." })
      else toast("Permission not granted", { description: "You'll still see in-app reminders while LifeKit is open." })
    } catch {
      toast.error("Couldn't request notification permission")
    } finally {
      setBusy(false)
      setTick((t) => t + 1)
    }
  }

  const test = async () => {
    const shown = await showReminderNotification("LifeKit test reminder", "Notifications are working.")
    if (shown) toast.success("Test notification sent", { description: "If you don't see it, check your system's Do Not Disturb settings." })
    else toast("This is how an in-app reminder looks", { description: "Browser notifications aren't enabled, so only in-app toasts will appear." })
  }

  if (!hydrated) return <Skeleton className="h-48 w-full rounded-2xl" />

  const status = STATUS[permission]

  return (
    <section aria-labelledby="notif-heading" className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {permission === "denied" || permission === "unsupported" ? <BellOff className="size-5" aria-hidden /> : <BellRing className="size-5" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="notif-heading" className="font-semibold">
            Browser notifications
          </h2>
          <p className="mt-1 text-sm">
            Status:{" "}
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", status.className)} aria-live="polite">
              {status.label}
            </span>
          </p>
        </div>
      </div>

      {permission === "unsupported" ? (
        <UnsupportedNotice
          feature="notifications"
          alternative="Reminders will still appear as in-app alerts while LifeKit is open."
        />
      ) : permission === "denied" ? (
        <Notice tone="warning" title="Notifications are blocked for this site">
          To turn them back on, open your browser&apos;s site settings for LifeKit and allow notifications, then reload.
        </Notice>
      ) : null}

      {isIosBrowserTab() && permission !== "granted" ? (
        <Notice tone="info">On iPhone and iPad, add LifeKit to your Home Screen first (iOS 16.4 or later) to allow notifications.</Notice>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {permission === "default" ? (
          <Button onClick={enable} disabled={busy}>
            <BellRing aria-hidden /> {busy ? "Waiting for permission…" : "Enable notifications"}
          </Button>
        ) : null}
        {permission !== "unsupported" ? (
          <Button variant="outline" onClick={test}>
            Send test notification
          </Button>
        ) : null}
      </div>

      <div className="flex gap-2 rounded-xl bg-surface-muted p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          Reminders fire while LifeKit is open (or in a background tab). Browser notification reliability depends on your browser&apos;s
          permissions and platform — closed apps and some mobile browsers may not deliver them on time. There&apos;s no server to send push
          notifications in this version.
        </p>
      </div>
    </section>
  )
}
