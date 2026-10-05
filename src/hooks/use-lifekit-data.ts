"use client"

import { useMemo } from "react"
import {
  bookmarksStore,
  decisionsStore,
  goalsStore,
  eventsStore,
  DEFAULT_SETTINGS,
  notesStore,
  remindersStore,
  routinesStore,
  settingsStore,
  tasksStore,
  wellnessDaysStore,
  wellnessGoalsStore,
  DEFAULT_HEALTH_PROFILE,
  healthInsightsStore,
  healthProfileStore,
  healthPlanStore,
  DEFAULT_FUN_STATS,
  funQuizSetsStore,
  funStatsStore,
  learnLessonsStore,
} from "@/lib/storage"
import type { HealthProfile, Settings } from "@/types"

import { useStore } from "./use-store"

/*
 * Domain hooks. Each returns the live data plus the store's mutation API, so
 * components never touch persistence directly:
 *
 *   const { tasks, add, update, remove } = useTasks()
 */

export function useTasks() {
  const tasks = useStore(tasksStore)
  return { tasks, ...pickMutations(tasksStore) }
}

export function useRoutines() {
  const routines = useStore(routinesStore)
  return { routines, ...pickMutations(routinesStore) }
}

export function useCalendar() {
  const events = useStore(eventsStore)
  return { events, ...pickMutations(eventsStore) }
}

export function useReminders() {
  const reminders = useStore(remindersStore)
  return { reminders, ...pickMutations(remindersStore) }
}

export function useNotes() {
  const notes = useStore(notesStore)
  return { notes, ...pickMutations(notesStore) }
}

export function useBookmarks() {
  const bookmarks = useStore(bookmarksStore)
  return { bookmarks, ...pickMutations(bookmarksStore) }
}



export function useWellness() {
  const days = useStore(wellnessDaysStore)
  const goals = useStore(wellnessGoalsStore)
  const storedProfile = useStore(healthProfileStore)
  const profile = useMemo(() => ({ ...DEFAULT_HEALTH_PROFILE, ...storedProfile }), [storedProfile])
  const insights = useStore(healthInsightsStore)
  const plan = useStore(healthPlanStore)
  return {
    days,
    goals,
    setGoals: wellnessGoalsStore.set,
    upsertDay: wellnessDaysStore.upsert,
    removeDay: wellnessDaysStore.remove,
    profile,
    setProfile: (patch: Partial<HealthProfile>) =>
      healthProfileStore.set((prev) => ({ ...DEFAULT_HEALTH_PROFILE, ...prev, ...patch, updatedAt: new Date().toISOString() })),
    insights,
    addInsight: healthInsightsStore.add,
    removeInsight: healthInsightsStore.remove,
    plan,
    setPlan: healthPlanStore.set,
  }
}

export function useSettings() {
  const stored = useStore(settingsStore)
  // Merge with defaults so settings saved by older versions gain new fields.
  const settings = useMemo<Settings>(
    () => ({
      ...DEFAULT_SETTINGS,
      ...stored,
      dashboard: {
        ...DEFAULT_SETTINGS.dashboard,
        ...stored.dashboard,
        todayWidgets: { ...DEFAULT_SETTINGS.dashboard.todayWidgets, ...stored.dashboard?.todayWidgets },
      },
    }),
    [stored]
  )
  const update = (patch: Partial<Settings>) => settingsStore.set((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...patch }))
  return { settings, update }
}

function pickMutations<S extends { add: unknown; update: unknown; remove: unknown; upsert: unknown; set: unknown }>(store: S) {
  return { add: store.add, update: store.update, remove: store.remove, upsert: store.upsert, set: store.set } as Pick<S, "add" | "update" | "remove" | "upsert" | "set">
}




export function useGoals() {
  const goals = useStore(goalsStore)
  return { goals, ...pickMutations(goalsStore) }
}

export function useDecisions() {
  const decisions = useStore(decisionsStore)
  return { decisions, ...pickMutations(decisionsStore) }
}

export function useLearnFun() {
  const stored = useStore(funStatsStore)
  const stats = useMemo(() => ({ ...DEFAULT_FUN_STATS, ...stored }), [stored])
  const quizzes = useStore(funQuizSetsStore)
  return { stats, resetStats: funStatsStore.reset, quizzes, ...pickMutations(funQuizSetsStore) }
}

export function useLessons() {
  const lessons = useStore(learnLessonsStore)
  return { lessons, ...pickMutations(learnLessonsStore) }
}
