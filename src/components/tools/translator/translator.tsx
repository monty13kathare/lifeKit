"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeftRight, Eraser, Languages, Loader2, Square, Volume2 } from "lucide-react"
import { toast } from "sonner"
import { CopyButton } from "@/components/common/copy-button"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { chunkText, isSynthesisSupported } from "@/components/tools/text-to-voice/speech-synthesis"
import type { TranslationRequest, TranslationResult, TranslationService } from "@/lib/services/translation-service"
import { getTranslationService, type TranslationSegment } from "@/lib/services/translation"
import { cn } from "@/lib/utils"

const MAX_CHARS = 5000

/** Providers may accept an AbortSignal (the HTTP provider does). */
type CancellableService = TranslationService & {
  translate(req: TranslationRequest, options?: { signal?: AbortSignal }): Promise<TranslationResult>
}

/** Preferred speech locale per language code. */
const SPEECH_LOCALE: Record<string, string> = {
  en: "en-US",
  hi: "hi-IN",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
  mr: "mr-IN",
  pt: "pt-BR",
  zh: "zh-CN",
  ja: "ja-JP",
  ar: "ar-SA",
}

function getSegments(res: TranslationResult): TranslationSegment[] {
  if ("segments" in res && Array.isArray((res as { segments?: unknown }).segments)) {
    return (res as { segments: TranslationSegment[] }).segments
  }
  return [{ text: res.text, translated: true }]
}

export function TranslatorWithParams() {
  const params = useSearchParams()
  return <Translator initialText={params.get("text") ?? ""} />
}

