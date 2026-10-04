"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { History, Trash2 } from "lucide-react"
import { CopyButton } from "@/components/common/copy-button"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { tryEvaluate, type AngleMode } from "@/lib/math/expression"
import { formatNumber } from "@/lib/math/format"
import { cn } from "@/lib/utils"
import { CalculatorKeypad, type KeypadKey } from "./calculator-keypad"
import { useCurrency } from "./fields"
import { AverageMode, DiscountMode, PowerRootMode, ProfitLossMode, RatioMode } from "./quick-modes"
import { useSessionHistory } from "./session-history"

const EXAMPLES = ["20% of 15000", "15000 + 18%", "25% off 2000", "50 is what % of 200", "5000 / 12", "sqrt(144) + 3^2"]

const MODES = [
  { value: "calc", label: "Calculator" },
  { value: "discount", label: "Discount" },
  { value: "profit", label: "Profit/Loss" },
  { value: "ratio", label: "Ratio" },
  { value: "average", label: "Average" },
  { value: "power", label: "Power & Root" },
]

/** Plain, re-parseable string for a result (no grouping, no float noise). */
function rawResult(value: number): string {
  const n = Number(value.toPrecision(12))
  return Math.abs(n) >= 1e15 || (n !== 0 && Math.abs(n) < 1e-9) ? n.toExponential() : String(n)
}

