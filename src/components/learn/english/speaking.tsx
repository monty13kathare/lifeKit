"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Mic, MicOff, Shuffle, Volume2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Notice, UnsupportedNotice } from "@/components/common/notice"
import { useHydrated } from "@/hooks/use-store"
import { recordBest } from "@/lib/learn/progress"
import { cn } from "@/lib/utils"
import { ENGLISH_LEVELS, SPEAKING_SENTENCES, type EnglishLevel } from "@/data/learn/english"
import { ACCENTS, canSpeak, compareSpoken, grantXp, speak, useClientCheck, type Accent } from "./english-utils"
import { SimpleSelect } from "./simple-select"

/* Minimal Web Speech Recognition types (not in lib.dom for all TS versions). */
interface RecognitionAlternative {
  transcript: string
}
interface RecognitionResult {
  isFinal: boolean
  length: number
  [index: number]: RecognitionAlternative
}
interface RecognitionEvent {
  resultIndex: number
  results: { length: number; [index: number]: RecognitionResult }
}
interface RecognitionErrorEvent {
  error: string
}
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionCtor = new () => Recognition

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}
const canRecognize = () => getRecognitionCtor() !== null

const RATES = [
  { value: "1", label: "Normal speed" },
  { value: "0.75", label: "Slow" },
] as const

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings and try again.",
  "service-not-allowed": "Speech recognition isn't allowed in this browser or context.",
  "no-speech": "We didn't hear anything. Try again and speak clearly.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs an internet connection in this browser.",
}

interface Attempt {
  transcript: string
  words: { text: string; hit: boolean }[]
  accuracy: number
}

