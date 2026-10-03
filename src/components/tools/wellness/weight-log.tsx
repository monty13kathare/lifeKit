"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Scale, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fromDateString, todayString } from "@/lib/dates"
import type { HealthProfile, WeightEntry } from "@/types"
import { fmtWeight, KG_PER_LB, lbToKg, signed, sortedLog, type WeightUnit } from "./health-utils"

interface WeightLogProps {
  profile: HealthProfile
  setProfile: (patch: Partial<HealthProfile>) => void
  unit: WeightUnit
}

export function WeightLog({ profile, setProfile, unit }: WeightLogProps) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const log = sortedLog(profile.weightLog)
  const recent = log.slice(-12)
  const first = log[0]
  const last = log[log.length - 1]
  const showTarget = (profile.goal === "lose-weight" || profile.goal === "gain-weight") && profile.targetWeightKg

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number(value.trim().replace(",", "."))
    const [min, max] = unit === "kg" ? [25, 300] : [55, 660]
    if (!value.trim() || !Number.isFinite(n)) return setError("Enter your weight as a number")
    if (n < min || n > max) return setError(`Weight should be between ${min} and ${max} ${unit}`)
    const kg = unit === "lb" ? lbToKg(n) : Math.round(n * 10) / 10
    const today = todayString()
    // Always record today's entry when logging explicitly, even if unchanged.
    setProfile({ weightKg: kg, weightLog: sortedLog([...profile.weightLog.filter((x) => x.date !== today), { date: today, kg }]) })
    setValue("")
    setError(null)
    toast.success(`Logged ${fmtWeight(kg, unit)} for today`)
  }

  const removeEntry = (entry: WeightEntry) => {
    const prev = profile.weightLog
    setProfile({ weightLog: prev.filter((x) => x.date !== entry.date) })
    toast("Entry removed", { description: format(fromDateString(entry.date), "d MMM yyyy"), action: { label: "Undo", onClick: () => setProfile({ weightLog: prev }) } })
  }

  const delta = (kg: number) => (unit === "lb" ? kg / KG_PER_LB : kg)

  return (
    <section aria-labelledby="weight-heading" className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <h2 id="weight-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Scale className="size-4 text-muted-foreground" aria-hidden /> Weight log
      </h2>

      <form onSubmit={submit} noValidate className="space-y-1.5">
        <Label htmlFor="quick-weight">Log today&apos;s weight</Label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              id="quick-weight"
              inputMode="decimal"
              autoComplete="off"
              placeholder={profile.weightKg ? fmtWeight(profile.weightKg, unit).split(" ")[0] : unit === "kg" ? "e.g. 62.5" : "e.g. 138"}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                if (error) setError(null)
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "quick-weight-err" : undefined}
              className="h-11 pr-10"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{unit}</span>
          </div>
          <Button type="submit" className="h-11">
            Log weight
          </Button>
        </div>
        {error ? (
          <p id="quick-weight-err" className="text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </form>

      {log.length ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border bg-surface p-3">
              <p className="text-xs text-muted-foreground">Latest</p>
              <p className="font-semibold tabular-nums">{fmtWeight(last.kg, unit)}</p>
              <p className="text-xs text-muted-foreground">{format(fromDateString(last.date), "d MMM")}</p>
            </div>
            <div className="rounded-xl border bg-surface p-3">
              <p className="text-xs text-muted-foreground">Since first entry</p>
              <p className="font-semibold tabular-nums">
                {log.length > 1 ? `${signed(delta(last.kg - first.kg))} ${unit}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">{log.length > 1 ? `from ${format(fromDateString(first.date), "d MMM")}` : "Log again to compare"}</p>
            </div>
          </div>
          {showTarget ? <TargetLine current={last.kg} target={profile.targetWeightKg!} goal={profile.goal} unit={unit} /> : null}
          <WeightChart entries={recent} unit={unit} target={showTarget ? profile.targetWeightKg : undefined} />
          <details className="group rounded-xl border bg-surface">
            <summary className="flex min-h-10 cursor-pointer items-center px-3 text-sm font-medium">Recent entries ({Math.min(log.length, 12)})</summary>
            <ul className="divide-y border-t">
              {[...recent].reverse().map((e) => (
                <li key={e.date} className="flex items-center justify-between gap-2 px-3 py-1">
                  <span className="text-sm">{format(fromDateString(e.date), "EEE d MMM yyyy")}</span>
                  <span className="flex items-center gap-1">
                    <span className="text-sm font-medium tabular-nums">{fmtWeight(e.kg, unit)}</span>
                    <Button variant="ghost" size="icon" aria-label={`Remove entry for ${format(fromDateString(e.date), "d MMM yyyy")}`} onClick={() => removeEntry(e)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          No entries yet. Log your weight now and then — weekly is plenty — to see a gentle trend.
        </p>
      )}
    </section>
  )
}

function TargetLine({ current, target, goal, unit }: { current: number; target: number; goal: HealthProfile["goal"]; unit: WeightUnit }) {
  const remaining = goal === "lose-weight" ? current - target : target - current
  const amount = unit === "lb" ? remaining / KG_PER_LB : remaining
  return (
    <p className="rounded-xl bg-primary/8 px-3 py-2 text-sm" aria-live="polite">
      {remaining <= 0.05 ? (
        <span className="font-medium text-success">You&apos;ve reached your target of {fmtWeight(target, unit)}. Nice work looking after yourself.</span>
      ) : (
        <>
          <span className="font-semibold tabular-nums">
            {Math.abs(amount).toLocaleString("en-US", { maximumFractionDigits: 1 })} {unit} to go
          </span>{" "}
          <span className="text-muted-foreground">toward {fmtWeight(target, unit)} — slow and steady counts.</span>
        </>
      )}
    </p>
  )
}

const W = 320
const H = 150
const PAD_L = 8
const PAD_R = 8
const PAD_T = 18
const PAD_B = 22

function WeightChart({ entries, unit, target }: { entries: WeightEntry[]; unit: WeightUnit; target?: number }) {
  if (entries.length < 2) {
    return <p className="text-xs text-muted-foreground">Your trend chart appears after two entries.</p>
  }
  const conv = (kg: number) => (unit === "lb" ? kg / KG_PER_LB : kg)
  const values = entries.map((e) => conv(e.kg))
  const all = target ? [...values, conv(target)] : values
  let lo = Math.min(...all)
  let hi = Math.max(...all)
  if (hi - lo < 2) {
    lo -= 1
    hi += 1
  }
  const pad = (hi - lo) * 0.1
  lo -= pad
  hi += pad
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B
  const x = (i: number) => PAD_L + (entries.length === 1 ? plotW / 2 : (i / (entries.length - 1)) * plotW)
  const y = (v: number) => PAD_T + plotH - ((v - lo) / (hi - lo)) * plotH
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 })
  const lastI = values.length - 1

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
        <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + plotH} y2={PAD_T + plotH} stroke="var(--border)" />
        {target ? (
          <g>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(conv(target))} y2={y(conv(target))} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth="1" />
            <text x={W - PAD_R} y={y(conv(target)) - 4} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
              Target {fmt(conv(target))}
            </text>
          </g>
        ) : null}
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <circle key={entries[i].date} cx={x(i)} cy={y(v)} r={i === lastI ? 4.5 : 3} fill={i === lastI ? "var(--primary)" : "var(--card)"} stroke="var(--primary)" strokeWidth="2" />
        ))}
        <text x={x(lastI)} y={y(values[lastI]) - 9} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--foreground)">
          {fmt(values[lastI])}
        </text>
        <text x={PAD_L} y={H - 6} fontSize="10" fill="var(--muted-foreground)">
          {format(fromDateString(entries[0].date), "d MMM")}
        </text>
        <text x={W - PAD_R} y={H - 6} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
          {format(fromDateString(entries[lastI].date), "d MMM")}
        </text>
      </svg>
      <figcaption className="sr-only">Weight trend, last {entries.length} entries</figcaption>
      <table className="sr-only">
        <caption>Weight entries</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Weight ({unit})</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={e.date}>
              <td>{format(fromDateString(e.date), "d MMMM yyyy")}</td>
              <td>{fmt(values[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
