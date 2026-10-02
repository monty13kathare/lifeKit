/** Loan / EMI maths (reducing-balance, monthly compounding). */

export interface LoanRow {
  month: number
  opening: number
  interest: number
  principal: number
  /** Extra prepayment made this month (on top of the EMI). */
  extra: number
  payment: number
  closing: number
}

export interface YearRow {
  year: number
  opening: number
  interest: number
  principal: number
  extra: number
  payment: number
  closing: number
}

const EPS = 0.005

/** Monthly EMI: P·r·(1+r)^n / ((1+r)^n − 1), or P/n at 0% interest. */
export function calculateEmi(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0
  const r = annualRatePct / 12 / 100
  if (r === 0) return principal / months
  const f = Math.pow(1 + r, months)
  return (principal * r * f) / (f - 1)
}

export interface SimulateOptions {
  principal: number
  annualRatePct: number
  /** Scheduled tenure in months (used for the "reduce EMI" recalculation). */
  months: number
  emi: number
  /** One-time prepayment, paid together with the EMI of `month`. */
  oneTime?: { month: number; amount: number }
  /** Extra amount paid every month starting at `fromMonth`. */
  monthlyExtra?: { fromMonth: number; amount: number }
  /** After the one-time prepayment, keep the tenure and lower the EMI instead. */
  reduceEmiAfterPrepayment?: boolean
}

export interface SimulateResult {
  rows: LoanRow[]
  totalInterest: number
  totalPaid: number
  months: number
  /** EMI after a one-time prepayment when `reduceEmiAfterPrepayment` is set. */
  newEmi?: number
}

/** Month-by-month amortization with optional prepayments. */
export function simulateLoan(o: SimulateOptions): SimulateResult {
  const r = o.annualRatePct / 12 / 100
  let balance = o.principal
  let emi = o.emi
  let newEmi: number | undefined
  const rows: LoanRow[] = []
  let totalInterest = 0
  let totalPaid = 0
  // Hard cap protects against EMIs that never cover the interest.
  const cap = Math.max(o.months, 1) * 4 + 1200
  for (let month = 1; balance > EPS && month <= cap; month++) {
    const opening = balance
    const interest = balance * r
    let principal = Math.min(emi - interest, balance)
    if (principal < 0) principal = 0
    balance -= principal
    let extra = 0
    if (o.monthlyExtra && o.monthlyExtra.amount > 0 && month >= o.monthlyExtra.fromMonth) extra += o.monthlyExtra.amount
    if (o.oneTime && o.oneTime.amount > 0 && month === o.oneTime.month) extra += o.oneTime.amount
    extra = Math.min(extra, balance)
    balance -= extra
    if (balance < EPS) balance = 0
    const payment = interest + principal + extra
    totalInterest += interest
    totalPaid += payment
    rows.push({ month, opening, interest, principal, extra, payment, closing: balance })

    if (o.reduceEmiAfterPrepayment && o.oneTime && month === o.oneTime.month && balance > 0) {
      const remaining = o.months - month
      if (remaining > 0) {
        emi = calculateEmi(balance, o.annualRatePct, remaining)
        newEmi = emi
      }
    }
    // EMI doesn't even cover the interest: the loan would never be repaid.
    if (principal === 0 && extra === 0) break
  }
  return { rows, totalInterest, totalPaid, months: rows.length, newEmi }
}

export function groupByYear(rows: LoanRow[]): YearRow[] {
  const out: YearRow[] = []
  for (const row of rows) {
    const year = Math.ceil(row.month / 12)
    let y = out[out.length - 1]
    if (!y || y.year !== year) {
      y = { year, opening: row.opening, interest: 0, principal: 0, extra: 0, payment: 0, closing: row.closing }
      out.push(y)
    }
    y.interest += row.interest
    y.principal += row.principal
    y.extra += row.extra
    y.payment += row.payment
    y.closing = row.closing
  }
  return out
}

/** "3 yrs 4 mos" style duration. */
export function formatMonths(months: number): string {
  const y = Math.floor(months / 12)
  const m = months % 12
  const parts: string[] = []
  if (y) parts.push(`${y} ${y === 1 ? "year" : "years"}`)
  if (m || !y) parts.push(`${m} ${m === 1 ? "month" : "months"}`)
  return parts.join(" ")
}
