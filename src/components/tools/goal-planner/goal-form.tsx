"use client"

import { useEffect, useRef, useState } from "react"
import { Lightbulb, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Notice } from "@/components/common/notice"
import { FormField } from "@/components/tools/calendar/form-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { aiAssist } from "@/lib/ai/client"
import { createId } from "@/lib/storage/core"
import { cn } from "@/lib/utils"
import type { Goal, TaskPriority } from "@/types"
import { isDateString, nextPriority, PRIORITY_CLASS, PRIORITY_LABEL } from "./goal-utils"

/* ------------------------------------------------------------ draft model */

export interface DraftTask {
  id: string
  title: string
  dueDate: string
  priority: TaskPriority
  /** Create this as a real task on save. */
  include: boolean
}

export interface DraftMilestone {
  id: string
  title: string
  targetDate: string
  tasks: DraftTask[]
}

export interface GoalDraft {
  title: string
  why: string
  deadline: string
  milestones: DraftMilestone[]
}

const optDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")])

const schema = z.object({
  title: z.string().trim().min(1, "Give your goal a title").max(120, "Keep the title under 120 characters"),
  why: z.string().max(1000, "Keep this under 1000 characters"),
  deadline: optDate,
  milestones: z
    .array(
      z.object({
        title: z.string().trim().min(1, "Milestones need a title").max(200, "Keep milestone titles under 200 characters"),
        targetDate: optDate,
        tasks: z.array(
          z.object({
            title: z.string().max(200, "Keep task titles under 200 characters"),
            dueDate: optDate,
            include: z.boolean(),
          })
        ),
      })
    )
    .max(12, "Up to 12 milestones"),
})

type Errors = Record<string, string>

function validate(draft: GoalDraft): Errors | null {
  const res = schema.safeParse(draft)
  const errors: Errors = {}
  if (!res.success) {
    for (const issue of res.error.issues) {
      const key = issue.path.join(".")
      if (!errors[key]) errors[key] = issue.message
    }
  }
  draft.milestones.forEach((m, mi) =>
    m.tasks.forEach((t, ti) => {
      if (t.include && !t.title.trim()) errors[`milestones.${mi}.tasks.${ti}.title`] = "Add a title or untick this task"
    })
  )
  return Object.keys(errors).length ? errors : null
}

/* ------------------------------------------------------------- component */

interface GoalFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Editing an existing goal (details only — milestones are edited in the detail view). */
  goal?: Goal
  aiEnabled: boolean
  onSubmit: (draft: GoalDraft) => void
}

const FORM_ID = "goal-form"

export function GoalFormSheet(props: GoalFormSheetProps) {
  const key = props.open ? (props.goal?.id ?? "new") : "closed"
  const editing = !!props.goal
  return (
    <ResponsiveSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      size="lg"
      title={editing ? "Edit goal" : "New goal"}
      description={editing ? undefined : "Say what you want and why, then break it into milestones."}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button type="button" variant="outline" size="lg" className="flex-1 sm:h-10 sm:flex-none" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} size="lg" className="flex-1 sm:h-10 sm:flex-none">
            {editing ? "Save changes" : "Create goal"}
          </Button>
        </div>
      }
    >
      <GoalForm key={key} {...props} />
    </ResponsiveSheet>
  )
}

function emptyMilestone(): DraftMilestone {
  return { id: createId(), title: "", targetDate: "", tasks: [] }
}

