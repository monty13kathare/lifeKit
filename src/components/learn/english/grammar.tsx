"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Check, CircleCheck, Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useLearn } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { useAiStatus } from "@/hooks/use-ai-status"
import { aiAssist } from "@/lib/ai/client"
import { cn } from "@/lib/utils"
import { ENGLISH_LEVELS, GRAMMAR_LESSONS, LEVEL_LABEL, type EnglishLevel, type GrammarLesson, type QuizQuestion } from "@/data/learn/english"
import { errorMessage, finishLesson, grantXp, isAbort } from "./english-utils"
import { QuizRunner } from "./quiz-runner"
import { SimpleSelect } from "./simple-select"

const PASS_RATIO = 0.6
const LESSON_XP = 15
const lessonKey = (id: string) => `english:grammar:${id}`

type View = { kind: "list" } | { kind: "lesson"; id: string } | { kind: "quiz"; id: string; run: number } | { kind: "ai"; id: string; questions: QuizQuestion[]; run: number }

export function Grammar() {
  const hydrated = useHydrated()
  const { completedLessons } = useLearn()
  const [view, setView] = useState<View>({ kind: "list" })

  if (!hydrated) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (view.kind === "list") {
    const done = GRAMMAR_LESSONS.filter((l) => completedLessons.includes(lessonKey(l.id))).length
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {done} of {GRAMMAR_LESSONS.length} lessons complete · score {Math.round(PASS_RATIO * 100)}% or more on a quiz to finish a lesson (+{LESSON_XP} XP).
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GRAMMAR_LESSONS.map((l) => {
            const complete = completedLessons.includes(lessonKey(l.id))
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => setView({ kind: "lesson", id: l.id })}
                  className="flex h-full w-full flex-col gap-2 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-surface-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">{LEVEL_LABEL[l.level]}</Badge>
                    {complete ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-success">
                        <CircleCheck className="size-4" aria-hidden /> Done
                      </span>
                    ) : null}
                  </span>
                  <span className="font-semibold">{l.title}</span>
                  <span className="text-sm text-muted-foreground">{l.summary}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  const lesson = GRAMMAR_LESSONS.find((l) => l.id === view.id) ?? GRAMMAR_LESSONS[0]
  const toLesson = () => setView({ kind: "lesson", id: lesson.id })

  if (view.kind === "quiz") {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <h2 className="font-semibold">Quiz: {lesson.title}</h2>
        <QuizRunner
          key={view.run}
          questions={lesson.quiz}
          onFinish={(correct, total) => {
            if (correct / total >= PASS_RATIO) {
              if (!finishLesson(lessonKey(lesson.id), lesson.title, LESSON_XP)) toast.success("Nice work!", { description: "You've already completed this lesson." })
            }
          }}
          resultExtra={(correct, total) =>
            correct / total >= PASS_RATIO ? (
              <p className="text-sm font-medium text-success">Lesson passed!</p>
            ) : (
              <p className="text-sm text-muted-foreground">You need {Math.ceil(total * PASS_RATIO)} correct to pass. Review the rules and try again.</p>
            )
          }
          onRetry={() => setView({ kind: "quiz", id: lesson.id, run: view.run + 1 })}
          onExit={toLesson}
          exitLabel="Back to lesson"
        />
      </div>
    )
  }

  if (view.kind === "ai") {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden /> More practice: {lesson.title}
        </h2>
        <QuizRunner
          key={view.run}
          questions={view.questions}
          onFinish={(correct, total) => grantXp(correct * 2, `Grammar practice (${lesson.title}): ${correct}/${total}`)}
          onExit={toLesson}
          exitLabel="Back to lesson"
        />
        <p className="text-xs text-muted-foreground">Questions generated by Google Gemini — AI can occasionally make mistakes.</p>
      </div>
    )
  }

  return (
    <LessonView
      lesson={lesson}
      complete={completedLessons.includes(lessonKey(lesson.id))}
      onBack={() => setView({ kind: "list" })}
      onQuiz={() => setView({ kind: "quiz", id: lesson.id, run: 0 })}
      onAiQuiz={(questions) => setView({ kind: "ai", id: lesson.id, questions, run: Date.now() })}
    />
  )
}

