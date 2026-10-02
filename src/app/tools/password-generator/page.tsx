import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { PasswordGenerator } from "@/components/tools/password-generator/password-generator"

export const metadata: Metadata = {
  title: "Password Generator",
  description: "Strong random passwords and passphrases, generated securely on your device and never stored.",
}

export default function PasswordGeneratorPage() {
  return (
    <ToolPage toolId="password-generator" width="default" privacy="Generated on your device — never stored">
      <PasswordGenerator />
    </ToolPage>
  )
}
