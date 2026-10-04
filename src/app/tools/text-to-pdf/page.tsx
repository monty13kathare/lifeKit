import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { TextToPdfTool } from "@/components/tools/text-to-pdf/text-to-pdf-tool"

export const metadata: Metadata = {
  title: "Text to PDF",
  description: "Convert rich text, notes and AI-formatted content into a professional PDF.",
}

export default function TextToPdfPage() {
  return (
    <ToolPage toolId="text-to-pdf" width="wide" privacy="Your document is generated securely in your browser">
      <TextToPdfTool />
    </ToolPage>
  )
}
