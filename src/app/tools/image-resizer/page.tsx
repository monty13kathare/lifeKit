import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { ImageResizerTool } from "@/components/tools/image-resizer/image-resizer-tool"

export const metadata: Metadata = { title: "Resize Image" }

export default function Page() {
  return (
    <ToolPage toolId="image-resizer" privacy width="wide">
      <ImageResizerTool />
    </ToolPage>
  )
}
