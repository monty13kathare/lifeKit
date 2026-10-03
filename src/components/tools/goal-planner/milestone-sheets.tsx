"use client"

import { useState } from "react"
import { z } from "zod"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { FormField } from "@/components/tools/calendar/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { GoalMilestone, TaskPriority } from "@/types"
import { PRIORITIES, PRIORITY_LABEL } from "./goal-utils"

const optDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")])

const milestoneSchema = z.object({
  title: z.string().trim().min(1, "Give the milestone a title").max(200, "Keep it under 200 characters"),
  targetDate: optDate,
})

const taskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200, "Keep it under 200 characters"),
  dueDate: optDate,
  priority: z.enum(["low", "medium", "high"]),
})

function issuesToErrors(issues: z.ZodError["issues"]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) {
    const k = String(i.path[0] ?? "")
    if (!out[k]) out[k] = i.message
  }
  return out
}

function Footer({ formId, onCancel, label }: { formId: string; onCancel: () => void; label: string }) {
  return (
    <div className="flex w-full justify-end gap-2">
      <Button type="button" variant="outline" size="lg" className="flex-1 sm:h-10 sm:flex-none" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" form={formId} size="lg" className="flex-1 sm:h-10 sm:flex-none">
        {label}
      </Button>
    </div>
  )
}

/* ---------------------------------------------------------- milestone sheet */

export function MilestoneSheet({
  open,
  onOpenChange,
  milestone,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  milestone?: GoalMilestone
  onSubmit: (v: { title: string; targetDate: string }) => void
}) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={milestone ? "Edit milestone" : "Add milestone"}
      footer={<Footer formId="milestone-form" onCancel={() => onOpenChange(false)} label={milestone ? "Save" : "Add milestone"} />}
    >
      <MilestoneForm key={open ? (milestone?.id ?? "new") : "closed"} milestone={milestone} onSubmit={onSubmit} />
    </ResponsiveSheet>
  )
}

function MilestoneForm({ milestone, onSubmit }: { milestone?: GoalMilestone; onSubmit: (v: { title: string; targetDate: string }) => void }) {
  const [title, setTitle] = useState(milestone?.title ?? "")
  const [targetDate, setTargetDate] = useState(milestone?.targetDate ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  return (
    <form
      id="milestone-form"
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        const res = milestoneSchema.safeParse({ title, targetDate })
        if (!res.success) return setErrors(issuesToErrors(res.error.issues))
        onSubmit({ title: res.data.title, targetDate: res.data.targetDate })
      }}
    >
      <FormField label="Title" error={errors.title}>
        {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={220} className="h-11" autoFocus />}
      </FormField>
      <FormField label="Target date (optional)" error={errors.targetDate}>
        {(p) => <Input {...p} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="h-11" />}
      </FormField>
    </form>
  )
}

/* --------------------------------------------------------------- task sheet */

export interface MilestoneTaskInput {
  title: string
  dueDate: string
  priority: TaskPriority
}

export function AddTaskSheet({
  open,
  onOpenChange,
  milestoneTitle,
  defaultDueDate,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  milestoneTitle?: string
  defaultDueDate?: string
  onSubmit: (v: MilestoneTaskInput) => void
}) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="Add task"
      description={milestoneTitle ? `Creates a task in Tasks linked to "${milestoneTitle}".` : undefined}
      footer={<Footer formId="milestone-task-form" onCancel={() => onOpenChange(false)} label="Add task" />}
    >
      <AddTaskForm key={open ? "open" : "closed"} defaultDueDate={defaultDueDate} onSubmit={onSubmit} />
    </ResponsiveSheet>
  )
}

function AddTaskForm({ defaultDueDate, onSubmit }: { defaultDueDate?: string; onSubmit: (v: MilestoneTaskInput) => void }) {
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState(defaultDueDate ?? "")
  const [priority, setPriority] = useState<TaskPriority>("medium")
  const [errors, setErrors] = useState<Record<string, string>>({})
  return (
    <form
      id="milestone-task-form"
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        const res = taskSchema.safeParse({ title, dueDate, priority })
        if (!res.success) return setErrors(issuesToErrors(res.error.issues))
        onSubmit(res.data)
      }}
    >
      <FormField label="Task" error={errors.title}>
        {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={220} className="h-11" autoFocus />}
      </FormField>
      <FormField label="Due date (optional)" error={errors.dueDate}>
        {(p) => <Input {...p} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-11" />}
      </FormField>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Priority</legend>
        <div role="radiogroup" aria-label="Priority" className="grid grid-cols-3 gap-1 rounded-xl bg-surface-muted p-1">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={priority === p}
              onClick={() => setPriority(p)}
              className={cn(
                "h-10 rounded-lg text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                priority === p ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
      </fieldset>
    </form>
  )
}
