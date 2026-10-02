import type { Note } from "@/types"
import { createCollectionStore, createId } from "./core"

export const notesStore = createCollectionStore<Note>("notes")

/** Convenience used by OCR / Voice to Text "Save to notes" actions. */
export function saveNote(content: string, source: Note["source"], title?: string): Note {
  const now = new Date().toISOString()
  const firstLine = content.trim().split("\n")[0]?.slice(0, 60) || "Untitled note"
  return notesStore.add({
    id: createId(),
    title: title ?? firstLine,
    content,
    source,
    createdAt: now,
    updatedAt: now,
  })
}
