"use client"

import { useEffect } from "react"
import { Bookmark, BookmarkCheck, Check, Home, RotateCcw, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { starsFor } from "@/lib/learn/fun"
import { cn } from "@/lib/utils"
import type { FunMode } from "@/types"
import { Confetti, haptic, useCountUp } from "./celebrate"
import { tr, type ActiveQuiz } from "./fun-utils"
import type { GameSummary } from "./quiz-player"

const VERDICTS = [
  { en: "Every expert was once a beginner. Try again! 🌱", hi: "हर उस्ताद कभी शुरुआत करता था। फिर कोशिश करें! 🌱" },
  { en: "Nice effort — you're getting there! 💪", hi: "अच्छी कोशिश — आप आगे बढ़ रहे हैं! 💪" },
  { en: "Great job! Your brain is warming up! 🔥", hi: "बहुत बढ़िया! दिमाग़ गरम हो रहा है! 🔥" },
  { en: "Superstar! Outstanding score! 🏆", hi: "सुपरस्टार! शानदार स्कोर! 🏆" },
]

const MEDALS = [
  { emoji: "💪", stroke: "stroke-muted-foreground", glow: "bg-muted-foreground/30" },
  { emoji: "🥉", stroke: "stroke-orange-500", glow: "bg-orange-500/40" },
  { emoji: "🥈", stroke: "stroke-sky-500", glow: "bg-sky-500/40" },
  { emoji: "🏆", stroke: "stroke-amber-400", glow: "bg-amber-400/45" },
]

interface QuizResultsProps {
  quiz: ActiveQuiz
  mode: FunMode
  summary: GameSummary
  levelUp: number | null
  saved: boolean
  aiEnabled: boolean
  onReplay: () => void
  onMore: () => void
  onSave: () => void
  onHome: () => void
}

export function QuizResults({ quiz, mode, summary, levelUp, saved, aiEnabled, onReplay, onMore, onSave, onHome }: QuizResultsProps) {
  const lang = quiz.language
  const total = quiz.questions.length
  const pct = Math.round((summary.correct / total) * 100)
  const stars = starsFor(pct)

  const shownPct = useCountUp(pct, 1200, 350)
  const shownXp = useCountUp(summary.xp, 1000, 900)
  const medal = MEDALS[stars]
  const ring = 2 * Math.PI * 52

  // A happy buzz for good results, once.
  useEffect(() => {
    if (stars >= 2) haptic([40, 60, 40, 60, 80])
  }, [stars])

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {stars >= 2 && <Confetti pieces={stars === 3 ? 48 : 30} />}
      <section className="relative overflow-hidden rounded-3xl border bg-card px-5 pt-6 pb-5 text-center shadow-soft">
        {/* Soft glow behind the medal */}
        <div className={cn("pointer-events-none absolute top-6 left-1/2 size-48 -translate-x-1/2 rounded-full blur-3xl animate-lk-glow", medal.glow)} aria-hidden />

        <div className="relative">
          <p className="mx-auto max-w-full truncate rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-block">
            {summary.gameOver ? tr(lang, { en: "Game over", hi: "खेल समाप्त" }) : tr(lang, { en: "Quiz complete", hi: "क्विज़ पूरा" })} · {quiz.title}
          </p>

          {/* Score ring with the medal inside */}
          <div className="relative mx-auto mt-5 size-36">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
              <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-muted" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                className={medal.stroke}
                strokeDasharray={ring}
                strokeDashoffset={ring * (1 - shownPct / 100)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl leading-none animate-lk-drop" style={{ animationDelay: "150ms" }} aria-hidden>
                {medal.emoji}
              </span>
              <span className="mt-1 text-2xl font-bold tracking-tight tabular-nums" aria-label={`${pct} percent`}>
                {shownPct}%
              </span>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-2 text-3xl" role="img" aria-label={`${stars} of 3 stars`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={cn("animate-lk-pop", i < stars ? "drop-shadow-[0_2px_8px_rgba(250,204,21,0.55)]" : "opacity-20 grayscale")} style={{ animationDelay: `${900 + i * 220}ms` }}>
                ⭐
              </span>
            ))}
          </div>

          <p className="mt-3 text-lg font-semibold text-balance animate-lk-rise" style={{ animationDelay: "1.4s" }}>
            {tr(lang, VERDICTS[stars])}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground animate-lk-rise" style={{ animationDelay: "1.5s" }}>
            {mode === "study"
              ? tr(lang, { en: `You knew ${summary.correct} of ${total}`, hi: `${total} में से ${summary.correct} आपको पता थे` })
              : tr(lang, { en: `${summary.correct} of ${total} correct`, hi: `${total} में से ${summary.correct} सही` })}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
            <Stat value={`+${shownXp}`} label="XP ⭐" delay={1.6} highlight />
            {mode === "study" ? (
              <Stat value={`✅ ${summary.correct}`} label={tr(lang, { en: "Knew it", hi: "पता था" })} delay={1.7} />
            ) : (
              <Stat value={`🔥 ${summary.bestCombo}`} label={tr(lang, { en: "Best combo", hi: "सर्वश्रेष्ठ कॉम्बो" })} delay={1.7} />
            )}
            <Stat value={`${summary.answered}/${total}`} label={tr(lang, { en: "Answered", hi: "उत्तर दिए" })} delay={1.8} />
          </div>
          {levelUp && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-primary/15 via-primary/25 to-primary/15 px-3 py-2.5 font-semibold text-primary animate-lk-pop" style={{ animationDelay: "2s" }}>
              <span className="text-xl" aria-hidden>
                🎖️
              </span>
              {tr(lang, { en: `Level up! You reached level ${levelUp}`, hi: `लेवल अप! आप लेवल ${levelUp} पर पहुँचे` })}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button size="lg" onClick={onReplay}>
          <RotateCcw aria-hidden /> {tr(lang, { en: "Play again", hi: "फिर से खेलें" })}
        </Button>
        {aiEnabled && quiz.source === "ai" ? (
          <Button size="lg" variant="secondary" onClick={onMore}>
            <Sparkles aria-hidden /> {tr(lang, { en: "New questions", hi: "नए प्रश्न" })}
          </Button>
        ) : (
          <Button size="lg" variant="secondary" onClick={onHome}>
            <Home aria-hidden /> {tr(lang, { en: "All categories", hi: "सभी श्रेणियाँ" })}
          </Button>
        )}
        {quiz.source === "ai" && (
          <Button size="lg" variant="outline" onClick={onSave} disabled={saved}>
            {saved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
            {saved ? tr(lang, { en: "Saved to My quizzes", hi: "मेरे क्विज़ में सहेजा" }) : tr(lang, { en: "Save this quiz", hi: "यह क्विज़ सहेजें" })}
          </Button>
        )}
        {aiEnabled && quiz.source === "ai" && (
          <Button size="lg" variant="ghost" onClick={onHome}>
            <Home aria-hidden /> {tr(lang, { en: "All categories", hi: "सभी श्रेणियाँ" })}
          </Button>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{tr(lang, { en: "Review your answers", hi: "अपने उत्तर देखें" })}</h2>
        <ol className="space-y-2">
          {quiz.questions.map((q, i) => {
            const a = summary.answers[i]
            const reached = i < summary.answers.length
            const right = a === q.answerIndex
            return (
              <li key={i}>
                <details className="group rounded-2xl border bg-card p-3.5 open:shadow-soft">
                  <summary className="flex min-h-10 cursor-pointer list-none items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white",
                        !reached ? "bg-muted-foreground/40" : right ? "bg-success" : "bg-destructive"
                      )}
                      aria-label={!reached ? "Not reached" : right ? "Correct" : "Wrong"}
                    >
                      {right ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium wrap-break-word">{q.question}</span>
                  </summary>
                  <div className="mt-3 space-y-1.5 pl-9 text-sm">
                    {q.story?.trim() && <p className="line-clamp-3 text-muted-foreground">{q.story}</p>}
                    <p>
                      <span className="text-muted-foreground">{tr(lang, { en: "Answer:", hi: "उत्तर:" })}</span>{" "}
                      <span className="font-medium text-success">{q.options[q.answerIndex]}</span>
                    </p>
                    {reached && mode !== "study" && !right && (
                      <p>
                        <span className="text-muted-foreground">{tr(lang, { en: "You chose:", hi: "आपने चुना:" })}</span>{" "}
                        <span className="font-medium text-destructive">{a === null ? tr(lang, { en: "No answer (time up)", hi: "कोई उत्तर नहीं (समय ख़त्म)" }) : q.options[a!]}</span>
                      </p>
                    )}
                    <p className="leading-relaxed text-muted-foreground">{q.explanation}</p>
                    {q.hindi?.explanation && (
                      <p className="leading-relaxed text-muted-foreground" lang="hi">
                        {q.hindi.explanation}
                      </p>
                    )}
                  </div>
                </details>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}

function Stat({ value, label, delay = 0, highlight }: { value: string; label: string; delay?: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl px-2 py-2.5 animate-lk-rise", highlight ? "bg-primary/12 text-primary" : "bg-surface-muted")} style={{ animationDelay: `${delay}s` }}>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
