/** Unit conversion tables. Linear units convert through a base unit factor. */

export type UnitCategoryId = "length" | "weight" | "temperature" | "area" | "volume" | "speed" | "time" | "data"

export interface Unit {
  id: string
  label: string
  symbol: string
  /** Multiply by this to get the base unit (ignored for temperature). */
  factor: number
}

export interface UnitCategory {
  id: UnitCategoryId
  label: string
  units: Unit[]
  defaultFrom: string
  defaultTo: string
}

const u = (id: string, label: string, symbol: string, factor: number): Unit => ({ id, label, symbol, factor })

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: "length",
    label: "Length",
    defaultFrom: "km",
    defaultTo: "mi",
    units: [
      u("mm", "Millimetre", "mm", 0.001),
      u("cm", "Centimetre", "cm", 0.01),
      u("m", "Metre", "m", 1),
      u("km", "Kilometre", "km", 1000),
      u("in", "Inch", "in", 0.0254),
      u("ft", "Foot", "ft", 0.3048),
      u("yd", "Yard", "yd", 0.9144),
      u("mi", "Mile", "mi", 1609.344),
      u("nmi", "Nautical mile", "nmi", 1852),
    ],
  },
  {
    id: "weight",
    label: "Weight",
    defaultFrom: "kg",
    defaultTo: "lb",
    units: [
      u("mg", "Milligram", "mg", 0.000001),
      u("g", "Gram", "g", 0.001),
      u("kg", "Kilogram", "kg", 1),
      u("t", "Tonne", "t", 1000),
      u("oz", "Ounce", "oz", 0.028349523125),
      u("lb", "Pound", "lb", 0.45359237),
      u("st", "Stone", "st", 6.35029318),
    ],
  },
  {
    id: "temperature",
    label: "Temperature",
    defaultFrom: "c",
    defaultTo: "f",
    units: [u("c", "Celsius", "°C", 1), u("f", "Fahrenheit", "°F", 1), u("k", "Kelvin", "K", 1)],
  },
  {
    id: "area",
    label: "Area",
    defaultFrom: "sqft",
    defaultTo: "sqm",
    units: [
      u("sqcm", "Square centimetre", "cm²", 0.0001),
      u("sqm", "Square metre", "m²", 1),
      u("sqkm", "Square kilometre", "km²", 1_000_000),
      u("sqin", "Square inch", "in²", 0.00064516),
      u("sqft", "Square foot", "ft²", 0.09290304),
      u("sqyd", "Square yard", "yd²", 0.83612736),
      u("acre", "Acre", "ac", 4046.8564224),
      u("ha", "Hectare", "ha", 10_000),
      u("sqmi", "Square mile", "mi²", 2_589_988.110336),
    ],
  },
  {
    id: "volume",
    label: "Volume",
    defaultFrom: "l",
    defaultTo: "galus",
    units: [
      u("ml", "Millilitre", "mL", 0.001),
      u("l", "Litre", "L", 1),
      u("m3", "Cubic metre", "m³", 1000),
      u("tsp", "Teaspoon (US)", "tsp", 0.00492892159375),
      u("tbsp", "Tablespoon (US)", "tbsp", 0.0147867647813),
      u("cup", "Cup (US)", "cup", 0.2365882365),
      u("floz", "Fluid ounce (US)", "fl oz", 0.0295735295625),
      u("galus", "Gallon (US)", "gal", 3.785411784),
      u("galuk", "Gallon (UK)", "gal (UK)", 4.54609),
      u("ft3", "Cubic foot", "ft³", 28.316846592),
    ],
  },
  {
    id: "speed",
    label: "Speed",
    defaultFrom: "kmh",
    defaultTo: "mph",
    units: [
      u("ms", "Metres per second", "m/s", 1),
      u("kmh", "Kilometres per hour", "km/h", 1 / 3.6),
      u("mph", "Miles per hour", "mph", 0.44704),
      u("fts", "Feet per second", "ft/s", 0.3048),
      u("kn", "Knot", "kn", 1852 / 3600),
    ],
  },
  {
    id: "time",
    label: "Time",
    defaultFrom: "h",
    defaultTo: "min",
    units: [
      u("ms", "Millisecond", "ms", 0.001),
      u("s", "Second", "s", 1),
      u("min", "Minute", "min", 60),
      u("h", "Hour", "h", 3600),
      u("d", "Day", "d", 86_400),
      u("wk", "Week", "wk", 604_800),
      u("mo", "Month (avg)", "mo", 2_629_800),
      u("yr", "Year (365.25 d)", "yr", 31_557_600),
    ],
  },
  {
    id: "data",
    label: "Data size",
    defaultFrom: "GB",
    defaultTo: "MB",
    units: [
      u("bit", "Bit", "bit", 0.125),
      u("B", "Byte", "B", 1),
      u("KB", "Kilobyte (1000)", "KB", 1e3),
      u("MB", "Megabyte (1000²)", "MB", 1e6),
      u("GB", "Gigabyte (1000³)", "GB", 1e9),
      u("TB", "Terabyte (1000⁴)", "TB", 1e12),
      u("KiB", "Kibibyte (1024)", "KiB", 1024),
      u("MiB", "Mebibyte (1024²)", "MiB", 1024 ** 2),
      u("GiB", "Gibibyte (1024³)", "GiB", 1024 ** 3),
      u("TiB", "Tebibyte (1024⁴)", "TiB", 1024 ** 4),
    ],
  },
]

export function getCategory(id: UnitCategoryId): UnitCategory {
  return UNIT_CATEGORIES.find((c) => c.id === id) ?? UNIT_CATEGORIES[0]
}

function toCelsius(v: number, from: string) {
  if (from === "f") return ((v - 32) * 5) / 9
  if (from === "k") return v - 273.15
  return v
}
function fromCelsius(c: number, to: string) {
  if (to === "f") return (c * 9) / 5 + 32
  if (to === "k") return c + 273.15
  return c
}

export function convertUnit(category: UnitCategoryId, value: number, from: string, to: string): number {
  if (category === "temperature") return fromCelsius(toCelsius(value, from), to)
  const cat = getCategory(category)
  const f = cat.units.find((x) => x.id === from)
  const t = cat.units.find((x) => x.id === to)
  if (!f || !t) return NaN
  return (value * f.factor) / t.factor
}

/** Below absolute zero? Only meaningful for temperature. */
export function isBelowAbsoluteZero(value: number, unit: string): boolean {
  return toCelsius(value, unit) < -273.15
}
