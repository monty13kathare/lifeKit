"use client"

import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import type { Annotation } from "@/lib/pdf/edit"
import { cn } from "@/lib/utils"
import { FONT_SIZES, HIGHLIGHT_COLORS, INK_COLORS, type Tool, type ToolSettings } from "./types"

interface SwatchProps {
  label: string
  value: string
  colors: { value: string; label: string }[]
  onChange: (v: string) => void
  compact?: boolean
}

export function ColorSwatches({ label, value, colors, onChange, compact }: SwatchProps) {
  const known = colors.some((c) => c.value.toLowerCase() === value.toLowerCase())
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex items-center gap-1", compact ? "flex-nowrap" : "flex-wrap")}>
      {colors.map((c) => {
        const active = c.value.toLowerCase() === value.toLowerCase()
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c.label}
            onClick={() => onChange(c.value)}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full border-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              "size-10",
              active ? "border-primary" : "border-transparent hover:border-border"
            )}
          >
            <span className="size-6 rounded-full ring-1 ring-black/15" style={{ backgroundColor: c.value }} />
          </button>
        )
      })}
      <label
        className={cn(
          "relative flex shrink-0 cursor-pointer items-center justify-center rounded-full border-2 focus-within:ring-3 focus-within:ring-ring/50",
          "size-10",
          !known ? "border-primary" : "border-transparent hover:border-border"
        )}
      >
        <span
          className="size-6 rounded-full ring-1 ring-black/15"
          style={{ background: known ? "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" : value }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          aria-label={`Custom ${label.toLowerCase()}`}
        />
      </label>
    </div>
  )
}

const fontItems = FONT_SIZES.map((s) => ({ value: String(s), label: `${s} pt` }))

