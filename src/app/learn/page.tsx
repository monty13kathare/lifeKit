import type { Metadata } from "next"
import { LearnFunApp } from "@/components/learn/fun/learn-fun-app"

export const metadata: Metadata = {
  title: "Learn with Fun",
  description: "Quiz games for logic, reasoning, English, riddles, idioms and stories — in English and Hindi, with AI-made questions on any topic.",
}

export default function LearnPage() {
  return <LearnFunApp />
}
