import { runOp, transferablesOf, type ScannerRequest } from "./ops"

interface Envelope {
  id: number
  req: ScannerRequest
}

const ctx = self as unknown as {
  postMessage: (msg: unknown, transfer?: Transferable[]) => void
  addEventListener: (type: "message", cb: (e: MessageEvent<Envelope>) => void) => void
}

ctx.addEventListener("message", (e) => {
  const { id, req } = e.data
  try {
    const result = runOp(req)
    ctx.postMessage({ id, ok: true, result }, transferablesOf(result))
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
})

ctx.postMessage({ id: -1, ready: true })
