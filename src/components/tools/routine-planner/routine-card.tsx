"use client"

import { Clock, Repeat } from "lucide-react"
import { CheckCircle } from "@/components/tools/todo/task-card"
import { colorClasses } from "@/components/tools/calendar/event-colors"
import { cn } from "@/lib/utils"
import type { RoutineItem } from "@/types"
import { formatClock, formatDuration, repeatLabel, toMinutes } from "./routine-utils"

export interface RoutineCardProps {
  item: RoutineItem
  /** The day being viewed (`yyyy-MM-dd`) — completion is per day. */
  date: string
  onToggle: (item: RoutineItem, date: string) => void
  onEdit?: (item: RoutineItem) => void
  /** Highlight as the item happening right now. */
  active?: boolean
  /** 0–1 elapsed fraction for the active item. */
  progress?: number
  /** Disable the completion toggle (e.g. future days). */
  toggleDisabled?: boolean
  compact?: boolean
  /** Minimum block height in px (timeline makes this proportional to duration). */
  minHeight?: number
  className?: string
  children?: React.ReactNode
}

export function RoutineCard({
  item,
  date,
  onToggle,
  onEdit,
  active,
  progress,
  toggleDisabled,
  compact,
  minHeight,
  className,
  children,
}: RoutineCardProps) {
  const c = colorClasses(item.color)
  const done = item.completedDates.includes(date)
  const start = toMinutes(item.time)
  const timeRange = `${formatClock(start)} – ${formatClock(start + item.durationMinutes)}`

  const body = (
    <>
      <span className={cn("block font-medium wrap-break-word", compact ? "text-sm" : "text-[0.95rem]", done && "line-through opacity-70")}>
        {item.title}
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs opacity-80">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Clock className="size-3.5" aria-hidden />
          {timeRange}
        </span>
        {!compact ? <span>{formatDuration(item.durationMinutes)}</span> : null}
        {!compact ? (
          <span className="inline-flex items-center gap-1">
            <Repeat className="size-3.5" aria-hidden />
            {repeatLabel(item.repeatDays)}
          </span>
        ) : null}
      </span>
    </>
  )

  return (
    <div
      style={minHeight ? { minHeight } : undefined}
      className={cn(
        "relative flex items-start gap-3 overflow-hidden rounded-2xl border-l-4 transition-shadow",
        c.soft,
        c.border,
        compact ? "p-2.5" : "p-3",
        active && cn("shadow-soft ring-2", c.ring),
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {active ? (
          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[0.7rem] font-semibold tracking-wide uppercase">
            <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden /> Now
          </span>
        ) : null}
        {onEdit ? (
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="block w-full rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label={`Edit ${item.title}, ${timeRange}`}
          >
            {body}
          </button>
        ) : (
          body
        )}
        {children}
      </div>
      <div className={cn("pt-0.5 pr-0.5", toggleDisabled && "pointer-events-none opacity-40")}>
        <CheckCircle
          checked={done}
          onToggle={() => !toggleDisabled && onToggle(item, date)}
          label={done ? `Mark "${item.title}" as not done` : `Mark "${item.title}" done`}
          size={compact ? "sm" : "md"}
        />
      </div>
      {active && typeof progress === "number" ? (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-background/40" aria-hidden>
          <div className="h-full bg-current opacity-60" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
        </div>
      ) : null}
    </div>
  )
}
