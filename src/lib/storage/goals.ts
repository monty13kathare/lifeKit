import type { Decision, Goal } from "@/types"
import { createCollectionStore } from "./core"

export const goalsStore = createCollectionStore<Goal>("goals")
export const decisionsStore = createCollectionStore<Decision>("decisions")
