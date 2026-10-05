"use client"

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Type,
  Volume2,
  VolumeX,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { StoryBook, StoryPage } from "@/types"
import { Confetti, haptic } from "../fun/celebrate"
import { tr } from "../fun/fun-utils"
import { SceneArt } from "./scene-art"
import { useReadAloud } from "./use-read-aloud"

const TEXT_SIZES = ["text-base", "text-lg", "text-xl"] as const
const SPEED_LABELS = ["0.7×", "1×", "1.3×"] as const
const SPEED_RATES = [0.7, 1.0, 1.3] as const

interface StoryReaderProps {
  story: StoryBook
  saved: boolean
  aiEnabled: boolean
  onBack: () => void
  onSave: () => void
  onDelete: () => void
  onNewStory: () => void
  /** Kept for interface compatibility, no longer used internally */
  onPageImage: (index: number, imageUrl: string | undefined) => void
}

/** Picture-book reader: one page at a time, swipe or tap to turn, read aloud with full highlighting. */
export function StoryReader({ story, saved, aiEnabled: _aiEnabled, onBack, onSave, onDelete, onNewStory }: StoryReaderProps) {
  const lang = story.language
  const t = (en: string, hi: string) => tr(lang, { en, hi })
  const total = story.pages.length
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const [size, setSize] = useState(1)
  const [speedIdx, setSpeedIdx] = useState(1) // 0=slow, 1=normal, 2=fast
  const [wordAt, setWordAt] = useState<number | null>(null)
  const [autoPlay, setAutoPlay] = useState(false)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const voice = useReadAloud(lang)
  const touchX = useRef<number | null>(null)
  const textRef = useRef<HTMLParagraphElement>(null)

  const atEnd = index === total
  const page: StoryPage | undefined = story.pages[index]

  // Reading progress: 0–100%
  const progressPct = Math.round(((index) / total) * 100)

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(total, next))
    if (clamped === index) return
    setDir(clamped > index ? 1 : -1)
    setIndex(clamped)
    setWordAt(null)
    if (clamped === total) haptic([30, 50, 30])
  }

  const readPage = (i: number) => {
    const p = story.pages[i]
    if (!p) {
      setAutoPlay(false)
      return
    }
    voice.speak(p.text, {
      rate: SPEED_RATES[speedIdx],
      onWord: setWordAt,
      onEnd: () => {
        setWordAt(null)
        // Brief pause then move to next page automatically.
        window.setTimeout(() => {
          setDir(1)
          setIndex(i + 1)
          if (i + 1 < total) readPage(i + 1)
          else setAutoPlay(false)
        }, 900)
      },
    })
  }

  const toggleRead = () => {
    if (voice.speaking || autoPlay) {
      voice.stop()
      setAutoPlay(false)
      setWordAt(null)
      return
    }
    const start = atEnd ? 0 : index
    if (atEnd) {
      setDir(-1)
      setIndex(0)
    }
    setAutoPlay(true)
    readPage(start)
  }

  // Turning a page by hand stops the narration.
  const turn = (next: number) => {
    if (voice.speaking || autoPlay) {
      voice.stop()
      setAutoPlay(false)
    }
    go(next)
  }

  // Re-start reading current page when speed changes mid-read.
  const changeSpeed = () => {
    const next = (speedIdx + 1) % SPEED_RATES.length
    setSpeedIdx(next)
    if (voice.speaking || autoPlay) {
      voice.stop()
      // Small delay so cancellation clears before new speak
      window.setTimeout(() => {
        setAutoPlay(true)
        readPage(index)
      }, 120)
    }
  }

  // Arrow keys turn pages on desktop.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return
    if (e.key === "ArrowRight") turn(index + 1)
    if (e.key === "ArrowLeft") turn(index - 1)
    if (e.key === " ") { e.preventDefault(); toggleRead() }
  })
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e)
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  // Auto-scroll highlighted sentence into view.
  useEffect(() => {
    if (wordAt !== null && textRef.current) {
      const highlighted = textRef.current.querySelector("[data-hl=\"true\"]")
      highlighted?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [wordAt])

  const words = useMemo(() => (page ? tokenize(page.text) : []), [page])

  // Split into sentence-level chunks for richer highlighting
  const sentences = useMemo(() => splitSentences(page?.text ?? ""), [page])

  // Find the sentence that contains the current word position
  const activeSentenceRange = useMemo(() => {
    if (wordAt === null || !page) return null
    const s = sentences.find((s) => wordAt >= s.start && wordAt < s.end)
    return s ?? null
  }, [wordAt, sentences, page])

  return (
    <div className="mx-auto max-w-2xl space-y-3" lang={lang}>
      {/* Top bar */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={t("Back to stories", "कहानियों पर वापस")}>
          <ArrowLeft aria-hidden />
        </Button>
        <p className="min-w-0 flex-1 truncate font-semibold">{story.title}</p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSize((s) => (s + 1) % TEXT_SIZES.length)}
          aria-label={t("Change text size", "अक्षर का आकार बदलें")}
        >
          <Type aria-hidden />
        </Button>
        <Button
          variant={saved ? "ghost" : "outline"}
          size="icon"
          onClick={onSave}
          disabled={saved}
          aria-label={saved ? t("Saved", "सहेजी गई") : t("Save story", "कहानी सहेजें")}
        >
          {saved ? <BookmarkCheck className="text-primary" aria-hidden /> : <Bookmark aria-hidden />}
        </Button>
        {saved && (
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label={t("Delete story", "कहानी हटाएँ")}>
            <Trash2 aria-hidden />
          </Button>
        )}
      </div>

      {/* Progress bar + reading % */}
      <div className="space-y-1">
        <div
          className="flex gap-1"
          role="progressbar"
          aria-label={t("Story progress", "कहानी की प्रगति")}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Math.min(index + 1, total)}
        >
          {Array.from({ length: total + 1 }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                i <= index ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
        <p className="text-right text-[0.65rem] font-medium tabular-nums text-muted-foreground">
          {atEnd ? t("Complete ✓", "पूर्ण ✓") : `${progressPct}% · ${t("Page", "पेज")} ${index + 1}/${total}`}
        </p>
      </div>

      {/* Page */}
      <div
        className="touch-pan-y"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) > 50) turn(index + (dx < 0 ? 1 : -1))
        }}
      >
        <div
          key={index}
          className={cn(
            "overflow-hidden rounded-3xl border bg-card shadow-soft animate-in fade-in duration-500",
            dir === 1 ? "slide-in-from-right-8" : "slide-in-from-left-8"
          )}
        >
          {page ? (
            <>
              {/* Scene illustration (always shown, no image generation) */}
              <div className="relative p-2 pb-0">
                <SceneArt scene={page.scene} />
                {/* Auto-read indicator badge */}
                {(voice.speaking || autoPlay) && (
                  <div className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-xs font-semibold backdrop-blur">
                    <span className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-3 w-0.5 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: `${i * 120}ms` }}
                        />
                      ))}
                    </span>
                    {t("Reading…", "पढ़ा जा रहा है…")}
                  </div>
                )}
              </div>

              {/* Story text with word + sentence highlight */}
              <p
                ref={textRef}
                className={cn("p-5 leading-loose text-pretty sm:p-6", TEXT_SIZES[size])}
                aria-live={voice.speaking ? "off" : "polite"}
              >
                {words.map((w, i) => {
                  if (w.space) return <span key={i}>{w.text}</span>
                  const inSentence =
                    activeSentenceRange !== null && w.start >= activeSentenceRange.start && w.end <= activeSentenceRange.end
                  const isCurrentWord = wordAt !== null && wordAt >= w.start && wordAt < w.end
                  return (
                    <span
                      key={i}
                      data-hl={isCurrentWord ? "true" : undefined}
                      className={cn(
                        "rounded transition-all duration-150",
                        inSentence && !isCurrentWord && "bg-primary/10",
                        isCurrentWord && "bg-primary/35 font-semibold text-foreground"
                      )}
                    >
                      {w.text}
                    </span>
                  )
                })}
              </p>
            </>
          ) : (
            <EndPage story={story} onRestart={() => turn(0)} onNewStory={onNewStory} lang={lang} />
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 space-y-2 lg:bottom-4">
        {/* Main controls row */}
        <div className="flex items-center gap-2 rounded-2xl border bg-card/90 p-2 shadow-soft backdrop-blur">
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            onClick={() => turn(index - 1)}
            disabled={index === 0}
            aria-label={t("Previous page", "पिछला पेज")}
          >
            <ChevronLeft aria-hidden />
          </Button>

          {voice.supported ? (
            <>
              <Button
                className="h-11 flex-1"
                variant={voice.speaking || autoPlay ? "secondary" : "default"}
                onClick={toggleRead}
              >
                {voice.speaking || autoPlay ? <Pause aria-hidden /> : <Volume2 aria-hidden />}
                {voice.speaking || autoPlay ? t("Pause", "रोकें") : t("Read aloud", "सुनें")}
              </Button>
              {/* Speed control */}
              <Button
                variant="outline"
                size="icon"
                className="size-11 shrink-0 tabular-nums text-xs font-bold"
                onClick={changeSpeed}
                aria-label={t("Reading speed", "पढ़ने की गति")}
                title={t("Reading speed", "पढ़ने की गति")}
              >
                <Gauge className="size-4" aria-hidden />
                <span className="sr-only">{SPEED_LABELS[speedIdx]}</span>
              </Button>
            </>
          ) : (
            <span className="flex-1 text-center text-xs text-muted-foreground">
              {t("Read aloud isn't supported in this browser.", "इस ब्राउज़र में सुनने की सुविधा नहीं है।")}
            </span>
          )}

          <span className="w-12 text-center text-sm font-medium text-muted-foreground tabular-nums">
            {atEnd ? "✓" : `${index + 1}/${total}`}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="size-11"
            onClick={() => turn(index + 1)}
            disabled={atEnd}
            aria-label={t("Next page", "अगला पेज")}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>

        {/* Speed label + voice warning */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
          {voice.supported && (
            <p className="text-xs text-muted-foreground">
              {t("Speed", "गति")}: <span className="font-semibold text-foreground">{SPEED_LABELS[speedIdx]}</span>
              {" · "}
              {t("tap Gauge to change", "गति बदलने के लिए Gauge दबाएँ")}
            </p>
          )}
          {voice.supported && !voice.hasVoice && lang === "hi" && (
            <p className="text-xs text-muted-foreground">
              {t("No Hindi voice installed — using default voice.", "हिंदी आवाज़ नहीं मिली — डिफ़ॉल्ट आवाज़ इस्तेमाल की जा रही है।")}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function EndPage({ story, onRestart, onNewStory, lang }: { story: StoryBook; onRestart: () => void; onNewStory: () => void; lang: StoryBook["language"] }) {
  return (
    <div className="relative flex min-h-80 flex-col items-center justify-center gap-4 bg-linear-to-br from-primary/12 via-card to-card p-6 text-center">
      <Confetti pieces={28} />
      <p className="animate-lk-drop font-serif text-4xl font-bold tracking-tight">{tr(lang, { en: "The End", hi: "समाप्त" })}</p>
      {story.moral && (
        <div className="max-w-md animate-lk-rise rounded-2xl border bg-background/70 p-4" style={{ animationDelay: "0.4s" }}>
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">{tr(lang, { en: "Moral of the story", hi: "कहानी की सीख" })}</p>
          <p className="mt-1 text-lg leading-relaxed">{story.moral}</p>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onRestart}>
          <RotateCcw aria-hidden /> {tr(lang, { en: "Read again", hi: "फिर से पढ़ें" })}
        </Button>
        <Button onClick={onNewStory}>
          <Sparkles aria-hidden /> {tr(lang, { en: "New story", hi: "नई कहानी" })}
        </Button>
      </div>
    </div>
  )
}

/** Split text into words and spaces with character offsets (for word highlighting). */
function tokenize(text: string) {
  const out: { text: string; start: number; end: number; space: boolean }[] = []
  const re = /\s+|[^\s]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) out.push({ text: m[0], start: m.index, end: m.index + m[0].length, space: /^\s/.test(m[0]) })
  return out
}

/** Split text into sentence ranges for background sentence highlighting. */
function splitSentences(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  const re = /[^.!?।\n]+[.!?।\n]?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m[0].trim()) out.push({ start: m.index, end: m.index + m[0].length })
  }
  return out
}
