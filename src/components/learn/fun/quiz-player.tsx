"use client"

import { useEffect, useEffectEvent, useState } from "react"
import { BookOpen, Check, Divide, Flame, Heart, Lightbulb, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { answerXp, LIVES, timeLimit } from "@/lib/learn/fun"
import { cn } from "@/lib/utils"
import type { FunLanguage, FunMode, FunQuestion } from "@/types"
import { haptic } from "./celebrate"
import { tr, type ActiveQuiz } from "./fun-utils"

export interface GameSummary {
  /** Chosen option per question; null = timed out / still learning; undefined = not reached. */
  answers: (number | null)[]
  answered: number
  correct: number
  xp: number
  bestCombo: number
  /** Survival: ran out of lives before the end. */
  gameOver: boolean
}

const CHEERS = [
  { en: "Brilliant! 🎉", hi: "शानदार! 🎉" },
  { en: "Spot on! ✨", hi: "बिल्कुल सही! ✨" },
  { en: "You nailed it! 🚀", hi: "कमाल कर दिया! 🚀" },
  { en: "Genius move! 🧠", hi: "दिमाग़ वाली बात! 🧠" },
]
const OOPS = [
  { en: "Not quite — now you know! 💡", hi: "थोड़ा चूक गए — अब आप जान गए! 💡" },
  { en: "Good try! Learn the trick below 👇", hi: "अच्छी कोशिश! नीचे तरीका सीखें 👇" },
]

const MAX_HINTS = 2

export function QuizPlayer({ quiz, mode, onFinish, onQuit }: { quiz: ActiveQuiz; mode: FunMode; onFinish: (s: GameSummary) => void; onQuit: () => void }) {
  const lang = quiz.language
  const total = quiz.questions.length
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [xp, setXp] = useState(0)
  const [gain, setGain] = useState(0)
  const [lives, setLives] = useState(LIVES)
  const [fiftyUsed, setFiftyUsed] = useState(false)
  const [removed, setRemoved] = useState<number[]>([])
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS)
  const [hintShown, setHintShown] = useState(false)
  const [deadline, setDeadline] = useState(() => Date.now() + timeLimit(quiz.questions[0]) * 1000)
  const [now, setNow] = useState(() => Date.now())
  const [cheer, setCheer] = useState(0)

  const q = quiz.questions[index]
  const isLast = index === total - 1
  const limit = timeLimit(q)
  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000))
  const correctCount = answers.filter((a, i) => a === quiz.questions[i].answerIndex).length

  const choose = (option: number | null) => {
    if (revealed) return
    const right = option === q.answerIndex
    const nextCombo = right ? combo + 1 : 0
    const earned = right ? answerXp({ mode, combo: nextCombo, secondsLeft: mode === "timed" ? secondsLeft : undefined, usedHint: hintShown }) : 0
    setSelected(option)
    setRevealed(true)
    setAnswers((prev) => [...prev, option])
    setCombo(nextCombo)
    setBestCombo((b) => Math.max(b, nextCombo))
    setXp((x) => x + earned)
    setGain(earned)
    setCheer(Math.floor(Math.random() * 12))
    if (!right && mode === "survival") setLives((l) => l - 1)
    haptic(right ? 25 : [70, 50, 70])
  }

  const next = () => {
    const outOfLives = mode === "survival" && lives <= 0
    if (isLast || outOfLives) {
      onFinish({ answers, answered: answers.length, correct: correctCount, xp, bestCombo, gameOver: outOfLives && !isLast })
      return
    }
    const following = quiz.questions[index + 1]
    setIndex(index + 1)
    setSelected(null)
    setRevealed(false)
    setRemoved([])
    setHintShown(false)
    setGain(0)
    const t = Date.now()
    setNow(t)
    setDeadline(t + timeLimit(following) * 1000)
  }

  const applyFifty = () => {
    if (fiftyUsed || revealed) return
    const wrong = [0, 1, 2, 3].filter((i) => i !== q.answerIndex).sort(() => Math.random() - 0.5)
    setRemoved(wrong.slice(0, 2))
    setFiftyUsed(true)
  }

  const revealHint = () => {
    if (hintsLeft <= 0 || hintShown || revealed || !q.hint) return
    setHintShown(true)
    setHintsLeft((h) => h - 1)
  }

  // Each question (and its story) starts at the top on small screens.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [index])

  // Speed Round countdown.
  const onTick = useEffectEvent(() => {
    const t = Date.now()
    setNow(t)
    if (t >= deadline) choose(null)
  })
  useEffect(() => {
    if (mode !== "timed" || revealed) return
    const id = window.setInterval(() => onTick(), 250)
    return () => window.clearInterval(id)
  }, [mode, revealed, index])

  // Keyboard: 1–4 to answer, Enter to continue.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]")) return
    if (mode !== "study" && !revealed && /^[1-4]$/.test(e.key)) {
      const i = Number(e.key) - 1
      if (!removed.includes(i)) choose(i)
    } else if (revealed && e.key === "Enter") {
      e.preventDefault()
      next()
    }
  })
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e)
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const right = revealed && selected === q.answerIndex

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={onQuit} aria-label={tr(lang, { en: "Quit game", hi: "खेल छोड़ें" })}>
          <X aria-hidden />
        </Button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + (revealed ? 1 : 0)}>
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${((index + (revealed ? 1 : 0)) / total) * 100}%` }} />
        </div>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {index + 1}/{total}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {mode === "survival" && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/10 px-2.5 py-1" aria-label={`${lives} lives left`}>
            {Array.from({ length: LIVES }, (_, i) => (
              <Heart key={i} className={cn("size-4", i < lives ? "fill-destructive text-destructive" : "text-muted-foreground/40")} aria-hidden />
            ))}
          </span>
        )}
        {mode !== "study" && (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium", combo >= 3 ? "bg-orange-500/15 text-orange-600 dark:text-orange-300" : "bg-muted text-muted-foreground")}>
            <Flame className="size-4" aria-hidden /> {combo}
            {combo >= 3 && <span className="text-xs">{tr(lang, { en: "combo!", hi: "कॉम्बो!" })}</span>}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary tabular-nums">⭐ {xp} XP</span>
        {gain > 0 && (
          <span key={`${index}-gain`} className="animate-in fade-in slide-in-from-bottom-2 font-semibold text-success duration-500">
            +{gain}
          </span>
        )}
        {mode === "timed" && !revealed && (
          <span className={cn("ml-auto inline-flex min-w-14 justify-center rounded-full px-2.5 py-1 font-semibold tabular-nums", secondsLeft <= 5 ? "animate-pulse bg-destructive/15 text-destructive" : "bg-muted")}>
            ⏱ {secondsLeft}s
          </span>
        )}
      </div>

      {mode === "timed" && !revealed && (
        <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className={cn("h-full transition-[width] duration-300 ease-linear", secondsLeft <= 5 ? "bg-destructive" : "bg-warning")} style={{ width: `${(secondsLeft / limit) * 100}%` }} />
        </div>
      )}

      {/* Question card */}
      <div key={index} className="animate-in fade-in slide-in-from-right-4 space-y-4 rounded-2xl border bg-card p-4 shadow-soft duration-300 sm:p-6">
        <QuestionBody q={q} lang={lang} />

        {mode === "study" ? (
          <StudyCard q={q} lang={lang} revealed={revealed} onReveal={() => setRevealed(true)} />
        ) : (
          <ul className="grid gap-2.5">
            {q.options.map((opt, i) => {
              const gone = removed.includes(i)
              const isAnswer = i === q.answerIndex
              const isPicked = i === selected
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={revealed || gone}
                    onClick={() => choose(i)}
                    className={cn(
                      "flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-all",
                      !revealed && !gone && "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.99]",
                      gone && "opacity-30 line-through",
                      revealed && isAnswer && "border-success bg-success/10 animate-in zoom-in-95 duration-300",
                      revealed && isPicked && !isAnswer && "border-destructive bg-destructive/10 animate-lk-shake",
                      revealed && !isAnswer && !isPicked && "opacity-60"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold",
                        revealed && isAnswer && "bg-success text-white",
                        revealed && isPicked && !isAnswer && "bg-destructive text-white"
                      )}
                      aria-hidden
                    >
                      {revealed && isAnswer ? <Check className="size-4" /> : revealed && isPicked ? <X className="size-4" /> : String.fromCharCode(65 + i)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block wrap-break-word" lang={lang === "hi" ? "hi" : "en"}>
                        {opt}
                      </span>
                      {q.hindi?.options[i] && (
                        <span className="block text-sm wrap-break-word text-muted-foreground" lang="hi">
                          {q.hindi.options[i]}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {/* Lifelines */}
        {mode !== "study" && !revealed && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={applyFifty} disabled={fiftyUsed}>
              <Divide aria-hidden /> 50:50
            </Button>
            {q.hint && (
              <Button variant="outline" size="sm" onClick={revealHint} disabled={hintShown || hintsLeft <= 0}>
                <Lightbulb aria-hidden /> {tr(lang, { en: "Hint", hi: "संकेत" })} ({hintsLeft})
              </Button>
            )}
          </div>
        )}
        {hintShown && !revealed && q.hint && (
          <p className="animate-in fade-in rounded-xl bg-warning/10 px-3 py-2 text-sm" lang={lang === "hi" ? "hi" : "en"}>
            💡 {q.hint}
          </p>
        )}

        {/* Feedback */}
        {revealed && mode !== "study" && (
          <div className={cn("animate-in fade-in slide-in-from-bottom-2 space-y-1.5 rounded-xl p-3.5 duration-300", right ? "bg-success/10" : "bg-destructive/8")}>
            <p className={cn("font-semibold", right ? "text-success" : "text-destructive")}>
              {selected === null
                ? tr(lang, { en: "⏰ Time's up!", hi: "⏰ समय ख़त्म!" })
                : right
                  ? tr(lang, CHEERS[cheer % CHEERS.length])
                  : tr(lang, OOPS[cheer % OOPS.length])}
              {right && combo >= 3 && <span className="ml-2 text-sm">🔥 {tr(lang, { en: `${combo} in a row!`, hi: `लगातार ${combo}!` })}</span>}
            </p>
            <Explanation q={q} lang={lang} />
          </div>
        )}
      </div>

      {mode === "survival" && revealed && lives <= 0 && !isLast && (
        <p className="text-center font-medium text-destructive">{tr(lang, { en: "💔 Out of lives — game over!", hi: "💔 सारे जीवन ख़त्म — खेल समाप्त!" })}</p>
      )}

      {revealed && (mode !== "study" || answers.length > index) && (
        <Button size="lg" className="w-full" onClick={next} autoFocus>
          {isLast || (mode === "survival" && lives <= 0) ? tr(lang, { en: "See results 🏆", hi: "नतीजे देखें 🏆" }) : tr(lang, { en: "Next question →", hi: "अगला प्रश्न →" })}
        </Button>
      )}
      {mode === "study" && revealed && answers.length === index && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              setAnswers((prev) => [...prev, null])
            }}
          >
            🤔 {tr(lang, { en: "Still learning", hi: "अभी सीख रहा हूँ" })}
          </Button>
          <Button
            size="lg"
            onClick={() => {
              setAnswers((prev) => [...prev, q.answerIndex])
              setXp((x) => x + answerXp({ mode }))
            }}
          >
            😎 {tr(lang, { en: "I knew it", hi: "मुझे पता था" })}
          </Button>
        </div>
      )}
    </div>
  )
}

function QuestionBody({ q, lang }: { q: FunQuestion; lang: FunLanguage }) {
  return (
    <div className="space-y-3">
      {q.story?.trim() && (
        <div className="rounded-xl bg-surface-muted p-3.5 text-[0.95rem] leading-relaxed">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <BookOpen className="size-3.5" aria-hidden /> {tr(lang, { en: "Story", hi: "कहानी" })}
          </p>
          <p className="whitespace-pre-line" lang={lang === "hi" ? "hi" : "en"}>
            {q.story}
          </p>
          {q.hindi?.story?.trim() && (
            <p className="mt-2 border-t pt-2 whitespace-pre-line text-muted-foreground" lang="hi">
              {q.hindi.story}
            </p>
          )}
        </div>
      )}
      <div>
        <p className="text-lg leading-snug font-semibold text-balance sm:text-xl" lang={lang === "hi" ? "hi" : "en"}>
          {q.question}
        </p>
        {q.hindi?.question && (
          <p className="mt-1 text-base text-muted-foreground" lang="hi">
            {q.hindi.question}
          </p>
        )}
      </div>
    </div>
  )
}

function Explanation({ q, lang }: { q: FunQuestion; lang: FunLanguage }) {
  return (
    <>
      <p className="text-sm leading-relaxed" lang={lang === "hi" ? "hi" : "en"}>
        {q.explanation}
      </p>
      {q.hindi?.explanation && (
        <p className="text-sm leading-relaxed text-muted-foreground" lang="hi">
          {q.hindi.explanation}
        </p>
      )}
    </>
  )
}

function StudyCard({ q, lang, revealed, onReveal }: { q: FunQuestion; lang: FunLanguage; revealed: boolean; onReveal: () => void }) {
  if (!revealed) {
    return (
      <div className="space-y-3">
        <ul className="grid gap-2 sm:grid-cols-2">
          {q.options.map((opt, i) => (
            <li key={i} className="rounded-xl border px-3 py-2 text-sm">
              <span className="mr-2 font-semibold text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
              {opt}
              {q.hindi?.options[i] && <span className="block text-muted-foreground" lang="hi">{q.hindi.options[i]}</span>}
            </li>
          ))}
        </ul>
        <Button size="lg" variant="secondary" className="w-full" onClick={onReveal}>
          🃏 {tr(lang, { en: "Flip to see the answer", hi: "जवाब देखने के लिए पलटें" })}
        </Button>
      </div>
    )
  }
  return (
    <div className="animate-in fade-in zoom-in-95 space-y-2 rounded-xl border-2 border-success/40 bg-success/8 p-3.5 duration-300">
      <p className="font-semibold text-success">
        ✅ {String.fromCharCode(65 + q.answerIndex)}. {q.options[q.answerIndex]}
        {q.hindi?.options[q.answerIndex] && <span className="ml-1 font-normal text-muted-foreground" lang="hi">({q.hindi.options[q.answerIndex]})</span>}
      </p>
      <Explanation q={q} lang={lang} />
    </div>
  )
}
