import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { ImageToPdfTool } from "@/components/tools/image-to-pdf/image-to-pdf-tool"

export const metadata: Metadata = { title: "Image to PDF" }

export default function Page() {
  return (
    <ToolPage toolId="image-to-pdf" privacy width="wide">
      <ImageToPdfTool />
    </ToolPage>
  )
}
