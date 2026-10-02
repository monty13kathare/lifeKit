"use client"

import { useId, useState } from "react"
import { Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"

export const normalizeTag = (t: string) =>
  t
    .trim()
    .replace(/^#/, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 30)

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  label?: string
  max?: number
}

/** Chip input: Enter or comma adds a tag, Backspace on empty removes the last one. */
export function TagInput({ value, onChange, suggestions = [], label = "Tags", max = 12 }: TagInputProps) {
  const id = useId()
  const [draft, setDraft] = useState("")

  const add = (raw: string) => {
    const parts = raw.split(",").map(normalizeTag).filter(Boolean)
    if (!parts.length) return
    const next = [...value]
    for (const p of parts) if (!next.includes(p) && next.length < max) next.push(p)
    onChange(next)
    setDraft("")
  }

  const unused = suggestions.filter((s) => !value.includes(s)).slice(0, 8)

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-input px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
        )}
      >
        {value.map((t) => (
          <span key={t} className="inline-flex h-7 items-center gap-1 rounded-full bg-secondary pr-1 pl-2.5 text-xs font-medium text-secondary-foreground">
            #{t}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== t))}
              aria-label={`Remove tag ${t}`}
              className="flex size-5 items-center justify-center rounded-full hover:bg-foreground/10"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            const v = e.target.value
            if (v.includes(",")) add(v)
            else setDraft(v)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add(draft)
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "" : "Type and press Enter"}
          enterKeyHint="enter"
          disabled={value.length >= max}
          aria-describedby={`${id}-hint`}
          className="h-7 min-w-24 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
      </div>
      <p id={`${id}-hint`} className="sr-only">
        Press Enter or comma to add a tag. Backspace removes the last tag.
      </p>
      {unused.length ? (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus className="size-3" aria-hidden />#{s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
