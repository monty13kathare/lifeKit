"use client"

import { useState } from "react"
import { CalendarCheck, HeartPulse, Sparkles } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useWellness } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { BodySnapshot } from "./body-snapshot"
import { HealthGuide } from "./health-guide"
import { DISCLAIMER, type HeightUnit, type WeightUnit } from "./health-utils"
import { MyHealth } from "./my-health"
import { TodayTracker } from "./today-tracker"

type Tab = "today" | "body" | "guide"

/** Wellness: body snapshot, then Today (quick trackers + plan), Body (full detail) and AI Guide. */
export function WellnessApp() {
  const hydrated = useHydrated()
  const [tab, setTab] = useState<Tab>("today")
  const { profile, setProfile } = useWellness()
  const heightUnit: HeightUnit = profile.heightUnit ?? "cm"
  const weightUnit: WeightUnit = profile.weightUnit ?? "kg"

  const go = (next: Tab) => {
    setTab(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="space-y-4">
      {hydrated ? <BodySnapshot profile={profile} unit={weightUnit} onEditProfile={() => go("body")} /> : <Skeleton className="h-36 rounded-2xl" />}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-4">
        <TabsList className="w-full">
          <TabsTrigger value="today">
            <CalendarCheck aria-hidden /> Today
          </TabsTrigger>
          <TabsTrigger value="body">
            <HeartPulse aria-hidden /> Body
          </TabsTrigger>
          <TabsTrigger value="guide">
            <Sparkles aria-hidden /> AI Guide
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <TodayTracker onOpenGuide={() => go("guide")} />
        </TabsContent>
        <TabsContent value="body">
          {hydrated ? (
            <MyHealth
              heightUnit={heightUnit}
              weightUnit={weightUnit}
              onHeightUnitChange={(u) => setProfile({ heightUnit: u })}
              onWeightUnitChange={(u) => setProfile({ weightUnit: u })}
            />
          ) : (
            <Skeleton className="h-96 rounded-2xl" />
          )}
        </TabsContent>
        {/* Kept mounted so a plan that's being generated survives tab switches. */}
        <TabsContent value="guide" keepMounted>
          {hydrated ? <HealthGuide weightUnit={weightUnit} onEditProfile={() => go("body")} /> : <Skeleton className="h-64 rounded-2xl" />}
        </TabsContent>
      </Tabs>

      <p className="text-center text-xs text-muted-foreground">{DISCLAIMER}</p>
    </div>
  )
}
