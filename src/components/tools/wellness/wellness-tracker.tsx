"use client"

import { useMemo, useState } from "react"
import { addDays, format, subDays } from "date-fns"
import {
  Annoyed,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Frown,
  Laugh,
  Meh,
  Minus,
  Moon,
  Plus,
  Settings2,
  Smile,
  type LucideIcon,
} from "lucide-react"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Segmented } from "@/components/tools/calculators/fields"
import { useWellness } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { fromDateString, toDateString, todayString } from "@/lib/dates"
import { emptyWellnessDay } from "@/lib/storage/wellness"
import { cn } from "@/lib/utils"
import type { WellnessDay, WellnessGoals } from "@/types"
import { GoalsSheet } from "./goals-sheet"
import { ProgressRing, WeeklyBars, type WeeklyPoint } from "./wellness-charts"

const DISCLAIMER =
  "LifeKit is not a medical device and does not provide medical advice or diagnosis. Consult a healthcare professional about health concerns."

const MOODS: { value: number; label: string; icon: LucideIcon }[] = [
  { value: 1, label: "Very low", icon: Frown },
  { value: 2, label: "Low", icon: Annoyed },
  { value: 3, label: "Okay", icon: Meh },
  { value: 4, label: "Good", icon: Smile },
  { value: 5, label: "Great", icon: Laugh },
]

type Metric = "waterGlasses" | "steps" | "exerciseMinutes" | "sleepHours"

const METRICS: Record<Metric, { label: string; unit: string; color: string; icon: LucideIcon }> = {
  waterGlasses: { label: "Water", unit: "glasses", color: "var(--chart-2)", icon: Droplet },
  steps: { label: "Steps", unit: "steps", color: "var(--chart-3)", icon: Footprints },
  exerciseMinutes: { label: "Exercise", unit: "min", color: "var(--chart-5)", icon: Dumbbell },
  sleepHours: { label: "Sleep", unit: "hours", color: "var(--chart-1)", icon: Moon },
}

const clampInt = (raw: string, max: number) => {
  const n = parseInt(raw.replace(/[^\d]/g, ""), 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0
}

const fmtCount = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 })

