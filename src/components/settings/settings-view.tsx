"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { useTheme } from "next-themes"
import {
  Bell,
  Bot,
  Camera,
  ChevronRight,
  Coins,
  Download,
  Eraser,
  HardDrive,
  Info,
  Languages,
  Lock,
  Pencil,
  Share2,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { AiLanguageToggle } from "@/components/common/ai-language-toggle"
import { useInstall } from "@/components/layout/install-context"
import { initials } from "@/components/navigation/profile-menu"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useLearnFun, useSettings } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { downloadText, formatBytes } from "@/lib/files"
import { levelInfo } from "@/lib/learn/fun"
import { notificationSupport } from "@/lib/reminders"
import { DEFAULT_SETTINGS, exportAllData, importAllData, resetAllData, settingsStore, STORAGE_PREFIX } from "@/lib/storage"
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

/** Browsers usually allow ~5 MB of local storage per site. */
const STORAGE_BUDGET = 5 * 1024 * 1024
const MAX_BACKUP_BYTES = 10 * 1024 * 1024

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

/* ------------------------------------------------------------ Building blocks */

function Group({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-label={title} className="scroll-mt-24">
      <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <div className="divide-y overflow-hidden rounded-2xl border bg-card">{children}</div>
    </section>
  )
}

const TONES = {
  indigo: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-300",
  amber: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  sky: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
  rose: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
  slate: "bg-muted text-muted-foreground",
} as const

function Row({
  icon: Icon,
  tone = "slate",
  title,
  description,
  children,
  stack,
}: {
  icon: LucideIcon
  tone?: keyof typeof TONES
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  /** Put the control under the text on phones (wide controls). */
  stack?: boolean
}) {
  return (
    <div className={cn("flex gap-3 p-4", stack ? "flex-col sm:flex-row sm:items-center" : "items-center")}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", TONES[tone])}>
          <Icon className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
        </div>
      </div>
      {children ? <div className={cn("shrink-0", stack && "w-full sm:w-auto")}>{children}</div> : null}
    </div>
  )
}

function LinkRow({ href, icon, tone, title, description, value }: { href: string; icon: LucideIcon; tone?: keyof typeof TONES; title: string; description?: string; value?: string }) {
  return (
    <Link href={href} className="block transition-colors hover:bg-muted/50">
      <Row icon={icon} tone={tone} title={title} description={description}>
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          {value}
          <ChevronRight className="size-4" aria-hidden />
        </span>
      </Row>
    </Link>
  )
}

/* ---------------------------------------------------------------- Profile */

function ProfileCard() {
  const hydrated = useHydrated()
  const { settings, update } = useSettings()
  const { stats } = useLearnFun()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const name = hydrated ? settings.displayName.trim() : ""
  const level = levelInfo(hydrated ? stats.xp : 0)

  const save = () => {
    const trimmed = draft.trim().slice(0, 40)
    update({ displayName: trimmed })
    setEditing(false)
    toast.success(trimmed ? `Hi, ${trimmed.split(" ")[0]}!` : "Name cleared")
  }

  return (
    <section aria-label="Profile" className="relative overflow-hidden rounded-3xl border bg-card p-5">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/15 via-fuchsia-500/5 to-transparent" aria-hidden />
      <div className="relative flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-fuchsia-500 text-2xl font-semibold text-white shadow-sm">
          {name ? initials(name).slice(0, 1) : <UserRound className="size-7" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                save()
              }}
            >
              <Input
                autoFocus
                value={draft}
                maxLength={40}
                autoComplete="given-name"
                placeholder="Your name"
                aria-label="Display name"
                onChange={(e) => setDraft(e.target.value)}
                className="h-10 min-w-0 flex-1"
              />
              <Button type="submit">Save</Button>
            </form>
          ) : (
            <>
              <p className="truncate text-lg font-semibold">{name || "Add your name"}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 text-success" aria-hidden /> Local profile · data stays on this device
              </p>
            </>
          )}
        </div>
        {!editing && (
          <Button
            variant="outline"
            size="icon"
            aria-label="Edit name"
            onClick={() => {
              setDraft(name)
              setEditing(true)
            }}
          >
            <Pencil aria-hidden />
          </Button>
        )}
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat value={`Lv ${level.level}`} label={level.title.en} />
        <Stat value={`${hydrated ? stats.xp : 0}`} label="XP earned" />
        <Stat value={`${hydrated ? stats.games : 0}`} label="Quizzes" />
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-background/60 px-1 py-2">
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="truncate text-[0.7rem] text-muted-foreground">{label}</p>
    </div>
  )
}

/* ------------------------------------------------------------------- Page */

