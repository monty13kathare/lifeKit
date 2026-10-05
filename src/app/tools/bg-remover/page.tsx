import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { BgRemoverTool } from "@/components/tools/bg-remover/bg-remover-tool"

export const metadata: Metadata = {
  title: "AI Background Remover",
  description: "Remove the background from any photo instantly using on-device AI.",
}

export default function Page() {
  return (
    <ToolPage toolId="bg-remover">
      <BgRemoverTool />
    </ToolPage>
  )
}
