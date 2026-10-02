/**
 * Safe expression evaluator for the Smart Calculator.
 *
 * A hand-written tokenizer + recursive-descent parser — no `eval`, no
 * `new Function`. Supports natural percentage phrases such as
 * "20% of 15000", "15000 + 18%", "25% off 2000" and "50 is what % of 200".
 *
 * Grammar (lowest → highest precedence):
 *   statement      := additive | additive "is what %" "of" additive | "what %" "of" additive "is" additive
 *   additive       := multiplicative (("+" | "-") multiplicative)*
 *   multiplicative := unary (("*" | "/" | "of" | "off" | <implicit>) unary)*
 *   unary          := ("-" | "+") unary | power
 *   power          := postfix ("^" unary)?            (right-associative)
 *   postfix        := primary ("!" | "%")*
 *   primary        := number | constant | function arg | "(" additive ")"
 */

export type AngleMode = "deg" | "rad"

export interface EvaluateOptions {
  angle?: AngleMode
}

export interface EvaluateResult {
  value: number
  /** True when the result is a percentage (e.g. "50 is what % of 200" → 25%). */
  percent: boolean
}

export class MathError extends Error {
  /** 1-based character position in the original input, when known. */
  position?: number
  constructor(message: string, position?: number) {
    super(message)
    this.name = "MathError"
    this.position = position
  }
}

/* ---------------------------------------------------------------- Tokens */

type TokenType = "num" | "ident" | "op" | "lparen" | "rparen" | "end"

interface Token {
  type: TokenType
  /** Normalised text: operators are ASCII (`*`, `/`, `-`), identifiers lower-case. */
  value: string
  /** Text as typed, for error messages. */
  raw: string
  /** 0-based index into the input. */
  pos: number
  num?: number
}

const OPERATOR_MAP: Record<string, string> = {
  "+": "+",
  "-": "-",
  "−": "-",
  "–": "-",
  "*": "*",
  "×": "*",
  "·": "*",
  "/": "/",
  "÷": "/",
  "^": "^",
  "!": "!",
  "%": "%",
}

const isDigit = (c: string) => c >= "0" && c <= "9"
const isLetter = (c: string) => /[a-zA-Zπ√]/.test(c)

export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const c = input[i]
    if (/\s/.test(c)) {
      i++
      continue
    }

    // Numbers: digits with optional thousands separators (1,50,000 or 15,000) and decimals.
    if (isDigit(c) || (c === "." && isDigit(input[i + 1] ?? ""))) {
      const start = i
      let text = ""
      while (i < input.length) {
        const ch = input[i]
        if (isDigit(ch)) text += ch
        else if (ch === "," && isDigit(input[i + 1] ?? "") && !text.includes(".") && text.length > 0) {
          /* thousands separator – skip */
        } else break
        i++
      }
      if (input[i] === ".") {
        text += "."
        i++
        if (input[i] === ".") throw new MathError(`Unexpected '.' at position ${i + 1}`, i + 1)
        while (i < input.length && isDigit(input[i])) text += input[i++]
      }
      // Scientific notation, e.g. 1.5e6 (only when followed by a digit or sign+digit).
      if ((input[i] === "e" || input[i] === "E") && (isDigit(input[i + 1] ?? "") || (/[+-]/.test(input[i + 1] ?? "") && isDigit(input[i + 2] ?? "")))) {
        text += "e"
        i++
        if (/[+-]/.test(input[i])) text += input[i++]
        while (i < input.length && isDigit(input[i])) text += input[i++]
      }
      if (input[i] === ".") throw new MathError(`Unexpected '.' at position ${i + 1}`, i + 1)
      tokens.push({ type: "num", value: text, raw: input.slice(start, i), pos: start, num: Number(text) })
      continue
    }

    if (c === "*" && input[i + 1] === "*") {
      tokens.push({ type: "op", value: "^", raw: "**", pos: i })
      i += 2
      continue
    }

    if (c in OPERATOR_MAP) {
      tokens.push({ type: "op", value: OPERATOR_MAP[c], raw: c, pos: i })
      i++
      continue
    }
    if (c === "(" || c === "[") {
      tokens.push({ type: "lparen", value: "(", raw: c, pos: i })
      i++
      continue
    }
    if (c === ")" || c === "]") {
      tokens.push({ type: "rparen", value: ")", raw: c, pos: i })
      i++
      continue
    }

    if (c === "π") {
      tokens.push({ type: "ident", value: "pi", raw: c, pos: i })
      i++
      continue
    }
    if (c === "√") {
      tokens.push({ type: "ident", value: "sqrt", raw: c, pos: i })
      i++
      continue
    }
    if (c === "∛") {
      tokens.push({ type: "ident", value: "cbrt", raw: c, pos: i })
      i++
      continue
    }

    if (isLetter(c)) {
      const start = i
      while (i < input.length && /[a-zA-Z]/.test(input[i])) i++
      // Allow digits inside known names like log10 / log2.
      let word = input.slice(start, i).toLowerCase()
      if ((word === "log") && input.slice(i, i + 2) === "10") {
        word = "log10"
        i += 2
      } else if (word === "log" && input[i] === "2" && !isDigit(input[i + 1] ?? "")) {
        word = "log2"
        i += 1
      }
      const raw = input.slice(start, i)
      if (word === "x") tokens.push({ type: "op", value: "*", raw, pos: start })
      else tokens.push({ type: "ident", value: word, raw, pos: start })
      continue
    }

    throw new MathError(`Unexpected character '${c}' at position ${i + 1}`, i + 1)
  }
  tokens.push({ type: "end", value: "", raw: "", pos: input.length })
  return tokens
}

