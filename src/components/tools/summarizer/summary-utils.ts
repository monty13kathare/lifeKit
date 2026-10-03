import type { AssistOutput } from "@/lib/ai/assist-schemas"
import { todayString } from "@/lib/dates"
import { createId } from "@/lib/storage/core"
import type { Task } from "@/types"

export type Summary = AssistOutput<"summarize">
export type SummaryLength = "short" | "medium" | "detailed"

export const SUMMARY_TEXT_LIMIT = 40000
export const SUMMARY_FILE_MAX_BYTES = 2 * 1024 * 1024
export const WORDS_PER_MINUTE = 230

export const LENGTH_OPTIONS: { value: SummaryLength; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "detailed", label: "Detailed" },
]

export const countWords = (text: string) => {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

export const readingMinutes = (words: number) => words / WORDS_PER_MINUTE

export function formatMinutes(minutes: number): string {
  if (minutes < 1) return "under a minute"
  const m = Math.round(minutes)
  return `${m} min`
}

/** All the words a reader actually has to read in the summary. */
export function summaryWords(s: Summary): number {
  return countWords([s.title, s.tldr, ...s.keyPoints, ...s.actionItems, ...s.questions].join(" "))
}

export function formatSummary(s: Summary): string {
  const section = (heading: string, items: string[], bullet = "-") =>
    items.length ? `\n\n${heading}\n${items.map((i) => `${bullet} ${i}`).join("\n")}` : ""
  return (
    `${s.title}\n\nTL;DR\n${s.tldr}` +
    section("Key points", s.keyPoints) +
    section("Action items", s.actionItems, "- [ ]") +
    section("Open questions", s.questions)
  ).trim()
}

/** An action item as a LifeKit task: medium priority, due today, "Work". */
export function actionItemToTask(item: string, summaryTitle: string): Task {
  return {
    id: createId(),
    title: item.trim().slice(0, 200),
    notes: summaryTitle ? `From summary: ${summaryTitle}` : undefined,
    priority: "medium",
    dueDate: todayString(),
    category: "Work",
    recurrence: "none",
    completed: false,
    subtasks: [],
    createdAt: new Date().toISOString(),
  }
}

export function safeFilename(name: string, fallback = "summary"): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return base || fallback
}
