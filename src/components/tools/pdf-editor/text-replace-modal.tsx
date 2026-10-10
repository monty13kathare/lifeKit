"use client"

import { useState } from "react"
import { Bold, Check, Eraser, FilePenLine, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { replaceFontCss } from "@/lib/pdf/edit"
import { cn } from "@/lib/utils"

export interface TextReplaceValues {
  text: string
  fontSize: number
  fontFamily: "sans" | "serif" | "mono"
  fontWeight: "normal" | "bold"
  /** Draw with the PDF's own embedded font. */
  useOriginalFont: boolean
  textColor: string
  bgColor: string
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

interface TextReplaceModalProps {
  open: boolean
  onClose: () => void
  originalText: string
  initialValues: TextReplaceValues
  /** The original embedded font, when the browser has it loaded. */
  originalFont?: { face: string; fallback?: string; name?: string }
  onApply: (values: TextReplaceValues) => void
  onErase?: () => void
}

export function TextReplaceModal({
  open,
  onClose,
  originalText,
  initialValues,
  originalFont,
  onApply,
  onErase,
}: TextReplaceModalProps) {
  const [text, setText] = useState(initialValues.text)
  const [fontSize, setFontSize] = useState(initialValues.fontSize)
  const [fontFamily, setFontFamily] = useState<"sans" | "serif" | "mono">(initialValues.fontFamily)
  const [fontWeight, setFontWeight] = useState<"normal" | "bold">(initialValues.fontWeight)
  const [useOriginalFont, setUseOriginalFont] = useState(Boolean(originalFont) && initialValues.useOriginalFont)
  const [textColor, setTextColor] = useState(initialValues.textColor)
  const [bgColor, setBgColor] = useState(initialValues.bgColor)

  // State is seeded from `initialValues` on mount; the parent remounts this
  // modal (via `key`) for each new target, so no syncing effect is needed.

  // Typed hex values may be half-finished; fall back to the matched colours.
  const safeTextColor = HEX_COLOR.test(textColor) ? textColor : initialValues.textColor
  const safeBgColor = HEX_COLOR.test(bgColor) ? bgColor : initialValues.bgColor
  const safeFontSize = Number.isFinite(fontSize) ? Math.min(300, Math.max(1, fontSize)) : initialValues.fontSize

  const handleApply = (e?: React.FormEvent) => {
    e?.preventDefault()
    onApply({
      text,
      fontSize: safeFontSize,
      fontFamily,
      fontWeight,
      useOriginalFont,
      textColor: safeTextColor,
      bgColor: safeBgColor,
    })
    onClose()
  }

  const handleErase = () => {
    if (onErase) {
      onErase()
    } else {
      onApply({
        text: "",
        fontSize: safeFontSize,
        fontFamily,
        fontWeight,
        useOriginalFont,
        textColor: safeTextColor,
        bgColor: safeBgColor,
      })
    }
    onClose()
  }

  const fontCss = replaceFontCss({
    fontFace: originalFont?.face,
    fontFallback: originalFont?.fallback,
    fontFamily,
    useOriginalFont,
  })
  const originalName = originalFont?.name?.replace(/^[A-Z]{6}\+/, "") || "Original"

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FilePenLine className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Text options</DialogTitle>
              <DialogDescription className="text-xs">
                Font, size and colour are matched to the original text.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleApply} noValidate className="space-y-4 pt-1">
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary">
            <Check className="size-4 shrink-0 text-primary" />
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium">
              <span>Matched:</span>
              <span className="truncate font-semibold text-foreground">
                {useOriginalFont
                  ? `${originalName} (from this PDF)`
                  : `${fontFamily === "sans" ? "Sans-serif" : fontFamily === "serif" ? "Serif" : "Monospace"} · ${fontWeight === "bold" ? "Bold" : "Regular"}`}
                {" · "}
                {fontSize}pt
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                <span className="inline-block size-2.5 rounded-full border" style={{ backgroundColor: safeTextColor }} />
                {textColor}
              </span>
            </div>
          </div>

          {/* Original text display */}
          <div className="rounded-lg border bg-surface-muted/60 p-2.5">
            <span className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Original Text in PDF
            </span>
            <p className="text-xs font-mono text-foreground break-all line-clamp-3 select-all">
              {originalText || "(empty text)"}
            </p>
          </div>

          {/* Replacement Text Input */}
          <div className="space-y-1.5">
            <Label htmlFor="replace-text-input" className="text-xs font-medium">
              Replacement Text
            </Label>
            <Textarea
              id="replace-text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type replacement text here..."
              rows={2}
              autoFocus
              className="text-sm font-sans"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  handleApply()
                }
              }}
            />
          </div>

          {/* Live Preview Box */}
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Preview
            </span>
            <div
              className="p-3 rounded-lg border min-h-[44px] flex items-center justify-start overflow-hidden"
              style={{ backgroundColor: safeBgColor }}
            >
              <span
                style={{
                  color: safeTextColor,
                  fontSize: `${Math.min(28, Math.max(12, fontSize))}px`,
                  fontFamily: fontCss,
                  fontWeight: useOriginalFont ? "normal" : fontWeight,
                  lineHeight: 1.2,
                }}
                className="whitespace-pre-wrap break-words"
              >
                {text || <span className="opacity-40 italic text-xs">Type text above to preview</span>}
              </span>
            </div>
          </div>

          {/* Font & Style Controls */}
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            {/* Font Family */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Font Family</Label>
              <div className={cn("grid gap-1", originalFont ? "grid-cols-4" : "grid-cols-3")}>
                {originalFont && (
                  <button
                    type="button"
                    aria-pressed={useOriginalFont}
                    onClick={() => setUseOriginalFont(true)}
                    title={`Use the PDF's own font (${originalName})`}
                    className={cn(
                      "h-10 truncate rounded-md border px-1 text-xs font-medium transition-colors",
                      useOriginalFont ? "border-primary bg-primary/10 text-primary" : "bg-surface hover:bg-muted"
                    )}
                  >
                    Original
                  </button>
                )}
                {([
                  ["sans", "Sans", ""],
                  ["serif", "Serif", "font-serif"],
                  ["mono", "Mono", "font-mono"],
                ] as const).map(([value, label, cls]) => {
                  const active = !useOriginalFont && fontFamily === value
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setUseOriginalFont(false)
                        setFontFamily(value)
                      }}
                      className={cn(
                        "h-10 rounded-md border text-xs font-medium transition-colors",
                        cls,
                        active ? "border-primary bg-primary/10 text-primary" : "bg-surface hover:bg-muted"
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Font Size & Weight */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Size & Weight</Label>
              <div className="flex gap-1.5 items-center">
                <button
                  type="button"
                  aria-pressed={fontWeight === "bold"}
                  disabled={useOriginalFont}
                  onClick={() => setFontWeight((w) => (w === "bold" ? "normal" : "bold"))}
                  className={cn(
                    "size-10 shrink-0 rounded-md border flex items-center justify-center transition-colors disabled:opacity-40",
                    fontWeight === "bold"
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-surface hover:bg-muted"
                  )}
                  title="Toggle Bold"
                  aria-label="Bold"
                >
                  <Bold className="size-4" />
                </button>
                <div className="flex flex-1 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.max(6, Math.round(((Number.isFinite(s) ? s : initialValues.fontSize) - 0.5) * 10) / 10))}
                    aria-label="Decrease font size"
                    className="size-10 shrink-0 rounded-md border flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Decrease font size"
                  >
                    <Minus className="size-3" />
                  </button>
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      step="any"
                      min="1"
                      max="300"
                      value={Number.isFinite(fontSize) ? fontSize : ""}
                      aria-label="Font size in points"
                      onChange={(e) => setFontSize(e.target.value === "" ? NaN : Number(e.target.value))}
                      className="h-10 text-sm font-mono pr-6 text-center"
                    />
                    <span className="absolute right-2 top-3 text-[10px] text-muted-foreground pointer-events-none">
                      pt
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.min(144, Math.round(((Number.isFinite(s) ? s : initialValues.fontSize) + 0.5) * 10) / 10))}
                    aria-label="Increase font size"
                    className="size-10 shrink-0 rounded-md border flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Increase font size"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Colors (Text Color + Background Fill Color) */}
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            {/* Text Color */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Text Color</Label>
              <div className="flex items-center gap-2">
                <label className="relative size-10 shrink-0 cursor-pointer rounded-lg border overflow-hidden shadow-xs">
                  <input
                    type="color"
                    value={safeTextColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    aria-label="Pick text colour"
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                  <div className="size-full" style={{ backgroundColor: safeTextColor }} />
                </label>
                <Input
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value.trim())}
                  aria-label="Text colour hex"
                  maxLength={7}
                  className="h-10 text-sm font-mono uppercase"
                />
              </div>
            </div>

            {/* Background Cover Color */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Background Cover</Label>
              <div className="flex items-center gap-2">
                <label className="relative size-10 shrink-0 cursor-pointer rounded-lg border overflow-hidden shadow-xs">
                  <input
                    type="color"
                    value={safeBgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    aria-label="Pick background colour"
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                  <div className="size-full" style={{ backgroundColor: safeBgColor }} />
                </label>
                <Input
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value.trim())}
                  aria-label="Background colour hex"
                  maxLength={7}
                  className="h-10 text-sm font-mono uppercase"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleErase}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
              title="Erase original text without adding replacement"
            >
              <Eraser className="size-3.5 mr-1" /> Erase (Blank)
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              <Check className="size-3.5 mr-1" /> Apply Replacement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
