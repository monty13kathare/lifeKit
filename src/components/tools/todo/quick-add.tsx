"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarClock, ListChecks, Loader2, Pencil, Plus, Repeat, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { aiAssist } from "@/lib/ai/client"
import { aiTaskToTask, describeWhen } from "@/lib/ai/convert"
import { cn } from "@/lib/utils"
import type { TaskPriority } from "@/types"
import { quickParse } from "./quick-parse"
import type { TaskDraft } from "./task-form"
import { dueLabel, PRIORITY_META, RECURRENCE_LABEL } from "./task-utils"

interface QuickAddProps {
  value: string
  onChange: (value: string) => void
  /** AI is configured on the server — enables the Smart add toggle. */
  aiConfigured: boolean
  /** Categories in use (for case-insensitive `#tag` matching). */
  categories: readonly string[]
  /** Defaults from the active filters. */
  defaults: { priority: TaskPriority; category: string }
  today: string
  /** Save a confirmed draft. The caller clears the input. */
  onAdd: (draft: TaskDraft) => void
  /** Open the full task form prefilled with this draft. */
  onEdit: (draft: TaskDraft) => void
}

export function QuickAdd({ value, onChange, aiConfigured, categories, defaults, today, onAdd, onEdit }: QuickAddProps) {
  const [smart, setSmart] = useState(true)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<TaskDraft | null>(null)
  const ctrl = useRef<AbortController | null>(null)
  const addBtn = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const smartOn = aiConfigured && smart

  useEffect(() => () => ctrl.current?.abort(), [])
  useEffect(() => {
    if (preview) addBtn.current?.focus()
  }, [preview])

  const local = useMemo(
    () => (!smartOn && value.trim() ? quickParse(value, { categories }) : null),
    [smartOn, value, categories]
  )

  const abort = () => {
    ctrl.current?.abort()
    ctrl.current = null
    setLoading(false)
  }

  const cancelPreview = (refocus = true) => {
    abort()
    setPreview(null)
    if (refocus) inputRef.current?.focus()
  }

  const localDraft = (text: string): TaskDraft => {
    const p = quickParse(text, { categories })
    return {
      title: p.title,
      priority: p.priority ?? defaults.priority,
      dueDate: p.dueDate,
      dueTime: p.dueTime,
      category: p.category ?? defaults.category,
      recurrence: p.recurrence,
      subtasks: [],
    }
  }

  const submit = async () => {
    const text = value.trim()
    if (!text || loading) return
    if (!smartOn) {
      onAdd(localDraft(text))
      return
    }
    abort()
    const c = new AbortController()
    ctrl.current = c
    setLoading(true)
    setPreview(null)
    try {
      const out = await aiAssist("parse-task", text, c.signal)
      if (c.signal.aborted) return
      const t = aiTaskToTask(out)
      const aiCategory = out.category?.trim()
      const category = aiCategory
        ? (categories.find((x) => x.toLowerCase() === aiCategory.toLowerCase()) ?? aiCategory)
        : defaults.category
      setPreview({
        title: t.title,
        notes: t.notes,
        priority: t.priority,
        dueDate: t.dueDate,
        dueTime: t.dueTime,
        category,
        recurrence: t.recurrence !== "none" && !t.dueDate ? "none" : t.recurrence,
        subtasks: t.subtasks,
      })
    } catch (err) {
      if (c.signal.aborted || (err as Error)?.name === "AbortError") return
      toast.error((err as Error)?.message || "Couldn't understand that task. Try again or turn off Smart add.")
    } finally {
      if (ctrl.current === c) {
        ctrl.current = null
        setLoading(false)
      }
    }
  }

  const change = (v: string) => {
    if (loading || preview) cancelPreview(false)
    onChange(v)
  }

  return (
    <div className="space-y-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="flex gap-2"
      >
        <label htmlFor="quick-add" className="sr-only">
          Quick add a task
        </label>
        <div className="relative min-w-0 flex-1">
          {smartOn ? (
            <Sparkles className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" aria-hidden />
          ) : null}
          <Input
            ref={inputRef}
            id="quick-add"
            value={value}
            onChange={(e) => change(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && (loading || preview)) {
                e.preventDefault()
                cancelPreview()
              }
            }}
            placeholder={smartOn ? "Describe a task, e.g. Pay rent on the 1st every month" : "Add a task and press Enter"}
            autoComplete="off"
            maxLength={500}
            aria-describedby="quick-add-hint"
            className={cn("h-11 bg-card", smartOn && "pl-9")}
          />
        </div>
        <Button
          type="submit"
          size="icon"
          className="size-11"
          aria-label={loading ? "Understanding task…" : smartOn ? "Smart add task" : "Add task"}
          disabled={!value.trim() || loading}
        >
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {aiConfigured ? (
          <button
            type="button"
            aria-pressed={smart}
            onClick={() => {
              cancelPreview(false)
              setSmart((s) => !s)
            }}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              smart ? "border-primary/40 bg-primary/10 text-primary" : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            <Sparkles className="size-3.5" aria-hidden />
            Smart add (Gemini)
            <span className="sr-only">{smart ? " on" : " off"}</span>
          </button>
        ) : null}
        <p id="quick-add-hint" className="min-w-0 text-xs text-muted-foreground">
          {smartOn ? (
            "Sent to Google Gemini to understand dates and priority"
          ) : (
            <>
              Try: <span className="font-medium text-foreground/80">Call bank tomorrow 10am !high #Work</span>
            </>
          )}
        </p>
      </div>

      {local?.recognised ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs" aria-label="Detected details">
          <span className="text-muted-foreground">Detected:</span>
          <Chip>
            <CalendarClock className="size-3.5" aria-hidden />
            {dueLabel(local, today)}
          </Chip>
          {local.priority ? <PriorityChip priority={local.priority} /> : null}
          {local.category ? <Chip>#{local.category}</Chip> : null}
          {local.recurrence !== "none" ? (
            <Chip>
              <Repeat className="size-3.5" aria-hidden />
              {RECURRENCE_LABEL[local.recurrence]}
            </Chip>
          ) : null}
        </div>
      ) : null}

      <div aria-live="polite">
        {preview ? (
          <section
            aria-label="Smart add preview"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault()
                cancelPreview()
              }
            }}
            className="rounded-2xl border border-primary/30 bg-card p-3 shadow-soft sm:p-4"
          >
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" aria-hidden /> Check before adding
            </p>
            <h3 className="font-medium wrap-break-word">{preview.title}</h3>
            {preview.notes ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{preview.notes}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <Chip>
                <CalendarClock className="size-3.5" aria-hidden />
                {describeWhen(preview.dueDate, preview.dueTime)}
              </Chip>
              <PriorityChip priority={preview.priority} />
              <Chip>{preview.category}</Chip>
              {preview.recurrence !== "none" ? (
                <Chip>
                  <Repeat className="size-3.5" aria-hidden />
                  {RECURRENCE_LABEL[preview.recurrence]}
                </Chip>
              ) : null}
            </div>
            {preview.subtasks.length ? (
              <div className="mt-2.5">
                <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <ListChecks className="size-3.5" aria-hidden /> {preview.subtasks.length} subtasks
                </p>
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {preview.subtasks.map((s) => (
                    <li key={s.id} className="wrap-break-word">
                      {s.title}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-3 gap-2 sm:flex sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => cancelPreview()}>
                <X aria-hidden /> Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const draft = preview
                  setPreview(null)
                  onEdit(draft)
                }}
              >
                <Pencil aria-hidden /> Edit
              </Button>
              <Button
                ref={addBtn}
                type="button"
                onClick={() => {
                  const draft = preview
                  setPreview(null)
                  onAdd(draft)
                }}
              >
                <Plus aria-hidden /> Add
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-muted px-2 font-medium text-muted-foreground">
      {children}
    </span>
  )
}

function PriorityChip({ priority }: { priority: TaskPriority }) {
  const meta = PRIORITY_META[priority]
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 font-medium", meta.badge)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
      <span className="sr-only"> priority</span>
    </span>
  )
}
