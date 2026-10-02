"use client"

import { useId, useMemo, useState } from "react"
import { Plus, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Notice } from "@/components/common/notice"
import { calculateEmi, formatMonths, groupByYear, simulateLoan, type YearRow } from "@/lib/math/loan"
import { parseNumberInput } from "@/lib/math/format"
import { cn } from "@/lib/utils"
import { BreakdownDonut } from "./breakdown-donut"
import { NumberField, Segmented, Stat, readNumber, useCurrency } from "./fields"

type TenureUnit = "months" | "years"

interface LoanInput {
  amount: string
  rate: string
  tenure: string
  unit: TenureUnit
}

interface ParsedLoan {
  principal: number
  rate: number
  months: number
}

const MAX_AMOUNT = 1_000_000_000
const MAX_MONTHS = 600

function parseLoan(l: LoanInput) {
  const amount = readNumber(l.amount, { positive: true, max: MAX_AMOUNT })
  const rate = readNumber(l.rate, { min: 0, max: 60 })
  const tenure = readNumber(l.tenure, { positive: true, max: l.unit === "years" ? MAX_MONTHS / 12 : MAX_MONTHS })
  let tenureError = tenure.error
  let months: number | null = null
  if (tenure.n !== null) {
    months = l.unit === "years" ? Math.round(tenure.n * 12) : tenure.n
    if (!Number.isInteger(months)) {
      tenureError = "Use whole months"
      months = null
    } else if (months < 1) {
      tenureError = "Tenure must be at least 1 month"
      months = null
    }
  }
  const loan: ParsedLoan | null =
    amount.n !== null && rate.n !== null && months !== null ? { principal: amount.n, rate: rate.n, months } : null
  return { loan, errors: { amount: amount.error, rate: rate.error, tenure: tenureError } }
}

