"use client"

import { useState } from "react"
import { formatDistanceToNow, parseISO } from "date-fns"
import { BookOpen, FlaskConical, History, Library, ListChecks } from "lucide-react"
import { TrackHeader } from "@/components/learn/track-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLearn } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { PROMPT_SCENARIOS } from "@/data/learn/prompting"
import { Lessons } from "./lessons"
import { PromptLab } from "./prompt-lab"
import { PromptLibrary } from "./prompt-library"
import { Quiz } from "./quiz"

type Tab = "lessons" | "lab" | "quiz" | "library"

const TABS: { value: Tab; label: string; icon: typeof BookOpen }[] = [
  { value: "lessons", label: "Lessons", icon: BookOpen },
  { value: "lab", label: "Prompt Lab", icon: FlaskConical },
  { value: "quiz", label: "Quiz", icon: ListChecks },
  { value: "library", label: "Library", icon: Library },
]

export function PromptingApp() {
  const hydrated = useHydrated()
  const [tab, setTab] = useState<Tab>("lessons")
  const [labPrompt, setLabPrompt] = useState("")
  const [scenarioId, setScenarioId] = useState(PROMPT_SCENARIOS[0].id)

  return (
    <div className="space-y-5">
      <TrackHeader track="prompting" />

      {!hydrated ? (
        <div className="space-y-3">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-4">
          <TabsList className="w-full sm:w-fit">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="px-2 sm:px-3">
                <Icon aria-hidden className="hidden min-[400px]:block" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="lessons">
            <Lessons />
          </TabsContent>
          <TabsContent value="lab" keepMounted className="data-hidden:hidden">
            <PromptLab prompt={labPrompt} onPromptChange={setLabPrompt} scenarioId={scenarioId} onScenarioChange={setScenarioId} />
          </TabsContent>
          <TabsContent value="quiz" keepMounted className="data-hidden:hidden">
            <Quiz />
          </TabsContent>
          <TabsContent value="library">
            <PromptLibrary
              onPractice={(p) => {
                setLabPrompt(p.slice(0, 4000))
                setTab("lab")
              }}
            />
          </TabsContent>
        </Tabs>
      )}

      <RecentActivity />
    </div>
  )
}

function RecentActivity() {
  const hydrated = useHydrated()
  const { history } = useLearn()
  if (!hydrated) return null
  const items = history.filter((h) => h.track === "prompting").slice(0, 6)

  return (
    <section aria-labelledby="recent-title" className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 id="recent-title" className="flex items-center gap-2 font-semibold">
        <History className="size-4.5 text-muted-foreground" aria-hidden /> Recent activity
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No activity yet — finish a lesson, grade a prompt or take the quiz to earn XP.</p>
      ) : (
        <ul className="mt-2 divide-y">
          {items.map((h) => (
            <li key={h.at + h.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{h.label}</span>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(h.at), { addSuffix: true })}</span>
              </span>
              <span className="shrink-0 font-medium text-primary tabular-nums">+{h.xp} XP</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
