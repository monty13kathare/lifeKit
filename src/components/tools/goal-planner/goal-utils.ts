import { differenceInCalendarDays, format, parseISO } from "date-fns"
import type { Goal, GoalMilestone, Task, TaskPriority } from "@/types"

export const GOAL_STATUS_LABEL: Record<Goal["status"], string> = {
  active: "Active",
  achieved: "Achieved",
  archived: "Archived",
}

export const PRIORITIES: TaskPriority[] = ["low", "medium", "high"]
export const PRIORITY_LABEL: Record<TaskPriority, string> = { low: "Low", medium: "Medium", high: "High" }
export const PRIORITY_CLASS: Record<TaskPriority, string> = {
  low: "bg-surface-muted text-muted-foreground",
  medium: "bg-warning/15 text-warning-foreground dark:text-warning",
  high: "bg-destructive/10 text-destructive",
}

export const nextPriority = (p: TaskPriority): TaskPriority => PRIORITIES[(PRIORITIES.indexOf(p) + 1) % PRIORITIES.length]

/** Category used for tasks created from a goal. */
export const goalCategory = (title: string) => {
  const t = title.trim()
  return t.length > 30 ? `${t.slice(0, 29).trimEnd()}…` : t || "Goal"
}

export const isDateString = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

export function formatShort(date: string): string {
  try {
    return format(parseISO(date), "d MMM yyyy")
  } catch {
    return date
  }
}

export interface DeadlineInfo {
  label: string
  overdue: boolean
  soon: boolean
}

/** "23 days left", "Due today", "5 days overdue". */
export function deadlineInfo(deadline: string | undefined, today: Date): DeadlineInfo | null {
  if (!isDateString(deadline)) return null
  const days = differenceInCalendarDays(parseISO(deadline), today)
  if (days === 0) return { label: "Due today", overdue: false, soon: true }
  if (days === 1) return { label: "1 day left", overdue: false, soon: true }
  if (days > 1) return { label: `${days} days left`, overdue: false, soon: days <= 7 }
  const late = -days
  return { label: `${late} ${late === 1 ? "day" : "days"} overdue`, overdue: true, soon: false }
}

export function milestoneTasks(milestone: GoalMilestone, byId: Map<string, Task>): Task[] {
  return milestone.taskIds.map((id) => byId.get(id)).filter((t): t is Task => !!t)
}

export interface GoalProgress {
  milestonesDone: number
  milestonesTotal: number
  tasksDone: number
  tasksTotal: number
  /** 0–1 */
  taskRatio: number
  /** 0–1, blended milestones + tasks */
  overall: number
}

export function goalProgress(goal: Goal, byId: Map<string, Task>): GoalProgress {
  const milestonesTotal = goal.milestones.length
  const milestonesDone = goal.milestones.filter((m) => m.done).length
  let tasksTotal = 0
  let tasksDone = 0
  for (const m of goal.milestones) {
    for (const t of milestoneTasks(m, byId)) {
      tasksTotal++
      if (t.completed) tasksDone++
    }
  }
  const mRatio = milestonesTotal ? milestonesDone / milestonesTotal : 0
  const taskRatio = tasksTotal ? tasksDone / tasksTotal : 0
  let overall = milestonesTotal && tasksTotal ? (mRatio + taskRatio) / 2 : milestonesTotal ? mRatio : taskRatio
  if (goal.status === "achieved") overall = 1
  return { milestonesDone, milestonesTotal, tasksDone, tasksTotal, taskRatio, overall }
}

/** Open (incomplete) tasks linked to any milestone of the goal. */
export function openLinkedTasks(goal: Goal, byId: Map<string, Task>): Task[] {
  return goal.milestones.flatMap((m) => milestoneTasks(m, byId)).filter((t) => !t.completed)
}

export function newTask(input: { title: string; priority: TaskPriority; dueDate?: string; goalTitle: string; milestoneTitle: string }): Omit<Task, "id"> {
  return {
    title: input.title.trim(),
    notes: `Goal: ${input.goalTitle.trim()} → ${input.milestoneTitle.trim()}`,
    priority: input.priority,
    dueDate: isDateString(input.dueDate) ? input.dueDate : undefined,
    category: goalCategory(input.goalTitle),
    recurrence: "none",
    completed: false,
    subtasks: [],
    createdAt: new Date().toISOString(),
  }
}
