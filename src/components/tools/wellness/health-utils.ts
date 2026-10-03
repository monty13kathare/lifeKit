import { format, subDays } from "date-fns"
import { fromDateString, toDateString } from "@/lib/dates"
import {
  bmi,
  bmiCategory,
  calorieTarget,
  proteinRange,
  sleepRange,
  suggestedSteps,
  tdee,
  waterGlasses,
} from "@/lib/wellness/health"
import type { DietType, HealthInsight, HealthProfile, WeightEntry, WellnessDay, WellnessGoals, WorkType } from "@/types"

export const DISCLAIMER =
  "LifeKit is not a medical device and does not provide medical advice or diagnosis. Consult a healthcare professional about health concerns."

export type HeightUnit = "cm" | "ft"
export type WeightUnit = "kg" | "lb"

export const KG_PER_LB = 0.45359237
export const CM_PER_IN = 2.54

export const MAX_INSIGHTS = 10

export const DIET_LABELS: Record<DietType, string> = {
  vegetarian: "Vegetarian",
  "non-vegetarian": "Non-vegetarian",
  eggetarian: "Eggetarian",
  vegan: "Vegan",
  jain: "Jain",
}

export const WORK_LABELS: Record<WorkType, string> = {
  desk: "Desk / office job",
  standing: "On my feet most of the day",
  physical: "Physical / manual work",
  student: "Student",
  home: "Home / caregiving",
  shift: "Shift or night work",
}

/* ------------------------------------------------------------------ Units */

const round1 = (n: number) => Math.round(n * 10) / 10

export const kgToLb = (kg: number) => round1(kg / KG_PER_LB)
export const lbToKg = (lb: number) => round1(lb * KG_PER_LB)

export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalIn = cm / CM_PER_IN
  let ft = Math.floor(totalIn / 12)
  let inches = Math.round(totalIn - ft * 12)
  if (inches === 12) {
    ft += 1
    inches = 0
  }
  return { ft, inches }
}

export const ftInToCm = (ft: number, inches: number) => round1((ft * 12 + inches) * CM_PER_IN)

export function fmtWeight(kg: number, unit: WeightUnit): string {
  return unit === "lb" ? `${kgToLb(kg)} lb` : `${round1(kg)} kg`
}

export function fmtHeight(cm: number, unit: HeightUnit): string {
  if (unit === "cm") return `${Math.round(cm)} cm`
  const { ft, inches } = cmToFtIn(cm)
  return `${ft} ft ${inches} in`
}

/** Signed number with a real minus sign, e.g. "−1.2" / "+0.8". */
export function signed(n: number, digits = 1): string {
  const r = Number(n.toFixed(digits))
  if (r === 0) return "±0"
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toLocaleString("en-US", { maximumFractionDigits: digits })}`
}

/* ------------------------------------------------------------- Weight log */

/** Append today's weight (or replace today's entry) when it differs from the last entry. */
export function withWeightLogged(log: WeightEntry[], kg: number, today: string): WeightEntry[] {
  const sorted = [...log].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted[sorted.length - 1]
  if (last && Math.abs(last.kg - kg) < 0.05) return sorted
  return [...sorted.filter((e) => e.date !== today), { date: today, kg: round1(kg) }].sort((a, b) => a.date.localeCompare(b.date))
}

export const sortedLog = (log: WeightEntry[]) => [...log].sort((a, b) => a.date.localeCompare(b.date))

/* ---------------------------------------------------------- Daily summary */

export function dayHasData(d: WellnessDay | undefined): d is WellnessDay {
  if (!d) return false
  return !!(
    d.waterGlasses ||
    d.steps ||
    d.exerciseMinutes ||
    d.sleepHours ||
    d.mood ||
    d.meals?.trim() ||
    d.exerciseNote?.trim() ||
    Object.values(d.habits ?? {}).some(Boolean)
  )
}

/** Days with any data in the 7 days ending today, oldest first. */
export function lastSevenDays(days: WellnessDay[], today: string): WellnessDay[] {
  const byId = new Map(days.map((d) => [d.id, d]))
  const end = fromDateString(today)
  const out: WellnessDay[] = []
  for (let i = 6; i >= 0; i--) {
    const d = byId.get(toDateString(subDays(end, i)))
    if (dayHasData(d)) out.push(d)
  }
  return out
}

function avg(values: number[]): number | undefined {
  const v = values.filter((n) => n > 0)
  return v.length ? round1(v.reduce((s, n) => s + n, 0) / v.length) : undefined
}

export function snapshotFor(profile: HealthProfile, week: WellnessDay[]): HealthInsight["snapshot"] {
  const b = bmi(profile.heightCm, profile.weightKg)
  return {
    weightKg: profile.weightKg,
    bmi: b ?? undefined,
    avgSleep: avg(week.map((d) => d.sleepHours)),
    avgSteps: (() => {
      const a = avg(week.map((d) => d.steps))
      return a === undefined ? undefined : Math.round(a)
    })(),
    avgWater: avg(week.map((d) => d.waterGlasses)),
  }
}

/* ------------------------------------------------------------- AI input */

/** Build the `health-insights` input. The journal is never included. */
export function buildHealthInput(
  profile: HealthProfile,
  goals: WellnessGoals,
  week: WellnessDay[],
  mealLimit = 300
) {
  const b = bmi(profile.heightCm, profile.weightKg)
  const protein = proteinRange(profile)
  return {
    profile: {
      age: profile.age,
      sex: profile.sex,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      bmi: b ?? undefined,
      bmiCategory: b && (profile.age ?? 18) >= 18 ? bmiCategory(b) : undefined,
      activity: profile.activity,
      goal: profile.goal,
      targetWeightKg: profile.goal === "lose-weight" || profile.goal === "gain-weight" ? profile.targetWeightKg : undefined,
      diet: profile.diet,
      work: profile.work,
      wakeTime: profile.wakeTime,
      bedTime: profile.bedTime,
      notes: profile.notes?.trim().slice(0, 500) || undefined,
    },
    estimates: {
      tdee: tdee(profile) ?? undefined,
      calorieTarget: calorieTarget(profile) ?? undefined,
      proteinGrams: protein ? `${protein[0]}-${protein[1]}` : undefined,
      waterGlasses: waterGlasses(profile) ?? undefined,
      sleepRange: sleepRange(profile.age).join("-") + " h",
      steps: suggestedSteps(profile),
    },
    goals: {
      waterGlasses: goals.waterGlasses,
      steps: goals.steps,
      exerciseMinutes: goals.exerciseMinutes,
      sleepHours: goals.sleepHours,
    },
    last7Days: week.map((d) => ({
      date: d.id,
      water: d.waterGlasses,
      steps: d.steps,
      exerciseMinutes: d.exerciseMinutes,
      exerciseNote: d.exerciseNote?.trim() || undefined,
      sleepHours: d.sleepHours,
      mood: d.mood,
      habits: `${goals.habits.filter((h) => d.habits?.[h.id]).length}/${goals.habits.length}`,
      meals: mealLimit > 0 ? d.meals?.trim().slice(0, mealLimit) || undefined : undefined,
    })),
    weightTrend: sortedLog(profile.weightLog).slice(-6),
  }
}

/** Serialise the input, trimming meal notes if needed to stay under `limit` characters. */
export function serializeHealthInput(profile: HealthProfile, goals: WellnessGoals, week: WellnessDay[], limit: number): string {
  for (const mealLimit of [300, 120, 0]) {
    const json = JSON.stringify(buildHealthInput(profile, goals, week, mealLimit))
    if (json.length <= limit) return json
  }
  return JSON.stringify(buildHealthInput(profile, goals, week, 0))
}

/* ------------------------------------------------------------ Goal diffs */

export type GoalKey = "waterGlasses" | "steps" | "exerciseMinutes" | "sleepHours"

export const GOAL_LABELS: Record<GoalKey, { label: string; unit: string }> = {
  waterGlasses: { label: "Water", unit: "glasses" },
  steps: { label: "Steps", unit: "steps" },
  exerciseMinutes: { label: "Exercise", unit: "min" },
  sleepHours: { label: "Sleep", unit: "hours" },
}

export interface GoalChange {
  key: GoalKey
  from: number
  to: number
}

export function goalChanges(goals: WellnessGoals, next: Partial<Record<GoalKey, number>>): GoalChange[] {
  return (Object.keys(GOAL_LABELS) as GoalKey[])
    .filter((k) => typeof next[k] === "number" && next[k] !== goals[k])
    .map((k) => ({ key: k, from: goals[k], to: next[k] as number }))
}

export const fmtGoal = (key: GoalKey, n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })} ${GOAL_LABELS[key].unit}`

