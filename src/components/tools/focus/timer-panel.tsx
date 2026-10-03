"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play, SkipForward, Square } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  formatClock,
  PHASE_LABEL,
  pauseFocus,
  phaseMinutes,
  remainingMs,
  resumeFocus,
  setFocusPhase,
  skipFocus,
  startFocus,
  stopFocus,
} from "@/lib/focus"
import { cn } from "@/lib/utils"
import type { FocusPhase, FocusSettings, FocusTimerState } from "@/types"

const PHASES: FocusPhase[] = ["focus", "short-break", "long-break"]

interface TimerPanelProps {
  timer: FocusTimerState
  settings: FocusSettings
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  return !!el.closest(
    "input, textarea, select, button, a, [role='button'], [role='combobox'], [role='checkbox'], [role='switch'], [role='slider'], [role='option'], [role='menuitem'], [role='dialog'], [role='alertdialog']"
  )
}

export function TimerPanel({ timer, settings }: TimerPanelProps) {
  const [, setTick] = useState(0)
  const [confirmStop, setConfirmStop] = useState(false)

  const idle = timer.status === "idle"
  const running = timer.status === "running"
  const phase: FocusPhase = timer.phase
  const isBreak = phase !== "focus"
  const durationMs = idle ? phaseMinutes(phase, settings) * 60_000 : timer.durationMs
  const leftMs = idle ? durationMs : remainingMs(timer)
  const progress = durationMs > 0 ? 1 - leftMs / durationMs : 0
  const clock = formatClock(leftMs)
  const elapsedMs = timer.durationMs - remainingMs(timer)
  const elapsedMin = Math.max(1, Math.round(elapsedMs / 60_000))

  // Re-render a few times a second while running; the engine owns the timing.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setTick((t) => t + 1), 250)
    return () => window.clearInterval(id)
  }, [running])

  // Tab title while active; restore on unmount.
  const originalTitle = useRef<string | null>(null)
  useEffect(() => {
    if (originalTitle.current === null) originalTitle.current = document.title
  }, [])
  useEffect(() => {
    if (originalTitle.current === null) return
    document.title = idle
      ? originalTitle.current
      : `${running ? "" : "Paused · "}${clock} · ${PHASE_LABEL[timer.phase]} — LifeKit`
  }, [idle, running, clock, timer.phase])
  useEffect(
    () => () => {
      if (originalTitle.current !== null) document.title = originalTitle.current
    },
    []
  )

  const start = () => {
    startFocus({ phase })
  }

  const requestStop = () => {
    if (timer.phase === "focus" && elapsedMs > 60_000) setConfirmStop(true)
    else stopFocus()
  }

  const toggle = () => {
    if (running) pauseFocus()
    else if (timer.status === "paused") resumeFocus()
    else start()
  }

  // Space toggles start/pause (not while typing or on a focused control).
  const toggleRef = useRef(toggle)
  useEffect(() => {
    toggleRef.current = toggle
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      if (isTypingTarget(e.target) || document.querySelector("[role='dialog'], [role='alertdialog']")) return
      e.preventDefault()
      toggleRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const n = Math.max(1, settings.sessionsBeforeLongBreak)
  const filled = Math.min(timer.cycleCount, n)
  const statusText = idle ? "Ready" : running ? "Running" : "Paused"

  return (
    <section aria-label="Timer" className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-6">
      {idle ? (
        <div role="radiogroup" aria-label="Phase" className="flex w-full flex-wrap justify-center gap-1.5">
          {PHASES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={phase === p}
              onClick={() => setFocusPhase(p)}
              className={cn(
                "h-10 rounded-full px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                phase === p
                  ? p === "focus"
                    ? "bg-primary/12 text-primary"
                    : "bg-success/12 text-success"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {PHASE_LABEL[p]}
            </button>
          ))}
        </div>
      ) : (
        <p
          className={cn(
            "inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold",
            isBreak ? "bg-success/12 text-success" : "bg-primary/12 text-primary"
          )}
        >
          {PHASE_LABEL[phase]}
          {timer.status === "paused" ? " · Paused" : ""}
        </p>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic>
        {`${PHASE_LABEL[phase]}: ${statusText}`}
      </p>

      <div className={cn("relative aspect-square w-full max-w-60 sm:max-w-72", timer.status === "paused" && "opacity-85")}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--muted)" strokeWidth="5" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={isBreak ? "var(--success)" : "var(--primary)"}
            strokeWidth="5"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={100 * (1 - Math.max(0, Math.min(1, progress)))}
            className="transition-[stroke-dashoffset,stroke] duration-300 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            role="timer"
            aria-label={`${clock} remaining`}
            className="text-[3.5rem] leading-none font-semibold tracking-tight tabular-nums sm:text-6xl"
          >
            {clock}
          </span>
          <span className="mt-2 text-sm text-muted-foreground">
            {idle ? `${phaseMinutes(phase, settings)} min` : statusText}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: n }, (_, i) => (
            <span
              key={i}
              className={cn(
                "size-2.5 rounded-full transition-colors",
                i < filled ? "bg-primary" : i === filled && timer.phase === "focus" && !idle ? "bg-primary/40" : "bg-muted"
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {filled >= n
            ? "Long break earned"
            : `${filled} of ${n} sessions until a long break`}
        </p>
      </div>

      <div className="flex w-full max-w-sm items-center justify-center gap-2">
        {idle ? (
          <Button size="lg" className="h-12 flex-1 text-base" onClick={start}>
            <Play className="size-5" aria-hidden />
            Start {PHASE_LABEL[phase].toLowerCase()}
          </Button>
        ) : (
          <>
            <Button variant="outline" size="icon-lg" onClick={requestStop} aria-label="Stop">
              <Square className="size-5" aria-hidden />
            </Button>
            <Button size="lg" className="h-12 flex-1 text-base" onClick={toggle}>
              {running ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
              {running ? "Pause" : "Resume"}
            </Button>
            <Button variant="outline" size="icon-lg" onClick={skipFocus} aria-label={`Skip ${PHASE_LABEL[timer.phase].toLowerCase()}`}>
              <SkipForward className="size-5" aria-hidden />
            </Button>
          </>
        )}
      </div>
      {idle && timer.phase !== "focus" ? (
        <Button variant="ghost" size="sm" onClick={skipFocus}>
          <SkipForward aria-hidden />
          Skip break
        </Button>
      ) : null}
      <p className="hidden text-xs text-muted-foreground sm:block">
        Press <kbd className="rounded border bg-surface-muted px-1.5 py-0.5 font-mono text-[0.7rem]">Space</kbd> to start or pause
      </p>

      <AlertDialog open={confirmStop} onOpenChange={setConfirmStop}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop and log {elapsedMin} min?</AlertDialogTitle>
            <AlertDialogDescription>
              This session will be saved as stopped early
              {timer.label ? ` for “${timer.label}”` : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                stopFocus()
                setConfirmStop(false)
              }}
            >
              Stop and log
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