function GoalForm({ goal, aiEnabled, onSubmit }: GoalFormSheetProps) {
  const editing = !!goal
  const [draft, setDraft] = useState<GoalDraft>(() => ({
    title: goal?.title ?? "",
    why: goal?.why ?? "",
    deadline: goal?.deadline ?? "",
    milestones: [],
  }))
  const [errors, setErrors] = useState<Errors>({})
  const [hours, setHours] = useState("")
  const [ai, setAi] = useState<{ loading: boolean; summary?: string; tips?: string[] }>({ loading: false })
  const ctrl = useRef<AbortController | null>(null)

  useEffect(() => () => ctrl.current?.abort(), [])

  const patch = (p: Partial<GoalDraft>) => setDraft((d) => ({ ...d, ...p }))
  const patchMilestone = (id: string, p: Partial<DraftMilestone>) =>
    setDraft((d) => ({ ...d, milestones: d.milestones.map((m) => (m.id === id ? { ...m, ...p } : m)) }))
  const patchTask = (mid: string, tid: string, p: Partial<DraftTask>) =>
    setDraft((d) => ({
      ...d,
      milestones: d.milestones.map((m) => (m.id === mid ? { ...m, tasks: m.tasks.map((t) => (t.id === tid ? { ...t, ...p } : t)) } : m)),
    }))

  const planWithAi = async () => {
    const goalText = draft.title.trim()
    if (!goalText) {
      setErrors({ title: "Describe your goal first so Gemini can plan it" })
      return
    }
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setAi({ loading: true })
    try {
      const hoursNum = Number(hours)
      const input = {
        goal: goalText,
        ...(isDateString(draft.deadline) ? { deadline: draft.deadline } : {}),
        ...(hours && Number.isFinite(hoursNum) && hoursNum > 0 ? { hoursPerWeek: Math.min(80, hoursNum) } : {}),
        ...(draft.why.trim() ? { context: draft.why.trim() } : {}),
      }
      const out = await aiAssist("goal-plan", JSON.stringify(input), c.signal)
      if (c.signal.aborted) return
      const milestones: DraftMilestone[] = out.milestones.map((m) => ({
        id: createId(),
        title: m.title,
        targetDate: isDateString(m.targetDate) ? m.targetDate : "",
        tasks: m.tasks.map((t) => ({
          id: createId(),
          title: t.title,
          dueDate: isDateString(t.dueDate) ? t.dueDate : "",
          priority: t.priority,
          include: true,
        })),
      }))
      setDraft((d) => ({ ...d, milestones }))
      setAi({ loading: false, summary: out.summary, tips: out.tips })
      setErrors({})
    } catch (err) {
      if (c.signal.aborted || (err as Error)?.name === "AbortError") return
      setAi({ loading: false })
      toast.error((err as Error)?.message || "Couldn't plan this goal right now.")
    } finally {
      if (ctrl.current === c) ctrl.current = null
    }
  }

  const cancelAi = () => {
    ctrl.current?.abort()
    ctrl.current = null
    setAi((a) => ({ ...a, loading: false }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate(draft)
    if (errs) {
      setErrors(errs)
      toast.error("Please fix the highlighted fields.")
      return
    }
    onSubmit(draft)
  }

  const taskCount = draft.milestones.reduce((n, m) => n + m.tasks.filter((t) => t.include && t.title.trim()).length, 0)

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-4">
        <FormField label="Goal" error={errors.title}>
          {(p) => (
            <Input
              {...p}
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="e.g. Run a half marathon"
              maxLength={160}
              className="h-11"
              autoFocus={!editing}
            />
          )}
        </FormField>
        <FormField label="Why it matters (optional)" error={errors.why} hint="Your motivation — shown on the goal to keep you going.">
          {(p) => (
            <Textarea
              {...p}
              value={draft.why}
              onChange={(e) => patch({ why: e.target.value })}
              placeholder="e.g. Get fitter and prove to myself I can stick with something"
              rows={2}
              maxLength={1200}
            />
          )}
        </FormField>
        <FormField label="Deadline (optional)" error={errors.deadline} className="sm:max-w-56">
          {(p) => <Input {...p} type="date" value={draft.deadline} onChange={(e) => patch({ deadline: e.target.value })} className="h-11" />}
        </FormField>
      </div>

      {editing ? null : (
        <section aria-labelledby="goal-milestones-heading" className="space-y-3 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="goal-milestones-heading" className="text-sm font-semibold">
              Milestones <span className="font-normal text-muted-foreground">({draft.milestones.length})</span>
            </h3>
            <Button type="button" variant="outline" onClick={() => patch({ milestones: [...draft.milestones, emptyMilestone()] })}>
              <Plus aria-hidden /> Add milestone
            </Button>
          </div>

          {aiEnabled ? (
            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <FormField label="Hours per week (optional)" className="sm:w-44">
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={80}
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      placeholder="e.g. 5"
                      className="h-10"
                    />
                  )}
                </FormField>
                {ai.loading ? (
                  <Button type="button" variant="outline" onClick={cancelAi}>
                    <X aria-hidden /> Cancel
                  </Button>
                ) : (
                  <Button type="button" onClick={planWithAi}>
                    <Sparkles aria-hidden /> {draft.milestones.length ? "Re-plan with AI" : "Plan with AI"}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Your goal, motivation and deadline are sent to Google Gemini.{" "}
                {draft.milestones.length ? "Re-planning replaces the milestones below." : null}
              </p>
              <div aria-live="polite">
                {ai.loading ? (
                  <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Planning your milestones…
                  </p>
                ) : ai.summary ? (
                  <div className="space-y-2">
                    <p className="text-sm">{ai.summary}</p>
                    {ai.tips?.length ? (
                      <ul className="space-y-1.5" aria-label="Tips from the plan">
                        {ai.tips.map((tip, i) => (
                          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                            <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="text-xs text-muted-foreground">Review and edit the plan below — untick tasks you don&apos;t want created.</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {errors.milestones ? <p className="text-xs font-medium text-destructive">{errors.milestones}</p> : null}

          {draft.milestones.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No milestones yet. Add them now or later from the goal.
            </p>
          ) : (
            <ol className="space-y-3">
              {draft.milestones.map((m, mi) => (
                <li key={m.id} className="space-y-3 rounded-xl border bg-card p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {mi + 1}
                    </span>
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_10rem]">
                      <FormField label={`Milestone ${mi + 1} title`} hideLabel error={errors[`milestones.${mi}.title`]}>
                        {(p) => (
                          <Input
                            {...p}
                            value={m.title}
                            onChange={(e) => patchMilestone(m.id, { title: e.target.value })}
                            placeholder="Milestone title"
                            maxLength={220}
                          />
                        )}
                      </FormField>
                      <FormField label={`Milestone ${mi + 1} target date`} hideLabel error={errors[`milestones.${mi}.targetDate`]}>
                        {(p) => <Input {...p} type="date" value={m.targetDate} onChange={(e) => patchMilestone(m.id, { targetDate: e.target.value })} />}
                      </FormField>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground"
                      aria-label={`Remove milestone ${mi + 1}`}
                      onClick={() => patch({ milestones: draft.milestones.filter((x) => x.id !== m.id) })}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>

                  {m.tasks.length ? (
                    <ul className="space-y-2 sm:pl-8" aria-label={`Tasks for milestone ${mi + 1}`}>
                      {m.tasks.map((t, ti) => (
                        <li key={t.id} className={cn("rounded-lg border bg-surface p-2", !t.include && "opacity-60")}>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={t.include}
                              onCheckedChange={(v) => patchTask(m.id, t.id, { include: !!v })}
                              aria-label={`Create task "${t.title || "untitled"}"`}
                              className="size-5"
                            />
                            <Input
                              value={t.title}
                              onChange={(e) => patchTask(m.id, t.id, { title: e.target.value })}
                              aria-label={`Task ${ti + 1} title`}
                              aria-invalid={errors[`milestones.${mi}.tasks.${ti}.title`] ? true : undefined}
                              placeholder="Task title"
                              maxLength={220}
                              className="min-w-0 flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground"
                              aria-label={`Remove task ${ti + 1}`}
                              onClick={() => patchMilestone(m.id, { tasks: m.tasks.filter((x) => x.id !== t.id) })}
                            >
                              <X aria-hidden />
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                            <Input
                              type="date"
                              value={t.dueDate}
                              onChange={(e) => patchTask(m.id, t.id, { dueDate: e.target.value })}
                              aria-label={`Task ${ti + 1} due date`}
                              className="h-10 w-40"
                            />
                            <button
                              type="button"
                              onClick={() => patchTask(m.id, t.id, { priority: nextPriority(t.priority) })}
                              aria-label={`Priority: ${PRIORITY_LABEL[t.priority]}. Tap to change.`}
                              className={cn(
                                "inline-flex h-10 min-w-20 items-center justify-center rounded-lg px-3 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                                PRIORITY_CLASS[t.priority]
                              )}
                            >
                              {PRIORITY_LABEL[t.priority]}
                            </button>
                          </div>
                          {errors[`milestones.${mi}.tasks.${ti}.title`] ? (
                            <p className="mt-1 pl-7 text-xs font-medium text-destructive">{errors[`milestones.${mi}.tasks.${ti}.title`]}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="sm:pl-8">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() =>
                        patchMilestone(m.id, {
                          tasks: [...m.tasks, { id: createId(), title: "", dueDate: m.targetDate, priority: "medium", include: true }],
                        })
                      }
                    >
                      <Plus aria-hidden /> Add task
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {taskCount ? (
            <Notice tone="info">
              Saving creates {taskCount} {taskCount === 1 ? "task" : "tasks"} in Tasks, linked to their milestones.
            </Notice>
          ) : null}
        </section>
      )}
    </form>
  )
}
