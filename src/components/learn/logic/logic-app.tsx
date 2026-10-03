"use client"

import { useState } from "react"
import { Brain, CalendarDays, Calculator, Puzzle, Waypoints } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrackHeader } from "@/components/learn/track-header"
import { useHydrated } from "@/hooks/use-store"
import { DailyPuzzle } from "./daily-puzzle"
import { MentalMath } from "./mental-math"
import { Patterns } from "./patterns"
import { PuzzlesTab } from "./puzzles-tab"
import { ThinkingSkills } from "./thinking-skills"

const TABS = [
  { value: "daily", label: "Daily puzzle", short: "Daily", icon: CalendarDays },
  { value: "puzzles", label: "Puzzles", short: "Puzzles", icon: Puzzle },
  { value: "math", label: "Mental maths", short: "Maths", icon: Calculator },
  { value: "patterns", label: "Patterns", short: "Patterns", icon: Waypoints },
  { value: "thinking", label: "Thinking skills", short: "Thinking", icon: Brain },
] as const

type TabValue = (typeof TABS)[number]["value"]

export function LogicApp() {
  const hydrated = useHydrated()
  const [tab, setTab] = useState<TabValue>("daily")

  return (
    <div className="space-y-5">
      <TrackHeader track="logic" />
      {!hydrated ? (
        <div className="space-y-4">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="gap-4">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-max min-w-full sm:min-w-0">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="min-w-18 px-3">
                  <t.icon aria-hidden />
                  <span className="sm:hidden">{t.short}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="daily">
            <DailyPuzzle />
          </TabsContent>
          <TabsContent value="puzzles">
            <PuzzlesTab />
          </TabsContent>
          <TabsContent value="math">
            <MentalMath />
          </TabsContent>
          <TabsContent value="patterns">
            <Patterns />
          </TabsContent>
          <TabsContent value="thinking">
            <ThinkingSkills />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
