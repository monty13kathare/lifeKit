import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { QrGeneratorTool } from "@/components/tools/qr-generator/qr-generator-tool"

export const metadata: Metadata = {
  title: "QR Generator",
  description: "Create QR codes for links, contacts, Wi-Fi, locations and files. Export PNG or SVG.",
}

export default function QrGeneratorPage() {
  return (
    <ToolPage toolId="qr-generator" width="wide" privacy="Generated in your browser — nothing is uploaded">
      <QrGeneratorTool />
    </ToolPage>
  )
}
