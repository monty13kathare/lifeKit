"use client"

import { useMemo, useState } from "react"
import { Contact, EllipsisVertical, Lock, LockOpen, Mail, Pencil, Phone, Plus, Search, ShieldAlert, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { CopyButton } from "@/components/common/copy-button"
import { EmptyState } from "@/components/common/empty-state"
import { Notice } from "@/components/common/notice"
import { ToolPage } from "@/components/common/tool-page"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useImportantInformation } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { cn } from "@/lib/utils"
import type { ImportantInfo, InfoCategory } from "@/types"
import { INFO_CATEGORIES, categoryMeta, telHref } from "./categories"
import { InfoFormSheet, type InfoRecord } from "./info-form"
import { UnlockDialog } from "./unlock-dialog"
import { unlockedStore, useUnlocked, type UnlockedSecret } from "./unlocked-store"

const STORAGE_NOTICE =
  "This frontend-only version stores data in this browser's local storage. It is not a secure cloud vault — anyone with access to this device and browser profile may be able to read unencrypted entries. Use the Sensitive option to encrypt details with a passphrase."

export function InfoManager() {
  const hydrated = useHydrated()
  const { items, add, update, remove, upsert } = useImportantInformation()
  const unlocked = useUnlocked()
  const [filter, setFilter] = useState<InfoCategory | "all">("all")
  const [query, setQuery] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ImportantInfo | null>(null)
  const [unlocking, setUnlocking] = useState<{ entry: ImportantInfo; thenEdit: boolean } | null>(null)

  const counts = useMemo(() => {
    const m = new Map<InfoCategory, number>()
    items.forEach((i) => m.set(i.category, (m.get(i.category) ?? 0) + 1))
    return m
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((i) => filter === "all" || i.category === filter)
      .filter((i) => {
        if (!q) return true
        const secret = unlocked.get(i.id)
        return [i.title, i.phone, i.email, i.details, i.notes, secret?.details, secret?.notes].some((s) => s?.toLowerCase().includes(q))
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [items, filter, query, unlocked])

  const emergency = filtered.filter((i) => i.category === "emergency")
  const others = filtered.filter((i) => i.category !== "emergency")

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const startEdit = (entry: ImportantInfo) => {
    if (entry.sensitive && entry.encrypted && !unlocked.has(entry.id)) {
      setUnlocking({ entry, thenEdit: true })
      return
    }
    setEditing(entry)
    setFormOpen(true)
  }

  const save = (record: InfoRecord, secret: UnlockedSecret | null) => {
    if (editing) {
      update(editing.id, (prev) => ({ ...prev, ...record, id: prev.id, createdAt: prev.createdAt }))
      if (secret) unlockedStore.set(editing.id, secret)
      else unlockedStore.lock(editing.id)
      toast.success("Entry updated")
    } else {
      const created = add({ ...record, createdAt: new Date().toISOString() })
      if (secret) unlockedStore.set(created.id, secret)
      toast.success(record.sensitive ? "Entry saved and encrypted" : "Entry saved")
    }
    setFormOpen(false)
  }

  const del = (entry: ImportantInfo) => {
    remove(entry.id)
    unlockedStore.lock(entry.id)
    toast("Entry deleted", { action: { label: "Undo", onClick: () => upsert(entry) } })
  }

  const anyUnlocked = items.some((i) => unlocked.has(i.id))

  const actions = (
    <>
      {anyUnlocked ? (
        <Button variant="outline" onClick={() => unlockedStore.lockAll()}>
          <Lock aria-hidden /> <span className="hidden sm:inline">Lock all</span>
        </Button>
      ) : null}
      <Button onClick={openNew} className="hidden lg:inline-flex">
        <Plus aria-hidden /> Add entry
      </Button>
    </>
  )

  return (
    <ToolPage toolId="important-information" actions={actions} width="default">
      <div className="space-y-4">
        <Notice tone="warning" icon={ShieldAlert} title="Stored on this device only">
          {STORAGE_NOTICE}
        </Notice>

        {!hydrated ? (
          <div className="grid gap-3 md:grid-cols-2" aria-busy="true" aria-label="Loading entries">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Contact}
            title="Keep emergency contacts and key details handy."
            description="Add doctors, family numbers, vehicle and insurance details. Mark private details as Sensitive to encrypt them."
            action={
              <Button size="lg" onClick={openNew}>
                <Plus aria-hidden /> Add entry
              </Button>
            }
          />
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter entries" aria-label="Filter entries" className="h-11 pl-9" />
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Category">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={items.length} />
              {INFO_CATEGORIES.map((c) => (
                <FilterChip
                  key={c.id}
                  active={filter === c.id}
                  onClick={() => setFilter(filter === c.id ? "all" : c.id)}
                  label={c.label}
                  count={counts.get(c.id) ?? 0}
                  icon={<c.icon className="size-3.5" aria-hidden />}
                  emergency={c.id === "emergency"}
                />
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nothing here yet.{" "}
                <button type="button" className="font-medium text-primary hover:underline" onClick={openNew}>
                  Add an entry
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {emergency.length ? (
                  <section aria-labelledby="emergency-heading" className="space-y-2.5">
                    <h2 id="emergency-heading" className="flex items-center gap-2 text-sm font-semibold text-destructive">
                      <ShieldAlert className="size-4" aria-hidden /> Emergency
                    </h2>
                    <ul className="grid gap-3 md:grid-cols-2">
                      {emergency.map((i) => (
                        <InfoCard key={i.id} entry={i} secret={unlocked.get(i.id)} onEdit={() => startEdit(i)} onDelete={() => del(i)} onUnlock={() => setUnlocking({ entry: i, thenEdit: false })} />
                      ))}
                    </ul>
                  </section>
                ) : null}
                {others.length ? (
                  <section aria-label="Other entries" className="space-y-2.5">
                    {emergency.length ? <h2 className="text-sm font-semibold">Everything else</h2> : null}
                    <ul className="grid gap-3 md:grid-cols-2">
                      {others.map((i) => (
                        <InfoCard key={i.id} entry={i} secret={unlocked.get(i.id)} onEdit={() => startEdit(i)} onDelete={() => del(i)} onUnlock={() => setUnlocking({ entry: i, thenEdit: false })} />
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>

      {hydrated && items.length > 0 ? (
        <Button
          size="icon-lg"
          onClick={openNew}
          aria-label="Add entry"
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 rounded-full shadow-lg lg:hidden"
        >
          <Plus className="size-6" aria-hidden />
        </Button>
      ) : null}

      <InfoFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        initialSecret={editing ? unlocked.get(editing.id) : undefined}
        defaultCategory={filter === "all" ? undefined : filter}
        onSave={save}
      />
      <UnlockDialog
        entry={unlocking?.entry ?? null}
        onOpenChange={(o) => !o && setUnlocking(null)}
        onUnlocked={(entry) => {
          toast.success("Unlocked for this session")
          if (unlocking?.thenEdit) {
            setEditing(entry)
            setFormOpen(true)
          }
        }}
      />
    </ToolPage>
  )
}

function FilterChip({ active, onClick, label, count, icon, emergency }: { active: boolean; onClick: () => void; label: string; count: number; icon?: React.ReactNode; emergency?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
        active
          ? emergency
            ? "border-destructive bg-destructive text-white"
            : "border-primary bg-primary text-primary-foreground"
          : emergency
            ? "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
            : "bg-surface hover:bg-muted"
      )}
    >
      {icon}
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  )
}

function InfoCard({
  entry,
  secret,
  onEdit,
  onDelete,
  onUnlock,
}: {
  entry: ImportantInfo
  secret?: UnlockedSecret
  onEdit: () => void
  onDelete: () => void
  onUnlock: () => void
}) {
  const meta = categoryMeta(entry.category)
  const locked = entry.sensitive && !!entry.encrypted && !secret
  const details = entry.sensitive ? secret?.details : entry.details
  const notes = entry.sensitive ? secret?.notes : entry.notes
  const isEmergency = entry.category === "emergency"

  return (
    <li className={cn("flex flex-col rounded-2xl border bg-card p-4 shadow-soft", isEmergency && "border-destructive/30 bg-destructive/[0.03]")}>
      <div className="flex items-start gap-3">
        <span
          className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", isEmergency ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}
          aria-hidden
        >
          <meta.icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold break-words">{entry.title}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{meta.label}</span>
            {entry.sensitive ? (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium", locked ? "bg-muted text-foreground" : "bg-success/10 text-success")}>
                {locked ? <Lock className="size-3" aria-hidden /> : <LockOpen className="size-3" aria-hidden />}
                {locked ? "Locked" : "Unlocked"}
              </span>
            ) : null}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${entry.title}`} className="-mr-1" />}>
            <EllipsisVertical aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil aria-hidden /> Edit
            </DropdownMenuItem>
            {entry.sensitive && !locked ? (
              <DropdownMenuItem onClick={() => unlockedStore.lock(entry.id)}>
                <Lock aria-hidden /> Lock again
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 aria-hidden /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {entry.phone || entry.email ? (
        <div className="mt-3 space-y-2">
          {entry.phone ? (
            <div className="flex items-center gap-2">
              <Button
                nativeButton={false}
                render={<a href={telHref(entry.phone)} />}
                variant={isEmergency ? "default" : "secondary"}
                className={cn("h-11 min-w-0 flex-1 justify-start", isEmergency && "bg-destructive text-white hover:bg-destructive/85")}
                aria-label={`Call ${entry.title} at ${entry.phone}`}
              >
                <Phone aria-hidden /> <span className="truncate tabular-nums">{entry.phone}</span>
              </Button>
              <CopyButton value={entry.phone} iconOnly label="Copy phone number" className="size-11" />
            </div>
          ) : null}
          {entry.email ? (
            <div className="flex items-center gap-2">
              <Button nativeButton={false} render={<a href={`mailto:${entry.email}`} />} variant="outline" className="h-11 min-w-0 flex-1 justify-start" aria-label={`Email ${entry.title} at ${entry.email}`}>
                <Mail aria-hidden /> <span className="truncate">{entry.email}</span>
              </Button>
              <CopyButton value={entry.email} iconOnly label="Copy email" className="size-11" />
            </div>
          ) : null}
        </div>
      ) : null}

      {locked ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-dashed bg-surface-muted p-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4" aria-hidden /> Details are encrypted
          </p>
          <Button size="sm" variant="outline" className="h-9" onClick={onUnlock}>
            <LockOpen aria-hidden /> Unlock
          </Button>
        </div>
      ) : details || notes ? (
        <div className="mt-3 space-y-2">
          {details ? (
            <div className="rounded-xl bg-surface-muted p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Details</p>
                <CopyButton value={details} iconOnly size="icon-sm" variant="ghost" label="Copy details" className="-mt-1 -mr-1" />
              </div>
              <p className="text-sm break-words whitespace-pre-wrap">{details}</p>
            </div>
          ) : null}
          {notes ? (
            <div className="px-1">
              <p className="text-xs font-medium text-muted-foreground">Notes</p>
              <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">{notes}</p>
            </div>
          ) : null}
          {entry.sensitive ? (
            <Button variant="ghost" size="sm" onClick={() => unlockedStore.lock(entry.id)}>
              <Lock aria-hidden /> Lock again
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
