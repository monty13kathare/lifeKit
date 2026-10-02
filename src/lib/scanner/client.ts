"use client"

import { runOp, type ScannerRequest, type WarpResult } from "./ops"
import type { DetectResult, EnhanceSettings, Pixels, Quad } from "./types"

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
}

/**
 * Runs scanner pixel work in a Web Worker, falling back to the main thread if
 * workers are unavailable or the worker fails to start. Input pixel buffers
 * are *transferred* to the worker — pass copies if you need to keep them.
 */
class ScannerEngine {
  private worker: Worker | null = null
  private ready: Promise<boolean>
  private pending = new Map<number, Pending>()
  private nextId = 1

  constructor() {
    this.ready = this.start()
  }

  private start(): Promise<boolean> {
    if (typeof Worker === "undefined") return Promise.resolve(false)
    return new Promise<boolean>((resolve) => {
      let settled = false
      const done = (ok: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (!ok) this.kill()
        resolve(ok)
      }
      const timer = setTimeout(() => done(false), 6000)
      try {
        const worker = new Worker(new URL("./scanner.worker.ts", import.meta.url), { type: "module" })
        this.worker = worker
        worker.addEventListener("message", (e: MessageEvent) => {
          const msg = e.data as { id: number; ok?: boolean; ready?: boolean; result?: unknown; error?: string }
          if (msg.id === -1 && msg.ready) return done(true)
          const p = this.pending.get(msg.id)
          if (!p) return
          this.pending.delete(msg.id)
          if (msg.ok) p.resolve(msg.result)
          else p.reject(new Error(msg.error || "Image processing failed."))
        })
        worker.addEventListener("error", () => {
          done(false)
          this.failAll(new Error("The image processor stopped unexpectedly. Please try again."))
          this.kill()
          this.ready = Promise.resolve(false)
        })
      } catch {
        done(false)
      }
    })
  }

  private kill() {
    this.worker?.terminate()
    this.worker = null
  }

  private failAll(err: Error) {
    this.pending.forEach((p) => p.reject(err))
    this.pending.clear()
  }

  async run<T>(req: ScannerRequest): Promise<T> {
    const ok = await this.ready
    if (!ok || !this.worker) {
      // yield so the UI can paint a progress state before the blocking work
      await new Promise((r) => setTimeout(r, 0))
      return runOp(req) as T
    }
    const id = this.nextId++
    const worker = this.worker
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      const buffer = req.src.data.buffer
      worker.postMessage({ id, req }, buffer instanceof ArrayBuffer ? [buffer] : [])
    })
  }
}

let engine: ScannerEngine | null = null
const getEngine = () => (engine ??= new ScannerEngine())

export const detectQuad = (src: Pixels) => getEngine().run<DetectResult>({ op: "detect", src })

export const warpQuad = (src: Pixels, quad: Quad, width: number, height: number, previewMax?: number) =>
  getEngine().run<WarpResult>({ op: "warp", src, quad, width, height, previewMax })

export const enhancePixels = (src: Pixels, settings: EnhanceSettings) =>
  getEngine().run<Pixels>({ op: "enhance", src, settings })

export const clonePixels = (p: Pixels): Pixels => ({ width: p.width, height: p.height, data: new Uint8ClampedArray(p.data) })
