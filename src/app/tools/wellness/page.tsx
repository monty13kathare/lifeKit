import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { WellnessApp } from "@/components/tools/wellness/wellness-app"

export const metadata: Metadata = {
  title: "Wellness",
  description: "Track water, steps, exercise, sleep, mood and habits, keep a private health profile and get an optional AI health check.",
}

export default function WellnessPage() {
  return (
    <ToolPage toolId="wellness" width="default">
      <WellnessApp />
    </ToolPage>
  )
}
