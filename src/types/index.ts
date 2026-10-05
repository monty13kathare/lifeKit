/** Dates are stored as `yyyy-MM-dd` strings, times as `HH:mm`, instants as ISO strings. */
export type DateString = string
export type TimeString = string
export type ISODateTime = string

export interface EncryptedPayload {
  salt: string
  iv: string
  cipher: string
  iterations?: number
}

export type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly"

/* ------------------------------------------------------------------ Tasks */

export type TaskPriority = "low" | "medium" | "high"

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task {
  id: string
  title: string
  notes?: string
  priority: TaskPriority
  dueDate?: DateString
  dueTime?: TimeString
  category: string
  recurrence: Exclude<Recurrence, "yearly">
  completed: boolean
  completedAt?: ISODateTime
  subtasks: Subtask[]
  createdAt: ISODateTime
  demo?: boolean
}

/* --------------------------------------------------------------- Routines */

export interface RoutineItem {
  id: string
  title: string
  time: TimeString
  durationMinutes: number
  /** 0 = Sunday … 6 = Saturday */
  repeatDays: number[]
  /** Explicit sort order within the day (lower first); ties broken by time. */
  order: number
  color: EventColor
  /** Dates on which this item was ticked off. */
  completedDates: DateString[]
  demo?: boolean
}

/* --------------------------------------------------------------- Calendar */

export type EventColor = "indigo" | "sky" | "emerald" | "amber" | "rose" | "violet" | "slate"

export interface CalendarEvent {
  id: string
  title: string
  start: ISODateTime
  end: ISODateTime
  allDay: boolean
  color: EventColor
  notes?: string
  location?: string
  recurrence: Recurrence
  /** Last date (inclusive) a recurring event repeats on. */
  recurrenceUntil?: DateString
  /** Alert this many minutes before each occurrence (null/undefined = no alert). */
  alertMinutes?: number | null
  /** ISO start of the occurrence most recently alerted, to avoid duplicates. */
  lastAlertedFor?: ISODateTime
  demo?: boolean
}

/** A single concrete occurrence of a (possibly recurring) event. */
export interface EventOccurrence {
  event: CalendarEvent
  start: Date
  end: Date
  /** Stable key: `${event.id}:${start ISO}` */
  key: string
}

/* -------------------------------------------------------------- Reminders */

export interface Reminder {
  id: string
  title: string
  date: DateString
  time: TimeString
  repeat: Exclude<Recurrence, "yearly">
  notes?: string
  /** For one-off reminders: dismissed/completed. */
  done: boolean
  /** ISO time of the occurrence most recently notified, to avoid duplicates. */
  lastFiredFor?: ISODateTime
  createdAt: ISODateTime
  demo?: boolean
}

/* ------------------------------------------------------------------ Notes */

export interface Note {
  id: string
  title: string
  content: string
  source: "manual" | "ocr" | "voice"
  createdAt: ISODateTime
  updatedAt: ISODateTime
  /** Pinned notes are listed first. */
  pinned?: boolean
  color?: EventColor
  tags?: string[]
  demo?: boolean
}

/* --------------------------------------------------------------- Wellness */

export interface WellnessDay {
  /** id === date (yyyy-MM-dd) */
  id: DateString
  waterGlasses: number
  steps: number
  exerciseMinutes: number
  exerciseNote?: string
  sleepHours: number
  /** 1 (low) … 5 (great) */
  mood?: number
  meals: string
  journal: string
  /** habitId -> done */
  habits: Record<string, boolean>
  demo?: boolean
}

export interface Habit {
  id: string
  name: string
}

export interface WellnessGoals {
  waterGlasses: number
  steps: number
  exerciseMinutes: number
  sleepHours: number
  habits: Habit[]
}

/* -------------------------------------------------------------- Bookmarks */

export interface Bookmark {
  id: string
  url: string
  title: string
  description?: string
  category: string
  tags: string[]
  createdAt: ISODateTime
  demo?: boolean
}


