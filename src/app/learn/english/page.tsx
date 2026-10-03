import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { EnglishApp } from "@/components/learn/english/english-app"

export const metadata: Metadata = {
  title: "Learn English",
  description: "Build vocabulary with spaced-repetition flashcards, practise grammar, get writing feedback and improve pronunciation.",
}

export default function LearnEnglishPage() {
  return (
    <ToolPage toolId="learn-english" width="wide">
      <EnglishApp />
    </ToolPage>
  )
}
