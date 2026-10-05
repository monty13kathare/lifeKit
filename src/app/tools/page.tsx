import type { Metadata } from "next"
import { ToolsDirectory } from "@/components/tools/directory/tools-directory"

export const metadata: Metadata = { title: "Tools" }

export default function ToolsPage() {
  return <ToolsDirectory />
}
