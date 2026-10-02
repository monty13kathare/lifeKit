import type { Metadata } from "next"
import { InfoManager } from "@/components/tools/important-information/info-manager"

export const metadata: Metadata = {
  title: "Important Info",
  description: "Emergency contacts and key personal details, with optional passphrase encryption for sensitive entries.",
}

export default function ImportantInformationPage() {
  return <InfoManager />
}
