"use client"

import { useState } from "react"
import { z } from "zod"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { Bookmark } from "@/types"
import { TagInput } from "./tag-input"

export const PRESET_CATEGORIES = ["General", "Work", "Learning", "Finance", "Shopping", "Entertainment", "News", "Tools", "Travel", "Health"]

/** Add `https://` when the user typed a bare domain. */
export function normalizeUrl(raw: string): string {
  const s = raw.trim()
  if (!s) return s
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(s)) return s
  if (/^[a-z][a-z\d+.-]*:/i.test(s) && !/^[^:]+:\d/.test(s)) return s // e.g. "javascript:" – rejected below
  return `https://${s.replace(/^\/+/, "")}`
}

const httpUrl = z.string().refine(
  (v) => {
    try {
      const u = new URL(v)
      const httpish = u.protocol === "http:" || u.protocol === "https:"
      return httpish && (u.hostname.includes(".") || u.hostname === "localhost")
    } catch {
      return false
    }
  },
  { message: "Enter a valid web address starting with http:// or https://" }
)

export const bookmarkSchema = z.object({
  url: z.string().trim().min(1, "Enter a link").transform(normalizeUrl).pipe(httpUrl),
  title: z.string().trim().max(120, "Keep the title under 120 characters"),
  description: z.string().trim().max(500, "Keep the description under 500 characters"),
  category: z.string().trim().min(1, "Choose a category").max(40, "Keep the category under 40 characters"),
  tags: z.array(z.string()).max(12),
})

export type BookmarkInput = z.output<typeof bookmarkSchema>

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

interface BookmarkFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: Bookmark | null
  categories: string[]
  tagSuggestions: string[]
  onSubmit: (values: BookmarkInput) => void
}

export function BookmarkFormSheet({ open, onOpenChange, initial, categories, tagSuggestions, onSubmit }: BookmarkFormProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit bookmark" : "Add bookmark"}
      description="Saved only in this browser."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="bookmark-form">
            {initial ? "Save changes" : "Add bookmark"}
          </Button>
        </>
      }
    >
      {open ? <BookmarkForm key={initial?.id ?? "new"} initial={initial} categories={categories} tagSuggestions={tagSuggestions} onSubmit={onSubmit} /> : null}
    </ResponsiveSheet>
  )
}

type Errors = Partial<Record<keyof BookmarkInput, string>>

function BookmarkForm({ initial, categories, tagSuggestions, onSubmit }: Pick<BookmarkFormProps, "initial" | "categories" | "tagSuggestions" | "onSubmit">) {
  const [url, setUrl] = useState(initial?.url ?? "")
  const [title, setTitle] = useState(initial?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [category, setCategory] = useState(initial?.category ?? "General")
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [errors, setErrors] = useState<Errors>({})

  const allCategories = Array.from(new Set([...PRESET_CATEGORIES, ...categories]))
  const isCustom = !allCategories.includes(category) || category === ""
  const [customMode, setCustomMode] = useState(isCustom)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = bookmarkSchema.safeParse({ url, title, description, category, tags })
    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors
        if (!next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }
    onSubmit(parsed.data)
  }

  return (
    <form id="bookmark-form" onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="bm-url">Link</Label>
        <Input
          id="bm-url"
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={!initial}
          placeholder="example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => url && setUrl(normalizeUrl(url))}
          aria-invalid={errors.url ? true : undefined}
          aria-describedby="bm-url-msg"
          className="h-11"
        />
        <p id="bm-url-msg" className={cn("text-xs", errors.url ? "text-destructive" : "text-muted-foreground")}>
          {errors.url ?? "https:// is added automatically if you leave it out."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bm-title">Title</Label>
        <Input
          id="bm-title"
          placeholder={url && !/\s/.test(url.trim()) ? hostnameOf(normalizeUrl(url)) : "Defaults to the website name"}
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={errors.title ? true : undefined}
          className="h-11"
        />
        {errors.title ? <p className="text-xs text-destructive">{errors.title}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bm-desc">Description (optional)</Label>
        <Textarea id="bm-desc" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Category</legend>
        <div className="flex flex-wrap gap-1.5">
          {allCategories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={!customMode && category === c}
              onClick={() => {
                setCategory(c)
                setCustomMode(false)
              }}
              className={cn(
                "h-9 rounded-full border px-3 text-sm transition-colors",
                !customMode && category === c ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-muted"
              )}
            >
              {c}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={customMode}
            onClick={() => {
              setCustomMode(true)
              setCategory("")
            }}
            className={cn("h-9 rounded-full border border-dashed px-3 text-sm transition-colors", customMode ? "border-primary text-primary" : "hover:bg-muted")}
          >
            + Custom
          </button>
        </div>
        {customMode ? (
          <Input
            aria-label="Custom category"
            placeholder="Category name"
            value={category}
            maxLength={40}
            autoFocus
            onChange={(e) => setCategory(e.target.value)}
            aria-invalid={errors.category ? true : undefined}
            className="h-11"
          />
        ) : null}
        {errors.category ? <p className="text-xs text-destructive">{errors.category}</p> : null}
      </fieldset>

      <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
    </form>
  )
}