export function Speaking() {
  const hydrated = useHydrated()
  const ttsSupported = useClientCheck(canSpeak)
  const sttSupported = useClientCheck(canRecognize)
  const [level, setLevel] = useState<EnglishLevel>("beginner")
  const [accent, setAccent] = useState<Accent>("en-US")
  const [rate, setRate] = useState<"1" | "0.75">("1")
  const [index, setIndex] = useState(0)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState("")
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const recRef = useRef<Recognition | null>(null)

  const sentences = SPEAKING_SENTENCES.filter((s) => s.level === level)
  const sentence = sentences[index % sentences.length]

  useEffect(
    () => () => {
      recRef.current?.abort()
      if (canSpeak()) window.speechSynthesis.cancel()
    },
    []
  )

  const resetAttempt = () => {
    recRef.current?.abort()
    recRef.current = null
    setListening(false)
    setInterim("")
    setAttempt(null)
  }

  const go = (delta: number) => {
    resetAttempt()
    setIndex((i) => (i + delta + sentences.length) % sentences.length)
  }

  const shuffle = () => {
    resetAttempt()
    if (sentences.length < 2) return
    let next = index
    while (next === index % sentences.length) next = Math.floor(Math.random() * sentences.length)
    setIndex(next)
  }

  const changeLevel = (l: EnglishLevel) => {
    resetAttempt()
    setLevel(l)
    setIndex(0)
  }

  const startListening = () => {
    const Ctor = getRecognitionCtor()
    if (!Ctor || !sentence) return
    if (canSpeak()) window.speechSynthesis.cancel()
    const target = sentence.text
    const rec = new Ctor()
    rec.lang = accent
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1
    let finalText = ""
    rec.onresult = (e) => {
      let interimText = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += `${r[0].transcript} `
        else interimText += r[0].transcript
      }
      setInterim(interimText || finalText)
    }
    rec.onerror = (e) => {
      if (e.error === "aborted") return
      toast.error("Speech recognition problem", { description: ERRORS[e.error] ?? `Recognition error: ${e.error}` })
    }
    rec.onend = () => {
      if (recRef.current !== rec) return
      recRef.current = null
      setListening(false)
      setInterim("")
      const spoken = finalText.trim()
      if (!spoken) return
      const { words, accuracy } = compareSpoken(target, spoken)
      setAttempt({ transcript: spoken, words, accuracy })
      const xp = Math.round(accuracy / 20)
      const best = recordBest("english:speaking", accuracy)
      if (xp > 0) grantXp(xp, `Speaking: ${accuracy}% accuracy`)
      if (best && accuracy === 100) toast.success("Perfect! 🎯")
    }
    recRef.current = rec
    setAttempt(null)
    setInterim("")
    try {
      rec.start() // the browser asks for microphone permission here, after the user's click
      setListening(true)
    } catch (err) {
      recRef.current = null
      toast.error("Couldn't start the microphone", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const stopListening = () => recRef.current?.stop()

  if (!hydrated) return <Skeleton className="h-96 rounded-2xl" />

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SimpleSelect id="sp-level" label="Level" value={level} items={ENGLISH_LEVELS} onChange={changeLevel} />
        <SimpleSelect id="sp-accent" label="Accent" value={accent} items={ACCENTS} onChange={setAccent} />
        <SimpleSelect id="sp-rate" label="Listening speed" value={rate} items={[...RATES]} onChange={setRate} className="col-span-2 sm:col-span-1" />
      </div>

      {sentence ? (
        <section aria-labelledby="sp-title" className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 id="sp-title" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Read aloud · {(index % sentences.length) + 1} of {sentences.length}
            </h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => go(-1)} aria-label="Previous sentence">
                <ChevronLeft />
              </Button>
              <Button variant="ghost" size="icon" onClick={shuffle} aria-label="Random sentence">
                <Shuffle />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => go(1)} aria-label="Next sentence">
                <ChevronRight />
              </Button>
            </div>
          </div>

          <p className="text-xl leading-relaxed font-medium text-pretty sm:text-2xl" lang="en">
            {attempt
              ? attempt.words.map((w, i) => (
                  <span key={i}>
                    <span className={cn(w.hit ? "text-success" : "rounded bg-destructive/10 text-destructive underline decoration-wavy underline-offset-4")}>
                      {w.text}
                    </span>{" "}
                  </span>
                ))
              : sentence.text}
          </p>
          {sentence.focus ? <p className="text-sm text-muted-foreground">Focus: {sentence.focus}</p> : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button size="lg" variant="outline" disabled={!ttsSupported} onClick={() => speak(sentence.text, accent, Number(rate))}>
              <Volume2 /> Listen
            </Button>
            {sttSupported ? (
              listening ? (
                <Button size="lg" variant="destructive" onClick={stopListening}>
                  <MicOff /> Stop
                </Button>
              ) : (
                <Button size="lg" onClick={startListening}>
                  <Mic /> Speak
                </Button>
              )
            ) : null}
          </div>

          <div aria-live="polite" className="space-y-3">
            {listening ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
                </span>
                Listening… {interim ? <span className="text-foreground italic">“{interim}”</span> : "say the sentence now."}
              </p>
            ) : null}
            {attempt ? (
              <div className="rounded-xl bg-surface-muted p-3 text-sm">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className={cn("text-2xl font-semibold tabular-nums", attempt.accuracy >= 80 ? "text-success" : attempt.accuracy >= 50 ? "text-warning" : "text-destructive")}>
                    {attempt.accuracy}%
                  </span>
                  <span className="text-muted-foreground">word accuracy</span>
                </p>
                <p className="mt-1">
                  <span className="text-muted-foreground">We heard:</span> “{attempt.transcript}”
                </p>
                {attempt.words.some((w) => !w.hit) ? (
                  <p className="mt-1 text-muted-foreground">
                    Practise the highlighted words: listen again, then repeat them slowly.
                  </p>
                ) : (
                  <p className="mt-1 text-success">Every word recognised — excellent!</p>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {!ttsSupported ? <UnsupportedNotice feature="text-to-speech" alternative="Read the sentence aloud on your own, or try Chrome, Edge or Safari." /> : null}
      {!sttSupported ? (
        <UnsupportedNotice
          feature="speech recognition"
          alternative="You can still practise by shadowing: tap Listen, pause, then repeat the sentence aloud, copying the rhythm and stress. Recording yourself with your phone's voice recorder helps you compare. Chrome and Edge on desktop or Android support automatic checking."
        />
      ) : (
        <Notice tone="info" title="How speech checking works">
          Your microphone is only used after you tap Speak. In Chrome and Edge, speech recognition audio is sent to the browser maker&apos;s speech service
          (for Chrome, Google) to be turned into text. Accuracy is a rough guide — accents are welcome; aim for clear words.
        </Notice>
      )}
      <Notice tone="success" title="Shadowing tip">
        Listen once, then speak along with the voice at the same time. Repeat three times, then try it alone and check your accuracy.
      </Notice>
    </div>
  )
}
