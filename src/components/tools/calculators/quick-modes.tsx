"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatNumber, formatPercent } from "@/lib/math/format"
import { cn } from "@/lib/utils"
import { FormulaLine, NumberField, Segmented, Stat, readNumber, useCurrency } from "./fields"

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5", className)}>{children}</div>
}

function Results({ children }: { children: React.ReactNode }) {
  return (
    <div aria-live="polite" className="grid gap-3 sm:grid-cols-2">
      {children}
    </div>
  )
}

/* -------------------------------------------------------------- Discount */

export function DiscountMode() {
  const { currency, money } = useCurrency()
  const [price, setPrice] = useState("2000")
  const [pct, setPct] = useState("25")
  const p = readNumber(price, { min: 0 })
  const d = readNumber(pct, { min: 0, max: 100 })
  const ok = p.n !== null && d.n !== null
  const saved = ok ? (p.n! * d.n!) / 100 : 0
  return (
    <Panel>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Original price" prefix={currency} value={price} onChange={setPrice} error={p.error} />
        <NumberField label="Discount" suffix="%" value={pct} onChange={setPct} error={d.error} />
      </div>
      {ok ? (
        <>
          <Results>
            <Stat label="Final price" value={money(p.n! - saved)} emphasis />
            <Stat label="You save" value={money(saved)} />
          </Results>
          <FormulaLine>
            Final = {money(p.n!)} × (1 − {d.n}%) = {money(p.n! - saved)}
          </FormulaLine>
        </>
      ) : null}
    </Panel>
  )
}

/* ----------------------------------------------------------- Profit/Loss */

export function ProfitLossMode() {
  const { currency, money } = useCurrency()
  const [cost, setCost] = useState("1200")
  const [sell, setSell] = useState("1500")
  const c = readNumber(cost, { positive: true })
  const s = readNumber(sell, { min: 0 })
  const ok = c.n !== null && s.n !== null
  const diff = ok ? s.n! - c.n! : 0
  const pct = ok ? (diff / c.n!) * 100 : 0
  const margin = ok && s.n! > 0 ? (diff / s.n!) * 100 : null
  const label = diff > 0 ? "Profit" : diff < 0 ? "Loss" : "No profit or loss"
  return (
    <Panel>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Cost price" prefix={currency} value={cost} onChange={setCost} error={c.error} />
        <NumberField label="Selling price" prefix={currency} value={sell} onChange={setSell} error={s.error} />
      </div>
      {ok ? (
        <>
          <Results>
            <Stat
              label={label}
              value={<span className={cn(diff > 0 && "text-success", diff < 0 && "text-destructive")}>{money(Math.abs(diff))}</span>}
              emphasis
            />
            <Stat label={`${diff < 0 ? "Loss" : "Profit"} % (on cost)`} value={formatPercent(Math.abs(pct))} sub={margin !== null ? `Margin on selling price: ${formatPercent(margin)}` : undefined} />
          </Results>
          <FormulaLine>
            {label} % = ({money(s.n!)} − {money(c.n!)}) ÷ {money(c.n!)} × 100 = {formatPercent(pct)}
          </FormulaLine>
        </>
      ) : null}
    </Panel>
  )
}

/* ----------------------------------------------------------------- Ratio */

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}

/** Simplify a:b, scaling decimals to integers first (up to 6 places). */
export function simplifyRatio(a: number, b: number): [number, number] {
  const decimals = Math.max(...[a, b].map((n) => (String(n).split(".")[1] ?? "").length))
  const scale = Math.pow(10, Math.min(decimals, 6))
  const A = Math.round(a * scale)
  const B = Math.round(b * scale)
  const g = gcd(A, B) || 1
  return [A / g, B / g]
}

export function RatioMode() {
  const { locale } = useCurrency()
  const [sub, setSub] = useState<"simplify" | "solve">("simplify")
  const [a, setA] = useState("16")
  const [b, setB] = useState("24")
  const [c, setC] = useState("10")
  const A = readNumber(a, { positive: true })
  const B = readNumber(b, { positive: true })
  const C = readNumber(c, { min: 0 })
  const f = (n: number) => formatNumber(n, locale)
  return (
    <Panel>
      <Segmented
        label="Ratio mode"
        value={sub}
        onChange={setSub}
        options={[
          { value: "simplify", label: "Simplify a : b" },
          { value: "solve", label: "Solve a : b = c : x" },
        ]}
        className="w-full sm:w-auto"
      />
      <div className={cn("grid gap-4", sub === "solve" ? "grid-cols-3" : "grid-cols-2")}>
        <NumberField label="a" value={a} onChange={setA} error={A.error} />
        <NumberField label="b" value={b} onChange={setB} error={B.error} />
        {sub === "solve" ? <NumberField label="c" value={c} onChange={setC} error={C.error} /> : null}
      </div>
      {A.n !== null && B.n !== null ? (
        sub === "simplify" ? (
          (() => {
            const [x, y] = simplifyRatio(A.n, B.n)
            return (
              <>
                <Results>
                  <Stat label="Simplified ratio" value={`${f(x)} : ${f(y)}`} emphasis />
                  <Stat label="As a decimal (a ÷ b)" value={f(A.n / B.n)} sub={`a is ${formatPercent((A.n / B.n) * 100)} of b`} />
                </Results>
                <FormulaLine>
                  {f(A.n)} : {f(B.n)} — divide both by their greatest common factor → {f(x)} : {f(y)}
                </FormulaLine>
              </>
            )
          })()
        ) : C.n !== null ? (
          <>
            <Results>
              <Stat label="x" value={f((B.n * C.n) / A.n)} emphasis />
              <Stat label="Proportion" value={`${f(A.n)} : ${f(B.n)} = ${f(C.n)} : ${f((B.n * C.n) / A.n)}`} />
            </Results>
            <FormulaLine>
              x = b × c ÷ a = {f(B.n)} × {f(C.n)} ÷ {f(A.n)}
            </FormulaLine>
          </>
        ) : null
      ) : null}
    </Panel>
  )
}

