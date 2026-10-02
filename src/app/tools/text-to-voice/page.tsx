import { Suspense } from "react"
import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { Skeleton } from "@/components/ui/skeleton"
import { TextToVoiceWithParams } from "@/components/tools/text-to-voice/text-to-voice"

export const metadata: Metadata = {
  title: "Text to Voice",
  description: "Have any text read aloud with your device's voices, with word highlighting.",
}

export default function TextToVoicePage() {
  return (
    <ToolPage toolId="text-to-voice" width="default">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <TextToVoiceWithParams />
      </Suspense>
    </ToolPage>
  )
}
