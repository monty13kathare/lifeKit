"use client"

import { useMemo, useState } from "react"
import { addDays, format, subDays } from "date-fns"
import { Check, ChevronLeft, ChevronRight, Droplet, Dumbbell, Footprints, Minus, Moon, Plus, Settings2, Sparkles, Utensils, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useWellness } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { fromDateString, toDateString, todayString } from "@/lib/dates"
import { emptyWellnessDay } from "@/lib/storage/wellness"
import { cn } from "@/lib/utils"
import type { HealthPlan, WellnessDay } from "@/types"
import { GoalsSheet } from "./goals-sheet"

type Metric = "waterGlasses" | "steps" | "exerciseMinutes" | "sleepHours"

const METRICS: Record<Metric, { label: string; unit: string; color: string; icon: LucideIcon; step: number; max: number }> = {
  waterGlasses: { label: "Water", unit: "glasses", color: "var(--chart-2)", icon: Droplet, step: 1, max: 40 },
  steps: { label: "Steps", unit: "steps", color: "var(--chart-3)", icon: Footprints, step: 500, max: 100000 },
  exerciseMinutes: { label: "Exercise", unit: "min", color: "var(--chart-5)", icon: Dumbbell, step: 5, max: 600 },
  sleepHours: { label: "Sleep", unit: "hours", color: "var(--chart-1)", icon: Moon, step: 0.5, max: 16 },
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 })

interface TodayTrackerProps {
  /** Opens the AI Guide tab (shown when there's no plan yet). */
  onOpenGuide?: () => void
}

/** Today tab: four quick trackers and today's slice of the AI plan. */
export function TodayTracker({ onOpenGuide }: TodayTrackerProps) {
  const hydrated = useHydrated()
  const { days, goals, setGoals, upsertDay, plan } = useWellness()
  const today = todayString()
  const [date, setDate] = useState(today)
  const [goalsOpen, setGoalsOpen] = useState(false)

  const byId = useMemo(() => new Map(days.map((d) => [d.id, d])), [days])
  const day = byId.get(date) ?? emptyWellnessDay(date)
  const patch = (p: Partial<WellnessDay>) => upsertDay({ ...day, ...p, id: date })

  const isToday = date === today
  const shift = (n: number) => {
    const next = toDateString(addDays(fromDateString(date), n))
    if (n > 0 && next > today) return
    setDate(next)
  }

  if (!hydrated) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading wellness data">
        <Skeleton className="h-14 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  const dayLabel = isToday ? "Today" : date === toDateString(subDays(new Date(), 1)) ? "Yesterday" : format(fromDateString(date), "EEEE")

  return (
    <div className="space-y-4">
      {/* Date switcher */}
      <div className="flex items-center gap-1 rounded-2xl border bg-card p-1.5">
        <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => shift(-1)}>
          <ChevronLeft aria-hidden />
        </Button>
        <label className="relative flex min-h-10 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center rounded-lg hover:bg-muted/60">
          <span className="text-sm font-semibold" aria-live="polite">
            {dayLabel}
          </span>
          <span className="text-xs text-muted-foreground">{format(fromDateString(date), "d MMM yyyy")}</span>
          <input
            type="date"
            aria-label="Pick a date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && e.target.value <= today && setDate(e.target.value)}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker?.()
              } catch {
                /* not allowed in this browser – native focus still works */
              }
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <Button variant="ghost" size="icon" aria-label="Next day" onClick={() => shift(1)} disabled={isToday}>
          <ChevronRight aria-hidden />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Edit daily goals" onClick={() => setGoalsOpen(true)}>
          <Settings2 aria-hidden />
        </Button>
      </div>

      {/* Quick trackers */}
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(METRICS) as Metric[]).map((m) => (
          <MetricTile key={m} metric={m} value={day[m]} goal={goals[m]} onChange={(v) => patch({ [m]: v })} />
        ))}
      </div>

      <TodaysPlan plan={plan} day={day} weekday={WEEKDAY[fromDateString(date).getDay()]} onToggle={(key) => patch({ habits: { ...day.habits, [key]: !day.habits?.[key] } })} onOpenGuide={onOpenGuide} />

      <GoalsSheet open={goalsOpen} onOpenChange={setGoalsOpen} goals={goals} onSave={setGoals} />
    </div>
  )
}

