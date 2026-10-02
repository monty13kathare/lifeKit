import { Briefcase, Car, Folder, GraduationCap, House, Plane, Siren, Users, type LucideIcon } from "lucide-react"
import type { InfoCategory } from "@/types"

export const INFO_CATEGORIES: { id: InfoCategory; label: string; icon: LucideIcon }[] = [
  { id: "emergency", label: "Emergency", icon: Siren },
  { id: "family", label: "Family", icon: Users },
  { id: "work", label: "Work", icon: Briefcase },
  { id: "school", label: "School", icon: GraduationCap },
  { id: "vehicle", label: "Vehicle", icon: Car },
  { id: "home", label: "Home", icon: House },
  { id: "travel", label: "Travel", icon: Plane },
  { id: "other", label: "Other", icon: Folder },
]

export const categoryMeta = (id: InfoCategory) => INFO_CATEGORIES.find((c) => c.id === id) ?? INFO_CATEGORIES[INFO_CATEGORIES.length - 1]

/** Keep only characters a dialer understands. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+*#]/g, "")}`

/** Heuristic: does free text look like it holds secrets (IDs, PINs, account numbers)? */
export function looksSensitive(text: string): boolean {
  return /\b(password|passcode|pin|cvv|otp|account\s*(no|number)|acct|ifsc|aadhaar|aadhar|pan\b|passport|ssn|social security|policy\s*(no|number)|licen[cs]e\s*(no|number)|card\s*(no|number))\b/i.test(text) || /\d{4}[\s-]?\d{4}[\s-]?\d{4}/.test(text)
}
