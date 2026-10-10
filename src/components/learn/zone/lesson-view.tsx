"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Compass,
  ExternalLink,
  FileText,
  GraduationCap,
  Grid,
  Library,
  Lightbulb,
  ListOrdered,
  Loader2,
  Map,
  MessageCircleQuestion,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react"
import { z } from "zod"
import { CopyButton } from "@/components/common/copy-button"
import { InlineText, RichText, stripMarkdown } from "@/components/common/rich-text"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { getLessonSubject, LEVELS, STYLES } from "@/data/learn/lesson-subjects"
import { aiAssist } from "@/lib/ai/client"
import { assistInputLimit } from "@/lib/ai/assist-schemas"
import { cn } from "@/lib/utils"
import type { LessonContent, LearnLesson } from "@/types"
import { haptic } from "../fun/celebrate"
import { tr } from "../fun/fun-utils"
import { topicKey, TopicDeepDive, useTopicDetails, type TopicDetails } from "./topic-detail"

const doubtSchema = z.string().trim().min(3, "Type your doubt — a few words is enough.").max(400, "Keep your doubt under 400 characters.")

/** XP for finishing a lesson's quick check: 5 for reading + 5 per correct answer. */
export const lessonXp = (correct: number) => 5 + correct * 5

type T = (en: string, hi: string) => string

interface LessonViewProps {
  lesson: LearnLesson
  saved: boolean
  aiEnabled: boolean
  busy: boolean
  onBack: () => void
  onSave: () => void
  onDelete: () => void
  onSimpler: () => void
  onLearnTopic: (topic: string) => void
  onQuizDone: (correct: number, total: number) => void
  /** Persist changes to the lesson, e.g. fetched topic details. */
  onUpdate: (next: LearnLesson) => void
}

