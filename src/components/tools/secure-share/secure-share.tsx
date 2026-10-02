"use client"

import { useState } from "react"
import { FileLock2, LockOpen } from "lucide-react"
import { Notice, UnsupportedNotice } from "@/components/common/notice"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useHydrated } from "@/hooks/use-store"
import { LocalShareService } from "@/lib/services/share"
import { CreateShare } from "./create-share"
import { OpenShare } from "./open-share"

type Tab = "create" | "open"

export function SecureShare() {
  const hydrated = useHydrated()
  const [tab, setTab] = useState<Tab>("create")

  if (!hydrated) return <Skeleton className="h-96 rounded-2xl" />

  if (!LocalShareService.isSupported()) {
    return (
      <UnsupportedNotice
        feature="in-browser encryption (Web Crypto)"
        alternative="Open LifeKit over https in an up-to-date browser (Chrome, Edge, Safari or Firefox) to create or open secure packages."
      />
    )
  }

  return (
    <div className="space-y-4">
      <Notice tone="info" title="No backend in this version: LifeKit does not create public internet links. Your file is encrypted in your browser.">
        SecureShare turns your files into an encrypted <code>.lifekit</code> package (AES-256-GCM). You send the package yourself — by
        email, chat or the share sheet — and the recipient opens it here with the password or share key.
      </Notice>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="create" className="px-4">
            <FileLock2 aria-hidden /> Create package
          </TabsTrigger>
          <TabsTrigger value="open" className="px-4">
            <LockOpen aria-hidden /> Open a package
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Both panels stay mounted so switching tabs doesn't lose selected files. */}
      <div hidden={tab !== "create"}>
        <CreateShare />
      </div>
      <div hidden={tab !== "open"}>
        <OpenShare />
      </div>
    </div>
  )
}
