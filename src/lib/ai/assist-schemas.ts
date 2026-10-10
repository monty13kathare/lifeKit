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

/** Backdrops Story Mode can draw for a page. */
export const STORY_SETTINGS = ["forest", "jungle", "village", "farm", "city", "market", "home", "school", "palace", "garden", "river", "sea", "mountain", "desert", "space"] as const

export const aiTaskSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: optDate,
  dueTime: optTime,
  category: z.string().max(40).optional(),
  recurrence: z.enum(["none", "minutely", "15_min", "30_min", "hourly", "90_min", "daily", "weekly", "monthly"]),
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
  recurrence: z.enum(["none", "minutely", "15_min", "30_min", "hourly", "90_min", "daily", "weekly", "monthly", "yearly"]),
  /** -1 = no alert */
  alertMinutes: z.number().int().min(-1).max(1440).optional(),
})

export const aiReminderSchema = z.object({
  title: z.string().min(1).max(200),
  date,
  time,
  repeat: z.enum(["none", "minutely", "15_min", "30_min", "hourly", "90_min", "daily", "weekly", "monthly"]),
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
  /**
   * Input JSON: { profile, estimates (incl. calorieTarget + macros), goals, last7Days[], weightTrend, preferences? }.
   * A full personal plan: diet, a 7-day workout week and a daily routine. Journal entries are never included.
   */
  "health-plan": z.object({
    summary: z.string().min(1).max(700),
    focus: z.array(z.string().max(120)).max(3),
    meals: z
      .array(z.object({ time: z.string().max(12), name: z.string().min(1).max(40), items: z.string().min(1).max(240), kcal: z.number().int().min(0).max(2500) }))
      .min(3)
      .max(6),
    eatMore: z.array(z.string().max(80)).max(6),
    limit: z.array(z.string().max(80)).max(6),
    workouts: z
      .array(
        z.object({
          day: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
          focus: z.string().min(1).max(60),
          rest: z.boolean(),
          minutes: z.number().int().min(0).max(180),
          exercises: z.array(z.string().max(120)).max(6),
        })
      )
      .min(7)
      .max(7),
    routine: z.array(z.object({ time, title: z.string().min(1).max(80), durationMinutes: z.number().int().min(5).max(600) })).min(3).max(12),
    tips: z.array(z.string().max(250)).max(5),
    suggestedGoals: z.object({
      waterGlasses: z.number().int().min(4).max(16).optional(),
      steps: z.number().int().min(2000).max(20000).optional(),
      exerciseMinutes: z.number().int().min(10).max(120).optional(),
      sleepHours: z.number().min(5).max(10).optional(),
    }),
    seeDoctor: z.array(z.string().max(300)).max(4),
  }),
  /** Input JSON: { question, profile } — one health/fitness/nutrition question. */
  "health-ask": z.object({
    answer: z.string().min(1).max(1500),
    points: z.array(z.string().max(250)).max(5),
    seeDoctor: z.string().max(300).optional(),
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
  /** Input JSON: { category, topic, difficulty, count, language: "en"|"hi"|"both", avoid?: string[] } */
  "fun-quiz": z.object({
    title: z.string().max(120),
    questions: z
      .array(
        z.object({
          story: z.string().max(1500).optional(),
          question: z.string().min(1).max(1000),
          options: z.array(z.string().min(1).max(200)).length(4),
          answerIndex: z.number().int().min(0).max(3),
          hint: z.string().max(300).optional(),
          explanation: z.string().max(800),
          /** Only in "both" mode: Hindi translation (options in the same order). */
          hindi: z
            .object({
              story: z.string().max(2000).optional(),
              question: z.string().max(1200),
              options: z.array(z.string().max(240)).max(4),
              explanation: z.string().max(1000),
            })
            .optional(),
        })
      )
      .min(1)
      .max(10),
  }),
  "learn-lesson": z.object({
    title: z.string().min(1).max(120),
    intro: z.string().min(1).max(1200),
    keyIdeas: z
      .array(z.object({ heading: z.string().min(1).max(100), explanation: z.string().min(1).max(900), example: z.string().max(700) }))
      .min(2)
      .max(6),
    story: z.object({ title: z.string().max(100), text: z.string().max(1800) }),
    method: z.array(z.string().max(300)).max(8),
    examples: z
      .array(z.object({ question: z.string().min(1).max(600), steps: z.array(z.string().max(300)).max(8), answer: z.string().min(1).max(300) }))
      .min(1)
      .max(3),
    tips: z.array(z.string().max(250)).max(5),
    mistakes: z.array(z.string().max(250)).max(4),
    // Core fields come before the large optional sections: Gemini writes keys in
    // schema order, so these are never the ones lost to the output-token limit.
    practice: z
      .array(
        z.object({
          question: z.string().min(1).max(500),
          options: z.array(z.string().min(1).max(200)).length(4),
          answerIndex: z.number().int().min(0).max(3),
          explanation: z.string().max(500),
        })
      )
      .min(2)
      .max(4),
    summary: z.array(z.string().max(250)).min(2).max(6),
    nextTopics: z.array(z.string().max(80)).max(4),
    studyGuide: z
      .array(
        z.object({
          phase: z.string().min(1).max(200),
          description: z.string().min(1).max(1500),
          tasks: z.array(z.string().max(500)).max(15),
        })
      )
      .max(15)
      .optional(),
    resources: z
      .array(
        z.object({
          name: z.string().min(1).max(200),
          type: z.string().max(100),
          description: z.string().max(600),
        })
      )
      .max(15)
      .optional(),
    deepDive: z
      .object({
        title: z.string().min(1).max(200),
        content: z.array(z.string().max(1500)).max(15),
      })
      .optional(),
    syllabus: z
      .array(
        z.object({
          subject: z.string().min(1).max(200),
          // Objects only: toGeminiSchema keeps just the first branch of a union, so a
          // `string | object` union would stop Gemini from ever sending sub-topics.
          topics: z
            .array(
              z.object({
                name: z.string().min(1).max(200),
                description: z.string().max(400).optional(),
                subTopics: z.array(z.string().max(200)).max(30).optional(),
              })
            )
            .max(50),
        })
      )
      .max(20)
      .optional(),
    examModules: z
      .array(
        z.object({
          title: z.string().min(1).max(200),
          topics: z
            .array(
              z.object({
                name: z.string().min(1).max(200),
                explanation: z.string().min(1).max(3000),
                keyPoints: z.array(z.string().max(300)).max(8).optional(),
                example: z.string().max(2000),
              })
            )
            .max(20),
        })
      )
      .max(15)
      .optional(),
    explorableLists: z
      .array(
        z.object({
          title: z.string().min(1).max(200),
          description: z.string().max(800).optional(),
          items: z.array(
            z.object({
              name: z.string().min(1).max(200),
              subtitle: z.string().max(800).optional()
            })
          ).max(50)
        })
      )
      .max(15)
      .optional(),
    tables: z
      .array(
        z.object({
          title: z.string().min(1).max(200),
          columns: z.array(z.string()).max(10),
          rows: z.array(z.array(z.string())).max(50),
        })
      )
      .max(10)
      .optional(),
    metadata: z
      .array(
        z.object({
          key: z.string().min(1).max(100),
          value: z.string().min(1).max(500),
        })
      )
      .max(20)
      .optional(),
  }),
  /** Input JSON: { theme, idea?, age, pages, language } — an illustrated picture-book story. */
  "story-book": z.object({
    title: z.string().min(1).max(120),
    moral: z.string().max(300),
    pages: z
      .array(
        z.object({
          text: z.string().min(1).max(900),
          scene: z.object({
            setting: z.enum(STORY_SETTINGS),
            time: z.enum(["morning", "day", "evening", "night"]),
            weather: z.enum(["clear", "cloudy", "rain"]),
            mood: z.enum(["happy", "calm", "exciting", "tense", "sad"]),
            /** 1–3 characters on the page as single emoji (🦊, 👦, 👑…). */
            characters: z.array(z.string().min(1).max(16)).max(3),
            props: z.array(z.string().min(1).max(16)).max(3),
          }),
          /** English description of the page's picture for the image model. */
          imagePrompt: z.string().min(3).max(500),
        })
      )
      .min(4)
      .max(14),
  }),
  /** Input JSON: { subject, topic, lessonTitle, keyIdeas, question, history: { q, a }[], language } — a detailed Markdown answer. */
  "learn-ask": z.object({
    answer: z.string().min(1).max(6000),
    example: z.string().max(1500).optional(),
    followUps: z.array(z.string().max(120)).max(3).optional(),
  }),
  /** Input JSON: { subject, lessonTitle, section, topic, hint?, level, language } — an in-depth explanation of one syllabus/module topic. */
  "learn-topic": z.object({
    overview: z.string().min(1).max(5000),
    keyPoints: z.array(z.string().max(300)).max(8),
    subTopics: z
      .array(z.object({ name: z.string().min(1).max(120), explanation: z.string().min(1).max(1200) }))
      .max(8),
    example: z.string().max(2000),
    tip: z.string().max(400).optional(),
    quiz: z
      .array(
        z.object({
          question: z.string().min(1).max(400),
          options: z.array(z.string().min(1).max(200)).length(4),
          answerIndex: z.number().int().min(0).max(3),
          explanation: z.string().max(500),
        })
      )
      .max(2),
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
