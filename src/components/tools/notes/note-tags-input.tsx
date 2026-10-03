"use client"

import { useId, useState } from "react"
import { Plus, Tag, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { hasTag, MAX_TAG_LENGTH, MAX_TAGS, normalizeTag } from "./note-utils"

interface NoteTagsInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  /** Existing tags across all notes, most used first. */
  suggestions: string[]
}

/** Chip input: Enter or comma adds a tag, × (or Backspace on empty input) removes one. */
export function NoteTagsInput({ tags, onChange, suggestions }: NoteTagsInputProps) {
  const [draft, setDraft] = useState("")
  const [focused, setFocused] = useState(false)
  const inputId = useId()
  const hintId = useId()

  /** Add several tags at once (pasted "a, b, c"); returns false if the limit was hit. */
  const addTags = (raws: string[]) => {
    const next = [...tags]
    let full = false
    for (const raw of raws) {
      const tag = normalizeTag(raw)
      if (!tag || hasTag(next, tag)) continue
      if (next.length >= MAX_TAGS) {
        full = true
        break
      }
      next.push(tag)
    }
    if (full) toast.error(`A note can have up to ${MAX_TAGS} tags.`)
    if (next.length !== tags.length) onChange(next)
    return !full
  }

  const addTag = (raw: string) => {
    if (addTags([raw])) setDraft("")
  }

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag))

  const q = draft.trim().toLowerCase()
  const matches = suggestions.filter((s) => !hasTag(tags, s) && (!q || s.toLowerCase().includes(q))).slice(0, 6)
  const showSuggestions = (focused || q.length > 0) && matches.length > 0

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag className="size-4 text-muted-foreground" aria-hidden />
        <ul className="contents" aria-label="Tags">
          {tags.map((t) => (
            <li key={t} className="inline-flex h-8 items-center gap-0.5 rounded-full bg-surface-muted pr-0.5 pl-2.5 text-xs font-medium">
              #{t}
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                onClick={() => removeTag(t)}
                className="relative flex size-7 items-center justify-center rounded-full text-muted-foreground outline-none after:absolute after:-inset-1 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <label htmlFor={inputId} className="sr-only">
          Add tag
        </label>
        <input
          id={inputId}
          value={draft}
          maxLength={MAX_TAG_LENGTH + 1}
          aria-describedby={hintId}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            if (draft.trim()) addTag(draft)
          }}
          onChange={(e) => {
            const v = e.target.value
            if (v.includes(",")) {
              const parts = v.split(",")
              addTags(parts.slice(0, -1))
              setDraft(parts.at(-1) ?? "")
            } else setDraft(v)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addTag(draft)
            } else if (e.key === "Backspace" && !draft && tags.length) {
              removeTag(tags[tags.length - 1])
            } else if (e.key === "Escape" && draft) {
              e.stopPropagation()
              setDraft("")
            }
          }}
          placeholder={tags.length ? "Add tag" : "Add tags…"}
          className="h-8 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
        <span id={hintId} className="sr-only">
          Press Enter or comma to add a tag. Backspace removes the last tag.
        </span>
      </div>
      {showSuggestions ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Suggested tags">
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              // Keep focus in the input so the blur handler doesn't add the half-typed draft.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(s)}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs text-muted-foreground outline-none",
                "hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              )}
            >
              <Plus className="size-3" aria-hidden /> {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
