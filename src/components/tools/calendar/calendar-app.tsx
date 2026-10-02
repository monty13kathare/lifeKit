"use client"

import { useMemo, useState } from "react"
import { addDays, addHours, format, isSameMonth, setHours, startOfDay, startOfHour, startOfMonth, startOfWeek } from "date-fns"
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { ToolPage } from "@/components/common/tool-page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCalendar } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { expandEvents, fromDateString, toDateString } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { CalendarEvent, EventOccurrence } from "@/types"
import { AgendaView } from "./agenda-view"
import { occurrencesOn, shiftCursor, VIEW_ITEMS, viewRange, viewTitle, type CalendarView } from "./calendar-utils"
import { EventCard } from "./event-card"
import { EventFormSheet, type EventDraft, type EventPrefill } from "./event-form"
import { MonthView } from "./month-view"
import { TimeGrid } from "./time-grid"
import { useNow } from "./use-now"

type SheetState = { open: boolean; event?: CalendarEvent; prefill?: EventPrefill }

export function CalendarApp() {
  const hydrated = useHydrated()
  const { events, add, update, remove, upsert } = useCalendar()
  const now = useNow()
  const today = toDateString(now)

  const [view, setView] = useState<CalendarView>("month")
  const [cursorStr, setCursorStr] = useState<string | null>(null)
  const [selectedStr, setSelectedStr] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState>({ open: false })

  const cursorKey = cursorStr ?? today
  const cursor = fromDateString(cursorKey)
  const selectedDay = selectedStr ?? cursorKey
  const range = viewRange(view, cursor)

  const occurrences = useMemo(() => {
    const r = viewRange(view, fromDateString(cursorKey))
    return expandEvents(events, r.start, r.end)
  }, [events, view, cursorKey])

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
      update(sheet.event.id, draft)
      toast.success(sheet.event.recurrence !== "none" || draft.recurrence !== "none" ? "Series updated" : "Event updated")
    } else {
      add(draft)
      toast.success("Event created", { description: `${draft.title} · ${format(new Date(draft.start), "EEE, MMM d")}` })
      if (view !== "agenda") goTo(new Date(draft.start))
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

  const selectedDate = fromDateString(selectedDay)
  const selectedOccs = view === "month" ? occurrencesOn(occurrences, selectedDate) : []
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))

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
      {!hydrated ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading calendar">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-112 w-full rounded-2xl" />
        </div>
      ) : events.length === 0 ? (
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" aria-label="Previous" onClick={() => navigate(-1)}>
                <ChevronLeft aria-hidden />
              </Button>
              <Button variant="outline" size="icon" aria-label="Next" onClick={() => navigate(1)}>
                <ChevronRight aria-hidden />
              </Button>
              <Button variant="outline" onClick={() => goTo(now)}>
                Today
              </Button>
              <h2 className="ml-1.5 min-w-0 truncate text-lg font-semibold sm:text-xl" aria-live="polite">
                {viewTitle(view, cursor)}
              </h2>
            </div>
            <div role="radiogroup" aria-label="Calendar view" className="grid grid-cols-4 rounded-lg bg-muted p-0.75 sm:inline-grid">
              {VIEW_ITEMS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  role="radio"
                  aria-checked={view === v.value}
                  onClick={() => {
                    setView(v.value)
                    setCursorStr(selectedDay)
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
                        <EventCard occurrence={o} onClick={openEdit} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    No events on this day.
                  </p>
                )}
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
            />
          ) : view === "day" ? (
            <TimeGrid
              days={[startOfDay(cursor)]}
              occurrences={occurrences}
              now={now}
              onSlotClick={(start) => openNew({ start })}
              onEventClick={openEdit}
            />
          ) : (
            <AgendaView rangeStart={range.start} rangeEnd={range.end} occurrences={occurrences} now={now} onEventClick={openEdit} />
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
        onSubmit={submit}
        onDelete={deleteEvent}
      />
    </ToolPage>
  )
}
