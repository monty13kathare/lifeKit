import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { PromptingApp } from "@/components/learn/prompting/prompting-app"

export const metadata: Metadata = {
  title: "AI Prompting",
  description: "Learn to write prompts that get great results: short lessons, a Prompt Lab with AI grading, a quiz and a reusable prompt library.",
}

export default function LearnPromptingPage() {
  return (
    <ToolPage toolId="learn-prompting" width="wide">
      <PromptingApp />
    </ToolPage>
  )
}