export function LessonView({ lesson, saved, aiEnabled, busy, onBack, onSave, onDelete, onSimpler, onLearnTopic, onQuizDone, onUpdate }: LessonViewProps) {
  const lang = lesson.language
  const d = lesson.data
  const subject = getLessonSubject(lesson.subject)
  const Icon = subject?.icon ?? Sparkles
  const topicState = useTopicDetails(lesson, onUpdate)
  const t: T = (en, hi) => tr(lang, { en, hi })

  // Sections present in this lesson, for the "jump to" bar.
  const jumps = [
    d.examModules?.length && { id: "lesson-modules", label: t("Modules", "मॉड्यूल") },
    d.syllabus?.length && { id: "lesson-syllabus", label: t("Syllabus", "सिलेबस") },
    d.studyGuide?.length && { id: "lesson-guide", label: t("Study guide", "गाइड") },
    d.story?.text?.trim() && { id: "lesson-story", label: t("Story", "कहानी") },
    d.keyIdeas.length > 0 && { id: "lesson-ideas", label: t("Key ideas", "मुख्य बातें") },
    d.examples.length > 0 && { id: "lesson-examples", label: t("Examples", "उदाहरण") },
    d.practice.length > 0 && { id: "lesson-quiz", label: t("Quick check", "जाँच") },
    aiEnabled && { id: "lesson-ask", label: t("Ask a doubt", "सवाल पूछें") },
  ].filter(Boolean) as { id: string; label: string }[]

  return (
    <article className={cn("relative mx-auto max-w-3xl space-y-4", busy && "pointer-events-none")} lang={lang} aria-busy={busy}>
      {busy && (
        <div className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl transition-all">
          <div className="relative flex flex-col items-center justify-center gap-8 animate-in zoom-in-95 fade-in duration-500">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <div className="absolute inset-0 animate-[spin_3s_linear_infinite] rounded-full border-[3px] border-transparent border-t-primary border-r-primary/50" />
              <div className="absolute inset-2 animate-[spin_2s_linear_infinite_reverse] rounded-full border-[3px] border-transparent border-b-primary border-l-primary/50" />
              <div className="absolute inset-4 animate-[spin_1.5s_linear_infinite] rounded-full border-[3px] border-transparent border-t-primary border-r-primary/50 opacity-70" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-tr from-primary to-primary/60 shadow-xl shadow-primary/40">
                <Sparkles className="h-7 w-7 text-primary-foreground animate-pulse" />
              </div>
            </div>
            <div className="flex flex-col items-center space-y-2 px-4 text-center">
              <h3 className="animate-pulse bg-linear-to-br from-foreground to-foreground/60 bg-clip-text text-2xl font-black tracking-tight text-transparent">
                {t("Generating Topic...", "विषय तैयार हो रहा है...")}
              </h3>
              <div className="flex items-center gap-2 rounded-full bg-muted/50 px-4 py-1.5 text-sm font-medium text-muted-foreground ring-1 ring-border/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>{t("Crafting highly detailed answer", "विस्तृत उत्तर तैयार किया जा रहा है")}...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={t("Back to Learning Zone", "लर्निंग ज़ोन पर वापस")}>
          <ArrowLeft aria-hidden />
        </Button>
        <div className="flex-1" />
        {aiEnabled && (
          <Button variant="outline" onClick={onSimpler} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            <span className="hidden sm:inline">{t("Explain more simply", "और आसान समझाएँ")}</span>
            <span className="sm:hidden">{t("Simpler", "आसान")}</span>
          </Button>
        )}
        <Button variant={saved ? "secondary" : "default"} onClick={onSave} disabled={saved} aria-label={saved ? t("Saved", "सहेजा गया") : t("Save lesson", "पाठ सहेजें")}>
          {saved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
          <span className="hidden sm:inline">{saved ? t("Saved", "सहेजा गया") : t("Save", "सहेजें")}</span>
        </Button>
        {saved && (
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label={t("Delete lesson", "पाठ हटाएँ")}>
            <Trash2 aria-hidden />
          </Button>
        )}
      </div>

      <header className="relative overflow-hidden rounded-3xl border bg-card p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/12 via-transparent to-transparent" aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1", subject?.accent ?? "bg-primary/10 text-primary")}>
              <Icon className="size-3.5" aria-hidden /> {subject ? tr(lang, subject.name) : t("Any topic", "कोई भी विषय")}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1">{tr(lang, LEVELS.find((l) => l.id === lesson.level)!.name)}</span>
            <span className="rounded-full bg-muted px-2.5 py-1">{tr(lang, STYLES.find((s) => s.id === lesson.style)!.name)}</span>
            {lesson.score !== undefined && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-success">
                <Trophy className="size-3.5" aria-hidden /> {lesson.score}%
              </span>
            )}
          </div>
          <h1 className="mt-3 text-2xl leading-tight font-bold tracking-tight text-balance sm:text-3xl">{d.title}</h1>
          <p className="mt-2 leading-relaxed whitespace-pre-line text-muted-foreground">
            <InlineText text={d.intro} />
          </p>

          {d.metadata && d.metadata.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
              {d.metadata.map((meta, i) => (
                <div key={i} className="flex min-w-0 flex-col rounded-xl border bg-background/50 p-2.5">
                  <span className="text-[0.7rem] font-medium tracking-wider text-muted-foreground uppercase">{meta.key}</span>
                  <span className="mt-0.5 text-sm font-semibold wrap-break-word">
                    <InlineText text={meta.value} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Jump-to bar */}
      {jumps.length > 2 && (
        <nav aria-label={t("Lesson sections", "पाठ के भाग")} className="sticky top-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)] z-20 -mx-1 lg:top-[calc(4rem+env(safe-area-inset-top)+0.5rem)] overflow-x-auto px-1 [scrollbar-width:none]">
          <div className="flex w-max gap-1.5 rounded-2xl border bg-card/90 p-1.5 shadow-soft backdrop-blur">
            {jumps.map((j) => (
              <a
                key={j.id}
                href={`#${j.id}`}
                className="inline-flex min-h-9 items-center rounded-xl px-3 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                {j.label}
              </a>
            ))}
          </div>
        </nav>
      )}

      {/* Tables (exam patterns, comparisons) — cards on mobile, a table from sm up */}
      {d.tables?.map(normalizeTable).filter((table) => table.rows.length > 0).map((table, i) => (
        <Section key={i} icon={Grid} tone="sky" title={table.title}>
          <div className="space-y-2 sm:hidden">
            {table.rows.map((row, r) => (
              <dl key={r} className="rounded-xl border bg-background/50 p-3 text-sm">
                {row.map((cell, c) => (
                  <div key={c} className={cn("flex gap-3 py-1", c > 0 && "border-t border-dashed")}>
                    <dt className="w-2/5 shrink-0 text-xs font-medium text-muted-foreground">{table.columns[c]}</dt>
                    <dd className={cn("min-w-0 wrap-break-word whitespace-pre-line", c === 0 && "font-semibold")}>
                      <InlineText text={cell} />
                    </dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-2xl border bg-background/50 sm:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <tr>
                  {table.columns.map((col, j) => (
                    <th key={j} className="px-4 py-3">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {table.rows.map((row, r) => (
                  <tr key={r} className="transition-colors hover:bg-muted/20">
                    {row.map((cell, c) => (
                      <td key={c} className="px-4 py-3 whitespace-pre-line">
                        <InlineText text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ))}

      {/* Exam modules — a course player */}
      {d.examModules && d.examModules.length > 0 && (
        <section id="lesson-modules" className="scroll-mt-32" aria-label={t("Course modules", "कोर्स मॉड्यूल")}>
          <CoursePlayer modules={d.examModules} lang={lang} t={t} aiEnabled={aiEnabled} busy={busy} onLearnTopic={onLearnTopic} topicState={topicState} />
        </section>
      )}

      {/* Syllabus */}
      {d.syllabus && d.syllabus.length > 0 && (
        <Section id="lesson-syllabus" icon={FileText} tone="sky" title={t("Complete syllabus", "पूरा सिलेबस")}>
          <Syllabus syllabus={d.syllabus} lang={lang} t={t} aiEnabled={aiEnabled} busy={busy} onLearnTopic={onLearnTopic} topicState={topicState} />
        </Section>
      )}

      {/* Explorable lists */}
      {d.explorableLists && d.explorableLists.length > 0 && (
        <Section icon={Grid} tone="indigo" title={t("Explore topics", "विषय एक्सप्लोर करें")}>
          <div className="space-y-4">
            {d.explorableLists.map((list, i) => (
              <div key={i}>
                <h3 className="font-semibold text-indigo-700 dark:text-indigo-300">{list.title}</h3>
                {list.description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{list.description}</p>}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {list.items.map((item, j) => (
                    <button
                      key={j}
                      type="button"
                      disabled={busy || !aiEnabled}
                      onClick={() => onLearnTopic(item.name)}
                      className="group flex min-h-11 flex-col items-start gap-1 rounded-xl border bg-background/50 p-3 text-left transition-colors enabled:hover:border-indigo-500/40 enabled:hover:bg-indigo-500/5"
                    >
                      <span className="flex w-full items-center justify-between gap-2 font-semibold">
                        {item.name}
                        {aiEnabled && <ArrowRight className="size-4 shrink-0 text-indigo-500/60 transition-transform group-hover:translate-x-0.5" aria-hidden />}
                      </span>
                      {item.subtitle && <span className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{item.subtitle}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Study guide */}
      {d.studyGuide && d.studyGuide.length > 0 && (
        <Section id="lesson-guide" icon={Map} tone="amber" title={t("Study guide", "अध्ययन गाइड")}>
          <ol className="relative space-y-4 border-l-2 border-amber-500/25 pl-5">
            {d.studyGuide.map((phase, i) => (
              <li key={i} className="relative">
                <span className="absolute top-0 left-[-2.05rem] flex size-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{i + 1}</span>
                <h3 className="font-semibold text-amber-700 dark:text-amber-300">{phase.phase}</h3>
                <RichText text={phase.description} className="mt-1.5" />
                {phase.tasks.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {phase.tasks.map((task, j) => (
                      <li key={j}>
                        <button
                          type="button"
                          disabled={busy || !aiEnabled}
                          onClick={() => onLearnTopic(task)}
                          className="group flex min-h-10 w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm text-muted-foreground transition-colors enabled:hover:bg-amber-500/10 enabled:hover:text-amber-700 dark:enabled:hover:text-amber-300"
                        >
                          <ChevronRight className="mt-0.5 size-4 shrink-0 text-amber-500/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
                          <span className="leading-relaxed">{task}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Story — first when the learner picked "learn through a story" */}
      {lesson.style === "story" && <StorySection story={d.story} t={t} />}

      {/* Key ideas */}
      {d.keyIdeas.length > 0 && (
      <Section id="lesson-ideas" icon={Lightbulb} tone="amber" title={t("Key ideas", "मुख्य बातें")}>
        <ol className="space-y-3">
          {d.keyIdeas.map((k, i) => (
            <li key={i} className="rounded-2xl border bg-background/50 p-4">
              <p className="flex items-start gap-2.5 font-semibold">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs text-primary">{i + 1}</span>
                {k.heading}
              </p>
              <RichText text={k.explanation} className="mt-2" />
              {k.example && (
                <div className="mt-3 rounded-xl border-l-4 border-amber-400 bg-amber-500/8 px-3 py-2.5">
                  <p className="mb-1 text-sm font-semibold text-amber-700 dark:text-amber-300">{t("Example", "उदाहरण")}</p>
                  <RichText text={k.example} />
                </div>
              )}
            </li>
          ))}
        </ol>
      </Section>
      )}

      {lesson.style !== "story" && <StorySection story={d.story} t={t} />}

      {/* Method */}
      {d.method.length > 0 && (
        <Section icon={ListOrdered} tone="sky" title={t("Step-by-step method", "चरण-दर-चरण तरीका")}>
          <ol className="space-y-2">
            {d.method.map((m, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-sky-500/12 text-xs font-semibold text-sky-700 dark:text-sky-300">{i + 1}</span>
                <span className="pt-0.5">
                  <InlineText text={m} />
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Worked examples */}
      {d.examples.length > 0 && (
        <Section id="lesson-examples" icon={Target} tone="emerald" title={t("Worked examples", "हल किए गए उदाहरण")}>
          <div className="space-y-3">
            {d.examples.map((ex, i) => (
              <WorkedExample key={i} n={i + 1} ex={ex} lang={lang} />
            ))}
          </div>
        </Section>
      )}

      {/* Tips & mistakes */}
      {(d.tips.length > 0 || d.mistakes.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {d.tips.length > 0 && (
            <Section icon={Sparkles} tone="emerald" title={t("Tips & shortcuts", "टिप्स और शॉर्टकट")}>
              <ul className="space-y-2 text-sm">
                {d.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    <span>
                      <InlineText text={tip} />
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {d.mistakes.length > 0 && (
            <Section icon={CircleAlert} tone="rose" title={t("Common mistakes", "आम गलतियाँ")}>
              <ul className="space-y-2 text-sm">
                {d.mistakes.map((m, i) => (
                  <li key={i} className="flex gap-2">
                    <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                    <span>
                      <InlineText text={m} />
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {/* Deep dive */}
      {d.deepDive && d.deepDive.content.length > 0 && (
        <Section icon={Compass} tone="sky" title={d.deepDive.title || t("Deep dive", "गहराई से समझें")}>
          <RichText text={d.deepDive.content.join("\n\n")} />
        </Section>
      )}

      {/* Resources */}
      {d.resources && d.resources.length > 0 && (
        <Section icon={Library} tone="violet" title={t("Study resources", "अध्ययन सामग्री")}>
          <div className="grid gap-3 md:grid-cols-2">
            {d.resources.map((res, i) => (
              <a
                key={i}
                href={`https://www.google.com/search?q=${encodeURIComponent(res.name + " " + res.type)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-2xl border bg-background/50 p-4 transition-colors hover:border-violet-500/40 hover:bg-violet-500/5 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 font-semibold transition-colors group-hover:text-violet-600 dark:group-hover:text-violet-400">
                    {res.name}
                    <ExternalLink className="size-3.5 shrink-0 text-violet-500 opacity-60" aria-hidden />
                  </h3>
                  <span className="shrink-0 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wider text-violet-600 uppercase dark:text-violet-300">{res.type}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{res.description}</p>
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* Quick check. Keys must differ from AskDoubt's: siblings sharing a key made React duplicate the quiz when it finished. */}
      {d.practice.length > 0 && <QuickCheck key={`quiz-${lesson.id}`} lesson={lesson} onDone={onQuizDone} />}

      {/* Summary */}
      {d.summary.length > 0 && (
        <Section icon={BookmarkCheck} tone="indigo" title={t("Key takeaways", "याद रखने वाली बातें")}>
          <ul className="space-y-2 text-sm">
            {d.summary.map((s, i) => (
              <li key={i} className="flex gap-2.5 rounded-xl bg-muted/60 px-3 py-2">
                <span className="font-semibold text-primary">{i + 1}.</span>
                <span>
                  <InlineText text={s} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Next topics */}
      {aiEnabled && d.nextTopics.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("Learn next", "आगे सीखें")}</h2>
          <div className="flex flex-wrap gap-2">
            {d.nextTopics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => onLearnTopic(topic)}
                disabled={busy}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary/8"
              >
                <Sparkles className="size-3.5 text-primary" aria-hidden /> {topic}
              </button>
            ))}
          </div>
        </section>
      )}

      {aiEnabled && <AskDoubt key={`ask-${lesson.id}`} lesson={lesson} />}
    </article>
  )
}

/** AI tables can come back ragged: pad/trim every row to the header, invent a header if missing. */
function normalizeTable(table: NonNullable<LessonContent["tables"]>[number]) {
  const width = Math.max(table.columns.length, ...table.rows.map((r) => r.length), 0)
  const columns = Array.from({ length: width }, (_, i) => table.columns[i]?.trim() || `#${i + 1}`)
  const rows = table.rows
    .filter((r) => r.some((c) => c?.trim()))
    .map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""))
  return { title: table.title, columns, rows }
}

function StorySection({ story, t }: { story: LessonContent["story"] | undefined; t: T }) {
  if (!story?.text?.trim()) return null
  return (
    <Section id="lesson-story" icon={BookOpen} tone="violet" title={story.title?.trim() || t("A short story", "एक छोटी कहानी")}>
      <div className="rounded-2xl border-l-4 border-violet-400 bg-violet-500/6 px-4 py-3">
        <RichText text={story.text} />
      </div>
    </Section>
  )
}

const TONES = {
  amber: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-300",
  sky: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  rose: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
  indigo: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300",
} as const

function Section({ id, icon: Icon, tone, title, action, children }: { id?: string; icon: typeof Lightbulb; tone: keyof typeof TONES; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <h2 className="flex flex-1 items-center gap-2.5 font-semibold">
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
            <Icon className="size-4" aria-hidden />
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function WorkedExample({ n, ex, lang }: { n: number; ex: LessonContent["examples"][number]; lang: LearnLesson["language"] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border bg-background/50 p-4">
      <p className="text-sm leading-relaxed">
        <span className="font-semibold">{tr(lang, { en: `Q${n}. `, hi: `प्रश्न ${n}. ` })}</span>
        <span className="whitespace-pre-line">
          <InlineText text={ex.question} />
        </span>
      </p>
      <Button variant="outline" size="sm" className="mt-3 h-10" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
        {open ? tr(lang, { en: "Hide solution", hi: "हल छिपाएँ" }) : tr(lang, { en: "Show solution", hi: "हल देखें" })}
      </Button>
      {open && (
        <div className="mt-3 animate-in space-y-2 fade-in slide-in-from-top-1">
          <ol className="space-y-1.5 text-sm leading-relaxed">
            {ex.steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-medium text-muted-foreground">{i + 1}.</span>
                <span>
                  <InlineText text={s} />
                </span>
              </li>
            ))}
          </ol>
          <p className="rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            {tr(lang, { en: "Answer: ", hi: "उत्तर: " })}
            <InlineText text={ex.answer} />
          </p>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ Syllabus */

type SyllabusTopic = NonNullable<LessonContent["syllabus"]>[number]["topics"][number]

/** Normalise a syllabus topic; older lessons hold strings, sometimes packing sub-topics into "Name (a, b, c)". */
function readTopic(topic: SyllabusTopic): { name: string; description?: string; subTopics: string[] } {
  if (typeof topic !== "string" && topic.subTopics?.length) return { name: topic.name, description: topic.description, subTopics: topic.subTopics }
  const name = typeof topic === "string" ? topic : topic.name
  const description = typeof topic === "string" ? undefined : topic.description
  const match = name.match(/^(.*?)\s*\((.*)\)$/)
  if (match && match[2].includes(",")) return { name: match[1].trim(), description, subTopics: match[2].split(",").map((s) => s.trim()).filter(Boolean) }
  return { name, description, subTopics: [] }
}

interface SyllabusProps {
  syllabus: NonNullable<LessonContent["syllabus"]>
  lang: LearnLesson["language"]
  t: T
  aiEnabled: boolean
  busy: boolean
  onLearnTopic: (topic: string) => void
  topicState: TopicDetails
}

function Syllabus({ syllabus, lang, t, aiEnabled, busy, onLearnTopic, topicState }: SyllabusProps) {
  const groups = useMemo(() => syllabus.map((g) => ({ subject: g.subject, topics: g.topics.map(readTopic) })), [syllabus])
  const allKeys = groups.flatMap((g, i) => g.topics.map((_, j) => `${i}-${j}`))
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const allOpen = open.size === allKeys.length
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t(`${groups.length} sections · ${allKeys.length} topics`, `${groups.length} भाग · ${allKeys.length} विषय`)}
        </p>
        <Button variant="outline" size="sm" className="h-10" onClick={() => setOpen(allOpen ? new Set() : new Set(allKeys))}>
          <ChevronsUpDown aria-hidden /> {allOpen ? t("Collapse all", "सब बंद करें") : t("Expand all", "सब खोलें")}
        </Button>
      </div>

      {groups.map((group, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border bg-background/50">
          <div className="flex items-center justify-between gap-2 border-b bg-sky-500/5 px-4 py-3">
            <h3 className="font-semibold text-sky-700 dark:text-sky-300">{group.subject}</h3>
            <span className="shrink-0 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300">
              {group.topics.length} {t("topics", "विषय")}
            </span>
          </div>
          <ul className="divide-y">
            {group.topics.map((topic, j) => {
              const key = `${i}-${j}`
              const expanded = open.has(key)
              const ready = !!topicState.details[topicKey(group.subject, topic.name)]
              const hint = [topic.description, topic.subTopics.length ? `Sub-topics: ${topic.subTopics.join(", ")}` : ""].filter(Boolean).join(" ")
              return (
                <li key={j} className={cn(expanded && "bg-sky-500/3")}>
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-expanded={expanded}
                    className="flex min-h-12 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-sky-500/5"
                  >
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-sky-500/12 text-xs font-semibold text-sky-700 dark:text-sky-300">{j + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug font-medium">{topic.name}</span>
                      {topic.description && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{topic.description}</span>}
                      {!expanded && topic.subTopics.length > 0 && (
                        <span className="mt-1 block truncate text-xs text-muted-foreground/80">{topic.subTopics.join(" · ")}</span>
                      )}
                    </span>
                    {ready && <CheckCircle2 className="mt-1 size-4 shrink-0 text-success" aria-label={t("Notes ready", "नोट्स तैयार")} />}
                    <ChevronDown className={cn("mt-1 size-4 shrink-0 text-sky-500 transition-transform", expanded && "rotate-180")} aria-hidden />
                  </button>

                  {expanded && (
                    <div className="animate-in space-y-3 px-4 pb-4 fade-in slide-in-from-top-1 sm:pl-13">
                      {topic.subTopics.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("Includes", "इसमें शामिल")}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {topic.subTopics.map((sub, k) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => onLearnTopic(`${topic.name} - ${sub}`)}
                                disabled={busy || !aiEnabled}
                                className="min-h-9 rounded-lg border bg-card px-2.5 py-1 text-xs font-medium transition-colors enabled:hover:border-sky-500/40 enabled:hover:bg-sky-500/10 enabled:hover:text-sky-700 dark:enabled:hover:text-sky-300"
                              >
                                {sub}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {aiEnabled && (
                        <>
                          <TopicDeepDive section={group.subject} topic={topic.name} hint={hint} lang={lang} state={topicState} tone="sky" />
                          <Button variant="ghost" size="sm" className="h-10 text-muted-foreground" disabled={busy} onClick={() => onLearnTopic(topic.name)}>
                            <BookOpen aria-hidden /> {t("Open as a full lesson", "पूरे पाठ के रूप में खोलें")}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------- Course player */

interface CoursePlayerProps {
  modules: NonNullable<LessonContent["examModules"]>
  lang: LearnLesson["language"]
  t: T
  aiEnabled: boolean
  busy: boolean
  onLearnTopic: (topic: string) => void
  topicState: TopicDetails
}

function CoursePlayer({ modules, lang, t, aiEnabled, busy, onLearnTopic, topicState }: CoursePlayerProps) {
  const flat = useMemo(() => modules.flatMap((m, mi) => m.topics.map((_, ti) => ({ mi, ti, key: `${mi}-${ti}` }))), [modules])
  const [pos, setPos] = useState(0)
  const [read, setRead] = useState<Set<string>>(() => new Set(flat[0] ? [flat[0].key] : []))
  const [finished, setFinished] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const current = flat[pos]
  if (!current) return null
  const mod = modules[current.mi]
  const topic = mod.topics[current.ti]
  const progress = Math.round((read.size / flat.length) * 100)
  const last = pos === flat.length - 1

  const go = (next: number) => {
    const target = flat[next]
    if (!target) return
    setPos(next)
    setRead((prev) => new Set(prev).add(target.key))
    setTocOpen(false)
    contentRef.current?.scrollTo({ top: 0 })
    // On mobile the content sits below the list; bring its start into view.
    if (window.matchMedia("(max-width: 639px)").matches) contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {/* Header + progress */}
      <div className="border-b p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
            <GraduationCap className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{t("Course modules", "कोर्स मॉड्यूल")}</h2>
            <p className="text-xs text-muted-foreground">
              {t(`${modules.length} modules · ${flat.length} topics · ${read.size} read`, `${modules.length} मॉड्यूल · ${flat.length} विषय · ${read.size} पढ़े`)}
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-10 sm:hidden" onClick={() => setTocOpen((o) => !o)} aria-expanded={tocOpen}>
            <ListOrdered aria-hidden /> {t("Topics", "विषय")}
          </Button>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t("Course progress", "कोर्स प्रगति")}>
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="sm:flex">
        {/* Table of contents: collapsible on mobile, sidebar from sm up */}
        <nav
          aria-label={t("Course topics", "कोर्स विषय")}
          className={cn("border-b bg-muted/30 p-3 sm:block sm:max-h-176 sm:w-64 sm:shrink-0 sm:overflow-y-auto sm:border-r sm:border-b-0", tocOpen ? "block" : "hidden")}
        >
          <div className="space-y-4">
            {modules.map((m, mi) => (
              <div key={mi}>
                <h3 className="mb-1 px-2 text-xs leading-snug font-semibold text-muted-foreground">{m.title}</h3>
                <ul className="space-y-0.5">
                  {m.topics.map((tp, ti) => {
                    const index = flat.findIndex((f) => f.mi === mi && f.ti === ti)
                    const active = index === pos
                    const done = read.has(`${mi}-${ti}`)
                    return (
                      <li key={ti}>
                        <button
                          type="button"
                          onClick={() => go(index)}
                          aria-current={active ? "true" : undefined}
                          className={cn(
                            "flex min-h-10 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                            active ? "bg-emerald-600 font-medium text-white" : "text-muted-foreground hover:bg-emerald-500/10 hover:text-foreground"
                          )}
                        >
                          {done && !active ? (
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden />
                          ) : (
                            <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border text-[0.6rem]", active ? "border-white/70" : "border-muted-foreground/40")} aria-hidden>
                              {index + 1}
                            </span>
                          )}
                          <span className="min-w-0 leading-snug">{tp.name}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div ref={contentRef} className="min-w-0 flex-1 scroll-mt-32 p-4 sm:max-h-176 sm:overflow-y-auto sm:p-6">
          <div key={current.key} className="animate-in space-y-5 fade-in duration-300">
            <div>
              <p className="text-xs leading-snug font-semibold text-emerald-600 dark:text-emerald-400">
                {mod.title} · {t(`Topic ${current.ti + 1} of ${mod.topics.length}`, `विषय ${current.ti + 1} / ${mod.topics.length}`)}
              </p>
              <h3 className="mt-1.5 text-xl font-bold tracking-tight text-balance sm:text-2xl">{topic.name}</h3>
            </div>

            <RichText text={topic.explanation} className="text-[0.95rem] text-foreground/90" />

            {topic.keyPoints && topic.keyPoints.length > 0 && (
              <ul className="space-y-1.5 rounded-xl border bg-emerald-500/5 p-3.5 text-sm">
                {topic.keyPoints.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                    <span className="min-w-0">{p}</span>
                  </li>
                ))}
              </ul>
            )}

            {topic.example.trim() && (
              <div className="space-y-3">
                {topic.example
                  .split(/\n\s*\n/)
                  .filter((s) => s.trim())
                  .map((ex, k, arr) => (
                    <div key={k} className="rounded-xl border border-l-4 border-emerald-500/25 border-l-emerald-500 bg-emerald-500/5 px-4 py-3">
                      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        <Lightbulb className="size-4" aria-hidden />
                        {tr(lang, { en: "Example", hi: "उदाहरण" })} {arr.length > 1 ? k + 1 : ""}
                      </p>
                      <RichText text={ex.trim()} />
                    </div>
                  ))}
              </div>
            )}

            {aiEnabled && (
              <div className="space-y-3 border-t pt-5">
                <p className="text-sm font-semibold">{t("Go deeper", "और गहराई से")}</p>
                <TopicDeepDive section={mod.title} topic={topic.name} hint={topic.explanation} lang={lang} state={topicState} tone="emerald" />
                <Button variant="ghost" size="sm" className="h-10 text-muted-foreground" disabled={busy} onClick={() => onLearnTopic(`${mod.title} - ${topic.name}`)}>
                  <BookOpen aria-hidden /> {t("Open as a full lesson", "पूरे पाठ के रूप में खोलें")}
                </Button>
              </div>
            )}
          </div>

          {finished && last && (
            <div className="mt-5 flex animate-lk-pop items-center gap-3 rounded-2xl bg-emerald-500/10 p-3.5">
              <Trophy className="size-6 shrink-0 text-emerald-500" aria-hidden />
              <p className="text-sm font-semibold">
                {t("Course complete! Try the quick check below to test yourself.", "कोर्स पूरा! खुद को परखने के लिए नीचे की जाँच करें।")}
              </p>
            </div>
          )}

          {/* Prev / next */}
          <div className="mt-6 flex items-center gap-2 border-t pt-4">
            <Button variant="ghost" className="h-11 flex-1 justify-start sm:flex-none" disabled={pos === 0} onClick={() => go(pos - 1)}>
              <ChevronLeft aria-hidden /> {t("Previous", "पिछला")}
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {pos + 1}/{flat.length}
            </span>
            {last ? (
              <Button
                className="h-11 flex-1 justify-end bg-emerald-600 text-white hover:bg-emerald-600/90 sm:ml-auto sm:flex-none"
                disabled={finished}
                onClick={() => {
                  setFinished(true)
                  haptic(25)
                }}
              >
                <Check aria-hidden /> {finished ? t("Completed", "पूरा हुआ") : t("Finish", "पूरा करें")}
              </Button>
            ) : (
              <Button className="h-11 flex-1 justify-end sm:ml-auto sm:flex-none" onClick={() => go(pos + 1)}>
                {t("Next", "अगला")} <ChevronRight aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- Quick check */

function QuickCheck({ lesson, onDone }: { lesson: LearnLesson; onDone: (correct: number, total: number) => void }) {
  const lang = lesson.language
  const qs = lesson.data.practice
  const [picked, setPicked] = useState<(number | null)[]>(() => qs.map(() => null))
  // Was the quick check already finished before this attempt? (XP is only awarded once.)
  const [finishedBefore] = useState(() => !!lesson.completedAt)
  const [attempts, setAttempts] = useState(0)
  const retake = finishedBefore || attempts > 0
  const answered = picked.filter((p) => p !== null).length
  const correct = picked.filter((p, i) => p === qs[i].answerIndex).length
  const done = answered === qs.length

  const choose = (qi: number, oi: number) => {
    if (picked[qi] !== null) return
    const next = picked.map((p, i) => (i === qi ? oi : p))
    setPicked(next)
    haptic(oi === qs[qi].answerIndex ? 25 : [60, 40, 60])
    if (next.every((p) => p !== null)) onDone(next.filter((p, i) => p === qs[i].answerIndex).length, qs.length)
  }

  return (
    <Section id="lesson-quiz" icon={Trophy} tone="indigo" title={tr(lang, { en: "Quick check", hi: "जल्दी जाँचें" })}>
      <p className="-mt-1 mb-3 text-xs text-muted-foreground">
        {tr(lang, { en: "Answer to check your understanding and earn XP.", hi: "अपनी समझ जाँचें और XP कमाएँ।" })}
      </p>
      <ol className="space-y-4">
        {qs.map((q, qi) => (
          <li key={qi}>
            <p className="mb-2 text-sm font-medium">
              {qi + 1}. {q.question}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o, oi) => {
                const isPicked = picked[qi] === oi
                const show = picked[qi] !== null
                const right = oi === q.answerIndex
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={show}
                    onClick={() => choose(qi, oi)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors",
                      !show && "hover:border-primary/50 hover:bg-primary/5",
                      show && right && "border-success bg-success/10",
                      show && isPicked && !right && "animate-lk-shake border-destructive bg-destructive/10",
                      show && !right && !isPicked && "opacity-60"
                    )}
                  >
                    <span className={cn("font-semibold", show && right ? "text-success" : show && isPicked ? "text-destructive" : "text-muted-foreground")}>
                      {show && right ? <CheckCircle2 className="size-4" aria-label="Correct answer" /> : show && isPicked ? <X className="size-4" aria-label="Your answer" /> : `${String.fromCharCode(65 + oi)}.`}
                    </span>
                    <span className="min-w-0">{o}</span>
                  </button>
                )
              })}
            </div>
            {picked[qi] !== null && (
              <div
                role="status"
                className={cn(
                  "mt-2 animate-in rounded-lg px-3 py-2 text-xs leading-relaxed fade-in",
                  picked[qi] === q.answerIndex ? "bg-success/10" : "bg-destructive/8"
                )}
              >
                <p className={cn("mb-0.5 font-semibold", picked[qi] === q.answerIndex ? "text-success" : "text-destructive")}>
                  {picked[qi] === q.answerIndex
                    ? tr(lang, { en: "Correct!", hi: "सही जवाब!" })
                    : tr(lang, {
                        en: `Not quite — the answer is ${String.fromCharCode(65 + q.answerIndex)}.`,
                        hi: `सही जवाब ${String.fromCharCode(65 + q.answerIndex)} है।`,
                      })}
                </p>
                <p className="text-muted-foreground">{q.explanation}</p>
              </div>
            )}
          </li>
        ))}
      </ol>
      {done && (
        <div className="mt-4 flex animate-lk-pop items-center gap-3 rounded-2xl bg-primary/10 p-3">
          <Trophy className="size-6 text-primary" aria-hidden />
          <p className="text-sm font-semibold">
            {retake
              ? tr(lang, { en: `${correct} of ${qs.length} correct`, hi: `${qs.length} में से ${correct} सही` })
              : tr(lang, { en: `${correct} of ${qs.length} correct · +${lessonXp(correct)} XP`, hi: `${qs.length} में से ${correct} सही · +${lessonXp(correct)} XP` })}
            {retake && <span className="block text-xs font-normal text-muted-foreground">{tr(lang, { en: "XP is awarded the first time only.", hi: "XP केवल पहली बार मिलता है।" })}</span>}
          </p>
          <Button variant="outline" size="sm" className="ml-auto h-10" onClick={() => {
              setPicked(qs.map(() => null))
              setAttempts((a) => a + 1)
            }}>
            <RefreshCw aria-hidden /> {tr(lang, { en: "Try again", hi: "फिर से करें" })}
          </Button>
        </div>
      )}
    </Section>
  )
}

/* ----------------------------------------------------------- Ask a doubt */

interface ChatTurn {
  q: string
  answer: string
  example?: string
  followUps?: string[]
}

/** Earlier turns sent as context, trimmed so the request stays within the job's input limit. */
const HISTORY_TURNS = 3
const HISTORY_ANSWER_CHARS = 1000

function AskDoubt({ lesson }: { lesson: LearnLesson }) {
  const lang = lesson.language
  const t: T = (en, hi) => tr(lang, { en, hi })
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thread, setThread] = useState<ChatTurn[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (pending || thread.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [pending, thread.length])

  const starters = [
    lesson.data.keyIdeas[0] && t(`Explain "${lesson.data.keyIdeas[0].heading}" in more detail`, `"${lesson.data.keyIdeas[0].heading}" को विस्तार से समझाएँ`),
    t("Give me a shortcut trick for this", "इसके लिए कोई शॉर्टकट ट्रिक बताइए"),
    t("What kind of questions come in exams?", "परीक्षा में किस तरह के सवाल आते हैं?"),
    t("Explain with a real-life example", "असल ज़िंदगी के उदाहरण से समझाइए"),
  ].filter(Boolean) as string[]

  const ask = async (text = q) => {
    if (busy) return
    const parsed = doubtSchema.safeParse(text)
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setBusy(true)
    setError(null)
    setPending(parsed.data)
    setQ("")
    const payload = (turns: number) =>
      JSON.stringify({
        subject: lesson.subject,
        topic: lesson.topic,
        lessonTitle: lesson.data.title,
        keyIdeas: lesson.data.keyIdeas.map((k) => k.heading),
        history: thread.slice(-turns).map((m) => ({ q: m.q, a: m.answer.slice(0, HISTORY_ANSWER_CHARS) })),
        question: parsed.data,
        language: lesson.language,
      })
    let input = payload(HISTORY_TURNS)
    for (let n = HISTORY_TURNS - 1; n >= 0 && input.length > assistInputLimit("learn-ask"); n--) input = payload(n)
    try {
      const out = await aiAssist("learn-ask", input)
      setThread((prev) => [...prev, { q: parsed.data, ...out }])
    } catch (err) {
      setQ(parsed.data)
      setError(err instanceof Error ? err.message : t("Couldn't get an answer.", "उत्तर नहीं मिल सका।"))
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  const last = thread[thread.length - 1]

  return (
    <section id="lesson-ask" className="scroll-mt-32 overflow-hidden rounded-2xl border bg-card" aria-labelledby="ask-doubt">
      <div className="flex items-center gap-2.5 border-b p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <MessageCircleQuestion className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="ask-doubt" className="font-semibold">
            {t("Ask a doubt", "अपना सवाल पूछें")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("Get a detailed, step-by-step answer about this lesson.", "इस पाठ पर विस्तृत, चरण-दर-चरण उत्तर पाएँ।")}</p>
        </div>
        {thread.length > 0 && (
          <Button variant="ghost" size="sm" className="h-10" onClick={() => setThread([])} disabled={busy}>
            <Trash2 aria-hidden /> <span className="hidden sm:inline">{t("Clear", "साफ़ करें")}</span>
          </Button>
        )}
      </div>

      <div className="space-y-5 p-4" aria-live="polite">
        {thread.length === 0 && !pending && (
          <div className="grid gap-2 sm:grid-cols-2">
            {starters.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                disabled={busy}
                className="flex min-h-11 items-center gap-2 rounded-xl border bg-background/50 px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">{s}</span>
              </button>
            ))}
          </div>
        )}

        {thread.map((m, i) => (
          <div key={i} className="space-y-3">
            <UserBubble text={m.q} />
            <div className="flex gap-3">
              <AiAvatar />
              <div className="min-w-0 flex-1 space-y-3">
                <RichText text={m.answer} className="text-[0.95rem]" />
                {m.example && (
                  <div className="rounded-xl border-l-4 border-amber-400 bg-amber-500/8 px-3 py-2.5">
                    <p className="mb-1 text-sm font-semibold text-amber-700 dark:text-amber-300">{t("Example", "उदाहरण")}</p>
                    <RichText text={m.example} />
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <CopyButton
                    value={stripMarkdown(m.example ? `${m.answer}\n\n${t("Example", "उदाहरण")}:\n${m.example}` : m.answer)}
                    label={t("Copy answer", "उत्तर कॉपी करें")}
                    iconOnly
                    variant="ghost"
                    size="icon-sm"
                    className="size-10 text-muted-foreground"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        {pending && (
          <div className="space-y-3">
            <UserBubble text={pending} />
            <div className="flex gap-3">
              <AiAvatar />
              <div className="flex-1 space-y-2 pt-1" aria-label={t("Thinking…", "सोच रहा है…")}>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> {t("Thinking through a detailed answer…", "विस्तृत उत्तर तैयार हो रहा है…")}
                </div>
                <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </div>
        )}

        {!busy && last?.followUps && last.followUps.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-11">
            {last.followUps.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => void ask(f)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/8"
              >
                <ArrowRight className="size-3.5 shrink-0 text-primary" aria-hidden /> {f}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t bg-surface-muted/40 p-3">
        <form
          className="flex items-end gap-2 rounded-2xl border bg-card p-1.5 focus-within:ring-2 focus-within:ring-ring/40"
          onSubmit={(e) => {
            e.preventDefault()
            void ask()
          }}
        >
          <Textarea
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void ask()
              }
            }}
            rows={1}
            maxLength={400}
            placeholder={thread.length ? t("Ask a follow-up…", "आगे का सवाल पूछें…") : t("e.g. Why is this answer correct?", "जैसे: यह उत्तर सही क्यों है?")}
            aria-label={t("Your doubt", "आपका सवाल")}
            aria-invalid={!!error}
            className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <Button type="submit" size="icon" className="shrink-0 rounded-xl" disabled={busy || !q.trim()} aria-label={t("Ask", "पूछें")}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          {t("Enter to send · Shift+Enter for a new line · Your question is sent to Google Gemini.", "भेजने के लिए Enter · नई लाइन के लिए Shift+Enter · आपका सवाल Google Gemini को भेजा जाता है।")}
        </p>
      </div>
    </section>
  )
}

function UserBubble({ text }: { text: string }) {
  return <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm whitespace-pre-line text-primary-foreground">{text}</p>
}

function AiAvatar() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary/60 text-primary-foreground" aria-hidden>
      <Sparkles className="size-4" />
    </span>
  )
}
