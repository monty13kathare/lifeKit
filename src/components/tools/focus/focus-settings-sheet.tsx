"use client"

import { useId, useState } from "react"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { resetFocusCycle } from "@/lib/focus"
import type { FocusSettings } from "@/types"

interface FocusSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: FocusSettings
  onChange: (patch: Partial<FocusSettings>) => void
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)))

function NumberSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit: string
  onChange: (n: number) => void
}) {
  const id = useId()
  // Free-typing draft; committed when it parses into range, normalised on blur.
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex items-center gap-1.5">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step}
            value={draft ?? String(value)}
            onChange={(e) => {
              setDraft(e.target.value)
              const n = Number(e.target.value)
              if (e.target.value !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(Math.round(n))
            }}
            onBlur={() => {
              if (draft !== null && draft !== "" && Number.isFinite(Number(draft))) onChange(clamp(Number(draft), min, max))
              setDraft(null)
            }}
            aria-describedby={`${id}-range`}
            className="h-10 w-20 text-right tabular-nums"
          />
          <span className="w-8 text-sm text-muted-foreground">{unit}</span>
          <span id={`${id}-range`} className="sr-only">
            {min} to {max}
          </span>
        </div>
      </div>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        thumbLabel={label}
        onValueChange={(v) => onChange(clamp(v as number, min, max))}
      />
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={(v) => onChange(v)} />
    </div>
  )
}

export function FocusSettingsSheet({ open, onOpenChange, settings, onChange }: FocusSettingsSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Timer settings"
      description="Changes apply from the next phase."
      footer={<Button onClick={() => onOpenChange(false)}>Done</Button>}
    >
      <div className="space-y-5">
        <NumberSlider label="Focus" unit="min" value={settings.focusMinutes} min={1} max={120} onChange={(n) => onChange({ focusMinutes: n })} />
        <NumberSlider label="Short break" unit="min" value={settings.shortBreakMinutes} min={1} max={30} onChange={(n) => onChange({ shortBreakMinutes: n })} />
        <NumberSlider label="Long break" unit="min" value={settings.longBreakMinutes} min={1} max={60} onChange={(n) => onChange({ longBreakMinutes: n })} />
        <NumberSlider
          label="Sessions before long break"
          unit=""
          value={settings.sessionsBeforeLongBreak}
          min={2}
          max={8}
          onChange={(n) => onChange({ sessionsBeforeLongBreak: n })}
        />
        <NumberSlider
          label="Daily goal"
          unit="min"
          value={settings.dailyGoalMinutes}
          min={15}
          max={600}
          step={15}
          onChange={(n) => onChange({ dailyGoalMinutes: n })}
        />
        <Separator />
        <ToggleRow label="Auto-start breaks" checked={settings.autoStartBreaks} onChange={(v) => onChange({ autoStartBreaks: v })} />
        <ToggleRow label="Auto-start focus" hint="Start the next session when a break ends." checked={settings.autoStartFocus} onChange={(v) => onChange({ autoStartFocus: v })} />
        <ToggleRow label="Sound" hint="Play a chime when a phase ends." checked={settings.sound} onChange={(v) => onChange({ sound: v })} />
        <Separator />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Reset cycle</p>
            <p className="text-xs text-muted-foreground">Stop the timer and start counting toward a long break again.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              resetFocusCycle()
              toast("Cycle reset")
            }}
          >
            <RotateCcw aria-hidden />
            Reset
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  )
}
