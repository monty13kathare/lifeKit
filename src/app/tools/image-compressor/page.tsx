import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { ImageCompressorTool } from "@/components/tools/image-compressor/image-compressor-tool"

export const metadata: Metadata = { title: "Compress Image" }

export default function Page() {
  return (
    <ToolPage toolId="image-compressor" privacy width="wide">
      <ImageCompressorTool />
    </ToolPage>
  )
}
