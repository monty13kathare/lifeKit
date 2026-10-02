import type { Metadata } from "next"
import { MyLife } from "@/components/dashboard/my-life"

export const metadata: Metadata = { title: "My Life" }

export default function MyLifePage() {
  return <MyLife />
}
