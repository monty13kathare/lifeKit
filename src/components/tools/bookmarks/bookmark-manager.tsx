"use client"

import { useMemo, useRef, useState } from "react"
import { Bookmark as BookmarkIcon, Download, EllipsisVertical, ExternalLink, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { CopyButton } from "@/components/common/copy-button"
import { EmptyState } from "@/components/common/empty-state"
import { ToolPage } from "@/components/common/tool-page"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useBookmarks } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { downloadText } from "@/lib/files"
import { todayString } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { Bookmark } from "@/types"
import { BookmarkFormSheet, bookmarkSchema, hostnameOf, type BookmarkInput } from "./bookmark-form"
import { normalizeTag } from "./tag-input"

const AVATAR_COLORS = ["bg-chart-1/20", "bg-chart-2/25", "bg-chart-3/25", "bg-chart-4/30", "bg-chart-5/20"]

function avatarClass(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

const importSchema = z.array(
  z.object({
    url: z.string(),
    title: z.string().optional().default(""),
    description: z.string().optional().default(""),
    category: z.string().optional().default("General"),
    tags: z.array(z.string()).optional().default([]),
    createdAt: z.string().optional(),
  })
)

export function BookmarkManager() {
  const hydrated = useHydrated()
  const { bookmarks, add, update, remove, upsert } = useBookmarks()
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Bookmark | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    bookmarks.forEach((b) => counts.set(b.category, (counts.get(b.category) ?? 0) + 1))
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [bookmarks])
  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    bookmarks.forEach((b) => b.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t)
  }, [bookmarks])

  // Selected filters may no longer exist after edits/deletes.
  const activeCategory = category && categories.some(([c]) => c === category) ? category : null
  const activeTag = tag && allTags.includes(tag) ? tag : null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...bookmarks]
      .filter((b) => !activeCategory || b.category === activeCategory)
      .filter((b) => !activeTag || b.tags.includes(activeTag))
      .filter(
        (b) =>
          !q ||
          b.title.toLowerCase().includes(q) ||
          b.url.toLowerCase().includes(q) ||
          (b.description ?? "").toLowerCase().includes(q) ||
          b.tags.some((t) => t.includes(q))
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [bookmarks, query, activeCategory, activeTag])

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const save = (v: BookmarkInput) => {
    const title = v.title || hostnameOf(v.url)
    const duplicate = bookmarks.find((b) => b.url === v.url && b.id !== editing?.id)
    if (editing) {
      update(editing.id, { url: v.url, title, description: v.description || undefined, category: v.category, tags: v.tags })
      toast.success("Bookmark updated")
    } else {
      add({ url: v.url, title, description: v.description || undefined, category: v.category, tags: v.tags, createdAt: new Date().toISOString() })
      toast.success(duplicate ? "Saved — you already had this link too" : "Bookmark saved")
    }
    setFormOpen(false)
  }

  const del = (b: Bookmark) => {
    remove(b.id)
    toast("Bookmark deleted", { action: { label: "Undo", onClick: () => upsert(b) } })
  }

  const exportJson = () => {
    const data = {
      app: "LifeKit",
      type: "bookmarks",
      version: 1,
      exportedAt: new Date().toISOString(),
      bookmarks: bookmarks.map(({ url, title, description, category, tags, createdAt }) => ({ url, title, description, category, tags, createdAt })),
    }
    downloadText(JSON.stringify(data, null, 2), `lifekit-bookmarks-${todayString()}.json`, "application/json")
    toast.success(`Exported ${bookmarks.length} bookmark${bookmarks.length === 1 ? "" : "s"}`)
  }

  const importJson = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("That file is too large (max 5 MB)")
      return
    }
    try {
      const json = JSON.parse(await file.text())
      const list = importSchema.safeParse(Array.isArray(json) ? json : json?.bookmarks)
      if (!list.success) throw new Error("format")
      const existing = new Set(bookmarks.map((b) => b.url))
      let added = 0
      let skipped = 0
      for (const raw of list.data) {
        const parsed = bookmarkSchema.safeParse({
          url: raw.url,
          title: raw.title.slice(0, 120),
          description: raw.description.slice(0, 500),
          category: raw.category.slice(0, 40) || "General",
          tags: raw.tags.map(normalizeTag).filter(Boolean).slice(0, 12),
        })
        if (!parsed.success || existing.has(parsed.data.url)) {
          skipped++
          continue
        }
        existing.add(parsed.data.url)
        const v = parsed.data
        add({
          url: v.url,
          title: v.title || hostnameOf(v.url),
          description: v.description || undefined,
          category: v.category,
          tags: v.tags,
          createdAt: raw.createdAt && !Number.isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : new Date().toISOString(),
        })
        added++
      }
      toast.success(`Imported ${added} bookmark${added === 1 ? "" : "s"}${skipped ? ` · skipped ${skipped} duplicate or invalid` : ""}`)
    } catch {
      toast.error("Couldn't read that file. Choose a LifeKit bookmarks JSON export.")
    }
  }

  const actions = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Import or export" />}>
          <EllipsisVertical aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={exportJson} disabled={!bookmarks.length}>
            <Download aria-hidden /> Export JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            <Upload aria-hidden /> Import JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button onClick={openNew} className="hidden lg:inline-flex">
        <Plus aria-hidden /> Add Bookmark
      </Button>
    </>
  )

  return (
    <ToolPage toolId="bookmarks" actions={actions} width="wide">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void importJson(f)
          e.target.value = ""
        }}
      />

      {!hydrated ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading bookmarks">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : bookmarks.length === 0 ? (
        <EmptyState
          icon={BookmarkIcon}
          title="Save useful links here for later."
          description="Bookmarks stay in this browser. Add a category and tags to find them quickly."
          action={
            <Button size="lg" onClick={openNew}>
              <Plus aria-hidden /> Add Bookmark
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter bookmarks"
              aria-label="Filter bookmarks"
              className="h-11 pl-9"
            />
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Category">
            <Chip active={!activeCategory} onClick={() => setCategory(null)}>
              All <span className="opacity-70">{bookmarks.length}</span>
            </Chip>
            {categories.map(([c, n]) => (
              <Chip key={c} active={activeCategory === c} onClick={() => setCategory(activeCategory === c ? null : c)}>
                {c} <span className="opacity-70">{n}</span>
              </Chip>
            ))}
          </div>

          {allTags.length ? (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Tag">
              {allTags.slice(0, 24).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={activeTag === t}
                  onClick={() => setTag(activeTag === t ? null : t)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors",
                    activeTag === t ? "bg-secondary text-secondary-foreground ring-1 ring-primary/40" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  #{t}
                  {activeTag === t ? <X className="size-3" aria-hidden /> : null}
                </button>
              ))}
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground" aria-live="polite">
            {filtered.length} of {bookmarks.length} bookmark{bookmarks.length === 1 ? "" : "s"}
          </p>

          {filtered.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((b) => (
                <BookmarkCard
                  key={b.id}
                  bookmark={b}
                  onEdit={() => {
                    setEditing(b)
                    setFormOpen(true)
                  }}
                  onDelete={() => del(b)}
                  onTag={(t) => setTag(t)}
                />
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No bookmarks match.{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setQuery("")
                  setCategory(null)
                  setTag(null)
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {hydrated && bookmarks.length > 0 ? (
        <Button
          size="icon-lg"
          onClick={openNew}
          aria-label="Add Bookmark"
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 rounded-full shadow-lg lg:hidden"
        >
          <Plus className="size-6" aria-hidden />
        </Button>
      ) : null}

      <BookmarkFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        categories={categories.map(([c]) => c)}
        tagSuggestions={allTags}
        onSubmit={save}
      />
    </ToolPage>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-muted"
      )}
    >
      {children}
    </button>
  )
}

function BookmarkCard({ bookmark: b, onEdit, onDelete, onTag }: { bookmark: Bookmark; onEdit: () => void; onDelete: () => void; onTag: (t: string) => void }) {
  const host = hostnameOf(b.url)
  const letter = (b.title || host).trim().charAt(0).toUpperCase() || "?"
  return (
    <li className="flex flex-col rounded-2xl border bg-card p-3.5 shadow-soft transition-colors hover:border-primary/30">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold text-foreground", avatarClass(host))} aria-hidden>
          {letter}
        </span>
        <div className="min-w-0 flex-1">
          <a
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 font-medium break-words underline-offset-4 hover:underline"
          >
            {b.title}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <p className="truncate text-xs text-muted-foreground">{host}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`More actions for ${b.title}`} className="-mr-1" />}>
            <EllipsisVertical aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil aria-hidden /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 aria-hidden /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {b.description ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{b.description}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex h-6 items-center rounded-full bg-muted px-2 text-xs font-medium">{b.category}</span>
        {b.tags.map((t) => (
          <button key={t} type="button" onClick={() => onTag(t)} className="inline-flex h-6 items-center rounded-full px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            #{t}
          </button>
        ))}
      </div>
      <div className="mt-auto flex gap-2 pt-3">
        <Button variant="outline" size="sm" className="h-9 flex-1" nativeButton={false} render={<a href={b.url} target="_blank" rel="noopener noreferrer" />}>
          <ExternalLink aria-hidden /> Open
        </Button>
        <CopyButton value={b.url} label="Copy URL" size="sm" className="h-9 flex-1" />
      </div>
    </li>
  )
}
