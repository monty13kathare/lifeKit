"use client"

import { useEffect, useState } from "react"
import { ScanBarcode } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScannerWorkspace } from "@/components/tools/scanner/scanner-workspace"
import { nativeSupportedFormats } from "@/lib/qr/detect"
import { ALL_FORMATS, FORMAT_LABELS, type CodeFormat } from "@/lib/qr/formats"

function SupportedFormats() {
  const [native, setNative] = useState<string[] | null>(null)
  useEffect(() => {
    let alive = true
    void nativeSupportedFormats().then((f) => alive && setNative(f))
    return () => {
      alive = false
    }
  }, [])
  return (
    <section className="rounded-2xl border bg-card p-4 text-sm sm:p-5">
      <h2 className="font-medium">Supported formats</h2>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ALL_FORMATS.map((f) => (
          <Badge key={f} variant="outline">
            {FORMAT_LABELS[f as CodeFormat]}
          </Badge>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {native === null
          ? "Checking your browser…"
          : native.length
            ? `Using your browser's built-in detector (${native.length} formats), with a compatibility reader as backup.`
            : "Your browser has no built-in barcode detector, so a compatibility reader is used. Scanning may be a little slower."}
      </p>
    </section>
  )
}

export function BarcodeScannerTool() {
  return (
    <ScannerWorkspace
      formats={ALL_FORMATS}
      viewfinder="wide"
      idleTitle="Point your camera at a barcode"
      emptyIcon={ScanBarcode}
      emptyTitle="Scan a barcode"
      emptyDescription="Product codes (EAN, UPC), shipping labels (Code 128, ITF), and 2D codes like Data Matrix and PDF417."
      aside={<SupportedFormats />}
    />
  )
}
