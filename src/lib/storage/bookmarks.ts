import type { Bookmark } from "@/types"
import { createCollectionStore } from "./core"

export const bookmarksStore = createCollectionStore<Bookmark>("bookmarks")
