import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { SecureShare } from "@/components/tools/secure-share/secure-share"

export const metadata: Metadata = {
  title: "SecureShare — Zero-Knowledge Public File Sharing",
  description: "Upload multiple images, videos, PDFs and files to generate end-to-end encrypted share links with expiry.",
}

export default function SecureSharePage() {
  return (
    <ToolPage toolId="secure-share" width="default" privacy="Files are encrypted in your browser">
      <SecureShare />
    </ToolPage>
  )
}
