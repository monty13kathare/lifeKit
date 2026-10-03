"use client"

import { useMemo, useRef, useState } from "react"
import { CheckCheck, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { nextDueDate } from "@/components/tools/todo/task-utils"
import { useTasks } from "@/hooks/use-lifekit-data"
import { useAiStatus } from "@/hooks/use-ai-status"
import { aiAssist } from "@/lib/ai/client"
import { todayString } from "@/lib/dates"
import { setFocusLabel, setFocusTask } from "@/lib/focus"
import { createId } from "@/lib/storage/core"
import { cn } from "@/lib/utils"
import type { FocusTimerState, Task } from "@/types"
import { formatMinutes, orderOpenTasks } from "./focus-utils"

const NONE = "__none"
const CUSTOM = "__custom"

interface TaskLinkProps {
  timer: FocusTimerState
  customMode: boolean
  onCustomModeChange: (v: boolean) => void
  customLabel: string
  onCustomLabelChange: (v: string) => void
}

export function TaskLink({ timer, customMode, onCustomModeChange, customLabel, onCustomLabelChange }: TaskLinkProps) {
  const { tasks, update, upsert } = useTasks()
  const ai = useAiStatus()
  const today = todayString()
  const { due, other } = useMemo(() => orderOpenTasks(tasks, today), [tasks, today])
  const linked = timer.taskId ? tasks.find((t) => t.id === timer.taskId) : undefined
  const isFocus = timer.phase === "focus"

  const value = linked ? linked.id : customMode ? CUSTOM : NONE
  const items = useMemo(() => {
    const list = [
      { value: NONE, label: "No task" },
      { value: CUSTOM, label: "Custom label…" },
      ...[...due, ...other].map((t) => ({ value: t.id, label: t.title })),
    ]
    if (linked && linked.completed) list.push({ value: linked.id, label: linked.title })
    return list
  }, [due, other, linked])

  const onChange = (v: string | null) => {
    if (!v) return
    if (v === NONE) {
      onCustomModeChange(false)
      setFocusTask(undefined)
    } else if (v === CUSTOM) {
      onCustomModeChange(true)
      setFocusTask(undefined)
      setFocusLabel(customLabel)
    } else {
      onCustomModeChange(false)
      setFocusTask(v)
    }
  }

  const toggleSubtask = (task: Task, id: string, done: boolean) =>
    update(task.id, (t) => ({ ...t, subtasks: t.subtasks.map((s) => (s.id === id ? { ...s, done } : s)) }))

  const completeTask = (task: Task) => {
    const stamp = new Date().toISOString()
    if (task.recurrence !== "none") {
      const next = nextDueDate(task, today)
      update(task.id, {
        dueDate: next,
        completed: false,
        completedAt: stamp,
        subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
      })
      toast.success("Nice work!", {
        description: `“${task.title}” rolls forward to ${next}.`,
        action: { label: "Undo", onClick: () => upsert(task) },
      })
      return
    }
    update(task.id, { completed: true, completedAt: stamp })
    toast.success("Task completed", {
      description: task.title,
      action: { label: "Undo", onClick: () => upsert(task) },
    })
  }

  const doneCount = linked?.subtasks.filter((s) => s.done).length ?? 0

  return (
    <section aria-labelledby="focus-task-heading" className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="focus-task-heading" className="text-base font-semibold">
          What are you working on?
        </h2>
        {linked?.focusMinutes ? (
          <span className="shrink-0 text-xs text-muted-foreground">{formatMinutes(linked.focusMinutes)} focused</span>
        ) : null}
      </div>

      <Select items={items} value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full" aria-label="Task for this focus session">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={NONE}>No task</SelectItem>
            <SelectItem value={CUSTOM}>Custom label…</SelectItem>
          </SelectGroup>
          {due.length ? (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Due today &amp; overdue</SelectLabel>
                {due.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="max-w-[16rem] truncate">{t.title}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          ) : null}
          {other.length ? (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Other tasks</SelectLabel>
                {other.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="max-w-[16rem] truncate">{t.title}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          ) : null}
          {linked?.completed ? (
            <SelectGroup>
              <SelectItem value={linked.id}>{linked.title}</SelectItem>
            </SelectGroup>
          ) : null}
        </SelectContent>
      </Select>

      {customMode && !linked ? (
        <div className="space-y-1.5">
          <Label htmlFor="focus-label">Label</Label>
          <Input
            id="focus-label"
            value={customLabel}
            maxLength={120}
            placeholder="e.g. Write report intro"
            onChange={(e) => {
              onCustomLabelChange(e.target.value)
              setFocusLabel(e.target.value)
            }}
          />
        </div>
      ) : null}

      {!due.length && !other.length && !linked ? (
        <p className="text-sm text-muted-foreground">No open tasks. Add some in Tasks, or use a custom label.</p>
      ) : null}

      {linked ? (
        <div className="space-y-3">
          {linked.subtasks.length ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Steps · {doneCount}/{linked.subtasks.length}
              </p>
              <ul className="space-y-0.5">
                {linked.subtasks.map((s) => (
                  <li key={s.id}>
                    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-muted/60">
                      <Checkbox checked={s.done} onCheckedChange={(c) => toggleSubtask(linked, s.id, c === true)} />
                      <span className={cn("text-sm", s.done && "text-muted-foreground line-through")}>{s.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : ai?.configured ? (
            <BreakdownButton task={linked} />
          ) : null}

          {isFocus && !linked.completed ? (
            <Button variant="outline" className="w-full" onClick={() => completeTask(linked)}>
              <CheckCheck aria-hidden />
              Mark task complete
            </Button>
          ) : null}
          {linked.completed ? <p className="text-sm text-success">This task is complete.</p> : null}
        </div>
      ) : null}
    </section>
  )
}

function BreakdownButton({ task }: { task: Task }) {
  const { update } = useTasks()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [steps, setSteps] = useState<{ title: string; selected: boolean }[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const run = async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    try {
      const input = [task.title, task.notes].filter(Boolean).join("\n\n")
      const { subtasks } = await aiAssist("subtasks", input, ctrl.signal)
      if (!subtasks.length) {
        toast("No steps suggested", { description: "Try adding a few notes to the task first." })
        return
      }
      setSteps(subtasks.map((title) => ({ title, selected: true })))
      setOpen(true)
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return
      toast.error("Couldn't break it down", { description: (err as Error)?.message })
    } finally {
      if (abortRef.current === ctrl) setLoading(false)
    }
  }

  const selected = steps.filter((s) => s.selected)
  const add = () => {
    update(task.id, (t) => ({
      ...t,
      subtasks: [...t.subtasks, ...selected.map((s) => ({ id: createId(), title: s.title, done: false }))],
    }))
    toast.success(`Added ${selected.length} step${selected.length === 1 ? "" : "s"}`)
    setOpen(false)
  }

  return (
    <>
      <div className="rounded-xl bg-surface-muted p-3">
        <p className="text-sm text-muted-foreground">Not sure where to start?</p>
        <Button variant="secondary" className="mt-2 w-full" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
          {loading ? "Thinking…" : "Break it into steps"}
        </Button>
      </div>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title="Suggested steps"
        description={`AI suggestions for “${task.title}”. Review before adding.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={add} disabled={!selected.length}>
              Add {selected.length || ""} to task
            </Button>
          </>
        }
      >
        <ul className="space-y-0.5">
          {steps.map((s, i) => (
            <li key={i}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-muted/60">
                <Checkbox
                  checked={s.selected}
                  onCheckedChange={(c) =>
                    setSteps((prev) => prev.map((p, j) => (j === i ? { ...p, selected: c === true } : p)))
                  }
                />
                <span className="text-sm">{s.title}</span>
              </label>
            </li>
          ))}
        </ul>
      </ResponsiveSheet>
    </>
  )
}
