import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { FocusSettingsButton, FocusTimer } from "@/components/tools/focus/focus-timer"

export const metadata: Metadata = {
  title: "Focus Timer",
  description: "Pomodoro focus sessions linked to your tasks, with breaks, goals and stats — saved in your browser.",
}

export default function FocusPage() {
  return (
    <ToolPage toolId="focus" width="default" actions={<FocusSettingsButton />}>
      <FocusTimer />
    </ToolPage>
  )
}
