"use client"

import { useMemo, useState } from "react"
import { format, isSameYear, isToday, parseISO } from "date-fns"
import { NotebookPen, Plus, Search, X } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { ToolPage } from "@/components/common/tool-page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsDesktop } from "@/hooks/use-media-query"
import { useNotes } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { cn } from "@/lib/utils"
import type { Note } from "@/types"
import { NoteEditor } from "./note-editor"
import { isBlank, noteDisplayTitle, SOURCE_META, SourceBadge } from "./note-utils"

type SourceFilter = "all" | Note["source"]

const shortDate = (iso: string) => {
  const d = parseISO(iso)
  if (isToday(d)) return format(d, "h:mm a")
  return format(d, isSameYear(d, new Date()) ? "MMM d" : "MMM d, yyyy")
}

export function NotesApp() {
  const hydrated = useHydrated()
  const isDesktop = useIsDesktop()
  const { notes, add, update, remove, upsert, set } = useNotes()
  const [query, setQuery] = useState("")
  const [source, setSource] = useState<SourceFilter>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sorted = useMemo(() => [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [notes])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sorted.filter(
      (n) => (source === "all" || n.source === source) && (!q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
    )
  }, [sorted, query, source])

  const selectedExists = selectedId && notes.some((n) => n.id === selectedId)
  const activeId = selectedExists ? selectedId : isDesktop ? (filtered[0]?.id ?? null) : null
  const active = notes.find((n) => n.id === activeId) ?? null
  const usedSources = new Set(notes.map((n) => n.source))

  /** Remove a note left completely empty (after the editor has flushed its last edit). */
  const discardIfBlank = (id: string | null) => {
    if (!id) return
    window.setTimeout(() => set((prev) => prev.filter((n) => n.id !== id || !isBlank(n))), 0)
  }

  const select = (id: string | null) => {
    if (activeId && activeId !== id) discardIfBlank(activeId)
    setSelectedId(id)
  }

  const createNote = () => {
    if (active && isBlank(active)) {
      setSelectedId(active.id)
      return
    }
    const stamp = new Date().toISOString()
    const created = add({ title: "", content: "", source: "manual", createdAt: stamp, updatedAt: stamp })
    setQuery("")
    setSource("all")
    select(created.id)
  }

  const save = (id: string, patch: Pick<Note, "title" | "content">) => update(id, { ...patch, updatedAt: new Date().toISOString() })

  const deleteNote = (note: Note) => {
    remove(note.id)
    setSelectedId(null)
    if (!isBlank(note)) {
      toast("Note deleted", { description: noteDisplayTitle(note), action: { label: "Undo", onClick: () => upsert(note) } })
    }
  }

  const showList = isDesktop || !active
  const showEditor = !!active

  return (
    <ToolPage
      toolId="notes"
      width="wide"
      actions={
        <Button className="hidden sm:inline-flex" onClick={createNote}>
          <Plus aria-hidden /> New note
        </Button>
      }
    >
      {!hydrated ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]" aria-busy="true" aria-label="Loading notes">
          <div className="space-y-2">
            <Skeleton className="h-11 w-full rounded-lg" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="hidden h-96 rounded-2xl lg:block" />
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No notes yet."
          description="Jot something down, or save text from the OCR and voice tools — notes stay in this browser."
          action={
            <Button size="lg" onClick={createNote}>
              <Plus aria-hidden /> New note
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:h-[calc(100dvh-13rem)] lg:min-h-[32rem] lg:grid-cols-[20rem_minmax(0,1fr)]">
          {showList ? (
            <div className="flex min-h-0 flex-col gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <label htmlFor="notes-search" className="sr-only">
                  Search notes
                </label>
                <Input
                  id="notes-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search notes"
                  className="h-11 bg-card pl-9"
                />
              </div>
              {usedSources.size > 1 ? (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by source">
                  {(["all", "manual", "ocr", "voice"] as SourceFilter[])
                    .filter((s) => s === "all" || usedSources.has(s))
                    .map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={source === s}
                        onClick={() => setSource(s)}
                        className={cn(
                          "h-9 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          source === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
                        )}
                      >
                        {s === "all" ? "All" : SOURCE_META[s].label}
                      </button>
                    ))}
                </div>
              ) : null}

              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  <p>No notes match “{query}”.</p>
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setQuery("")}>
                    <X aria-hidden /> Clear search
                  </Button>
                </div>
              ) : (
                <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto lg:pr-1" aria-label="Notes">
                  {filtered.map((n) => {
                    const selected = n.id === activeId
                    const preview = n.title.trim() ? n.content.trim() : n.content.trim().split("\n").slice(1).join(" ")
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => select(n.id)}
                          aria-current={selected ? "true" : undefined}
                          className={cn(
                            "w-full rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            selected ? "border-primary/50 bg-primary/6" : "bg-card shadow-soft hover:bg-muted/50"
                          )}
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className={cn("min-w-0 truncate font-medium", isBlank(n) && "text-muted-foreground italic")}>
                              {noteDisplayTitle(n)}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">{shortDate(n.updatedAt)}</span>
                          </span>
                          {preview ? <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{preview}</span> : null}
                          {n.source !== "manual" ? <SourceBadge source={n.source} className="mt-2" /> : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {showEditor && active ? (
            <section aria-label="Note editor" className="min-h-0 overflow-hidden rounded-2xl border bg-card shadow-soft">
              <NoteEditor
                key={active.id}
                note={active}
                onSave={save}
                onDelete={deleteNote}
                onBack={isDesktop ? undefined : () => select(null)}
              />
            </section>
          ) : isDesktop ? (
            <div className="hidden items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground lg:flex">
              Select a note or create a new one.
            </div>
          ) : null}
        </div>
      )}

      {!active || isDesktop ? (
        <Button
          size="icon-lg"
          aria-label="New note"
          onClick={createNote}
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 rounded-full shadow-lg sm:hidden lg:bottom-8"
        >
          <Plus className="size-6" aria-hidden />
        </Button>
      ) : null}
    </ToolPage>
  )
}
