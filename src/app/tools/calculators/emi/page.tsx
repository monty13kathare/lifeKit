import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { EmiCalculator } from "@/components/tools/calculators/emi-calculator"

export const metadata: Metadata = {
  title: "EMI Calculator",
  description: "Monthly EMI, total interest, amortization schedule, prepayment savings and loan comparison.",
}

export default function EmiCalculatorPage() {
  return (
    <ToolPage toolId="emi-calculator" width="default">
      <EmiCalculator />
    </ToolPage>
  )
}
