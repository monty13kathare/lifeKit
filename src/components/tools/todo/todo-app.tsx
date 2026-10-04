"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { CalendarCheck2, CalendarClock, CircleCheckBig, FilterX, ListTodo, Plus, Search, SearchX, Sparkles, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { ToolPage } from "@/components/common/tool-page"
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
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useNow } from "@/components/tools/calendar/use-now"
import { useTasks } from "@/hooks/use-lifekit-data"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useHydrated } from "@/hooks/use-store"
import { toDateString } from "@/lib/dates"
import { createId } from "@/lib/storage/core"
import { cn } from "@/lib/utils"
import type { Subtask, Task, TaskPriority } from "@/types"
import { SubtaskSuggestionsSheet, useSubtaskSuggestions } from "./ai-subtasks"
import { QuickAdd } from "./quick-add"
import { TaskCard } from "./task-card"
import { TaskFormSheet, type TaskDraft } from "./task-form"
import {
  formatShortDate,
  matchesQuery,
  nextDueDate,
  PRESET_CATEGORIES,
  PRIORITY_META,
  SORT_ITEMS,
  sortTasks,
  upcomingGroup,
  type SortKey,
  type UpcomingGroup,
} from "./task-utils"

type View = "today" | "upcoming" | "completed"
type SheetState = { open: boolean; task?: Task; defaults?: Partial<TaskDraft>; fromQuick?: boolean }

const UPCOMING_ORDER: UpcomingGroup[] = ["Tomorrow", "This week", "Later", "No date"]
const PRIORITY_ITEMS = [
  { value: "all", label: "All priorities" },
  ...(["high", "medium", "low"] as TaskPriority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label })),
]

