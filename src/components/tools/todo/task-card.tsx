"use client"

import { useId, useState } from "react"
import { motion } from "framer-motion"
import { CalendarClock, ChevronDown, ListChecks, MoreVertical, Pencil, Plus, Repeat, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useNow } from "@/components/tools/calendar/use-now"
import { toDateString } from "@/lib/dates"
import { createId } from "@/lib/storage/core"
import { cn } from "@/lib/utils"
import type { Subtask, Task } from "@/types"
import { dueLabel, isOverdue, PRIORITY_META, RECURRENCE_LABEL } from "./task-utils"

/** Round, animated completion checkbox. */
export function CheckCircle({
  checked,
  onToggle,
  label,
  size = "md",
}: {
  checked: boolean
  onToggle: () => void
  label: string
  size?: "sm" | "md"
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="group/check -m-2 flex size-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <motion.span
        initial={false}
        animate={{ scale: checked ? [1, 1.25, 1] : 1 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "flex items-center justify-center rounded-full border-2 transition-colors",
          size === "sm" ? "size-5" : "size-6",
          checked
            ? "border-success bg-success text-success-foreground"
            : "border-muted-foreground/40 group-hover/check:border-primary"
        )}
      >
        <svg viewBox="0 0 24 24" className={size === "sm" ? "size-3" : "size-3.5"} fill="none" aria-hidden>
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.25, delay: checked ? 0.05 : 0 }}
          />
        </svg>
      </motion.span>
    </button>
  )
}

export interface TaskCardProps {
  task: Task
  onToggle: (task: Task) => void
  onEdit?: (task: Task) => void
  onDelete?: (task: Task) => void
  /** Enables inline subtask add/toggle/delete. */
  onSubtasksChange?: (task: Task, subtasks: Subtask[]) => void
  /** Smaller card for dashboards: no menu, no subtask panel. */
  compact?: boolean
  className?: string
}