/* --------------------------------------------------------------- Settings */

export interface DashboardPrefs {
  showQuickTools: boolean
  showToday: boolean
  showCategories: boolean
  /** Which "Today" widgets are visible. */
  todayWidgets: {
    tasks: boolean
    routine: boolean
    events: boolean
    wellness: boolean
  }
}

export type AiLanguage = "en" | "hi"

export interface Settings {
  displayName: string
  dashboard: DashboardPrefs
  installPromptDismissed: boolean
  /** Has demo data been seeded (or deliberately skipped) in this browser? */
  seeded: boolean
  currency: string
  /** Language for AI-generated content. */
  aiLanguage: AiLanguage
}

/* ------------------------------------------------------------------ Goals */

export interface GoalMilestone {
  id: string
  title: string
  targetDate?: DateString
  /** Tasks created in the Tasks tool for this milestone. */
  taskIds: string[]
  done: boolean
}

export interface Goal {
  id: string
  title: string
  why?: string
  deadline?: DateString
  milestones: GoalMilestone[]
  status: "active" | "achieved" | "archived"
  createdAt: ISODateTime
  achievedAt?: ISODateTime
  demo?: boolean
}

/* -------------------------------------------------------------- Decisions */

export interface DecisionCriterion {
  id: string
  name: string
  /** 1 (minor) … 5 (critical) */
  weight: number
}

export interface Decision {
  id: string
  question: string
  options: { id: string; name: string }[]
  criteria: DecisionCriterion[]
  /** optionId -> criterionId -> score 1…5 */
  scores: Record<string, Record<string, number>>
  /** Option the user finally chose, if any. */
  chosenOptionId?: string
  notes?: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
  demo?: boolean
}

/* --------------------------------------------------------- Health profile */

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very-active"
export type HealthGoal = "lose-weight" | "maintain" | "gain-weight" | "build-fitness" | "more-energy" | "better-sleep"
export type DietType = "vegetarian" | "non-vegetarian" | "eggetarian" | "vegan" | "jain"
export type WorkType = "desk" | "standing" | "physical" | "student" | "home" | "shift"

export interface WeightEntry {
  date: DateString
  kg: number
}

export interface HealthProfile {
  age?: number
  sex?: "male" | "female" | "other"
  heightCm?: number
  /** Current weight; also appended to `weightLog` when it changes. */
  weightKg?: number
  activity: ActivityLevel
  goal: HealthGoal
  /** Target weight for lose/gain goals. */
  targetWeightKg?: number
  diet?: DietType
  work?: WorkType
  wakeTime?: TimeString
  bedTime?: TimeString
  /** Optional free text the user chooses to share (e.g. "mild back pain", "desk job, long commute"). */
  notes?: string
  weightLog: WeightEntry[]
  /** Preferred input units (values are always stored in cm and kg). */
  heightUnit?: "cm" | "ft"
  weightUnit?: "kg" | "lb"
  updatedAt?: ISODateTime
}