export function TodoApp() {
  const hydrated = useHydrated()
  const { tasks, add, update, remove, upsert, set } = useTasks()
  const now = useNow()
  const today = toDateString(now)

  const [view, setView] = useState<View>("today")
  const [sheet, setSheet] = useState<SheetState>({ open: false })
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [sort, setSort] = useState<SortKey>("due")
  const [quick, setQuick] = useState("")
  const [confirmClear, setConfirmClear] = useState(false)
  const [query, setQuery] = useState("")
  const router = useRouter()
  const ai = useAiStatus()
  const aiConfigured = !!ai?.configured
  const breakdown = useSubtaskSuggestions()
  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null)

  const openNew = (defaults?: Partial<TaskDraft>) => setSheet({ open: true, defaults })
  const openEdit = (task: Task) => setSheet({ open: true, task })

  // `n` opens a new task on desktop (not while typing or with a dialog open).
  const sheetOpen = sheet.open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey || e.repeat || sheetOpen) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      if (document.querySelector("[role=dialog], [role=alertdialog]")) return
      if (!window.matchMedia("(min-width: 1024px)").matches) return
      e.preventDefault()
      setSheet({ open: true, defaults: { dueDate: toDateString(new Date()) } })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sheetOpen])

  const categories = useMemo(() => {
    const custom = tasks.map((t) => t.category).filter((c) => !(PRESET_CATEGORIES as readonly string[]).includes(c))
    return Array.from(new Set(custom)).sort((a, b) => a.localeCompare(b))
  }, [tasks])
  const allCategories = useMemo(() => [...PRESET_CATEGORIES, ...categories], [categories])
  const categoryItems = useMemo(
    () => [{ value: "all", label: "All categories" }, ...[...PRESET_CATEGORIES, ...categories].map((c) => ({ value: c, label: c }))],
    [categories]
  )

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (categoryFilter === "all" || t.category === categoryFilter) &&
          (priorityFilter === "all" || t.priority === priorityFilter) &&
          matchesQuery(t, query)
      ),
    [tasks, categoryFilter, priorityFilter, query]
  )
  const filtersActive = categoryFilter !== "all" || priorityFilter !== "all"
  const searching = query.trim().length > 0

  // Progress across all tasks (not just the filtered view): ticked today vs. still due.
  const progress = useMemo(() => {
    let done = 0
    let open = 0
    for (const t of tasks) {
      if (t.completedAt && toDateString(new Date(t.completedAt)) === today) done++
      else if (!t.completed && t.dueDate && t.dueDate <= today) open++
    }
    return { done, total: done + open }
  }, [tasks, today])

  const { overdue, dueToday, upcoming, completed } = useMemo(() => {
    const open = sortTasks(filtered.filter((t) => !t.completed), sort)
    const groups = new Map<UpcomingGroup, Task[]>()
    for (const t of open) {
      const g = upcomingGroup(t, today)
      if (!g) continue
      groups.set(g, [...(groups.get(g) ?? []), t])
    }
    return {
      overdue: open.filter((t) => t.dueDate && t.dueDate < today),
      dueToday: open.filter((t) => t.dueDate === today),
      upcoming: UPCOMING_ORDER.filter((g) => groups.has(g)).map((g) => ({ group: g, tasks: groups.get(g)! })),
      completed: filtered
        .filter((t) => t.completed)
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    }
  }, [filtered, sort, today])

  const counts = {
    today: overdue.length + dueToday.length,
    upcoming: upcoming.reduce((n, g) => n + g.tasks.length, 0),
    completed: completed.length,
  }

  /* ---------------------------------------------------------- actions */

  const toggle = (task: Task) => {
    if (task.completed) {
      update(task.id, { completed: false, completedAt: undefined })
      return
    }
    const stamp = new Date().toISOString()
    if (task.recurrence !== "none") {
      const next = nextDueDate(task, today)
      update(task.id, {
        dueDate: next,
        completed: false,
        completedAt: stamp,
        subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
      })
      toast.success(`Next due ${formatShortDate(next)}`, {
        description: `"${task.title}" is done for now and rolls forward.`,
        action: { label: "Undo", onClick: () => upsert(task) },
      })
      return
    }
    update(task.id, { completed: true, completedAt: stamp })
    toast.success("Task completed", {
      description: task.title,
      action: { label: "Undo", onClick: () => update(task.id, { completed: false, completedAt: undefined }) },
    })
  }

  const deleteTask = (task: Task) => {
    remove(task.id)
    setSheet((s) => (s.task?.id === task.id ? { open: false } : s))
    toast("Task deleted", { description: task.title, action: { label: "Undo", onClick: () => upsert(task) } })
  }

  const changeSubtasks = (task: Task, subtasks: Subtask[]) => update(task.id, { subtasks })

  const viewFor = (dueDate?: string): View => (dueDate && dueDate <= today ? "today" : "upcoming")

  const submit = (draft: TaskDraft) => {
    if (sheet.task) {
      update(sheet.task.id, draft)
      toast.success("Task updated")
    } else {
      add({ ...draft, completed: false, createdAt: new Date().toISOString() })
      toast.success("Task created", { description: draft.title })
      if (sheet.fromQuick) {
        setQuick("")
        setView(viewFor(draft.dueDate))
      }
    }
    setSheet({ open: false })
  }

  const quickAdd = (draft: TaskDraft) => {
    add({ ...draft, completed: false, createdAt: new Date().toISOString() })
    setQuick("")
    const target = viewFor(draft.dueDate)
    setView(target)
    toast.success(
      target === "today" ? "Added to Today" : draft.dueDate ? `Added for ${formatShortDate(draft.dueDate)}` : "Task added",
      { description: draft.title }
    )
  }

  const duplicateTask = (task: Task) => {
    const copy = add({
      title: task.title,
      notes: task.notes,
      priority: task.priority,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      category: task.category,
      recurrence: task.recurrence,
      subtasks: task.subtasks.map((s) => ({ id: createId(), title: s.title, done: false })),
      completed: false,
      createdAt: new Date().toISOString(),
    })
    if (task.completed) setView(viewFor(task.dueDate))
    toast.success("Task duplicated", { description: task.title, action: { label: "Undo", onClick: () => remove(copy.id) } })
  }



  const breakDown = (task: Task) => {
    setBreakdownTask(task)
    void breakdown.run(task.title, task.notes)
  }

  const addBreakdown = (titles: string[]) => {
    const target = breakdownTask
    if (!target || !titles.length) return
    const added = titles.map((title) => ({ id: createId(), title, done: false }))
    const ids = new Set(added.map((s) => s.id))
    update(target.id, (prev) => ({ ...prev, subtasks: [...prev.subtasks, ...added] }))
    toast.success(`Added ${added.length} ${added.length === 1 ? "subtask" : "subtasks"}`, {
      description: target.title,
      action: {
        label: "Undo",
        onClick: () => update(target.id, (prev) => ({ ...prev, subtasks: prev.subtasks.filter((s) => !ids.has(s.id)) })),
      },
    })
  }

  const moveOverdueToToday = (list: Task[]) => {
    if (!list.length) return
    const previous = new Map(list.map((t) => [t.id, t.dueDate]))
    set((prev) => prev.map((t) => (previous.has(t.id) ? { ...t, dueDate: today } : t)))
    toast.success(`Moved ${list.length} ${list.length === 1 ? "task" : "tasks"} to today`, {
      action: {
        label: "Undo",
        onClick: () =>
          set((prev) =>
            prev.map((t) => (previous.has(t.id) && t.dueDate === today ? { ...t, dueDate: previous.get(t.id) } : t))
          ),
      },
    })
  }

  const clearCompleted = () => {
    const removed = tasks.filter((t) => t.completed)
    const ids = new Set(removed.map((t) => t.id))
    set((prev) => prev.filter((t) => !ids.has(t.id)))
    setConfirmClear(false)
    toast(`Cleared ${removed.length} completed ${removed.length === 1 ? "task" : "tasks"}`, {
      action: { label: "Undo", onClick: () => set((prev) => [...prev, ...removed.filter((t) => !prev.some((p) => p.id === t.id))]) },
    })
  }

  const resetFilters = () => {
    setCategoryFilter("all")
    setPriorityFilter("all")
  }

  /* ---------------------------------------------------------- render */

  const cardProps: CardHandlers = {
    onToggle: toggle,
    onEdit: openEdit,
    onDelete: deleteTask,
    onSubtasksChange: changeSubtasks,

    onDuplicate: duplicateTask,
    onBreakDown: aiConfigured ? breakDown : undefined,
  }

  const filters = (
    <TaskFilters
      categoryItems={categoryItems}
      category={categoryFilter}
      onCategory={setCategoryFilter}
      priority={priorityFilter}
      onPriority={setPriorityFilter}
      sort={sort}
      onSort={setSort}
    />
  )

  const tabEmpty = (title: string, description: string, icon = CircleCheckBig) =>
    searching ? (
      <EmptyState
        icon={SearchX}
        title="No tasks match"
        description={`Nothing in this tab matches "${query.trim()}".`}
        action={
          <Button variant="outline" onClick={() => setQuery("")}>
            Clear search
          </Button>
        }
      />
    ) : filtersActive ? (
      <EmptyState
        icon={FilterX}
        title="No tasks match these filters"
        action={
          <Button variant="outline" onClick={resetFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState icon={icon} title={title} description={description} />
    )

  return (
    <ToolPage
      toolId="todo"
      width="wide"
      actions={
        <Button className="hidden sm:inline-flex" onClick={() => openNew({ dueDate: today })}>
          <Plus aria-hidden /> New task
          <kbd className="ml-1 hidden rounded border border-primary-foreground/30 px-1.5 text-[0.7rem] font-normal lg:inline">N</kbd>
        </Button>
      }
    >
      {!hydrated ? (
        <TodoSkeleton />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="You don't have any tasks yet."
          description="Capture what's on your mind — add due dates, priorities and subtasks as you go."
          action={
            <Button size="lg" onClick={() => openNew({ dueDate: today })}>
              <Plus aria-hidden /> Create Task
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0 space-y-4">
            <QuickAdd
              value={quick}
              onChange={setQuick}
              aiConfigured={aiConfigured}
              categories={allCategories}
              defaults={{
                priority: priorityFilter === "all" ? "medium" : (priorityFilter as TaskPriority),
                category: categoryFilter === "all" ? "Personal" : categoryFilter,
              }}
              today={today}
              onAdd={quickAdd}
              onEdit={(draft) => setSheet({ open: true, defaults: draft, fromQuick: true })}
            />

            <div className="relative" role="search">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && query) {
                    e.preventDefault()
                    setQuery("")
                  }
                }}
                placeholder="Search tasks, notes, subtasks…"
                aria-label="Search tasks"
                autoComplete="off"
                maxLength={100}
                className="h-10 bg-card pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="absolute top-0 right-0 text-muted-foreground"
                >
                  <X aria-hidden />
                </Button>
              ) : null}
            </div>

            <div className="lg:hidden">{filters}</div>

            <Tabs value={view} onValueChange={(v) => setView(v as View)} className="gap-4">
              <TabsList className="w-full sm:w-fit">
                <TabsTrigger value="today" className="px-3">
                  Today <TabCount n={counts.today} alert={overdue.length > 0} />
                </TabsTrigger>
                <TabsTrigger value="upcoming" className="px-3">
                  Upcoming <TabCount n={counts.upcoming} />
                </TabsTrigger>
                <TabsTrigger value="completed" className="px-3">
                  Done <TabCount n={counts.completed} />
                </TabsTrigger>
              </TabsList>

              <TabsContent value="today" className="space-y-5">
                {progress.total > 0 && !searching ? <TodayProgress done={progress.done} total={progress.total} /> : null}
                {counts.today === 0 ? (
                  tabEmpty(
                    progress.done > 0 ? "All done for today" : "Nothing due today",
                    "Enjoy the breathing room — or plan ahead in Upcoming.",
                    Sparkles
                  )
                ) : (
                  <>
                    {overdue.length ? (
                      <TaskSection
                        title="Overdue"
                        tone="danger"
                        tasks={overdue}
                        cardProps={cardProps}
                        action={
                          <Button variant="ghost" size="sm" className="-my-1 h-10 text-primary" onClick={() => moveOverdueToToday(overdue)}>
                            <CalendarClock aria-hidden /> Move all to today
                          </Button>
                        }
                      />
                    ) : null}
                    {dueToday.length ? <TaskSection title="Today" tasks={dueToday} cardProps={cardProps} /> : null}
                  </>
                )}
              </TabsContent>

              <TabsContent value="upcoming" className="space-y-5">
                {counts.upcoming === 0
                  ? tabEmpty("Nothing upcoming", "Tasks with a future due date (or no date) show up here.", CalendarCheck2)
                  : upcoming.map((g) => <TaskSection key={g.group} title={g.group} tasks={g.tasks} cardProps={cardProps} />)}
              </TabsContent>

              <TabsContent value="completed" className="space-y-3">
                {completed.length === 0 ? (
                  tabEmpty("No completed tasks yet", "Tick a task off and it will land here.")
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground">
                        {completed.length} completed {completed.length === 1 ? "task" : "tasks"}
                      </p>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmClear(true)}>
                        <Trash2 aria-hidden /> Clear completed
                      </Button>
                    </div>
                    <TaskList tasks={completed} cardProps={cardProps} />
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-5 rounded-2xl border bg-card p-4 shadow-soft">
              <div>
                <h2 className="text-sm font-semibold">Overview</h2>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Today" value={counts.today} />
                  <Stat label="Overdue" value={overdue.length} danger={overdue.length > 0} />
                  <Stat label="Done" value={counts.completed} />
                </dl>
              </div>
              <div>
                <h2 className="mb-3 text-sm font-semibold">Filter &amp; sort</h2>
                {filters}
                {filtersActive ? (
                  <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={resetFilters}>
                    <FilterX aria-hidden /> Clear filters
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: press <kbd className="rounded border px-1">N</kbd> to add a task.
              </p>
            </div>
          </aside>
        </div>
      )}

      <Button
        size="icon-lg"
        aria-label="New task"
        onClick={() => openNew({ dueDate: today })}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 rounded-full shadow-lg sm:hidden lg:bottom-8"
      >
        <Plus className="size-6" aria-hidden />
      </Button>

      <TaskFormSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        task={sheet.task}
        defaults={sheet.defaults}
        categories={categories}
        onSubmit={submit}
        onDelete={deleteTask}
        aiEnabled={aiConfigured}
      />

      {aiConfigured ? (
        <SubtaskSuggestionsSheet s={breakdown} taskTitle={breakdownTask?.title} onAdd={addBreakdown} />
      ) : null}

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear completed tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes all {tasks.filter((t) => t.completed).length} completed tasks. You can undo right after.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={clearCompleted}>
              Clear completed
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ToolPage>
  )
}

