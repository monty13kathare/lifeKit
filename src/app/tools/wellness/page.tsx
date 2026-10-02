import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { WellnessTracker } from "@/components/tools/wellness/wellness-tracker"

export const metadata: Metadata = {
  title: "Wellness",
  description: "Track water, steps, exercise, sleep, mood and habits — saved privately in your browser.",
}

export default function WellnessPage() {
  return (
    <ToolPage toolId="wellness" width="default">
      <WellnessTracker />
    </ToolPage>
  )
}
