import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { TaskNotesTool } from "@/components/tools/task-notes/task-notes-tool"

export const metadata: Metadata = {
  title: "AI Task Notes · Point-by-Point Checklist & WhatsApp Share",
  description: "Turn rough thoughts and comma-separated tasks into detailed point-to-point checklists ready for WhatsApp and Markdown.",
}

export default function Page() {
  return (
    <ToolPage toolId="task-notes" privacy width="wide">
      <TaskNotesTool />
    </ToolPage>
  )
}
