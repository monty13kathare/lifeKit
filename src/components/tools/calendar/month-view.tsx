"use client"

import { addDays, format, isSameDay, isSameMonth, startOfWeek } from "date-fns"
import { toDateString } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { EventOccurrence } from "@/types"
import { occurrencesOn } from "./calendar-utils"
import { colorClasses } from "./event-colors"

interface MonthViewProps {
  /** Any date in the month to show. */
  cursor: Date
  /** First day of the grid … exclusive end, from `viewRange("month")`. */
  rangeStart: Date
  rangeEnd: Date
  occurrences: EventOccurrence[]
  now: Date
  selectedDay: string
  onSelectDay: (day: Date) => void
  onEventClick: (o: EventOccurrence) => void
  /** Double-click (desktop) on a day creates an event. */
  onCreate: (day: Date) => void
}

const MAX_CHIPS = 3

export function MonthView({
  cursor,
  rangeStart,
  rangeEnd,
  occurrences,
  now,
  selectedDay,
  onSelectDay,
  onEventClick,
  onCreate,
}: MonthViewProps) {
  const days: Date[] = []
  for (let d = rangeStart; d < rangeEnd; d = addDays(d, 1)) days.push(d)
  const weekdays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="grid grid-cols-7 border-b bg-surface-muted/50" aria-hidden>
        {weekdays.map((d) => (
          <div key={d.toISOString()} className="py-2 text-center text-xs font-medium text-muted-foreground">
            <span className="sm:hidden">{format(d, "EEEEE")}</span>
            <span className="hidden sm:inline">{format(d, "EEE")}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const ds = toDateString(day)
          const dayOccs = occurrencesOn(occurrences, day)
          const inMonth = isSameMonth(day, cursor)
          const isToday = isSameDay(day, now)
          const selected = ds === selectedDay
          const extra = dayOccs.length - MAX_CHIPS
          return (
            <div
              key={ds}
              onClick={() => onSelectDay(day)}
              onDoubleClick={() => onCreate(day)}
              className={cn(
                "flex min-h-14 cursor-pointer flex-col gap-1 border-b p-1 transition-colors sm:min-h-28 sm:p-1.5",
                i % 7 !== 0 && "border-l",
                !inMonth && "bg-surface-muted/40",
                selected ? "bg-primary/6" : "hover:bg-muted/40"
              )}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectDay(day)
                }}
                aria-label={`${format(day, "EEEE, MMMM d")}${dayOccs.length ? `, ${dayOccs.length} ${dayOccs.length === 1 ? "event" : "events"}` : ""}`}
                aria-pressed={selected}
                className={cn(
                  "mx-auto flex size-8 items-center justify-center rounded-full text-sm tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:mx-0",
                  !inMonth && "text-muted-foreground/70",
                  isToday && "bg-primary font-semibold text-primary-foreground",
                  selected && !isToday && "font-semibold ring-2 ring-primary"
                )}
              >
                {format(day, "d")}
              </button>

              {/* Mobile: dots */}
              {dayOccs.length ? (
                <div className="flex justify-center gap-0.5 sm:hidden" aria-hidden>
                  {dayOccs.slice(0, 3).map((o) => (
                    <span key={o.key} className={cn("size-1.5 rounded-full", colorClasses(o.event.color).swatch)} />
                  ))}
                </div>
              ) : null}

              {/* sm+: chips */}
              <ul className="hidden min-w-0 space-y-0.5 sm:block">
                {dayOccs.slice(0, MAX_CHIPS).map((o) => {
                  const c = colorClasses(o.event.color)
                  return (
                    <li key={o.key}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick(o)
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className={cn(
                          "flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          c.soft,
                          c.softHover
                        )}
                      >
                        {!o.event.allDay && isSameDay(o.start, day) ? (
                          <span className="shrink-0 opacity-75 tabular-nums">{format(o.start, o.start.getMinutes() ? "h:mm" : "h a")}</span>
                        ) : null}
                        <span className="truncate">{o.event.title}</span>
                      </button>
                    </li>
                  )
                })}
                {extra > 0 ? (
                  <li>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectDay(day)
                      }}
                      className="w-full rounded-md px-1.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      +{extra} more
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
