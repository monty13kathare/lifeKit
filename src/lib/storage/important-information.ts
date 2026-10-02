import type { ImportantInfo } from "@/types"
import { createCollectionStore } from "./core"

export const importantInfoStore = createCollectionStore<ImportantInfo>("important-information")
