import type { Task } from "@/types"
import { createCollectionStore } from "./core"

export const tasksStore = createCollectionStore<Task>("tasks")
