"use client"

import { useId } from "react"
import { ArrowLeftRight, ImagePlus, TriangleAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { FileDropzone } from "@/components/common/file-dropzone"
import { MB } from "@/lib/files"
import { ECC_LABELS, contrastRatio, luminanceOf, type EccLevel } from "@/lib/qr/capacity"
import { MAX_LOGO_RATIO, type QrStyle } from "@/lib/qr/render"

const ECC_ITEMS = (Object.keys(ECC_LABELS) as EccLevel[]).map((k) => ({ value: k, label: `${k} · ${ECC_LABELS[k]}` }))

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
        />
        <Input
          id={id}
          value={value}
          maxLength={7}
          spellCheck={false}
          className="font-mono uppercase"
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`
            if (/^#[0-9a-f]{0,6}$/i.test(v)) onChange(v)
          }}
        />
      </div>
    </div>
  )
}

interface QrCustomizeProps {
  style: QrStyle
  onStyle: (patch: Partial<QrStyle>) => void
  hasLogo: boolean
  logoName?: string
  onLogo: (file: File) => void
  onRemoveLogo: () => void
}

export function QrCustomize({ style, onStyle, hasLogo, logoName, onLogo, onRemoveLogo }: QrCustomizeProps) {
  const validColors = /^#[0-9a-f]{6}$/i.test(style.fg) && /^#[0-9a-f]{6}$/i.test(style.bg)
  const ratio = validColors ? contrastRatio(style.fg, style.bg) : 21
  const inverted = validColors && luminanceOf(style.fg) > luminanceOf(style.bg)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <ColorField label="Foreground" value={style.fg} onChange={(fg) => onStyle({ fg })} />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Swap colours"
          onClick={() => onStyle({ fg: style.bg, bg: style.fg })}
        >
          <ArrowLeftRight aria-hidden />
        </Button>
        <ColorField label="Background" value={style.bg} onChange={(bg) => onStyle({ bg })} />
      </div>
      {validColors && (ratio < 4 || inverted) ? (
        <p className="flex gap-2 text-xs text-warning-foreground dark:text-warning" role="status">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {inverted
            ? "Light code on a dark background — many scanners can't read inverted QR codes."
            : `Low contrast (${ratio.toFixed(1)}:1). Use a darker foreground or lighter background so it scans reliably.`}
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Export size</Label>
          <span className="text-sm text-muted-foreground tabular-nums">
            {style.size} × {style.size} px
          </span>
        </div>
        <Slider aria-label="Export size" min={128} max={2048} step={32} value={style.size} onValueChange={(v) => onStyle({ size: v as number })} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Quiet zone (margin)</Label>
          <span className="text-sm text-muted-foreground tabular-nums">{style.margin} modules</span>
        </div>
        <Slider aria-label="Margin" min={0} max={10} step={1} value={style.margin} onValueChange={(v) => onStyle({ margin: v as number })} />
        {style.margin < 2 ? <p className="text-xs text-muted-foreground">A margin of at least 2–4 modules helps scanners find the code.</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label>Error correction</Label>
        <Select items={ECC_ITEMS} value={hasLogo ? "H" : style.ecc} disabled={hasLogo} onValueChange={(v) => v && onStyle({ ecc: v as EccLevel })}>
          <SelectTrigger className="w-full" aria-label="Error correction">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ECC_ITEMS.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {hasLogo ? "High correction is required while a logo covers part of the code." : "Higher correction survives damage but holds less data."}
        </p>
      </div>

      <div className="space-y-2">
        <Label>Logo</Label>
        {hasLogo ? (
          <>
            <div className="flex items-center gap-2 rounded-xl border bg-surface p-2.5">
              <ImagePlus className="size-4 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{logoName}</span>
              <Button size="icon-sm" variant="ghost" aria-label="Remove logo" onClick={onRemoveLogo}>
                <X aria-hidden />
              </Button>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm">Logo size</span>
              <span className="text-sm text-muted-foreground tabular-nums">{Math.round(style.logoRatio * 100)}%</span>
            </div>
            <Slider
              aria-label="Logo size"
              min={0.1}
              max={MAX_LOGO_RATIO}
              step={0.01}
              value={style.logoRatio}
              onValueChange={(v) => onStyle({ logoRatio: v as number })}
            />
          </>
        ) : (
          <FileDropzone compact accept={["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"]} maxBytes={5 * MB} title="Add a logo" hint="PNG or SVG works best" onFiles={([f]) => onLogo(f)} />
        )}
      </div>
    </div>
  )
}
