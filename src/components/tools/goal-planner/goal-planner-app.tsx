"use client"

import { useMemo, useState } from "react"
import { CalendarDays, ChevronRight, Plus, Target, Trophy } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { ProgressRing } from "@/components/common/progress-ring"
import { ToolPage } from "@/components/common/tool-page"
import { useNow } from "@/components/tools/calendar/use-now"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useGoals, useTasks } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { createId } from "@/lib/storage/core"
import { cn } from "@/lib/utils"
import type { Goal, GoalMilestone, Task } from "@/types"
import { GoalDetail } from "./goal-detail"
import { GoalFormSheet, type GoalDraft } from "./goal-form"
import { deadlineInfo, formatShort, GOAL_STATUS_LABEL, goalProgress, newTask, openLinkedTasks } from "./goal-utils"

type Status = Goal["status"]

export function GoalPlannerApp() {
  const hydrated = useHydrated()
  const now = useNow()
  const { goals, add: addGoal, update: updateGoal, remove: removeGoal, upsert: upsertGoal } = useGoals()
  const { tasks, add: addTask, remove: removeTask, upsert: upsertTask } = useTasks()
  const ai = useAiStatus()
  const aiEnabled = !!ai?.configured
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  const [tab, setTab] = useState<Status>("active")
  const [openId, setOpenId] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; goal?: Goal }>({ open: false })
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null)

  const openGoal = openId ? goals.find((g) => g.id === openId) : undefined

  const counts = useMemo(() => {
    const c: Record<Status, number> = { active: 0, achieved: 0, archived: 0 }
    for (const g of goals) c[g.status]++
    return c
  }, [goals])

  const visible = useMemo(() => {
    const list = goals.filter((g) => g.status === tab)
    return list.sort((a, b) => {
      if (tab === "active") {
        const ad = a.deadline || "9999-99-99"
        const bd = b.deadline || "9999-99-99"
        return ad.localeCompare(bd) || b.createdAt.localeCompare(a.createdAt)
      }
      return (b.achievedAt ?? b.createdAt).localeCompare(a.achievedAt ?? a.createdAt)
    })
  }, [goals, tab])

  /* --------------------------------------------------------------- actions */

  const submitForm = (draft: GoalDraft) => {
    if (form.goal) {
      updateGoal(form.goal.id, { title: draft.title.trim(), why: draft.why.trim() || undefined, deadline: draft.deadline || undefined })
      toast.success("Goal updated")
      setForm({ open: false })
      return
    }
    const createdTaskIds: string[] = []
    const milestones: GoalMilestone[] = draft.milestones.map((m) => {
      const taskIds = m.tasks
        .filter((t) => t.include && t.title.trim())
        .map((t) => {
          const created = addTask(newTask({ title: t.title, priority: t.priority, dueDate: t.dueDate, goalTitle: draft.title, milestoneTitle: m.title }))
          createdTaskIds.push(created.id)
          return created.id
        })
      return { id: createId(), title: m.title.trim(), targetDate: m.targetDate || undefined, taskIds, done: false }
    })
    const goal = addGoal({
      title: draft.title.trim(),
      why: draft.why.trim() || undefined,
      deadline: draft.deadline || undefined,
      milestones,
      status: "active",
      createdAt: new Date().toISOString(),
    })
    setForm({ open: false })
    setTab("active")
    setOpenId(goal.id)
    toast.success("Goal created", {
      description: createdTaskIds.length ? `${createdTaskIds.length} ${createdTaskIds.length === 1 ? "task" : "tasks"} added to Tasks.` : goal.title,
    })
  }

  const requestDelete = (goal: Goal) => {
    if (openLinkedTasks(goal, byId).length) setPendingDelete(goal)
    else doDelete(goal, false)
  }

  const doDelete = (goal: Goal, withTasks: boolean) => {
    const removed: Task[] = withTasks ? openLinkedTasks(goal, byId) : []
    removed.forEach((t) => removeTask(t.id))
    removeGoal(goal.id)
    setPendingDelete(null)
    if (openId === goal.id) setOpenId(null)
    toast("Goal deleted", {
      description: removed.length ? `${goal.title} and ${removed.length} open ${removed.length === 1 ? "task" : "tasks"}` : goal.title,
      action: {
        label: "Undo",
        onClick: () => {
          upsertGoal(goal)
          removed.forEach((t) => upsertTask(t))
        },
      },
    })
  }

  /* ---------------------------------------------------------------- render */

  const newButton = (
    <Button onClick={() => setForm({ open: true })} className="hidden sm:inline-flex">
      <Plus aria-hidden /> New goal
    </Button>
  )

  return (
    <ToolPage toolId="goal-planner" actions={openGoal ? undefined : newButton}>
      {!hydrated ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading goals">
          <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : openGoal ? (
        <GoalDetail
          goal={openGoal}
          today={now}
          onBack={() => setOpenId(null)}
          onEdit={(g) => setForm({ open: true, goal: g })}
          onDelete={requestDelete}
        />
      ) : (
        <div className="space-y-4">
          <Button size="lg" className="w-full sm:hidden" onClick={() => setForm({ open: true })}>
            <Plus aria-hidden /> New goal
          </Button>

          {goals.length === 0 ? (
            <EmptyState
              icon={Target}
              title="Set a goal and break it into steps."
              description={
                aiEnabled
                  ? "Add milestones yourself, or let AI draft a plan with tasks you can edit."
                  : "Add milestones and link tasks so you can see your progress."
              }
              action={
                <Button onClick={() => setForm({ open: true })}>
                  <Plus aria-hidden /> New goal
                </Button>
              }
            />
          ) : (
            <>
              <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
                <TabsList className="w-full sm:w-auto">
                  {(["active", "achieved", "archived"] as Status[]).map((s) => (
                    <TabsTrigger key={s} value={s} className="px-3">
                      {GOAL_STATUS_LABEL[s]}
                      <span className="text-xs text-muted-foreground tabular-nums">{counts[s]}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {visible.length === 0 ? (
                <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  {tab === "active" ? "No active goals. Start a new one!" : tab === "achieved" ? "No achieved goals yet — you'll get there." : "Nothing archived."}
                </p>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {visible.map((g) => (
                    <li key={g.id}>
                      <GoalCard goal={g} byId={byId} today={now} onOpen={() => setOpenId(g.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      <GoalFormSheet open={form.open} goal={form.goal} aiEnabled={aiEnabled} onOpenChange={(o) => !o && setForm({ open: false })} onSubmit={submitForm} />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.title}" has ${openLinkedTasks(pendingDelete, byId).length} open linked tasks. Delete them too, or keep them in Tasks?`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={() => pendingDelete && doDelete(pendingDelete, false)}>
              Keep tasks
            </Button>
            <Button variant="destructive" onClick={() => pendingDelete && doDelete(pendingDelete, true)}>
              Delete goal &amp; tasks
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ToolPage>
  )
}

function GoalCard({ goal, byId, today, onOpen }: { goal: Goal; byId: Map<string, Task>; today: Date; onOpen: () => void }) {
  const p = goalProgress(goal, byId)
  const dl = goal.status === "active" ? deadlineInfo(goal.deadline, today) : null
  const pct = Math.round(p.overall * 100)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-soft outline-none transition-colors hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ProgressRing value={p.overall} size={52} stroke={5} label={`${goal.title} progress`} color={goal.status === "achieved" ? "var(--success)" : undefined}>
        {goal.status === "achieved" ? (
          <Trophy className="size-4 text-success" aria-hidden />
        ) : (
          <span className="text-xs font-semibold tabular-nums">{pct}%</span>
        )}
      </ProgressRing>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{goal.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {p.milestonesDone}/{p.milestonesTotal} milestones
          {p.tasksTotal ? ` · ${Math.round(p.taskRatio * 100)}% of ${p.tasksTotal} tasks` : ""}
        </p>
        {dl ? (
          <p className={cn("mt-1 inline-flex items-center gap-1 text-xs font-medium", dl.overdue ? "text-destructive" : dl.soon ? "text-warning-foreground dark:text-warning" : "text-muted-foreground")}>
            <CalendarDays className="size-3.5" aria-hidden /> {dl.label}
          </p>
        ) : goal.status === "achieved" && goal.achievedAt ? (
          <p className="mt-1 text-xs text-success">Achieved {formatShort(goal.achievedAt.slice(0, 10))}</p>
        ) : null}
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}
