"use client"

import { History, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatLabel } from "@/lib/qr/formats"
import { parsePayload, PAYLOAD_LABELS } from "@/lib/qr/payload"
import { scanHistory, useScanHistory, type ScanHistoryItem } from "@/lib/qr/session"
import { cn } from "@/lib/utils"

/** Scan history for the current browser tab only (sessionStorage). */
export function ScanHistory({
  onSelect,
  activeId,
  filter,
  className,
}: {
  onSelect: (item: ScanHistoryItem) => void
  activeId?: string | null
  filter?: (item: ScanHistoryItem) => boolean
  className?: string
}) {
  const all = useScanHistory()
  const items = filter ? all.filter(filter) : all

  return (
    <section aria-labelledby="scan-history-title" className={cn("rounded-2xl border bg-card p-4 sm:p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 id="scan-history-title" className="flex items-center gap-2 font-medium">
            <History className="size-4 text-muted-foreground" aria-hidden /> This session
          </h2>
          <p className="text-xs text-muted-foreground">Cleared when you close this tab. Never saved.</p>
        </div>
        {items.length ? (
          <Button size="sm" variant="ghost" onClick={() => items.forEach((i) => scanHistory.remove(i.id))}>
            <Trash2 aria-hidden /> Clear
          </Button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No scans yet.</p>
      ) : (
        <ul className="max-h-80 space-y-1.5 overflow-y-auto">
          {items.map((item) => {
            const type = parsePayload(item.value).type
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2 text-left transition-colors hover:bg-muted",
                    activeId === item.id ? "border-primary/50 bg-primary/5" : "border-transparent bg-surface"
                  )}
                >
                  <span className="block truncate text-sm">{item.value}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatLabel(item.format)} · {type === "text" ? "Text" : PAYLOAD_LABELS[type]} ·{" "}
                    {new Date(item.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
