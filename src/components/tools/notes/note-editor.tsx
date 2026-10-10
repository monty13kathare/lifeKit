"use client"

import { useEffect, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import {
  Check,
  ChevronLeft,
  Copy,
  Download,
  FileText,
  ListChecks,
  LoaderCircle,
  MoreVertical,
  Palette,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { AiTextActions } from "@/components/common/ai-text-actions"
import { CopyButton, copyText } from "@/components/common/copy-button"
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
  /** Mobile "Done": save and return to the list. */
  onDone?: () => void
  /** Start a new note (in the editor header on phones, where the page has no button for it). */
  onNew?: () => void
  /** Receives a function that saves pending edits right away (used before creating a note). */
  flushRef?: React.RefObject<(() => void) | null>
}

/** Title + content editor that autosaves (debounced) and flushes on unmount. Key it by note id. */
export function NoteEditor({
  note,
  onSave,
  onUpdateMeta,
  onDelete,
  onDuplicate,
  allTags,
  onBack,
  onDone,
  onNew,
  flushRef,
}: NoteEditorProps) {
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

  const saveNow = () => {
    flush()
    setStatus("saved")
  }

  // Let the page save pending edits on demand (e.g. right before "New note").
  useEffect(() => {
    if (!flushRef) return
    flushRef.current = saveNow
    return () => {
      flushRef.current = null
    }
  })

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
    <div
      className="flex h-full min-h-0 flex-col"
      onKeyDown={(e) => {
        // Ctrl/Cmd+S saves right away (notes also save automatically as you type).
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault()
          saveNow()
          toast.success("Note saved")
        }
      }}
    >
      <div className="flex items-center gap-1 border-b px-2 py-2 sm:gap-2 sm:px-4">
        {onBack ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to notes"
            onClick={() => {
              flush()
              onBack()
            }}
          >
            <ChevronLeft aria-hidden />
          </Button>
        ) : null}
        <span className="hidden sm:inline-flex">
          <SourceBadge source={note.source} />
        </span>
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1 truncate text-xs",
            status === "saving" ? "text-muted-foreground" : "text-success"
          )}
          aria-live="polite"
        >
          {status === "saving" ? (
            <>
              <LoaderCircle className="size-3.5 shrink-0 animate-spin" aria-hidden /> Saving…
            </>
          ) : (
            <>
              <Check className="size-3.5 shrink-0" aria-hidden /> Saved
              <span className="hidden text-muted-foreground sm:inline"> · {format(parseISO(note.updatedAt), "MMM d, h:mm a")}</span>
            </>
          )}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {onNew ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="New note"
              onClick={() => {
                flush()
                onNew()
              }}
            >
              <Plus aria-hidden />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            aria-pressed={!!note.pinned}
            onClick={togglePin}
            className={cn("hidden sm:inline-flex", note.pinned && "text-primary")}
          >
            {note.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
          </Button>
          <span className="hidden sm:inline-flex">
            <CopyButton value={text} label="Copy note" iconOnly variant="ghost" />
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="More note actions" />}>
              <MoreVertical aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {/* On phones pin and copy live here to keep the header roomy. */}
              <DropdownMenuItem className="sm:hidden" onClick={togglePin}>
                {note.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />} {note.pinned ? "Unpin" : "Pin to top"}
              </DropdownMenuItem>
              <DropdownMenuItem className="sm:hidden" disabled={!text.trim()} onClick={() => void copyText(text)}>
                <Copy aria-hidden /> Copy text
              </DropdownMenuItem>
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
          {onDone ? (
            <Button
              size="sm"
              className="ml-1 h-10 px-3"
              onClick={() => {
                flush()
                onDone()
              }}
            >
              <Check aria-hidden /> Done
            </Button>
          ) : null}
        </div>
      </div>

      {/* One scrollable row on phones instead of wrapping onto two lines */}
      <div
        className="flex items-center gap-2 overflow-x-auto border-b px-3 py-2 [scrollbar-width:none] sm:flex-wrap sm:px-4 *:shrink-0"
        role="toolbar"
        aria-label="Note tools"
      >
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
          // A brand-new note: start typing straight away.
          autoFocus={!note.title && !note.content}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              textareaRef.current?.focus()
            }
          }}
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
