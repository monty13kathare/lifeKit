"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, ImageIcon, Loader2, Pause, RotateCcw, Sparkles, Trash2, Type, Volume2, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { StoryBook, StoryPage } from "@/types"
import { Confetti, haptic } from "../fun/celebrate"
import { tr } from "../fun/fun-utils"
import { SceneArt } from "./scene-art"
import { useReadAloud } from "./use-read-aloud"

const TEXT_SIZES = ["text-base", "text-lg", "text-xl"] as const

interface StoryReaderProps {
  story: StoryBook
  saved: boolean
  aiEnabled: boolean
  onBack: () => void
  onSave: () => void
  onDelete: () => void
  onNewStory: () => void
  onPageImage: (index: number, imageUrl: string | undefined) => void
}

/** Picture-book reader: one page at a time, swipe or tap to turn, read aloud. */
export function StoryReader({ story, saved, aiEnabled, onBack, onSave, onDelete, onNewStory, onPageImage }: StoryReaderProps) {
  const lang = story.language
  const t = (en: string, hi: string) => tr(lang, { en, hi })
  const total = story.pages.length
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const [size, setSize] = useState(1)
  const [wordAt, setWordAt] = useState<number | null>(null)
  const [autoPlay, setAutoPlay] = useState(false)
  const [painting, setPainting] = useState<number | null>(null)
  const [showArt, setShowArt] = useState<Record<number, boolean>>({})
  const voice = useReadAloud(lang)
  const touchX = useRef<number | null>(null)

  const atEnd = index === total
  const page: StoryPage | undefined = story.pages[index]

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
      onWord: setWordAt,
      onEnd: () => {
        setWordAt(null)
        // Continue with the next page (and finish on "The End").
        window.setTimeout(() => {
          setDir(1)
          setIndex(i + 1)
          if (i + 1 < total) readPage(i + 1)
          else setAutoPlay(false)
        }, 700)
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

  // Arrow keys turn pages on desktop.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keyRef.current = (e) => {
    if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return
    if (e.key === "ArrowRight") turn(index + 1)
    if (e.key === "ArrowLeft") turn(index - 1)
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  const paint = async (i: number) => {
    const p = story.pages[i]
    setPainting(i)
    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene: p.imagePrompt }),
      })
      const data = (await res.json().catch(() => ({}))) as { data?: string; mimeType?: string; error?: string }
      if (!res.ok || !data.data) throw new Error(data.error || "Couldn't make the picture.")
      const url = await compress(`data:${data.mimeType ?? "image/png"};base64,${data.data}`)
      onPageImage(i, url)
      setShowArt((s) => ({ ...s, [i]: false }))
    } catch (err) {
      toast.error(t("Couldn't make the picture", "चित्र नहीं बन पाया"), { description: err instanceof Error ? err.message : undefined })
    } finally {
      setPainting(null)
    }
  }

  const words = useMemo(() => (page ? tokenize(page.text) : []), [page])

  return (
    <div className="mx-auto max-w-2xl space-y-3" lang={lang}>
      {/* Top bar */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={t("Back to stories", "कहानियों पर वापस")}>
          <ArrowLeft aria-hidden />
        </Button>
        <p className="min-w-0 flex-1 truncate font-semibold">{story.title}</p>
        <Button variant="ghost" size="icon" onClick={() => setSize((s) => (s + 1) % TEXT_SIZES.length)} aria-label={t("Change text size", "अक्षर का आकार बदलें")}>
          <Type aria-hidden />
        </Button>
        <Button variant={saved ? "ghost" : "outline"} size="icon" onClick={onSave} disabled={saved} aria-label={saved ? t("Saved", "सहेजी गई") : t("Save story", "कहानी सहेजें")}>
          {saved ? <BookmarkCheck className="text-primary" aria-hidden /> : <Bookmark aria-hidden />}
        </Button>
        {saved && (
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label={t("Delete story", "कहानी हटाएँ")}>
            <Trash2 aria-hidden />
          </Button>
        )}
      </div>

      {/* Progress */}
      <div className="flex gap-1" role="progressbar" aria-label={t("Story progress", "कहानी की प्रगति")} aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(index + 1, total)}>
        {Array.from({ length: total + 1 }, (_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= index ? "bg-primary" : "bg-muted")} />
        ))}
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
          className={cn("overflow-hidden rounded-3xl border bg-card shadow-soft animate-in fade-in duration-500", dir === 1 ? "slide-in-from-right-8" : "slide-in-from-left-8")}
        >
          {page ? (
            <>
              <div className="relative p-2 pb-0">
                {page.imageUrl && !showArt[index] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local data URL, nothing for next/image to optimise
                  <img src={page.imageUrl} alt={t("Illustration for this page", "इस पेज का चित्र")} className="aspect-[4/3] w-full rounded-2xl object-cover" />
                ) : (
                  <SceneArt scene={page.scene} />
                )}
                <div className="absolute right-4 bottom-2 flex gap-1.5">
                  {page.imageUrl && (
                    <Button size="sm" variant="secondary" className="h-9 bg-background/85 backdrop-blur" onClick={() => setShowArt((s) => ({ ...s, [index]: !s[index] }))}>
                      <ImageIcon aria-hidden /> {showArt[index] ? t("Picture", "चित्र") : t("Drawing", "ड्रॉइंग")}
                    </Button>
                  )}
                  {aiEnabled && !page.imageUrl && (
                    <Button size="sm" variant="secondary" className="h-9 bg-background/85 backdrop-blur" onClick={() => void paint(index)} disabled={painting !== null}>
                      {painting === index ? <Loader2 className="animate-spin" aria-hidden /> : <Wand2 aria-hidden />}
                      {painting === index ? t("Painting…", "बन रहा है…") : t("Make real picture", "असली चित्र बनाएँ")}
                    </Button>
                  )}
                </div>
              </div>
              <p className={cn("p-5 leading-relaxed text-pretty sm:p-6", TEXT_SIZES[size])} aria-live={voice.speaking ? "off" : "polite"}>
                {words.map((w, i) =>
                  w.space ? (
                    <span key={i}>{w.text}</span>
                  ) : (
                    <span key={i} className={cn("rounded transition-colors", wordAt !== null && wordAt >= w.start && wordAt < w.end && "bg-primary/25")}>
                      {w.text}
                    </span>
                  )
                )}
              </p>
            </>
          ) : (
            <EndPage story={story} onRestart={() => turn(0)} onNewStory={onNewStory} lang={lang} />
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex items-center gap-2 rounded-2xl border bg-card/90 p-2 shadow-soft backdrop-blur lg:bottom-4">
        <Button variant="outline" size="icon" className="size-11" onClick={() => turn(index - 1)} disabled={index === 0} aria-label={t("Previous page", "पिछला पेज")}>
          <ChevronLeft aria-hidden />
        </Button>
        {voice.supported ? (
          <Button className="h-11 flex-1" variant={voice.speaking || autoPlay ? "secondary" : "default"} onClick={toggleRead}>
            {voice.speaking || autoPlay ? <Pause aria-hidden /> : <Volume2 aria-hidden />}
            {voice.speaking || autoPlay ? t("Pause", "रोकें") : t("Read aloud", "सुनें")}
          </Button>
        ) : (
          <span className="flex-1 text-center text-xs text-muted-foreground">{t("Read aloud isn't supported in this browser.", "इस ब्राउज़र में सुनने की सुविधा नहीं है।")}</span>
        )}
        <span className="w-12 text-center text-sm font-medium text-muted-foreground tabular-nums">{atEnd ? "✓" : `${index + 1}/${total}`}</span>
        <Button variant="outline" size="icon" className="size-11" onClick={() => turn(index + 1)} disabled={atEnd} aria-label={t("Next page", "अगला पेज")}>
          <ChevronRight aria-hidden />
        </Button>
      </div>
      {voice.supported && !voice.hasVoice && lang === "hi" && (
        <p className="text-center text-xs text-muted-foreground">No Hindi voice is installed on this device, so a default voice is used.</p>
      )}
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

/** Shrink an AI picture to a small JPEG so saved stories fit in browser storage. */
function compress(dataUrl: string, maxW = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxW / img.naturalWidth)
      const c = document.createElement("canvas")
      c.width = Math.round(img.naturalWidth * scale)
      c.height = Math.round(img.naturalHeight * scale)
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL("image/jpeg", 0.72))
    }
    img.onerror = () => reject(new Error("The picture couldn't be read."))
    img.src = dataUrl
  })
}
