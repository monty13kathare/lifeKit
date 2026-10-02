import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { UnitConverter } from "@/components/tools/calculators/unit-converter"

export const metadata: Metadata = {
  title: "Unit Converter",
  description: "Convert length, weight, temperature, area, volume, speed, time and data size.",
}

export default function UnitConverterPage() {
  return (
    <ToolPage toolId="unit-converter" width="narrow">
      <UnitConverter />
    </ToolPage>
  )
}
