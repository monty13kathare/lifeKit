import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { VoiceToText } from "@/components/tools/voice-to-text/voice-to-text"

export const metadata: Metadata = {
  title: "Voice to Text",
  description: "Dictate with your microphone and get a live, editable transcript.",
}

export default function VoiceToTextPage() {
  return (
    <ToolPage toolId="voice-to-text" width="default">
      <VoiceToText />
    </ToolPage>
  )
}
