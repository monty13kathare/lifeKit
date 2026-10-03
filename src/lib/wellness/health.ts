/**
 * Standard, well-known wellness estimates computed locally (no AI, no network).
 * These are population formulas — estimates for general guidance, not medical advice.
 */
import type { ActivityLevel, HealthGoal, HealthProfile } from "@/types"

export const ACTIVITY_META: Record<ActivityLevel, { label: string; description: string; factor: number }> = {
  sedentary: { label: "Sedentary", description: "Mostly sitting, little exercise", factor: 1.2 },
  light: { label: "Lightly active", description: "Light exercise 1–3 days/week", factor: 1.375 },
  moderate: { label: "Moderately active", description: "Exercise 3–5 days/week", factor: 1.55 },
  active: { label: "Very active", description: "Hard exercise 6–7 days/week", factor: 1.725 },
  "very-active": { label: "Athlete / physical job", description: "Intense training or manual work", factor: 1.9 },
}

export const GOAL_META: Record<HealthGoal, { label: string }> = {
  "lose-weight": { label: "Lose weight" },
  maintain: { label: "Maintain weight" },
  "gain-weight": { label: "Gain weight / muscle" },
  "build-fitness": { label: "Build fitness" },
  "more-energy": { label: "More energy" },
  "better-sleep": { label: "Better sleep" },
}

export type BmiCategory = "underweight" | "healthy" | "overweight" | "obese"

export const BMI_META: Record<BmiCategory, { label: string; tone: "warning" | "success" | "danger" }> = {
  underweight: { label: "Underweight", tone: "warning" },
  healthy: { label: "Healthy range", tone: "success" },
  overweight: { label: "Overweight", tone: "warning" },
  obese: { label: "Obese range", tone: "danger" },
}

export function bmi(heightCm?: number, weightKg?: number): number | null {
  if (!heightCm || !weightKg || heightCm < 50 || weightKg < 10) return null
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

/** WHO adult categories (18+). */
export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return "underweight"
  if (value < 25) return "healthy"
  if (value < 30) return "overweight"
  return "obese"
}

/**
 * WHO suggests lower action points for many Asian populations (overweight risk
 * from 23, high risk from 27.5). Returned as a note to show alongside.
 */
export function asianBmiNote(value: number): string | null {
  if (value >= 23 && value < 25) return "For many South Asian people, health risks start rising from a BMI of 23."
  if (value >= 27.5 && value < 30) return "For many South Asian people, a BMI of 27.5+ is considered high risk."
  return null
}

/** Weight range (kg) for a BMI of 18.5–24.9 at this height. */
export function healthyWeightRange(heightCm?: number): [number, number] | null {
  if (!heightCm || heightCm < 50) return null
  const m2 = (heightCm / 100) ** 2
  return [Math.round(18.5 * m2 * 10) / 10, Math.round(24.9 * m2 * 10) / 10]
}

/** Basal metabolic rate (kcal/day), Mifflin–St Jeor. Needs age, height, weight. */
export function bmr(p: HealthProfile): number | null {
  if (!p.age || !p.heightCm || !p.weightKg) return null
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  const adj = p.sex === "male" ? 5 : p.sex === "female" ? -161 : -78
  return Math.round(base + adj)
}

/** Total daily energy expenditure (maintenance calories). */
export function tdee(p: HealthProfile): number | null {
  const b = bmr(p)
  return b ? Math.round(b * ACTIVITY_META[p.activity].factor) : null
}

/** A sensible daily calorie target for the goal (never below a safe floor). */
export function calorieTarget(p: HealthProfile): number | null {
  const t = tdee(p)
  if (!t) return null
  const floor = p.sex === "male" ? 1500 : 1200
  if (p.goal === "lose-weight") return Math.max(floor, Math.round((t - 500) / 50) * 50)
  if (p.goal === "gain-weight") return Math.round((t + 300) / 50) * 50
  return Math.round(t / 50) * 50
}

/** Daily protein range in grams. */
export function proteinRange(p: HealthProfile): [number, number] | null {
  if (!p.weightKg) return null
  const [lo, hi] = p.goal === "gain-weight" || p.goal === "build-fitness" ? [1.2, 1.6] : p.goal === "lose-weight" ? [1.0, 1.4] : [0.8, 1.0]
  return [Math.round(lo * p.weightKg), Math.round(hi * p.weightKg)]
}

/** Water target in 250 ml glasses (~35 ml per kg, adjusted for activity), clamped 6–16. */
export function waterGlasses(p: HealthProfile): number | null {
  if (!p.weightKg) return null
  const extra = p.activity === "active" || p.activity === "very-active" ? 500 : p.activity === "moderate" ? 250 : 0
  return Math.min(16, Math.max(6, Math.round((p.weightKg * 35 + extra) / 250)))
}

/** Recommended sleep hours by age (National Sleep Foundation ranges). */
export function sleepRange(age?: number): [number, number] {
  if (!age) return [7, 9]
  if (age < 13) return [9, 12]
  if (age < 18) return [8, 10]
  if (age < 65) return [7, 9]
  return [7, 8]
}

export function suggestedSteps(p: HealthProfile): number {
  if (p.goal === "lose-weight" || p.goal === "build-fitness") return 10000
  if (p.activity === "sedentary") return 7000
  return 8000
}

/** Hours between bed and wake time (handles crossing midnight). */
export function plannedSleepHours(bed?: string, wake?: string): number | null {
  if (!bed || !wake) return null
  const [bh, bm] = bed.split(":").map(Number)
  const [wh, wm] = wake.split(":").map(Number)
  let mins = wh * 60 + wm - (bh * 60 + bm)
  if (mins <= 0) mins += 24 * 60
  return Math.round((mins / 60) * 10) / 10
}

/** Profile fields required for the full picture (BMR needs age; BMI needs height+weight). */
export function profileCompleteness(p: HealthProfile): { done: number; total: number; missing: string[] } {
  const checks: [boolean, string][] = [
    [!!p.age, "age"],
    [!!p.heightCm, "height"],
    [!!p.weightKg, "weight"],
    [!!p.sex, "sex"],
    [!!p.wakeTime && !!p.bedTime, "sleep schedule"],
    [!!p.diet, "diet"],
  ]
  return { done: checks.filter(([ok]) => ok).length, total: checks.length, missing: checks.filter(([ok]) => !ok).map(([, n]) => n) }
}
