"use client"

import { useEffect, useState } from "react"
import { Check, RefreshCw, ShieldCheck } from "lucide-react"
import { CopyButton } from "@/components/common/copy-button"
import { Notice, UnsupportedNotice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useHydrated } from "@/hooks/use-store"
import { cn } from "@/lib/utils"
import {
  CHARSETS,
  GUESSES_PER_SECOND,
  crackTime,
  generatePassphrase,
  generatePassword,
  passphraseEntropy,
  passwordEntropy,
  poolSize,
  strengthFor,
  validateOptions,
  type CharSet,
  type PassphraseOptions,
  type PasswordOptions,
} from "./generator"
import { WORDLIST } from "./wordlist"

type Mode = "password" | "passphrase"

const MIN_LEN = 4
const MAX_LEN = 128

const SEPARATORS = [
  { value: "hyphen", label: "Hyphen ( - )", char: "-" },
  { value: "space", label: "Space", char: " " },
  { value: "dot", label: "Dot ( . )", char: "." },
  { value: "underscore", label: "Underscore ( _ )", char: "_" },
  { value: "none", label: "None", char: "" },
]

const DEFAULT_PW: PasswordOptions = {
  length: 20,
  sets: { upper: true, lower: true, digits: true, symbols: true },
  excludeAmbiguous: false,
}
const DEFAULT_PP: PassphraseOptions & { separatorId: string } = {
  words: 5,
  separator: "-",
  separatorId: "hyphen",
  capitalize: true,
  addNumber: true,
}

