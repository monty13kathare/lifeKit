import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { QrScannerTool } from "@/components/tools/qr-scanner/qr-scanner-tool"

export const metadata: Metadata = {
  title: "QR Scanner",
  description: "Scan QR codes with your camera or from an image, with link safety checks.",
}

export default function QrScannerPage() {
  return (
    <ToolPage toolId="qr-scanner" width="wide" privacy="Scanned in your browser — nothing is uploaded">
      <QrScannerTool />
    </ToolPage>
  )
}