export function Translator({ initialText = "" }: { initialText?: string }) {
  const service = getTranslationService() as CancellableService
  const languages = useMemo(() => service.supportedLanguages().map((l) => ({ value: l.code, label: l.name })), [service])
  const nameOf = (code: string) => languages.find((l) => l.value === code)?.label ?? code

  const [from, setFrom] = useState("en")
  const [to, setTo] = useState(() => (languages.some((l) => l.value === "hi") ? "hi" : (languages[1]?.value ?? "en")))
  const [input, setInput] = useState(initialText.slice(0, MAX_CHARS))
  const [result, setResult] = useState<{ key: string; res: TranslationResult } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const speakSession = useRef(0)

  const key = `${from}|${to}|${input}`
  const empty = !input.trim()
  const sameLang = from === to

  // Debounced auto-translate. Results are tagged with their request key so
  // stale responses never overwrite newer input.
  useEffect(() => {
    if (!input.trim() || from === to) return
    const controller = new AbortController()
    const requestKey = `${from}|${to}|${input}`
    const id = window.setTimeout(
      async () => {
        try {
          const res = await service.translate({ text: input, from, to }, { signal: controller.signal })
          if (!controller.signal.aborted) setResult({ key: requestKey, res })
        } catch (err) {
          if (controller.signal.aborted) return
          setFailure({ key: requestKey, message: err instanceof Error ? err.message : "Translation failed." })
        }
      },
      service.isDemo ? 250 : 700
    )
    return () => {
      window.clearTimeout(id)
      controller.abort()
    }
  }, [input, from, to, service])

  useEffect(
    () => () => {
      speakSession.current++
      if (isSynthesisSupported()) window.speechSynthesis.cancel()
    },
    []
  )

  const current = result?.key === key ? result.res : null
  const failed = failure?.key === key ? failure.message : null
  const pending = !empty && !sameLang && !current && !failed
  const shown = empty || sameLang ? null : (current ?? (pending ? result?.res : null))
  const segments = shown ? getSegments(shown) : []
  const untranslated = shown?.untranslated ?? []

  const stopSpeaking = () => {
    speakSession.current++
    if (isSynthesisSupported()) window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  const speak = () => {
    if (!current?.text.trim()) return
    if (!isSynthesisSupported()) {
      toast.error("This browser can't read text aloud.")
      return
    }
    const synth = window.speechSynthesis
    synth.cancel()
    const session = ++speakSession.current
    const locale = SPEECH_LOCALE[to] ?? to
    const voices = synth.getVoices()
    const voice =
      voices.find((v) => v.lang.toLowerCase() === locale.toLowerCase()) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(`${to}-`) || v.lang.toLowerCase() === to) ??
      null
    if (voices.length && !voice) {
      toast.info(`No ${nameOf(to)} voice is installed — your device may read it with a different voice.`)
    }
    const chunks = chunkText(current.text)
    const next = (i: number) => {
      if (session !== speakSession.current) return
      if (i >= chunks.length) {
        setSpeaking(false)
        return
      }
      const u = new SpeechSynthesisUtterance(chunks[i].text)
      u.lang = voice?.lang ?? locale
      if (voice) u.voice = voice
      u.onend = () => next(i + 1)
      u.onerror = (e) => {
        if (session !== speakSession.current || e.error === "interrupted" || e.error === "canceled") return
        setSpeaking(false)
        toast.error("Couldn't read the translation aloud.")
      }
      synth.speak(u)
    }
    setSpeaking(true)
    next(0)
  }

  const swap = () => {
    stopSpeaking()
    setFrom(to)
    setTo(from)
    if (current?.text) setInput(current.text.slice(0, MAX_CHARS))
  }

  const langSelect = (id: string, label: string, value: string, onChange: (v: string) => void) => (
    <div className="min-w-0 flex-1 space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select items={languages} value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {languages.map((l) => (
            <SelectItem key={l.value} value={l.value}>
              {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className="space-y-4">
      {service.isDemo ? (
        <Notice tone="warning" title="Demo dictionary mode — translates common words and phrases only. Full translation requires a configured translation provider.">
          Built-in phrase list for English, Hindi, Spanish, French and German. Grammar and word order aren&apos;t adjusted,
          and words it doesn&apos;t know are left as-is and <mark className="rounded bg-warning/25 px-1 text-foreground">highlighted</mark>.
          Everything runs in your browser.
        </Notice>
      ) : (
        <Notice tone="info" title={`Using ${service.name}`}>
          Your text is sent to the translation server configured for this app to be translated.
        </Notice>
      )}

      <div className="flex items-end gap-2 rounded-2xl border bg-card p-3 shadow-soft sm:p-4">
        {langSelect("tr-from", "From", from, (v) => setFrom(v))}
        <Button variant="outline" size="icon" onClick={swap} aria-label="Swap languages" className="mb-0 shrink-0">
          <ArrowLeftRight aria-hidden />
        </Button>
        {langSelect("tr-to", "To", to, (v) => setTo(v))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-4 shadow-soft">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label htmlFor="tr-input" className="text-base font-medium">
              {nameOf(from)}
            </Label>
            <Button variant="ghost" size="sm" onClick={() => setInput("")} disabled={!input}>
              <Eraser aria-hidden /> Clear
            </Button>
          </div>
          <Textarea
            id="tr-input"
            value={input}
            maxLength={MAX_CHARS}
            onChange={(e) => setInput(e.target.value)}
            placeholder={service.isDemo ? "Try “Good morning, how are you?”" : "Type or paste text to translate…"}
            className="min-h-44 resize-y text-base leading-relaxed md:min-h-64"
          />
          <p className={cn("mt-2 text-right text-xs tabular-nums", input.length >= MAX_CHARS ? "text-destructive" : "text-muted-foreground")}>
            {input.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </p>
        </section>

        <section className="flex flex-col rounded-2xl border bg-card p-4 shadow-soft" aria-busy={pending}>
          <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
            <h2 className="text-base font-medium">{nameOf(to)}</h2>
            {pending ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Translating…
              </span>
            ) : null}
          </div>

          <div
            aria-live="polite"
            className={cn(
              "min-h-44 flex-1 rounded-lg border bg-surface p-3 text-base leading-relaxed whitespace-pre-wrap md:min-h-64",
              pending && shown && "opacity-60"
            )}
          >
            {sameLang && !empty ? (
              <p className="text-sm text-muted-foreground">Choose two different languages.</p>
            ) : failed ? (
              <p className="text-sm text-destructive">{failed}</p>
            ) : shown ? (
              segments.map((seg, i) =>
                seg.translated ? (
                  <span key={i}>{seg.text}</span>
                ) : (
                  <mark
                    key={i}
                    title="Not in the demo dictionary"
                    className="rounded bg-warning/25 px-0.5 text-foreground underline decoration-warning decoration-dotted underline-offset-4"
                  >
                    {seg.text}
                  </mark>
                )
              )
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Languages className="size-4" aria-hidden /> The translation appears here as you type.
              </p>
            )}
          </div>

          {untranslated.length > 0 && current ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Not in the demo dictionary ({untranslated.length}): {untranslated.slice(0, 12).join(", ")}
              {untranslated.length > 12 ? "…" : ""}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
            <CopyButton value={current?.text ?? ""} />
            {speaking ? (
              <Button variant="outline" onClick={stopSpeaking}>
                <Square aria-hidden /> Stop
              </Button>
            ) : (
              <Button variant="outline" onClick={speak} disabled={!current?.text.trim()}>
                <Volume2 aria-hidden /> Speak
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
