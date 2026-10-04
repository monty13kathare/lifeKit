"use client"

import { Bookmark, BookmarkCheck, Check, Home, RotateCcw, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { starsFor } from "@/lib/learn/fun"
import { cn } from "@/lib/utils"
import type { FunMode } from "@/types"
import { tr, type ActiveQuiz } from "./fun-utils"
import type { GameSummary } from "./quiz-player"

const VERDICTS = [
  { en: "Every expert was once a beginner. Try again! 🌱", hi: "हर उस्ताद कभी शुरुआत करता था। फिर कोशिश करें! 🌱" },
  { en: "Nice effort — you're getting there! 💪", hi: "अच्छी कोशिश — आप आगे बढ़ रहे हैं! 💪" },
  { en: "Great job! Your brain is warming up! 🔥", hi: "बहुत बढ़िया! दिमाग़ गरम हो रहा है! 🔥" },
  { en: "Superstar! Outstanding score! 🏆", hi: "सुपरस्टार! शानदार स्कोर! 🏆" },
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

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="relative overflow-hidden rounded-3xl border bg-card p-6 text-center shadow-soft">
        {stars >= 2 && (
          <div className="pointer-events-none absolute inset-0 flex justify-around text-2xl" aria-hidden>
            {["🎉", "✨", "🎊", "⭐", "🎉"].map((e, i) => (
              <span key={i} className="animate-in fade-in slide-in-from-top-10 fill-mode-both duration-700" style={{ animationDelay: `${i * 120}ms` }}>
                {e}
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <p className="text-sm font-medium text-muted-foreground">
            {summary.gameOver ? tr(lang, { en: "Game over", hi: "खेल समाप्त" }) : tr(lang, { en: "Quiz complete", hi: "क्विज़ पूरा" })} · {quiz.title}
          </p>
          <div className="mt-3 flex justify-center gap-1 text-4xl" aria-label={`${stars} of 3 stars`}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn("animate-in zoom-in-50 fill-mode-both duration-500", i < stars ? "" : "opacity-20 grayscale")}
                style={{ animationDelay: `${200 + i * 200}ms` }}
              >
                ⭐
              </span>
            ))}
          </div>
          <p className="mt-3 text-5xl font-bold tracking-tight tabular-nums">{pct}%</p>
          <p className="mt-1 text-muted-foreground">
            {mode === "study"
              ? tr(lang, { en: `You knew ${summary.correct} of ${total}`, hi: `${total} में से ${summary.correct} आपको पता थे` })
              : tr(lang, { en: `${summary.correct} of ${total} correct`, hi: `${total} में से ${summary.correct} सही` })}
          </p>
          <p className="mt-3 font-medium">{tr(lang, VERDICTS[stars])}</p>

          <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
            <Stat value={`+${summary.xp}`} label="XP" />
            <Stat value={`🔥 ${summary.bestCombo}`} label={tr(lang, { en: "Best combo", hi: "सर्वश्रेष्ठ कॉम्बो" })} />
            <Stat value={`${summary.answered}/${total}`} label={tr(lang, { en: "Answered", hi: "उत्तर दिए" })} />
          </div>
          {levelUp && (
            <p className="mt-4 animate-in zoom-in-95 rounded-xl bg-primary/10 px-3 py-2 font-semibold text-primary">
              🎖️ {tr(lang, { en: `Level up! You reached level ${levelUp}`, hi: `लेवल अप! आप लेवल ${levelUp} पर पहुँचे` })}
            </p>
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
                    <span className="min-w-0 flex-1 text-sm font-medium break-words">{q.question}</span>
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-surface-muted px-2 py-2.5">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