/* --------------------------------------------------------------- Average */

export function parseNumberList(text: string): { numbers: number[]; invalid: string[] } {
  const parts = text.split(/[\s,;]+/).filter(Boolean)
  const numbers: number[] = []
  const invalid: string[] = []
  for (const p of parts) {
    const n = Number(p.replace(/[−–]/g, "-"))
    if (Number.isFinite(n)) numbers.push(n)
    else invalid.push(p)
  }
  return { numbers, invalid }
}

export function AverageMode() {
  const { locale } = useCurrency()
  const [text, setText] = useState("12, 15, 15, 18, 20, 27")
  const { numbers, invalid } = parseNumberList(text)
  const f = (n: number) => formatNumber(n, locale)
  const stats = (() => {
    if (!numbers.length) return null
    const sorted = [...numbers].sort((x, y) => x - y)
    const sum = numbers.reduce((s, n) => s + n, 0)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    const counts = new Map<number, number>()
    numbers.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1))
    const top = Math.max(...counts.values())
    const modes = top > 1 ? [...counts.entries()].filter(([, c]) => c === top).map(([n]) => n) : []
    return { sum, mean: sum / numbers.length, median, modes, min: sorted[0], max: sorted[sorted.length - 1] }
  })()
  return (
    <Panel>
      <div className="space-y-1.5">
        <Label htmlFor="avg-list">Numbers</Label>
        <Textarea
          id="avg-list"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          inputMode="decimal"
          aria-invalid={invalid.length ? true : undefined}
          aria-describedby="avg-help"
          placeholder="Separate with commas, spaces or new lines"
        />
        <p id="avg-help" className={cn("text-xs", invalid.length ? "text-destructive" : "text-muted-foreground")}>
          {invalid.length ? `Ignored (not numbers): ${invalid.slice(0, 5).join(", ")}${invalid.length > 5 ? "…" : ""}` : "Separate with commas, spaces or new lines. Don't use thousands separators here."}
        </p>
      </div>
      {stats ? (
        <>
          <div aria-live="polite" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Mean (average)" value={f(stats.mean)} emphasis className="col-span-2 sm:col-span-1" />
            <Stat label="Median" value={f(stats.median)} />
            <Stat label="Mode" value={stats.modes.length ? stats.modes.map(f).join(", ") : "None"} />
            <Stat label="Sum" value={f(stats.sum)} />
            <Stat label="Count" value={numbers.length} />
            <Stat label="Range" value={`${f(stats.min)} – ${f(stats.max)}`} />
          </div>
          <FormulaLine>
            Mean = sum ÷ count = {f(stats.sum)} ÷ {numbers.length}
          </FormulaLine>
        </>
      ) : null}
    </Panel>
  )
}

/* ---------------------------------------------------------- Power & Root */

export function PowerRootMode() {
  const { locale } = useCurrency()
  const [sub, setSub] = useState<"power" | "root">("power")
  const [x, setX] = useState("2")
  const [y, setY] = useState("10")
  const X = readNumber(x)
  const Y = readNumber(y, sub === "root" ? { positive: true } : {})
  const f = (n: number) => formatNumber(n, locale)
  let result: number | null = null
  let error: string | null = null
  if (X.n !== null && Y.n !== null) {
    if (sub === "power") result = Math.pow(X.n, Y.n)
    else if (X.n < 0) {
      // Odd integer roots of negative numbers are real.
      if (Number.isInteger(Y.n) && Y.n % 2 === 1) result = -Math.pow(-X.n, 1 / Y.n)
      else error = "Even roots of negative numbers aren't real numbers"
    } else result = Math.pow(X.n, 1 / Y.n)
    if (result !== null && !Number.isFinite(result)) {
      error = Number.isNaN(result) ? "The result is not a real number" : "The result is too large"
      result = null
    }
  }
  return (
    <Panel>
      <Segmented
        label="Power or root"
        value={sub}
        onChange={setSub}
        options={[
          { value: "power", label: "Power xʸ" },
          { value: "root", label: "nth root" },
        ]}
        className="w-full sm:w-auto"
      />
      <div className="grid grid-cols-2 gap-4">
        <NumberField label={sub === "power" ? "Base (x)" : "Number (x)"} value={x} onChange={setX} error={X.error} />
        <NumberField label={sub === "power" ? "Exponent (y)" : "Root (n)"} value={y} onChange={setY} error={Y.error} />
      </div>
      <div aria-live="polite">
        {result !== null ? (
          <div className="space-y-3">
            <Stat label="Result" value={f(result)} emphasis />
            <FormulaLine>
              {sub === "power" ? `${f(X.n!)} ^ ${f(Y.n!)} = ${f(result)}` : `${f(Y.n!)}√${f(X.n!)} = ${f(X.n!)} ^ (1/${f(Y.n!)}) = ${f(result)}`}
            </FormulaLine>
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
      </div>
    </Panel>
  )
}
