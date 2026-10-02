import type { Metadata } from "next"
import { RoutineApp } from "@/components/tools/routine-planner/routine-app"

export const metadata: Metadata = {
  title: "Daily Routine",
  description: "Build a visual daily routine timeline and tick off each block.",
}

export default function RoutinePlannerPage() {
  return <RoutineApp />
}
