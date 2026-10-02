import { detectDocument } from "./detect"
import { downscale, enhance, warpPerspective } from "./process"
import type { DetectResult, EnhanceSettings, Pixels, Quad } from "./types"

/** Operations shared by the worker and the main-thread fallback. */
export type ScannerRequest =
  | { op: "detect"; src: Pixels }
  | { op: "warp"; src: Pixels; quad: Quad; width: number; height: number; previewMax?: number }
  | { op: "enhance"; src: Pixels; settings: EnhanceSettings }

export interface WarpResult {
  full: Pixels
  preview?: Pixels
}

export type ScannerResponse = DetectResult | WarpResult | Pixels

export function runOp(req: ScannerRequest): ScannerResponse {
  switch (req.op) {
    case "detect":
      return detectDocument(req.src)
    case "warp": {
      const full = warpPerspective(req.src, req.quad, req.width, req.height)
      return { full, preview: req.previewMax ? downscale(full, req.previewMax) : undefined }
    }
    case "enhance":
      return enhance(req.src, req.settings)
  }
}

/** Buffers to transfer for a response (avoids copying large images). */
export function transferablesOf(res: ScannerResponse): ArrayBuffer[] {
  const out: ArrayBuffer[] = []
  const add = (p?: Pixels) => {
    if (p && p.data.buffer instanceof ArrayBuffer) out.push(p.data.buffer)
  }
  if ("data" in res) add(res)
  else if ("full" in res) {
    add(res.full)
    add(res.preview)
  }
  return out
}
