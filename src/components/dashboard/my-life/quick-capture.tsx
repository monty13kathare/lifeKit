"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Bell, CalendarDays, Check, ListTodo, LoaderCircle, NotebookPen, Plus, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useCalendar, useNotes, useReminders, useTasks } from "@/hooks/use-lifekit-data"
import type { AssistOutput } from "@/lib/ai/assist-schemas"
import { aiAssist, fetchAiStatus } from "@/lib/ai/client"
import { aiEventToEvent, aiNoteToNote, aiReminderToReminder, aiTaskToTask, describeWhen } from "@/lib/ai/convert"
import { createId } from "@/lib/storage/core"
import { todayString } from "@/lib/dates"
import { cn } from "@/lib/utils"

type Capture = AssistOutput<"capture">
type Kind = Capture["kind"]

const KIND_META: Record<Kind, { label: string; icon: typeof ListTodo; href: string; accent: string }> = {
  task: { label: "Task", icon: ListTodo, href: "/tools/todo", accent: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" },
  event: { label: "Event", icon: CalendarDays, href: "/tools/calendar", accent: "bg-sky-500/10 text-sky-600 dark:text-sky-300" },
  reminder: { label: "Reminder", icon: Bell, href: "/tools/reminders", accent: "bg-amber-500/10 text-amber-600 dark:text-amber-300" },
  note: { label: "Note", icon: NotebookPen, href: "/tools/notes", accent: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
}

const EXAMPLES = [
  "Pay electricity bill tomorrow 6pm",
  "Dentist next Friday 4pm at Smile Clinic",
  "Remind me to call mom every Sunday 7pm",
  "Gift ideas for Riya: book, plant, headphones",
]

/**
 * "Add anything" box for the My Life page. With Gemini it understands what
 * you typed (task / event / reminder / note) and shows a preview to confirm;
 * without AI it saves a task (due today) or a note.
 */
export function QuickCapture() {
  const router = useRouter()
  const ai = useAiStatus()
  const aiOn = !!ai?.configured
  const { add: addTask } = useTasks()
  const { add: addEvent } = useCalendar()
  const { add: addReminder } = useReminders()
  const { add: addNote } = useNotes()
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Capture | null>(null)
  const [manualKind, setManualKind] = useState<"task" | "note">("task")
  const controller = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => controller.current?.abort(), [])

  const reset = () => {
    setPreview(null)
    setText("")
    inputRef.current?.focus()
  }

  const saved = (kind: Kind, title: string) => {
    toast.success(`${KIND_META[kind].label} added`, {
      description: title,
      action: { label: "Open", onClick: () => router.push(KIND_META[kind].href) },
    })
    reset()
  }

  const submit = async () => {
    const value = text.trim()
    if (!value || busy) return
    // If the AI check is still loading (fresh page), wait for it rather than silently saving offline.
    const useAi = ai ? ai.configured : (await fetchAiStatus()).configured
    if (!useAi) {
      if (manualKind === "task") {
        addTask({
          id: createId(), title: value.slice(0, 200), priority: "medium", dueDate: todayString(), category: "Personal",
          recurrence: "none", completed: false, subtasks: [], createdAt: new Date().toISOString(),
        })
        saved("task", value)
      } else {
        addNote(aiNoteToNote({ title: value.split("\n")[0].slice(0, 60), content: value }))
        saved("note", value)
      }
      return
    }
    controller.current?.abort()
    const ctl = new AbortController()
    controller.current = ctl
    setBusy(true)
    try {
      const out = await aiAssist("capture", value, ctl.signal)
      if (!ctl.signal.aborted) setPreview(out)
    } catch (err) {
      if (!ctl.signal.aborted) toast.error(err instanceof Error ? err.message : "Couldn't understand that.")
    } finally {
      if (!ctl.signal.aborted) setBusy(false)
    }
  }

  const confirm = () => {
    if (!preview) return
    const { kind } = preview
    if (kind === "task" && preview.task) {
      const t = aiTaskToTask(preview.task)
      addTask(t)
      return saved(kind, t.title)
    }
    if (kind === "event" && preview.event) {
      const e = aiEventToEvent(preview.event)
      addEvent(e)
      return saved(kind, e.title)
    }
    if (kind === "reminder" && preview.reminder) {
      const r = aiReminderToReminder(preview.reminder)
      addReminder(r)
      return saved(kind, r.title)
    }
    if (kind === "note" && preview.note) {
      const n = aiNoteToNote(preview.note)
      addNote(n)
      return saved(kind, n.title)
    }
    toast.error("Gemini's answer was incomplete. Try rephrasing.")
  }

  return (
    <section aria-labelledby="capture-title" className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="capture-title" className="flex items-center gap-2 font-semibold">
          {aiOn ? <Sparkles className="size-4.5 text-primary" aria-hidden /> : <Plus className="size-4.5 text-primary" aria-hidden />}
          Quick capture
        </h2>
        {aiOn ? (
          <span className="hidden text-xs text-muted-foreground sm:inline">Understood by Google Gemini</span>
        ) : (
          <div role="radiogroup" aria-label="Save as" className="flex rounded-lg bg-muted p-0.5 text-xs">
            {(["task", "note"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={manualKind === k}
                onClick={() => setManualKind(k)}
                className={cn("rounded-md px-2.5 py-1 font-medium transition-colors", manualKind === k ? "bg-card shadow-xs" : "text-muted-foreground")}
              >
                {KIND_META[k].label}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="flex gap-2"
      >
        <label htmlFor="quick-capture" className="sr-only">
          Add a task, event, reminder or note
        </label>
        <Input
          id="quick-capture"
          ref={inputRef}
          value={text}
          maxLength={1000}
          onChange={(e) => {
            setText(e.target.value)
            if (preview) setPreview(null)
          }}
          onKeyDown={(e) => e.key === "Escape" && (preview ? setPreview(null) : setText(""))}
          placeholder={aiOn ? "Add anything… “Dentist next Friday 4pm”" : manualKind === "task" ? "Add a task for today…" : "Write a quick note…"}
          className="h-12 text-base"
          autoComplete="off"
        />
        <Button type="submit" size="lg" disabled={!text.trim() || busy} aria-label={aiOn ? "Understand and preview" : "Add"} className="shrink-0">
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : aiOn ? <Sparkles aria-hidden /> : <Plus aria-hidden />}
          <span className="hidden sm:inline">{aiOn ? "Capture" : "Add"}</span>
        </Button>
      </form>

      {aiOn && !preview && !text && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setText(ex)
                inputRef.current?.focus()
              }}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <div aria-live="polite">
        <AnimatePresence>
          {preview && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-3 rounded-xl border bg-surface-muted p-3"
            >
              <CapturePreview capture={preview} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={confirm}>
                  <Check aria-hidden /> Add {KIND_META[preview.kind].label.toLowerCase()}
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link href={KIND_META[preview.kind].href} />}>
                  Open {KIND_META[preview.kind].label}s
                </Button>
                <Button variant="ghost" onClick={() => setPreview(null)}>
                  <X aria-hidden /> Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

function CapturePreview({ capture }: { capture: Capture }) {
  const meta = KIND_META[capture.kind]
  const Icon = meta.icon
  const lines: string[] = []
  let title = ""
  if (capture.kind === "task" && capture.task) {
    const t = capture.task
    title = t.title
    lines.push(`Due ${describeWhen(t.dueDate || undefined, t.dueTime || undefined)}`, `${t.priority} priority`)
    if (t.category) lines.push(t.category)
    if (t.recurrence !== "none") lines.push(`Repeats ${t.recurrence}`)
    if (t.subtasks?.length) lines.push(`${t.subtasks.length} subtasks`)
  } else if (capture.kind === "event" && capture.event) {
    const e = capture.event
    title = e.title
    lines.push(e.allDay || !e.startTime ? `${describeWhen(e.date)} · All day` : `${describeWhen(e.date, e.startTime)}${e.endTime ? `–${e.endTime}` : ""}`)
    if (e.location) lines.push(e.location)
    if (e.recurrence !== "none") lines.push(`Repeats ${e.recurrence}`)
    if (e.alertMinutes != null && e.alertMinutes >= 0) lines.push(e.alertMinutes ? `Alert ${e.alertMinutes} min before` : "Alert at start")
  } else if (capture.kind === "reminder" && capture.reminder) {
    const r = capture.reminder
    title = r.title
    lines.push(describeWhen(r.date, r.time))
    if (r.repeat !== "none") lines.push(`Repeats ${r.repeat}`)
  } else if (capture.kind === "note" && capture.note) {
    title = capture.note.title
    lines.push(capture.note.content.slice(0, 120) + (capture.note.content.length > 120 ? "…" : ""))
  }
  return (
    <div className="flex items-start gap-3">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", meta.accent)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">New {meta.label.toLowerCase()}</p>
        <p className="font-medium break-words">{title || "Untitled"}</p>
        <p className="mt-0.5 text-sm text-muted-foreground first-letter:uppercase">{lines.join(" · ")}</p>
      </div>
    </div>
  )
}
