import type { RoutineItem } from "@/types"
import { createCollectionStore } from "./core"

export const routinesStore = createCollectionStore<RoutineItem>("routines")
