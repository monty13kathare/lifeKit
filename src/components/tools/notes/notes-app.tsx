"use client"

import { useMemo, useRef, useState } from "react"
import { format, isSameYear, isToday, parseISO } from "date-fns"
import {
  Copy,
  FileJson,
  FileText,
  FolderDown,
  MoreVertical,
  NotebookPen,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { ToolPage } from "@/components/common/tool-page"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsDesktop } from "@/hooks/use-media-query"
import { useNotes } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { downloadText, formatBytes } from "@/lib/files"
import { cn } from "@/lib/utils"
import type { EventColor, Note } from "@/types"
import { NoteEditor, type NoteMetaPatch } from "./note-editor"
import {
  collectTags,
  ColorDot,
  compareNotes,
  hasTag,
  isBlank,
  NOTE_COLOR_KEYS,
  NOTE_COLORS,
  noteDisplayTitle,
  type NoteSort,
  SORT_ITEMS,
  SOURCE_META,
  SourceBadge,
} from "./note-utils"
import { backupFileName, buildNotesBackup, buildNotesText, IMPORT_MAX_BYTES, parseNotesBackup } from "./notes-io"

type SourceFilter = "all" | Note["source"]

const TAGS_COLLAPSED = 8

const shortDate = (iso: string) => {
  const d = parseISO(iso)
  if (isToday(d)) return format(d, "h:mm a")
  return format(d, isSameYear(d, new Date()) ? "MMM d" : "MMM d, yyyy")
}

const chipClass = (active: boolean) =>
  cn(
    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
  )

