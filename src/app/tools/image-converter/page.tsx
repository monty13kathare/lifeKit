import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { ImageConverterTool } from "@/components/tools/image-converter/image-converter-tool"

export const metadata: Metadata = { title: "Convert Image" }

export default function Page() {
  return (
    <ToolPage toolId="image-converter" privacy width="wide">
      <ImageConverterTool />
    </ToolPage>
  )
}
