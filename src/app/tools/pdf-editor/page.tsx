import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { PdfEditor } from "@/components/tools/pdf-editor/pdf-editor"

export const metadata: Metadata = { title: "PDF Editor" }

export default function Page() {
  return (
    <ToolPage toolId="pdf-editor" width="full" privacy>
      <PdfEditor />
    </ToolPage>
  )
}
