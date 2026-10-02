"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Download, Info, Mic, NotebookPen, Pause, Play, Square, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { CopyButton } from "@/components/common/copy-button"
import { Notice, UnsupportedNotice } from "@/components/common/notice"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useHydrated } from "@/hooks/use-store"
import { todayString } from "@/lib/dates"
import { downloadText } from "@/lib/files"
import { saveNote } from "@/lib/storage/notes"
import { cn } from "@/lib/utils"
import {
  RECOGNITION_LANGUAGES,
  describeRecognitionError,
  getSpeechRecognition,
  type SpeechRecognitionLike,
} from "./speech-recognition"

type Status = "idle" | "starting" | "recording" | "paused"

const LANGUAGE_ITEMS = RECOGNITION_LANGUAGES.map((l) => ({ value: l.value as string, label: l.label as string }))

function defaultLanguage(): string {
  if (typeof navigator === "undefined") return "en-US"
  const nav = navigator.language
  return LANGUAGE_ITEMS.find((l) => l.value.toLowerCase() === nav.toLowerCase())?.value ?? "en-US"
}

/** Append a recognised chunk, inserting a space only where needed. */
function appendText(prev: string, chunk: string): string {
  const next = chunk.trim()
  if (!next) return prev
  if (!prev) return next
  return /\s$/.test(prev) ? prev + next : `${prev} ${next}`
}

function formatElapsed(ms: number) {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return h ? `${h}:${mmss}` : mmss
}

const isAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)

