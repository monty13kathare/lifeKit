import { Suspense } from "react"
import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { Skeleton } from "@/components/ui/skeleton"
import { AiWriter } from "@/components/tools/ai-writer/ai-writer"

export const metadata: Metadata = {
  title: "AI Writer",
  description: "Draft, rewrite, reply to and translate emails and messages with Google Gemini.",
}

export default function AiWriterPage() {
  return (
    <ToolPage toolId="ai-writer" width="wide">
      {/* AiWriter reads ?mode= and ?text= via useSearchParams. */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <AiWriter />
      </Suspense>
    </ToolPage>
  )
}
