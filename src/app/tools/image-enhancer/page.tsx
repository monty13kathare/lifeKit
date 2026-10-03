import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { ImageEnhancerTool } from "@/components/tools/image-enhancer/image-enhancer-tool"

export const metadata: Metadata = {
  title: "AI Image Enhancer · Ultra HD Upscaler",
  description: "Restore, deblur and upscale old or bad-quality photos to Ultra HD with AI.",
}

export default function Page() {
  return (
    <ToolPage toolId="image-enhancer" privacy width="wide">
      <ImageEnhancerTool />
    </ToolPage>
  )
}
