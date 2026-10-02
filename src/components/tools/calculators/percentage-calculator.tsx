"use client"

import { useState } from "react"
import { formatNumber, formatPercent } from "@/lib/math/format"
import { cn } from "@/lib/utils"
import { FormulaLine, NumberField, Stat, readNumber, useCurrency } from "./fields"

type Mode = "of" | "increase" | "decrease" | "difference" | "marks" | "discount"

const MODES: { value: Mode; label: string }[] = [
  { value: "of", label: "X% of Y" },
  { value: "increase", label: "Increase" },
  { value: "decrease", label: "Decrease" },
  { value: "difference", label: "Difference" },
  { value: "marks", label: "Marks" },
  { value: "discount", label: "Discount" },
]

/** Simple grade bands (common school scale); shown as a guide only. */
function gradeFor(pct: number): string {
  if (pct >= 90) return "A+"
  if (pct >= 80) return "A"
  if (pct >= 70) return "B+"
  if (pct >= 60) return "B"
  if (pct >= 50) return "C"
  if (pct >= 40) return "D"
  return "E"
}

export function PercentageCalculator() {
  const [mode, setMode] = useState<Mode>("of")
  return (
    <div className="space-y-4">
      <div role="group" aria-label="Calculation type" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            aria-pressed={mode === m.value}
            onClick={() => setMode(m.value)}
            className={cn(
              "h-11 rounded-xl border px-2 text-sm font-medium transition-colors",
              mode === m.value ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-muted"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        {mode === "of" && <PercentOf />}
        {mode === "increase" && <Change direction="increase" />}
        {mode === "decrease" && <Change direction="decrease" />}
        {mode === "difference" && <Difference />}
        {mode === "marks" && <Marks />}
        {mode === "discount" && <Discount />}
      </section>
    </div>
  )
}

function useFmt() {
  const { locale } = useCurrency()
  return (n: number) => formatNumber(n, locale)
}

function PercentOf() {
  const f = useFmt()
  const [x, setX] = useState("20")
  const [y, setY] = useState("15000")
  const X = readNumber(x)
  const Y = readNumber(y)
  const ok = X.n !== null && Y.n !== null
  const res = ok ? (X.n! / 100) * Y.n! : 0
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <NumberField label="Percentage (X)" suffix="%" value={x} onChange={setX} error={X.error} />
        <NumberField label="Of value (Y)" value={y} onChange={setY} error={Y.error} />
      </div>
      {ok ? (
        <div aria-live="polite" className="space-y-3">
          <Stat label={`${f(X.n!)}% of ${f(Y.n!)}`} value={f(res)} emphasis />
          <FormulaLine>
            {f(X.n!)} ÷ 100 × {f(Y.n!)} = {f(res)}
          </FormulaLine>
        </div>
      ) : null}
    </>
  )
}

function Change({ direction }: { direction: "increase" | "decrease" }) {
  const f = useFmt()
  const [from, setFrom] = useState(direction === "increase" ? "40000" : "1200")
  const [to, setTo] = useState(direction === "increase" ? "46000" : "900")
  const A = readNumber(from)
  const B = readNumber(to)
  const ok = A.n !== null && B.n !== null
  const zero = ok && A.n === 0
  const pct = ok && !zero ? ((B.n! - A.n!) / Math.abs(A.n!)) * 100 : 0
  const wrongWay = ok && !zero && (direction === "increase" ? pct < 0 : pct > 0)
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <NumberField label="Original value" value={from} onChange={setFrom} error={A.error ?? (zero ? "Original value can't be 0" : null)} />
        <NumberField label="New value" value={to} onChange={setTo} error={B.error} />
      </div>
      {ok && !zero ? (
        <div aria-live="polite" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat
              label={pct >= 0 ? "Percentage increase" : "Percentage decrease"}
              value={formatPercent(Math.abs(pct))}
              emphasis
              sub={wrongWay ? `This is actually a${pct >= 0 ? "n increase" : " decrease"}.` : undefined}
            />
            <Stat label="Change" value={`${B.n! - A.n! >= 0 ? "+" : "−"}${f(Math.abs(B.n! - A.n!))}`} />
          </div>
          <FormulaLine>
            ({f(B.n!)} − {f(A.n!)}) ÷ {f(Math.abs(A.n!))} × 100 = {formatPercent(pct)}
          </FormulaLine>
        </div>
      ) : null}
    </>
  )
}

