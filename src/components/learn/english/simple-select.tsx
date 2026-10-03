"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface SimpleSelectProps<T extends string> {
  id: string
  label: string
  value: T
  items: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean
}

/** Labelled Base UI select for a short list of string options. */
export function SimpleSelect<T extends string>({ id, label, value, items, onChange, className, hideLabel }: SimpleSelectProps<T>) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className={hideLabel ? "sr-only" : "text-xs text-muted-foreground"}>
        {label}
      </Label>
      <Select items={items} value={value} onValueChange={(v) => v && onChange(v as T)}>
        <SelectTrigger id={id} className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((it) => (
            <SelectItem key={it.value} value={it.value}>
              {it.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
