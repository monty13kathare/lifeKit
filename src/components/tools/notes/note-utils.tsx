import { FileText, Mic, ScanText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EventColor, Note } from "@/types"

export const SOURCE_META: Record<Note["source"], { label: string; icon: typeof FileText; className: string }> = {
  manual: { label: "Manual", icon: FileText, className: "bg-surface-muted text-muted-foreground" },
  ocr: { label: "OCR", icon: ScanText, className: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300" },
  voice: { label: "Voice", icon: Mic, className: "bg-violet-500/12 text-violet-700 dark:bg-violet-400/20 dark:text-violet-300" },
}

export function SourceBadge({ source, className }: { source: Note["source"]; className?: string }) {
  const meta = SOURCE_META[source] ?? SOURCE_META.manual
  const Icon = meta.icon
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium", meta.className, className)}>
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  )
}

export const noteDisplayTitle = (n: Pick<Note, "title" | "content">) =>
  n.title.trim() || n.content.trim().split("\n")[0]?.slice(0, 80) || "Untitled note"

export const noteText = (n: Pick<Note, "title" | "content">) => (n.title.trim() ? `${n.title.trim()}\n\n${n.content}` : n.content)

export function noteFileName(n: Pick<Note, "title" | "content">) {
  const base = noteDisplayTitle(n)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return `${base || "note"}.txt`
}

export const isBlank = (n: Pick<Note, "title" | "content">) => !n.title.trim() && !n.content.trim()

/* ---------------------------------------------------------------- Colours */

/** Literal Tailwind classes per colour label (so Tailwind picks them up). */
export const NOTE_COLORS: Record<EventColor, { label: string; swatch: string; edge: string }> = {
  indigo: { label: "Indigo", swatch: "bg-indigo-500", edge: "border-l-indigo-500" },
  sky: { label: "Sky", swatch: "bg-sky-500", edge: "border-l-sky-500" },
  emerald: { label: "Emerald", swatch: "bg-emerald-500", edge: "border-l-emerald-500" },
  amber: { label: "Amber", swatch: "bg-amber-500", edge: "border-l-amber-500" },
  rose: { label: "Rose", swatch: "bg-rose-500", edge: "border-l-rose-500" },
  violet: { label: "Violet", swatch: "bg-violet-500", edge: "border-l-violet-500" },
  slate: { label: "Slate", swatch: "bg-slate-500", edge: "border-l-slate-500" },
}

export const NOTE_COLOR_KEYS = Object.keys(NOTE_COLORS) as EventColor[]

export function ColorDot({ color, className }: { color?: EventColor; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3 shrink-0 rounded-full",
        color ? NOTE_COLORS[color]?.swatch : "border border-dashed border-muted-foreground/60",
        className
      )}
    />
  )
}

/* ------------------------------------------------------------------- Tags */

export const MAX_TAGS = 20
export const MAX_TAG_LENGTH = 30

/** Trim, collapse whitespace, strip a leading "#", clamp length. */
export const normalizeTag = (raw: string) =>
  raw.replace(/^#+/, "").replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LENGTH)

export const hasTag = (tags: string[] | undefined, tag: string) =>
  !!tags?.some((t) => t.toLowerCase() === tag.toLowerCase())

/** All distinct tags across notes, most used first. */
export function collectTags(notes: Pick<Note, "tags">[]): string[] {
  const counts = new Map<string, { label: string; count: number }>()
  for (const n of notes) {
    for (const t of n.tags ?? []) {
      const key = t.toLowerCase()
      const entry = counts.get(key)
      if (entry) entry.count++
      else counts.set(key, { label: t, count: 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).map((e) => e.label)
}

/* -------------------------------------------------------------- Checklist */

const CHECKLIST_RE = /^(\s*)- \[( |x|X)\](?: (.*))?$/

export interface ChecklistItem {
  /** Index of the line in the note content. */
  line: number
  checked: boolean
  text: string
}

export function parseChecklist(content: string): ChecklistItem[] {
  const items: ChecklistItem[] = []
  content.split("\n").forEach((raw, line) => {
    const m = CHECKLIST_RE.exec(raw)
    if (m) items.push({ line, checked: m[2] !== " ", text: (m[3] ?? "").trim() })
  })
  return items
}

/** Flip the checkbox on one line, leaving everything else untouched. */
export function toggleChecklistLine(content: string, line: number): string {
  const lines = content.split("\n")
  const m = CHECKLIST_RE.exec(lines[line] ?? "")
  if (!m) return content
  const mark = m[2] === " " ? "x" : " "
  lines[line] = `${m[1]}- [${mark}]${m[3] !== undefined ? ` ${m[3]}` : ""}`
  return lines.join("\n")
}

/* ------------------------------------------------------------------- Sort */

export type NoteSort = "updated" | "created" | "title"

export const SORT_ITEMS: { value: NoteSort; label: string }[] = [
  { value: "updated", label: "Last edited" },
  { value: "created", label: "Created" },
  { value: "title", label: "Title" },
]

export function compareNotes(sort: NoteSort) {
  return (a: Note, b: Note) => {
    if (sort === "created") return b.createdAt.localeCompare(a.createdAt)
    if (sort === "title") return noteDisplayTitle(a).localeCompare(noteDisplayTitle(b), undefined, { sensitivity: "base", numeric: true })
    return b.updatedAt.localeCompare(a.updatedAt)
  }
}
