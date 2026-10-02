import type { CalendarEvent } from "@/types"
import { createCollectionStore } from "./core"

export const eventsStore = createCollectionStore<CalendarEvent>("events")