function Difference() {
  const f = useFmt()
  const [a, setA] = useState("120")
  const [b, setB] = useState("150")
  const A = readNumber(a)
  const B = readNumber(b)
  const ok = A.n !== null && B.n !== null
  const avg = ok ? (Math.abs(A.n!) + Math.abs(B.n!)) / 2 : 0
  const pct = ok && avg !== 0 ? (Math.abs(A.n! - B.n!) / avg) * 100 : 0
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <NumberField label="Value A" value={a} onChange={setA} error={A.error} />
        <NumberField label="Value B" value={b} onChange={setB} error={B.error} />
      </div>
      {ok ? (
        avg === 0 ? (
          <p className="text-sm text-muted-foreground">Both values are 0 — there&apos;s no difference.</p>
        ) : (
          <div aria-live="polite" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Percentage difference" value={formatPercent(pct)} emphasis />
              <Stat label="Absolute difference" value={f(Math.abs(A.n! - B.n!))} />
            </div>
            <FormulaLine>
              |{f(A.n!)} − {f(B.n!)}| ÷ (({f(Math.abs(A.n!))} + {f(Math.abs(B.n!))}) ÷ 2) × 100 = {formatPercent(pct)}
            </FormulaLine>
          </div>
        )
      ) : null}
    </>
  )
}

function Marks() {
  const f = useFmt()
  const [got, setGot] = useState("432")
  const [total, setTotal] = useState("500")
  const G = readNumber(got, { min: 0 })
  const T = readNumber(total, { positive: true })
  const over = G.n !== null && T.n !== null && G.n > T.n
  const ok = G.n !== null && T.n !== null && !over
  const pct = ok ? (G.n! / T.n!) * 100 : 0
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <NumberField label="Marks obtained" value={got} onChange={setGot} error={G.error ?? (over ? "Can't be more than total" : null)} />
        <NumberField label="Total marks" value={total} onChange={setTotal} error={T.error} />
      </div>
      {ok ? (
        <div aria-live="polite" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Percentage" value={formatPercent(pct)} emphasis />
            <Stat label="Grade (guide)" value={gradeFor(pct)} sub="Common 10-point bands; your board may differ." />
          </div>
          <FormulaLine>
            {f(G.n!)} ÷ {f(T.n!)} × 100 = {formatPercent(pct)}
          </FormulaLine>
        </div>
      ) : null}
    </>
  )
}

function Discount() {
  const { currency, money } = useCurrency()
  const [price, setPrice] = useState("2499")
  const [pct, setPct] = useState("30")
  const P = readNumber(price, { min: 0 })
  const D = readNumber(pct, { min: 0, max: 100 })
  const ok = P.n !== null && D.n !== null
  const saved = ok ? (P.n! * D.n!) / 100 : 0
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <NumberField label="Price" prefix={currency} value={price} onChange={setPrice} error={P.error} />
        <NumberField label="Discount" suffix="%" value={pct} onChange={setPct} error={D.error} />
      </div>
      {ok ? (
        <div aria-live="polite" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Price after discount" value={money(P.n! - saved)} emphasis />
            <Stat label="You save" value={money(saved)} />
          </div>
          <FormulaLine>
            {money(P.n!)} − ({money(P.n!)} × {D.n}%) = {money(P.n! - saved)}
          </FormulaLine>
        </div>
      ) : null}
    </>
  )
}