export function WellnessTracker() {
  const hydrated = useHydrated()
  const { days, goals, setGoals, upsertDay } = useWellness()
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

  if (!hydrated) return <TrackerSkeleton />

  return (
    <div className="space-y-5">
      <Notice tone="info">{DISCLAIMER}</Notice>

      {/* Date switcher */}
      <div className="flex items-center gap-2 rounded-2xl border bg-card p-2 shadow-soft">
        <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => shift(-1)}>
          <ChevronLeft aria-hidden />
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-semibold" aria-live="polite">
            {isToday ? "Today" : date === toDateString(subDays(new Date(), 1)) ? "Yesterday" : format(fromDateString(date), "EEEE")}
          </p>
          <label className="relative inline-flex cursor-pointer items-center text-xs text-muted-foreground hover:text-foreground">
            <span>{format(fromDateString(date), "d MMM yyyy")}</span>
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
        </div>
        <Button variant="ghost" size="icon" aria-label="Next day" onClick={() => shift(1)} disabled={isToday}>
          <ChevronRight aria-hidden />
        </Button>
        {!isToday ? (
          <Button variant="outline" size="sm" onClick={() => setDate(today)}>
            Today
          </Button>
        ) : null}
        <Button variant="outline" size="icon" aria-label="Edit goals" onClick={() => setGoalsOpen(true)}>
          <Settings2 aria-hidden />
        </Button>
      </div>

      {/* Daily progress rings */}
      <section aria-labelledby="progress-heading" className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <h2 id="progress-heading" className="mb-4 text-sm font-semibold">
          {isToday ? "Today's progress" : "Progress"}
        </h2>
        <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4">
          <ProgressRing label="Water" value={day.waterGlasses} goal={goals.waterGlasses} display={String(day.waterGlasses)} caption={`of ${goals.waterGlasses} glasses`} color={METRICS.waterGlasses.color} icon={<Droplet />} />
          <ProgressRing label="Steps" value={day.steps} goal={goals.steps} display={day.steps >= 10000 ? `${(day.steps / 1000).toFixed(1)}k` : fmtCount(day.steps)} caption={`of ${fmtCount(goals.steps)}`} color={METRICS.steps.color} icon={<Footprints />} />
          <ProgressRing label="Exercise" value={day.exerciseMinutes} goal={goals.exerciseMinutes} display={`${day.exerciseMinutes}`} caption={`of ${goals.exerciseMinutes} min`} color={METRICS.exerciseMinutes.color} icon={<Dumbbell />} />
          <ProgressRing label="Sleep" value={day.sleepHours} goal={goals.sleepHours} display={`${fmtCount(day.sleepHours)}h`} caption={`of ${goals.sleepHours} h`} color={METRICS.sleepHours.color} icon={<Moon />} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Water */}
        <Card title="Water" icon={Droplet}>
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="icon-lg"
              className="rounded-full"
              aria-label="Remove a glass"
              disabled={day.waterGlasses <= 0}
              onClick={() => patch({ waterGlasses: Math.max(0, day.waterGlasses - 1) })}
            >
              <Minus aria-hidden />
            </Button>
            <div className="text-center" aria-live="polite">
              <p className="text-3xl font-semibold tabular-nums">{day.waterGlasses}</p>
              <p className="text-xs text-muted-foreground">of {goals.waterGlasses} glasses</p>
            </div>
            <Button size="icon-lg" className="rounded-full" aria-label="Add a glass" onClick={() => patch({ waterGlasses: Math.min(40, day.waterGlasses + 1) })}>
              <Plus aria-hidden />
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5" aria-hidden>
            {Array.from({ length: Math.max(goals.waterGlasses, day.waterGlasses) }, (_, i) => (
              <Droplet
                key={i}
                className={cn("size-5", i < day.waterGlasses ? "fill-current text-chart-2" : "text-muted-foreground/40")}
              />
            ))}
          </div>
        </Card>

        {/* Steps */}
        <Card title="Steps & activity" icon={Footprints}>
          <Label htmlFor="steps-input" className="sr-only">
            Steps
          </Label>
          <div className="flex gap-2">
            <Input
              id="steps-input"
              inputMode="numeric"
              value={day.steps ? String(day.steps) : ""}
              placeholder="0"
              onChange={(e) => patch({ steps: clampInt(e.target.value, 200_000) })}
              className="h-11 text-base tabular-nums"
            />
            <Button variant="outline" className="h-11" onClick={() => patch({ steps: Math.min(200_000, day.steps + 1000) })}>
              +1000
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Enter steps from your phone or watch, or any manual activity count.</p>
        </Card>

        {/* Exercise */}
        <Card title="Exercise" icon={Dumbbell}>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="exercise-min">Minutes</Label>
              <Input
                id="exercise-min"
                inputMode="numeric"
                value={day.exerciseMinutes ? String(day.exerciseMinutes) : ""}
                placeholder="0"
                onChange={(e) => patch({ exerciseMinutes: clampInt(e.target.value, 1440) })}
                className="h-11 text-base tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exercise-note">What did you do?</Label>
              <Input
                id="exercise-note"
                value={day.exerciseNote ?? ""}
                maxLength={120}
                placeholder="e.g. Yoga, brisk walk"
                onChange={(e) => patch({ exerciseNote: e.target.value })}
                className="h-11"
              />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[10, 15, 30].map((m) => (
              <Button key={m} variant="outline" size="sm" onClick={() => patch({ exerciseMinutes: Math.min(1440, day.exerciseMinutes + m) })}>
                +{m} min
              </Button>
            ))}
          </div>
        </Card>

        {/* Sleep */}
        <Card title="Sleep" icon={Moon}>
          <div className="flex items-baseline justify-between">
            <Label id="sleep-label">Hours slept</Label>
            <span className="text-2xl font-semibold tabular-nums" aria-live="polite">
              {fmtCount(day.sleepHours)} h
            </span>
          </div>
          <Slider
            className="mt-3"
            value={day.sleepHours}
            min={0}
            max={14}
            step={0.5}
            aria-labelledby="sleep-label"
            onValueChange={(v) => patch({ sleepHours: v as number })}
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>0 h</span>
            <span>14 h</span>
          </div>
        </Card>
      </div>

      {/* Mood */}
      <Card title="Mood" icon={Smile}>
        <div role="radiogroup" aria-label="Mood" className="grid grid-cols-5 gap-2">
          {MOODS.map((m) => {
            const selected = day.mood === m.value
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => patch({ mood: selected ? undefined : m.value })}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs font-medium transition-colors",
                  selected ? "border-primary bg-primary/10 text-primary" : "bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <m.icon className="size-6" aria-hidden />
                {m.label}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Habits */}
      <HabitsCard day={day} goals={goals} byId={byId} date={date} onToggle={(id) => patch({ habits: { ...day.habits, [id]: !day.habits[id] } })} onManage={() => setGoalsOpen(true)} />

      {/* Notes */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Meal notes">
          <Label htmlFor="meals" className="sr-only">
            Meal notes
          </Label>
          <Textarea id="meals" rows={4} maxLength={2000} value={day.meals} placeholder="Breakfast, lunch, dinner, snacks…" onChange={(e) => patch({ meals: e.target.value })} />
        </Card>
        <Card title="Journal">
          <Label htmlFor="journal" className="sr-only">
            Wellness journal
          </Label>
          <Textarea id="journal" rows={4} maxLength={5000} value={day.journal} placeholder="How did today feel? Anything you're grateful for?" onChange={(e) => patch({ journal: e.target.value })} />
        </Card>
      </div>
      <p className="text-center text-xs text-muted-foreground">Changes save automatically in this browser.</p>

      <WeeklyProgress byId={byId} goals={goals} endDate={date} />

      <GoalsSheet open={goalsOpen} onOpenChange={setGoalsOpen} goals={goals} onSave={setGoals} />
    </div>
  )
}

