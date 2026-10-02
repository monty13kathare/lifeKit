"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { useSearchParams } from "next/navigation"
import { Eraser, FileText, Pause, Play, Square, Volume2 } from "lucide-react"
import { Notice, UnsupportedNotice } from "@/components/common/notice"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { useHydrated } from "@/hooks/use-store"
import { cn } from "@/lib/utils"
import { baseLang, chunkText, isSynthesisSupported, languageName, voicesStore } from "./speech-synthesis"

type Status = "idle" | "speaking" | "paused"

const MAX_CHARS = 30_000
const SAMPLE_TEXT =
  "Welcome to LifeKit. This tool reads any text aloud using the voices installed on your device. " +
  "Pick a voice, adjust the speed and pitch, and press play. The word being spoken is highlighted as it goes, " +
  "so you can follow along. Long documents are read sentence by sentence, which keeps playback smooth."

interface Settings {
  rate: number
  pitch: number
  volume: number
}

function SliderField({
  id,
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (n: number) => string
  onChange: (n: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label id={`${id}-label`}>{label}</Label>
        <span className="text-sm text-muted-foreground tabular-nums">{format(value)}</span>
      </div>
      <Slider
        aria-labelledby={`${id}-label`}
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v as number)}
      />
    </div>
  )
}

export function TextToVoiceWithParams() {
  const params = useSearchParams()
  return <TextToVoice initialText={params.get("text") ?? ""} />
}

