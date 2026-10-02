import type { Metadata } from "next"
import { CalendarApp } from "@/components/tools/calendar/calendar-app"

export const metadata: Metadata = {
  title: "Calendar",
  description: "Month, week, day and agenda views for events saved in your browser.",
}

export default function CalendarPage() {
  return <CalendarApp />
}