function Card({ title, icon: Icon, children }: { title: string; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {Icon ? <Icon className="size-4 text-muted-foreground" aria-hidden /> : null}
        {title}
      </h2>
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ Habits */

/** Consecutive done days ending at `date` (or the day before, if `date` isn't done yet). */
function streakFor(habitId: string, date: string, byId: Map<string, WellnessDay>): number {
  let cursor = fromDateString(date)
  if (!byId.get(date)?.habits[habitId]) cursor = subDays(cursor, 1)
  let streak = 0
  for (let i = 0; i < 3650; i++) {
    const d = byId.get(toDateString(cursor))
    if (!d?.habits[habitId]) break
    streak++
    cursor = subDays(cursor, 1)
  }
  return streak
}

function HabitsCard({
  day,
  goals,
  byId,
  date,
  onToggle,
  onManage,
}: {
  day: WellnessDay
  goals: WellnessGoals
  byId: Map<string, WellnessDay>
  date: string
  onToggle: (id: string) => void
  onManage: () => void
}) {
  const last7 = Array.from({ length: 7 }, (_, i) => toDateString(subDays(fromDateString(date), 6 - i)))
  const done = goals.habits.filter((h) => day.habits[h.id]).length
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Check className="size-4 text-muted-foreground" aria-hidden /> Habits
          {goals.habits.length ? (
            <span className="font-normal text-muted-foreground">
              · {done}/{goals.habits.length} done
            </span>
          ) : null}
        </h2>
        <Button variant="ghost" size="sm" onClick={onManage}>
          Manage
        </Button>
      </div>
      {goals.habits.length ? (
        <ul className="space-y-2">
          {goals.habits.map((h) => {
            const checked = !!day.habits[h.id]
            const streak = streakFor(h.id, date, byId)
            return (
              <li key={h.id} className="flex items-center gap-3 rounded-xl border bg-surface p-2 pr-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => onToggle(h.id)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
                    )}
                    aria-hidden
                  >
                    {checked ? <Check className="size-4" /> : null}
                  </span>
                  <span className={cn("min-w-0 truncate text-sm font-medium", checked && "text-muted-foreground line-through")}>{h.name}</span>
                </button>
                <div className="hidden items-center gap-1 min-[420px]:flex" aria-label={`Last 7 days for ${h.name}`} role="img">
                  {last7.map((d) => (
                    <span
                      key={d}
                      title={`${format(fromDateString(d), "EEE d MMM")}: ${byId.get(d)?.habits[h.id] ? "done" : "not done"}`}
                      className={cn("size-2.5 rounded-full", byId.get(d)?.habits[h.id] ? "bg-primary" : "bg-muted")}
                    />
                  ))}
                </div>
                <span
                  className={cn("flex w-12 shrink-0 items-center justify-end gap-0.5 text-xs font-medium tabular-nums", streak ? "text-foreground" : "text-muted-foreground")}
                  aria-label={`${streak} day streak`}
                >
                  <Flame className={cn("size-3.5", streak ? "text-chart-4" : "")} aria-hidden />
                  {streak}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          No habits yet.{" "}
          <button type="button" onClick={onManage} className="font-medium text-primary underline-offset-4 hover:underline">
            Add a habit
          </button>
        </div>
      )}
    </section>
  )
}

/* ---------------------------------------------------------- Weekly charts */

function WeeklyProgress({ byId, goals, endDate }: { byId: Map<string, WellnessDay>; goals: WellnessGoals; endDate: string }) {
  const [metric, setMetric] = useState<Metric>("waterGlasses")
  const meta = METRICS[metric]
  const end = fromDateString(endDate)
  const points: WeeklyPoint[] = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(end, 6 - i)
    const id = toDateString(d)
    return {
      label: format(d, "EEEEE"),
      fullLabel: format(d, "EEEE d MMM"),
      value: byId.get(id)?.[metric] ?? 0,
      isSelected: id === endDate,
    }
  })

  return (
    <section aria-labelledby="weekly-heading" className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="weekly-heading" className="text-sm font-semibold">
          Last 7 days · to {format(end, "d MMM")}
        </h2>
        <Segmented
          label="Metric"
          size="sm"
          value={metric}
          onChange={setMetric}
          options={(Object.keys(METRICS) as Metric[]).map((m) => ({ value: m, label: METRICS[m].label }))}
          className="w-full sm:w-auto"
        />
      </div>
      <WeeklyBars title={meta.label} points={points} goal={goals[metric]} color={meta.color} unit={meta.unit} format={(n) => (metric === "steps" && n >= 1000 ? `${(n / 1000).toFixed(1)}k` : fmtCount(n))} />
    </section>
  )
}

function TrackerSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading wellness data">
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-14 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  )
}