export function SmartCalculator() {
  const [mode, setMode] = useState("calc")
  return (
    <Tabs value={mode} onValueChange={(v) => setMode(String(v))} className="gap-4">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="w-max">
          {MODES.map((m) => (
            <TabsTrigger key={m.value} value={m.value} className="px-3">
              {m.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="calc">
        <ExpressionCalculator />
      </TabsContent>
      <TabsContent value="discount">
        <DiscountMode />
      </TabsContent>
      <TabsContent value="profit">
        <ProfitLossMode />
      </TabsContent>
      <TabsContent value="ratio">
        <RatioMode />
      </TabsContent>
      <TabsContent value="average">
        <AverageMode />
      </TabsContent>
      <TabsContent value="power">
        <PowerRootMode />
      </TabsContent>
    </Tabs>
  )
}

function ExpressionCalculator() {
  const { locale } = useCurrency()
  const [expr, setExpr] = useState("")
  const [angle, setAngle] = useState<AngleMode>("deg")
  const [scientific, setScientific] = useState(false)
  /** After "=", errors are shown prominently; while typing they stay subtle. */
  const [committedError, setCommittedError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const caret = useRef<{ start: number; end: number } | null>(null)
  const { entries, push, clear } = useSessionHistory()

  // Desktop: start typing anywhere on the page and keys go to the expression.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (/^[\d+\-*/().%^!x×÷]$/.test(e.key) || e.key === "Backspace") inputRef.current?.focus()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const evaluation = useMemo(() => (expr.trim() ? tryEvaluate(expr, { angle }) : null), [expr, angle])
  const display = evaluation?.ok
    ? `${formatNumber(evaluation.result.value, locale)}${evaluation.result.percent ? "%" : ""}`
    : null

  const update = (next: string, nextCaret?: number) => {
    setExpr(next)
    setCommittedError(false)
    caret.current = nextCaret !== undefined ? { start: nextCaret, end: nextCaret } : null
    if (nextCaret !== undefined) {
      requestAnimationFrame(() => {
        const el = inputRef.current
        if (el && document.activeElement === el) el.setSelectionRange(nextCaret, nextCaret)
      })
    }
  }

  const insert = (text: string) => {
    const sel = caret.current ?? { start: expr.length, end: expr.length }
    const next = expr.slice(0, sel.start) + text + expr.slice(sel.end)
    update(next, sel.start + text.length)
  }

  const commit = () => {
    if (!evaluation) return
    if (!evaluation.ok) {
      setCommittedError(true)
      return
    }
    const raw = rawResult(evaluation.result.value) + (evaluation.result.percent ? "%" : "")
    push({ expression: expr.trim(), result: display ?? raw, raw })
    update(raw, raw.length)
  }

  const onKey = (k: KeypadKey) => {
    switch (k.command) {
      case "AC":
        update("", 0)
        return
      case "DEL": {
        const sel = caret.current ?? { start: expr.length, end: expr.length }
        if (sel.start !== sel.end) update(expr.slice(0, sel.start) + expr.slice(sel.end), sel.start)
        else if (sel.start > 0) update(expr.slice(0, sel.start - 1) + expr.slice(sel.start), sel.start - 1)
        return
      }
      case "=":
        commit()
        return
      case "PAREN": {
        const before = expr.slice(0, caret.current?.start ?? expr.length)
        const open = (before.match(/\(/g) ?? []).length - (before.match(/\)/g) ?? []).length
        const last = before.trimEnd().slice(-1)
        const close = open > 0 && /[\d)%!πe.]/.test(last)
        insert(close ? ")" : "(")
        return
      }
      default:
        insert(k.value)
    }
  }

  const errorMessage = evaluation && !evaluation.ok ? evaluation.error : null

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-4 shadow-soft">
          <label htmlFor="calc-expression" className="text-xs font-medium text-muted-foreground">
            Expression
          </label>
          <input
            id="calc-expression"
            ref={inputRef}
            value={expr}
            onChange={(e) => {
              setExpr(e.target.value)
              setCommittedError(false)
              caret.current = { start: e.target.selectionStart ?? e.target.value.length, end: e.target.selectionEnd ?? e.target.value.length }
            }}
            onSelect={(e) => {
              const el = e.currentTarget
              caret.current = { start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                commit()
              } else if (e.key === "Escape") {
                e.preventDefault()
                update("", 0)
              }
            }}
            placeholder="e.g. 20% of 15000"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-invalid={committedError && errorMessage ? true : undefined}
            aria-describedby="calc-result"
            className="mt-1 h-10 w-full bg-transparent text-right font-mono text-xl outline-none placeholder:text-muted-foreground/60 sm:text-2xl"
          />
          <div id="calc-result" aria-live="polite" className="mt-2 min-h-12 text-right">
            {display ? (
              <div className="flex items-center justify-end gap-2">
                <p className="text-3xl font-semibold tracking-tight break-all tabular-nums sm:text-4xl">
                  <span className="sr-only">Result: </span>= {display}
                </p>
              </div>
            ) : errorMessage ? (
              <p className={cn("text-sm", committedError ? "text-destructive" : "text-muted-foreground")}>{errorMessage}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Type or tap keys. Press Enter for the result.</p>
            )}
          </div>
          {display ? (
            <div className="mt-2 flex justify-end">
              <CopyButton value={display.replace(/,/g, "")} size="sm" label="Copy result" />
            </div>
          ) : null}
        </div>

        <CalculatorKeypad
          onKey={onKey}
          scientific={scientific}
          onScientificChange={setScientific}
          angle={angle}
          onAngleChange={setAngle}
        />

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Try natural phrases</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => update(ex, ex.length)}
                className="min-h-10 rounded-full border bg-surface px-3 text-sm transition-colors hover:bg-muted"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside aria-label="Calculation history" className="rounded-2xl border bg-card p-4 lg:self-start">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-muted-foreground" aria-hidden /> History
          </h2>
          {entries.length ? (
            <Button variant="ghost" size="sm" onClick={clear}>
              <Trash2 aria-hidden /> Clear
            </Button>
          ) : null}
        </div>
        {entries.length ? (
          <ul className="-mx-2 max-h-80 space-y-0.5 overflow-y-auto">
            {entries.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => update(h.raw, h.raw.length)}
                  className="w-full rounded-lg px-2 py-2 text-right transition-colors hover:bg-muted"
                  aria-label={`Reuse ${h.expression} = ${h.result}`}
                >
                  <span className="block truncate font-mono text-xs text-muted-foreground">{h.expression}</span>
                  <span className="block truncate font-medium tabular-nums">= {h.result}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Results you calculate appear here for this session only. Tap one to reuse it.</p>
        )}
      </aside>
    </div>
  )
}
