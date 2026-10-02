import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { SecureShare } from "@/components/tools/secure-share/secure-share"

export const metadata: Metadata = {
  title: "SecureShare",
  description: "Encrypt files in your browser into a password-protected package with an expiry, then share it yourself.",
}

export default function SecureSharePage() {
  return (
    <ToolPage toolId="secure-share" width="default" privacy="Files are encrypted in your browser">
      <SecureShare />
    </ToolPage>
  )
}