export function NotesApp() {
  const hydrated = useHydrated()
  const isDesktop = useIsDesktop()
  const { notes, add, update, remove, upsert, set } = useNotes()
  const [query, setQuery] = useState("")
  const [source, setSource] = useState<SourceFilter>("all")
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [colorFilter, setColorFilter] = useState<EventColor | null>(null)
  const [sort, setSort] = useState<NoteSort>("updated")
  const [showAllTags, setShowAllTags] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const allTags = useMemo(() => collectTags(notes), [notes])
  const usedColors = useMemo(() => NOTE_COLOR_KEYS.filter((c) => notes.some((n) => n.color === c)), [notes])
  const usedSources = new Set(notes.map((n) => n.source))
  // A filter pointing at a tag/colour that no longer exists is ignored.
  const activeTag = tagFilter && allTags.some((t) => t.toLowerCase() === tagFilter.toLowerCase()) ? tagFilter : null
  const activeColor = colorFilter && usedColors.includes(colorFilter) ? colorFilter : null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes
      .filter(
        (n) =>
          (source === "all" || n.source === source) &&
          (!activeTag || hasTag(n.tags, activeTag)) &&
          (!activeColor || n.color === activeColor) &&
          (!q ||
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            !!n.tags?.some((t) => t.toLowerCase().includes(q.replace(/^#/, ""))))
      )
      .sort(compareNotes(sort))
  }, [notes, query, source, activeTag, activeColor, sort])

  const pinned = filtered.filter((n) => n.pinned)
  const others = filtered.filter((n) => !n.pinned)
  const ordered = [...pinned, ...others]
  const filtersActive = !!query.trim() || source !== "all" || !!activeTag || !!activeColor

  const selectedExists = selectedId && notes.some((n) => n.id === selectedId)
  const activeId = selectedExists ? selectedId : isDesktop ? (ordered[0]?.id ?? null) : null
  const active = notes.find((n) => n.id === activeId) ?? null

  /** Remove a note left completely empty (after the editor has flushed its last edit). */
  const discardIfBlank = (id: string | null) => {
    if (!id) return
    window.setTimeout(() => set((prev) => prev.filter((n) => n.id !== id || !isBlank(n))), 0)
  }

  const select = (id: string | null) => {
    if (activeId && activeId !== id) discardIfBlank(activeId)
    setSelectedId(id)
  }

  const clearFilters = () => {
    setQuery("")
    setSource("all")
    setTagFilter(null)
    setColorFilter(null)
  }

  const createNote = () => {
    if (active && isBlank(active)) {
      setSelectedId(active.id)
      return
    }
    const stamp = new Date().toISOString()
    const created = add({ title: "", content: "", source: "manual", createdAt: stamp, updatedAt: stamp })
    clearFilters()
    select(created.id)
  }

  const save = (id: string, patch: Pick<Note, "title" | "content">) => update(id, { ...patch, updatedAt: new Date().toISOString() })

  const updateMeta = (id: string, patch: NoteMetaPatch) => {
    // Pinning is not an edit; colour/tags are.
    const touch = "color" in patch || "tags" in patch
    update(id, (prev) => {
      const next: Note = { ...prev, ...patch, ...(touch ? { updatedAt: new Date().toISOString() } : {}) }
      if (!next.pinned) delete next.pinned
      if (!next.color) delete next.color
      if (!next.tags?.length) delete next.tags
      return next
    })
  }

  const togglePin = (note: Note) => {
    updateMeta(note.id, { pinned: !note.pinned })
    toast.success(note.pinned ? "Unpinned" : "Pinned to top")
  }

  const duplicateNote = (note: Note) => {
    const stamp = new Date().toISOString()
    const base = note.title.trim() || noteDisplayTitle(note)
    const created = add({
      title: `${base} (copy)`.slice(0, 200),
      content: note.content,
      source: note.source,
      ...(note.color ? { color: note.color } : {}),
      ...(note.tags?.length ? { tags: [...note.tags] } : {}),
      createdAt: stamp,
      updatedAt: stamp,
    })
    clearFilters()
    select(created.id)
    toast.success("Note duplicated")
  }

  const deleteNote = (note: Note) => {
    remove(note.id)
    setSelectedId(null)
    if (!isBlank(note)) {
      toast("Note deleted", { description: noteDisplayTitle(note), action: { label: "Undo", onClick: () => upsert(note) } })
    }
  }

  const exportable = () => notes.filter((n) => !isBlank(n)).sort(compareNotes("updated"))

  const exportJson = () => {
    const list = exportable()
    if (!list.length) return toast.error("There are no notes to export yet.")
    downloadText(buildNotesBackup(list), backupFileName("json"), "application/json;charset=utf-8")
    toast.success(`Exported ${list.length} ${list.length === 1 ? "note" : "notes"}`, { description: "Keep the file somewhere safe." })
  }

  const exportTxt = () => {
    const list = exportable()
    if (!list.length) return toast.error("There are no notes to export yet.")
    downloadText(buildNotesText(list), backupFileName("txt"))
    toast.success(`Exported ${list.length} ${list.length === 1 ? "note" : "notes"} as text`)
  }

  const importFile = async (file: File) => {
    if (file.size > IMPORT_MAX_BYTES) {
      toast.error("That file is too large", { description: `Backups up to ${formatBytes(IMPORT_MAX_BYTES)} are supported.` })
      return
    }
    if (!/\.json$/i.test(file.name) && file.type !== "application/json") {
      toast.error("Choose a LifeKit notes backup (.json).")
      return
    }
    try {
      const { notes: incoming, invalid } = parseNotesBackup(await file.text())
      const existing = new Set(notes.map((n) => n.id))
      const fresh = incoming.filter((n) => !existing.has(n.id))
      const skipped = incoming.length - fresh.length
      if (fresh.length) set((prev) => [...prev, ...fresh])
      const details = [
        skipped ? `${skipped} already in your notes` : "",
        invalid ? `${invalid} invalid ${invalid === 1 ? "entry" : "entries"} skipped` : "",
      ]
        .filter(Boolean)
        .join(" · ")
      if (fresh.length) {
        toast.success(`Imported ${fresh.length} ${fresh.length === 1 ? "note" : "notes"}`, { description: details || undefined })
      } else {
        toast.info("Nothing new to import", { description: details || "The file has no notes." })
      }
    } catch (err) {
      toast.error("Couldn't import notes", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const backupMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Export or import notes" className="bg-card" />}>
        <FolderDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Backup</DropdownMenuLabel>
          <DropdownMenuItem onClick={exportJson}>
            <FileJson aria-hidden /> Export all (.json backup)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportTxt}>
            <FileText aria-hidden /> Export all (.txt)
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => fileInput.current?.click()}>
          <Upload aria-hidden /> Import from backup…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const showList = isDesktop || !active
  const showEditor = !!active
  const visibleTags = showAllTags ? [...allTags] : allTags.slice(0, TAGS_COLLAPSED)
  if (activeTag && !visibleTags.some((t) => t.toLowerCase() === activeTag.toLowerCase())) visibleTags.push(activeTag)

  const renderItem = (n: Note) => {
    const selected = n.id === activeId
    // Show checklist markup ("- [ ] milk") as boxes in the list preview.
    const body = n.content
      .trim()
      .replace(/^\s*[-*] \[ \] ?/gm, "☐ ")
      .replace(/^\s*[-*] \[[xX]\] ?/gm, "☑ ")
    const preview = n.title.trim() ? body : body.split("\n").slice(1).join(" ")
    return (
      <li key={n.id}>
        <div
          className={cn(
            "flex items-stretch rounded-xl border transition-colors",
            n.color && cn("border-l-4", NOTE_COLORS[n.color].edge),
            selected ? "border-primary/50 bg-primary/6" : "bg-card shadow-soft hover:bg-muted/50"
          )}
        >
          <button
            type="button"
            onClick={() => select(n.id)}
            aria-current={selected ? "true" : undefined}
            className="min-w-0 flex-1 rounded-xl p-3 pr-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex min-w-0 items-start justify-between gap-2">
              <span className="flex min-w-0 items-start gap-1.5 pt-0.5">
                {n.pinned ? (
                  <>
                    <Pin className="size-3.5 shrink-0 text-primary" aria-hidden />
                    <span className="sr-only">Pinned: </span>
                  </>
                ) : null}
                <span className={cn("line-clamp-2 min-w-0 font-medium wrap-break-word", isBlank(n) && "text-muted-foreground italic")}>
                  {noteDisplayTitle(n)}
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground mt-0.5">
                {shortDate(sort === "created" ? n.createdAt : n.updatedAt)}
              </span>
            </span>
            {preview ? <span className="mt-1 line-clamp-2 block text-sm wrap-break-word text-muted-foreground">{preview}</span> : null}
            {n.source !== "manual" || n.tags?.length ? (
              <span className="mt-2 flex flex-wrap items-center gap-1">
                {n.source !== "manual" ? <SourceBadge source={n.source} /> : null}
                {n.tags?.slice(0, 3).map((t) => (
                  <span key={t} className="inline-flex h-6 max-w-32 items-center truncate rounded-full bg-surface-muted px-2 text-xs text-muted-foreground">
                    #{t}
                  </span>
                ))}
                {n.tags && n.tags.length > 3 ? <span className="text-xs text-muted-foreground">+{n.tags.length - 3}</span> : null}
              </span>
            ) : null}
            {n.color ? <span className="sr-only">Colour: {NOTE_COLORS[n.color].label}</span> : null}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${noteDisplayTitle(n)}`}
                  className="m-1 shrink-0 text-muted-foreground"
                />
              }
            >
              <MoreVertical aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => togglePin(n)}>
                {n.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />} {n.pinned ? "Unpin" : "Pin to top"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicateNote(n)}>
                <Copy aria-hidden /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => deleteNote(n)}>
                <Trash2 aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </li>
    )
  }

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
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (file) void importFile(file)
        }}
      />
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
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <Button size="lg" onClick={createNote}>
                <Plus aria-hidden /> New note
              </Button>
              <Button size="lg" variant="outline" onClick={() => fileInput.current?.click()}>
                <Upload aria-hidden /> Import backup
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 lg:h-[calc(100dvh-13rem)] lg:min-h-[32rem] lg:grid-cols-[20rem_minmax(0,1fr)]">
          {showList ? (
            <div className="flex min-h-0 flex-col gap-3">
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
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
                {backupMenu}
              </div>

              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground" id="notes-sort-label">
                  Sort
                </span>
                <Select items={SORT_ITEMS} value={sort} onValueChange={(v) => v && setSort(v as NoteSort)}>
                  <SelectTrigger aria-labelledby="notes-sort-label" className="h-10 min-w-0 flex-1 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_ITEMS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {usedColors.length > 0 ? (
                  <div className="flex shrink-0 items-center" role="group" aria-label="Filter by colour">
                    {usedColors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={activeColor === c}
                        aria-label={`${NOTE_COLORS[c].label} notes`}
                        title={NOTE_COLORS[c].label}
                        onClick={() => setColorFilter(activeColor === c ? null : c)}
                        className="flex size-10 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <ColorDot
                          color={c}
                          className={cn("size-4", activeColor === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {usedSources.size > 1 ? (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by source">
                  {(["all", "manual", "ocr", "voice"] as SourceFilter[])
                    .filter((s) => s === "all" || usedSources.has(s))
                    .map((s) => (
                      <button key={s} type="button" aria-pressed={source === s} onClick={() => setSource(s)} className={chipClass(source === s)}>
                        {s === "all" ? "All" : SOURCE_META[s].label}
                      </button>
                    ))}
                </div>
              ) : null}

              {allTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
                  {visibleTags.map((t) => {
                    const on = !!activeTag && activeTag.toLowerCase() === t.toLowerCase()
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTagFilter(on ? null : t)}
                        className={cn(chipClass(on), "max-w-full")}
                      >
                        <span className="truncate">#{t}</span>
                      </button>
                    )
                  })}
                  {allTags.length > TAGS_COLLAPSED ? (
                    <button type="button" onClick={() => setShowAllTags((v) => !v)} className={cn(chipClass(false), "border-dashed")}>
                      {showAllTags ? "Fewer tags" : `+${allTags.length - TAGS_COLLAPSED} more`}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  <p>{query.trim() ? `No notes match “${query.trim()}”.` : "No notes match these filters."}</p>
                  <Button variant="ghost" size="sm" className="mt-2" onClick={clearFilters}>
                    <X aria-hidden /> Clear filters
                  </Button>
                </div>
              ) : (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto lg:pr-1">
                  {filtersActive ? (
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                      {filtered.length} of {notes.length} notes ·{" "}
                      <button type="button" onClick={clearFilters} className="font-medium text-primary underline-offset-2 hover:underline">
                        Clear filters
                      </button>
                    </p>
                  ) : null}
                  {pinned.length > 0 ? (
                    <section aria-labelledby="notes-pinned-heading" className="space-y-2">
                      <h3 id="notes-pinned-heading" className="flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        <Pin className="size-3" aria-hidden /> Pinned
                      </h3>
                      <ul className="space-y-2" aria-label="Pinned notes">
                        {pinned.map(renderItem)}
                      </ul>
                    </section>
                  ) : null}
                  {others.length > 0 ? (
                    <section aria-labelledby={pinned.length ? "notes-others-heading" : undefined} className="space-y-2">
                      {pinned.length > 0 ? (
                        <h3 id="notes-others-heading" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          Others
                        </h3>
                      ) : null}
                      <ul className="space-y-2" aria-label="Notes">
                        {others.map(renderItem)}
                      </ul>
                    </section>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {showEditor && active ? (
            <section aria-label="Note editor" className="min-h-0 overflow-hidden rounded-2xl border bg-card shadow-soft">
              <NoteEditor
                key={active.id}
                note={active}
                allTags={allTags}
                onSave={save}
                onUpdateMeta={updateMeta}
                onDelete={deleteNote}
                onDuplicate={duplicateNote}
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
