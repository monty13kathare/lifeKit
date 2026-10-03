import { z } from "zod"
import { createId } from "@/lib/storage/core"
import type { Decision } from "@/types"

export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 6
export const MAX_CRITERIA = 10

export const decisionSchema = z.object({
  question: z.string().trim().min(1, "Write the decision you're making").max(200, "Keep the question under 200 characters"),
  options: z
    .array(z.object({ id: z.string(), name: z.string().trim().min(1, "Name every option").max(120, "Keep option names under 120 characters") }))
    .min(MIN_OPTIONS, `Add at least ${MIN_OPTIONS} options`)
    .max(MAX_OPTIONS, `Up to ${MAX_OPTIONS} options`)
    .refine((opts) => new Set(opts.map((o) => o.name.trim().toLowerCase())).size === opts.length, "Option names must be different"),
  criteria: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1, "Name every criterion").max(60, "Keep criteria under 60 characters"),
        weight: z.number().int().min(1).max(5),
      })
    )
    .min(1, "Add at least one criterion")
    .max(MAX_CRITERIA, `Up to ${MAX_CRITERIA} criteria`),
  notes: z.string().max(2000, "Notes are limited to 2000 characters").optional(),
})

/** First validation message, or null if valid. */
export function validateDecision(d: Decision): string | null {
  const res = decisionSchema.safeParse(d)
  return res.success ? null : (res.error.issues[0]?.message ?? "Check the decision details")
}

export function blankDecision(): Decision {
  const now = new Date().toISOString()
  return {
    id: createId(),
    question: "",
    options: [
      { id: createId(), name: "" },
      { id: createId(), name: "" },
    ],
    criteria: [
      { id: createId(), name: "Cost", weight: 3 },
      { id: createId(), name: "Impact", weight: 4 },
    ],
    scores: {},
    createdAt: now,
    updatedAt: now,
  }
}

/** Has the user typed anything worth saving? */
export function hasContent(d: Decision): boolean {
  return !!d.question.trim() || d.options.some((o) => o.name.trim()) || Object.keys(d.scores).length > 0
}

export const optionLabel = (name: string, index: number) => name.trim() || `Option ${index + 1}`
export const criterionLabel = (name: string, index: number) => name.trim() || `Criterion ${index + 1}`

export const WEIGHT_LABEL: Record<number, string> = { 1: "Minor", 2: "Low", 3: "Medium", 4: "High", 5: "Critical" }

export function getScore(d: Decision, optionId: string, criterionId: string): number | undefined {
  const v = d.scores[optionId]?.[criterionId]
  return typeof v === "number" && v >= 1 && v <= 5 ? v : undefined
}

export interface OptionResult {
  id: string
  name: string
  /** 0–100, over the criteria that have been scored */
  percent: number
  scored: number
  total: number
  rank: number
}

/** score = Σ(weight × score) / Σ(weight × 5) × 100, over scored criteria. */
function percentFor(d: Decision, optionId: string, override?: { criterionId: string; score: number }): { percent: number; scored: number } {
  let num = 0
  let den = 0
  let scored = 0
  for (const c of d.criteria) {
    const s = override && override.criterionId === c.id ? override.score : getScore(d, optionId, c.id)
    if (s === undefined) continue
    num += c.weight * s
    den += c.weight * 5
    scored++
  }
  return { percent: den ? (num / den) * 100 : 0, scored }
}

export function computeResults(d: Decision): OptionResult[] {
  const rows = d.options.map((o, i) => {
    const { percent, scored } = percentFor(d, o.id)
    return { id: o.id, name: optionLabel(o.name, i), percent, scored, total: d.criteria.length, rank: 0 }
  })
  const sorted = [...rows].sort((a, b) => b.percent - a.percent)
  sorted.forEach((r, i) => (r.rank = i + 1))
  return sorted
}

export interface Sensitivity {
  message: string
}

/**
 * Which single score change would flip the top two? Looks at the criterion
 * where the leader beats the runner-up by the biggest weighted margin, then
 * the smallest bump to the runner-up's score there that overtakes the leader.
 */
export function sensitivity(d: Decision, results: OptionResult[]): Sensitivity | null {
  if (results.length < 2 || d.criteria.length === 0) return null
  const [leader, runner] = results
  if (!leader.scored || !runner.scored) return null

  // Candidate criteria ordered by weighted gap (leader − runner-up).
  const gaps = d.criteria
    .map((c, i) => {
      const sl = getScore(d, leader.id, c.id)
      const sr = getScore(d, runner.id, c.id)
      return { c, i, sl, sr, gap: sl !== undefined && sr !== undefined ? c.weight * (sl - sr) : -Infinity }
    })
    .sort((a, b) => b.gap - a.gap)

  const biggest = gaps[0]
  const tryFlip = (g: (typeof gaps)[number]) => {
    const from = g.sr ?? 0
    for (let s = from + 1; s <= 5; s++) {
      if (percentFor(d, runner.id, { criterionId: g.c.id, score: s }).percent > leader.percent) return s
    }
    return null
  }

  for (const g of gaps) {
    const to = tryFlip(g)
    if (to !== null) {
      const cname = criterionLabel(g.c.name, g.i)
      const lead = biggest && biggest.gap > 0 && biggest.c.id !== g.c.id ? ` ${leader.name} leads most on “${criterionLabel(biggest.c.name, biggest.i)}”.` : ""
      return {
        message: `Raising ${runner.name}'s “${cname}” score from ${g.sr ?? "unscored"} to ${to} would put it ahead of ${leader.name}.${lead}`,
      }
    }
  }
  if (biggest && biggest.gap > 0) {
    return {
      message: `${leader.name} has a clear lead — no single score change for ${runner.name} would overtake it. Its biggest edge is “${criterionLabel(biggest.c.name, biggest.i)}”.`,
    }
  }
  return null
}
