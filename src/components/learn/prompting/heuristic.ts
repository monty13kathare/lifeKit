/**
 * Offline "quick check" for practice prompts: a transparent keyword/structure
 * heuristic. It can't judge quality like a model can — it only checks whether
 * the common building blocks of a good prompt appear to be present.
 */

export type RubricKey = "role" | "context" | "task" | "format" | "constraints" | "example"

export interface RubricItem {
  key: RubricKey
  label: string
  hint: string
}

export const RUBRIC: RubricItem[] = [
  { key: "role", label: "Role", hint: "Who should the AI be? e.g. \"You are a travel planner…\"" },
  { key: "context", label: "Context", hint: "Background, audience, purpose — who it's for and why." },
  { key: "task", label: "Clear task", hint: "A strong verb: plan, list, explain, draft, compare…" },
  { key: "format", label: "Output format", hint: "Table, bullet list, steps, JSON, email…" },
  { key: "constraints", label: "Constraints", hint: "Numbers and limits: length, budget, count, tone, what to avoid…" },
  { key: "example", label: "Example", hint: "An example of the style or output you want (optional but powerful)." },
]

const ROLE = /\b(you are|act as|acting as|as an? (expert|experienced|professional|senior)|pretend (you are|to be)|your role)\b/i
const TASK =
  /\b(write|create|plan|explain|list|summari[sz]e|draft|compare|generate|give|make|suggest|design|outline|rewrite|analy[sz]e|help me|describe|recommend|translate|review|prepare|build|turn)\b/i
const FORMAT =
  /\b(table|bullets?|list|numbered|steps?|json|csv|markdown|headings?|paragraphs?|columns?|email|subject line|outline|checklist|format|template|day[- ]by[- ]day|timeline)\b/i
const AUDIENCE = /\b(for (a|an|my|the)?\s*\w+|audience|beginners?|students?|kids?|child|year[- ]old|customers?|manager|team|readers?|i am|i'm|my)\b/i
const CONSTRAINT_WORDS =
  /\b(under|max(imum)?|at most|no more than|at least|within|budget|limit|only|avoid|don't|do not|without|must|tone|formal|friendly|simple|words?|sentences?|minutes?|hours?|days?)\b/i
const NUMBER = /(\d|₹|\$|%)/
const EXAMPLE = /\b(e\.g\.|for example|for instance|example|such as|like this|sample)\b|"""|→|->|Input:|Output:/i

export interface HeuristicResult {
  score: number
  detected: Record<RubricKey, boolean>
  tips: string[]
}

export function quickCheck(prompt: string): HeuristicResult {
  const text = prompt.trim()
  const words = text ? text.split(/\s+/).length : 0
  const numbers = (text.match(/\d+/g) ?? []).length
  const detected: Record<RubricKey, boolean> = {
    role: ROLE.test(text),
    context: AUDIENCE.test(text) && words >= 15,
    task: TASK.test(text),
    format: FORMAT.test(text),
    constraints: CONSTRAINT_WORDS.test(text) && NUMBER.test(text),
    example: EXAMPLE.test(text),
  }

  let score = 0
  // Length: very short prompts rarely carry enough detail.
  score += words >= 60 ? 15 : words >= 30 ? 12 : words >= 15 ? 7 : words >= 6 ? 3 : 0
  if (detected.task) score += 15
  if (detected.context) score += 15
  if (detected.format) score += 15
  if (detected.constraints) score += 15
  if (detected.role) score += 10
  if (detected.example) score += 10
  // Structure: line breaks / numbered steps and several numbers suggest a well-specified prompt.
  if (/\n/.test(text) || /\b(1\.|step 1|first,)/i.test(text)) score += 3
  if (numbers >= 2) score += 2
  score = Math.min(100, score)

  const tips: string[] = []
  if (words < 15) tips.push("Add more detail — most strong prompts are at least 2–3 sentences.")
  for (const item of RUBRIC) if (!detected[item.key] && item.key !== "example") tips.push(`${item.label}: ${item.hint}`)
  if (!detected.example && tips.length < 3) tips.push(`Example: ${RUBRIC[5].hint}`)
  return { score, detected, tips: tips.slice(0, 4) }
}
