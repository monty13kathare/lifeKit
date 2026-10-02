import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { PdfScanner } from "@/components/tools/pdf-scanner/pdf-scanner"

export const metadata: Metadata = { title: "PDF Scanner" }

export default function PdfScannerPage() {
  return (
    <ToolPage toolId="pdf-scanner" privacy width="wide">
      <PdfScanner />
    </ToolPage>
  )
}
