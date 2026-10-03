import type { HealthInsight, HealthProfile, WellnessDay, WellnessGoals } from "@/types"
import { createCollectionStore, createValueStore } from "./core"

export const wellnessDaysStore = createCollectionStore<WellnessDay>("wellness-days")

export const DEFAULT_WELLNESS_GOALS: WellnessGoals = {
  waterGlasses: 8,
  steps: 8000,
  exerciseMinutes: 30,
  sleepHours: 8,
  habits: [
    { id: "meditate", name: "Meditate" },
    { id: "read", name: "Read 10 pages" },
    { id: "no-sugar", name: "No added sugar" },
  ],
}

export const wellnessGoalsStore = createValueStore<WellnessGoals>("wellness-goals", DEFAULT_WELLNESS_GOALS)

export function emptyWellnessDay(date: string): WellnessDay {
  return {
    id: date,
    waterGlasses: 0,
    steps: 0,
    exerciseMinutes: 0,
    sleepHours: 0,
    meals: "",
    journal: "",
    habits: {},
  }
}

export const DEFAULT_HEALTH_PROFILE: HealthProfile = {
  activity: "light",
  goal: "maintain",
  weightLog: [],
}

export const healthProfileStore = createValueStore<HealthProfile>("health-profile", DEFAULT_HEALTH_PROFILE)

/** Saved AI health checks, newest first (capped by the UI). */
export const healthInsightsStore = createCollectionStore<HealthInsight>("health-insights")