function LessonView({
  lesson,
  complete,
  onBack,
  onQuiz,
  onAiQuiz,
}: {
  lesson: GrammarLesson
  complete: boolean
  onBack: () => void
  onQuiz: () => void
  onAiQuiz: (questions: QuizQuestion[]) => void
}) {
  const ai = useAiStatus()
  const [level, setLevel] = useState<EnglishLevel>(lesson.level)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const generate = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    try {
      const res = await aiAssist("english-quiz", JSON.stringify({ topic: `${lesson.title} — ${lesson.summary}`, level, count: 5 }), controller.signal)
      const questions: QuizQuestion[] = res.questions
        .filter((q) => q.options.length === 4 && q.answerIndex >= 0 && q.answerIndex < 4)
        .map((q) => ({ kind: "mcq", question: q.question, options: q.options, answerIndex: q.answerIndex, explanation: q.explanation }))
      if (!questions.length) throw new Error("The AI didn't return any usable questions. Please try again.")
      onAiQuiz(questions)
    } catch (err) {
      if (!isAbort(err)) toast.error("Couldn't create practice questions", { description: errorMessage(err) })
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setLoading(false)
      }
    }
  }

  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <Button variant="ghost" onClick={onBack} className="-ml-2">
        <ArrowLeft /> All lessons
      </Button>
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{LEVEL_LABEL[lesson.level]}</Badge>
          {complete ? (
            <span className="flex items-center gap-1 text-xs font-medium text-success">
              <CircleCheck className="size-4" aria-hidden /> Completed
            </span>
          ) : null}
        </div>
        <h2 className="text-xl font-semibold">{lesson.title}</h2>
        <p className="text-muted-foreground">{lesson.summary}</p>
      </header>

      <section aria-labelledby="rules-title" className="rounded-2xl border bg-card p-4 sm:p-5">
        <h3 id="rules-title" className="font-semibold">
          Rules
        </h3>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
          {lesson.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="examples-title" className="rounded-2xl border bg-card p-4 sm:p-5">
        <h3 id="examples-title" className="font-semibold">
          Examples
        </h3>
        <ul className="mt-2 space-y-2">
          {lesson.examples.map((ex) => (
            <li key={ex.right} className="rounded-xl bg-surface-muted p-3 text-sm">
              <p className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="Correct" />
                <span>{ex.right}</span>
              </p>
              {ex.wrong ? (
                <p className="mt-1 flex gap-2 text-muted-foreground">
                  <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Incorrect" />
                  <span className="line-through decoration-destructive/60">{ex.wrong}</span>
                </p>
              ) : null}
              {ex.note ? <p className="mt-1 pl-6 text-xs text-muted-foreground">{ex.note}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
        <Button size="lg" onClick={onQuiz}>
          Take the quiz ({lesson.quiz.length} questions)
        </Button>
        {ai?.configured ? (
          <div className={cn("space-y-2 border-t pt-3")}>
            <p className="text-sm font-medium">Want more practice?</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <SimpleSelect id="grammar-ai-level" label="Level" value={level} items={ENGLISH_LEVELS} onChange={setLevel} className="sm:w-44" />
              {loading ? (
                <div className="flex flex-1 gap-2">
                  <Button variant="outline" disabled className="flex-1">
                    <Loader2 className="animate-spin" /> Generating…
                  </Button>
                  <Button variant="ghost" onClick={() => abortRef.current?.abort()}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="flex-1" onClick={generate}>
                  <Sparkles /> More practice with AI
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">The topic and level are sent to Google Gemini to generate 5 new questions (+2 XP per correct answer).</p>
          </div>
        ) : null}
      </div>
    </article>
  )
}