function make(mode: Mode, pw: PasswordOptions, pp: PassphraseOptions, count: number): string[] {
  if (mode === "password" && validateOptions(pw)) return []
  return Array.from({ length: count }, () => (mode === "password" ? generatePassword(pw) : generatePassphrase(pp, WORDLIST)))
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const toneClass = {
  destructive: "bg-destructive",
  warning: "bg-warning",
  success: "bg-success",
  primary: "bg-primary",
} as const

const toneText = {
  destructive: "text-destructive",
  warning: "text-warning-foreground dark:text-warning",
  success: "text-success",
  primary: "text-primary",
} as const

export function PasswordGenerator() {
  const hydrated = useHydrated()
  const supported = hydrated && typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"

  const [mode, setMode] = useState<Mode>("password")
  const [pw, setPw] = useState<PasswordOptions>(DEFAULT_PW)
  const [pp, setPp] = useState(DEFAULT_PP)
  const [count, setCount] = useState(1)
  const [lengthText, setLengthText] = useState(String(DEFAULT_PW.length))
  // Generated values live only in component memory — never in storage.
  const [results, setResults] = useState<string[]>([])

  useEffect(() => {
    const id = requestAnimationFrame(() => setResults(make("password", DEFAULT_PW, DEFAULT_PP, 1)))
    return () => cancelAnimationFrame(id)
  }, [])

  const apply = (next: { mode?: Mode; pw?: PasswordOptions; pp?: typeof DEFAULT_PP; count?: number }) => {
    const m = next.mode ?? mode
    const p = next.pw ?? pw
    const q = next.pp ?? pp
    const c = next.count ?? count
    if (next.mode) setMode(next.mode)
    if (next.pw) setPw(next.pw)
    if (next.pp) setPp(next.pp)
    if (next.count) setCount(next.count)
    setResults(make(m, p, q, c))
  }

  const setLength = (n: number) => {
    const length = clamp(Math.round(n), MIN_LEN, MAX_LEN)
    setLengthText(String(length))
    apply({ pw: { ...pw, length } })
  }

  const toggleSet = (id: CharSet) => apply({ pw: { ...pw, sets: { ...pw.sets, [id]: !pw.sets[id] } } })

  const error = mode === "password" ? validateOptions(pw) : null
  const bits = mode === "password" ? passwordEntropy(pw) : passphraseEntropy(pp, WORDLIST.length)
  const strength = strengthFor(bits)

  if (hydrated && !supported) {
    return (
      <UnsupportedNotice
        feature="secure random numbers (Web Crypto)"
        alternative="Update your browser, or use your password manager's built-in generator."
      />
    )
  }

  return (
    <div className="space-y-4">
      <Notice tone="success" icon={ShieldCheck} title="Never stored or sent">
        Passwords are generated on this device with your browser&apos;s cryptographically secure random generator. LifeKit
        doesn&apos;t save them anywhere — they disappear when you leave this page. Anything you copy stays on your clipboard
        until you copy something else.
      </Notice>

      <Tabs value={mode} onValueChange={(v) => apply({ mode: v as Mode })}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="password" className="px-4">
            Password
          </TabsTrigger>
          <TabsTrigger value="passphrase" className="px-4">
            Passphrase
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
        {/* Options */}
        <section aria-label="Options" className="space-y-5 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
          {mode === "password" ? (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label id="pg-length-label" htmlFor="pg-length">
                    Length
                  </Label>
                  <Input
                    id="pg-length"
                    type="number"
                    inputMode="numeric"
                    min={MIN_LEN}
                    max={MAX_LEN}
                    value={lengthText}
                    onChange={(e) => {
                      setLengthText(e.target.value)
                      const n = Number(e.target.value)
                      if (Number.isInteger(n) && n >= MIN_LEN && n <= MAX_LEN) apply({ pw: { ...pw, length: n } })
                    }}
                    onBlur={() => setLength(Number(lengthText) || DEFAULT_PW.length)}
                    className="h-10 w-20 text-center tabular-nums"
                  />
                </div>
                <Slider
                  aria-labelledby="pg-length-label"
                  value={pw.length}
                  min={MIN_LEN}
                  max={MAX_LEN}
                  step={1}
                  onValueChange={(v) => setLength(v as number)}
                />
              </div>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">Include</legend>
                <div className="grid grid-cols-2 gap-2">
                  {CHARSETS.map((s) => {
                    const on = pw.sets[s.id]
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleSet(s.id)}
                        className={cn(
                          "flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          on ? "border-primary bg-primary/10 text-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-md border",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-input"
                          )}
                        >
                          {on ? <Check className="size-3.5" /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">{s.label}</span>
                          <span className="block font-mono text-xs text-muted-foreground">{s.sample}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="pg-ambiguous" className="font-normal">
                  <span>
                    Exclude look-alikes
                    <span className="block font-mono text-xs text-muted-foreground">I l 1 | O 0 o ` &apos; &quot;</span>
                  </span>
                </Label>
                <Switch
                  id="pg-ambiguous"
                  checked={pw.excludeAmbiguous}
                  onCheckedChange={(v) => apply({ pw: { ...pw, excludeAmbiguous: v } })}
                />
              </div>
              <p className="text-xs text-muted-foreground">Every password includes at least one character from each selected type.</p>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label id="pg-words-label">Words</Label>
                  <span className="text-sm tabular-nums text-muted-foreground">{pp.words}</span>
                </div>
                <Slider
                  aria-labelledby="pg-words-label"
                  value={pp.words}
                  min={3}
                  max={12}
                  step={1}
                  onValueChange={(v) => apply({ pp: { ...pp, words: v as number } })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pg-sep">Separator</Label>
                <Select
                  items={SEPARATORS}
                  value={pp.separatorId}
                  onValueChange={(v) => {
                    const sep = SEPARATORS.find((s) => s.value === v)
                    if (sep) apply({ pp: { ...pp, separatorId: sep.value, separator: sep.char } })
                  }}
                >
                  <SelectTrigger id="pg-sep" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEPARATORS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="pg-cap" className="font-normal">
                  Capitalize words
                </Label>
                <Switch id="pg-cap" checked={pp.capitalize} onCheckedChange={(v) => apply({ pp: { ...pp, capitalize: v } })} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="pg-num" className="font-normal">
                  Add a number
                </Label>
                <Switch id="pg-num" checked={pp.addNumber} onCheckedChange={(v) => apply({ pp: { ...pp, addNumber: v } })} />
              </div>
              <p className="text-xs text-muted-foreground">
                Words are drawn at random from a built-in list of {WORDLIST.length.toLocaleString()} common words.
              </p>
            </>
          )}

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label id="pg-count-label">How many</Label>
              <span className="text-sm tabular-nums text-muted-foreground">{count}</span>
            </div>
            <Slider
              aria-labelledby="pg-count-label"
              value={count}
              min={1}
              max={20}
              step={1}
              onValueChange={(v) => apply({ count: v as number })}
            />
          </div>
        </section>

        {/* Results */}
        <section aria-label="Generated" className="space-y-4">
          <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className={cn("text-lg font-semibold", error ? "text-muted-foreground" : toneText[strength.tone])}>
                {error ? "—" : strength.label}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                ≈ {error ? 0 : Math.round(bits)} bits of entropy
              </p>
            </div>
            <div
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-label="Password strength"
              aria-valuemin={0}
              aria-valuemax={128}
              aria-valuenow={error ? 0 : Math.round(Math.min(bits, 128))}
              aria-valuetext={error ? "No password" : `${strength.label}, ${Math.round(bits)} bits`}
            >
              <div
                className={cn("h-full rounded-full transition-all", toneClass[strength.tone])}
                style={{ width: `${error ? 0 : Math.max(4, strength.score * 100)}%` }}
              />
            </div>
            {!error ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Time to crack by brute force: <span className="font-medium text-foreground">{crackTime(bits)}</span>
                <span className="block text-xs">
                  {mode === "password"
                    ? `${pw.length} characters from a pool of ${poolSize(pw)}.`
                    : `${pp.words} words from ${WORDLIST.length.toLocaleString()}${pp.addNumber ? ", plus a number" : ""}.`}{" "}
                  Assumes {GUESSES_PER_SECOND.toExponential(0).replace("e+", " × 10^")} guesses per second (offline attack); real-world
                  online attacks are far slower.
                </span>
              </p>
            ) : null}
          </div>

          {error ? (
            <Notice tone="danger" title="Can't generate yet">
              {error}
            </Notice>
          ) : (
            <div className="rounded-2xl border bg-card shadow-soft">
              <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                <h2 className="text-sm font-medium">
                  {results.length} {mode === "password" ? "password" : "passphrase"}
                  {results.length === 1 ? "" : "s"}
                </h2>
                {results.length > 1 ? <CopyButton value={results.join("\n")} label="Copy all" size="sm" /> : null}
              </div>
              <ul className="divide-y" aria-live="polite">
                {results.map((value, i) => (
                  <li key={`${i}-${value}`} className="flex items-center gap-2 px-4 py-3">
                    <code className="min-w-0 flex-1 font-mono text-base break-all select-all sm:text-lg">{value}</code>
                    <CopyButton value={value} iconOnly label={`Copy ${mode} ${i + 1}`} />
                  </li>
                ))}
                {!results.length ? <li className="px-4 py-6 text-center text-sm text-muted-foreground">Generating…</li> : null}
              </ul>
            </div>
          )}

          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 lg:static">
            <Button size="lg" className="w-full shadow-soft" onClick={() => apply({})} disabled={!!error}>
              <RefreshCw aria-hidden /> Generate {count > 1 ? `${count} new` : "new"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
