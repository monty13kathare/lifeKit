import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { SmartCalculator } from "@/components/tools/calculators/smart-calculator"

export const metadata: Metadata = {
  title: "Smart Calculator",
  description: "Type maths naturally — “20% of 15000”, “15000 + 18%”, “25% off 2000” — plus discount, profit, ratio and average helpers.",
}

export default function SmartCalculatorPage() {
  return (
    <ToolPage toolId="smart-calculator" width="default">
      <SmartCalculator />
    </ToolPage>
  )
}
