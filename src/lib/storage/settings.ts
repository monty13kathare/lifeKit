import type { Settings } from "@/types"
import { createValueStore } from "./core"

export const DEFAULT_SETTINGS: Settings = {
  displayName: "",
  dashboard: {
    showQuickTools: true,
    showToday: true,
    showCategories: true,
    todayWidgets: { tasks: true, routine: true, events: true, wellness: true },
  },
  installPromptDismissed: false,
  seeded: false,
  currency: "₹",
  aiLanguage: "en",
}

export const settingsStore = createValueStore<Settings>("settings", DEFAULT_SETTINGS)
