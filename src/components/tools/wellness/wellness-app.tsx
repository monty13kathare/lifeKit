"use client"

import { useState } from "react"
import { useWellness } from "@/hooks/use-lifekit-data"
import { CalendarCheck, HeartPulse, Sparkles } from "lucide-react"
import { Notice } from "@/components/common/notice"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useHydrated } from "@/hooks/use-store"
import { AiCoach } from "./ai-coach"
import { DISCLAIMER, type HeightUnit, type WeightUnit } from "./health-utils"
import { MyHealth } from "./my-health"
import { WellnessTracker } from "./wellness-tracker"

type Tab = "today" | "health" | "coach"

/** Wellness page: daily tracker, health profile and AI coach as tabs. */
export function WellnessApp() {
  const hydrated = useHydrated()
  const [tab, setTab] = useState<Tab>("today")
  const { profile, setProfile } = useWellness()
  const heightUnit: HeightUnit = profile.heightUnit ?? "cm"
  const weightUnit: WeightUnit = profile.weightUnit ?? "kg"
  const setHeightUnit = (u: HeightUnit) => setProfile({ heightUnit: u })
  const setWeightUnit = (u: WeightUnit) => setProfile({ weightUnit: u })
  // Mount the coach on first visit (it checks AI status), then keep it mounted so a running check survives tab switches.
  const [coachVisited, setCoachVisited] = useState(false)
  const changeTab = (next: Tab) => {
    setTab(next)
    if (next === "coach") setCoachVisited(true)
  }

  return (
    <div className="space-y-5">
      <Notice tone="info">{DISCLAIMER}</Notice>
      <Tabs value={tab} onValueChange={(v) => changeTab(v as Tab)} className="gap-5">
        <TabsList className="h-11! w-full">
          <TabsTrigger value="today" className="min-h-9">
            <CalendarCheck aria-hidden className="hidden min-[400px]:block" /> Today
          </TabsTrigger>
          <TabsTrigger value="health" className="min-h-9">
            <HeartPulse aria-hidden className="hidden min-[400px]:block" /> My health
          </TabsTrigger>
          <TabsTrigger value="coach" className="min-h-9">
            <Sparkles aria-hidden className="hidden min-[400px]:block" /> AI coach
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" keepMounted>
          <WellnessTracker />
        </TabsContent>
        <TabsContent value="health" keepMounted>
          {hydrated ? (
            <MyHealth heightUnit={heightUnit} weightUnit={weightUnit} onHeightUnitChange={setHeightUnit} onWeightUnitChange={setWeightUnit} />
          ) : (
            <TabSkeleton />
          )}
        </TabsContent>
        <TabsContent value="coach" keepMounted>
          {!coachVisited ? null : hydrated ? <AiCoach onGoToProfile={() => changeTab("health")} weightUnit={weightUnit} /> : <TabSkeleton />}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TabSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-96 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}
