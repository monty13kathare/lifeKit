"use client"

import { useId, useState } from "react"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CopyButton } from "@/components/common/copy-button"
import { formatNumber } from "@/lib/math/format"
import { UNIT_CATEGORIES, convertUnit, getCategory, isBelowAbsoluteZero, type UnitCategoryId } from "@/lib/math/units"
import { cn } from "@/lib/utils"
import { NumberField, readNumber, useCurrency } from "./fields"

export function UnitConverter() {
  const { locale } = useCurrency()
  const [categoryId, setCategoryId] = useState<UnitCategoryId>("length")
  const category = getCategory(categoryId)
  const [from, setFrom] = useState(category.defaultFrom)
  const [to, setTo] = useState(category.defaultTo)
  const [value, setValue] = useState("1")

  const selectCategory = (id: UnitCategoryId) => {
    const c = getCategory(id)
    setCategoryId(id)
    setFrom(c.defaultFrom)
    setTo(c.defaultTo)
  }

  const v = readNumber(value)
  const tempError = categoryId === "temperature" && v.n !== null && isBelowAbsoluteZero(v.n, from) ? "That's below absolute zero" : null
  const negativeError = categoryId !== "temperature" && v.n !== null && v.n < 0 ? "Use a value of 0 or more" : null
  const error = v.error ?? tempError ?? negativeError
  const result = v.n !== null && !error ? convertUnit(categoryId, v.n, from, to) : null
  const fromUnit = category.units.find((u) => u.id === from)!
  const toUnit = category.units.find((u) => u.id === to)!
  const items = category.units.map((u) => ({ value: u.id, label: `${u.label} (${u.symbol})` }))
  const resultText = result !== null ? formatNumber(result, locale) : ""

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Measurement" className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
        {UNIT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={categoryId === c.id}
            onClick={() => selectCategory(c.id)}
            className={cn(
              "h-11 rounded-xl border px-2 text-sm font-medium transition-colors",
              categoryId === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-muted"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <NumberField label="Value" value={value} onChange={setValue} error={error} />
        <UnitSelect label="From" value={from} onChange={setFrom} items={items} />
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            aria-label="Swap units"
            onClick={() => {
              setFrom(to)
              setTo(from)
              if (result !== null) setValue(String(Number(result.toPrecision(12))))
            }}
          >
            <ArrowUpDown aria-hidden />
          </Button>
        </div>
        <UnitSelect label="To" value={to} onChange={setTo} items={items} />

        <div aria-live="polite" className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          {result !== null ? (
            <>
              <p className="text-xs text-muted-foreground">
                {formatNumber(v.n!, locale)} {fromUnit.symbol} =
              </p>
              <p className="mt-1 text-3xl font-semibold break-all text-primary tabular-nums">
                {resultText} <span className="text-lg font-medium text-foreground">{toUnit.symbol}</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                1 {fromUnit.symbol} = {formatNumber(convertUnit(categoryId, 1, from, to), locale)} {toUnit.symbol}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Enter a value to convert.</p>
          )}
        </div>
        {result !== null ? <CopyButton value={`${resultText.replace(/,/g, "")} ${toUnit.symbol}`} label="Copy result" className="w-full sm:w-auto" /> : null}
      </section>
    </div>
  )
}

function UnitSelect({ label, value, onChange, items }: { label: string; value: string; onChange: (v: string) => void; items: { value: string; label: string }[] }) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select items={items} value={value} onValueChange={(v) => v && onChange(v as string)}>
        <SelectTrigger id={id} className="h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