export function TaskCard({ task, onToggle, onEdit, onDelete, onSubtasksChange, compact, className }: TaskCardProps) {
  const now = useNow()
  const today = toDateString(now)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState("")
  const panelId = useId()
  const meta = PRIORITY_META[task.priority] ?? PRIORITY_META.medium
  const overdue = isOverdue(task, today)
  const due = dueLabel(task, today)
  const doneCount = task.subtasks.filter((s) => s.done).length
  const total = task.subtasks.length
  const canEditSubtasks = !!onSubtasksChange && !compact

  const setSubtasks = (subtasks: Subtask[]) => onSubtasksChange?.(task, subtasks)
  const addSubtask = () => {
    const title = draft.trim()
    if (!title) return
    setSubtasks([...task.subtasks, { id: createId(), title, done: false }])
    setDraft("")
  }

  return (
    <article
      className={cn(
        "rounded-2xl border border-l-4 bg-card shadow-soft transition-colors",
        meta.accent,
        overdue && "bg-destructive/4 ring-1 ring-destructive/25",
        task.completed && "opacity-75",
        compact ? "p-2.5" : "p-3 sm:p-3.5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5 pl-0.5">
          <CheckCircle
            checked={task.completed}
            onToggle={() => onToggle(task)}
            label={task.completed ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
            size={compact ? "sm" : "md"}
          />
        </div>

        <div className="min-w-0 flex-1">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="block w-full rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <TaskTitle task={task} compact={compact} />
            </button>
          ) : (
            <TaskTitle task={task} compact={compact} />
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            {due ? (
              <span
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full px-2 font-medium",
                  overdue
                    ? "bg-destructive/12 text-destructive"
                    : task.dueDate === today
                      ? "bg-primary/10 text-primary"
                      : "bg-surface-muted text-muted-foreground"
                )}
              >
                <CalendarClock className="size-3.5" aria-hidden />
                {overdue ? `Overdue · ${due}` : due}
              </span>
            ) : null}
            <span className="inline-flex h-6 items-center rounded-full border px-2 font-medium text-muted-foreground">
              {task.category}
            </span>
            {!compact ? (
              <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 font-medium", meta.badge)}>
                <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
                {meta.label}
                <span className="sr-only"> priority</span>
              </span>
            ) : null}
            {task.recurrence !== "none" ? (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-muted px-2 text-muted-foreground">
                <Repeat className="size-3.5" aria-hidden />
                {RECURRENCE_LABEL[task.recurrence]}
              </span>
            ) : null}
            {total > 0 ? (
              canEditSubtasks ? (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-muted px-2 font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <ListChecks className="size-3.5" aria-hidden />
                  {doneCount}/{total}
                  <span className="sr-only"> subtasks done</span>
                  <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
                </button>
              ) : (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-muted px-2 font-medium text-muted-foreground">
                  <ListChecks className="size-3.5" aria-hidden />
                  {doneCount}/{total}
                  <span className="sr-only"> subtasks done</span>
                </span>
              )
            ) : null}
          </div>

          {total > 0 && !compact ? (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-success transition-[width] duration-300"
                style={{ width: `${(doneCount / total) * 100}%` }}
              />
            </div>
          ) : null}

          {canEditSubtasks && expanded ? (
            <div id={panelId} className="mt-3 space-y-1">
              <ul className="space-y-0.5" aria-label="Subtasks">
                {task.subtasks.map((s) => (
                  <li key={s.id} className="group/sub flex min-h-10 items-center gap-2.5 rounded-lg px-1 hover:bg-surface-muted">
                    <Checkbox
                      checked={s.done}
                      onCheckedChange={(checked) =>
                        setSubtasks(task.subtasks.map((x) => (x.id === s.id ? { ...x, done: !!checked } : x)))
                      }
                      aria-label={s.title}
                      className="size-5"
                    />
                    <span className={cn("min-w-0 flex-1 truncate text-sm", s.done && "text-muted-foreground line-through")}>
                      {s.title}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete subtask "${s.title}"`}
                      onClick={() => setSubtasks(task.subtasks.filter((x) => x.id !== s.id))}
                      className="text-muted-foreground opacity-100 hover:text-destructive sm:opacity-0 sm:group-hover/sub:opacity-100 sm:focus-visible:opacity-100"
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
              <form
                className="flex items-center gap-2 pt-1"
                onSubmit={(e) => {
                  e.preventDefault()
                  addSubtask()
                }}
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a subtask"
                  aria-label="New subtask"
                  className="h-9"
                  maxLength={200}
                />
                <Button type="submit" size="icon" variant="outline" aria-label="Add subtask" disabled={!draft.trim()}>
                  <Plus aria-hidden />
                </Button>
              </form>
            </div>
          ) : null}
        </div>

        {!compact && (onEdit || onDelete || canEditSubtasks) ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="-mt-1 -mr-1.5 text-muted-foreground" aria-label={`Actions for "${task.title}"`} />
              }
            >
              <MoreVertical aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {onEdit ? (
                <DropdownMenuItem onClick={() => onEdit(task)}>
                  <Pencil aria-hidden /> Edit
                </DropdownMenuItem>
              ) : null}
              {canEditSubtasks ? (
                <DropdownMenuItem onClick={() => setExpanded(true)}>
                  <ListChecks aria-hidden /> {total ? "Show subtasks" : "Add subtasks"}
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
                  <Trash2 aria-hidden /> Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </article>
  )
}

function TaskTitle({ task, compact }: { task: Task; compact?: boolean }) {
  return (
    <>
      <span
        className={cn(
          "block font-medium wrap-break-word",
          compact ? "text-sm" : "text-[0.95rem]",
          task.completed && "text-muted-foreground line-through decoration-muted-foreground/60"
        )}
      >
        {task.title}
      </span>
      {task.notes && !compact ? (
        <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">{task.notes}</span>
      ) : null}
    </>
  )
}
