import { addDays, setHours, setMinutes, startOfDay } from "date-fns"
import { toDateString } from "@/lib/dates"
import type { Bookmark, CalendarEvent, ImportantInfo, RoutineItem, Task } from "@/types"
import { allStores, createId } from "./core"
import { bookmarksStore } from "./bookmarks"
import { eventsStore } from "./calendar"
import { importantInfoStore } from "./important-information"
import { routinesStore } from "./routines"
import { settingsStore, DEFAULT_SETTINGS } from "./settings"
import { tasksStore } from "./tasks"

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS = [1, 2, 3, 4, 5]

/** Seed realistic demo data the first time LifeKit runs in this browser. */
export function seedDemoDataIfNeeded() {
  const settings = settingsStore.get()
  if (settings.seeded) return

  const now = new Date()
  const today = toDateString(now)
  const tomorrow = toDateString(addDays(now, 1))
  const at = (dayOffset: number, h: number, m = 0) =>
    setMinutes(setHours(startOfDay(addDays(now, dayOffset)), h), m).toISOString()
  const created = now.toISOString()

  const tasks: Task[] = [
    {
      id: createId(), title: "Pay electricity bill", priority: "high", dueDate: today, dueTime: "18:00",
      category: "Home", recurrence: "monthly", completed: false, subtasks: [], createdAt: created, demo: true,
      notes: "Use the society payment portal.",
    },
    {
      id: createId(), title: "Prepare slides for Monday review", priority: "medium", dueDate: tomorrow,
      category: "Work", recurrence: "none", completed: false, createdAt: created, demo: true,
      subtasks: [
        { id: createId(), title: "Collect Q3 numbers", done: true },
        { id: createId(), title: "Draft outline", done: false },
        { id: createId(), title: "Design charts", done: false },
      ],
    },
    {
      id: createId(), title: "Buy groceries", priority: "low", dueDate: today, category: "Personal",
      recurrence: "weekly", completed: false, subtasks: [], createdAt: created, demo: true,
      notes: "Milk, eggs, spinach, rice",
    },
  ]

  const events: CalendarEvent[] = [
    {
      id: createId(), title: "Team stand-up", start: at(0, 10), end: at(0, 10, 30), allDay: false,
      color: "indigo", recurrence: "weekly", location: "Google Meet", demo: true,
    },
    {
      id: createId(), title: "Dentist appointment", start: at(2, 16), end: at(2, 17), allDay: false,
      color: "rose", recurrence: "none", location: "Smile Dental Clinic", notes: "Carry previous X-ray.", demo: true,
    },
  ]

  const routine: Omit<RoutineItem, "id" | "order" | "completedDates" | "demo">[] = [
    { title: "Wake up", time: "06:30", durationMinutes: 15, repeatDays: ALL_DAYS, color: "amber" },
    { title: "Exercise", time: "07:00", durationMinutes: 45, repeatDays: ALL_DAYS, color: "emerald" },
    { title: "Deep work", time: "09:00", durationMinutes: 180, repeatDays: WEEKDAYS, color: "indigo" },
    { title: "Lunch", time: "13:00", durationMinutes: 45, repeatDays: ALL_DAYS, color: "sky" },
    { title: "Gym", time: "18:30", durationMinutes: 60, repeatDays: [1, 3, 5], color: "rose" },
    { title: "Study", time: "20:00", durationMinutes: 60, repeatDays: WEEKDAYS, color: "violet" },
    { title: "Sleep", time: "22:30", durationMinutes: 480, repeatDays: ALL_DAYS, color: "slate" },
  ]

  const bookmarks: Bookmark[] = [
    {
      id: createId(), url: "https://developer.mozilla.org/", title: "MDN Web Docs",
      description: "Reference for HTML, CSS and JavaScript.", category: "Learning", tags: ["web", "docs"],
      createdAt: created, demo: true,
    },
    {
      id: createId(), url: "https://www.incometax.gov.in/", title: "Income Tax e-Filing",
      description: "File returns and check refund status.", category: "Finance", tags: ["tax"],
      createdAt: created, demo: true,
    },
  ]

  const info: ImportantInfo[] = [
    {
      id: createId(), title: "Society Office", category: "home", phone: "+91 98765 43210",
      notes: "Open 9 AM – 6 PM, closed Sundays.", sensitive: false, createdAt: created, demo: true,
    },
  ]

  tasksStore.set((prev) => [...prev, ...tasks])
  eventsStore.set((prev) => [...prev, ...events])
  routinesStore.set((prev) => [
    ...prev,
    ...routine.map((r, i) => ({ ...r, id: createId(), order: i, completedDates: [], demo: true })),
  ])
  bookmarksStore.set((prev) => [...prev, ...bookmarks])
  importantInfoStore.set((prev) => [...prev, ...info])
  settingsStore.set((prev) => ({ ...DEFAULT_SETTINGS, ...prev, seeded: true }))
}

/** Remove only the seeded demo records, keeping everything the user created. */
export function removeDemoData() {
  for (const store of allStores()) {
    if ("removeDemo" in store && typeof store.removeDemo === "function") store.removeDemo()
  }
}
