"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ArrowLeft, Check, Crop, Loader2, RotateCcw, RotateCw, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { clonePixels, enhancePixels } from "@/lib/scanner/client"
import { pixelsToCanvas } from "@/lib/scanner/image"
import { DEFAULT_ENHANCE, type EnhanceSettings, type FilterMode, type Pixels } from "@/lib/scanner/types"

const FILTERS: { value: FilterMode; label: string; hint: string }[] = [
  { value: "original", label: "Original", hint: "No changes" },
  { value: "auto", label: "Auto", hint: "Brighter, more contrast" },
  { value: "grayscale", label: "Grayscale", hint: "Gray tones" },
  { value: "bw", label: "B&W doc", hint: "Crisp black text" },
]

interface EnhanceEditorProps {
  initial: EnhanceSettings
  /** Downscaled perspective-corrected page used for the live preview. */
  preview: Pixels
  saving: boolean
  onBack: () => void
  onSave: (settings: EnhanceSettings) => void
  backLabel?: string
}

export function EnhanceEditor({ initial, preview, saving, onBack, onSave, backLabel = "Crop" }: EnhanceEditorProps) {
  const [s, setS] = useState<EnhanceSettings>(initial)
  const [rendering, setRendering] = useState(true)
  const [renderError, setRenderError] = useState("")
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const seq = useRef(0)
  const brightId = useId()
  const contrastId = useId()
  const sharpenId = useId()

  // debounced live preview (runs in the worker)
  useEffect(() => {
    const my = ++seq.current
    const t = window.setTimeout(async () => {
      setRendering(true)
      try {
        const out = await enhancePixels(clonePixels(preview), s)
        if (my !== seq.current || !canvasRef.current) return
        pixelsToCanvas(out, canvasRef.current)
        setRenderError("")
      } catch (e) {
        if (my === seq.current) setRenderError(e instanceof Error ? e.message : "Preview failed.")
      } finally {
        if (my === seq.current) setRendering(false)
      }
    }, 120)
    return () => window.clearTimeout(t)
  }, [preview, s])

  const set = <K extends keyof EnhanceSettings>(k: K, v: EnhanceSettings[K]) => setS((prev) => ({ ...prev, [k]: v }))
  const rotate = (dir: 1 | -1) =>
    set("rotation", (((s.rotation + dir * 90) % 360) + 360) % 360 as EnhanceSettings["rotation"])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onBack} disabled={saving}>
          {backLabel === "Crop" ? <Crop aria-hidden /> : <ArrowLeft aria-hidden />} {backLabel}
        </Button>
        <div className="ml-auto flex gap-1">
          <Button variant="outline" size="icon" aria-label="Rotate left" onClick={() => rotate(-1)} disabled={saving}>
            <RotateCcw />
          </Button>
          <Button variant="outline" size="icon" aria-label="Rotate right" onClick={() => rotate(1)} disabled={saving}>
            <RotateCw />
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-48 items-center justify-center rounded-2xl bg-surface-muted p-3 sm:p-5">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Enhanced page preview"
          className="block h-auto max-h-[min(55dvh,600px)] w-auto max-w-full rounded-md bg-card shadow-soft"
        />
        {rendering && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-xs text-muted-foreground shadow-soft">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Updating
          </span>
        )}
      </div>
      {renderError && (
        <p role="alert" className="text-sm text-destructive">
          {renderError}
        </p>
      )}

      <div role="radiogroup" aria-label="Filter" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={s.filter === f.value}
            onClick={() => set("filter", f.value)}
            className={cn(
              "min-h-12 rounded-xl border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              s.filter === f.value ? "border-primary bg-primary/10" : "bg-card hover:bg-muted"
            )}
          >
            <span className="block text-sm font-medium">{f.label}</span>
            <span className="block text-xs text-muted-foreground">{f.hint}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label id={brightId}>Brightness</Label>
            <span className="text-sm text-muted-foreground tabular-nums">{s.brightness}</span>
          </div>
          <Slider
            aria-labelledby={brightId}
            min={-100}
            max={100}
            step={1}
            value={s.brightness}
            onValueChange={(v) => set("brightness", v as number)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label id={contrastId}>Contrast</Label>
            <span className="text-sm text-muted-foreground tabular-nums">{s.contrast}</span>
          </div>
          <Slider
            aria-labelledby={contrastId}
            min={-100}
            max={100}
            step={1}
            value={s.contrast}
            onValueChange={(v) => set("contrast", v as number)}
          />
        </div>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <Label htmlFor={sharpenId} className="flex-1">
            Sharpen text
          </Label>
          <Switch id={sharpenId} aria-label="Sharpen text" checked={s.sharpen} onCheckedChange={(v) => set("sharpen", v)} />
        </div>
        <div className="sm:col-span-2">
          <Button
            variant="ghost"
            onClick={() => setS({ ...DEFAULT_ENHANCE, filter: s.filter, rotation: s.rotation })}
          >
            <Undo2 aria-hidden /> Reset adjustments
          </Button>
        </div>
      </div>

      <Button size="lg" className="w-full sm:w-auto" disabled={saving} onClick={() => onSave(s)}>
        {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
        {saving ? "Saving page…" : "Save page"}
      </Button>
    </div>
  )
}