/* ------------------------------------------------------------ SliderField */

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
  error,
  formatTick,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  min: number
  max: number
  step: number
  prefix?: string
  suffix?: React.ReactNode
  error?: string | null
  formatTick: (n: number) => string
}) {
  const id = useId()
  const parsed = parseNumberInput(value)
  const sliderValue = parsed === null || Number.isNaN(parsed) ? min : Math.min(max, Math.max(min, parsed))
  return (
    <div className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <Label htmlFor={id} className="pb-2.5">
          {label}
        </Label>
        <div className="relative w-40 sm:w-44">
          {prefix ? <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">{prefix}</span> : null}
          <Input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
            className={cn("h-11 text-right text-base font-medium tabular-nums", prefix && "pl-8", suffix && "pr-12")}
          />
          {typeof suffix === "string" ? (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>
          ) : null}
        </div>
      </div>
      {typeof suffix !== "string" && suffix ? <div className="flex justify-end">{suffix}</div> : null}
      <Slider
        value={sliderValue}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(String(Number((v as number).toFixed(2))))}
        aria-label={label}
      />
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{formatTick(min)}</span>
        <span>{formatTick(max)}</span>
      </div>
      {error ? (
        <p id={`${id}-err`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function LoanFields({ value, onChange, errors }: { value: LoanInput; onChange: (next: LoanInput) => void; errors: ReturnType<typeof parseLoan>["errors"] }) {
  const { currency, locale } = useCurrency()
  const compact = (n: number) =>
    locale === "en-IN"
      ? n >= 1e7
        ? `${currency}${n / 1e7} Cr`
        : `${currency}${n / 1e5} L`
      : `${currency}${n >= 1e6 ? `${n / 1e6}M` : `${n / 1e3}K`}`
  const switchUnit = (unit: TenureUnit) => {
    if (unit === value.unit) return
    const n = parseNumberInput(value.tenure)
    let tenure = value.tenure
    if (n !== null && !Number.isNaN(n)) tenure = unit === "months" ? String(Math.round(n * 12)) : String(Number((n / 12).toFixed(2)))
    onChange({ ...value, unit, tenure })
  }
  return (
    <div className="space-y-6">
      <SliderField
        label="Loan amount"
        value={value.amount}
        onChange={(amount) => onChange({ ...value, amount })}
        min={locale === "en-IN" ? 100_000 : 1_000}
        max={locale === "en-IN" ? 20_000_000 : 1_000_000}
        step={locale === "en-IN" ? 50_000 : 1_000}
        prefix={currency}
        error={errors.amount}
        formatTick={compact}
      />
      <SliderField
        label="Interest rate (p.a.)"
        value={value.rate}
        onChange={(rate) => onChange({ ...value, rate })}
        min={0}
        max={30}
        step={0.05}
        suffix="%"
        error={errors.rate}
        formatTick={(n) => `${n}%`}
      />
      <div className="space-y-2">
        <SliderField
          label="Tenure"
          value={value.tenure}
          onChange={(tenure) => onChange({ ...value, tenure })}
          min={1}
          max={value.unit === "years" ? 30 : 360}
          step={1}
          suffix={value.unit === "years" ? "yrs" : "mos"}
          error={errors.tenure}
          formatTick={(n) => `${n} ${value.unit === "years" ? "yr" : "mo"}`}
        />
        <Segmented
          label="Tenure unit"
          size="sm"
          value={value.unit}
          onChange={switchUnit}
          options={[
            { value: "years", label: "Years" },
            { value: "months", label: "Months" },
          ]}
        />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- Main component */

export function EmiCalculator() {
  const [tab, setTab] = useState("emi")
  const [loanInput, setLoanInput] = useState<LoanInput>({ amount: "1000000", rate: "8.5", tenure: "20", unit: "years" })
  const { loan, errors } = parseLoan(loanInput)

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-4">
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="emi" className="px-3">EMI</TabsTrigger>
        <TabsTrigger value="prepay" className="px-3">Prepayment</TabsTrigger>
        <TabsTrigger value="compare" className="px-3">Compare loans</TabsTrigger>
      </TabsList>

      <TabsContent value="emi">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <section aria-label="Loan details" className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5 lg:self-start">
            <LoanFields value={loanInput} onChange={setLoanInput} errors={errors} />
          </section>
          {loan ? <EmiResults loan={loan} /> : <InvalidHint />}
        </div>
      </TabsContent>

      <TabsContent value="prepay">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <section aria-label="Loan details" className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5 lg:self-start">
            <LoanFields value={loanInput} onChange={setLoanInput} errors={errors} />
          </section>
          {loan ? <Prepayment loan={loan} /> : <InvalidHint />}
        </div>
      </TabsContent>

      <TabsContent value="compare">
        <LoanComparison />
      </TabsContent>
    </Tabs>
  )
}

function InvalidHint() {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      Enter a loan amount, interest rate and tenure to see your EMI.
    </div>
  )
}

function EmiResults({ loan }: { loan: ParsedLoan }) {
  const { money } = useCurrency()
  const result = useMemo(() => {
    const emi = calculateEmi(loan.principal, loan.rate, loan.months)
    const sim = simulateLoan({ principal: loan.principal, annualRatePct: loan.rate, months: loan.months, emi })
    return { emi, totalInterest: sim.totalInterest, totalPaid: sim.totalPaid, years: groupByYear(sim.rows) }
  }, [loan.principal, loan.rate, loan.months])

  return (
    <div className="min-w-0 space-y-5">
      <div aria-live="polite" className="grid gap-3 sm:grid-cols-3">
        <Stat label="Monthly EMI" value={money(result.emi)} emphasis className="sm:col-span-3" sub={`for ${formatMonths(loan.months)}${loan.rate === 0 ? " · 0% interest" : ""}`} />
        <Stat label="Principal" value={money(loan.principal, 0)} />
        <Stat label="Total interest" value={money(result.totalInterest, 0)} />
        <Stat label="Total payment" value={money(result.totalPaid, 0)} />
      </div>
      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-semibold">Principal vs interest</h2>
        <BreakdownDonut
          centerLabel="Total payment"
          centerValue={money(result.totalPaid, 0)}
          segments={[
            { label: "Principal amount", value: loan.principal, color: "var(--chart-1)", display: money(loan.principal, 0) },
            { label: "Total interest", value: result.totalInterest, color: "var(--chart-2)", display: money(result.totalInterest, 0) },
          ]}
        />
      </section>
      <AmortizationSchedule years={result.years} />
    </div>
  )
}

/* ------------------------------------------------------------ Amortization */

function AmortizationSchedule({ years }: { years: YearRow[] }) {
  const { money } = useCurrency()
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? years : years.slice(0, 5)
  const hasExtra = years.some((y) => y.extra > 0)
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold">Yearly amortization schedule</h2>
      <p className="mt-0.5 mb-3 text-xs text-muted-foreground">Year 1 starts with your first EMI.</p>

      {/* Mobile: cards */}
      <ul className="space-y-2 md:hidden">
        {shown.map((y) => {
          const paidPct = y.opening > 0 ? ((y.opening - y.closing) / y.opening) * 100 : 100
          return (
            <li key={y.year} className="rounded-xl border bg-surface p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Year {y.year}</span>
                <span className="text-xs text-muted-foreground">Balance {money(y.closing, 0)}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Principal</dt>
                <dd className="text-right tabular-nums">{money(y.principal + y.extra, 0)}</dd>
                <dt className="text-muted-foreground">Interest</dt>
                <dd className="text-right tabular-nums">{money(y.interest, 0)}</dd>
                <dt className="text-muted-foreground">Total paid</dt>
                <dd className="text-right font-medium tabular-nums">{money(y.payment, 0)}</dd>
              </dl>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, paidPct)}%` }} />
              </div>
            </li>
          )
        })}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">Year</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Opening balance</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Principal</th>
              {hasExtra ? <th scope="col" className="py-2 pr-3 text-right font-medium">Prepaid</th> : null}
              <th scope="col" className="py-2 pr-3 text-right font-medium">Interest</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Total paid</th>
              <th scope="col" className="py-2 text-right font-medium">Closing balance</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {shown.map((y) => (
              <tr key={y.year} className="border-b last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-medium">{y.year}</th>
                <td className="py-2 pr-3 text-right">{money(y.opening, 0)}</td>
                <td className="py-2 pr-3 text-right">{money(y.principal, 0)}</td>
                {hasExtra ? <td className="py-2 pr-3 text-right">{money(y.extra, 0)}</td> : null}
                <td className="py-2 pr-3 text-right">{money(y.interest, 0)}</td>
                <td className="py-2 pr-3 text-right">{money(y.payment, 0)}</td>
                <td className="py-2 text-right">{money(y.closing, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {years.length > 5 ? (
        <Button variant="outline" className="mt-3 w-full sm:w-auto" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show fewer years" : `Show all ${years.length} years`}
        </Button>
      ) : null}
    </section>
  )
}

/* -------------------------------------------------------------- Prepayment */

function Prepayment({ loan }: { loan: ParsedLoan }) {
  const { currency, money } = useCurrency()
  const [oneTime, setOneTime] = useState("200000")
  const [oneTimeMonth, setOneTimeMonth] = useState("12")
  const [monthly, setMonthly] = useState("")
  const [monthlyFrom, setMonthlyFrom] = useState("1")
  const [strategy, setStrategy] = useState<"tenure" | "emi">("tenure")

  const ot = readNumber(oneTime, { min: 0, max: loan.principal })
  const otm = readNumber(oneTimeMonth, { min: 1, max: loan.months, integer: true })
  const me = readNumber(monthly, { min: 0, max: loan.principal })
  const mef = readNumber(monthlyFrom, { min: 1, max: loan.months, integer: true })
  const valid = !ot.error && !otm.error && !me.error && !mef.error
  const hasPrepay = (ot.n ?? 0) > 0 || (me.n ?? 0) > 0

  const result = useMemo(() => {
    if (!valid || !hasPrepay) return null
    const emi = calculateEmi(loan.principal, loan.rate, loan.months)
    const base = simulateLoan({ principal: loan.principal, annualRatePct: loan.rate, months: loan.months, emi })
    const next = simulateLoan({
      principal: loan.principal,
      annualRatePct: loan.rate,
      months: loan.months,
      emi,
      oneTime: ot.n ? { month: otm.n ?? 1, amount: ot.n } : undefined,
      monthlyExtra: me.n ? { fromMonth: mef.n ?? 1, amount: me.n } : undefined,
      reduceEmiAfterPrepayment: strategy === "emi",
    })
    return { emi, base, next }
  }, [valid, hasPrepay, loan.principal, loan.rate, loan.months, ot.n, otm.n, me.n, mef.n, strategy])

  return (
    <div className="min-w-0 space-y-5">
      <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <h2 className="text-sm font-semibold">Extra payments</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="One-time prepayment" prefix={currency} value={oneTime} onChange={setOneTime} error={ot.error} placeholder="0" />
          <NumberField label="Paid in month" value={oneTimeMonth} onChange={setOneTimeMonth} error={otm.error} hint={`1 – ${loan.months}`} />
          <NumberField label="Extra every month" prefix={currency} value={monthly} onChange={setMonthly} error={me.error} placeholder="0" />
          <NumberField label="Starting from month" value={monthlyFrom} onChange={setMonthlyFrom} error={mef.error} />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">After the one-time prepayment</p>
          <Segmented
            label="Prepayment strategy"
            value={strategy}
            onChange={setStrategy}
            options={[
              { value: "tenure", label: "Reduce tenure" },
              { value: "emi", label: "Reduce EMI" },
            ]}
            className="w-full sm:w-auto"
          />
          <p className="text-xs text-muted-foreground">Monthly extra payments always shorten the tenure.</p>
        </div>
      </section>

      {result ? (
        <div aria-live="polite" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat
              label="Interest saved"
              value={<span className="text-success">{money(Math.max(0, result.base.totalInterest - result.next.totalInterest), 0)}</span>}
              emphasis
            />
            {strategy === "emi" && result.next.newEmi !== undefined && !me.n ? (
              <Stat label="New EMI" value={money(result.next.newEmi)} emphasis sub={`was ${money(result.emi)}`} />
            ) : (
              <Stat
                label="Months saved"
                value={`${Math.max(0, result.base.months - result.next.months)}`}
                emphasis
                sub={`New tenure: ${formatMonths(result.next.months)}`}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CompareCard title="Without prepayment" rows={[["EMI", money(result.emi)], ["Tenure", formatMonths(result.base.months)], ["Total interest", money(result.base.totalInterest, 0)], ["Total paid", money(result.base.totalPaid, 0)]]} />
            <CompareCard
              title="With prepayment"
              highlight
              rows={[
                ["EMI", money(result.next.newEmi ?? result.emi)],
                ["Tenure", formatMonths(result.next.months)],
                ["Total interest", money(result.next.totalInterest, 0)],
                ["Total paid", money(result.next.totalPaid, 0)],
              ]}
            />
          </div>
          <AmortizationSchedule years={groupByYear(result.next.rows)} />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {valid ? "Add a one-time or monthly extra payment to see how much interest you save." : "Fix the highlighted fields to see results."}
        </div>
      )}
    </div>
  )
}

function CompareCard({ title, rows, highlight }: { title: string; rows: [string, string][]; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-surface p-3", highlight && "border-primary/30 bg-primary/5")}>
      <p className="text-xs font-semibold">{title}</p>
      <dl className="mt-2 space-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-medium tabular-nums break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* -------------------------------------------------------- Loan comparison */

const LOAN_NAMES = ["Loan A", "Loan B", "Loan C"]

function LoanComparison() {
  const { currency, money } = useCurrency()
  const [loans, setLoans] = useState<LoanInput[]>([
    { amount: "1000000", rate: "8.5", tenure: "20", unit: "years" },
    { amount: "1000000", rate: "9.1", tenure: "15", unit: "years" },
  ])
  const parsed = loans.map(parseLoan)
  const results = parsed.map(({ loan }) => {
    if (!loan) return null
    const emi = calculateEmi(loan.principal, loan.rate, loan.months)
    const sim = simulateLoan({ principal: loan.principal, annualRatePct: loan.rate, months: loan.months, emi })
    return { emi, totalInterest: sim.totalInterest, totalPaid: sim.totalPaid }
  })
  const valid = results.filter((r): r is NonNullable<typeof r> => r !== null)
  const cheapest = valid.length >= 2 ? Math.min(...valid.map((r) => r.totalInterest)) : null
  const setLoan = (i: number, patch: Partial<LoanInput>) => setLoans((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loans.map((l, i) => {
          const r = results[i]
          const e = parsed[i].errors
          const best = r && cheapest !== null && Math.abs(r.totalInterest - cheapest) < 0.5
          return (
            <section
              key={i}
              aria-label={LOAN_NAMES[i]}
              className={cn("space-y-4 rounded-2xl border bg-card p-4 shadow-soft", best && "border-success/50 ring-2 ring-success/30")}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{LOAN_NAMES[i]}</h2>
                <div className="flex items-center gap-1">
                  {best ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                      <Trophy className="size-3.5" aria-hidden /> Lowest interest
                    </span>
                  ) : null}
                  {loans.length > 2 ? (
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${LOAN_NAMES[i]}`} onClick={() => setLoans((prev) => prev.filter((_, j) => j !== i))}>
                      <X aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </div>
              <NumberField label="Loan amount" prefix={currency} value={l.amount} onChange={(amount) => setLoan(i, { amount })} error={e.amount} />
              <NumberField label="Interest rate (p.a.)" suffix="%" value={l.rate} onChange={(rate) => setLoan(i, { rate })} error={e.rate} />
              <div className="space-y-2">
                <NumberField label="Tenure" suffix={l.unit === "years" ? "yrs" : "mos"} value={l.tenure} onChange={(tenure) => setLoan(i, { tenure })} error={e.tenure} />
                <Segmented
                  label={`${LOAN_NAMES[i]} tenure unit`}
                  size="sm"
                  value={l.unit}
                  onChange={(unit) => {
                    const n = parseNumberInput(l.tenure)
                    const tenure = n === null || Number.isNaN(n) || unit === l.unit ? l.tenure : unit === "months" ? String(Math.round(n * 12)) : String(Number((n / 12).toFixed(2)))
                    setLoan(i, { unit, tenure })
                  }}
                  options={[
                    { value: "years", label: "Years" },
                    { value: "months", label: "Months" },
                  ]}
                />
              </div>
              <dl aria-live="polite" className="grid grid-cols-3 gap-2 border-t pt-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">EMI</dt>
                  <dd className="font-semibold tabular-nums break-words">{r ? money(r.emi, 0) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Interest</dt>
                  <dd className="font-semibold tabular-nums break-words">{r ? money(r.totalInterest, 0) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Total</dt>
                  <dd className="font-semibold tabular-nums break-words">{r ? money(r.totalPaid, 0) : "—"}</dd>
                </div>
              </dl>
            </section>
          )
        })}
        {loans.length < 3 ? (
          <button
            type="button"
            onClick={() => setLoans((prev) => [...prev, { ...prev[prev.length - 1] }])}
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="size-5" aria-hidden /> Add a third loan
          </button>
        ) : null}
      </div>
      {cheapest !== null ? (
        <Notice tone="info">The highlighted loan costs the least in total interest. Processing fees and other charges aren&apos;t included.</Notice>
      ) : null}
    </div>
  )
}
