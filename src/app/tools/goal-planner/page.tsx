import type { Metadata } from "next"
import { GoalPlannerApp } from "@/components/tools/goal-planner/goal-planner-app"

export const metadata: Metadata = {
  title: "Goal Planner",
  description: "Turn a goal into milestones and linked tasks, and track your progress — saved in your browser.",
}

export default function GoalPlannerPage() {
  return <GoalPlannerApp />
}
