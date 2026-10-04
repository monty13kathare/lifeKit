"use client"

import { useEffect, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { ChevronLeft, Copy, Download, FileText, ListChecks, MoreVertical, Palette, Pin, PinOff, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AiTextActions } from "@/components/common/ai-text-actions"
import { CopyButton } from "@/components/common/copy-button"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { downloadText } from "@/lib/files"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import type { EventColor, Note } from "@/types"
import { ExtractTasks } from "./extract-tasks"
import { NoteChecklist } from "./note-checklist"
import { NoteTagsInput } from "./note-tags-input"
import {
  ColorDot,
  NOTE_COLOR_KEYS,
  NOTE_COLORS,
  noteFileName,
  noteText,
  parseChecklist,
  SourceBadge,
  toggleChecklistLine,
} from "./note-utils"

const SAVE_DELAY = 500
const CHECKLIST_PREFIX = "- [ ] "

export type NoteMetaPatch = Partial<Pick<Note, "pinned" | "color" | "tags">>

interface NoteEditorProps {
  note: Note
  onSave: (id: string, patch: Pick<Note, "title" | "content">) => void
  /** Pin / colour / tags — applied immediately. */
  onUpdateMeta: (id: string, patch: NoteMetaPatch) => void
  onDelete: (note: Note) => void
  /** Receives the note with the editor's latest (possibly unsaved) title and content. */
  onDuplicate: (note: Note) => void
  /** Existing tags across all notes, for suggestions. */
  allTags: string[]
  /** Mobile back button. */
  onBack?: () => void
}

/** Title + content editor that autosaves (debounced) and flushes on unmount. Key it by note id. */
export function NoteEditor({ note, onSave, onUpdateMeta, onDelete, onDuplicate, allTags, onBack }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [status, setStatus] = useState<"saved" | "saving">("saved")
  const router = useRouter()
  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<Pick<Note, "title" | "content"> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveRef = useRef(onSave)
  useEffect(() => {
    saveRef.current = onSave
  }, [onSave])

  const flush = () => {
    window.clearTimeout(timer.current)
    if (pending.current) {
      saveRef.current(note.id, pending.current)
      pending.current = null
    }
  }

  const schedule = (next: Pick<Note, "title" | "content">) => {
    pending.current = next
    setStatus("saving")
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      flush()
      setStatus("saved")
    }, SAVE_DELAY)
  }

  const changeContent = (next: string) => {
    setContent(next)
    schedule({ title, content: next })
  }

  // Flush unsaved edits when switching notes or leaving the page.
  const noteId = note.id
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && pending.current) {
        saveRef.current(noteId, pending.current)
        pending.current = null
      }
    }
    document.addEventListener("visibilitychange", onHide)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.clearTimeout(timer.current)
      if (pending.current) {
        saveRef.current(noteId, pending.current)
        pending.current = null
      }
    }
  }, [noteId])

  const current = { ...note, title, content }
  const text = noteText(current)
  const checklist = parseChecklist(content)
  const tags = note.tags ?? []

  const insertChecklistItem = () => {
    const el = textareaRef.current
    const start = el ? el.selectionStart : content.length
    const end = el ? el.selectionEnd : content.length
    const atLineStart = start === 0 || content[start - 1] === "\n"
    const insert = (atLineStart ? "" : "\n") + CHECKLIST_PREFIX
    changeContent(content.slice(0, start) + insert + content.slice(end))
    const caret = start + insert.length
    requestAnimationFrame(() => {
      const t = textareaRef.current
      if (!t) return
      t.focus()
      t.setSelectionRange(caret, caret)
    })
  }

  const togglePin = () => {
    onUpdateMeta(note.id, { pinned: !note.pinned })
    toast.success(note.pinned ? "Unpinned" : "Pinned to top")
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4">
        {onBack ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to notes"
            onClick={() => {
              flush()
              onBack()
            }}
            className="-ml-1"
          >
            <ChevronLeft aria-hidden />
          </Button>
        ) : null}
        <SourceBadge source={note.source} />
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {status === "saving" ? "Saving…" : `Saved · ${format(parseISO(note.updatedAt), "MMM d, h:mm a")}`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            aria-pressed={!!note.pinned}
            onClick={togglePin}
            className={cn(note.pinned && "text-primary")}
          >
            {note.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
          </Button>
          <CopyButton value={text} label="Copy note" iconOnly variant="ghost" />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="More note actions" />}>
              <MoreVertical aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => {
                  flush()
                  onDuplicate(current)
                }}
              >
                <Copy aria-hidden /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!text.trim()}
                onClick={() => {
                  downloadText(text, noteFileName(current))
                  toast.success("Downloaded note")
                }}
              >
                <Download aria-hidden /> Download as TXT
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!text.trim()}
                onClick={() => {
                  flush()
                  try {
                    sessionStorage.setItem("lifekit:text-to-pdf-handoff", title + "\n\n" + content)
                    router.push("/tools/text-to-pdf")
                  } catch {
                    toast.error("Failed to export. Note might be too large.")
                  }
                }}
              >
                <FileText aria-hidden /> Export to PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(note)}>
                <Trash2 aria-hidden /> Delete note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4" role="toolbar" aria-label="Note tools">
        <Button variant="outline" size="sm" onClick={insertChecklistItem} aria-label="Insert checklist item">
          <ListChecks aria-hidden /> Checklist item
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                aria-label={`Colour label: ${note.color ? NOTE_COLORS[note.color].label : "none"}`}
              />
            }
          >
            {note.color ? <ColorDot color={note.color} /> : <Palette aria-hidden />}
            Colour
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Colour label</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={note.color ?? "none"}
                onValueChange={(v: string) => onUpdateMeta(note.id, { color: v === "none" ? undefined : (v as EventColor) })}
              >
                <DropdownMenuRadioItem value="none">
                  <ColorDot /> None
                </DropdownMenuRadioItem>
                {NOTE_COLOR_KEYS.map((c) => (
                  <DropdownMenuRadioItem key={c} value={c}>
                    <ColorDot color={c} /> {NOTE_COLORS[c].label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <AiTextActions text={content} size="sm" allowSaveNote={false} onReplace={changeContent} />
        <ExtractTasks text={`${title}\n${content}`} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
        <label htmlFor={`note-title-${note.id}`} className="sr-only">
          Title
        </label>
        <input
          id={`note-title-${note.id}`}
          value={title}
          maxLength={200}
          onChange={(e) => {
            setTitle(e.target.value)
            schedule({ title: e.target.value, content })
          }}
          placeholder="Title"
          className="w-full bg-transparent text-xl font-semibold outline-none placeholder:text-muted-foreground/60"
        />
        <NoteTagsInput tags={tags} suggestions={allTags} onChange={(next) => onUpdateMeta(note.id, { tags: next })} />
        <label htmlFor={`note-content-${note.id}`} className="sr-only">
          Note
        </label>
        <Textarea
          ref={textareaRef}
          id={`note-content-${note.id}`}
          value={content}
          onChange={(e) => changeContent(e.target.value)}
          placeholder="Start typing… Lines starting with - [ ] become a checklist."
          className="min-h-[45dvh] flex-1 resize-none border-0 bg-transparent p-0 text-base leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent lg:min-h-48"
        />
        <NoteChecklist items={checklist} onToggle={(line) => changeContent(toggleChecklistLine(content, line))} />
        <p className="text-right text-xs text-muted-foreground tabular-nums">
          {content.trim() ? content.trim().split(/\s+/).length : 0} words · {content.length} characters
        </p>
      </div>
    </div>
  )
}
