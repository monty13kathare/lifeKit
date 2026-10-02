/**
 * Barcode format ids (aligned with the native BarcodeDetector names) and
 * helpers for labels and product-code hints. No heavy imports here.
 */

export type CodeFormat =
  | "qr_code"
  | "ean_13"
  | "ean_8"
  | "upc_a"
  | "upc_e"
  | "code_128"
  | "code_39"
  | "code_93"
  | "itf"
  | "codabar"
  | "data_matrix"
  | "pdf417"
  | "aztec"

export const FORMAT_LABELS: Record<CodeFormat, string> = {
  qr_code: "QR Code",
  ean_13: "EAN-13",
  ean_8: "EAN-8",
  upc_a: "UPC-A",
  upc_e: "UPC-E",
  code_128: "Code 128",
  code_39: "Code 39",
  code_93: "Code 93",
  itf: "ITF",
  codabar: "Codabar",
  data_matrix: "Data Matrix",
  pdf417: "PDF417",
  aztec: "Aztec",
}

export const ALL_FORMATS = Object.keys(FORMAT_LABELS) as CodeFormat[]
export const QR_FORMATS: CodeFormat[] = ["qr_code"]
export const LINEAR_FORMATS: CodeFormat[] = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf", "codabar"]
export const MATRIX_FORMATS: CodeFormat[] = ["qr_code", "data_matrix", "pdf417", "aztec"]

export function formatLabel(format: string): string {
  return FORMAT_LABELS[format as CodeFormat] ?? format.replace(/_/g, " ").toUpperCase()
}

export function is2D(format: string): boolean {
  return (MATRIX_FORMATS as string[]).includes(format)
}

/** GS1 company prefix ranges (first 3 digits of EAN-13). Not exhaustive. */
const GS1_PREFIXES: Array<[number, number, string]> = [
  [0, 19, "USA / Canada"],
  [20, 29, "Restricted / in-store use"],
  [30, 39, "USA (drugs)"],
  [40, 49, "Restricted / in-store use"],
  [50, 59, "Coupons"],
  [60, 139, "USA / Canada"],
  [200, 299, "Restricted / in-store use"],
  [300, 379, "France / Monaco"],
  [380, 380, "Bulgaria"],
  [383, 383, "Slovenia"],
  [385, 385, "Croatia"],
  [387, 387, "Bosnia and Herzegovina"],
  [389, 389, "Montenegro"],
  [400, 440, "Germany"],
  [450, 459, "Japan"],
  [460, 469, "Russia"],
  [470, 470, "Kyrgyzstan"],
  [471, 471, "Taiwan"],
  [474, 474, "Estonia"],
  [475, 475, "Latvia"],
  [476, 476, "Azerbaijan"],
  [477, 477, "Lithuania"],
  [478, 478, "Uzbekistan"],
  [479, 479, "Sri Lanka"],
  [480, 480, "Philippines"],
  [481, 481, "Belarus"],
  [482, 482, "Ukraine"],
  [484, 484, "Moldova"],
  [485, 485, "Armenia"],
  [486, 486, "Georgia"],
  [487, 487, "Kazakhstan"],
  [489, 489, "Hong Kong"],
  [490, 499, "Japan"],
  [500, 509, "United Kingdom"],
  [520, 521, "Greece"],
  [528, 528, "Lebanon"],
  [529, 529, "Cyprus"],
  [531, 531, "North Macedonia"],
  [535, 535, "Malta"],
  [539, 539, "Ireland"],
  [540, 549, "Belgium / Luxembourg"],
  [560, 560, "Portugal"],
  [569, 569, "Iceland"],
  [570, 579, "Denmark"],
  [590, 590, "Poland"],
  [594, 594, "Romania"],
  [599, 599, "Hungary"],
  [600, 601, "South Africa"],
  [608, 608, "Bahrain"],
  [609, 609, "Mauritius"],
  [611, 611, "Morocco"],
  [613, 613, "Algeria"],
  [615, 615, "Nigeria"],
  [616, 616, "Kenya"],
  [618, 618, "Ivory Coast"],
  [619, 619, "Tunisia"],
  [621, 621, "Syria"],
  [622, 622, "Egypt"],
  [625, 625, "Jordan"],
  [626, 626, "Iran"],
  [627, 627, "Kuwait"],
  [628, 628, "Saudi Arabia"],
  [629, 629, "United Arab Emirates"],
  [640, 649, "Finland"],
  [690, 699, "China"],
  [700, 709, "Norway"],
  [729, 729, "Israel"],
  [730, 739, "Sweden"],
  [740, 745, "Central America"],
  [750, 750, "Mexico"],
  [754, 755, "Canada"],
  [759, 759, "Venezuela"],
  [760, 769, "Switzerland / Liechtenstein"],
  [770, 771, "Colombia"],
  [773, 773, "Uruguay"],
  [775, 775, "Peru"],
  [777, 777, "Bolivia"],
  [778, 779, "Argentina"],
  [780, 780, "Chile"],
  [784, 784, "Paraguay"],
  [786, 786, "Ecuador"],
  [789, 790, "Brazil"],
  [800, 839, "Italy / San Marino"],
  [840, 849, "Spain / Andorra"],
  [850, 850, "Cuba"],
  [858, 858, "Slovakia"],
  [859, 859, "Czech Republic"],
  [860, 860, "Serbia"],
  [865, 865, "Mongolia"],
  [867, 867, "North Korea"],
  [868, 869, "Turkey"],
  [870, 879, "Netherlands"],
  [880, 880, "South Korea"],
  [884, 884, "Cambodia"],
  [885, 885, "Thailand"],
  [888, 888, "Singapore"],
  [890, 890, "India"],
  [893, 893, "Vietnam"],
  [896, 896, "Pakistan"],
  [899, 899, "Indonesia"],
  [900, 919, "Austria"],
  [930, 939, "Australia"],
  [940, 949, "New Zealand"],
  [955, 955, "Malaysia"],
  [958, 958, "Macau"],
  [977, 977, "Serial publications (ISSN)"],
  [978, 979, "Books (ISBN)"],
  [980, 980, "Refund receipts"],
  [981, 984, "Coupons"],
  [990, 999, "Coupons"],
]

