"use client"

import { useSyncExternalStore } from "react"
import { Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

const noop = () => () => {}

export function useCanShare(): boolean {
  return useSyncExternalStore(
    noop,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false
  )
}

/** Web Share API button; renders nothing where sharing isn't supported. */
export function ShareButton({
  text,
  title = "Shared from LifeKit",
  label = "Share",
  iconOnly,
  className,
}: {
  text: string
  title?: string
  label?: string
  iconOnly?: boolean
  className?: string
}) {
  const canShare = useCanShare()
  if (!canShare) return null
  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? "icon" : "default"}
      aria-label={iconOnly ? label : undefined}
      className={className}
      onClick={async () => {
        try {
          await navigator.share({ title, text })
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return
          toast.error("Couldn't open the share sheet")
        }
      }}
    >
      <Share2 aria-hidden />
      {!iconOnly && label}
    </Button>
  )
}
