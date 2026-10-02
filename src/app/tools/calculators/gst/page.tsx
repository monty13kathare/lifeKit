import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { GstCalculator } from "@/components/tools/calculators/gst-calculator"

export const metadata: Metadata = {
  title: "GST Calculator",
  description: "Add or remove GST with CGST/SGST or IGST breakdown.",
}

export default function GstCalculatorPage() {
  return (
    <ToolPage toolId="gst-calculator" width="narrow">
      <GstCalculator />
    </ToolPage>
  )
}
