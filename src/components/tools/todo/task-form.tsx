"use client"

import { useId, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Trash2, X } from "lucide-react"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/tools/calendar/form-field"
import { createId } from "@/lib/storage/core"
import { cn } from "@/lib/utils"
import type { Subtask, Task, TaskPriority } from "@/types"
import { BreakDownButton, SubtaskSuggestionList, useSubtaskSuggestions } from "./ai-subtasks"
import { PRESET_CATEGORIES, PRIORITY_META, RECURRENCE_LABEL } from "./task-utils"

const schema = z
  .object({
    title: z.string().trim().min(1, "Give your task a title").max(200, "Keep the title under 200 characters"),
    notes: z.string().max(2000, "Notes are limited to 2000 characters"),
    priority: z.enum(["low", "medium", "high"]),
    dueDate: z.string(),
    dueTime: z.string(),
    category: z.string().trim().min(1, "Choose or type a category").max(40, "Keep categories under 40 characters"),
    recurrence: z.enum(["none", "daily", "weekly", "monthly"]),
  })
  .superRefine((v, ctx) => {
    if (v.dueTime && !v.dueDate) ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Add a due date for this time" })
    if (v.recurrence !== "none" && !v.dueDate)
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Repeating tasks need a due date" })
  })

type FormValues = z.infer<typeof schema>

export type TaskDraft = Omit<Task, "id" | "createdAt" | "completed" | "completedAt">

interface TaskFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Task being edited; undefined for a new task. */
  task?: Task
  /** Prefill for new tasks. */
  defaults?: Partial<TaskDraft>
  /** Custom categories already in use (shown next to presets). */
  categories: string[]
  onSubmit: (draft: TaskDraft) => void
  onDelete?: (task: Task) => void
  /** Show Gemini-powered helpers (only when AI is configured). */
  aiEnabled?: boolean
}

const PRIORITIES: TaskPriority[] = ["low", "medium", "high"]
const RECURRENCE_ITEMS = (Object.keys(RECURRENCE_LABEL) as Task["recurrence"][]).map((value) => ({
  value,
  label: RECURRENCE_LABEL[value],
}))

/** Wrapper that remounts the form whenever it opens for a different task. */
export function TaskFormSheet(props: TaskFormSheetProps) {
  const key = props.open ? (props.task?.id ?? "new") : "closed"
  return (
    <ResponsiveSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={props.task ? "Edit task" : "New task"}
      description={props.task ? undefined : "Add the details now or later — only the title is required."}
      footer={<FormFooter {...props} />}
    >
      <TaskForm key={key} {...props} />
    </ResponsiveSheet>
  )
}

const FORM_ID = "task-form"

function FormFooter({ task, onOpenChange, onDelete }: TaskFormSheetProps) {
  return (
    <div className="flex w-full items-center gap-2">
      {task && onDelete ? (
        <Button type="button" variant="destructive" size="lg" className="sm:h-10" onClick={() => onDelete(task)}>
          <Trash2 aria-hidden /> <span className="sr-only sm:not-sr-only">Delete</span>
        </Button>
      ) : null}
      <div className="flex flex-1 justify-end gap-2">
        <Button type="button" variant="outline" size="lg" className="flex-1 sm:h-10 sm:flex-none" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" form={FORM_ID} size="lg" className="flex-1 sm:h-10 sm:flex-none">
          {task ? "Save changes" : "Create task"}
        </Button>
      </div>
    </div>
  )
}

