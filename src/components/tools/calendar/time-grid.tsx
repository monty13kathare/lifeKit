"use client"

import { useEffect, useRef } from "react"
import { format, isSameDay, setHours, setMinutes, startOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import type { EventOccurrence } from "@/types"
import { layoutDay, occurrencesOn, occurrenceTimeLabel } from "./calendar-utils"
import { colorClasses } from "./event-colors"

const HOUR = 48 // px per hour
const HOURS = Array.from({ length: 24 }, (_, h) => h)

interface TimeGridProps {
  days: Date[]
  occurrences: EventOccurrence[]
  now: Date
  onSlotClick: (start: Date) => void
  onEventClick: (o: EventOccurrence) => void
  /** Clicking a day header (week view) — e.g. open that day. */
  onDayClick?: (day: Date) => void
}

export function TimeGrid({ days, occurrences, now, onSlotClick, onEventClick, onDayClick }: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const multi = days.length > 1
  const showsToday = days.some((d) => isSameDay(d, now))

  const firstDay = days[0]?.getTime()
  const dayCount = days.length

  // Scroll to the current hour (or 7 AM) when the visible days change.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const hour = showsToday ? Math.max(0, new Date().getHours() - 1) : 7
    el.scrollTop = hour * HOUR
  }, [firstDay, dayCount, showsToday])

  const cols = `3rem repeat(${days.length}, minmax(0, 1fr))`
  const allDayByDay = days.map((d) => occurrencesOn(occurrences, d).filter((o) => o.event.allDay))
  const hasAllDay = allDayByDay.some((l) => l.length)
  const nowTop = (now.getHours() * 60 + now.getMinutes()) * (HOUR / 60)

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="overflow-x-auto overscroll-x-contain">
        <div style={{ minWidth: multi ? 640 : undefined }}>
          {/* Day headers */}
          <div className="grid border-b bg-surface-muted/50" style={{ gridTemplateColumns: cols }}>
            <div />
            {days.map((d) => {
              const today = isSameDay(d, now)
              const label = (
                <>
                  <span className="text-xs font-medium text-muted-foreground">{format(d, "EEE")}</span>
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                      today && "bg-primary text-primary-foreground"
                    )}
                  >
                    {format(d, "d")}
                  </span>
                </>
              )
              return (
                <div key={d.toISOString()} className="border-l py-1.5">
                  {onDayClick && multi ? (
                    <button
                      type="button"
                      onClick={() => onDayClick(d)}
                      aria-label={`Open ${format(d, "EEEE, MMMM d")}`}
                      className="mx-auto flex flex-col items-center rounded-lg px-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {label}
                    </button>
                  ) : (
                    <div className="flex flex-col items-center">{label}</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* All-day row */}
          {hasAllDay ? (
            <div className="grid border-b" style={{ gridTemplateColumns: cols }}>
              <div className="flex items-center justify-end pr-1.5 text-[0.65rem] text-muted-foreground">All day</div>
              {allDayByDay.map((list, i) => (
                <div key={i} className="min-w-0 space-y-0.5 border-l p-0.5">
                  {list.map((o) => {
                    const c = colorClasses(o.event.color)
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => onEventClick(o)}
                        className={cn("block w-full truncate rounded-md px-1.5 py-0.5 text-left text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", c.soft, c.softHover)}
                      >
                        {o.event.title}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          ) : null}

          {/* Hour grid */}
          <div ref={scrollRef} className="max-h-[calc(100dvh-20rem)] min-h-80 overflow-y-auto">
            <div className="relative grid" style={{ gridTemplateColumns: cols, height: 24 * HOUR }}>
              <div className="relative" aria-hidden>
                {HOURS.map((h) =>
                  h === 0 ? null : (
                    <span
                      key={h}
                      className="absolute right-1.5 -translate-y-1/2 text-[0.65rem] text-muted-foreground tabular-nums"
                      style={{ top: h * HOUR }}
                    >
                      {format(setHours(new Date(2000, 0, 1), h), "h a")}
                    </span>
                  )
                )}
              </div>
              {days.map((day) => {
                const placed = layoutDay(occurrences, day)
                const today = isSameDay(day, now)
                return (
                  <div
                    key={day.toISOString()}
                    className="relative cursor-pointer border-l"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const minutes = Math.floor(((e.clientY - rect.top) / HOUR) * 2) * 30
                      onSlotClick(setMinutes(startOfDay(day), Math.min(23 * 60 + 30, Math.max(0, minutes))))
                    }}
                  >
                    {HOURS.map((h) => (
                      <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-border/60" style={{ top: h * HOUR }} aria-hidden />
                    ))}
                    {placed.map((p) => {
                      const c = colorClasses(p.occurrence.event.color)
                      const top = p.startMin * (HOUR / 60)
                      const height = Math.max((p.endMin - p.startMin) * (HOUR / 60), 22)
                      const short = height < 40
                      return (
                        <button
                          key={p.occurrence.key}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick(p.occurrence)
                          }}
                          aria-label={`${p.occurrence.event.title}, ${occurrenceTimeLabel(p.occurrence)}`}
                          className={cn(
                            "absolute overflow-hidden rounded-md border-l-[3px] px-1.5 text-left text-xs leading-tight shadow-sm outline-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring",
                            c.soft,
                            c.softHover,
                            c.border,
                            short ? "flex items-center gap-1 py-0" : "py-1"
                          )}
                          style={{
                            top,
                            height,
                            left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
                            width: `calc(${100 / p.cols}% - 4px)`,
                          }}
                        >
                          <span className="block truncate font-semibold">{p.occurrence.event.title}</span>
                          <span className={cn("truncate opacity-80", short ? "hidden sm:inline" : "block")}>
                            {format(p.occurrence.start, "h:mm a")}
                          </span>
                          {!short && height > 64 && p.occurrence.event.location ? (
                            <span className="block truncate opacity-70">{p.occurrence.event.location}</span>
                          ) : null}
                        </button>
                      )
                    })}
                    {today ? (
                      <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }} aria-hidden>
                        <div className="relative h-0.5 bg-destructive">
                          <span className="absolute -top-1.25 -left-1.5 size-3 rounded-full bg-destructive" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
