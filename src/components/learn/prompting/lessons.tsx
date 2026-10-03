"use client"

import { useRef, useState } from "react"
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Clock, ThumbsDown, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLearn } from "@/hooks/use-lifekit-data"
import { cn } from "@/lib/utils"
import { PROMPT_LESSONS, type PromptLesson } from "@/data/learn/prompting"
import { AnswerFeedback, ChoiceOptions } from "./choice-options"
import { rewardLesson } from "./rewards"

export function Lessons() {
  const { completedLessons } = useLearn()
  const [openId, setOpenIdState] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const setOpenId = (id: string | null) => {
    setOpenIdState(id)
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }))
  }
  const done = PROMPT_LESSONS.filter((l) => completedLessons.includes(l.id)).length
  const index = PROMPT_LESSONS.findIndex((l) => l.id === openId)

  if (index >= 0) {
    const lesson = PROMPT_LESSONS[index]
    const next = PROMPT_LESSONS[index + 1]
    return (
      <div ref={topRef} className="scroll-mt-20">
        <LessonView
          key={lesson.id}
          lesson={lesson}
          number={index + 1}
          completed={completedLessons.includes(lesson.id)}
          onBack={() => setOpenId(null)}
          onNext={next ? () => setOpenId(next.id) : undefined}
        />
      </div>
    )
  }

  return (
    <div ref={topRef} className="scroll-mt-20 space-y-3">
      <p className="text-sm text-muted-foreground">
        {done}/{PROMPT_LESSONS.length} lessons completed · 20 XP each
      </p>
      <ol className="grid gap-2.5 md:grid-cols-2">
        {PROMPT_LESSONS.map((l, i) => {
          const isDone = completedLessons.includes(l.id)
          return (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setOpenId(l.id)}
                className="flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-colors outline-none hover:border-primary/40 hover:bg-surface-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
                    isDone ? "bg-success/12 text-success" : "bg-primary/10 text-primary"
                  )}
                >
                  {isDone ? <CheckCircle2 className="size-5" aria-label="Completed" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{l.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{l.summary}</span>
                  <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden /> {l.minutes} min
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function LessonView({
  lesson,
  number,
  completed,
  onBack,
  onNext,
}: {
  lesson: PromptLesson
  number: number
  completed: boolean
  onBack: () => void
  onNext?: () => void
}) {
  const [picks, setPicks] = useState<(number | null)[]>([null, null])
  const allAnswered = picks.every((p) => p !== null)

  return (
    <article className="mx-auto max-w-3xl space-y-5" aria-labelledby="lesson-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack} className="-ml-2">
          <ArrowLeft aria-hidden /> All lessons
        </Button>
        <span className="text-xs text-muted-foreground">
          Lesson {number} of {PROMPT_LESSONS.length} · {lesson.minutes} min
        </span>
      </div>

      <header>
        <h2 id="lesson-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
          {lesson.title}
        </h2>
        <p className="mt-1 text-muted-foreground">{lesson.summary}</p>
      </header>

      <div className="space-y-4">
        {lesson.sections.map((s) => (
          <section key={s.heading} className="rounded-2xl border bg-card p-4 sm:p-5">
            <h3 className="font-semibold">{s.heading}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            {s.bullets ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <section aria-label="Bad versus good prompt" className="grid gap-3 md:grid-cols-2">
        <ExampleCard tone="bad" prompt={lesson.bad.prompt} why={lesson.bad.why} />
        <ExampleCard tone="good" prompt={lesson.good.prompt} why={lesson.good.why} />
      </section>

      <section className="space-y-4 rounded-2xl border bg-surface p-4 sm:p-5" aria-labelledby="checks-title">
        <h3 id="checks-title" className="font-semibold">
          Quick check
        </h3>
        {lesson.checks.map((c, qi) => {
          const picked = picks[qi]
          return (
            <div key={c.question} className="space-y-2">
              <p className="text-sm font-medium">
                {qi + 1}. {c.question}
              </p>
              <ChoiceOptions
                name={`Question ${qi + 1}`}
                options={c.options}
                answer={c.answer}
                picked={picked}
                onPick={(i) => setPicks((p) => p.map((v, j) => (j === qi ? i : v)))}
              />
              <div aria-live="polite">{picked !== null ? <AnswerFeedback correct={picked === c.answer} explanation={c.explanation} /> : null}</div>
            </div>
          )
        })}
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {completed ? (
          <p className="flex items-center gap-1.5 self-center text-sm text-success sm:mr-auto">
            <CheckCircle2 className="size-4" aria-hidden /> Completed
          </p>
        ) : (
          <Button size="lg" disabled={!allAnswered} onClick={() => rewardLesson(lesson.id, lesson.title, 20)} className="sm:mr-auto">
            {allAnswered ? <CheckCircle2 aria-hidden /> : <Circle aria-hidden />}
            {allAnswered ? "Complete lesson · +20 XP" : "Answer both checks to complete"}
          </Button>
        )}
        {onNext ? (
          <Button size="lg" variant={completed ? "default" : "outline"} onClick={onNext}>
            Next lesson <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button size="lg" variant="outline" onClick={onBack}>
            Back to lessons
          </Button>
        )}
      </div>
    </article>
  )
}

function ExampleCard({ tone, prompt, why }: { tone: "bad" | "good"; prompt: string; why: string }) {
  const good = tone === "good"
  const Icon = good ? ThumbsUp : ThumbsDown
  return (
    <div className={cn("rounded-2xl border p-4", good ? "border-success/30 bg-success/6" : "border-destructive/25 bg-destructive/5")}>
      <p className={cn("flex items-center gap-1.5 text-sm font-semibold", good ? "text-success" : "text-destructive")}>
        <Icon className="size-4" aria-hidden /> {good ? "Good prompt" : "Bad prompt"}
      </p>
      <p className="mt-2 rounded-xl bg-card p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap wrap-break-word">{prompt}</p>
      <p className="mt-2 text-sm text-muted-foreground">{why}</p>
    </div>
  )
}