/* ------------------------------------------------------------ Evaluation */

interface Val {
  v: number
  /** Value is a percentage: `v` is in percent units (5 means 5%). */
  pct: boolean
}

const plain = (v: number): Val => ({ v, pct: false })
const asNumber = (x: Val) => (x.pct ? x.v / 100 : x.v)

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
  phi: (1 + Math.sqrt(5)) / 2,
}

const KEYWORDS = new Set(["of", "off", "is", "what"])

function factorial(n: number, pos: number): number {
  if (!Number.isInteger(n) || n < 0) throw new MathError(`Factorial needs a whole number ≥ 0 (at position ${pos + 1})`, pos + 1)
  if (n > 170) throw new MathError("Number is too large for factorial", pos + 1)
  let r = 1
  for (let k = 2; k <= n; k++) r *= k
  return r
}

type Fn = (x: number, angle: AngleMode) => number

const toRad = (x: number, a: AngleMode) => (a === "deg" ? (x * Math.PI) / 180 : x)
const fromRad = (x: number, a: AngleMode) => (a === "deg" ? (x * 180) / Math.PI : x)
/** Snap tiny floating noise (sin(180°) = 1.2e-16) to zero. */
const clean = (x: number) => (Math.abs(x) < 1e-12 ? 0 : x)

