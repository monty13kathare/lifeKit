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
  // A shared link (?pkg=…) opens straight on the "Open" tab. The tabs only render after
  // hydration (skeleton below), so reading the URL in the initializer can't cause a mismatch.
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("pkg") ? "open" : "create"
  )

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
      <Notice tone="info" title="End-to-End Encrypted File Sharing (Zero-Knowledge AES-256-GCM)">
        Files are packed and encrypted directly inside your browser before anything leaves your device.
        When you generate a public link, only the encrypted package is uploaded. The decryption key stays
        in the link URL hash and is never transmitted to any server.
      </Notice>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="create" className="px-4">
            <FileLock2 aria-hidden /> Create & share
          </TabsTrigger>
          <TabsTrigger value="open" className="px-4">
            <LockOpen aria-hidden /> Open shared files
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

