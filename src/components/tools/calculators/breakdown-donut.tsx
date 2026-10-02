"use client"

import { cn } from "@/lib/utils"

export interface DonutSegment {
  label: string
  value: number
  /** CSS colour, e.g. "var(--chart-1)". */
  color: string
  display: string
}

interface BreakdownDonutProps {
  segments: DonutSegment[]
  /** Text in the centre of the ring. */
  centerLabel: string
  centerValue: string
  className?: string
}

const R = 52
const STROKE = 16
const C = 2 * Math.PI * R
/** Visual gap (in px along the ring) between segments. */
const GAP = 3

/**
 * Accessible donut with a direct-labelled legend. Colours come from theme
 * tokens so it adapts to dark mode; values are always shown as text too.
 */
export function BreakdownDonut({ segments, centerLabel, centerValue, className }: BreakdownDonutProps) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0)
  const visible = segments.filter((s) => s.value > 0)
  const summary = segments
    .map((s) => `${s.label} ${s.display} (${total ? Math.round((s.value / total) * 100) : 0}%)`)
    .join(", ")

  const arcs: { seg: DonutSegment; dash: number; from: number }[] = []
  let from = 0
  for (const seg of visible) {
    const len = total ? (seg.value / total) * C : 0
    const gap = visible.length > 1 ? Math.min(GAP, len / 2) : 0
    arcs.push({ seg, dash: Math.max(0, len - gap), from })
    from += len
  }

  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row sm:gap-6", className)}>
      <figure className="relative size-40 shrink-0 sm:size-44" role="img" aria-label={`Breakdown: ${summary}`}>
        <svg viewBox="0 0 128 128" className="size-full -rotate-90">
          <circle cx="64" cy="64" r={R} fill="none" stroke="var(--muted)" strokeWidth={STROKE} />
          {arcs.map(({ seg, dash, from }) => (
            <circle
              key={seg.label}
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-from}
            >
              <title>{`${seg.label}: ${seg.display}`}</title>
            </circle>
          ))}
        </svg>
        <figcaption className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="text-[0.7rem] text-muted-foreground">{centerLabel}</span>
          <span className="text-sm font-semibold tabular-nums break-all">{centerValue}</span>
        </figcaption>
      </figure>
      <ul className="w-full min-w-0 flex-1 space-y-2.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-3">
            <span className="size-3 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">{s.label}</span>
            <span className="text-right">
              <span className="block text-sm font-semibold tabular-nums">{s.display}</span>
              <span className="block text-xs text-muted-foreground tabular-nums">
                {total ? `${((s.value / total) * 100).toFixed(1)}%` : "0%"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
