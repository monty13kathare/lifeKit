"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Eraser, LoaderCircle, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAiStatus } from "@/hooks/use-ai-status"
import { aiAssist } from "@/lib/ai/client"
import { createId } from "@/lib/storage/core"
import { cn } from "@/lib/utils"
import { ChipGroup } from "./chip-group"
import { errorMessage, fitJsonPayload, isAbort } from "./fit-payload"
import { WriterOutput, type Generation, type WriteRequest } from "./writer-output"
import {
  DRAFT_TEMPLATES,
  FORMATS,
  HISTORY_SIZE,
  LANGUAGES,
  LENGTHS,
  MODES,
  TONES,
  WRITER_INSTRUCTIONS_LIMIT,
  WRITER_TEXT_LIMIT,
  isMode,
  type WriterFormat,
  type WriterLength,
  type WriterMode,
  type WriterTone,
} from "./writer-options"

export function AiWriter() {
  const params = useSearchParams()
  const status = useAiStatus()
  const configured = status?.configured === true

  // Query params (e.g. OCR → "Translate") only seed the initial state.
  const [mode, setMode] = useState<WriterMode>(() => {
    const m = params.get("mode")
    return isMode(m) ? m : "draft"
  })
  const [text, setText] = useState(() => (params.get("text") ?? "").slice(0, WRITER_TEXT_LIMIT))
  const [instructions, setInstructions] = useState("")
  const [format, setFormat] = useState<WriterFormat>("email")
  const [tone, setTone] = useState<WriterTone>("professional")
  const [length, setLength] = useState<WriterLength>("medium")
  const [language, setLanguage] = useState("English")

  const [history, setHistory] = useState<Generation[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const controller = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => controller.current?.abort(), [])

  const modeInfo = MODES.find((m) => m.value === mode)!
  const showStyle = mode !== "translate"
  const showInstructions = mode === "draft" || mode === "reply"
  const tooLong = text.length > WRITER_TEXT_LIMIT
  const hasInput = mode === "draft" ? Boolean(text.trim() || instructions.trim()) : Boolean(text.trim())
  const canGenerate = configured && !busy && hasInput && !tooLong
  const current = history.find((g) => g.id === currentId) ?? null

  const buildRequest = (): WriteRequest => ({
    mode,
    text: text.trim(),
    ...(showStyle ? { format, tone, length } : {}),
    ...(mode === "translate" ? { language } : {}),
    ...(showInstructions && instructions.trim() ? { instructions: instructions.trim().slice(0, WRITER_INSTRUCTIONS_LIMIT) } : {}),
  })

  const run = async (req: WriteRequest) => {
    controller.current?.abort()
    const ctl = new AbortController()
    controller.current = ctl
    setBusy(true)
    setError(null)
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    }
    const { json, trimmed } = fitJsonPayload((t) => ({ ...req, text: t }), req.text, WRITER_TEXT_LIMIT)
    if (trimmed) toast.info("Your text was trimmed slightly to fit the 16,000-character limit.")
    try {
      const out = await aiAssist("write", json, ctl.signal)
      if (ctl.signal.aborted) return
      const versions = [out.text, ...(out.alternatives ?? [])].map((s) => s.trim()).filter(Boolean)
      if (!versions.length) throw new Error("Gemini returned an empty result. Try again or add more detail.")
      const gen: Generation = { id: createId(), request: req, subject: out.subject?.trim() ?? "", versions, createdAt: Date.now() }
      setHistory((h) => [gen, ...h].slice(0, HISTORY_SIZE))
      setCurrentId(gen.id)
      setVersion(0)
    } catch (err) {
      if (isAbort(err) || ctl.signal.aborted) return
      const msg = errorMessage(err)
      setError(msg)
      toast.error(msg)
    } finally {
      if (controller.current === ctl) {
        controller.current = null
        setBusy(false)
      }
    }
  }

  const generate = () => {
    if (canGenerate) void run(buildRequest())
  }

  const cancel = () => {
    controller.current?.abort()
    controller.current = null
    setBusy(false)
    toast("Generation cancelled")
  }

  const patchCurrent = (patch: (g: Generation) => Generation) => {
    setHistory((h) => h.map((g) => (g.id === currentId ? patch(g) : g)))
  }

  const moveToInput = (body: string) => {
    setText(body.slice(0, WRITER_TEXT_LIMIT))
    if (mode !== "rewrite" && mode !== "translate") {
      setMode("rewrite")
      toast.success("Moved to the input — switched to Rewrite so you can refine it")
    } else {
      toast.success("Moved to the input")
    }
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {/* ------------------------------------------------------------ Input */}
      <section aria-label="Writing input" className="min-w-0 space-y-5">
        {status && !configured ? (
          <Notice tone="warning" title="AI Writer needs Google Gemini">
            Add <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">GEMINI_API_KEY</code> to <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">.env</code> and restart the app to enable generating.
          </Notice>
        ) : null}

        <Tabs value={mode} onValueChange={(v) => isMode(v as string) && setMode(v as WriterMode)}>
          <TabsList aria-label="Writing mode" className="grid h-11! w-full grid-cols-4">
            {MODES.map((m) => (
              <TabsTrigger key={m.value} value={m.value} className="min-h-9 px-1">
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <p className="text-sm text-muted-foreground">{modeInfo.hint}</p>
        </Tabs>

        {mode === "draft" ? (
          <div className="space-y-2">
            <p className="text-sm font-medium" id="writer-templates">
              Quick templates
            </p>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-labelledby="writer-templates">
              {DRAFT_TEMPLATES.map((t) => (
                <Button
                  key={t.id}
                  type="button"
                  variant="outline"
                  className="shrink-0 rounded-full"
                  onClick={() => {
                    setFormat(t.format)
                    setTone(t.tone)
                    setInstructions(t.instructions)
                    toast.success(`${t.label} template applied — add your details`)
                    inputRef.current?.focus()
                  }}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <Label htmlFor="writer-input">{modeInfo.inputLabel}</Label>
            {text ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setText("")}>
                <Eraser aria-hidden /> Clear
              </Button>
            ) : null}
          </div>
          <Textarea
            id="writer-input"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                generate()
              }
            }}
            placeholder={modeInfo.placeholder}
            aria-describedby="writer-count"
            aria-invalid={tooLong || undefined}
            className="min-h-44 resize-y text-base sm:text-sm"
          />
          <p id="writer-count" className={cn("flex justify-between gap-2 text-xs tabular-nums", tooLong ? "text-destructive" : "text-muted-foreground")}>
            <span>{tooLong ? `Too long — remove ${(text.length - WRITER_TEXT_LIMIT).toLocaleString()} characters.` : "Ctrl + Enter to generate"}</span>
            <span>
              {text.length.toLocaleString()} / {WRITER_TEXT_LIMIT.toLocaleString()}
            </span>
          </p>
        </div>

        {showInstructions ? (
          <div className="space-y-2">
            <Label htmlFor="writer-instructions">
              Extra instructions <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="writer-instructions"
              value={instructions}
              maxLength={WRITER_INSTRUCTIONS_LIMIT}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={mode === "reply" ? "e.g. Accept the invitation but ask to move it to 4 pm." : "e.g. Mention my employee ID 4521. Keep it under 120 words."}
              className="min-h-20 resize-y text-base sm:text-sm"
            />
          </div>
        ) : null}

        {mode === "translate" ? (
          <div className="space-y-2">
            <Label htmlFor="writer-language">Translate to</Label>
            <Select items={LANGUAGES} value={language} onValueChange={(v) => v && setLanguage(String(v))}>
              <SelectTrigger id="writer-language" className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {showStyle ? (
          <div className="space-y-5 rounded-2xl border bg-card p-4 shadow-soft">
            <div className="space-y-2">
              <Label htmlFor="writer-format">Format</Label>
              <Select items={FORMATS} value={format} onValueChange={(v) => v && setFormat(v as WriterFormat)}>
                <SelectTrigger id="writer-format" className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ChipGroup label="Tone" options={TONES} value={tone} onChange={setTone} />
            <ChipGroup label="Length" options={LENGTHS} value={length} onChange={setLength} />
          </div>
        ) : null}

        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:px-6 lg:bottom-0 lg:mx-0 lg:rounded-t-2xl lg:px-0">
          <div className="flex gap-2">
            {busy ? (
              <Button type="button" size="lg" variant="outline" onClick={cancel}>
                <X aria-hidden /> Cancel
              </Button>
            ) : null}
            <Button type="button" size="lg" className="flex-1" disabled={!canGenerate} onClick={generate}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              {busy ? "Writing…" : mode === "translate" ? "Translate" : "Generate"}
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">Text is sent to Google Gemini. Review before sending — AI can make mistakes.</p>
        </div>
      </section>

      {/* ----------------------------------------------------------- Output */}
      <div ref={outputRef} className="min-w-0 scroll-mt-4">
        <WriterOutput
          busy={busy}
          error={error}
          current={current}
          version={version}
          onVersionChange={setVersion}
          onEditBody={(value) => patchCurrent((g) => ({ ...g, versions: g.versions.map((v, i) => (i === version ? value : v)) }))}
          onEditSubject={(value) => patchCurrent((g) => ({ ...g, subject: value }))}
          onUseAsInput={moveToInput}
          onRegenerate={() => current && configured && void run(current.request)}
          canRegenerate={configured && !busy}
          history={history}
          onSelectHistory={(id) => {
            setCurrentId(id)
            setVersion(0)
          }}
        />
      </div>
    </div>
  )
}
