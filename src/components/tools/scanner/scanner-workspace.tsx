"use client"

import { useCallback, useRef, useState } from "react"
import { Camera, ImageUp, type LucideIcon } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/common/empty-state"
import type { DetectedCode } from "@/lib/qr/detect"
import type { CodeFormat } from "@/lib/qr/formats"
import { scanHistory, type ScanHistoryItem } from "@/lib/qr/session"
import { CameraScanner } from "./camera-scanner"
import { ImageScan } from "./image-scan"
import { ScanHistory } from "./scan-history"
import { ScanResultCard } from "./scan-result"
import type { Viewfinder } from "./camera-view"

interface Current {
  code: DetectedCode
  source: "camera" | "image"
  historyId?: string
}

interface ScannerWorkspaceProps {
  formats: CodeFormat[]
  viewfinder?: Viewfinder
  idleTitle: string
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
  /** Extra content under the result column (e.g. supported formats). */
  aside?: React.ReactNode
}

/** Camera/upload input on the left, result + session history on the right. */
export function ScannerWorkspace({ formats, viewfinder, idleTitle, emptyIcon, emptyTitle, emptyDescription, aside }: ScannerWorkspaceProps) {
  const [tab, setTab] = useState<string>("camera")
  const [current, setCurrent] = useState<Current | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const handle = useCallback((code: DetectedCode, source: "camera" | "image") => {
    scanHistory.add({ value: code.value, format: code.format, source })
    const latest = scanHistory.get()[0]
    setCurrent({ code, source, historyId: latest?.value === code.value ? latest.id : undefined })
    // On phones the result sits below the camera — bring it into view.
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1023px)").matches) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [])

  const formatSet = new Set<string>(formats)
  const filter = (item: ScanHistoryItem) => formatSet.has(item.format)

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
      <div className="min-w-0">
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="camera" className="px-4">
              <Camera aria-hidden /> Camera
            </TabsTrigger>
            <TabsTrigger value="image" className="px-4">
              <ImageUp aria-hidden /> Upload image
            </TabsTrigger>
          </TabsList>
          <TabsContent value="camera" className="mt-2">
            <CameraScanner
              formats={formats}
              viewfinder={viewfinder}
              idleTitle={idleTitle}
              onDetect={(c) => handle(c, "camera")}
            />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              No camera? <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => setTab("image")}>Upload an image instead</button>
            </p>
          </TabsContent>
          <TabsContent value="image" className="mt-2">
            <ImageScan formats={formats} onDetect={(c) => handle(c, "image")} />
          </TabsContent>
        </Tabs>
      </div>

      <div className="min-w-0 space-y-4">
        <div ref={resultRef} aria-live="polite" className="scroll-mt-4">
          {current ? (
            <ScanResultCard key={`${current.code.value}-${current.historyId ?? ""}`} code={current.code} source={current.source} onDismiss={() => setCurrent(null)} />
          ) : (
            <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
          )}
        </div>
        <ScanHistory
          filter={filter}
          activeId={current?.historyId}
          onSelect={(item) => setCurrent({ code: { value: item.value, format: item.format }, source: item.source, historyId: item.id })}
        />
        {aside}
      </div>
    </div>
  )
}