export function SettingsView() {
  const hydrated = useHydrated()
  const { settings, update } = useSettings()
  const { theme, setTheme } = useTheme()
  const ai = useAiStatus()
  const { canInstall, isStandalone, isIOS, promptInstall } = useInstall()
  const [confirmReset, setConfirmReset] = useState(false)
  const [version, setVersion] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  // `settings` and `version` change whenever stored data does, so re-measure then.
  const usage = useMemo(() => (hydrated ? measureLocalUsage() : null), [hydrated, settings, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const notif = hydrated ? notificationSupport() : "default"
  const usedPct = usage ? Math.min(100, Math.round((usage.bytes / STORAGE_BUDGET) * 100)) : 0

  const backup = () => {
    const json = JSON.stringify(exportAllData(), null, 2)
    downloadText(json, `lifekit-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json")
    toast.success("Backup downloaded", { description: "Keep it somewhere safe — it isn't encrypted." })
  }

  const restore = async (file: File) => {
    if (file.size > MAX_BACKUP_BYTES) {
      toast.error("That file is too large to be a LifeKit backup.")
      return
    }
    try {
      const count = importAllData(JSON.parse(await file.text()))
      setVersion((v) => v + 1)
      toast.success("Backup restored", { description: `${count} ${count === 1 ? "section" : "sections"} of data restored.` })
    } catch (err) {
      toast.error("Couldn't restore", { description: err instanceof SyntaxError ? "The file isn't valid JSON." : (err as Error).message })
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Personalise LifeKit. Everything is saved in this browser.</p>
      </header>

      <ProfileCard />

      <Group title="Appearance">
        <div className="p-4">
          <p className="mb-2.5 text-sm font-medium">Theme</p>
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
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
                    "flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors",
                    selected ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" aria-hidden /> {label}
                </button>
              )
            })}
          </div>
        </div>
        <Row icon={Coins} tone="amber" title="Currency" description="Used by the calculators" stack>
          <Select items={CURRENCIES} value={hydrated ? settings.currency : DEFAULT_SETTINGS.currency} onValueChange={(v) => v && update({ currency: v as string })}>
            <SelectTrigger aria-label="Currency" className="h-10 w-full sm:w-48">
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
        </Row>
        {ai?.configured && (
          <Row icon={Languages} tone="violet" title="AI language" description="AI tools, plans and Learn content">
            <AiLanguageToggle showLabel={false} />
          </Row>
        )}
      </Group>

      <Group title="App">
        <Row
          icon={Smartphone}
          tone="indigo"
          title={isStandalone ? "Installed" : "Install LifeKit"}
          description={
            isStandalone
              ? "You're using the installed app."
              : canInstall
                ? "Home-screen icon, full screen, works offline."
                : isIOS
                  ? "In Safari tap Share, then “Add to Home Screen”."
                  : "Use your browser menu → “Install app”."
          }
        >
          {canInstall && (
            <Button onClick={() => void promptInstall()}>
              <Download aria-hidden /> Install
            </Button>
          )}
        </Row>
        <LinkRow
          href="/tools/reminders"
          icon={Bell}
          tone="amber"
          title="Notifications"
          description="Reminders and calendar alerts"
          value={notif === "unsupported" ? "Not supported" : notif === "granted" ? "On" : notif === "denied" ? "Blocked" : "Off"}
        />
        <LinkRow href="/more" icon={Info} title="More" description="Install card, reminders, notes and about" />
      </Group>

      <Group id="privacy" title="Privacy">
        <Row icon={Lock} tone="emerald" title="Stays on your device" description="Tasks, notes, health data and files are stored and processed in this browser. There's no LifeKit account or server database." />
        <Row
          icon={Bot}
          tone="violet"
          title="AI only when you ask"
          description="AI features send only the text or image you choose to Google Gemini through this app's server. Nothing is sent otherwise."
        />
        <Row
          icon={Share2}
          tone="sky"
          title="SecureShare public links"
          description="Upload an already-encrypted package to a third-party relay (sto.care); the key stays in the link. Turn off “Generate Public Link” to keep files on your device."
        />
        <Row icon={Camera} tone="rose" title="Permissions on tap" description="Camera, microphone and notifications are requested only when you use a feature that needs them." />
      </Group>

      <Group title="Data">
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <HardDrive className="size-4 text-muted-foreground" aria-hidden /> Storage
            </span>
            <span className="text-muted-foreground tabular-nums">{usage ? `${formatBytes(usage.bytes)} · ${usage.keys} stores` : "Calculating…"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Local storage used" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn("h-full rounded-full transition-all", usedPct > 80 ? "bg-destructive" : "bg-primary")} style={{ width: `${Math.max(usedPct, usage ? 2 : 0)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{usedPct < 1 ? "Less than 1%" : `About ${usedPct}%`} of the typical 5 MB browser limit.</p>
        </div>
        <Row icon={Download} tone="indigo" title="Back up" description="Download all your LifeKit data as a file">
          <Button variant="outline" onClick={backup} disabled={!hydrated}>
            Export
          </Button>
        </Row>
        <Row icon={Upload} tone="emerald" title="Restore" description="Load a backup file — replaces matching data">
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!hydrated}>
            Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              if (f) void restore(f)
            }}
          />
        </Row>
        <Row icon={Eraser} title="Remove demo data" description="Delete the sample items; keeps your own data">
          <Button
            variant="outline"
            onClick={() => {
              removeDemoData()
              setVersion((v) => v + 1)
              toast.success("Demo data removed")
            }}
          >
            Remove
          </Button>
        </Row>
        <Row icon={Trash2} tone="rose" title="Reset LifeKit" description="Permanently delete everything stored in this browser">
          <Button variant="destructive" onClick={() => setConfirmReset(true)}>
            Reset
          </Button>
        </Row>
      </Group>

      <p className="pb-2 text-center text-xs text-muted-foreground">LifeKit v0.1 · Private by design</p>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset LifeKit data?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes all LifeKit data stored in this browser. Export a backup first if you might need it.</AlertDialogDescription>
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
              Reset data
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
