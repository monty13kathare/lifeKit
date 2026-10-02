"use client"

import { useId, useState } from "react"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import type { PageNumberFormat, PageNumberPosition, PageNumberSettings, WatermarkSettings } from "@/lib/pdf/edit"
import { ColorSwatches } from "./tool-options"
import { INK_COLORS } from "./types"

const WATERMARK_COLORS = [
  { value: "#dc2626", label: "Red" },
  { value: "#6b7280", label: "Grey" },
  { value: "#1d4ed8", label: "Blue" },
  { value: "#111827", label: "Black" },
]

const watermarkText = z.string().max(80, "Keep the watermark under 80 characters.")
const startNumber = z.coerce.number().int("Use a whole number.").min(0, "Use 0 or more.").max(99999, "That number is too large.")

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-destructive">{hint}</p> : null}
    </div>
  )
}

function SectionHeader({ title, description, checked, onChange, id }: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-label={`Enable ${title.toLowerCase()}`} className="mt-1" />
    </div>
  )
}

export function WatermarkForm({ value, onChange }: { value: WatermarkSettings; onChange: (v: WatermarkSettings) => void }) {
  const id = useId()
  const [error, setError] = useState<string | undefined>()
  const set = (patch: Partial<WatermarkSettings>) => onChange({ ...value, ...patch })
  return (
    <section className="space-y-4">
      <SectionHeader id={`${id}-on`} title="Watermark" description="Stamp text across every page." checked={value.enabled} onChange={(enabled) => set({ enabled })} />
      {value.enabled && (
        <div className="space-y-4">
          <Field label="Text" htmlFor={`${id}-text`} hint={error}>
            <Input
              id={`${id}-text`}
              value={value.text}
              maxLength={80}
              aria-invalid={!!error}
              onChange={(e) => {
                const r = watermarkText.safeParse(e.target.value)
                setError(r.success ? undefined : r.error.issues[0]?.message)
                if (r.success) set({ text: r.data })
              }}
            />
          </Field>
          <Field label={`Opacity · ${Math.round(value.opacity * 100)}%`}>
            <Slider aria-label="Watermark opacity" min={5} max={100} step={5} value={Math.round(value.opacity * 100)} onValueChange={(v) => set({ opacity: (v as number) / 100 })} />
          </Field>
          <Field label={`Size · ${value.fontSize} pt`}>
            <Slider aria-label="Watermark size" min={16} max={160} step={2} value={value.fontSize} onValueChange={(v) => set({ fontSize: v as number })} />
          </Field>
          <Field label={`Angle · ${value.angle}°`}>
            <Slider aria-label="Watermark angle" min={-90} max={90} step={5} value={value.angle} onValueChange={(v) => set({ angle: v as number })} />
          </Field>
          <Field label="Colour">
            <ColorSwatches label="Watermark colour" value={value.color} colors={WATERMARK_COLORS} onChange={(color) => set({ color })} />
          </Field>
        </div>
      )}
    </section>
  )
}

const positionItems: { value: PageNumberPosition; label: string }[] = [
  { value: "bottom-center", label: "Bottom centre" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-center", label: "Top centre" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
]

const formatItems: { value: PageNumberFormat; label: string }[] = [
  { value: "n", label: "1" },
  { value: "page-n", label: "Page 1" },
  { value: "n-of-total", label: "1 / N" },
  { value: "page-n-of-total", label: "Page 1 of N" },
]

export function PageNumbersForm({ value, onChange }: { value: PageNumberSettings; onChange: (v: PageNumberSettings) => void }) {
  const id = useId()
  const [startText, setStartText] = useState(String(value.start))
  const [error, setError] = useState<string | undefined>()
  const set = (patch: Partial<PageNumberSettings>) => onChange({ ...value, ...patch })
  return (
    <section className="space-y-4">
      <SectionHeader id={`${id}-on`} title="Page numbers" description="Number pages in their final order." checked={value.enabled} onChange={(enabled) => set({ enabled })} />
      {value.enabled && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Position">
              <Select items={positionItems} value={value.position} onValueChange={(v) => v && set({ position: v as PageNumberPosition })}>
                <SelectTrigger className="w-full" aria-label="Page number position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {positionItems.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Format">
              <Select items={formatItems} value={value.format} onValueChange={(v) => v && set({ format: v as PageNumberFormat })}>
                <SelectTrigger className="w-full" aria-label="Page number format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatItems.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start at" htmlFor={`${id}-start`} hint={error}>
              <Input
                id={`${id}-start`}
                inputMode="numeric"
                value={startText}
                aria-invalid={!!error}
                onChange={(e) => {
                  setStartText(e.target.value)
                  const r = startNumber.safeParse(e.target.value.trim() === "" ? NaN : e.target.value)
                  setError(r.success ? undefined : (r.error.issues[0]?.message ?? "Enter a number."))
                  if (r.success) set({ start: r.data })
                }}
              />
            </Field>
            <Field label={`Size · ${value.fontSize} pt`}>
              <div className="flex h-10 items-center">
                <Slider aria-label="Page number size" min={6} max={24} step={1} value={value.fontSize} onValueChange={(v) => set({ fontSize: v as number })} />
              </div>
            </Field>
          </div>
          <Field label="Colour">
            <ColorSwatches label="Page number colour" value={value.color} colors={INK_COLORS.slice(0, 4)} onChange={(color) => set({ color })} />
          </Field>
        </div>
      )}
    </section>
  )
}
