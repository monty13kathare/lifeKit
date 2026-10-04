import {
  GraduationCap,
  House,
  LayoutGrid,
  Ellipsis,
  ListTodo,
  Scan,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { TOOLS } from "@/data/tools"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** If true, renders as the raised FAB-style center button */
  isFab?: boolean
}

export const NAV = {
  home: { href: "/", label: "Home", icon: House },
  tools: { href: "/tools", label: "Tools", icon: LayoutGrid },
  tasks: { href: "/tools/todo", label: "Tasks", icon: ListTodo },
  life: { href: "/my-life", label: "My Day", icon: Sparkles },
  learn: { href: "/learn", label: "Learn", icon: GraduationCap },
  scan: { href: "/scan", label: "Scan", icon: Scan },
  settings: { href: "/settings", label: "Settings", icon: Settings },
  more: { href: "/more", label: "More", icon: Ellipsis },
} satisfies Record<string, NavItem>

export const DESKTOP_NAV: NavItem[] = [NAV.home, NAV.tools, NAV.life, NAV.learn, NAV.settings]
/** Mobile bottom bar: Home | Tools | My Day | Learn */
export const MOBILE_NAV: NavItem[] = [NAV.home, NAV.tools, NAV.life, NAV.learn]

/** Which top-level nav item a pathname belongs to. */
export function activeNavHref(pathname: string): string {
  if (pathname === "/") return "/"
  if (pathname.startsWith("/scan")) return "/tools"
  if (pathname.startsWith("/my-life") || pathname.startsWith("/tools/goal-planner")) return "/my-life"
  if (pathname.startsWith("/learn")) return "/learn"
  if (pathname.startsWith("/settings")) return "/settings"
  if (pathname.startsWith("/more")) return "/more"
  const tool = TOOLS.find((t) => pathname === t.href || pathname.startsWith(t.href + "/"))
  if (tool?.section === "life") return "/my-life"
  if (pathname.startsWith("/tools")) return "/tools"
  return pathname
}

