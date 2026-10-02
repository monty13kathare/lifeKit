/** Dates are stored as `yyyy-MM-dd` strings, times as `HH:mm`, instants as ISO strings. */
export type DateString = string
export type TimeString = string
export type ISODateTime = string

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

/* ------------------------------------------------- Important information */

export type InfoCategory =
  | "emergency"
  | "family"
  | "work"
  | "school"
  | "vehicle"
  | "home"
  | "travel"
  | "other"

export interface EncryptedPayload {
  /** base64 */
  salt: string
  /** base64 */
  iv: string
  /** base64 AES-GCM ciphertext of a JSON object of the secret fields */
  cipher: string
  /** PBKDF2 iteration count used to derive the key (stored so it can be raised later). */
  iterations?: number
}

export interface ImportantInfo {
  id: string
  title: string
  category: InfoCategory
  phone?: string
  email?: string
  details?: string
  notes?: string
  /**
   * When true, `details`/`notes` are not stored in plaintext: they live inside
   * `encrypted`, locked with a passphrase the user chooses (Web Crypto).
   */
  sensitive: boolean
  encrypted?: EncryptedPayload
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

export interface Settings {
  displayName: string
  dashboard: DashboardPrefs
  installPromptDismissed: boolean
  /** Has demo data been seeded (or deliberately skipped) in this browser? */
  seeded: boolean
  currency: string
}