export function TextToVoice({ initialText = "" }: { initialText?: string }) {
  const hydrated = useHydrated()
  const supported = hydrated && isSynthesisSupported()
  const voices = useSyncExternalStore(voicesStore.subscribe, voicesStore.getSnapshot, voicesStore.getServerSnapshot)

  const [text, setText] = useState(initialText.slice(0, MAX_CHARS))
  const [langFilter, setLangFilter] = useState<string | null>(null)
  const [voiceURI, setVoiceURI] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings>({ rate: 1, pitch: 1, volume: 1 })
  const [status, setStatus] = useState<Status>("idle")
  const [chunkRange, setChunkRange] = useState<{ start: number; end: number } | null>(null)
  const [word, setWord] = useState<{ start: number; end: number } | null>(null)
  const [boundarySeen, setBoundarySeen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voicesTimedOut, setVoicesTimedOut] = useState(false)
  /** The text being read (frozen at Play so edits can't desync highlighting). */
  const [spokenText, setSpokenText] = useState("")

  const sessionRef = useRef(0)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const markRef = useRef<HTMLElement>(null)

  // Some browsers never fire `voiceschanged` when no voices are installed.
  useEffect(() => {
    if (!supported) return
    const id = window.setTimeout(() => setVoicesTimedOut(true), 3000)
    return () => window.clearTimeout(id)
  }, [supported])

  // Cancel speech when leaving the page.
  useEffect(
    () => () => {
      sessionRef.current++
      if (isSynthesisSupported()) window.speechSynthesis.cancel()
    },
    []
  )

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [word, chunkRange])

  // ----- voices & language filter -----
  const languages = useMemo(() => {
    const counts = new Map<string, number>()
    for (const v of voices) counts.set(baseLang(v.lang), (counts.get(baseLang(v.lang)) ?? 0) + 1)
    return [...counts.entries()]
      .map(([code, count]) => ({ value: code, label: `${languageName(code)} (${count})` }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [voices])

  const navLang = hydrated ? baseLang(navigator.language) : "en"
  const effectiveFilter = langFilter ?? (languages.some((l) => l.value === navLang) ? navLang : "all")
  const languageItems = useMemo(
    () => [{ value: "all", label: `All languages (${voices.length})` }, ...languages],
    [languages, voices.length]
  )

  const filteredVoices = useMemo(() => {
    const list = effectiveFilter === "all" ? [...voices] : voices.filter((v) => baseLang(v.lang) === effectiveFilter)
    return list.sort(
      (a, b) =>
        Number(b.default) - Number(a.default) ||
        Number(b.localService) - Number(a.localService) ||
        a.lang.localeCompare(b.lang) ||
        a.name.localeCompare(b.name)
    )
  }, [voices, effectiveFilter])

  const voice = filteredVoices.find((v) => v.voiceURI === voiceURI) ?? filteredVoices[0] ?? null
  const voiceItems = useMemo(
    () =>
      filteredVoices.map((v) => ({
        value: v.voiceURI,
        label: `${v.name} · ${v.lang}${v.localService ? "" : " · online"}`,
      })),
    [filteredVoices]
  )

  // Latest playback settings, read when each chunk starts so changes apply mid-read.
  const liveRef = useRef({ settings, voice, lang: effectiveFilter })
  useEffect(() => {
    liveRef.current = { settings, voice, lang: effectiveFilter }
  }, [settings, voice, effectiveFilter])

  // ----- playback -----
  const stop = () => {
    sessionRef.current++
    if (isSynthesisSupported()) window.speechSynthesis.cancel()
    setStatus("idle")
    setWord(null)
    setChunkRange(null)
  }

  const play = () => {
    const source = text
    if (!source.trim() || !isSynthesisSupported()) return
    const synth = window.speechSynthesis
    const session = ++sessionRef.current
    synth.cancel()
    setError(null)
    setSpokenText(source)
    setWord(null)
    const chunks = chunkText(source)

    const speakChunk = (i: number) => {
      if (session !== sessionRef.current) return
      if (i >= chunks.length) {
        setStatus("idle")
        setWord(null)
        setChunkRange(null)
        return
      }
      const chunk = chunks[i]
      const { settings: s, voice: v, lang } = liveRef.current
      const u = new SpeechSynthesisUtterance(chunk.text)
      if (v) {
        u.voice = v
        u.lang = v.lang
      } else if (lang !== "all") {
        u.lang = lang
      }
      u.rate = s.rate
      u.pitch = s.pitch
      u.volume = s.volume
      u.onstart = () => {
        if (session !== sessionRef.current) return
        setChunkRange({ start: chunk.start, end: chunk.start + chunk.text.length })
      }
      u.onboundary = (e) => {
        if (session !== sessionRef.current || (e.name && e.name !== "word")) return
        const start = chunk.start + e.charIndex
        const len = e.charLength || (chunk.text.slice(e.charIndex).match(/^\S+/)?.[0].length ?? 0)
        if (len > 0) {
          setWord({ start, end: start + len })
          setBoundarySeen(true)
        }
      }
      u.onend = () => speakChunk(i + 1)
      u.onerror = (e) => {
        if (session !== sessionRef.current || e.error === "interrupted" || e.error === "canceled") return
        sessionRef.current++
        setStatus("idle")
        setWord(null)
        setChunkRange(null)
        setError(
          e.error === "not-allowed"
            ? "Your browser blocked speech. Press Play again after interacting with the page."
            : e.error === "language-unavailable" || e.error === "voice-unavailable"
              ? "That voice isn't available right now. Pick another voice."
              : e.error === "network"
                ? "This online voice needs an internet connection. Pick a voice without the “online” label."
                : `Speech stopped unexpectedly (${e.error}).`
        )
      }
      utteranceRef.current = u // keep a reference: Chrome can garbage-collect utterances mid-speech
      synth.speak(u)
    }

    setStatus("speaking")
    speakChunk(0)
  }

  const pause = () => {
    window.speechSynthesis.pause()
    setStatus("paused")
  }
  const resume = () => {
    window.speechSynthesis.resume()
    setStatus("speaking")
  }

  const reading = status !== "idle"
  const trimmed = text.trim()

  // Reading view: sentence background + highlighted word.
  const readingView = useMemo(() => {
    if (!reading) return null
    const parts: { text: string; kind: "plain" | "sentence" | "word" }[] = []
    const src = spokenText
    const c = chunkRange ?? { start: 0, end: 0 }
    const w = word && word.start >= c.start && word.end <= c.end ? word : null
    parts.push({ text: src.slice(0, c.start), kind: "plain" })
    if (w) {
      parts.push({ text: src.slice(c.start, w.start), kind: "sentence" })
      parts.push({ text: src.slice(w.start, w.end), kind: "word" })
      parts.push({ text: src.slice(w.end, c.end), kind: "sentence" })
    } else {
      parts.push({ text: src.slice(c.start, c.end), kind: "sentence" })
    }
    parts.push({ text: src.slice(c.end), kind: "plain" })
    return parts.filter((p) => p.text)
  }, [reading, spokenText, chunkRange, word])

  if (!hydrated) return <Skeleton className="h-96 rounded-2xl" />

  return (
    <div className="space-y-4">
      {!supported ? (
        <UnsupportedNotice
          feature="text-to-speech"
          alternative="Try a recent version of Chrome, Edge, Safari or Firefox. On phones, your system's screen reader or “Speak selection” accessibility setting can also read text aloud."
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="gap-1">
            <Volume2 className="size-3" aria-hidden /> Speech supported
          </Badge>
          <span>
            {voices.length
              ? `${voices.length} voice${voices.length === 1 ? "" : "s"} available`
              : voicesTimedOut
                ? "No voices reported — your device's default voice will be used"
                : "Loading voices…"}
          </span>
          {reading && !boundarySeen ? <span>· Word highlighting isn&apos;t supported by this voice; the sentence is highlighted instead.</span> : null}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-3">
          <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label htmlFor="ttv-text" className="text-base font-medium">
                Text
              </Label>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setText(SAMPLE_TEXT)} disabled={reading}>
                  <FileText aria-hidden /> Sample
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setText("")} disabled={reading || !text}>
                  <Eraser aria-hidden /> Clear
                </Button>
              </div>
            </div>

            {reading && readingView ? (
              <div
                className="max-h-[50dvh] min-h-56 overflow-y-auto rounded-lg border bg-surface p-3 text-base leading-relaxed whitespace-pre-wrap sm:min-h-72"
                aria-label="Text being read"
              >
                {readingView.map((p, i) =>
                  p.kind === "word" ? (
                    <mark key={i} ref={markRef} className="rounded bg-primary px-0.5 text-primary-foreground">
                      {p.text}
                    </mark>
                  ) : p.kind === "sentence" ? (
                    <span key={i} ref={word ? undefined : markRef} className="rounded bg-primary/10">
                      {p.text}
                    </span>
                  ) : (
                    <span key={i}>{p.text}</span>
                  )
                )}
              </div>
            ) : (
              <Textarea
                id="ttv-text"
                value={text}
                maxLength={MAX_CHARS}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste text to hear it read aloud…"
                className="min-h-56 resize-y text-base leading-relaxed sm:min-h-72"
              />
            )}
            <p className="mt-2 text-right text-xs text-muted-foreground tabular-nums">
              {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
            </p>
          </div>

          {error ? <Notice tone="danger">{error}</Notice> : null}

          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 rounded-2xl border bg-card/95 p-3 shadow-soft backdrop-blur lg:bottom-0">
            <div className="flex items-center gap-2">
              {status === "idle" ? (
                <Button size="lg" className="flex-1" onClick={play} disabled={!supported || !trimmed}>
                  <Play aria-hidden /> Play
                </Button>
              ) : status === "speaking" ? (
                <Button size="lg" className="flex-1" onClick={pause}>
                  <Pause aria-hidden /> Pause
                </Button>
              ) : (
                <Button size="lg" className="flex-1" onClick={resume}>
                  <Play aria-hidden /> Resume
                </Button>
              )}
              <Button size="lg" variant="outline" onClick={stop} disabled={status === "idle"}>
                <Square aria-hidden /> Stop
              </Button>
            </div>
            <p role="status" aria-live="polite" className="mt-2 text-center text-xs text-muted-foreground">
              {status === "speaking" ? "Reading aloud…" : status === "paused" ? "Paused" : trimmed ? "Ready to play" : "Add some text to start"}
            </p>
          </div>
        </div>

        <aside aria-label="Voice settings" className="space-y-5 rounded-2xl border bg-card p-4 shadow-soft sm:p-5 lg:sticky lg:top-6">
          <div className="space-y-1.5">
            <Label htmlFor="ttv-lang">Language</Label>
            <Select
              items={languageItems}
              value={effectiveFilter}
              onValueChange={(v) => {
                if (!v) return
                setLangFilter(v)
                setVoiceURI(null)
              }}
              disabled={!voices.length}
            >
              <SelectTrigger id="ttv-lang" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languageItems.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ttv-voice">Voice</Label>
            <Select
              items={voiceItems}
              value={voice?.voiceURI ?? null}
              onValueChange={(v) => v && setVoiceURI(v)}
              disabled={!voiceItems.length}
            >
              <SelectTrigger id="ttv-voice" className="w-full">
                <SelectValue placeholder={voices.length ? "Choose a voice" : "Default voice"} />
              </SelectTrigger>
              <SelectContent>
                {voiceItems.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {voice && !voice.localService ? (
              <p className="text-xs text-muted-foreground">
                Online voices send the text to the voice provider to generate audio. Pick a voice without “online” to keep it on-device.
              </p>
            ) : null}
          </div>

          <SliderField
            id="ttv-rate"
            label="Speed"
            value={settings.rate}
            min={0.5}
            max={2}
            step={0.1}
            format={(n) => `${n.toFixed(1)}×`}
            onChange={(rate) => setSettings((s) => ({ ...s, rate }))}
          />
          <SliderField
            id="ttv-pitch"
            label="Pitch"
            value={settings.pitch}
            min={0}
            max={2}
            step={0.1}
            format={(n) => n.toFixed(1)}
            onChange={(pitch) => setSettings((s) => ({ ...s, pitch }))}
          />
          <SliderField
            id="ttv-volume"
            label="Volume"
            value={settings.volume}
            min={0}
            max={1}
            step={0.05}
            format={(n) => `${Math.round(n * 100)}%`}
            onChange={(volume) => setSettings((s) => ({ ...s, volume }))}
          />
          <p className={cn("text-xs text-muted-foreground")}>
            Changes apply from the next sentence. Pause and resume can be unreliable on some Android browsers — use Stop and
            Play if playback gets stuck.
          </p>
        </aside>
      </div>
    </div>
  )
}
