import type { Metadata } from "next"
import { RemindersApp } from "@/components/tools/reminders/reminders-app"

export const metadata: Metadata = {
  title: "Reminders",
  description: "One-off and repeating reminders with in-app alerts and optional browser notifications.",
}

export default function RemindersPage() {
  return <RemindersApp />
}
