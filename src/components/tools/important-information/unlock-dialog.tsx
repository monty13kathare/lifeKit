"use client"

import { useState } from "react"
import { Loader2, LockOpen } from "lucide-react"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { decryptJson, DecryptError } from "@/lib/crypto/passphrase"
import type { ImportantInfo } from "@/types"
import { unlockedStore, type UnlockedSecret } from "./unlocked-store"

interface UnlockDialogProps {
  entry: ImportantInfo | null
  onOpenChange: (open: boolean) => void
  /** Called after a successful unlock. */
  onUnlocked?: (entry: ImportantInfo, secret: UnlockedSecret) => void
}

export function UnlockDialog({ entry, onOpenChange, onUnlocked }: UnlockDialogProps) {
  return (
    <ResponsiveSheet
      open={!!entry}
      onOpenChange={onOpenChange}
      size="sm"
      title="Unlock entry"
      description={entry ? `Enter the passphrase for “${entry.title}”. Decrypted details stay in memory until you lock it or reload.` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="unlock-form">
            <LockOpen aria-hidden /> Unlock
          </Button>
        </>
      }
    >
      {entry ? <UnlockForm key={entry.id} entry={entry} onDone={(secret) => { onUnlocked?.(entry, secret); onOpenChange(false) }} /> : null}
    </ResponsiveSheet>
  )
}

function UnlockForm({ entry, onDone }: { entry: ImportantInfo; onDone: (secret: UnlockedSecret) => void }) {
  const [passphrase, setPassphrase] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entry.encrypted) return
    if (!passphrase) {
      setError("Enter the passphrase")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await decryptJson<{ details?: string; notes?: string }>(entry.encrypted, passphrase)
      const secret = { details: data.details ?? "", notes: data.notes ?? "", passphrase }
      unlockedStore.set(entry.id, secret)
      onDone(secret)
    } catch (err) {
      setError(err instanceof DecryptError ? "That passphrase didn't work. Check it and try again." : "Couldn't unlock in this browser.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form id="unlock-form" onSubmit={submit} className="space-y-2" noValidate>
      <Label htmlFor="unlock-pass">Passphrase</Label>
      <Input
        id="unlock-pass"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby="unlock-msg"
        className="h-11"
        disabled={busy}
      />
      <p id="unlock-msg" aria-live="polite" className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {busy ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Unlocking…
          </span>
        ) : (
          error ?? "LifeKit never stores your passphrase. If it's lost, the details can't be recovered."
        )}
      </p>
    </form>
  )
}
