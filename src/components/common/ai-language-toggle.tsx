"use client"

import { Languages } from "lucide-react"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useSettings } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { cn } from "@/lib/utils"
import type { AiLanguage } from "@/types"

const OPTIONS: { value: AiLanguage; label: string; lang: string }[] = [
  { value: "en", label: "English", lang: "en" },
  { value: "hi", label: "हिन्दी", lang: "hi" },
]

/**
 * Switch the language AI writes in (English or Hindi). Stored in settings and
 * sent with every AI request. Hidden when no AI key is configured.
 */
export function AiLanguageToggle({ className, showLabel = true }: { className?: string; showLabel?: boolean }) {
  const ai = useAiStatus()
  const hydrated = useHydrated()
  const { settings, update } = useSettings()
  if (!ai?.configured) return null
  const current = hydrated ? settings.aiLanguage : "en"

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showLabel && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Languages className="size-3.5" aria-hidden /> AI language
        </span>
      )}
      <div role="radiogroup" aria-label="AI language" className="flex rounded-lg bg-muted p-0.5 text-xs">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            lang={o.lang}
            aria-checked={current === o.value}
            onClick={() => update({ aiLanguage: o.value })}
            className={cn(
              "min-h-10 rounded-md px-3 font-medium transition-colors",
              current === o.value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
