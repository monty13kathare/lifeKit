import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { PercentageCalculator } from "@/components/tools/calculators/percentage-calculator"

export const metadata: Metadata = {
  title: "Percentage Calculator",
  description: "Percent of a value, increase, decrease, difference, marks and discounts.",
}

export default function PercentageCalculatorPage() {
  return (
    <ToolPage toolId="percentage-calculator" width="narrow">
      <PercentageCalculator />
    </ToolPage>
  )
}
