"use client"

import { ScanLine } from "lucide-react"
import { ScannerWorkspace } from "@/components/tools/scanner/scanner-workspace"
import { QR_FORMATS } from "@/lib/qr/formats"

export function QrScannerTool() {
  return (
    <ScannerWorkspace
      formats={QR_FORMATS}
      viewfinder="square"
      idleTitle="Point your camera at a QR code"
      emptyIcon={ScanLine}
      emptyTitle="Scan a QR code"
      emptyDescription="Start the camera or upload a screenshot. Links are checked for warning signs and never opened automatically."
    />
  )
}
