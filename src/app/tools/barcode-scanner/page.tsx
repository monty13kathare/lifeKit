import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { BarcodeScannerTool } from "@/components/tools/barcode-scanner/barcode-scanner-tool"

export const metadata: Metadata = {
  title: "Barcode Scanner",
  description: "Read EAN, UPC, Code 128, Data Matrix, PDF417 and more with your camera or an image.",
}

export default function BarcodeScannerPage() {
  return (
    <ToolPage toolId="barcode-scanner" width="wide" privacy="Scanned in your browser — nothing is uploaded">
      <BarcodeScannerTool />
    </ToolPage>
  )
}
