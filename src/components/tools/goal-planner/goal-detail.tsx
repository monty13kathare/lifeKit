"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarDays,
  Check,
  CircleCheck,
  ExternalLink,
  MoreVertical,
  Pencil,
  Plus,
  Repeat,
  RotateCcw,
  Trash2,
  Trophy,
} from "lucide-react"
import { toast } from "sonner"
import { ProgressRing } from "@/components/common/progress-ring"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useGoals, useTasks } from "@/hooks/use-lifekit-data"
import { createId } from "@/lib/storage/core"
import { cn } from "@/lib/utils"
import type { Goal, GoalMilestone, Task } from "@/types"
import { AddTaskSheet, MilestoneSheet, type MilestoneTaskInput } from "./milestone-sheets"
import { deadlineInfo, formatShort, goalProgress, milestoneTasks, newTask, PRIORITY_CLASS, PRIORITY_LABEL } from "./goal-utils"

interface GoalDetailProps {
  goal: Goal
  today: Date
  onBack: () => void
  onEdit: (goal: Goal) => void
  onDelete: (goal: Goal) => void
}

export function GoalDetail({ goal, today, onBack, onEdit, onDelete }: GoalDetailProps) {
  const { update: updateGoal } = useGoals()
  const { tasks, add: addTask, update: updateTask } = useTasks()
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const progress = goalProgress(goal, byId)
  const deadline = goal.status === "active" ? deadlineInfo(goal.deadline, today) : null
  const reduceMotion = useReducedMotion()

  const [milestoneSheet, setMilestoneSheet] = useState<{ open: boolean; milestone?: GoalMilestone }>({ open: false })
  const [taskSheet, setTaskSheet] = useState<{ open: boolean; milestone?: GoalMilestone }>({ open: false })

  const setMilestones = (fn: (ms: GoalMilestone[]) => GoalMilestone[]) => updateGoal(goal.id, (g) => ({ ...g, milestones: fn(g.milestones) }))

  const saveMilestone = (v: { title: string; targetDate: string }) => {
    const editing = milestoneSheet.milestone
    if (editing) {
      setMilestones((ms) => ms.map((m) => (m.id === editing.id ? { ...m, title: v.title, targetDate: v.targetDate || undefined } : m)))
      toast.success("Milestone updated")
    } else {
      setMilestones((ms) => [...ms, { id: createId(), title: v.title, targetDate: v.targetDate || undefined, taskIds: [], done: false }])
      toast.success("Milestone added")
    }
    setMilestoneSheet({ open: false })
  }

  const deleteMilestone = (m: GoalMilestone) => {
    const index = goal.milestones.findIndex((x) => x.id === m.id)
    setMilestones((ms) => ms.filter((x) => x.id !== m.id))
    toast("Milestone deleted", {
      description: m.taskIds.length ? "Its tasks are kept in Tasks." : m.title,
      action: {
        label: "Undo",
        onClick: () =>
          setMilestones((ms) => {
            if (ms.some((x) => x.id === m.id)) return ms
            const copy = [...ms]
            copy.splice(Math.min(index, copy.length), 0, m)
            return copy
          }),
      },
    })
  }

  const toggleMilestone = (m: GoalMilestone) => {
    setMilestones((ms) => ms.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)))
    if (!m.done) {
      const remaining = goal.milestones.filter((x) => !x.done && x.id !== m.id).length
      toast.success(remaining ? "Milestone complete" : "All milestones complete!", {
        description: remaining ? `${remaining} to go.` : goal.status === "active" ? "Ready to mark the goal achieved?" : undefined,
      })
    }
  }

  const addMilestoneTask = (v: MilestoneTaskInput) => {
    const m = taskSheet.milestone
    if (!m) return
    const created = addTask(newTask({ ...v, goalTitle: goal.title, milestoneTitle: m.title }))
    setMilestones((ms) => ms.map((x) => (x.id === m.id ? { ...x, taskIds: [...x.taskIds, created.id], done: false } : x)))
    setTaskSheet({ open: false })
    toast.success("Task added", { description: created.title })
  }

  const toggleTask = (t: Task) => {
    if (t.recurrence !== "none") return
    if (t.completed) updateTask(t.id, { completed: false, completedAt: undefined })
    else {
      updateTask(t.id, { completed: true, completedAt: new Date().toISOString() })
      toast.success("Task completed", {
        description: t.title,
        action: { label: "Undo", onClick: () => updateTask(t.id, { completed: false, completedAt: undefined }) },
      })
    }
  }

  const setStatus = (status: Goal["status"]) => {
    const prev = goal
    updateGoal(goal.id, { status, achievedAt: status === "achieved" ? new Date().toISOString() : status === "active" ? undefined : goal.achievedAt })
    const undo = { label: "Undo", onClick: () => updateGoal(prev.id, { status: prev.status, achievedAt: prev.achievedAt }) }
    if (status === "achieved") toast.success("🎉 Goal achieved!", { description: goal.title, action: undo })
    else if (status === "archived") toast("Goal archived", { description: goal.title, action: undo })
    else toast.success("Goal reactivated", { description: goal.title })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" className="-ml-2" onClick={onBack}>
          <ArrowLeft aria-hidden /> All goals
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Goal actions" />}>
            <MoreVertical aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onClick={() => onEdit(goal)}>
              <Pencil aria-hidden /> Edit details
            </DropdownMenuItem>
            {goal.status === "active" ? (
              <DropdownMenuItem onClick={() => setStatus("archived")}>
                <Archive aria-hidden /> Archive
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setStatus("active")}>
                {goal.status === "archived" ? <ArchiveRestore aria-hidden /> : <RotateCcw aria-hidden />} Make active again
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(goal)}>
              <Trash2 aria-hidden /> Delete goal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Header card */}
      <section className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex items-start gap-4">
          <ProgressRing value={progress.overall} size={72} stroke={7} label="Goal progress" color={goal.status === "achieved" ? "var(--success)" : undefined}>
            <span className="text-sm font-semibold tabular-nums">{Math.round(progress.overall * 100)}%</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight wrap-break-word">{goal.title}</h2>
            {goal.why ? <p className="mt-1 text-sm text-muted-foreground wrap-break-word whitespace-pre-line">{goal.why}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {goal.deadline ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden /> {formatShort(goal.deadline)}
                </span>
              ) : null}
              {deadline ? (
                <span className={cn("font-medium", deadline.overdue ? "text-destructive" : deadline.soon ? "text-warning-foreground dark:text-warning" : "")}>
                  {deadline.label}
                </span>
              ) : null}
              <span>
                {progress.milestonesDone}/{progress.milestonesTotal} milestones
              </span>
              {progress.tasksTotal ? (
                <span>
                  {progress.tasksDone}/{progress.tasksTotal} tasks · {Math.round(progress.taskRatio * 100)}%
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {goal.status === "achieved" ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="mt-4 flex items-center gap-3 rounded-xl bg-success/10 p-3 text-sm text-success"
          >
            <Trophy className="size-5 shrink-0" aria-hidden />
            <span className="font-medium">
              Achieved{goal.achievedAt ? ` on ${formatShort(goal.achievedAt.slice(0, 10))}` : ""}. Well done! 🎉
            </span>
          </motion.div>
        ) : goal.status === "active" ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              size="lg"
              variant={progress.milestonesTotal > 0 && progress.milestonesDone === progress.milestonesTotal ? "default" : "outline"}
              className="sm:h-10"
              onClick={() => setStatus("achieved")}
            >
              <Trophy aria-hidden /> Mark goal achieved
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">This goal is archived.</p>
        )}
      </section>

      {/* Milestones */}
      <section aria-labelledby="milestones-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 id="milestones-heading" className="text-base font-semibold">
            Milestones
          </h3>
          <Button variant="outline" onClick={() => setMilestoneSheet({ open: true })}>
            <Plus aria-hidden /> Add milestone
          </Button>
        </div>

        {goal.milestones.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No milestones yet. Break the goal into a few concrete steps.
          </p>
        ) : (
          <ol className="relative space-y-3">
            {goal.milestones.map((m, i) => {
              const linked = milestoneTasks(m, byId)
              const allDone = linked.length > 0 && linked.every((t) => t.completed)
              const last = i === goal.milestones.length - 1
              const late = !m.done && m.targetDate && deadlineInfo(m.targetDate, today)?.overdue
              return (
                <li key={m.id} className="relative flex gap-3">
                  {/* timeline rail */}
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => toggleMilestone(m)}
                      aria-pressed={m.done}
                      aria-label={m.done ? `Mark "${m.title}" not done` : `Mark "${m.title}" done`}
                      className={cn(
                        "z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                        m.done ? "border-success bg-success text-success-foreground" : "border-border bg-card text-muted-foreground hover:border-primary"
                      )}
                    >
                      {m.done ? <Check className="size-5" aria-hidden /> : <span className="text-sm font-semibold">{i + 1}</span>}
                    </button>
                    {!last ? <div className={cn("w-0.5 flex-1", m.done ? "bg-success/50" : "bg-border")} aria-hidden /> : null}
                  </div>

                  <div className="min-w-0 flex-1 pb-1">
                    <div className="rounded-xl border bg-card p-3 shadow-soft">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className={cn("font-medium wrap-break-word", m.done && "text-muted-foreground line-through")}>{m.title}</p>
                          {m.targetDate ? (
                            <p className={cn("mt-0.5 text-xs", late ? "font-medium text-destructive" : "text-muted-foreground")}>
                              Target {formatShort(m.targetDate)}
                              {late ? " · overdue" : ""}
                            </p>
                          ) : null}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" className="-mt-1 -mr-1 text-muted-foreground" aria-label={`Actions for "${m.title}"`} />}
                          >
                            <MoreVertical aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-40">
                            <DropdownMenuItem onClick={() => setMilestoneSheet({ open: true, milestone: m })}>
                              <Pencil aria-hidden /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTaskSheet({ open: true, milestone: m })}>
                              <Plus aria-hidden /> Add task
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => deleteMilestone(m)}>
                              <Trash2 aria-hidden /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {linked.length ? (
                        <ul className="mt-2 space-y-1" aria-label={`Tasks for "${m.title}"`}>
                          {linked.map((t) => (
                            <li key={t.id}>
                              <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-1 hover:bg-surface-muted">
                                {t.recurrence === "none" ? (
                                  <Checkbox
                                    checked={t.completed}
                                    onCheckedChange={() => toggleTask(t)}
                                    aria-label={t.completed ? `Mark "${t.title}" not done` : `Complete "${t.title}"`}
                                    className="size-5"
                                  />
                                ) : (
                                  <span className="flex size-5 items-center justify-center text-muted-foreground" title="Repeating task — complete it in Tasks">
                                    <Repeat className="size-4" aria-label="Repeating task" />
                                  </span>
                                )}
                                <span className={cn("min-w-0 flex-1 text-sm wrap-break-word", t.completed && "text-muted-foreground line-through")}>
                                  {t.title}
                                </span>
                                {t.dueDate && !t.completed ? (
                                  <span className="hidden text-xs text-muted-foreground sm:inline">{formatShort(t.dueDate)}</span>
                                ) : null}
                                <span className={cn("rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium", PRIORITY_CLASS[t.priority])}>
                                  {PRIORITY_LABEL[t.priority]}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {allDone && !m.done ? (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                          <span className="inline-flex items-center gap-1.5">
                            <CircleCheck className="size-4" aria-hidden /> All tasks done
                          </span>
                          <Button size="sm" variant="ghost" className="h-9 text-success hover:bg-success/15 hover:text-success" onClick={() => toggleMilestone(m)}>
                            Mark milestone done
                          </Button>
                        </div>
                      ) : null}

                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <Button variant="ghost" className="-ml-2 text-muted-foreground" onClick={() => setTaskSheet({ open: true, milestone: m })}>
                          <Plus aria-hidden /> Add task
                        </Button>
                        {linked.length ? (
                          <Button variant="ghost" className="text-muted-foreground" nativeButton={false} render={<Link href="/tools/todo" />}>
                            <ExternalLink aria-hidden /> Open Tasks
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <MilestoneSheet
        open={milestoneSheet.open}
        milestone={milestoneSheet.milestone}
        onOpenChange={(o) => !o && setMilestoneSheet({ open: false })}
        onSubmit={saveMilestone}
      />
      <AddTaskSheet
        open={taskSheet.open}
        milestoneTitle={taskSheet.milestone?.title}
        defaultDueDate={taskSheet.milestone?.targetDate}
        onOpenChange={(o) => !o && setTaskSheet({ open: false })}
        onSubmit={addMilestoneTask}
      />
    </div>
  )
}
