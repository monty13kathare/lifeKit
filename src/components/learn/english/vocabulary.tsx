"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { BookOpenCheck, Brain, CalendarDays, Check, Search, Sparkles, Volume2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/common/empty-state"
import { useLearn } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { todayString } from "@/lib/dates"
import { cardsIntroducedOn, isCardDue, recordBest, reviewCard, type CardState } from "@/lib/learn/progress"
import { cn } from "@/lib/utils"
import { ENGLISH_LEVELS, LEVEL_LABEL, VOCABULARY, wordOfTheDay, type EnglishLevel, type QuizQuestion, type VocabWord } from "@/data/learn/english"
import { ACCENTS, canSpeak, grantXp, speak, useClientCheck, type Accent } from "./english-utils"
import { QuizRunner } from "./quiz-runner"
import { SimpleSelect } from "./simple-select"

type LevelFilter = "all" | EnglishLevel
const LEVEL_FILTERS: { value: LevelFilter; label: string }[] = [{ value: "all", label: "All levels" }, ...ENGLISH_LEVELS]

const NEW_PER_DAY = 10
const XP_PER_REVIEW = 2
const FLUSH_EVERY = 5
const LEARNED_BOX = 3


function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildVocabQuiz(pool: VocabWord[], count = 10): QuizQuestion[] {
  const source = pool.length >= 4 ? pool : VOCABULARY
  return shuffle(source)
    .slice(0, Math.min(count, source.length))
    .map((w) => {
      const distractors = shuffle(source.filter((d) => d.id !== w.id && d.meaning !== w.meaning)).slice(0, 3).map((d) => d.meaning)
      const options = shuffle([w.meaning, ...distractors])
      return {
        kind: "mcq" as const,
        question: `What does "${w.word}" (${w.pos}) mean?`,
        options,
        answerIndex: options.indexOf(w.meaning),
        explanation: `Example: ${w.example}`,
      }
    })
}

function SpeakButton({ text, accent, size = "icon-sm" }: { text: string; accent: Accent; size?: "icon-sm" | "icon" }) {
  const supported = useClientCheck(canSpeak)
  if (!supported) return null
  return (
    <Button
      variant="ghost"
      size={size}
      onClick={(e) => {
        e.stopPropagation()
        speak(text, accent, 0.9)
      }}
      aria-label={`Pronounce ${text}`}
      title="Pronounce"
    >
      <Volume2 />
    </Button>
  )
}

type Mode = { kind: "home" } | { kind: "review"; queue: VocabWord[]; newIds: string[] } | { kind: "quiz"; questions: QuizQuestion[]; key: number }

export function Vocabulary() {
  const hydrated = useHydrated()
  const state = useLearn()
  const [level, setLevel] = useState<LevelFilter>("all")
  const [accent, setAccent] = useState<Accent>("en-US")
  const [mode, setMode] = useState<Mode>({ kind: "home" })
  const today = todayString()

  const pool = useMemo(() => (level === "all" ? VOCABULARY : VOCABULARY.filter((w) => w.level === level)), [level])
  const stats = useMemo(() => {
    const due = pool.filter((w) => state.cards[w.id] && isCardDue(state.cards[w.id], today))
    const unseen = pool.filter((w) => !state.cards[w.id])
    const newLeft = Math.max(0, NEW_PER_DAY - cardsIntroducedOn(state.cards, today))
    const learned = VOCABULARY.filter((w) => (state.cards[w.id]?.box ?? 0) >= LEARNED_BOX).length
    return { due, newCards: unseen.slice(0, newLeft), learned, seen: VOCABULARY.filter((w) => state.cards[w.id]).length }
  }, [pool, state.cards, today])

  if (!hydrated) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  }

  if (mode.kind === "review") {
    return <Review queue={mode.queue} newIds={mode.newIds} accent={accent} onExit={() => setMode({ kind: "home" })} />
  }

  if (mode.kind === "quiz") {
    return (
      <div className="mx-auto max-w-2xl">
        <QuizRunner
          key={mode.key}
          questions={mode.questions}
          onFinish={(correct, total) => {
            const pct = Math.round((correct / total) * 100)
            if (recordBest("english:vocab-quiz", pct) && pct > 0) grantXp(correct, `Vocabulary quiz: ${correct}/${total} · new best`)
            else grantXp(correct, `Vocabulary quiz: ${correct}/${total}`)
          }}
          onRetry={() => setMode({ kind: "quiz", questions: buildVocabQuiz(pool), key: Date.now() })}
          onExit={() => setMode({ kind: "home" })}
          exitLabel="Done"
        />
      </div>
    )
  }

  const queueSize = stats.due.length + stats.newCards.length
  const wotd = wordOfTheDay(today)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <WordOfDay word={wotd} accent={accent} />

        <section aria-labelledby="fc-title" className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpenCheck className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id="fc-title" className="font-semibold">
                Flashcards
              </h2>
              <p className="text-sm text-muted-foreground">Spaced repetition: cards you know come back less often.</p>
            </div>
          </div>
          <p className="text-sm tabular-nums" aria-live="polite">
            <span className="font-semibold">{stats.due.length}</span> due · <span className="font-semibold">{stats.newCards.length}</span> new today ·{" "}
            <span className="font-semibold">{stats.learned}</span> learned
            <span className="text-muted-foreground"> of {VOCABULARY.length}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <SimpleSelect id="vocab-level" label="Level" value={level} items={LEVEL_FILTERS} onChange={setLevel} />
            <SimpleSelect id="vocab-accent" label="Voice" value={accent} items={ACCENTS} onChange={setAccent} />
          </div>
          <div className="mt-auto flex flex-col gap-2 sm:flex-row">
            <Button
              size="lg"
              className="flex-1"
              disabled={!queueSize}
              onClick={() => setMode({ kind: "review", queue: [...stats.due, ...stats.newCards], newIds: stats.newCards.map((w) => w.id) })}
            >
              <Brain /> {queueSize ? `Review ${queueSize} card${queueSize === 1 ? "" : "s"}` : "All done for today"}
            </Button>
            <Button size="lg" variant="outline" className="flex-1" onClick={() => setMode({ kind: "quiz", questions: buildVocabQuiz(pool), key: Date.now() })}>
              <Sparkles /> Quiz me
            </Button>
          </div>
          {!queueSize ? (
            <p className="text-xs text-muted-foreground">
              {stats.seen === VOCABULARY.length ? "You've seen every word." : `Up to ${NEW_PER_DAY} new cards a day.`} Come back tomorrow for more reviews, or try a quiz.
            </p>
          ) : null}
        </section>
      </div>

      <WordList pool={pool} cards={state.cards} accent={accent} />
    </div>
  )
}

