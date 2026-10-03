"use client"

import { useState } from "react"
import { Beef, Droplet, Flame, Footprints, Gauge, Moon, Target, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  asianBmiNote,
  bmi,
  bmiCategory,
  BMI_META,
  calorieTarget,
  GOAL_META,
  healthyWeightRange,
  plannedSleepHours,
  proteinRange,
  sleepRange,
  suggestedSteps,
  tdee,
  waterGlasses,
} from "@/lib/wellness/health"
import { cn } from "@/lib/utils"
import type { HealthProfile, WellnessGoals } from "@/types"
import { GoalChangesSheet } from "./goal-changes-sheet"
import { fmtWeight, goalChanges, type WeightUnit } from "./health-utils"

const TONE_CLASS = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
} as const

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 })

interface HealthNumbersProps {
  profile: HealthProfile
  goals: WellnessGoals
  setGoals: (goals: WellnessGoals) => void
  unit: WeightUnit
}

export function HealthNumbers({ profile: p, goals, setGoals, unit }: HealthNumbersProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const b = bmi(p.heightCm, p.weightKg)
  const adult = !p.age || p.age >= 18
  const cat = b !== null && adult ? bmiCategory(b) : null
  const range = healthyWeightRange(p.heightCm)
  const note = b !== null && adult ? asianBmiNote(b) : null
  const maintenance = tdee(p)
  const target = calorieTarget(p)
  const protein = proteinRange(p)
  const water = waterGlasses(p)
  const [sleepLo, sleepHi] = sleepRange(p.age)
  const planned = plannedSleepHours(p.bedTime, p.wakeTime)
  const steps = suggestedSteps(p)

  const missing = (fields: [boolean, string][]) => {
    const m = fields.filter(([ok]) => !ok).map(([, n]) => n)
    return m.length ? `Add your ${m.join(" and ")} in the profile to see this.` : null
  }

  const sleepGoal = Math.min(sleepHi, sleepLo + 1)
  const proposed = { waterGlasses: water ?? undefined, steps, sleepHours: sleepGoal }
  const changes = goalChanges(goals, proposed)

  return (
    <section aria-labelledby="numbers-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="numbers-heading" className="text-sm font-semibold">
            Your numbers
          </h2>
          <p className="text-xs text-muted-foreground">Estimates from standard formulas, worked out in your browser. A starting point, not a prescription.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberCard
          icon={Gauge}
          title="BMI"
          missing={missing([
            [!!p.heightCm, "height"],
            [!!p.weightKg, "weight"],
          ])}
          value={b !== null ? fmt(b) : null}
          badge={cat ? <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", TONE_CLASS[BMI_META[cat].tone])}>{BMI_META[cat].label}</span> : null}
          explain="Body mass index compares weight with height. It's a rough screening number — it can't tell muscle from fat."
        >
          {!adult ? (
            <p className="text-xs text-muted-foreground">BMI categories here are for adults (18+). For younger people, doctors use age- and sex-specific growth charts instead.</p>
          ) : range ? (
            <p className="text-xs text-muted-foreground">
              A BMI of 18.5–24.9 at your height is about{" "}
              <span className="font-medium text-foreground">
                {fmtWeight(range[0], unit)}–{fmtWeight(range[1], unit)}
              </span>
              .
            </p>
          ) : null}
          {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
        </NumberCard>

        <NumberCard
          icon={Flame}
          title="Daily calories"
          missing={missing([
            [!!p.age, "age"],
            [!!p.heightCm, "height"],
            [!!p.weightKg, "weight"],
          ])}
          value={maintenance ? `${maintenance.toLocaleString("en-US")} kcal` : null}
          explain="Estimated energy you use in a day to stay at your current weight, based on your activity level."
        >
          {target && target !== maintenance ? (
            <p className="text-xs text-muted-foreground">
              For &ldquo;{GOAL_META[p.goal].label.toLowerCase()}&rdquo;, around{" "}
              <span className="font-medium text-foreground">{target.toLocaleString("en-US")} kcal/day</span> is a gentle estimate.
            </p>
          ) : null}
          {!p.sex ? <p className="text-xs text-muted-foreground">Adding sex makes this estimate a little more accurate.</p> : null}
        </NumberCard>

        <NumberCard
          icon={Beef}
          title="Protein"
          missing={missing([[!!p.weightKg, "weight"]])}
          value={protein ? `${protein[0]}–${protein[1]} g` : null}
          explain="A daily protein range for your weight and goal. Dal, paneer, curd, eggs, soy, chicken and fish all count."
        />

        <NumberCard
          icon={Droplet}
          title="Water"
          missing={missing([[!!p.weightKg, "weight"]])}
          value={water ? `${water} glasses` : null}
          explain="Roughly 35 ml per kg plus a bit more if you're active (one glass ≈ 250 ml). Drink more in hot weather."
        />

        <NumberCard
          icon={Moon}
          title="Sleep"
          value={`${sleepLo}–${sleepHi} h`}
          explain={`The usual recommended range${p.age ? " for your age" : " for adults"}.`}
        >
          <p className="text-xs text-muted-foreground">
            {planned === null ? (
              "Add wake and bed times to compare with your schedule."
            ) : (
              <>
                Your schedule allows <span className="font-medium text-foreground">{planned} h</span>
                {planned < sleepLo ? " — a little short of the range. An earlier bedtime could help." : planned > sleepHi ? " — above the range, which is fine if you wake refreshed." : " — right in the range."}
              </>
            )}
          </p>
        </NumberCard>

        <NumberCard
          icon={Footprints}
          title="Steps"
          value={`${steps.toLocaleString("en-US")} / day`}
          explain="A friendly daily target for your goal and activity level. Any movement counts — build up gradually."
        />
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <Target className="mr-1.5 inline size-4 text-muted-foreground" aria-hidden />
          Use the water, steps and sleep estimates as your daily goals? <span className="text-muted-foreground">Exercise stays as it is.</span>
        </p>
        <Button
          variant="outline"
          className="h-11 shrink-0"
          onClick={() => (changes.length ? setConfirmOpen(true) : toast("Your goals already match these numbers"))}
        >
          Use these as my daily goals
        </Button>
      </div>

      <GoalChangesSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Update your daily goals?"
        description="These come from your health profile. You can change them any time."
        changes={changes}
        goals={goals}
        setGoals={setGoals}
        note={water === null ? "Water stays as it is until you add your weight. Exercise stays as it is." : "Exercise stays as it is."}
      />
    </section>
  )
}

function NumberCard({
  icon: Icon,
  title,
  value,
  missing,
  badge,
  explain,
  children,
}: {
  icon: LucideIcon
  title: string
  value: string | null
  missing?: string | null
  badge?: React.ReactNode
  explain: string
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5 rounded-2xl border bg-card p-4 shadow-soft">
      <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-4" aria-hidden /> {title} <span className="font-normal">· estimate</span>
      </h3>
      {value !== null && !missing ? (
        <>
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">{value}</span>
            {badge}
          </p>
          <p className="text-xs text-muted-foreground">{explain}</p>
          {children}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{missing ?? "Not enough information yet."}</p>
      )}
    </div>
  )
}
