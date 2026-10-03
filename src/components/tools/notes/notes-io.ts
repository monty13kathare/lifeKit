import { format } from "date-fns"
import { z } from "zod"
import type { EventColor, Note } from "@/types"
import { MAX_TAGS, normalizeTag, noteDisplayTitle } from "./note-utils"

/** Max size of a backup file we will try to read. */
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024

const BACKUP_KIND = "lifekit-notes"
const BACKUP_VERSION = 1

const COLORS = ["indigo", "sky", "emerald", "amber", "rose", "violet", "slate"] as const satisfies readonly EventColor[]

const isoString = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date")

const noteSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().max(1000).default(""),
  content: z.string().max(1_000_000).default(""),
  source: z.enum(["manual", "ocr", "voice"]).catch("manual"),
  createdAt: isoString,
  updatedAt: isoString,
  pinned: z.boolean().optional().catch(undefined),
  color: z.enum(COLORS).optional().catch(undefined),
  tags: z.array(z.string()).optional().catch(undefined),
})

const backupSchema = z.union([
  z.object({ kind: z.literal(BACKUP_KIND), version: z.number(), notes: z.array(z.unknown()) }),
  z.array(z.unknown()),
])

export function buildNotesBackup(notes: Note[]): string {
  const clean = notes.map(({ demo, ...rest }) => (void demo, rest))
  return JSON.stringify({ kind: BACKUP_KIND, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), notes: clean }, null, 2)
}

export function buildNotesText(notes: Note[]): string {
  const divider = "\n\n" + "-".repeat(40) + "\n\n"
  return notes
    .map((n) => {
      const meta = [
        `Edited ${format(new Date(n.updatedAt), "yyyy-MM-dd HH:mm")}`,
        n.tags?.length ? `Tags: ${n.tags.join(", ")}` : "",
        n.pinned ? "Pinned" : "",
      ]
        .filter(Boolean)
        .join(" · ")
      return `${noteDisplayTitle(n)}\n${meta}\n\n${n.content}`.trimEnd()
    })
    .join(divider)
}

export const backupFileName = (ext: "json" | "txt") => `lifekit-notes-${format(new Date(), "yyyy-MM-dd")}.${ext}`

export interface ImportResult {
  notes: Note[]
  invalid: number
}

/** Parse a LifeKit notes backup. Throws an Error with a friendly message if the file isn't one. */
export function parseNotesBackup(text: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  const shape = backupSchema.safeParse(data)
  if (!shape.success) throw new Error("That file isn't a LifeKit notes backup.")
  const raw = Array.isArray(shape.data) ? shape.data : shape.data.notes

  const notes: Note[] = []
  let invalid = 0
  for (const item of raw) {
    const parsed = noteSchema.safeParse(item)
    if (!parsed.success) {
      invalid++
      continue
    }
    const { pinned, color, tags, ...rest } = parsed.data
    const cleanTags = [...new Set((tags ?? []).map(normalizeTag).filter(Boolean))].slice(0, MAX_TAGS)
    notes.push({
      ...rest,
      ...(pinned ? { pinned } : {}),
      ...(color ? { color } : {}),
      ...(cleanTags.length ? { tags: cleanTags } : {}),
    })
  }
  if (raw.length > 0 && notes.length === 0) throw new Error("No valid notes were found in that file.")
  return { notes, invalid }
}
