"use client"

import { addDays, format, isSameDay, startOfDay } from "date-fns"
import { CalendarCheck2 } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { cn } from "@/lib/utils"
import type { EventOccurrence } from "@/types"
import { occurrencesOn } from "./calendar-utils"
import { EventCard } from "./event-card"

interface AgendaViewProps {
  rangeStart: Date
  rangeEnd: Date
  occurrences: EventOccurrence[]
  now: Date
  onEventClick: (o: EventOccurrence) => void
}

export function AgendaView({ rangeStart, rangeEnd, occurrences, now, onEventClick }: AgendaViewProps) {
  const groups: { day: Date; items: EventOccurrence[] }[] = []
  for (let d = startOfDay(rangeStart); d < rangeEnd; d = addDays(d, 1)) {
    const items = occurrencesOn(occurrences, d)
    if (items.length) groups.push({ day: d, items })
  }

  if (!groups.length) {
    return (
      <EmptyState
        icon={CalendarCheck2}
        title="Nothing scheduled in this period"
        description="Use the arrows to look further ahead, or create an event."
      />
    )
  }

  const tomorrow = addDays(startOfDay(now), 1)
  return (
    <ol className="space-y-5">
      {groups.map(({ day, items }) => {
        const today = isSameDay(day, now)
        return (
          <li key={day.toISOString()} className="grid grid-cols-1 gap-2 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4">
            <h3 className="flex items-baseline gap-2 sm:block sm:pt-2">
              <span className={cn("text-sm font-semibold", today && "text-primary")}>
                {today ? "Today" : isSameDay(day, tomorrow) ? "Tomorrow" : format(day, "EEEE")}
              </span>
              <span className="text-sm text-muted-foreground sm:block">{format(day, "MMM d, yyyy")}</span>
            </h3>
            <ul className="space-y-2">
              {items.map((o) => (
                <li key={o.key}>
                  <EventCard occurrence={o} onClick={onEventClick} />
                </li>
              ))}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}