/** The latest AI health plan (diet, workout week, routine) for the user's goal. */
export interface HealthPlan {
  generatedAt: ISODateTime
  language: AiLanguage
  goal: HealthGoal
  /** Calorie target and weight the plan was made for, to flag a stale plan. */
  calorieTarget?: number
  weightKg?: number
  /** Output of the `health-plan` AI job. */
  data: {
    summary: string
    focus: string[]
    meals: { time: string; name: string; items: string; kcal: number }[]
    eatMore: string[]
    limit: string[]
    workouts: { day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"; focus: string; rest: boolean; minutes: number; exercises: string[] }[]
    routine: { time: TimeString; title: string; durationMinutes: number }[]
    tips: string[]
    suggestedGoals: { waterGlasses?: number; steps?: number; exerciseMinutes?: number; sleepHours?: number }
    seeDoctor: string[]
  }
}

/** A saved AI health check (latest few kept). */
export interface HealthInsight {
  id: string
  generatedAt: ISODateTime
  language: AiLanguage
  /** Snapshot of the inputs' key numbers, to show "then vs now". */
  snapshot: { weightKg?: number; bmi?: number; avgSleep?: number; avgSteps?: number; avgWater?: number }
  /** Output of the `health-insights` AI job. */
  data: {
    summary: string
    score: number
    highlights: string[]
    improvements: { area: string; observation: string; recommendation: string }[]
    suggestedGoals: { waterGlasses?: number; steps?: number; exerciseMinutes?: number; sleepHours?: number }
    mealIdeas: string[]
    exerciseIdeas: string[]
    sleepTips: string[]
    seeDoctor: string[]
  }
  demo?: boolean
}

/* ------------------------------------------------------- Learn with Fun */

export type FunLanguage = "en" | "hi"
export type FunDifficulty = "easy" | "medium" | "hard"
export type FunMode = "classic" | "timed" | "survival" | "study"

/** The readable text of a question in one language. */
export interface FunQuestionText {
  /** Short story/passage the question is about (story-based questions). */
  story?: string
  question: string
  options: string[]
  explanation: string
}

export interface FunQuestion extends FunQuestionText {
  answerIndex: number
  hint?: string
  /** Hindi translation shown under the English text in "both" mode. */
  hindi?: FunQuestionText
}

/** A quiz the user saved to replay later. */
export interface FunQuizSet {
  id: string
  title: string
  category: string
  topic: string
  difficulty: FunDifficulty
  language: FunLanguage
  questions: FunQuestion[]
  source: "ai" | "starter"
  createdAt: ISODateTime
  plays: number
  /** Best score in percent. */
  best?: number
}

export interface FunCategoryStats {
  games: number
  answered: number
  correct: number
}

export interface FunStats {
  xp: number
  games: number
  answered: number
  correct: number
  bestCombo: number
  /** Consecutive days with at least one game. */
  dayStreak: number
  lastPlayed?: DateString
  categories: Record<string, FunCategoryStats>
}

/* ---------------------------------------------------------- Learning Zone */

export type LessonLevel = "beginner" | "intermediate" | "advanced"
export type LessonStyle = "examples" | "story" | "exam"

/** Output of the `learn-lesson` AI job. */
export interface LessonContent {
  title: string
  intro: string
  keyIdeas: { heading: string; explanation: string; example: string }[]
  story: { title: string; text: string }
  method: string[]
  examples: { question: string; steps: string[]; answer: string }[]
  tips: string[]
  mistakes: string[]
  practice: { question: string; options: string[]; answerIndex: number; explanation: string }[]
  summary: string[]
  nextTopics: string[]
}

/** A lesson the learner generated, kept to reread (also offline). */
export interface LearnLesson {
  id: string
  subject: string
  topic: string
  level: LessonLevel
  style: LessonStyle
  language: AiLanguage
  createdAt: ISODateTime
  /** Set when the quick check was finished. */
  completedAt?: ISODateTime
  /** Quick-check score in percent. */
  score?: number
  data: LessonContent
}

/* ------------------------------------------------------------ Story Mode */

export type StorySetting =
  | "forest" | "jungle" | "village" | "farm" | "city" | "market" | "home" | "school"
  | "palace" | "garden" | "river" | "sea" | "mountain" | "desert" | "space"

export interface StoryScene {
  setting: StorySetting
  time: "morning" | "day" | "evening" | "night"
  weather: "clear" | "cloudy" | "rain"
  mood: "happy" | "calm" | "exciting" | "tense" | "sad"
  /** Single emoji per character, consistent across pages. */
  characters: string[]
  props: string[]
}

export interface StoryPage {
  text: string
  scene: StoryScene
  imagePrompt: string
  /** AI illustration (compressed JPEG data URL), when the reader asked for one. */
  imageUrl?: string
}

/** An illustrated Story Mode book. */
export interface StoryBook {
  id: string
  title: string
  moral: string
  theme: string
  language: AiLanguage
  createdAt: ISODateTime
  pages: StoryPage[]
}
