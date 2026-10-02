"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

interface CopyButtonProps extends Omit<React.ComponentProps<typeof Button>, "onClick"> {
  value: string
  label?: string
  /** Icon-only button (label used as aria-label). */
  iconOnly?: boolean
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

export function CopyButton({ value, label = "Copy", iconOnly, variant = "outline", size, ...props }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (iconOnly ? "icon" : "default")}
      aria-label={iconOnly ? label : undefined}
      disabled={!value || props.disabled}
      onClick={async () => {
        if (await copyText(value)) {
          setCopied(true)
          toast.success("Copied to clipboard")
          setTimeout(() => setCopied(false), 1500)
        } else {
          toast.error("Couldn't access the clipboard")
        }
      }}
      {...props}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {!iconOnly && (copied ? "Copied" : label)}
    </Button>
  )
}
