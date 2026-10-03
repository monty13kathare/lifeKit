import type { Metadata } from "next"
import { NotesApp } from "@/components/tools/notes/notes-app"

export const metadata: Metadata = {
  title: "Notes",
  description: "Quick notes with autosave, pins, colours, tags, checklists, search and backup — stored in your browser.",
}

export default function NotesPage() {
  return <NotesApp />
}