function TaskForm({ task, defaults, categories, onSubmit, aiEnabled }: TaskFormSheetProps) {
  const initial = task ?? defaults
  const [subtasks, setSubtasks] = useState<Subtask[]>(
    () => task?.subtasks ?? (defaults?.subtasks ?? []).map((s) => ({ ...s, id: s.id || createId() }))
  )
  const suggestions = useSubtaskSuggestions()
  const [subDraft, setSubDraft] = useState("")
  const initialCategory = initial?.category ?? "Personal"
  const allCategories = Array.from(new Set([...PRESET_CATEGORIES, ...categories, initialCategory]))
  const [customMode, setCustomMode] = useState(false)
  const customId = useId()

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initial?.title ?? "",
      notes: initial?.notes ?? "",
      priority: initial?.priority ?? "medium",
      dueDate: initial?.dueDate ?? "",
      dueTime: initial?.dueTime ?? "",
      category: initialCategory,
      recurrence: initial?.recurrence ?? "none",
    },
  })

  const category = useWatch({ control, name: "category" })
  const dueDate = useWatch({ control, name: "dueDate" })
  const title = useWatch({ control, name: "title" })

  const addSuggested = () => {
    const titles = suggestions.selectedTitles
    if (!titles.length) return
    setSubtasks((s) => [...s, ...titles.map((t) => ({ id: createId(), title: t, done: false }))])
    suggestions.cancel()
  }

  const addSub = () => {
    const title = subDraft.trim()
    if (!title) return
    setSubtasks((s) => [...s, { id: createId(), title, done: false }])
    setSubDraft("")
  }

  return (
    <form
      id={FORM_ID}
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit((v) => {
        onSubmit({
          title: v.title,
          notes: v.notes.trim() || undefined,
          priority: v.priority,
          dueDate: v.dueDate || undefined,
          dueTime: v.dueDate && v.dueTime ? v.dueTime : undefined,
          category: v.category,
          recurrence: v.recurrence,
          subtasks: subDraft.trim() ? [...subtasks, { id: createId(), title: subDraft.trim(), done: false }] : subtasks,
        })
      })}
    >
      <FormField label="Title" error={errors.title?.message}>
        {(p) => <Input {...p} {...register("title")} placeholder="e.g. Renew passport" autoComplete="off" className="h-11" />}
      </FormField>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Priority</legend>
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <div role="radiogroup" aria-label="Priority" className="grid grid-cols-3 gap-2">
              {PRIORITIES.map((p) => {
                const selected = field.value === p
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => field.onChange(p)}
                    className={cn(
                      "flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected ? cn(PRIORITY_META[p].badge, "border-current") : "hover:bg-muted"
                    )}
                  >
                    <span className={cn("size-2 rounded-full", PRIORITY_META[p].dot)} aria-hidden />
                    {PRIORITY_META[p].label}
                  </button>
                )
              })}
            </div>
          )}
        />
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Due date" error={errors.dueDate?.message}>
          {(p) => <Input {...p} type="date" {...register("dueDate")} className="h-11" />}
        </FormField>
        <FormField label="Due time" error={errors.dueTime?.message} hint={dueDate ? undefined : "Optional"}>
          {(p) => <Input {...p} type="time" {...register("dueTime")} className="h-11" />}
        </FormField>
      </div>
      {dueDate ? (
        <div className="-mt-2 flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setValue("dueDate", ""); setValue("dueTime", "") }}>
            <X aria-hidden /> Clear date
          </Button>
        </div>
      ) : null}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Category</legend>
        <div className="flex flex-wrap gap-2">
          {allCategories.map((c) => {
            const selected = !customMode && category === c
            return (
              <button
                key={c}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setCustomMode(false)
                  setValue("category", c, { shouldValidate: true })
                }}
                className={cn(
                  "h-10 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
                )}
              >
                {c}
              </button>
            )
          })}
          <button
            type="button"
            aria-pressed={customMode}
            aria-controls={customId}
            onClick={() => {
              setCustomMode(true)
              setValue("category", "")
            }}
            className={cn(
              "inline-flex h-10 items-center gap-1 rounded-full border border-dashed px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              customMode ? "border-primary text-primary" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Plus className="size-4" aria-hidden /> Custom
          </button>
        </div>
        {customMode ? (
          <div id={customId} className="mt-2">
            <FormField label="Custom category" hideLabel error={errors.category?.message}>
              {(p) => <Input {...p} {...register("category")} placeholder="e.g. Finance" autoFocus maxLength={40} className="h-11" />}
            </FormField>
          </div>
        ) : errors.category ? (
          <p className="mt-1.5 text-xs font-medium text-destructive">{errors.category.message}</p>
        ) : null}
      </fieldset>

      <FormField label="Repeat" error={errors.recurrence?.message}>
        {(p) => (
          <Controller
            control={control}
            name="recurrence"
            render={({ field }) => (
              <Select items={RECURRENCE_ITEMS} value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                <SelectTrigger id={p.id} aria-describedby={p["aria-describedby"]} className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_ITEMS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            Subtasks{" "}
            {subtasks.length ? (
              <span className="font-normal text-muted-foreground">
                ({subtasks.filter((s) => s.done).length}/{subtasks.length})
              </span>
            ) : null}
          </p>
          {aiEnabled && !suggestions.items ? (
            <BreakDownButton
              loading={suggestions.loading}
              disabled={!title?.trim()}
              onClick={() => void suggestions.run(getValues("title"), getValues("notes"))}
            />
          ) : null}
        </div>
        {aiEnabled && (suggestions.loading || suggestions.items) ? (
          <div className="mb-3 rounded-xl border border-dashed p-2.5">
            <SubtaskSuggestionList s={suggestions} />
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={suggestions.cancel}>
                {suggestions.loading ? "Cancel" : "Dismiss"}
              </Button>
              {suggestions.items ? (
                <Button type="button" size="sm" onClick={addSuggested} disabled={!suggestions.selectedTitles.length}>
                  Add selected
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {subtasks.length ? (
          <ul className="mb-2 space-y-1" aria-label="Subtasks">
            {subtasks.map((s) => (
              <li key={s.id} className="flex min-h-10 items-center gap-2.5 rounded-lg border bg-surface px-2.5">
                <Checkbox
                  checked={s.done}
                  onCheckedChange={(c) => setSubtasks((all) => all.map((x) => (x.id === s.id ? { ...x, done: !!c } : x)))}
                  aria-label={s.title}
                  className="size-5"
                />
                <span className={cn("min-w-0 flex-1 truncate text-sm", s.done && "text-muted-foreground line-through")}>{s.title}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove subtask "${s.title}"`}
                  onClick={() => setSubtasks((all) => all.filter((x) => x.id !== s.id))}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex gap-2">
          <Input
            value={subDraft}
            onChange={(e) => setSubDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addSub()
              }
            }}
            placeholder="Add a subtask and press Enter"
            aria-label="New subtask"
            maxLength={200}
            className="h-11"
          />
          <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Add subtask" onClick={addSub} disabled={!subDraft.trim()}>
            <Plus aria-hidden />
          </Button>
        </div>
      </div>

      <FormField label="Notes" error={errors.notes?.message}>
        {(p) => <Textarea {...p} {...register("notes")} rows={3} placeholder="Anything worth remembering" />}
      </FormField>
    </form>
  )
}
