"use client"

import { cn } from "@/lib/utils"

/* ------------------------------------------------------------ ProgressRing */

interface ProgressRingProps {
  value: number
  goal: number
  label: string
  /** Big text in the centre, e.g. "6". */
  display: string
  /** Small text under the ring, e.g. "of 8 glasses". */
  caption: string
  color: string
  icon?: React.ReactNode
}

const R = 34
const C = 2 * Math.PI * R

export function ProgressRing({ value, goal, label, display, caption, color, icon }: ProgressRingProps) {
  const pct = goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0
  const met = goal > 0 && value >= goal
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="relative size-24 sm:size-28"
        role="img"
        aria-label={`${label}: ${display} ${caption}, ${Math.round(pct * 100)}% of goal${met ? ", goal reached" : ""}`}
      >
        <svg viewBox="0 0 80 80" className="size-full -rotate-90">
          <circle cx="40" cy="40" r={R} fill="none" stroke="var(--muted)" strokeWidth="7" />
          {pct > 0 ? (
            <circle
              cx="40"
              cy="40"
              r={R}
              fill="none"
              stroke={color}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${pct * C} ${C}`}
              className="transition-[stroke-dasharray] duration-500"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {icon ? <span className="mb-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
          <span className="text-lg leading-none font-semibold tabular-nums">{display}</span>
        </div>
      </div>
      <p className="mt-1.5 text-sm font-medium">{label}</p>
      <p className={cn("text-xs tabular-nums", met ? "font-medium text-success" : "text-muted-foreground")}>{met ? "Goal reached" : caption}</p>
    </div>
  )
}

/* ------------------------------------------------------------- WeeklyBars */

export interface WeeklyPoint {
  /** Short label (e.g. "Mon"). */
  label: string
  /** Full label for screen readers / tooltip (e.g. "Monday 3 Oct"). */
  fullLabel: string
  value: number
  isSelected?: boolean
}

interface WeeklyBarsProps {
  title: string
  points: WeeklyPoint[]
  goal: number
  color: string
  format: (n: number) => string
  unit: string
}

const W = 320
const H = 168
const PAD_TOP = 22
const PAD_BOTTOM = 26
const PAD_X = 8

/** Seven-day bar chart with a dashed goal line, direct value labels and an sr-only table. */
export function WeeklyBars({ title, points, goal, color, format, unit }: WeeklyBarsProps) {
  const max = Math.max(goal, ...points.map((p) => p.value), 1) * 1.08
  const plotH = H - PAD_TOP - PAD_BOTTOM
  const slot = (W - PAD_X * 2) / points.length
  const barW = Math.min(28, slot * 0.56)
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH
  const goalY = y(goal)
  const met = points.filter((p) => goal > 0 && p.value >= goal).length
  const avg = points.reduce((s, p) => s + p.value, 0) / (points.length || 1)

  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
        {/* baseline */}
        <line x1={PAD_X} x2={W - PAD_X} y1={PAD_TOP + plotH} y2={PAD_TOP + plotH} stroke="var(--border)" strokeWidth="1" />
        {points.map((p, i) => {
          const cx = PAD_X + slot * i + slot / 2
          const top = y(p.value)
          const h = PAD_TOP + plotH - top
          const r = Math.min(4, barW / 2, h)
          return (
            <g key={p.fullLabel}>
              <title>{`${p.fullLabel}: ${format(p.value)} ${unit}`}</title>
              {/* generous hit target */}
              <rect x={cx - slot / 2} y={PAD_TOP} width={slot} height={plotH} fill="transparent" />
              {h > 0 ? (
                <path
                  d={`M${cx - barW / 2},${PAD_TOP + plotH} V${top + r} Q${cx - barW / 2},${top} ${cx - barW / 2 + r},${top} H${cx + barW / 2 - r} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + r} V${PAD_TOP + plotH} Z`}
                  fill={color}
                  opacity={p.isSelected ? 1 : 0.55}
                />
              ) : null}
              {p.value > 0 ? (
                <text x={cx} y={top - 6} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">
                  {format(p.value)}
                </text>
              ) : null}
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                className={cn("text-[11px]", p.isSelected ? "fill-foreground font-semibold" : "fill-muted-foreground")}
              >
                {p.label}
              </text>
            </g>
          )
        })}
        {goal > 0 ? (
          <g>
            <line x1={PAD_X} x2={W - PAD_X} y1={goalY} y2={goalY} stroke="var(--foreground)" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x={W - PAD_X} y={goalY - 5} textAnchor="end" className="fill-muted-foreground text-[10px]">
              Goal {format(goal)}
            </text>
          </g>
        ) : null}
      </svg>
      <figcaption className="text-xs text-muted-foreground">
        {title}: goal met on {met} of {points.length} days · average {format(Math.round(avg * 10) / 10)} {unit}
      </figcaption>
      <table className="sr-only">
        <caption>{title} for the last 7 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Value ({unit})</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.fullLabel}>
              <th scope="row">{p.fullLabel}</th>
              <td>{format(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