function gs1Region(prefix3: number): string | null {
  for (const [lo, hi, name] of GS1_PREFIXES) if (prefix3 >= lo && prefix3 <= hi) return name
  return null
}

/** Validate a GTIN (EAN-8/12/13/14) check digit. */
export function validGtin(digits: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(digits)) return false
  const nums = digits.split("").map(Number)
  const check = nums.pop()!
  const sum = nums
    .reverse()
    .reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

export interface CodeHint {
  label: string
  detail?: string
  tone?: "info" | "warning"
}

/** Human hints for product codes, e.g. "EAN-13 · GS1 prefix 890 = India". */
export function productHints(format: string, value: string): CodeHint[] {
  const hints: CodeHint[] = []
  const v = value.trim()
  if (format === "ean_13" && /^\d{13}$/.test(v)) {
    const prefix = Number(v.slice(0, 3))
    const region = gs1Region(prefix)
    if (prefix >= 978 && prefix <= 979) {
      hints.push({ label: `ISBN ${v}`, detail: "This is a book's ISBN-13." })
    } else if (region) {
      hints.push({
        label: `EAN-13 · GS1 prefix ${v.slice(0, 3)} = ${region}`,
        detail: "The prefix shows where the barcode number was registered, not necessarily where the product was made.",
      })
    }
    if (v.startsWith("0")) hints.push({ label: `Also valid as UPC-A ${v.slice(1)}` })
  }
  if (format === "upc_a" && /^\d{12}$/.test(v)) {
    hints.push({ label: "UPC-A · North American retail product code", detail: `Equivalent EAN-13: 0${v}` })
  }
  if (format === "upc_e" && /^\d{8}$/.test(v)) hints.push({ label: "UPC-E · compressed UPC for small packages" })
  if (format === "ean_8" && /^\d{8}$/.test(v)) {
    const region = gs1Region(Number(v.slice(0, 3)))
    hints.push({ label: `EAN-8 · short code for small products${region ? ` · prefix ${v.slice(0, 3)} = ${region}` : ""}` })
  }
  if (["ean_13", "ean_8", "upc_a"].includes(format) && /^\d+$/.test(v)) {
    if (!validGtin(v)) hints.push({ label: "Check digit doesn't match", detail: "The code may have been misread. Try scanning again.", tone: "warning" })
  }
  if (format === "itf" && /^\d{14}$/.test(v)) hints.push({ label: "ITF-14 · shipping carton code (GTIN-14)" })
  if (format === "code_128" && /^1Z[0-9A-Z]{16}$/i.test(v)) hints.push({ label: "Looks like a UPS tracking number" })
  if (format === "code_128" && /^\d{12}$|^\d{15}$|^\d{20,22}$/.test(v) && !hints.length)
    hints.push({ label: "Numeric Code 128 · often a shipping or tracking number" })
  return hints
}