function WordOfDay({ word, accent }: { word: VocabWord; accent: Accent }) {
  return (
    <section aria-labelledby="wotd-title" className="rounded-2xl border bg-card p-4 sm:p-5">
      <p id="wotd-title" className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <CalendarDays className="size-3.5" aria-hidden /> Word of the day
      </p>
      <div className="mt-2 flex items-center gap-2">
        <h3 className="text-2xl font-semibold tracking-tight wrap-break-word">{word.word}</h3>
        <SpeakButton text={word.word} accent={accent} />
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {word.pos} · {LEVEL_LABEL[word.level]}
        {word.hi ? <span lang="hi"> · {word.hi}</span> : null}
      </p>
      <p className="mt-3">{word.meaning}</p>
      <p className="mt-2 rounded-xl bg-surface-muted p-3 text-sm italic">“{word.example}”</p>
    </section>
  )
}

function WordList({ pool, cards, accent }: { pool: VocabWord[]; cards: Record<string, CardState>; accent: Accent }) {
  const [query, setQuery] = useState("")
  const [showAll, setShowAll] = useState(false)
  const q = query.trim().toLowerCase()
  const filtered = q ? pool.filter((w) => w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)) : pool
  const visible = showAll || q ? filtered : filtered.slice(0, 12)

  return (
    <section aria-labelledby="wl-title" className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="wl-title" className="font-semibold">
          Word list <span className="font-normal text-muted-foreground">({pool.length})</span>
        </h2>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search words" aria-label="Search words" className="h-10 pl-9" />
        </div>
      </div>
      {filtered.length ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((w) => {
            const box = cards[w.id]?.box
            return (
              <li key={w.id} className="flex gap-2 rounded-xl bg-surface-muted p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{w.word}</span>
                    <span className="text-xs text-muted-foreground">{w.pos}</span>
                    {box !== undefined && box >= LEARNED_BOX ? (
                      <Badge variant="secondary" className="text-success">
                        <Check aria-hidden /> learned
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{w.meaning}</p>
                </div>
                <SpeakButton text={w.word} accent={accent} />
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState icon={Search} title="No matching words" description="Try another search or level." className="mt-3" />
      )}
      {!q && filtered.length > 12 ? (
        <div className="mt-3 flex justify-center">
          <Button variant="ghost" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `Show all ${filtered.length}`}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------ review */

function Review({ queue, newIds, accent, onExit }: { queue: VocabWord[]; newIds: string[]; accent: Accent; onExit: () => void }) {
  const reduceMotion = useReducedMotion()
  const [list, setList] = useState(queue)
  const [pos, setPos] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [tally, setTally] = useState({ knew: 0, missed: 0 })
  const requeued = useRef(new Set<string>())
  const counted = useRef(new Set<string>())
  const pending = useRef({ reviews: 0, fresh: 0 })

  const flush = (quiet: boolean) => {
    const { reviews, fresh } = pending.current
    if (!reviews) return
    pending.current = { reviews: 0, fresh: 0 }
    grantXp(reviews * XP_PER_REVIEW, `Flashcards: ${reviews} reviewed (${fresh} new)`, { quiet })
  }
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  })
  // Save any un-awarded XP if the user leaves mid-session.
  useEffect(() => () => flushRef.current(true), [])

  const card = list[pos]
  const done = pos >= list.length

  const grade = (correct: boolean) => {
    if (!card || !flipped) return
    reviewCard(card.id, correct)
    pending.current.reviews++
    if (newIds.includes(card.id) && !counted.current.has(card.id)) {
      counted.current.add(card.id)
      pending.current.fresh++
    }
    setTally((t) => (correct ? { ...t, knew: t.knew + 1 } : { ...t, missed: t.missed + 1 }))
    if (!correct && !requeued.current.has(card.id)) {
      requeued.current.add(card.id)
      setList((l) => [...l, card])
    }
    if (pending.current.reviews >= FLUSH_EVERY) flush(false)
    setFlipped(false)
    setPos((p) => p + 1)
  }

  // Award the remainder when the session ends.
  useEffect(() => {
    if (done) flushRef.current(false)
  }, [done])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return
      if (done) return
      if (e.key === " " || e.key === "Spacebar") {
        if (target?.closest("button")) return // let buttons handle their own Space
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (flipped && e.key === "1") {
        e.preventDefault()
        grade(false)
      } else if (flipped && e.key === "2") {
        e.preventDefault()
        grade(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (done) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border bg-card p-6 text-center" aria-live="polite">
        <BookOpenCheck className="mx-auto size-10 text-success" aria-hidden />
        <h2 className="text-xl font-semibold">Session complete</h2>
        <p className="text-muted-foreground">
          {tally.knew} known · {tally.missed} to practise again. Cards you knew will come back in a few days.
        </p>
        <Button size="lg" onClick={onExit}>
          Back to vocabulary
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" onClick={onExit}>
          End session
        </Button>
        <span className="tabular-nums">
          {pos + 1} / {list.length}
        </span>
      </div>

      <div className="perspective-distant">
        <motion.div
          role="button"
          tabIndex={0}
          aria-label={flipped ? `${card.word}: ${card.meaning}. Example: ${card.example}` : `${card.word}. Press Space to reveal the meaning.`}
          onClick={() => setFlipped((f) => !f)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setFlipped((f) => !f)
          }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: "easeInOut" }}
          className="relative grid min-h-64 cursor-pointer rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 transform-3d"
        >
          <div className="col-start-1 row-start-1 flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-6 text-center shadow-soft backface-hidden">
            <p className="text-xs text-muted-foreground uppercase">{LEVEL_LABEL[card.level]}</p>
            <p className="text-3xl font-semibold tracking-tight wrap-break-word">{card.word}</p>
            <p className="text-sm text-muted-foreground">{card.pos}</p>
            <p className="mt-4 text-xs text-muted-foreground">Tap or press Space to flip</p>
          </div>
          <div className="col-start-1 row-start-1 flex rotate-y-180 flex-col justify-center gap-3 rounded-2xl border bg-card p-6 shadow-soft backface-hidden">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{card.word}</span> · {card.pos}
              {card.hi ? <span lang="hi"> · {card.hi}</span> : null}
            </p>
            <p className="text-lg">{card.meaning}</p>
            <p className="rounded-xl bg-surface-muted p-3 text-sm italic">“{card.example}”</p>
          </div>
        </motion.div>
      </div>

      <p className="sr-only" aria-live="polite">
        {flipped ? `${card.meaning}. Example: ${card.example}` : ""}
      </p>
      <div className="flex justify-center gap-2">
        <SpeakButton text={card.word} accent={accent} size="icon" />
        {flipped ? <SpeakButton text={card.example} accent={accent} size="icon" /> : null}
      </div>

      <div className={cn("grid grid-cols-2 gap-2 transition-opacity", !flipped && "pointer-events-none opacity-40")} aria-hidden={!flipped}>
        <Button size="lg" variant="outline" onClick={() => grade(false)} disabled={!flipped} className="text-destructive">
          <X /> Didn&apos;t know <kbd className="ml-1 hidden text-xs text-muted-foreground sm:inline">1</kbd>
        </Button>
        <Button size="lg" onClick={() => grade(true)} disabled={!flipped}>
          <Check /> I knew it <kbd className="ml-1 hidden text-xs opacity-70 sm:inline">2</kbd>
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">+{XP_PER_REVIEW} XP per card reviewed</p>
    </div>
  )
}
