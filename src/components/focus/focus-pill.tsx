"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Coffee, Pause, Timer } from "lucide-react"
import { useFocus } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { formatClock, PHASE_LABEL, remainingMs } from "@/lib/focus"
import { cn } from "@/lib/utils"

/** Header indicator while a Focus timer runs elsewhere in the app. */
export function FocusPill() {
  const hydrated = useHydrated()
  const pathname = usePathname()
  const { timer } = useFocus()
  const [, setTick] = useState(0)
  const active = hydrated && timer.status !== "idle"

  useEffect(() => {
    if (!active || timer.status !== "running") return
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [active, timer.status])

  if (!active || pathname.startsWith("/tools/focus")) return null
  const isBreak = timer.phase !== "focus"
  const Icon = timer.status === "paused" ? Pause : isBreak ? Coffee : Timer

  return (
    <Link
      href="/tools/focus"
      aria-label={`${PHASE_LABEL[timer.phase]} ${timer.status === "paused" ? "paused" : "running"}, ${formatClock(remainingMs(timer))} left. Open Focus timer`}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold tabular-nums transition-colors",
        isBreak ? "bg-success/12 text-success hover:bg-success/20" : "bg-primary/10 text-primary hover:bg-primary/15",
        timer.status === "paused" && "opacity-75"
      )}
    >
      <Icon className="size-4" aria-hidden />
      {formatClock(remainingMs(timer))}
    </Link>
  )
}
