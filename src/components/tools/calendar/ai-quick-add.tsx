"use client"

import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { Bell, CalendarDays, Clock, LoaderCircle, MapPin, Pencil, Repeat, Sparkles, X, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { aiAssist } from "@/lib/ai/client"
import { aiEventToEvent } from "@/lib/ai/convert"
import { cn } from "@/lib/utils"
import type { CalendarEvent } from "@/types"
import { alertLabel, hasAlert, occurrenceTimeLabel, recurrenceLabel } from "./calendar-utils"
import { colorClasses } from "./event-colors"

interface AiQuickAddProps {
  /** Save the confirmed event. */
  onAdd: (event: CalendarEvent) => void
  /** Open the event form prefilled with the suggestion. */
  onEdit: (event: CalendarEvent) => void
  className?: string
}

const MAX_LENGTH = 300

/**
 * Natural-language event entry ("Lunch with Priya next Friday 1pm"). Parsed by
 * Google Gemini via this app's server; nothing is saved until the user confirms.
 * Render only when AI is configured.
 */
export function AiQuickAdd({ onAdd, onEdit, className }: AiQuickAddProps) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<CalendarEvent | null>(null)
  const [announce, setAnnounce] = useState("")
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  // Escape dismisses the preview from anywhere on the page (unless a dialog is handling it).
  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      if (document.querySelector("[role=dialog]")) return
      setPreview(null)
      setAnnounce("Suggestion dismissed.")
      inputRef.current?.focus()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [preview])

  useEffect(() => {
    if (preview) addRef.current?.focus()
  }, [preview])

  const cancelPreview = () => {
    setPreview(null)
    setAnnounce("Suggestion dismissed.")
    inputRef.current?.focus()
  }

  const parse = async () => {
    const input = text.trim()
    if (!input || busy) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setPreview(null)
    setAnnounce("Reading your event…")
    try {
      const result = await aiAssist("parse-event", input, controller.signal)
      if (controller.signal.aborted) return
      const event = aiEventToEvent(result)
      setPreview(event)
      setAnnounce(`Suggested event: ${event.title}, ${describe(event)}. Review and choose Add, Edit or Cancel.`)
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return
      const message = err instanceof Error ? err.message : "Couldn't understand that event."
      toast.error("Couldn't create the event", { description: message })
      setAnnounce("")
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setBusy(false)
      }
    }
  }

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
    setAnnounce("Cancelled.")
  }

  const confirm = () => {
    if (!preview) return
    onAdd(preview)
    setPreview(null)
    setText("")
    setAnnounce(`Added ${preview.title}.`)
  }

  const edit = () => {
    if (!preview) return
    onEdit(preview)
    setPreview(null)
    setText("")
  }

  return (
    <div className={cn("space-y-2", className)}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void parse()
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Sparkles className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" aria-hidden />
          <Input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={(e) => {
              if (e.key === "Escape" && busy) {
                e.preventDefault()
                stop()
              }
            }}
            placeholder="Quick add: “Lunch with Priya next Friday 1pm at Cafe Mocha”"
            aria-label="Quick add event in plain words"
            aria-describedby="ai-quick-add-hint"
            autoComplete="off"
            enterKeyHint="go"
            maxLength={MAX_LENGTH}
            readOnly={busy}
            aria-busy={busy}
            className="h-10 pl-9"
          />
        </div>
        {busy ? (
          <Button type="button" variant="outline" onClick={stop} aria-label="Stop">
            <LoaderCircle className="animate-spin" aria-hidden />
            <span className="hidden sm:inline">Stop</span>
          </Button>
        ) : (
          <Button type="submit" disabled={!text.trim()}>
            <Sparkles aria-hidden />
            <span className="hidden sm:inline">Add with AI</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}
      </form>
      <p id="ai-quick-add-hint" className="text-xs text-muted-foreground">
        Sent to Google Gemini to read the date and time. You&apos;ll review it before anything is saved.
      </p>

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {preview ? <PreviewCard event={preview} addRef={addRef} onAdd={confirm} onEdit={edit} onCancel={cancelPreview} /> : null}
    </div>
  )
}

function describe(e: CalendarEvent): string {
  const start = new Date(e.start)
  return `${format(start, "EEEE, MMMM d")}, ${e.allDay ? "all day" : occurrenceTimeLabel({ event: e, start, end: new Date(e.end), key: e.id })}`
}

function PreviewCard({
  event,
  addRef,
  onAdd,
  onEdit,
  onCancel,
}: {
  event: CalendarEvent
  addRef: React.RefObject<HTMLButtonElement | null>
  onAdd: () => void
  onEdit: () => void
  onCancel: () => void
}) {
  const start = new Date(event.start)
  const end = new Date(event.end)
  const c = colorClasses(event.color)
  const time = event.allDay ? "All day" : occurrenceTimeLabel({ event, start, end, key: event.id })

  return (
    <section
      aria-label="Suggested event"
      className="rounded-2xl border bg-card p-3 shadow-soft sm:p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault()
          onCancel()
        }
      }}
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-1 w-1 shrink-0 self-stretch rounded-full", c.swatch)} aria-hidden />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 font-semibold break-words">{event.title}</p>
            <Button type="button" variant="ghost" size="icon-sm" className="-mt-1 -mr-1 shrink-0" aria-label="Cancel suggestion" onClick={onCancel}>
              <X aria-hidden />
            </Button>
          </div>
          <dl className="grid gap-1 text-sm text-muted-foreground">
            <Row icon={CalendarDays} label="Date">
              {format(start, "EEEE, MMMM d, yyyy")}
            </Row>
            <Row icon={Clock} label="Time">
              <span className="tabular-nums">{time}</span>
            </Row>
            {event.location ? (
              <Row icon={MapPin} label="Location">
                {event.location}
              </Row>
            ) : null}
            {event.recurrence !== "none" ? (
              <Row icon={Repeat} label="Repeat">
                {recurrenceLabel(event.recurrence)}
              </Row>
            ) : null}
            {hasAlert(event.alertMinutes) ? (
              <Row icon={Bell} label="Alert">
                {alertLabel(event.alertMinutes)}
              </Row>
            ) : null}
          </dl>
          {event.notes ? <p className="line-clamp-3 text-xs text-muted-foreground">{event.notes}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="outline" onClick={onEdit}>
          <Pencil aria-hidden /> Edit
        </Button>
        <Button ref={addRef} type="button" onClick={onAdd}>
          Add event
        </Button>
      </div>
      <p className="mt-2 text-right text-[0.7rem] text-muted-foreground">Suggested by Google Gemini — check the details before adding.</p>
    </section>
  )
}

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <dt className="sr-only">{label}</dt>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}
