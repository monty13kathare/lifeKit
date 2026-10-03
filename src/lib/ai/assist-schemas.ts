import { z } from "zod"

/**
 * Structured AI jobs for the My Life tools. Shared by the /api/ai/assist route
 * (validation + JSON schema for Gemini) and the client (types).
 */

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const optDate = z.union([date, z.literal("")]).optional()
const optTime = z.union([time, z.literal("")]).optional()
const color = z.enum(["indigo", "sky", "emerald", "amber", "rose", "violet", "slate"])

export const aiTaskSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: optDate,
  dueTime: optTime,
  category: z.string().max(40).optional(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]),
  subtasks: z.array(z.string().min(1).max(200)).max(12).optional(),
})

export const aiEventSchema = z.object({
  title: z.string().min(1).max(200),
  date,
  startTime: optTime,
  endTime: optTime,
  allDay: z.boolean(),
  location: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly", "yearly"]),
  /** -1 = no alert */
  alertMinutes: z.number().int().min(-1).max(1440).optional(),
})

export const aiReminderSchema = z.object({
  title: z.string().min(1).max(200),
  date,
  time,
  repeat: z.enum(["none", "daily", "weekly", "monthly"]),
  notes: z.string().max(2000).optional(),
})

export const aiNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(10000),
})

export const aiRoutineItemSchema = z.object({
  title: z.string().min(1).max(80),
  time,
  durationMinutes: z.number().int().min(5).max(720),
  repeatDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  color,
})

export const ASSIST_OUTPUT = {
  "parse-task": aiTaskSchema,
  "parse-event": aiEventSchema,
  "parse-reminder": aiReminderSchema,
  capture: z.object({
    kind: z.enum(["task", "event", "reminder", "note"]),
    task: aiTaskSchema.optional(),
    event: aiEventSchema.optional(),
    reminder: aiReminderSchema.optional(),
    note: aiNoteSchema.optional(),
  }),
  subtasks: z.object({ subtasks: z.array(z.string().min(1).max(200)).min(1).max(12) }),
  routine: z.object({ items: z.array(aiRoutineItemSchema).min(1).max(20) }),
  "extract-tasks": z.object({ tasks: z.array(aiTaskSchema).max(20) }),
  "plan-day": z.object({
    headline: z.string().max(300),
    priorities: z.array(z.string().max(200)).max(5),
    schedule: z.array(z.object({ time: z.string().max(20), title: z.string().max(200) })).max(16),
    tip: z.string().max(300),
  }),

  /* ------------------------------------------------ AI Productivity tools */
  /** Input JSON: { mode: "draft"|"rewrite"|"reply"|"translate", format, tone, length, language?, text, instructions? } */
  write: z.object({
    subject: z.string().max(200).optional(),
    text: z.string().min(1).max(12000),
    alternatives: z.array(z.string().max(4000)).max(2).optional(),
  }),
  /** Input JSON: { text, length: "short"|"medium"|"detailed" } */
  summarize: z.object({
    title: z.string().max(200),
    tldr: z.string().max(1500),
    keyPoints: z.array(z.string().max(500)).max(15),
    actionItems: z.array(z.string().max(300)).max(15),
    questions: z.array(z.string().max(300)).max(8),
  }),
  /** Input JSON: { goal, deadline?: "yyyy-MM-dd", hoursPerWeek?, context? } */
  "goal-plan": z.object({
    summary: z.string().max(600),
    milestones: z
      .array(
        z.object({
          title: z.string().min(1).max(200),
          targetDate: optDate,
          tasks: z.array(z.object({ title: z.string().min(1).max(200), dueDate: optDate, priority: z.enum(["low", "medium", "high"]) })).max(8),
        })
      )
      .min(1)
      .max(8),
    tips: z.array(z.string().max(300)).max(5),
  }),
  /** Input JSON: { question, options: string[] } */
  "decision-criteria": z.object({
    criteria: z.array(z.object({ name: z.string().min(1).max(60), weight: z.number().int().min(1).max(5), description: z.string().max(200) })).min(2).max(8),
  }),
  /** Input JSON: { question, options, criteria: [{name, weight}], scores: {option: {criterion: 1-5}} } */
  "decision-advice": z.object({
    recommendation: z.string().max(200),
    reasoning: z.string().max(1500),
    considerations: z.array(z.string().max(300)).max(6),
    perOption: z.array(z.object({ option: z.string().max(120), pros: z.array(z.string().max(200)).max(5), cons: z.array(z.string().max(200)).max(5) })).max(6),
  }),

  /* ------------------------------------------------------------ Wellness */
  /**
   * Input JSON: { profile, estimates, goals, last7Days[], weightTrend } — see the Wellness
   * "AI health check". Journal entries are never included.
   */
  "health-insights": z.object({
    summary: z.string().min(1).max(800),
    score: z.number().int().min(0).max(100),
    highlights: z.array(z.string().max(300)).max(5),
    improvements: z
      .array(z.object({ area: z.string().max(60), observation: z.string().max(300), recommendation: z.string().max(400) }))
      .max(6),
    suggestedGoals: z.object({
      waterGlasses: z.number().int().min(4).max(16).optional(),
      steps: z.number().int().min(2000).max(20000).optional(),
      exerciseMinutes: z.number().int().min(10).max(120).optional(),
      sleepHours: z.number().min(5).max(10).optional(),
    }),
    mealIdeas: z.array(z.string().max(250)).max(6),
    exerciseIdeas: z.array(z.string().max(250)).max(6),
    sleepTips: z.array(z.string().max(250)).max(4),
    seeDoctor: z.array(z.string().max(300)).max(4),
  }),

  /* ------------------------------------------------------------ Learn */
  /** Input JSON: { scenario, goal?, prompt } */
  "prompt-grade": z.object({
    overall: z.number().int().min(0).max(100),
    criteria: z.array(z.object({ name: z.string().max(40), score: z.number().int().min(0).max(10), feedback: z.string().max(400) })).min(3).max(7),
    strengths: z.array(z.string().max(300)).max(4),
    improvements: z.array(z.string().max(300)).max(5),
    improvedPrompt: z.string().max(4000),
  }),
  /** Input: the user's practice prompt (plain text). Output capped for practice. */
  "prompt-run": z.object({ output: z.string().max(6000) }),
  /** Input JSON: { task, text, level: "beginner"|"intermediate"|"advanced" } */
  "english-feedback": z.object({
    score: z.number().int().min(0).max(100),
    correctedText: z.string().max(6000),
    mistakes: z
      .array(z.object({ original: z.string().max(300), correction: z.string().max(300), type: z.string().max(40), explanation: z.string().max(400) }))
      .max(15),
    vocabularyTips: z.array(z.string().max(300)).max(5),
    encouragement: z.string().max(300),
  }),
  /** Input JSON: { topic, level, count } */
  "english-quiz": z.object({
    questions: z
      .array(
        z.object({
          question: z.string().min(1).max(400),
          options: z.array(z.string().min(1).max(200)).length(4),
          answerIndex: z.number().int().min(0).max(3),
          explanation: z.string().max(400),
        })
      )
      .min(1)
      .max(10),
  }),
  /** Input JSON: { category, difficulty } */
  "logic-puzzle": z.object({
    title: z.string().max(120),
    puzzle: z.string().min(1).max(2000),
    hint: z.string().max(400),
    answer: z.string().min(1).max(300),
    acceptableAnswers: z.array(z.string().max(120)).max(8),
    explanation: z.string().max(2000),
  }),
  /** Input JSON: { puzzle, answer, explanation, userAnswer, userReasoning? } */
  "logic-check": z.object({
    correct: z.boolean(),
    feedback: z.string().max(800),
  }),
} as const

