"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { BookOpen, ChevronLeft, CircleCheck, CircleX, Clock, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Notice } from "@/components/common/notice"
import { useLearn } from "@/hooks/use-lifekit-data"
import { cn } from "@/lib/utils"
import { LESSON_XP, THINKING_LESSONS, type ThinkingLesson } from "@/data/learn/logic"
import { completeLogic } from "./shared"

const PASS = 2

export function ThinkingSkills() {
  const { completedLessons } = useLearn()
  const [openId, setOpenId] = useState<string | null>(null)
  const lesson = THINKING_LESSONS.find((l) => l.id === openId)
  const doneCount = THINKING_LESSONS.filter((l) => completedLessons.includes(l.id)).length

  if (lesson) {
    const index = THINKING_LESSONS.indexOf(lesson)
    const nextLesson = THINKING_LESSONS[index + 1]
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" className="-ml-2" onClick={() => setOpenId(null)}>
          <ChevronLeft aria-hidden /> All lessons
        </Button>
        <LessonView
          key={lesson.id}
          lesson={lesson}
          completed={completedLessons.includes(lesson.id)}
          onNext={nextLesson ? () => setOpenId(nextLesson.id) : undefined}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Short lessons on how good reasoning works. Pass the 3-question check (2 of 3) for{" "}
        <span className="font-medium text-foreground">+{LESSON_XP} XP</span>.{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {doneCount}/{THINKING_LESSONS.length}
        </span>{" "}
        complete.
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THINKING_LESSONS.map((l, i) => {
          const done = completedLessons.includes(l.id)
          return (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setOpenId(l.id)}
                className={cn(
                  "flex h-full w-full items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-surface-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  done && "border-success/30"
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    done ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                  )}
                >
                  {done ? <CircleCheck className="size-5" aria-label="Completed" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{l.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{l.summary}</span>
                  <span className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden /> {l.minutes} min
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function LessonView({ lesson, completed, onNext }: { lesson: ThinkingLesson; completed: boolean; onNext?: () => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => lesson.quiz.map(() => null))
  const [outcome, setOutcome] = useState<{ score: number; awarded: boolean } | null>(null)

  const allAnswered = answers.every((a) => a !== null)

  function choose(qi: number, oi: number) {
    if (answers[qi] !== null) return
    const next = answers.map((a, i) => (i === qi ? oi : a))
    setAnswers(next)
    if (next.every((a) => a !== null)) {
      const score = next.filter((a, i) => a === lesson.quiz[i].correct).length
      const awarded = score >= PASS ? completeLogic(lesson.id, lesson.title, LESSON_XP) : false
      setOutcome({ score, awarded })
    }
  }

  function retry() {
    setAnswers(lesson.quiz.map(() => null))
    setOutcome(null)
  }

  return (
    <article className="space-y-5">
      <header>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <BookOpen className="size-4" aria-hidden /> Thinking skills · {lesson.minutes} min
          {completed ? <span className="ml-1 text-success">· Completed</span> : null}
        </p>
        <h2 className="mt-1 text-xl font-semibold sm:text-2xl">{lesson.title}</h2>
        <p className="mt-1 text-muted-foreground">{lesson.summary}</p>
      </header>

      {lesson.sections.map((s) => (
        <section key={s.heading} className="space-y-2">
          <h3 className="font-semibold">{s.heading}</h3>
          {s.body.map((p) => (
            <p key={p} className="leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}

      <section className="space-y-2" aria-label="Examples">
        <h3 className="font-semibold">Examples</h3>
        <ul className="space-y-2">
          {lesson.examples.map((e) => (
            <li key={e.label} className="rounded-xl bg-surface-muted p-3.5 text-sm">
              <span className="font-medium">{e.label}: </span>
              <span className="text-muted-foreground">{e.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5" aria-label="Quick check">
        <h3 className="font-semibold">Quick check</h3>
        {lesson.quiz.map((q, qi) => {
          const chosen = answers[qi]
          return (
            <fieldset key={q.q} className="space-y-2">
              <legend className="mb-2 text-sm font-medium">
                {qi + 1}. {q.q}
              </legend>
              <div className="grid gap-2">
                {q.options.map((o, oi) => {
                  const state = chosen === null ? "idle" : oi === q.correct ? "right" : oi === chosen ? "wrong" : "dim"
                  return (
                    <button
                      key={o}
                      type="button"
                      disabled={chosen !== null}
                      aria-pressed={chosen === oi}
                      onClick={() => choose(qi, oi)}
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                        state === "idle" && "bg-card hover:bg-surface-muted",
                        state === "right" && "border-success bg-success/10",
                        state === "wrong" && "border-destructive bg-destructive/10",
                        state === "dim" && "opacity-60"
                      )}
                    >
                      <span>{o}</span>
                      {state === "right" ? <CircleCheck className="size-4.5 shrink-0 text-success" aria-label="Correct answer" /> : null}
                      {state === "wrong" ? <CircleX className="size-4.5 shrink-0 text-destructive" aria-label="Your answer, incorrect" /> : null}
                    </button>
                  )
                })}
              </div>
              {chosen !== null ? (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  <span className={chosen === q.correct ? "font-medium text-success" : "font-medium text-destructive"}>
                    {chosen === q.correct ? "Correct. " : "Not quite. "}
                  </span>
                  {q.why}
                </p>
              ) : null}
            </fieldset>
          )
        })}

        <div aria-live="polite">
          {allAnswered && outcome ? (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {outcome.score >= PASS ? (
                <Notice tone="success" title={`${outcome.score}/3 — lesson complete!${outcome.awarded ? ` +${LESSON_XP} XP` : ""}`}>
                  {outcome.awarded ? "Nice work." : "You'd already completed this lesson, so no extra XP this time."}
                </Notice>
              ) : (
                <Notice tone="warning" title={`${outcome.score}/3 — so close`}>
                  Get at least {PASS} right to complete the lesson. Re-read the examples and try again.
                </Notice>
              )}
              <div className="flex flex-wrap gap-2">
                {outcome.score < PASS ? (
                  <Button onClick={retry}>
                    <RotateCcw aria-hidden /> Try again
                  </Button>
                ) : null}
                {outcome.score >= PASS && onNext ? <Button onClick={onNext}>Next lesson</Button> : null}
              </div>
            </motion.div>
          ) : null}
        </div>
      </section>
    </article>
  )
}
