"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { addDays, addHours, format, isSameMonth, setHours, startOfDay, startOfHour, startOfMonth, startOfWeek } from "date-fns"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus, Search, SquareCheck, X } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { ToolPage } from "@/components/common/tool-page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useCalendar, useTasks } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { expandEvents, fromDateString, toDateString } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { CalendarEvent, EventOccurrence } from "@/types"
import { AgendaView } from "./agenda-view"
import { AiQuickAdd } from "./ai-quick-add"
import {
  matchesQuery,
  occurrencesOn,
  SEARCH_DAYS,
  shiftCursor,
  VIEW_ITEMS,
  viewRange,
  viewTitle,
  type CalendarView,
} from "./calendar-utils"
import { EventCard } from "./event-card"
import { EventFormSheet, type EventDraft, type EventPrefill } from "./event-form"
import { MonthView } from "./month-view"
import { groupTasksByDay, TasksDueList } from "./task-items"
import { TimeGrid } from "./time-grid"
import { useNow } from "./use-now"

type SheetState = {
  open: boolean
  event?: CalendarEvent
  prefill?: EventPrefill
  /** Full details for a new event (duplicate / AI suggestion). */
  initial?: EventDraft
  heading?: string
  formKey?: string
}

const HIGHLIGHT_MS = 2600
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Did a change affect when the event alerts? Then the scheduler must alert again. */
function alertTimingChanged(prev: CalendarEvent, next: EventDraft): boolean {
  return (
    prev.start !== next.start ||
    prev.allDay !== next.allDay ||
    prev.recurrence !== next.recurrence ||
    (prev.recurrenceUntil ?? "") !== (next.recurrenceUntil ?? "") ||
    (prev.alertMinutes ?? null) !== (next.alertMinutes ?? null)
  )
}

