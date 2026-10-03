/**
 * Focus (Pomodoro) timer engine. All state lives in `focusTimerStore`, so the
 * timer keeps running across pages and reloads; the global <FocusTicker />
 * calls `tickFocus()` to finish phases on time. UI only calls these actions.
 */
import { createId } from "@/lib/storage/core"
import { DEFAULT_FOCUS_SETTINGS, focusSessionsStore, focusSettingsStore, focusTimerStore, IDLE_FOCUS_TIMER } from "@/lib/storage/focus"
import { tasksStore } from "@/lib/storage/tasks"
import type { FocusPhase, FocusSettings, FocusTimerState } from "@/types"

export const PHASE_LABEL: Record<FocusPhase, string> = {
  focus: "Focus",
  "short-break": "Short break",
  "long-break": "Long break",
}

export function focusSettings(): FocusSettings {
  return { ...DEFAULT_FOCUS_SETTINGS, ...focusSettingsStore.get() }
}

export function phaseMinutes(phase: FocusPhase, s = focusSettings()): number {
  return phase === "focus" ? s.focusMinutes : phase === "short-break" ? s.shortBreakMinutes : s.longBreakMinutes
}

/** Milliseconds left in the current phase (full length when idle). */
export function remainingMs(state: FocusTimerState, now = Date.now()): number {
  if (state.status === "running" && state.endsAt) return Math.max(0, state.endsAt - now)
  if (state.status === "paused" && state.remainingMs != null) return state.remainingMs
  return state.durationMs
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

/** Start (or restart) a phase. Focus phases may be linked to a task. */
export function startFocus(opts: { phase?: FocusPhase; taskId?: string; label?: string } = {}) {
  const prev = focusTimerStore.get()
  const phase = opts.phase ?? prev.phase
  const durationMs = phaseMinutes(phase) * 60_000
  const taskId = phase === "focus" ? (opts.taskId ?? prev.taskId) : prev.taskId
  const label = opts.label ?? (taskId ? tasksStore.get().find((t) => t.id === taskId)?.title : prev.label)
  focusTimerStore.set({
    ...prev,
    phase,
    status: "running",
    durationMs,
    endsAt: Date.now() + durationMs,
    remainingMs: undefined,
    taskId,
    label,
  })
}

export function pauseFocus() {
  const s = focusTimerStore.get()
  if (s.status !== "running") return
  focusTimerStore.set({ ...s, status: "paused", remainingMs: remainingMs(s), endsAt: undefined })
}

export function resumeFocus() {
  const s = focusTimerStore.get()
  if (s.status !== "paused") return
  focusTimerStore.set({ ...s, status: "running", endsAt: Date.now() + (s.remainingMs ?? s.durationMs), remainingMs: undefined })
}

/** Link (or unlink) the current/next focus session to a task. */
export function setFocusTask(taskId: string | undefined) {
  const s = focusTimerStore.get()
  const label = taskId ? tasksStore.get().find((t) => t.id === taskId)?.title : undefined
  focusTimerStore.set({ ...s, taskId, label })
}

/** Stop early. Partial focus time of ≥1 minute is logged as an incomplete session. */
export function stopFocus() {
  const s = focusTimerStore.get()
  if (s.status === "idle") return
  const elapsed = s.durationMs - remainingMs(s)
  if (s.phase === "focus" && elapsed >= 60_000) logSession(s, elapsed, false)
  focusTimerStore.set({
    ...IDLE_FOCUS_TIMER,
    durationMs: phaseMinutes("focus") * 60_000,
    cycleCount: s.cycleCount,
    taskId: s.taskId,
    label: s.label,
  })
}

/** Skip to the next phase without logging the current one as complete. */
export function skipFocus() {
  const s = focusTimerStore.get()
  advance(s, false)
}

/** Reset the whole cycle (keeps the linked task). */
export function resetFocusCycle() {
  const s = focusTimerStore.get()
  focusTimerStore.set({ ...IDLE_FOCUS_TIMER, durationMs: phaseMinutes("focus") * 60_000, taskId: s.taskId, label: s.label })
}

/**
 * Called every second by <FocusTicker />. Returns the phase that just
 * finished (so the caller can notify), or null.
 */
export function tickFocus(now = Date.now()): { finished: FocusPhase; next: FocusPhase; label?: string } | null {
  const s = focusTimerStore.get()
  if (s.status !== "running" || !s.endsAt || now < s.endsAt) return null
  if (s.phase === "focus") logSession(s, s.durationMs, true)
  const next = advance(s, true)
  return { finished: s.phase, next, label: s.label }
}

function advance(s: FocusTimerState, finished: boolean): FocusPhase {
  const settings = focusSettings()
  let cycleCount = s.cycleCount
  let next: FocusPhase
  if (s.phase === "focus") {
    if (finished) cycleCount += 1
    next = cycleCount > 0 && cycleCount % settings.sessionsBeforeLongBreak === 0 ? "long-break" : "short-break"
  } else {
    if (s.phase === "long-break") cycleCount = 0
    next = "focus"
  }
  const durationMs = phaseMinutes(next, settings) * 60_000
  const autoStart = next === "focus" ? settings.autoStartFocus : settings.autoStartBreaks
  focusTimerStore.set({
    ...s,
    phase: next,
    cycleCount,
    durationMs,
    status: autoStart ? "running" : "idle",
    endsAt: autoStart ? Date.now() + durationMs : undefined,
    remainingMs: undefined,
  })
  return next
}

function logSession(s: FocusTimerState, elapsedMs: number, completed: boolean) {
  const minutes = Math.max(1, Math.round(elapsedMs / 60_000))
  const end = new Date()
  focusSessionsStore.add({
    id: createId(),
    phase: s.phase,
    taskId: s.taskId,
    label: s.label,
    startedAt: new Date(end.getTime() - elapsedMs).toISOString(),
    endedAt: end.toISOString(),
    minutes,
    completed,
  })
  if (s.taskId) tasksStore.update(s.taskId, (t) => ({ ...t, focusMinutes: (t.focusMinutes ?? 0) + minutes }))
}

/** A short two-tone chime via Web Audio (no audio files needed). */
export function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.type = "sine"
      const t = ctx.currentTime + i * 0.22
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.55)
    })
    setTimeout(() => void ctx.close(), 1500)
  } catch {
    /* audio unavailable — silently skip */
  }
}

/** Rename the current/next focus session (e.g. a custom label), even mid-session. */
export function setFocusLabel(label: string | undefined) {
  const s = focusTimerStore.get()
  focusTimerStore.set({ ...s, label: label?.trim() || undefined })
}

/** Choose the phase while idle (e.g. start a break manually). No-op while running/paused. */
export function setFocusPhase(phase: FocusPhase) {
  const s = focusTimerStore.get()
  if (s.status !== "idle") return
  focusTimerStore.set({ ...s, phase, durationMs: phaseMinutes(phase) * 60_000 })
}