function MetricTile({ metric, value, goal, onChange }: { metric: Metric; value: number; goal: number; onChange: (v: number) => void }) {
  const meta = METRICS[metric]
  const Icon = meta.icon
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0
  const done = goal > 0 && value >= goal
  const set = (v: number) => onChange(Math.min(meta.max, Math.max(0, Math.round(v * 10) / 10)))
  // Keep the typed text while editing so "7." doesn't snap back to "7".
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-3.5" aria-label={meta.label}>
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg" style={{ color: meta.color, backgroundColor: `color-mix(in oklch, ${meta.color} 14%, transparent)` }}>
          <Icon className="size-4.5" aria-hidden />
        </span>
        <span className="text-sm font-medium">{meta.label}</span>
        {done && <Check className="ml-auto size-4 text-success" aria-label="Goal reached" />}
      </div>
      <div>
        <input
          inputMode="decimal"
          aria-label={`${meta.label} (${meta.unit})`}
          value={draft ?? (value ? String(value) : "")}
          placeholder="0"
          onFocus={() => setDraft(value ? String(value) : "")}
          onBlur={() => setDraft(null)}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d.]/g, "")
            setDraft(raw)
            const n = parseFloat(raw)
            set(Number.isFinite(n) ? n : 0)
          }}
          className="w-full bg-transparent text-2xl font-semibold tabular-nums outline-none placeholder:text-foreground"
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          of {fmt(goal)} {meta.unit}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${meta.label} progress`}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" aria-label={`Less ${meta.label.toLowerCase()}`} onClick={() => set(value - meta.step)} disabled={value <= 0}>
          <Minus aria-hidden />
        </Button>
        <Button variant="secondary" aria-label={`More ${meta.label.toLowerCase()}`} onClick={() => set(value + meta.step)}>
          <Plus aria-hidden />
          <span className="text-xs">{meta.step >= 1 ? fmt(meta.step) : "½"}</span>
        </Button>
      </div>
    </section>
  )
}

function TodaysPlan({
  plan,
  day,
  weekday,
  onToggle,
  onOpenGuide,
}: {
  plan: HealthPlan | null
  day: WellnessDay
  weekday: (typeof WEEKDAY)[number]
  onToggle: (key: string) => void
  onOpenGuide?: () => void
}) {
  if (!plan) {
    if (!onOpenGuide) return null
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-dashed bg-surface/60 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Get your personal plan</p>
          <p className="text-sm text-muted-foreground">Diet, workouts and a daily routine for your goal.</p>
        </div>
        <Button onClick={onOpenGuide}>Start</Button>
      </section>
    )
  }

  const workout = plan.data.workouts.find((w) => w.day === weekday)
  const items = [
    ...(workout ? [{ key: "plan:workout", icon: Dumbbell, title: workout.rest ? `Rest day · ${workout.focus}` : workout.focus, detail: workout.rest ? "Light stretching or a walk" : `${workout.minutes} min · ${workout.exercises.slice(0, 3).join(", ")}` }] : []),
    ...plan.data.meals.map((m, i) => ({ key: `plan:meal:${i}`, icon: Utensils, title: `${m.name} · ${m.time}`, detail: `${m.items} (~${m.kcal} kcal)` })),
  ]
  const doneCount = items.filter((it) => day.habits?.[it.key]).length

  return (
    <section className="rounded-2xl border bg-card p-4" aria-labelledby="todays-plan">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="todays-plan" className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden /> Today&apos;s plan
        </h2>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums">
          {doneCount}/{items.length}
        </span>
      </div>
      <ul className="space-y-1">
        {items.map((it) => {
          const checked = !!day.habits?.[it.key]
          const Icon = it.icon
          return (
            <li key={it.key}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => onToggle(it.key)}
                className="flex min-h-12 w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/60"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2",
                    checked ? "border-success bg-success text-white" : "border-muted-foreground/40"
                  )}
                  aria-hidden
                >
                  {checked && <Check className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("flex items-center gap-1.5 text-sm font-medium", checked && "text-muted-foreground line-through")}>
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> {it.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{it.detail}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
