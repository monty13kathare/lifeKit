import type { FocusSession, FocusSettings, FocusTimerState } from "@/types"
import { createCollectionStore, createValueStore } from "./core"

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  dailyGoalMinutes: 120,
  sound: true,
}

export const IDLE_FOCUS_TIMER: FocusTimerState = {
  phase: "focus",
  status: "idle",
  durationMs: DEFAULT_FOCUS_SETTINGS.focusMinutes * 60_000,
  cycleCount: 0,
}

export const focusSessionsStore = createCollectionStore<FocusSession>("focus-sessions")
export const focusSettingsStore = createValueStore<FocusSettings>("focus-settings", DEFAULT_FOCUS_SETTINGS)
export const focusTimerStore = createValueStore<FocusTimerState>("focus-timer", IDLE_FOCUS_TIMER)