export function VoiceToText() {
  const hydrated = useHydrated()
  const router = useRouter()
  const supported = hydrated && getSpeechRecognition() !== null
  const secure = hydrated && window.isSecureContext

  const [status, setStatus] = useState<Status>("idle")
  const [lang, setLang] = useState<string>(defaultLanguage)
  const [transcript, setTranscript] = useState("")
  const [interim, setInterim] = useState("")
  const [lastFinal, setLastFinal] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  // Android Chrome can lose the mic to recognition if we also open it for the meter.
  const [showMeter, setShowMeter] = useState(() => !isAndroid())
  const [elapsed, setElapsed] = useState(0)
  const [confirmClear, setConfirmClear] = useState(false)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const wantRecordingRef = useRef(false)
  const restartsRef = useRef<number[]>([])
  const meterRef = useRef<{ stream: MediaStream; ctx: AudioContext; raf: number } | null>(null)
  const levelRef = useRef<HTMLDivElement>(null)
  /** Accumulated recording time plus the start of the current running segment. */
  const clockRef = useRef<{ acc: number; since: number | null }>({ acc: 0, since: null })

  // ----- elapsed timer -----
  useEffect(() => {
    if (status !== "recording") return
    const id = window.setInterval(() => {
      const c = clockRef.current
      setElapsed(c.acc + (c.since === null ? 0 : Date.now() - c.since))
    }, 250)
    return () => window.clearInterval(id)
  }, [status])

  const freezeClock = useCallback(() => {
    const c = clockRef.current
    const acc = c.since === null ? c.acc : c.acc + Date.now() - c.since
    clockRef.current = { acc, since: null }
    setElapsed(acc)
  }, [])

  const resetClock = useCallback(() => {
    clockRef.current = { acc: 0, since: null }
    setElapsed(0)
  }, [])

  // ----- mic level meter (optional; only after the user clicks Start) -----
  const stopMeter = useCallback(() => {
    const m = meterRef.current
    meterRef.current = null
    if (m) {
      cancelAnimationFrame(m.raf)
      m.stream.getTracks().forEach((t) => t.stop())
      void m.ctx.close().catch(() => {})
    }
    if (levelRef.current) levelRef.current.style.transform = "scaleX(0)"
  }, [])

  const startMeter = useCallback(async () => {
    if (meterRef.current || !navigator.mediaDevices?.getUserMedia) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!wantRecordingRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      const ctx = new Ctx()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      const meter = { stream, ctx, raf: 0 }
      const loop = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        const level = Math.min(1, Math.sqrt(sum / data.length) * 4)
        if (levelRef.current) levelRef.current.style.transform = `scaleX(${level.toFixed(3)})`
        meter.raf = requestAnimationFrame(loop)
      }
      meter.raf = requestAnimationFrame(loop)
      meterRef.current = meter
    } catch {
      // The meter is cosmetic — recognition reports real mic problems itself.
    }
  }, [])

  // ----- recognition -----
  const endSession = useCallback(
    (next: Status) => {
      wantRecordingRef.current = false
      const rec = recognitionRef.current
      if (rec) {
        try {
          rec.stop() // stop() (not abort) lets the browser flush the last phrase as final
        } catch {
          /* already stopped */
        }
      }
      stopMeter()
      freezeClock()
      setStatus(next)
    },
    [freezeClock, stopMeter]
  )

  const begin = useCallback(
    (fresh: boolean) => {
      const Ctor = getSpeechRecognition()
      if (!Ctor) return
      setError(null)
      setHint(null)
      if (fresh) resetClock()
      wantRecordingRef.current = true
      restartsRef.current = []
      setStatus("starting")

      const rec = new Ctor()
      rec.lang = lang
      rec.continuous = true
      rec.interimResults = true
      rec.maxAlternatives = 1

      rec.onstart = () => {
        if (recognitionRef.current !== rec) return
        if (clockRef.current.since === null) clockRef.current = { ...clockRef.current, since: Date.now() }
        setStatus((s) => (s === "starting" ? "recording" : s))
      }
      rec.onresult = (e) => {
        let finalText = ""
        let interimText = ""
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i]
          if (result.isFinal) finalText += result[0].transcript
          else interimText += result[0].transcript
        }
        if (finalText.trim()) {
          setTranscript((prev) => appendText(prev, finalText))
          setLastFinal(finalText.trim())
          setHint(null)
        }
        setInterim(interimText)
      }
      rec.onerror = (e) => {
        const { message, fatal } = describeRecognitionError(e.error)
        if (fatal) {
          setError(message)
          endSession("idle")
        } else if (message) {
          setHint(message)
        }
      }
      rec.onend = () => {
        if (recognitionRef.current !== rec) return
        setInterim("")
        if (!wantRecordingRef.current) {
          recognitionRef.current = null
          return
        }
        // Browsers end sessions after silence or ~60s; restart while the user is still recording.
        const now = Date.now()
        restartsRef.current = restartsRef.current.filter((t) => now - t < 10_000)
        restartsRef.current.push(now)
        if (restartsRef.current.length > 6) {
          setError("Speech recognition keeps stopping. Check your microphone and connection, then press Start again.")
          recognitionRef.current = null
          endSession("idle")
          return
        }
        window.setTimeout(() => {
          if (!wantRecordingRef.current || recognitionRef.current !== rec) return
          try {
            rec.start()
          } catch {
            setError("Couldn't restart speech recognition. Press Start to continue.")
            recognitionRef.current = null
            endSession("idle")
          }
        }, 200)
      }

      recognitionRef.current = rec
      try {
        rec.start()
      } catch {
        recognitionRef.current = null
        setError("Couldn't start speech recognition. Close other tabs using the microphone and try again.")
        endSession("idle")
        return
      }
      if (showMeter) void startMeter()
    },
    [endSession, lang, resetClock, showMeter, startMeter]
  )

  // Stop everything on unmount.
  useEffect(
    () => () => {
      wantRecordingRef.current = false
      try {
        recognitionRef.current?.abort()
      } catch {
        /* noop */
      }
      recognitionRef.current = null
      stopMeter()
    },
    [stopMeter]
  )

  const active = status === "recording" || status === "starting"
  const text = transcript.trim()
  const words = text ? text.split(/\s+/).length : 0

  const onMainButton = () => {
    if (active) endSession("idle")
    else begin(status === "idle")
  }

  const save = () => {
    if (!text) return
    saveNote(text, "voice")
    toast.success("Saved to Notes", { action: { label: "Open", onClick: () => router.push("/tools/notes") } })
  }

  const clear = () => {
    setTranscript("")
    setInterim("")
    setLastFinal("")
    setConfirmClear(false)
    if (!active) {
      resetClock()
      if (status === "paused") setStatus("idle")
    }
  }

  const statusLabel =
    status === "starting"
      ? "Starting… allow microphone access if asked"
      : status === "recording"
        ? "Listening"
        : status === "paused"
          ? "Paused"
          : text
            ? "Stopped"
            : "Ready"

  if (!hydrated) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!supported ? (
        <UnsupportedNotice
          feature="speech recognition"
          alternative="Open LifeKit in Chrome, Edge or Safari to dictate here. Or tap the box below and use your keyboard's dictation (microphone) key — most phone keyboards support it."
        />
      ) : !secure ? (
        <Notice tone="warning" title="Microphone needs a secure connection">
          Open LifeKit over https (or localhost) to use speech recognition.
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        {/* Controls */}
        <section aria-label="Recording controls" className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5 lg:sticky lg:top-6">
          <div className="space-y-1.5">
            <Label htmlFor="vtt-lang">Language</Label>
            <Select
              items={LANGUAGE_ITEMS}
              value={lang}
              onValueChange={(v) => v && setLang(v)}
              disabled={active || !supported}
            >
              <SelectTrigger id="vtt-lang" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_ITEMS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {status === "paused" ? (
              <p className="text-xs text-muted-foreground">You can change the language before resuming.</p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="relative">
              {status === "recording" ? (
                <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-destructive/30 motion-reduce:hidden" />
              ) : null}
              <button
                type="button"
                onClick={onMainButton}
                disabled={!supported || !secure}
                aria-pressed={active}
                aria-label={active ? "Stop recording" : status === "paused" ? "Start a new recording" : "Start recording"}
                className={cn(
                  "relative flex size-24 items-center justify-center rounded-full text-white shadow-soft transition-all outline-none focus-visible:ring-4 focus-visible:ring-ring/50 disabled:opacity-50 sm:size-28",
                  active ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
                )}
              >
                {active ? <Square className="size-9 fill-current" aria-hidden /> : <Mic className="size-10" aria-hidden />}
              </button>
            </div>
            <p className="font-mono text-2xl tabular-nums" aria-label={`Elapsed time ${formatElapsed(elapsed)}`}>
              {formatElapsed(elapsed)}
            </p>
            <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  status === "recording" ? "bg-destructive" : status === "paused" ? "bg-warning" : "bg-muted-foreground/40"
                )}
              />
              {statusLabel}
            </p>

            {showMeter ? (
              <div className="w-full max-w-56" aria-hidden>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    ref={levelRef}
                    className="h-full origin-left rounded-full bg-success transition-transform duration-75"
                    style={{ transform: "scaleX(0)" }}
                  />
                </div>
                <p className="mt-1 text-center text-xs text-muted-foreground">Mic level</p>
              </div>
            ) : null}

            <div className="mt-1 grid w-full grid-cols-2 gap-2">
              {status === "paused" ? (
                <Button size="lg" onClick={() => begin(false)} disabled={!supported}>
                  <Play aria-hidden /> Resume
                </Button>
              ) : (
                <Button size="lg" variant="outline" onClick={() => endSession("paused")} disabled={!active}>
                  <Pause aria-hidden /> Pause
                </Button>
              )}
              <Button size="lg" variant="outline" onClick={() => endSession("idle")} disabled={status === "idle"}>
                <Square aria-hidden /> Stop
              </Button>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
            <Label htmlFor="vtt-meter" className="text-sm font-normal">
              Show mic level meter
            </Label>
            <Switch id="vtt-meter" checked={showMeter} onCheckedChange={(v) => setShowMeter(v)} disabled={active} />
          </div>
        </section>

        {/* Transcript */}
        <section aria-label="Transcript" className="space-y-3">
          {error ? (
            <Notice tone="danger" title="Recording stopped">
              {error}
            </Notice>
          ) : hint && active ? (
            <Notice tone="info">{hint}</Notice>
          ) : null}

          <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label htmlFor="vtt-transcript" className="text-base font-medium">
                Transcript
              </Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {words} {words === 1 ? "word" : "words"} · {transcript.length} chars
              </span>
            </div>
            <Textarea
              id="vtt-transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={
                supported
                  ? "Press the microphone and start speaking. Your words appear here — you can edit them any time."
                  : "Type here, or use your keyboard's dictation key."
              }
              className="min-h-56 resize-y text-base leading-relaxed sm:min-h-72"
            />
            <div className="mt-2 min-h-6 text-sm" aria-hidden={!interim}>
              {interim ? (
                <p className="text-muted-foreground italic">
                  <span className="mr-1.5 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[0.7rem] font-medium not-italic text-primary">
                    hearing
                  </span>
                  {interim}
                </p>
              ) : active ? (
                <p className="text-muted-foreground">Listening…</p>
              ) : null}
            </div>
            {/* Announce each finalised phrase once, without re-reading the whole transcript. */}
            <p className="sr-only" aria-live="polite">
              {lastFinal}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
              <CopyButton value={text} />
              <Button variant="outline" onClick={save} disabled={!text}>
                <NotebookPen aria-hidden /> Save to Notes
              </Button>
              <Button variant="outline" onClick={() => downloadText(text, `transcript-${todayString()}.txt`)} disabled={!text}>
                <Download aria-hidden /> Download TXT
              </Button>
              <Button variant="ghost" className="text-destructive" onClick={() => setConfirmClear(true)} disabled={!transcript}>
                <Trash2 aria-hidden /> Clear
              </Button>
            </div>
          </div>

          <p className="flex gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Speech recognition is provided by your browser. In Chrome and Edge, your audio is sent to the browser
              vendor&apos;s online speech service to be transcribed; Safari may use Apple&apos;s servers or on-device
              recognition. LifeKit doesn&apos;t record or store audio — only the text you choose to save stays on this device.
            </span>
          </p>
        </section>
      </div>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the transcript?</AlertDialogTitle>
            <AlertDialogDescription>This removes the text from this page. Saved notes aren&apos;t affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={clear}>
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
