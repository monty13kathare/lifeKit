"use client"

import { useEffect, useRef, useState } from "react"
import { AlarmClock, LoaderCircle, Pencil, Repeat, Sparkles, TriangleAlert, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAiStatus } from "@/hooks/use-ai-status"
import type { AiReminder } from "@/lib/ai/assist-schemas"
import { aiAssist } from "@/lib/ai/client"
import { describeWhen } from "@/lib/ai/convert"
import { combineDateTime } from "@/lib/dates"
import { describeRepeat } from "./reminder-utils"

const INPUT_MAX = 500

interface ReminderNlBarProps {
  onSave: (r: AiReminder) => void
  onEdit: (r: AiReminder) => void
}

/**
 * "Remind me to…" bar: Google Gemini turns a sentence into a reminder preview.
 * Nothing is saved until the user confirms. Renders nothing unless AI is configured.
 */
export function ReminderNlBar({ onSave, onEdit }: ReminderNlBarProps) {
  const status = useAiStatus()
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<AiReminder | null>(null)
  const controller = useRef<AbortController | null>(null)
  const saveRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    if (preview) saveRef.current?.focus()
  }, [preview])

  if (!status?.configured) return null

  const parse = async () => {
    const input = text.trim()
    if (!input || busy) return
    controller.current?.abort()
    const ctl = new AbortController()
    controller.current = ctl
    setBusy(true)
    setPreview(null)
    try {
      const out = await aiAssist("parse-reminder", input, ctl.signal)
      if (!ctl.signal.aborted) setPreview(out)
    } catch (err) {
      if (ctl.signal.aborted || (err as Error)?.name === "AbortError") return
      toast.error("Couldn't understand that reminder", {
        description: err instanceof Error ? err.message : "Try rephrasing, or use New reminder.",
      })
    } finally {
      if (!ctl.signal.aborted) setBusy(false)
    }
  }

  const cancel = () => {
    controller.current?.abort()
    setBusy(false)
    setPreview(null)
    inputRef.current?.focus()
  }

  const isPast = preview ? preview.repeat === "none" && combineDateTime(preview.date, preview.time) <= new Date() : false
  const repeatText = preview ? describeRepeat(preview) : null

  return (
    <section
      aria-label="Create a reminder from a sentence"
      className="space-y-0 rounded-2xl border bg-card shadow-soft transition-shadow focus-within:shadow-md"
      onKeyDown={(e) => {
        if (e.key === "Escape" && (preview || busy)) {
          e.preventDefault()
          cancel()
        }
      }}
    >
      <form
        className="flex items-center gap-2 p-2 sm:p-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          void parse()
        }}
      >
        <label htmlFor="reminder-nl-input" className="sr-only">
          Remind me to…
        </label>
        <div className="relative min-w-0 flex-1 flex items-center">
          <Sparkles className="absolute left-3 size-5 text-primary/60" aria-hidden />
          <Input
            ref={inputRef}
            id="reminder-nl-input"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, INPUT_MAX))}
            maxLength={INPUT_MAX}
            placeholder="Type 'remind me to call mum tomorrow at 6pm'..."
            autoComplete="off"
            enterKeyHint="go"
            className="h-12 border-0 bg-transparent pl-11 text-base shadow-none focus-visible:ring-0"
          />
        </div>
        <Button type="submit" size="sm" className="h-10 shrink-0 rounded-xl px-4" disabled={!text.trim() || busy}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Sparkles aria-hidden className="mr-1.5 size-4" />}
          <span className="hidden sm:inline">{busy ? "Thinking…" : "Create"}</span>
        </Button>
      </form>

      {(preview || busy) && (
        <div className="border-t bg-surface-muted/30 p-4 rounded-b-2xl" aria-live="polite">
        {busy ? (
          <p className="flex items-center gap-2 rounded-xl bg-surface-muted p-3 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> Reading your reminder…
          </p>
        ) : preview ? (
          <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
                <AlarmClock className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium wrap-break-word">{preview.title}</p>
                <p className="text-sm text-muted-foreground">{describeWhen(preview.date, preview.time)}</p>
                {repeatText ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Repeat className="size-3" aria-hidden /> {repeatText}
                  </p>
                ) : null}
                {preview.notes ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{preview.notes}</p> : null}
              </div>
            </div>
            {isPast ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <TriangleAlert className="size-3.5" aria-hidden /> This time has already passed — edit it before saving.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                ref={saveRef}
                size="sm"
                className="h-10 sm:h-8"
                disabled={isPast}
                onClick={() => {
                  onSave(preview)
                  setPreview(null)
                  setText("")
                }}
              >
                Save reminder
              </Button>
              <Button
                size="sm"
                className="h-10 sm:h-8"
                variant="outline"
                onClick={() => {
                  onEdit(preview)
                  setPreview(null)
                  setText("")
                }}
              >
                <Pencil aria-hidden /> Edit
              </Button>
              <Button size="sm" variant="ghost" className="h-10 sm:h-8" onClick={cancel}>
                <X aria-hidden /> Cancel
              </Button>
            </div>
          </div>
        ) : null}
        </div>
      )}
    </section>
  )
}