const FUNCTIONS: Record<string, Fn> = {
  sqrt: (x) => Math.sqrt(x),
  cbrt: (x) => Math.cbrt(x),
  sin: (x, a) => clean(Math.sin(toRad(x, a))),
  cos: (x, a) => clean(Math.cos(toRad(x, a))),
  tan: (x, a) => {
    if (a === "deg" && Math.abs(((x % 180) + 180) % 180 - 90) < 1e-12) return NaN
    return clean(Math.tan(toRad(x, a)))
  },
  asin: (x, a) => fromRad(Math.asin(x), a),
  acos: (x, a) => fromRad(Math.acos(x), a),
  atan: (x, a) => fromRad(Math.atan(x), a),
  log: (x) => Math.log10(x),
  log10: (x) => Math.log10(x),
  log2: (x) => Math.log2(x),
  ln: (x) => Math.log(x),
  exp: (x) => Math.exp(x),
  abs: (x) => Math.abs(x),
  round: (x) => Math.round(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
}
const FUNCTION_ALIASES: Record<string, string> = { arcsin: "asin", arccos: "acos", arctan: "atan" }

function describe(t: Token): string {
  if (t.type === "end") return "end of expression"
  return `'${t.raw}'`
}

class Parser {
  private i = 0
  constructor(
    private tokens: Token[],
    private angle: AngleMode,
    /** Index of the token that acts as the end sentinel for this parser. */
    private endIndex: number
  ) {}

  private peek(offset = 0): Token {
    const idx = this.i + offset
    return idx >= this.endIndex ? { ...this.tokens[this.endIndex], type: "end" } : this.tokens[idx]
  }
  private next(): Token {
    const t = this.peek()
    if (t.type !== "end") this.i++
    return t
  }
  private unexpected(t: Token): never {
    if (t.type === "end") throw new MathError("The expression ends unexpectedly", t.pos + 1)
    throw new MathError(`Unexpected ${describe(t)} at position ${t.pos + 1}`, t.pos + 1)
  }
  private isOp(t: Token, op: string) {
    return t.type === "op" && t.value === op
  }
  private isWord(t: Token, w: string) {
    return t.type === "ident" && t.value === w
  }

  parseAll(): Val {
    const v = this.additive()
    const t = this.peek()
    if (t.type !== "end") {
      if (t.type === "rparen") throw new MathError(`Unexpected ')' at position ${t.pos + 1}`, t.pos + 1)
      this.unexpected(t)
    }
    return v
  }

  private additive(): Val {
    let left = this.multiplicative()
    for (;;) {
      const t = this.peek()
      if (!this.isOp(t, "+") && !this.isOp(t, "-")) return left
      this.next()
      const right = this.multiplicative()
      const sign = t.value === "+" ? 1 : -1
      if (right.pct && left.pct) left = { v: left.v + sign * right.v, pct: true }
      else if (right.pct) {
        // "15000 + 18%" → 15000 × 1.18 ; "15000 - 10%" → 15000 × 0.9
        const base = asNumber(left)
        left = plain(base + sign * base * (right.v / 100))
      } else left = plain(asNumber(left) + sign * right.v)
    }
  }

  private startsOperand(t: Token): boolean {
    if (t.type === "num" || t.type === "lparen") return true
    if (t.type === "ident" && !KEYWORDS.has(t.value)) return true
    return false
  }

  private multiplicative(): Val {
    let left = this.unary()
    for (;;) {
      const t = this.peek()
      if (this.isOp(t, "*")) {
        this.next()
        const right = this.unary()
        left = plain(asNumber(left) * asNumber(right))
      } else if (this.isOp(t, "/")) {
        this.next()
        const right = this.unary()
        const d = asNumber(right)
        if (d === 0) throw new MathError("Cannot divide by zero", t.pos + 1)
        left = plain(asNumber(left) / d)
      } else if (this.isWord(t, "of")) {
        this.next()
        const right = this.unary()
        // "20% of 15000" → 3000 ; "0.2 of 15000" → 3000
        left = plain(asNumber(left) * asNumber(right))
      } else if (this.isWord(t, "off")) {
        if (!left.pct) throw new MathError(`Use a percentage before 'off', like "25% off 2000" (position ${t.pos + 1})`, t.pos + 1)
        this.next()
        const right = this.unary()
        left = plain(asNumber(right) * (1 - left.v / 100))
      } else if (this.startsOperand(t)) {
        // Implicit multiplication: 2pi, 3(4+1), (2)(3)
        const right = this.unary()
        left = plain(asNumber(left) * asNumber(right))
      } else return left
    }
  }

  private unary(): Val {
    const t = this.peek()
    if (this.isOp(t, "-")) {
      this.next()
      const v = this.unary()
      return { v: -v.v, pct: v.pct }
    }
    if (this.isOp(t, "+")) {
      this.next()
      return this.unary()
    }
    return this.power()
  }

  private power(): Val {
    const base = this.postfix()
    const t = this.peek()
    if (this.isOp(t, "^")) {
      this.next()
      const exp = this.unary()
      return plain(Math.pow(asNumber(base), asNumber(exp)))
    }
    return base
  }

  private postfix(): Val {
    let v = this.primary()
    for (;;) {
      const t = this.peek()
      if (this.isOp(t, "!")) {
        this.next()
        v = plain(factorial(asNumber(v), t.pos))
      } else if (this.isOp(t, "%")) {
        this.next()
        if (v.pct) throw new MathError(`Unexpected '%' at position ${t.pos + 1}`, t.pos + 1)
        v = { v: v.v, pct: true }
      } else return v
    }
  }

  private primary(): Val {
    const t = this.next()
    if (t.type === "num") {
      if (!Number.isFinite(t.num)) throw new MathError(`Invalid number '${t.raw}' at position ${t.pos + 1}`, t.pos + 1)
      return plain(t.num!)
    }
    if (t.type === "lparen") {
      const inner = this.additive()
      const close = this.peek()
      if (close.type !== "rparen") {
        if (close.type === "end") throw new MathError(`Missing ')' for the '(' at position ${t.pos + 1}`, t.pos + 1)
        this.unexpected(close)
      }
      this.next()
      return inner
    }
    if (t.type === "ident") {
      const name = FUNCTION_ALIASES[t.value] ?? t.value
      if (name in CONSTANTS) return plain(CONSTANTS[name])
      const fn = FUNCTIONS[name]
      if (fn) {
        const nextTok = this.peek()
        if (nextTok.type === "end") throw new MathError(`'${t.raw}' needs a value, like ${name}(9)`, t.pos + 1)
        const arg = nextTok.type === "lparen" ? this.primary() : this.unary()
        return plain(fn(asNumber(arg), this.angle))
      }
      if (KEYWORDS.has(name)) throw new MathError(`Unexpected '${t.raw}' at position ${t.pos + 1}`, t.pos + 1)
      throw new MathError(`Unknown name '${t.raw}' at position ${t.pos + 1}`, t.pos + 1)
    }
    this.unexpected(t)
  }
}

/** Find "is what % of" / "what % of … is" phrases at the top level. */
function findPhrase(tokens: Token[]): { kind: "is-what" | "what-of"; a: [number, number]; b: [number, number] } | null {
  const end = tokens.length - 1
  const word = (i: number, w: string) => tokens[i]?.type === "ident" && tokens[i].value === w
  const pct = (i: number) => tokens[i]?.type === "op" && tokens[i].value === "%"
  // "A is what % of B" → A / B × 100
  for (let i = 0; i < end; i++) {
    if (word(i, "is") && word(i + 1, "what") && pct(i + 2) && word(i + 3, "of")) {
      return { kind: "is-what", a: [0, i], b: [i + 4, end] }
    }
  }
  // "what % of B is A" → A / B × 100
  if (word(0, "what") && pct(1) && word(2, "of")) {
    for (let i = 3; i < end; i++) {
      if (word(i, "is")) return { kind: "what-of", a: [i + 1, end], b: [3, i] }
    }
  }
  return null
}

function evalSlice(tokens: Token[], [from, to]: [number, number], angle: AngleMode): number {
  if (from >= to) {
    const t = tokens[Math.min(to, tokens.length - 1)]
    throw new MathError(`A number is missing near position ${t.pos + 1}`, t.pos + 1)
  }
  // Re-index so the parser sees a clean slice ending with an "end" sentinel.
  const slice = [...tokens.slice(from, to), { type: "end" as const, value: "", raw: "", pos: tokens[to]?.pos ?? 0 }]
  const p = new Parser(slice, angle, slice.length - 1)
  return asNumber(p.parseAll())
}

export function evaluate(input: string, options: EvaluateOptions = {}): EvaluateResult {
  const angle = options.angle ?? "deg"
  if (!input.trim()) throw new MathError("Enter an expression")
  const tokens = tokenize(input)
  const phrase = findPhrase(tokens)
  let result: Val
  if (phrase) {
    const a = evalSlice(tokens, phrase.a, angle)
    const b = evalSlice(tokens, phrase.b, angle)
    if (b === 0) throw new MathError("Cannot find a percentage of zero")
    result = { v: (a / b) * 100, pct: true }
  } else {
    const parser = new Parser(tokens, angle, tokens.length - 1)
    result = parser.parseAll()
  }
  if (Number.isNaN(result.v)) throw new MathError("The result is not a real number")
  if (!Number.isFinite(result.v)) throw new MathError("The result is too large")
  return { value: result.v === 0 ? 0 : result.v, percent: result.pct }
}

/** Evaluate without throwing; `error` holds a friendly message. */
export function tryEvaluate(input: string, options?: EvaluateOptions): { ok: true; result: EvaluateResult } | { ok: false; error: string } {
  try {
    return { ok: true, result: evaluate(input, options) }
  } catch (err) {
    return { ok: false, error: err instanceof MathError ? err.message : "Couldn't calculate that" }
  }
}
