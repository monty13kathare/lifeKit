import { Ellipsis, GraduationCap, House, LayoutGrid, Scan, Settings, Sparkles, type LucideIcon } from "lucide-react"
import { TOOLS } from "@/data/tools"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV = {
  home: { href: "/", label: "Home", icon: House },
  tools: { href: "/tools", label: "Tools", icon: LayoutGrid },
  life: { href: "/my-life", label: "My Life", icon: Sparkles },
  learn: { href: "/learn", label: "Learn", icon: GraduationCap },
  scan: { href: "/scan", label: "Scan", icon: Scan },
  settings: { href: "/settings", label: "Settings", icon: Settings },
  more: { href: "/more", label: "More", icon: Ellipsis },
} satisfies Record<string, NavItem>

export const DESKTOP_NAV: NavItem[] = [NAV.home, NAV.tools, NAV.life, NAV.learn, NAV.scan, NAV.settings]
export const MOBILE_NAV: NavItem[] = [NAV.home, NAV.tools, NAV.scan, NAV.life, NAV.more]

/** Which top-level nav item a pathname belongs to. */
export function activeNavHref(pathname: string): string {
  if (pathname === "/") return "/"
  if (pathname.startsWith("/scan")) return "/scan"
  if (pathname.startsWith("/my-life")) return "/my-life"
  if (pathname.startsWith("/learn")) return "/learn"
  if (pathname.startsWith("/settings")) return "/settings"
  if (pathname.startsWith("/more")) return "/more"
  const tool = TOOLS.find((t) => pathname === t.href || pathname.startsWith(t.href + "/"))
  if (tool?.section === "life") return "/my-life"
  if (pathname.startsWith("/tools")) return "/tools"
  return pathname
}