export function CalendarApp() {
  const hydrated = useHydrated()
  const ai = useAiStatus()
  const { events, add, update, remove, upsert } = useCalendar()
  const { tasks } = useTasks()
  const now = useNow()
  const today = toDateString(now)
  const searchId = useId()
  const gotoId = useId()

  const [view, setView] = useState<CalendarView>("month")
  const [cursorStr, setCursorStr] = useState<string | null>(null)
  const [selectedStr, setSelectedStr] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState>({ open: false })
  const [showTasks, setShowTasks] = useState(true)
  const [query, setQuery] = useState("")
  const [gotoOpen, setGotoOpen] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(highlightTimer.current), [])

  const cursorKey = cursorStr ?? today
  const cursor = fromDateString(cursorKey)
  const selectedDay = selectedStr ?? cursorKey
  const range = viewRange(view, cursor)
  const searching = view === "agenda" && query.trim().length > 0

  const occurrences = useMemo(() => {
    const r = viewRange(view, fromDateString(cursorKey))
    return expandEvents(events, r.start, r.end)
  }, [events, view, cursorKey])

  const searchStart = startOfDay(fromDateString(today))
  const searchEnd = addDays(searchStart, SEARCH_DAYS)
  const searchResults = useMemo(() => {
    if (!searching) return []
    const start = fromDateString(today)
    return expandEvents(
      events.filter((e) => matchesQuery(e, query)),
      start,
      addDays(start, SEARCH_DAYS)
    )
  }, [events, query, searching, today])

  const tasksByDay = useMemo(() => groupTasksByDay(tasks), [tasks])
  const visibleTasks = showTasks ? tasksByDay : undefined
  const hasDueTasks = tasksByDay.size > 0

  const flash = (id: string) => {
    setHighlightId(id)
    window.clearTimeout(highlightTimer.current)
    highlightTimer.current = window.setTimeout(() => setHighlightId(null), HIGHLIGHT_MS)
  }

  const goTo = (d: Date) => {
    setCursorStr(toDateString(d))
    setSelectedStr(toDateString(d))
  }
  const navigate = (dir: 1 | -1) => {
    const next = shiftCursor(view, cursor, dir)
    setCursorStr(toDateString(next))
    if (view === "month") setSelectedStr(isSameMonth(next, now) ? today : toDateString(startOfMonth(next)))
    else setSelectedStr(toDateString(next))
  }

  /** Default start for "New event": selected day at the next full hour (or 9 AM on other days). */
  const defaultStart = (day: string) => {
    if (day === today) return addHours(startOfHour(now), 1)
    return setHours(fromDateString(day), 9)
  }
  const openNew = (prefill?: EventPrefill) =>
    setSheet({ open: true, prefill: prefill ?? { start: defaultStart(view === "month" ? selectedDay : toDateString(cursor)) } })
  const openEdit = (o: EventOccurrence) => setSheet({ open: true, event: o.event })

  const submit = (draft: EventDraft) => {
    if (sheet.event) {
      const prev = sheet.event
      // Clear the "already alerted" marker so a moved/changed event alerts at its new time.
      update(prev.id, alertTimingChanged(prev, draft) ? { ...draft, lastAlertedFor: undefined } : draft)
      toast.success(prev.recurrence !== "none" || draft.recurrence !== "none" ? "Series updated" : "Event updated")
    } else {
      const created = add(draft)
      toast.success("Event created", { description: `${draft.title} · ${format(new Date(draft.start), "EEE, MMM d")}` })
      if (view !== "agenda") goTo(new Date(draft.start))
      flash(created.id)
    }
    setSheet({ open: false })
  }

  const deleteEvent = (event: CalendarEvent) => {
    remove(event.id)
    setSheet({ open: false })
    toast(event.recurrence !== "none" ? "Recurring event deleted (all occurrences)" : "Event deleted", {
      description: event.title,
      action: { label: "Undo", onClick: () => upsert(event) },
    })
  }

  const duplicateEvent = (event: CalendarEvent) => {
    const copy: EventDraft = {
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      color: event.color,
      notes: event.notes,
      location: event.location,
      recurrence: event.recurrence,
      recurrenceUntil: event.recurrenceUntil,
      alertMinutes: event.alertMinutes ?? null,
    }
    setSheet({ open: true, initial: copy, heading: "Duplicate event", formKey: `copy-${event.id}-${Date.now()}` })
  }

  /** Confirmed AI suggestion → save, jump to its day and highlight it. */
  const addFromAi = (event: CalendarEvent) => {
    const created = add(event)
    setQuery("")
    goTo(new Date(created.start))
    flash(created.id)
    toast.success("Event added", {
      description: `${created.title} · ${format(new Date(created.start), "EEE, MMM d")}`,
      action: { label: "Undo", onClick: () => remove(created.id) },
    })
  }
  const editFromAi = (event: CalendarEvent) =>
    setSheet({ open: true, initial: event, heading: "Review event", formKey: `ai-${event.id}` })

  const jumpTo = (value: string) => {
    if (!DATE_RE.test(value)) return
    const d = fromDateString(value)
    if (Number.isNaN(d.getTime())) return
    goTo(d)
    setGotoOpen(false)
  }

  const selectedDate = fromDateString(selectedDay)
  const selectedOccs = view === "month" ? occurrencesOn(occurrences, selectedDate) : []
  const selectedTasks = view === "month" ? (visibleTasks?.get(selectedDay) ?? []) : []
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))
  const title = viewTitle(view, cursor)

  return (
    <ToolPage
      toolId="calendar"
      width="wide"
      actions={
        <Button className="hidden sm:inline-flex" onClick={() => openNew()}>
          <Plus aria-hidden /> New event
        </Button>
      }
    >
      {hydrated && ai?.configured ? <AiQuickAdd className="mb-4" onAdd={addFromAi} onEdit={editFromAi} /> : null}

      {!hydrated ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading calendar">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-112 w-full rounded-2xl" />
        </div>
      ) : events.length === 0 && !hasDueTasks ? (
        <EmptyState
          icon={CalendarDays}
          title="Your calendar is clear."
          description="Add appointments, birthdays and repeating events — everything stays in this browser."
          action={
            <Button size="lg" onClick={() => openNew()}>
              <Plus aria-hidden /> Create Event
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-1.5">
                <Button variant="outline" size="icon" aria-label="Previous" disabled={searching} onClick={() => navigate(-1)}>
                  <ChevronLeft aria-hidden />
                </Button>
                <Button variant="outline" size="icon" aria-label="Next" disabled={searching} onClick={() => navigate(1)}>
                  <ChevronRight aria-hidden />
                </Button>
                <Button variant="outline" disabled={searching} onClick={() => goTo(now)}>
                  Today
                </Button>
                <h2 className="ml-1 min-w-0 text-lg font-semibold sm:text-xl" aria-live="polite">
                  {searching ? (
                    <span className="block truncate px-1.5">Next 12 months</span>
                  ) : (
                    <Popover open={gotoOpen} onOpenChange={setGotoOpen}>
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            aria-label={`${title}. Go to date`}
                            className="flex max-w-full min-w-0 items-center gap-1 rounded-lg px-1.5 py-1 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                          />
                        }
                      >
                        <span className="truncate">{title}</span>
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64">
                        <form
                          className="space-y-2"
                          onSubmit={(e) => {
                            e.preventDefault()
                            jumpTo(String(new FormData(e.currentTarget).get("date") ?? ""))
                          }}
                        >
                          <Label htmlFor={gotoId}>Go to date</Label>
                          <Input id={gotoId} name="date" type="date" defaultValue={selectedDay} required className="h-10" />
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => jumpTo(today)}>
                              Today
                            </Button>
                            <Button type="submit" className="flex-1">
                              Go
                            </Button>
                          </div>
                        </form>
                      </PopoverContent>
                    </Popover>
                  )}
                </h2>
              </div>
              <div role="radiogroup" aria-label="Calendar view" className="grid shrink-0 grid-cols-4 rounded-lg bg-muted p-0.75 sm:inline-grid">
                {VIEW_ITEMS.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    role="radio"
                    aria-checked={view === v.value}
                    onClick={() => {
                      setView(v.value)
                      setCursorStr(selectedDay)
                      if (v.value !== "agenda") setQuery("")
                    }}
                    className={cn(
                      "h-9 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      view === v.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <label htmlFor={searchId} className="sr-only">
                  Search events
                </label>
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    if (e.target.value.trim() && view !== "agenda") setView("agenda")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && query) {
                      e.preventDefault()
                      setQuery("")
                    }
                  }}
                  placeholder="Search events"
                  autoComplete="off"
                  maxLength={100}
                  className="h-10 pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
                />
                {query ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                    className="absolute top-1/2 right-1 -translate-y-1/2"
                  >
                    <X aria-hidden />
                  </Button>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                aria-pressed={showTasks}
                onClick={() => setShowTasks((s) => !s)}
                className={cn("shrink-0", showTasks && "border-primary/40 bg-primary/8 text-primary hover:bg-primary/12")}
              >
                <SquareCheck aria-hidden />
                <span>
                  <span className="sr-only sm:not-sr-only">Show </span>tasks
                </span>
              </Button>
            </div>
            {searching ? (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                {searchResults.length
                  ? `${searchResults.length} matching ${searchResults.length === 1 ? "occurrence" : "occurrences"} in the next 12 months`
                  : "No matches"}
              </p>
            ) : null}
          </div>

          {view === "month" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <MonthView
                cursor={cursor}
                rangeStart={range.start}
                rangeEnd={range.end}
                occurrences={occurrences}
                now={now}
                selectedDay={selectedDay}
                onSelectDay={(d) => setSelectedStr(toDateString(d))}
                onEventClick={openEdit}
                onCreate={(d) => openNew({ start: defaultStart(toDateString(d)) })}
                tasksByDay={visibleTasks}
                highlightId={highlightId}
              />
              <section aria-label={`Events on ${format(selectedDate, "EEEE, MMMM d")}`} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {selectedDay === today ? "Today" : format(selectedDate, "EEEE")}
                    <span className="ml-1.5 font-normal text-muted-foreground">{format(selectedDate, "MMM d")}</span>
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => openNew({ start: defaultStart(selectedDay) })}>
                    <Plus aria-hidden /> Add
                  </Button>
                </div>
                {selectedOccs.length ? (
                  <ul className="space-y-2">
                    {selectedOccs.map((o) => (
                      <li key={o.key}>
                        <EventCard occurrence={o} onClick={openEdit} highlight={highlightId === o.event.id} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    No events on this day.
                  </p>
                )}
                <TasksDueList tasks={selectedTasks} />
                <p className="hidden text-xs text-muted-foreground lg:block">Tip: double-click a day to add an event.</p>
              </section>
            </div>
          ) : view === "week" ? (
            <TimeGrid
              days={weekDays}
              occurrences={occurrences}
              now={now}
              onSlotClick={(start) => openNew({ start })}
              onEventClick={openEdit}
              onDayClick={(d) => {
                setView("day")
                goTo(d)
              }}
              tasksByDay={visibleTasks}
              highlightId={highlightId}
            />
          ) : view === "day" ? (
            <TimeGrid
              days={[startOfDay(cursor)]}
              occurrences={occurrences}
              now={now}
              onSlotClick={(start) => openNew({ start })}
              onEventClick={openEdit}
              tasksByDay={visibleTasks}
              highlightId={highlightId}
            />
          ) : searching ? (
            <AgendaView
              rangeStart={searchStart}
              rangeEnd={searchEnd}
              occurrences={searchResults}
              now={now}
              onEventClick={openEdit}
              highlightId={highlightId}
              empty={{
                title: `No events match “${query.trim()}”`,
                description: "Search looks at titles, locations and notes over the next 12 months.",
              }}
            />
          ) : (
            <AgendaView
              rangeStart={range.start}
              rangeEnd={range.end}
              occurrences={occurrences}
              now={now}
              onEventClick={openEdit}
              highlightId={highlightId}
            />
          )}
          {view === "week" || view === "day" ? (
            <p className="text-xs text-muted-foreground">Click an empty time slot to add an event there.</p>
          ) : null}
        </div>
      )}

      <Button
        size="icon-lg"
        aria-label="New event"
        onClick={() => openNew()}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 rounded-full shadow-lg sm:hidden lg:bottom-8"
      >
        <Plus className="size-6" aria-hidden />
      </Button>

      <EventFormSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        event={sheet.event}
        prefill={sheet.prefill}
        initial={sheet.initial}
        heading={sheet.heading}
        formKey={sheet.formKey}
        onSubmit={submit}
        onDelete={deleteEvent}
        onDuplicate={duplicateEvent}
      />
    </ToolPage>
  )
}
