import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { LogicApp } from "@/components/learn/logic/logic-app"

export const metadata: Metadata = {
  title: "Logic & Reasoning",
  description: "Daily puzzles, a puzzle bank, mental maths sprints, pattern spotting and short lessons on clear thinking.",
}

export default function LearnLogicPage() {
  return (
    <ToolPage toolId="learn-logic" width="wide">
      <LogicApp />
    </ToolPage>
  )
}
