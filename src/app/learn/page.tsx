import type { Metadata } from "next"
import { LearnPage } from "@/components/learn/learn-page"

export const metadata: Metadata = {
  title: "Learn with Fun",
  description: "Quiz games and AI lessons for reasoning, English, maths and any topic — explained simply with examples and stories, in English and Hindi.",
}

export default function Page() {
  return <LearnPage />
}
