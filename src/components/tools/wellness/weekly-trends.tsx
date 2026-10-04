"use client"

import { useMemo, useState } from "react"
import { format, subDays } from "date-fns"
import { Segmented } from "@/components/tools/calculators/fields"
import { useWellness } from "@/hooks/use-lifekit-data"
import { fromDateString, toDateString, todayString } from "@/lib/dates"
import { WeeklyBars, type WeeklyPoint } from "./wellness-charts"

type Metric = "waterGlasses" | "steps" | "exerciseMinutes" | "sleepHours"

const METRICS: Record<Metric, { label: string; unit: string; color: string }> = {
  waterGlasses: { label: "Water", unit: "glasses", color: "var(--chart-2)" },
  steps: { label: "Steps", unit: "steps", color: "var(--chart-3)" },
  exerciseMinutes: { label: "Exercise", unit: "min", color: "var(--chart-5)" },
  sleepHours: { label: "Sleep", unit: "hours", color: "var(--chart-1)" },
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 })

/** Last 7 days for one metric against its daily goal. */
export function WeeklyTrends() {
  const { days, goals } = useWellness()
  const [metric, setMetric] = useState<Metric>("steps")
  const meta = METRICS[metric]
  const today = todayString()
  const byId = useMemo(() => new Map(days.map((d) => [d.id, d])), [days])
  const end = fromDateString(today)
  const points: WeeklyPoint[] = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(end, 6 - i)
    const id = toDateString(d)
    return { label: format(d, "EEEEE"), fullLabel: format(d, "EEEE d MMM"), value: byId.get(id)?.[metric] ?? 0, isSelected: id === today }
  })

  return (
    <section aria-labelledby="weekly-heading" className="rounded-2xl border bg-card p-4">
      <h2 id="weekly-heading" className="mb-3 text-sm font-semibold">
        Last 7 days
      </h2>
      <Segmented
        label="Metric"
        size="sm"
        value={metric}
        onChange={setMetric}
        options={(Object.keys(METRICS) as Metric[]).map((m) => ({ value: m, label: METRICS[m].label }))}
        className="mb-4 w-full"
      />
      <WeeklyBars
        title={meta.label}
        points={points}
        goal={goals[metric]}
        color={meta.color}
        unit={meta.unit}
        format={(n) => (metric === "steps" && n >= 1000 ? `${(n / 1000).toFixed(1)}k` : fmt(n))}
      />
    </section>
  )
}
