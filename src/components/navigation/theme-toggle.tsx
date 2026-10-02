"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useHydrated } from "@/hooks/use-store"

export const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const hydrated = useHydrated()
  const Icon = !hydrated ? Sun : resolvedTheme === "dark" ? Moon : Sun
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Change theme" />}>
        <Icon className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={hydrated ? theme : undefined} onValueChange={(v) => setTheme(v as string)}>
          {THEME_OPTIONS.map(({ value, label, icon: I }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <I className="size-4" /> {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
