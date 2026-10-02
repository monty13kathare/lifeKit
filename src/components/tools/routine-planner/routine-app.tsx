"use client"

import { Fragment, useMemo, useState } from "react"
import { addDays, addWeeks, format, isSameDay, startOfWeek } from "date-fns"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, GripVertical, Plus, Sunrise } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { ToolPage } from "@/components/common/tool-page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useNow } from "@/components/tools/calendar/use-now"
import { useIsDesktop } from "@/hooks/use-media-query"
import { useRoutines } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { fromDateString, toDateString } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { RoutineItem } from "@/types"
import { RoutineCard } from "./routine-card"
import { RoutineFormSheet, type RoutineDraft } from "./routine-form"
import { formatClock, isActiveAt, itemsForDate, reorderPatch, sortRoutine, toMinutes, type RoutineSort } from "./routine-utils"

type SheetState = { open: boolean; item?: RoutineItem; defaults?: Partial<RoutineDraft> }

/** Block height grows with duration but stays readable: 15 min ≈ 72px, 3 h+ caps at 200px. */
const blockHeight = (min: number) => Math.round(Math.min(200, Math.max(68, 52 + min * 0.8)))

export function RoutineApp() {
  const hydrated = useHydrated()
  const isDesktop = useIsDesktop()
  const { routines, add, update, remove, upsert } = useRoutines()
  const now = useNow()
  const today = toDateString(now)

  const [picked, setPicked] = useState<string | null>(null)
  const selected = picked ?? today
  const [weekOffset, setWeekOffset] = useState(0)
  const [sortMode, setSortMode] = useState<RoutineSort>("time")
  const [sheet, setSheet] = useState<SheetState>({ open: false })
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const weekStart = addWeeks(startOfWeek(fromDateString(selected)), weekOffset)
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const dayItems = useMemo(() => sortRoutine(itemsForDate(routines, selected), sortMode), [routines, selected, sortMode])
  const doneCount = dayItems.filter((i) => i.completedDates.includes(selected)).length
  const isToday = selected === today
  const isFuture = selected > today
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const activeId = isToday ? dayItems.find((i) => isActiveAt(i, nowMin))?.id : undefined
  // Index to draw the "now" line before (time view, today, nothing active right now).
  const nowLineIndex =
    isToday && sortMode === "time" && !activeId
      ? (() => {
          const idx = dayItems.findIndex((i) => toMinutes(i.time) > nowMin)
          return idx === -1 ? dayItems.length : idx
        })()
      : -1

  const selectDate = (d: Date) => {
    setPicked(toDateString(d))
    setWeekOffset(0)
  }

  /* --------------------------------------------------------- actions */

  const toggle = (item: RoutineItem, date: string) => {
    const done = item.completedDates.includes(date)
    update(item.id, {
      completedDates: done ? item.completedDates.filter((d) => d !== date) : [...item.completedDates, date],
    })
    if (!done && doneCount + 1 === dayItems.length) toast.success("Routine complete for the day!")
  }

  const submit = (draft: RoutineDraft) => {
    if (sheet.item) {
      update(sheet.item.id, draft)
      toast.success("Routine updated")
    } else {
      const order = routines.reduce((m, r) => Math.max(m, r.order), -1) + 1
      add({ ...draft, order, completedDates: [] })
      const wd = fromDateString(selected).getDay()
      toast.success("Added to your routine", {
        description: draft.repeatDays.includes(wd) ? draft.title : `${draft.title} — not scheduled on this day`,
      })
    }
    setSheet({ open: false })
  }

  const deleteItem = (item: RoutineItem) => {
    remove(item.id)
    setSheet({ open: false })
    toast("Routine block deleted", { description: item.title, action: { label: "Undo", onClick: () => upsert(item) } })
  }

  const applyOrder = (ids: string[]) => {
    const visible = sortRoutine(dayItems, "custom")
    reorderPatch(visible, ids).forEach((order, id) => update(id, { order }))
  }

  const move = (id: string, dir: -1 | 1) => {
    const ids = dayItems.map((i) => i.id)
    const idx = ids.indexOf(id)
    const to = idx + dir
    if (idx < 0 || to < 0 || to >= ids.length) return
    ;[ids[idx], ids[to]] = [ids[to], ids[idx]]
    applyOrder(ids)
  }

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const ids = dayItems.map((i) => i.id).filter((id) => id !== dragId)
    const to = ids.indexOf(targetId)
    const from = dayItems.findIndex((i) => i.id === dragId)
    const target = dayItems.findIndex((i) => i.id === targetId)
    ids.splice(from < target ? to + 1 : to, 0, dragId)
    applyOrder(ids)
  }

  const canDrag = sortMode === "custom" && isDesktop

  /* --------------------------------------------------------- render */

  return (
    <ToolPage
      toolId="routine-planner"
      actions={
        <Button className="hidden sm:inline-flex" onClick={() => setSheet({ open: true })}>
          <Plus aria-hidden /> Add block
        </Button>
      }
    >
      {!hydrated ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading routine">
          <Skeleton className="h-20 w-full rounded-2xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : routines.length === 0 ? (
        <EmptyState
          icon={Sunrise}
          title="Your routine is empty."
          description="Add blocks like Wake up, Exercise or Deep work and build a day that runs itself."
          action={
            <Button size="lg" onClick={() => setSheet({ open: true })}>
              <Plus aria-hidden /> Add first block
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-5">
            {/* Week strip */}
            <nav aria-label="Choose a day" className="rounded-2xl border bg-card p-2 shadow-soft">
              <div className="mb-1 flex items-center justify-between px-1">
                <Button variant="ghost" size="icon-sm" aria-label="Previous week" onClick={() => setWeekOffset((w) => w - 1)}>
                  <ChevronLeft aria-hidden />
                </Button>
                <p className="text-sm font-medium" aria-live="polite">
                  {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
                </p>
                <div className="flex items-center">
                  {!isToday || weekOffset !== 0 ? (
                    <Button variant="ghost" size="sm" onClick={() => selectDate(now)}>
                      Today
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon-sm" aria-label="Next week" onClick={() => setWeekOffset((w) => w + 1)}>
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              </div>
              <ul className="grid grid-cols-7 gap-1">
                {week.map((d) => {
                  const ds = toDateString(d)
                  const sel = ds === selected
                  const items = itemsForDate(routines, ds)
                  const done = items.filter((i) => i.completedDates.includes(ds)).length
                  return (
                    <li key={ds}>
                      <button
                        type="button"
                        onClick={() => selectDate(d)}
                        aria-current={sel ? "date" : undefined}
                        aria-label={`${format(d, "EEEE, MMMM d")}: ${items.length} blocks${items.length ? `, ${done} done` : ""}`}
                        className={cn(
                          "flex w-full flex-col items-center gap-0.5 rounded-xl py-2 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          sel ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                          !sel && isSameDay(d, now) && "text-primary ring-1 ring-primary/40"
                        )}
                      >
                        <span className={cn("font-medium", !sel && "text-muted-foreground")}>{format(d, "EEEEE")}</span>
                        <span className="text-base font-semibold tabular-nums">{format(d, "d")}</span>
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            !items.length ? "bg-transparent" : done === items.length ? "bg-success" : sel ? "bg-primary-foreground/60" : "bg-muted-foreground/40"
                          )}
                          aria-hidden
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* Mobile progress */}
            <div className="lg:hidden">
              <ProgressSummary done={doneCount} total={dayItems.length} date={selected} today={today} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{isToday ? "Today's routine" : format(fromDateString(selected), "EEEE, MMM d")}</h2>
              <div role="radiogroup" aria-label="Order" className="inline-flex rounded-lg bg-muted p-0.75">
                {(["time", "custom"] as RoutineSort[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={sortMode === m}
                    onClick={() => setSortMode(m)}
                    className={cn(
                      "h-8 rounded-md px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      sortMode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m === "time" ? "By time" : "Custom order"}
                  </button>
                ))}
              </div>
            </div>
            {sortMode === "custom" ? (
              <p className="-mt-3 text-xs text-muted-foreground">
                Use the arrows{isDesktop ? " or drag blocks" : ""} to arrange your routine.
              </p>
            ) : null}

            {dayItems.length === 0 ? (
              <EmptyState
                icon={Sunrise}
                title={`Nothing planned for ${format(fromDateString(selected), "EEEE")}s`}
                description="Add a block for this day or adjust the repeat days of existing ones."
                action={
                  <Button
                    onClick={() => setSheet({ open: true, defaults: { repeatDays: [fromDateString(selected).getDay()] } })}
                  >
                    <Plus aria-hidden /> Add block
                  </Button>
                }
              />
            ) : (
              <ol className="relative" aria-label="Routine timeline">
                {dayItems.map((item, idx) => {
                  const start = toMinutes(item.time)
                  const active = item.id === activeId
                  const c = item.color
                  return (
                    <Fragment key={item.id}>
                      {idx === nowLineIndex ? <NowLine minutes={nowMin} /> : null}
                      <li
                        className={cn(
                          "grid grid-cols-[3.75rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[4.5rem_minmax(0,1fr)]",
                          canDrag && "cursor-grab",
                          dragId === item.id && "opacity-50"
                        )}
                        draggable={canDrag}
                        onDragStart={(e) => {
                          setDragId(item.id)
                          e.dataTransfer.effectAllowed = "move"
                        }}
                        onDragOver={(e) => {
                          if (!dragId) return
                          e.preventDefault()
                          setOverId(item.id)
                        }}
                        onDragLeave={() => setOverId((o) => (o === item.id ? null : o))}
                        onDrop={(e) => {
                          e.preventDefault()
                          dropOn(item.id)
                          setDragId(null)
                          setOverId(null)
                        }}
                        onDragEnd={() => {
                          setDragId(null)
                          setOverId(null)
                        }}
                      >
                        <div className="pt-3 text-right text-xs font-medium text-muted-foreground tabular-nums">
                          {formatClock(start)}
                        </div>
                        <div className={cn("relative border-l-2 border-border pb-3 pl-4", idx === dayItems.length - 1 && "border-transparent")}>
                          <span
                            className={cn(
                              "absolute top-3.5 -left-1.75 size-3 rounded-full ring-4 ring-background",
                              `${colorDot(c)}`,
                              active && "animate-pulse"
                            )}
                            aria-hidden
                          />
                          <RoutineCard
                            item={item}
                            date={selected}
                            onToggle={toggle}
                            onEdit={(i) => setSheet({ open: true, item: i })}
                            active={active}
                            progress={active ? (((nowMin - start + 1440) % 1440) / item.durationMinutes) : undefined}
                            toggleDisabled={isFuture}
                            minHeight={blockHeight(item.durationMinutes)}
                            className={cn(overId === item.id && dragId !== item.id && "ring-2 ring-primary")}
                          >
                            {sortMode === "custom" ? (
                              <div className="mt-2 flex gap-1">
                                {canDrag ? <GripVertical className="mr-1 size-4 self-center opacity-60" aria-hidden /> : null}
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="bg-background/60"
                                  aria-label={`Move ${item.title} up`}
                                  disabled={idx === 0}
                                  onClick={() => move(item.id, -1)}
                                >
                                  <ArrowUp aria-hidden />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="bg-background/60"
                                  aria-label={`Move ${item.title} down`}
                                  disabled={idx === dayItems.length - 1}
                                  onClick={() => move(item.id, 1)}
                                >
                                  <ArrowDown aria-hidden />
                                </Button>
                              </div>
                            ) : null}
                          </RoutineCard>
                        </div>
                      </li>
                    </Fragment>
                  )
                })}
                {nowLineIndex === dayItems.length ? <NowLine minutes={nowMin} /> : null}
              </ol>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              <ProgressSummary done={doneCount} total={dayItems.length} date={selected} today={today} />
              <Button className="w-full" variant="outline" onClick={() => setSheet({ open: true })}>
                <Plus aria-hidden /> Add block
              </Button>
            </div>
          </aside>
        </div>
      )}

      <Button
        size="icon-lg"
        aria-label="Add routine block"
        onClick={() => setSheet({ open: true })}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 rounded-full shadow-lg sm:hidden lg:bottom-8"
      >
        <Plus className="size-6" aria-hidden />
      </Button>

      <RoutineFormSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        item={sheet.item}
        defaults={sheet.defaults}
        onSubmit={submit}
        onDelete={deleteItem}
      />
    </ToolPage>
  )
}

const DOT: Record<RoutineItem["color"], string> = {
  indigo: "bg-indigo-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  slate: "bg-slate-500",
}
const colorDot = (c: RoutineItem["color"]) => DOT[c] ?? DOT.indigo

function NowLine({ minutes }: { minutes: number }) {
  return (
    <li className="grid grid-cols-[3.75rem_minmax(0,1fr)] items-center gap-x-3 pb-3 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
      <span className="text-right text-xs font-semibold text-destructive tabular-nums">
        <span className="sr-only">Current time </span>
        {formatClock(minutes)}
      </span>
      <span className="relative flex items-center">
        <span className="absolute -left-1.25 size-2.5 rounded-full bg-destructive" aria-hidden />
        <span className="h-0.5 flex-1 bg-destructive" aria-hidden />
        <span className="ml-2 text-xs font-semibold text-destructive">Now</span>
      </span>
    </li>
  )
}

function ProgressSummary({ done, total, date, today }: { done: number; total: number; date: string; today: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  const r = 26
  const circ = 2 * Math.PI * r
  const label = date === today ? "today" : date < today ? "that day" : "planned"
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-soft">
      <div className="relative size-16 shrink-0" role="img" aria-label={`${done} of ${total} done (${pct}%)`}>
        <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-surface-muted" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className="stroke-success transition-[stroke-dashoffset] duration-500"
            strokeDasharray={circ}
            strokeDashoffset={circ - (circ * pct) / 100}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">{pct}%</span>
      </div>
      <div className="min-w-0">
        <p className="font-semibold">
          {done} of {total} done
        </p>
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "No blocks scheduled."
            : done === total
              ? "Everything ticked off. Nice work!"
              : date > today
                ? `${total} blocks ${label}.`
                : `${total - done} left ${label}.`}
        </p>
      </div>
    </div>
  )
}
