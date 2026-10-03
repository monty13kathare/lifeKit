import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { Summarizer } from "@/components/tools/summarizer/summarizer"

export const metadata: Metadata = {
  title: "Summarizer",
  description: "Get a TL;DR, key points, action items and open questions from any text with Google Gemini.",
}

export default function SummarizerPage() {
  return (
    <ToolPage toolId="summarizer" width="wide">
      <Summarizer />
    </ToolPage>
  )
}
