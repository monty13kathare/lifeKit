"use client"

import { useId } from "react"
import { ListChecks } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { ChecklistItem } from "./note-utils"

interface NoteChecklistProps {
  items: ChecklistItem[]
  onToggle: (line: number) => void
}

/** Tickable preview of the note's `- [ ]` / `- [x]` lines. Rendered as plain React text — no HTML. */
export function NoteChecklist({ items, onToggle }: NoteChecklistProps) {
  const headingId = useId()
  if (items.length === 0) return null
  const done = items.filter((i) => i.checked).length

  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-surface-muted/60 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 id={headingId} className="flex items-center gap-1.5 text-sm font-medium">
          <ListChecks className="size-4 text-primary" aria-hidden /> Checklist
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {done}/{items.length} done
        </span>
      </div>
      <ul className="max-h-56 space-y-0.5 overflow-y-auto">
        {items.map((item) => (
          <li key={item.line}>
            <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 hover:bg-muted/60">
              <Checkbox checked={item.checked} onCheckedChange={() => onToggle(item.line)} className="size-5" />
              <span className={cn("min-w-0 text-sm wrap-break-word", item.checked && "text-muted-foreground line-through")}>
                {item.text || <span className="italic">Empty item</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
