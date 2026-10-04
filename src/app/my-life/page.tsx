import type { Metadata } from "next"
import { MyLife } from "@/components/dashboard/my-life"

export const metadata: Metadata = { title: "My Day" }

export default function MyLifePage() {
  return <MyLife />
}
