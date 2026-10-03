import type { Metadata } from "next"
import { LearnHub } from "@/components/learn/learn-hub"

export const metadata: Metadata = { title: "Learn Skills" }

export default function LearnPage() {
  return <LearnHub />
}
