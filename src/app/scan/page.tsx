import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { ScanEverything } from "@/components/tools/scan/scan-everything"

export const metadata: Metadata = {
  title: "Scan",
  description: "One camera for QR codes, barcodes and text.",
}

export default function ScanPage() {
  return (
    <ToolPage toolId="scan" width="wide" backHref="/tools" privacy="Scanned in your browser — nothing is uploaded">
      <ScanEverything />
    </ToolPage>
  )
}
