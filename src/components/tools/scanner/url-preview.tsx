"use client"

import { useState } from "react"
import { ExternalLink, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { openExternal, type UrlAnalysis } from "@/lib/qr/url-safety"
import { cn } from "@/lib/utils"

/** Shows the full destination (hostname highlighted) and safety warnings before opening. */
export function UrlPreview({ raw, analysis }: { raw: string; analysis: UrlAnalysis }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const danger = analysis.warnings.some((w) => w.severity === "danger")
  const risky = analysis.warnings.length > 0

  const open = () => {
    if (analysis.url && analysis.openable) openExternal(analysis.url)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-surface p-3">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Destination</p>
        {analysis.parts ? (
          <p className="font-mono text-sm break-all">
            <span className="text-muted-foreground">{analysis.parts.before}</span>
            <mark className="rounded bg-primary/15 px-0.5 font-semibold text-foreground">{analysis.parts.host}</mark>
            <span className="text-muted-foreground">{analysis.parts.after}</span>
          </p>
        ) : (
          <p className="font-mono text-sm break-all">{raw}</p>
        )}
        {analysis.hostname ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Opens <span className="font-medium text-foreground">{analysis.hostname}</span>
          </p>
        ) : null}
      </div>

      {analysis.blocked ? (
        <div role="alert" className="flex gap-2.5 rounded-xl border border-destructive/30 bg-destructive/8 p-3 text-sm">
          <ShieldX className="mt-0.5 size-4.5 shrink-0 text-destructive" aria-hidden />
          <p>{analysis.warnings[0]?.message}</p>
        </div>
      ) : risky ? (
        <div
          role="status"
          className={cn(
            "space-y-2 rounded-xl border p-3 text-sm",
            danger ? "border-destructive/30 bg-destructive/8" : "border-warning/35 bg-warning/10"
          )}
        >
          <p className="flex items-center gap-2 font-medium">
            <ShieldAlert className={cn("size-4.5", danger ? "text-destructive" : "text-warning-foreground dark:text-warning")} aria-hidden />
            {danger ? "This link looks suspicious" : "Check this link before opening"}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {analysis.warnings.map((w) => (
              <li key={w.id}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : analysis.openable ? (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <ShieldCheck className="size-3.5" aria-hidden /> No obvious red flags. Still only open links you trust.
        </p>
      ) : null}

      {analysis.openable && !analysis.blocked ? (
        <Button
          variant={danger ? "destructive" : "default"}
          size="lg"
          className="w-full sm:w-auto"
          onClick={() => (risky ? setConfirmOpen(true) : open())}
        >
          <ExternalLink aria-hidden /> {risky ? "Open anyway…" : "Open link"}
        </Button>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Open {analysis.hostname || "this link"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {analysis.warnings.length} warning{analysis.warnings.length === 1 ? "" : "s"} found. Only continue if you trust where this code came from.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="rounded-lg bg-surface-muted p-2 font-mono text-xs break-all">{analysis.url?.href ?? raw}</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false)
                open()
              }}
            >
              Open anyway
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
