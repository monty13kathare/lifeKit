import type { Reminder } from "@/types"
import { createCollectionStore } from "./core"

export const remindersStore = createCollectionStore<Reminder>("reminders")
