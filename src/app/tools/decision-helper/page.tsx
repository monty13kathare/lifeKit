import type { Metadata } from "next"
import { DecisionHelperApp } from "@/components/tools/decision-helper/decision-helper-app"

export const metadata: Metadata = {
  title: "Decision Helper",
  description: "Weigh your options with a weighted scoring matrix — saved in your browser.",
}

export default function DecisionHelperPage() {
  return <DecisionHelperApp />
}
