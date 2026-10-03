import type { AiRoutineItem } from "@/lib/ai/assist-schemas"
import { ALL_DAYS, WEEKDAYS, WEEKENDS } from "./routine-utils"

/** A routine block before it becomes a stored `RoutineItem` (same shape the AI returns). */
export type RoutinePreviewItem = AiRoutineItem

export interface RoutineTemplate {
  id: string
  name: string
  description: string
  items: RoutinePreviewItem[]
}

const it = (
  time: string,
  title: string,
  durationMinutes: number,
  repeatDays: number[],
  color: RoutinePreviewItem["color"]
): RoutinePreviewItem => ({ time, title, durationMinutes, repeatDays, color })

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: "early-bird",
    name: "Early bird",
    description: "Up at 5:30 with a quiet, focused morning.",
    items: [
      it("05:30", "Wake up & water", 15, ALL_DAYS, "amber"),
      it("05:45", "Stretch or yoga", 30, ALL_DAYS, "emerald"),
      it("06:15", "Journal & plan the day", 20, ALL_DAYS, "violet"),
      it("06:45", "Deep work", 90, WEEKDAYS, "indigo"),
      it("08:15", "Breakfast", 30, ALL_DAYS, "amber"),
      it("21:00", "Wind down, no screens", 30, ALL_DAYS, "slate"),
      it("21:30", "Sleep", 480, ALL_DAYS, "slate"),
    ],
  },
  {
    id: "student",
    name: "Student",
    description: "Classes, study blocks and time to recharge.",
    items: [
      it("07:00", "Wake up & breakfast", 45, WEEKDAYS, "amber"),
      it("08:00", "Classes", 240, WEEKDAYS, "indigo"),
      it("12:00", "Lunch", 45, WEEKDAYS, "amber"),
      it("13:00", "Classes / lab", 180, WEEKDAYS, "indigo"),
      it("16:30", "Exercise", 45, [1, 3, 5], "emerald"),
      it("18:00", "Study session", 90, [0, 1, 2, 3, 4], "violet"),
      it("20:00", "Free time", 90, ALL_DAYS, "sky"),
      it("23:00", "Sleep", 480, ALL_DAYS, "slate"),
    ],
  },
  {
    id: "office-day",
    name: "Office day",
    description: "Commute, a 9–5 and evenings that are yours.",
    items: [
      it("06:45", "Wake up & get ready", 45, WEEKDAYS, "amber"),
      it("07:30", "Breakfast", 20, WEEKDAYS, "amber"),
      it("08:00", "Commute", 45, WEEKDAYS, "slate"),
      it("09:00", "Work — focus block", 180, WEEKDAYS, "indigo"),
      it("12:00", "Lunch break", 60, WEEKDAYS, "emerald"),
      it("13:00", "Work — meetings & email", 240, WEEKDAYS, "indigo"),
      it("17:15", "Commute home", 45, WEEKDAYS, "slate"),
      it("18:30", "Dinner", 45, WEEKDAYS, "amber"),
      it("22:30", "Sleep", 495, WEEKDAYS, "slate"),
    ],
  },
  {
    id: "wfh",
    name: "Work from home",
    description: "Structure for remote days, with real breaks.",
    items: [
      it("07:00", "Wake up & coffee", 30, WEEKDAYS, "amber"),
      it("07:30", "Morning walk", 30, WEEKDAYS, "emerald"),
      it("08:30", "Deep work", 150, WEEKDAYS, "indigo"),
      it("11:00", "Stretch break", 15, WEEKDAYS, "emerald"),
      it("11:15", "Meetings & messages", 75, WEEKDAYS, "sky"),
      it("12:30", "Lunch away from the desk", 60, WEEKDAYS, "amber"),
      it("13:30", "Focused work", 180, WEEKDAYS, "indigo"),
      it("16:30", "Shut down & tidy desk", 15, WEEKDAYS, "violet"),
      it("17:00", "Exercise", 45, WEEKDAYS, "emerald"),
    ],
  },
  {
    id: "weekend-reset",
    name: "Weekend reset",
    description: "Slow mornings, chores, and prep for the week.",
    items: [
      it("08:30", "Slow breakfast", 45, WEEKENDS, "amber"),
      it("09:30", "Outdoor time", 90, WEEKENDS, "emerald"),
      it("11:00", "Laundry & tidy up", 60, [6], "sky"),
      it("13:00", "Groceries & errands", 90, [6], "slate"),
      it("16:00", "Meal prep", 90, [0], "amber"),
      it("18:00", "Plan the week ahead", 30, [0], "violet"),
      it("21:00", "Early night routine", 30, [0], "slate"),
    ],
  },
]

export const ROUTINE_EXAMPLES = [
  "I wake at 6:30, work 9–5 on weekdays, gym Mon/Wed/Fri evenings, sleep by 11",
  "Student: classes 9–3 on weekdays, study 2 hours each evening, football Saturday morning",
  "Night shift nurse: sleep 8am–3pm, work 7pm–7am Tue to Fri",
  "Remote developer, school run at 8:15, yoga Tue/Thu at 7am, family dinner at 6",
]
