"use client"

import { useEffect, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { ChevronLeft, Download, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { CopyButton } from "@/components/common/copy-button"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { downloadText } from "@/lib/files"
import type { Note } from "@/types"
import { SourceBadge, noteText, noteFileName } from "./note-utils"

const SAVE_DELAY = 500

interface NoteEditorProps {
  note: Note
  onSave: (id: string, patch: Pick<Note, "title" | "content">) => void
  onDelete: (note: Note) => void
  /** Mobile back button. */
  onBack?: () => void
}

/** Title + content editor that autosaves (debounced) and flushes on unmount. Key it by note id. */
export function NoteEditor({ note, onSave, onDelete, onBack }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [status, setStatus] = useState<"saved" | "saving">("saved")
  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<Pick<Note, "title" | "content"> | null>(null)
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
          <CopyButton value={text} label="Copy note" iconOnly variant="ghost" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Download as TXT"
            disabled={!text.trim()}
            onClick={() => {
              downloadText(text, noteFileName(current))
              toast.success("Downloaded note")
            }}
          >
            <Download aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete note" className="hover:text-destructive" onClick={() => onDelete(note)}>
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-4">
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
        <label htmlFor={`note-content-${note.id}`} className="sr-only">
          Note
        </label>
        <Textarea
          id={`note-content-${note.id}`}
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            schedule({ title, content: e.target.value })
          }}
          placeholder="Start typing…"
          className="min-h-[50dvh] flex-1 resize-none border-0 bg-transparent p-0 text-base leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent lg:min-h-0"
        />
        <p className="text-right text-xs text-muted-foreground tabular-nums">
          {content.trim() ? content.trim().split(/\s+/).length : 0} words · {content.length} characters
        </p>
      </div>
    </div>
  )
}
