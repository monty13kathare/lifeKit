"use client"

import { useState } from "react"
import { CopyButton } from "@/components/common/copy-button"
import { cn } from "@/lib/utils"
import { FormulaLine, NumberField, Segmented, Stat, readNumber, useCurrency } from "./fields"

const PRESETS = [0.25, 3, 5, 12, 18, 28]

type Mode = "add" | "remove"
type Supply = "intra" | "inter"

export function GstCalculator() {
  const { currency, money } = useCurrency()
  const [mode, setMode] = useState<Mode>("add")
  const [supply, setSupply] = useState<Supply>("intra")
  const [amount, setAmount] = useState("10000")
  const [rate, setRate] = useState("18")

  const a = readNumber(amount, { min: 0 })
  const r = readNumber(rate, { min: 0, max: 100 })
  const ok = a.n !== null && r.n !== null

  let base = 0
  let gst = 0
  let total = 0
  if (ok) {
    if (mode === "add") {
      base = a.n!
      gst = (base * r.n!) / 100
      total = base + gst
    } else {
      total = a.n!
      base = total / (1 + r.n! / 100)
      gst = total - base
    }
  }
  const half = gst / 2
  const halfRate = (r.n ?? 0) / 2

  const summary = ok
    ? [
        `GST calculation (${mode === "add" ? "GST added" : "GST removed"}, ${r.n}%)`,
        `Base amount: ${money(base)}`,
        supply === "intra"
          ? `CGST @ ${halfRate}%: ${money(half)}\nSGST @ ${halfRate}%: ${money(half)}`
          : `IGST @ ${r.n}%: ${money(gst)}`,
        `Total GST: ${money(gst)}`,
        `Final amount: ${money(total)}`,
      ].join("\n")
    : ""

  return (
    <div className="space-y-5">
      <section className="space-y-5 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Segmented
            label="Calculation"
            value={mode}
            onChange={setMode}
            options={[
              { value: "add", label: "Add GST" },
              { value: "remove", label: "Remove GST" },
            ]}
            className="w-full sm:w-auto"
          />
          <Segmented
            label="Supply type"
            value={supply}
            onChange={setSupply}
            options={[
              { value: "intra", label: "Intra-state" },
              { value: "inter", label: "Inter-state" },
            ]}
            className="w-full sm:w-auto"
          />
        </div>

        <NumberField
          label={mode === "add" ? "Amount before GST" : "Amount including GST"}
          prefix={currency}
          value={amount}
          onChange={setAmount}
          error={a.error}
        />

        <div className="space-y-2">
          <p id="gst-rate-label" className="text-sm font-medium">
            GST rate
          </p>
          <div role="group" aria-labelledby="gst-rate-label" className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={r.n === p}
                onClick={() => setRate(String(p))}
                className={cn(
                  "h-10 min-w-14 rounded-lg border px-3 text-sm font-medium tabular-nums transition-colors",
                  r.n === p ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-muted"
                )}
              >
                {p}%
              </button>
            ))}
          </div>
          <NumberField label="Custom rate" suffix="%" value={rate} onChange={setRate} error={r.error} className="max-w-48" />
        </div>
      </section>

      {ok ? (
        <section aria-live="polite" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Final amount" value={money(total)} emphasis className="sm:col-span-2" />
            <Stat label="Base amount" value={money(base)} />
            <Stat label="Total GST" value={money(gst)} />
            {supply === "intra" ? (
              <>
                <Stat label={`CGST @ ${halfRate}%`} value={money(half)} />
                <Stat label={`SGST @ ${halfRate}%`} value={money(half)} />
              </>
            ) : (
              <Stat label={`IGST @ ${r.n}%`} value={money(gst)} className="sm:col-span-2" />
            )}
          </div>
          <FormulaLine>
            {mode === "add"
              ? `GST = ${money(base)} × ${r.n}% = ${money(gst)}`
              : `Base = ${money(total)} ÷ (1 + ${r.n}%) = ${money(base)}`}
          </FormulaLine>
          <CopyButton value={summary} label="Copy summary" className="w-full sm:w-auto" />
        </section>
      ) : null}
    </div>
  )
}
