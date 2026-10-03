"use client"

import { Bell, Clock, MapPin, Repeat } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EventOccurrence } from "@/types"
import { alertLabel, hasAlert, occurrenceTimeLabel } from "./calendar-utils"
import { colorClasses } from "./event-colors"

export interface EventCardProps {
  occurrence: EventOccurrence
  /** Makes the card a button (e.g. open the editor). */
  onClick?: (occurrence: EventOccurrence) => void
  /** Single-line variant for dashboards. */
  compact?: boolean
  className?: string
  /** Briefly emphasise the card (e.g. just created). */
  highlight?: boolean
}

export function EventCard({ occurrence, onClick, compact, className, highlight }: EventCardProps) {
  const { event } = occurrence
  const c = colorClasses(event.color)
  const time = occurrenceTimeLabel(occurrence)

  const content = (
    <>
      <span className={cn("w-1 shrink-0 self-stretch rounded-full", c.swatch)} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-medium", compact ? "text-sm" : "text-[0.95rem]")}>{event.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="size-3.5" aria-hidden />
            {time}
          </span>
          {event.location && !compact ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{event.location}</span>
            </span>
          ) : null}
          {event.recurrence !== "none" ? (
            <span className="inline-flex items-center gap-1">
              <Repeat className="size-3.5" aria-hidden />
              <span className={cn(compact && "sr-only")}>Repeats {event.recurrence}</span>
            </span>
          ) : null}
          {hasAlert(event.alertMinutes) ? (
            <span className="inline-flex items-center gap-1" title={`Alert: ${alertLabel(event.alertMinutes)}`}>
              <Bell className="size-3.5" aria-hidden />
              <span className="sr-only">Alert {alertLabel(event.alertMinutes)}</span>
            </span>
          ) : null}
        </span>
        {event.notes && !compact ? <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{event.notes}</span> : null}
      </span>
    </>
  )

  const base = cn(
    "flex w-full items-start gap-3 rounded-xl border bg-card text-left shadow-soft",
    compact ? "p-2.5" : "p-3",
    highlight && "ring-2 ring-primary ring-offset-2 ring-offset-background",
    className
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={() => onClick(occurrence)}
        className={cn(base, "transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50")}
      >
        {content}
      </button>
    )
  }
  return <div className={base}>{content}</div>
}