export type AssistKind = keyof typeof ASSIST_OUTPUT
export const ASSIST_KINDS = Object.keys(ASSIST_OUTPUT) as [AssistKind, ...AssistKind[]]
export type AssistOutput<K extends AssistKind> = z.infer<(typeof ASSIST_OUTPUT)[K]>
export type AiTask = z.infer<typeof aiTaskSchema>
export type AiEvent = z.infer<typeof aiEventSchema>
export type AiReminder = z.infer<typeof aiReminderSchema>
export type AiRoutineItem = z.infer<typeof aiRoutineItemSchema>

/** The user's local clock, so relative dates ("tomorrow 6pm") resolve correctly. */
export const assistContextSchema = z.object({
  /** Local date-time "yyyy-MM-ddTHH:mm" */
  now: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  weekday: z.string().max(12),
  timeZone: z.string().max(64).optional(),
  /** Language for generated content: English or Hindi. */
  language: z.enum(["en", "hi"]).optional(),
})
export type AssistContext = z.infer<typeof assistContextSchema>

/** Default max characters of input per job. */
export const ASSIST_INPUT_LIMIT = 8000

/** Jobs that legitimately need longer input (pasted articles, essays). */
export const ASSIST_INPUT_LIMITS: Partial<Record<AssistKind, number>> = {
  summarize: 40000,
  write: 16000,
  "english-feedback": 12000,
}

export const assistInputLimit = (kind: AssistKind) => ASSIST_INPUT_LIMITS[kind] ?? ASSIST_INPUT_LIMIT
