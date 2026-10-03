"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { BookOpen, Mic, PenLine, SpellCheck } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrackHeader } from "@/components/learn/track-header"
import { Vocabulary } from "./vocabulary"

const loading = () => <Skeleton className="h-96 rounded-2xl" />
const Grammar = dynamic(() => import("./grammar").then((m) => m.Grammar), { loading })
const WritingCoach = dynamic(() => import("./writing-coach").then((m) => m.WritingCoach), { loading })
const Speaking = dynamic(() => import("./speaking").then((m) => m.Speaking), { loading })

type Tab = "vocabulary" | "grammar" | "writing" | "speaking"

const TABS: { value: Tab; label: string; short: string; icon: typeof BookOpen }[] = [
  { value: "vocabulary", label: "Vocabulary", short: "Words", icon: BookOpen },
  { value: "grammar", label: "Grammar", short: "Grammar", icon: SpellCheck },
  { value: "writing", label: "Writing coach", short: "Writing", icon: PenLine },
  { value: "speaking", label: "Speaking", short: "Speak", icon: Mic },
]

/** English track: vocabulary flashcards, grammar lessons, writing coach and speaking practice. */
export function EnglishApp() {
  const [tab, setTab] = useState<Tab>("vocabulary")
  return (
    <div className="space-y-5">
      <TrackHeader track="english" />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-4">
        <TabsList className="grid w-full grid-cols-4 sm:inline-flex sm:w-fit">
          {TABS.map(({ value, label, short, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="min-w-0 px-2 sm:px-3">
              <Icon aria-hidden />
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="vocabulary">
          <Vocabulary />
        </TabsContent>
        <TabsContent value="grammar">
          <Grammar />
        </TabsContent>
        <TabsContent value="writing">
          <WritingCoach />
        </TabsContent>
        <TabsContent value="speaking">
          <Speaking />
        </TabsContent>
      </Tabs>
    </div>
  )
}
