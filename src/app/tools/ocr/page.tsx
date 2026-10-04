import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { OcrTool } from "@/components/tools/ocr/ocr-tool"

export const metadata: Metadata = {
  title: "OCR",
  description: "Extract text from photos, screenshots and PDF pages in your browser.",
}

export default function OcrPage() {
  return (
    <ToolPage toolId="ocr" width="wide" privacy="On-device mode keeps your image in your browser">
      <OcrTool />
    </ToolPage>
  )
}
