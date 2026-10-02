/**
 * Lightweight self-checks for the math helpers (no test runner required).
 * Run: npx tsc src/lib/math/__tests__/self-check.ts --strict --outDir <tmp> --module commonjs && node <tmp>/__tests__/self-check.js
 */
import { evaluate, tryEvaluate } from "../expression"
import { calculateEmi, simulateLoan } from "../loan"
import { convertUnit } from "../units"

type Case = [expr: string, expected: number, percent?: boolean]

const cases: Case[] = [
  ["20% of 15000", 3000],
  ["15000 + 18%", 17700],
  ["15000 - 10%", 13500],
  ["50 is what % of 200", 25, true],
  ["what % of 200 is 50", 25, true],
  ["25% off 2000", 1500],
  ["5000 / 12", 5000 / 12],
  ["2 + 3 × 4", 14],
  ["(2 + 3) * 4", 20],
  ["2^3^2", 512],
  ["-2^2", -4],
  ["2^-1", 0.5],
  ["1,50,000 + 15,000", 165000],
  ["sqrt(16) + cbrt 27", 7],
  ["5!", 120],
  ["sin(30)", 0.5],
  ["cos 60", 0.5],
  ["log(1000)", 3],
  ["ln(e)", 1],
  ["2pi", 2 * Math.PI],
  ["10 x 3", 30],
  ["0.1 + 0.2", 0.30000000000000004],
  ["abs(-4.5)", 4.5],
  ["round(2.5)", 3],
  ["200 * 5%", 10],
  ["10 − 4 ÷ 2", 8],
  [".5 * 4", 2],
]

let failed = 0
for (const [expr, expected, pct] of cases) {
  try {
    const r = evaluate(expr)
    const ok = Math.abs(r.value - expected) < 1e-9 && (pct === undefined || r.percent === pct)
    if (!ok) {
      failed++
      console.error(`FAIL ${expr} → ${r.value}${r.percent ? "%" : ""} (expected ${expected})`)
    }
  } catch (e) {
    failed++
    console.error(`FAIL ${expr} threw ${(e as Error).message}`)
  }
}

const errors: [string, string][] = [
  ["(2+3))", "Unexpected ')' at position 6"],
  ["2 +", "ends unexpectedly"],
  ["5 / 0", "divide by zero"],
  ["(2 + 3", "Missing ')'"],
  ["2 & 3", "Unexpected character '&' at position 3"],
  ["foo(2)", "Unknown name 'foo'"],
  ["sqrt(-1)", "not a real number"],
]
for (const [expr, msg] of errors) {
  const r = tryEvaluate(expr)
  if (r.ok || !r.error.includes(msg)) {
    failed++
    console.error(`FAIL error case ${expr} → ${r.ok ? r.result.value : r.error}`)
  }
}

// EMI: ₹10,00,000 at 10% for 240 months ≈ ₹9,650.22
const emi = calculateEmi(1_000_000, 10, 240)
if (Math.abs(emi - 9650.216) > 0.01) {
  failed++
  console.error(`FAIL emi ${emi}`)
}
if (calculateEmi(120000, 0, 12) !== 10000) {
  failed++
  console.error("FAIL 0% emi")
}
const sim = simulateLoan({ principal: 1_000_000, annualRatePct: 10, months: 240, emi })
if (sim.months !== 240 || Math.abs(sim.totalPaid - emi * 240) > 1) {
  failed++
  console.error(`FAIL schedule ${sim.months} ${sim.totalPaid}`)
}
if (Math.abs(convertUnit("temperature", 100, "c", "f") - 212) > 1e-9) {
  failed++
  console.error("FAIL temperature")
}

console.log(failed ? `${failed} check(s) failed` : "All math self-checks passed")
export {}