/* -------------------------------------------------------- Insight helpers */

export const newestFirst = (list: HealthInsight[]) => [...list].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))

export function fmtInsightDate(iso: string): string {
  try {
    return format(new Date(iso), "d MMM yyyy, h:mm a")
  } catch {
    return iso
  }
}

/** "weight −1.2 kg, sleep +0.8 h avg" from two snapshots; null when nothing comparable. */
export function compareSnapshots(now: HealthInsight["snapshot"], prev: HealthInsight["snapshot"], unit: WeightUnit): string | null {
  const parts: string[] = []
  if (now.weightKg !== undefined && prev.weightKg !== undefined) {
    const d = now.weightKg - prev.weightKg
    parts.push(`weight ${signed(unit === "lb" ? d / KG_PER_LB : d)} ${unit}`)
  }
  if (now.avgSleep !== undefined && prev.avgSleep !== undefined) parts.push(`sleep ${signed(now.avgSleep - prev.avgSleep)} h avg`)
  if (now.avgSteps !== undefined && prev.avgSteps !== undefined) parts.push(`steps ${signed(now.avgSteps - prev.avgSteps, 0)} avg`)
  if (now.avgWater !== undefined && prev.avgWater !== undefined) parts.push(`water ${signed(now.avgWater - prev.avgWater)} glasses avg`)
  return parts.length ? parts.join(", ") : null
}

export function insightAsText(insight: HealthInsight): string {
  const d = insight.data
  const lines: string[] = [`LifeKit health check — ${fmtInsightDate(insight.generatedAt)}`, `Wellness consistency: ${d.score}/100`, "", d.summary]
  const list = (title: string, items: string[]) => {
    if (!items.length) return
    lines.push("", `${title}:`, ...items.map((i) => `• ${i}`))
  }
  list("What's going well", d.highlights)
  if (d.improvements.length) {
    lines.push("", "Areas to work on:")
    for (const i of d.improvements) lines.push(`• ${i.area}: ${i.observation} → ${i.recommendation}`)
  }
  const sg = (Object.keys(GOAL_LABELS) as GoalKey[]).filter((k) => typeof d.suggestedGoals[k] === "number")
  if (sg.length) {
    lines.push("", "Suggested daily goals:", ...sg.map((k) => `• ${GOAL_LABELS[k].label}: ${fmtGoal(k, d.suggestedGoals[k] as number)}`))
  }
  list("Meal ideas", d.mealIdeas)
  list("Exercise ideas", d.exerciseIdeas)
  list("Sleep tips", d.sleepTips)
  list("Worth discussing with a doctor", d.seeDoctor)
  lines.push("", "AI-generated general wellness guidance, not medical advice.")
  return lines.join("\n")
}