/* ------------------------------------------------------------ pieces */

type CardHandlers = Pick<
  React.ComponentProps<typeof TaskCard>,
  "onToggle" | "onEdit" | "onDelete" | "onSubtasksChange" | "onDuplicate" | "onBreakDown"
>

function TodayProgress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="rounded-2xl border bg-card px-3.5 py-3 shadow-soft">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium" aria-live="polite">
          {done} of {total} done today
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Today's progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function TaskList({ tasks, cardProps }: { tasks: Task[]; cardProps: CardHandlers }) {
  return (
    <ul className="space-y-2.5">
      <AnimatePresence initial={false}>
        {tasks.map((t) => (
          <motion.li
            key={t.id}
            layout="position"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
          >
            <TaskCard task={t} {...cardProps} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

function TaskSection({
  title,
  tasks,
  cardProps,
  tone,
  action,
}: {
  title: string
  tasks: Task[]
  cardProps: CardHandlers
  tone?: "danger"
  action?: React.ReactNode
}) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
        <h2
          className={cn(
            "flex items-center gap-2 text-xs font-semibold tracking-wide uppercase",
            tone === "danger" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {title}
          <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
            {tasks.length}
          </span>
        </h2>
        {action}
      </div>
      <TaskList tasks={tasks} cardProps={cardProps} />
    </section>
  )
}

function TabCount({ n, alert }: { n: number; alert?: boolean }) {
  if (!n) return null
  return (
    <span
      className={cn(
        "ml-0.5 min-w-5 rounded-full px-1.5 text-[0.7rem] leading-5 font-semibold",
        alert ? "bg-destructive text-white" : "bg-foreground/10"
      )}
    >
      {n}
    </span>
  )
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-muted px-2 py-2.5">
      <dd className={cn("text-xl font-semibold tabular-nums", danger && "text-destructive")}>{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  )
}

function TaskFilters({
  categoryItems,
  category,
  onCategory,
  priority,
  onPriority,
  sort,
  onSort,
}: {
  categoryItems: { value: string; label: string }[]
  category: string
  onCategory: (v: string) => void
  priority: string
  onPriority: (v: string) => void
  sort: SortKey
  onSort: (v: SortKey) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-3">
      <FilterSelect label="Category" items={categoryItems} value={category} onChange={onCategory} />
      <FilterSelect label="Priority" items={PRIORITY_ITEMS} value={priority} onChange={onPriority} />
      <FilterSelect label="Sort by" items={SORT_ITEMS} value={sort} onChange={(v) => onSort(v as SortKey)} />
    </div>
  )
}

function FilterSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="min-w-0">
      <span className="mb-1 hidden text-xs font-medium text-muted-foreground lg:block">{label}</span>
      <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger aria-label={label} className="w-full min-w-0 bg-card text-xs sm:text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function TodoSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading tasks">
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-10 w-64 rounded-lg" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  )
}