function FontSizeSelect({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const items = fontItems.some((i) => i.value === String(value))
    ? fontItems
    : [...fontItems, { value: String(value), label: `${value} pt` }]
  return (
    <Select items={items} value={String(value)} onValueChange={(v) => v && onChange(Number(v))}>
      <SelectTrigger className="w-28" aria-label="Font size">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const TYPE_LABEL: Record<Annotation["type"], string> = {
  text: "Text",
  "text-replace": "Replaced text",
  ink: "Drawing",
  highlight: "Highlight",
  image: "Signature",
}

interface ToolOptionsProps {
  tool: Tool
  settings: ToolSettings
  onSettings: (patch: Partial<ToolSettings>) => void
  selected: Annotation | null
  onUpdateSelected: (patch: Partial<Annotation>) => void
  onDeleteSelected: () => void
  onEditSelected: () => void
  /** Single-row layout for the mobile contextual bar. */
  compact?: boolean
}

export function ToolOptions({
  tool,
  settings,
  onSettings,
  selected,
  onUpdateSelected,
  onDeleteSelected,
  onEditSelected,
  compact,
}: ToolOptionsProps) {
  const row = compact ? "flex items-center gap-2" : "space-y-2"
  const labelCls = compact ? "sr-only" : "text-xs font-medium text-muted-foreground"

  if (selected) {
    return (
      <div className={cn(compact ? "flex items-center gap-2 overflow-x-auto" : "space-y-4")}>
        {!compact && <p className="text-sm font-medium">Selected: {TYPE_LABEL[selected.type]}</p>}
        {(selected.type === "text" || selected.type === "text-replace") && (
          <>
            <div className={row}>
              <span className={labelCls}>Colour</span>
              <ColorSwatches
                compact={compact}
                label="Text colour"
                value={selected.color}
                colors={INK_COLORS}
                onChange={(color) => {
                  onUpdateSelected({ color })
                  onSettings({ textColor: color })
                }}
              />
            </div>
            <div className={row}>
              <span className={labelCls}>Size</span>
              <FontSizeSelect
                value={selected.fontSize}
                onChange={(fontSize) => {
                  onUpdateSelected({ fontSize })
                  onSettings({ fontSize })
                }}
              />
            </div>
          </>
        )}
        {(selected.type === "ink" || selected.type === "highlight") && (
          <div className={row}>
            <span className={labelCls}>Colour</span>
            <ColorSwatches
              compact={compact}
              label={selected.type === "ink" ? "Pen colour" : "Highlight colour"}
              value={selected.color}
              colors={selected.type === "ink" ? INK_COLORS : HIGHLIGHT_COLORS}
              onChange={(color) => onUpdateSelected({ color })}
            />
          </div>
        )}
        {selected.type === "image" && !compact && (
          <p className="text-xs text-muted-foreground">Drag to move. Drag the corner handle to resize.</p>
        )}
        <div className={cn("flex shrink-0 gap-2", !compact && "pt-1")}>
          {(selected.type === "text" || selected.type === "text-replace") && (
            <Button variant="outline" size={compact ? "icon" : "default"} onClick={onEditSelected} aria-label="Edit text">
              <Pencil aria-hidden />
              {!compact && "Edit text"}
            </Button>
          )}
          <Button
            variant="destructive"
            size={compact ? "icon" : "default"}
            onClick={onDeleteSelected}
            aria-label={`Delete ${TYPE_LABEL[selected.type].toLowerCase()}`}
          >
            <Trash2 aria-hidden />
            {!compact && "Delete"}
          </Button>
        </div>
      </div>
    )
  }

  if (tool === "edit-text") {
    return (
      <div className={cn(compact ? "flex items-center gap-2 overflow-x-auto" : "space-y-3")}>
        {compact && <p className="py-2 text-xs text-muted-foreground">Tap any text on the page and type to change it.</p>}
        {!compact && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Pencil className="size-3.5 text-primary" /> Edit text in place
            </p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Click any heading, line or paragraph on the page.</li>
              <li>Type your changes right there — the original font, size and colour are kept.</li>
              <li>Click anywhere outside the text to save (or Ctrl+Enter). Esc cancels.</li>
              <li>To change colour or size, switch to Select and click the edited text.</li>
            </ol>
            <p>Only the lines you change are replaced; everything else stays exactly as it was.</p>
          </div>
        )}
      </div>
    )
  }

  if (tool === "text") {
    return (
      <div className={cn(compact ? "flex items-center gap-2 overflow-x-auto" : "space-y-4")}>
        <div className={row}>
          <span className={labelCls}>Colour</span>
          <ColorSwatches compact={compact} label="Text colour" value={settings.textColor} colors={INK_COLORS} onChange={(textColor) => onSettings({ textColor })} />
        </div>
        <div className={row}>
          <span className={labelCls}>Size</span>
          <FontSizeSelect value={settings.fontSize} onChange={(fontSize) => onSettings({ fontSize })} />
        </div>
        {!compact && <p className="text-xs text-muted-foreground">Click on the page to add text. Click selected text again to edit it.</p>}
      </div>
    )
  }

  if (tool === "draw") {
    return (
      <div className={cn(compact ? "flex items-center gap-3 overflow-x-auto" : "space-y-4")}>
        <div className={row}>
          <span className={labelCls}>Colour</span>
          <ColorSwatches compact={compact} label="Pen colour" value={settings.penColor} colors={INK_COLORS} onChange={(penColor) => onSettings({ penColor })} />
        </div>
        <div className={cn(row, compact && "min-w-24 flex-1")}>
          {compact ? (
            <span className="sr-only">Thickness</span>
          ) : (
            <Label className="text-xs font-medium text-muted-foreground">Thickness · {settings.penWidth} pt</Label>
          )}
          <Slider
            aria-label="Pen thickness"
            min={1}
            max={12}
            step={0.5}
            value={settings.penWidth}
            onValueChange={(v) => onSettings({ penWidth: v as number })}
          />
        </div>
      </div>
    )
  }

  if (tool === "highlight") {
    return (
      <div className={cn(compact ? "flex items-center gap-2 overflow-x-auto" : "space-y-4")}>
        <div className={row}>
          <span className={labelCls}>Colour</span>
          <ColorSwatches
            compact={compact}
            label="Highlight colour"
            value={settings.highlightColor}
            colors={HIGHLIGHT_COLORS}
            onChange={(highlightColor) => onSettings({ highlightColor })}
          />
        </div>
        {!compact && <p className="text-xs text-muted-foreground">Drag across the page to highlight an area.</p>}
      </div>
    )
  }

  return compact ? null : (
    <p className="text-sm text-muted-foreground">Click an annotation to select, move or delete it. Pick a tool above to add something new.</p>
  )
}
