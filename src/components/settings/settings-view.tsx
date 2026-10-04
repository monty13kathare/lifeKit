"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useTheme } from "next-themes"
import { Bell, ChevronRight, Database, Eraser, HardDrive, Palette, ShieldCheck, Trash2, UserRound } from "lucide-react"
import { toast } from "sonner"
import { InstallCard } from "@/components/layout/install-card"
import { AiLanguageToggle } from "@/components/common/ai-language-toggle"
import { THEME_OPTIONS } from "@/components/navigation/theme-toggle"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSettings } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { formatBytes } from "@/lib/files"
import { notificationSupport } from "@/lib/reminders"
import { resetAllData, settingsStore, STORAGE_PREFIX, DEFAULT_SETTINGS } from "@/lib/storage"
import { removeDemoData } from "@/lib/storage/demo"
import { cn } from "@/lib/utils"

const CURRENCIES = [
  { value: "₹", label: "₹ Indian Rupee" },
  { value: "$", label: "$ US Dollar" },
  { value: "€", label: "€ Euro" },
  { value: "£", label: "£ Pound Sterling" },
  { value: "¥", label: "¥ Yen / Yuan" },
  { value: "AED ", label: "AED Dirham" },
]

function Section({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id?: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${title}-h`} className="scroll-mt-24 rounded-2xl border bg-card p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <div>
          <h2 id={`${title}-h`} className="font-semibold">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function measureLocalUsage(): { bytes: number; keys: number } | null {
  try {
    let bytes = 0
    let keys = 0
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(STORAGE_PREFIX)) continue
      keys++
      bytes += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2 // UTF-16
    }
    return { bytes, keys }
  } catch {
    return null
  }
}

function ProfileForm({ initialName, onSave }: { initialName: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(initialName)
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(name.trim().slice(0, 40))
      }}
    >
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          value={name}
          maxLength={40}
          autoComplete="given-name"
          placeholder="What should we call you?"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={name.trim() === initialName}>
        Save
      </Button>
    </form>
  )
}

export function SettingsView() {
  const hydrated = useHydrated()
  const { settings, update } = useSettings()
  const { theme, setTheme } = useTheme()
  const [confirmReset, setConfirmReset] = useState(false)
  const [version, setVersion] = useState(0)
  // `settings` and `version` change whenever stored data does, so re-measure then.
  const usage = useMemo(() => (hydrated ? measureLocalUsage() : null), [hydrated, settings, version]) // eslint-disable-line react-hooks/exhaustive-deps

  const notif = hydrated ? notificationSupport() : "default"

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-muted-foreground">Personalise LifeKit. Everything is saved in this browser.</p>
      </header>

      <Section icon={UserRound} title="Profile" description="A local profile — there's no account in this version.">
        {hydrated ? (
          <ProfileForm
            key={settings.displayName}
            initialName={settings.displayName}
            onSave={(trimmed) => {
              update({ displayName: trimmed })
              toast.success(trimmed ? `Hi, ${trimmed.split(" ")[0]}!` : "Name cleared")
            }}
          />
        ) : (
          <div className="h-17" aria-hidden />
        )}
      </Section>

      <Section icon={Palette} title="Appearance">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = hydrated && theme === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-sm font-medium transition-colors",
                  selected ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-surface-muted hover:border-border"
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <Label htmlFor="currency">Currency for calculators</Label>
          <Select
            items={CURRENCIES}
            value={hydrated ? settings.currency : DEFAULT_SETTINGS.currency}
            onValueChange={(v) => v && update({ currency: v as string })}
          >
            <SelectTrigger id="currency" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm">
            AI language
            <span className="block text-xs text-muted-foreground">AI tools, planning and Learn content are written in this language</span>
          </span>
          <AiLanguageToggle showLabel={false} />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Customise the home screen with the <span className="font-medium text-foreground">Customize</span> button on{" "}
          <Link href="/" className="text-primary underline-offset-4 hover:underline">
            Home
          </Link>
          .
        </p>
      </Section>

      <InstallCard />

      <Section icon={Bell} title="Notifications">
        <Link
          href="/tools/reminders"
          className="-mx-2 flex min-h-12 items-center justify-between gap-3 rounded-xl px-2 transition-colors hover:bg-muted/60"
        >
          <span className="text-sm">
            Browser notifications:{" "}
            <span className="font-medium">
              {notif === "unsupported" ? "Not supported" : notif === "granted" ? "Allowed" : notif === "denied" ? "Blocked" : "Not set up"}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            Manage in Reminders <ChevronRight className="size-4" aria-hidden />
          </span>
        </Link>
      </Section>

      <Section
        id="privacy"
        icon={ShieldCheck}
        title="Privacy"
        description="LifeKit is frontend-only: there is no LifeKit server."
      >
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Images, PDFs and scans are processed in your browser and never uploaded.</li>
          <li>• Tasks, events, notes and other data are stored in this browser&apos;s local storage only.</li>
          <li>
            • Some features use browser services: OCR downloads language data once from a public CDN, and speech recognition in
            some browsers is processed by the browser vendor.
          </li>
          <li>
            • If an AI key is configured, AI features (AI tools, quick add, planning, Learn feedback) send only the text you choose to Google&apos;s Gemini
            API through this app&apos;s server. Nothing is sent unless you use those features.
          </li>
          <li>
            • SecureShare public links upload only the already-encrypted package to a third-party file relay (sto.care); the
            decryption key stays in the link. Turn off &quot;Generate Public Link&quot; to keep everything on your device.
          </li>
          <li>• Camera, microphone and notification permissions are only requested when you tap a button that needs them.</li>
          <li>• Local storage is not a secure vault. Use the Sensitive option in Important Info to encrypt details.</li>
        </ul>
      </Section>

      <Section icon={Database} title="Data" description="Manage what LifeKit has stored on this device.">
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-surface-muted p-3 text-sm">
          <HardDrive className="size-4 text-muted-foreground" aria-hidden />
          <span>
            {usage ? (
              <>
                Using <span className="font-medium">{formatBytes(usage.bytes)}</span> across {usage.keys} local stores
              </>
            ) : (
              "Calculating storage…"
            )}
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-sm font-medium">Remove demo data</p>
              <p className="text-sm text-muted-foreground">Delete the sample tasks, events, routine, bookmarks and contact. Keeps your own data.</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                removeDemoData()
                setVersion((v) => v + 1)
                toast.success("Demo data removed")
              }}
            >
              <Eraser /> Remove
            </Button>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 p-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-sm font-medium">Reset LifeKit Data</p>
              <p className="text-sm text-muted-foreground">Permanently delete everything LifeKit stored in this browser.</p>
            </div>
            <Button variant="destructive" onClick={() => setConfirmReset(true)}>
              <Trash2 /> Reset data
            </Button>
          </div>
        </div>
      </Section>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset LifeKit Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all locally stored LifeKit data from this browser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                resetAllData()
                // Remember that demo data shouldn't be re-seeded after a deliberate reset.
                settingsStore.set({ ...DEFAULT_SETTINGS, seeded: true, installPromptDismissed: settings.installPromptDismissed })
                setTheme("system")
                setConfirmReset(false)
                setVersion((v) => v + 1)
                toast.success("All LifeKit data was deleted from this browser")
              }}
            >
              Reset Data
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
