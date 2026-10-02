"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Flashlight, FlashlightOff, Loader2, RefreshCw, SwitchCamera, Upload, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { detectQuad } from "@/lib/scanner/client"
import { canvasPixels, DETECT_MAX, drawScaled, makeCanvas } from "@/lib/scanner/image"
import type { DetectResult, Quad } from "@/lib/scanner/types"

export interface CapturedFrame {
  canvas: HTMLCanvasElement
  /** Live-detected quad, only when detection was confident. */
  detected?: DetectResult
}

interface CameraViewProps {
  onClose: () => void
  onCapture: (frame: CapturedFrame) => void
  onUploadInstead: () => void
  /** Quick mode: keep the camera open and auto-process every shot. */
  quick: boolean
  onQuickChange: (v: boolean) => void
  /** Pages captured in this session (shown on the Done button). */
  count: number
  /** Number of captures still being processed. */
  processing: number
  /** Disable the quick-mode toggle (e.g. when retaking a single page). */
  single?: boolean
}

type Status = "starting" | "live" | "error"

export function isCameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext
}

function describeError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ""
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission was denied. Allow camera access in your browser's site settings, or upload photos instead."
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device. Please upload photos instead."
    case "NotReadableError":
    case "AbortError":
      return "The camera is busy — another app or tab may be using it. Close it and try again."
    default:
      return "The camera couldn't be started. Please try again or upload photos instead."
  }
}

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }

/** Smooth jitter between consecutive detections. */
function blend(prev: Quad | null, next: Quad): Quad {
  if (!prev) return next
  return next.map((p, i) => ({ x: prev[i].x * 0.4 + p.x * 0.6, y: prev[i].y * 0.4 + p.y * 0.6 })) as Quad
}

export function CameraView({
  onClose,
  onCapture,
  onUploadInstead,
  quick,
  onQuickChange,
  count,
  processing,
  single,
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<Status>("starting")
  const [error, setError] = useState("")
  const [facing, setFacing] = useState<"environment" | "user">("environment")
  const [attempt, setAttempt] = useState(0)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [multiCam, setMultiCam] = useState(false)
  const [dims, setDims] = useState({ w: 16, h: 9 })
  const [detection, setDetection] = useState<DetectResult | null>(null)
  const [flash, setFlash] = useState(false)
  const lastQuad = useRef<Quad | null>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // ---- start / stop the stream (only mounted after the user tapped "Start camera")
  useEffect(() => {
    let cancelled = false
    const stop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        stop()
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play().catch(() => {})
        if (cancelled) return
        setDims({ w: video.videoWidth || 16, h: video.videoHeight || 9 })
        const track = stream.getVideoTracks()[0]
        const caps = (track?.getCapabilities?.() ?? {}) as TorchCapabilities
        setTorchSupported(!!caps.torch)
        setTorchOn(false)
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          if (!cancelled) setMultiCam(devices.filter((d) => d.kind === "videoinput").length > 1)
        } catch {
          /* ignore */
        }
        if (!cancelled) {
          setError("")
          setStatus("live")
        }
      } catch (err) {
        if (!cancelled) {
          setError(describeError(err))
          setStatus("error")
        }
      }
    })()
    return () => {
      cancelled = true
      stop()
    }
  }, [facing, attempt])

  // ---- lock page scroll + Escape to close
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [])

  // ---- throttled live document detection on a small frame
  useEffect(() => {
    if (status !== "live") return
    let busy = false
    let stopped = false
    const id = window.setInterval(async () => {
      const video = videoRef.current
      if (busy || !video || video.readyState < 2 || document.hidden) return
      busy = true
      try {
        const small = drawScaled(video, video.videoWidth, video.videoHeight, DETECT_MAX)
        const res = await detectQuad(canvasPixels(small))
        if (stopped) return
        if (res.confidence >= 0.5) {
          lastQuad.current = blend(lastQuad.current, res.quad)
          setDetection({ quad: lastQuad.current, confidence: res.confidence })
        } else {
          lastQuad.current = null
          setDetection(null)
        }
      } catch {
        /* detection is best-effort */
      } finally {
        busy = false
      }
    }, 400)
    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [status])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] })
      setTorchOn((v) => !v)
    } catch {
      setTorchSupported(false)
    }
  }

  const capture = useCallback(() => {
    const video = videoRef.current
    if (!video || status !== "live" || !video.videoWidth) return
    const canvas = makeCanvas(video.videoWidth, video.videoHeight)
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    setFlash(true)
    window.setTimeout(() => setFlash(false), 160)
    if ("vibrate" in navigator) navigator.vibrate?.(30)
    onCapture({ canvas, detected: detection && detection.confidence >= 0.6 ? detection : undefined })
  }, [detection, onCapture, status])

  const statusText =
    status === "starting"
      ? "Starting camera…"
      : status === "error"
        ? "Camera unavailable"
        : detection
          ? "Document detected — hold steady"
          : "Point at a document on a contrasting surface"

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Document camera"
      className="fixed inset-0 z-[60] flex flex-col bg-black text-white"
    >
      {/* top bar */}
      <div className="flex items-center gap-2 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close camera"
          className="text-white hover:bg-white/15 hover:text-white"
          onClick={onClose}
        >
          <X className="size-5" />
        </Button>
        <p
          aria-live="polite"
          className={cn(
            "mx-auto truncate rounded-full px-3 py-1 text-xs font-medium sm:text-sm",
            detection ? "bg-success/90 text-white" : "bg-white/15"
          )}
        >
          {statusText}
        </p>
        <div className="flex items-center gap-1">
          {torchSupported && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
              aria-pressed={torchOn}
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={toggleTorch}
            >
              {torchOn ? <Flashlight className="size-5" /> : <FlashlightOff className="size-5" />}
            </Button>
          )}
          {multiCam && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Switch camera"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={() => {
                setStatus("starting")
                setDetection(null)
                lastQuad.current = null
                setFacing((f) => (f === "environment" ? "user" : "environment"))
              }}
            >
              <SwitchCamera className="size-5" />
            </Button>
          )}
        </div>
      </div>

      {/* viewfinder */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          aria-label="Camera preview"
          onLoadedMetadata={(e) =>
            setDims({ w: e.currentTarget.videoWidth || 16, h: e.currentTarget.videoHeight || 9 })
          }
          className={cn("absolute inset-0 size-full object-contain", facing === "user" && "-scale-x-100")}
        />
        {status === "live" && detection && (
          <svg
            className={cn("pointer-events-none absolute inset-0 size-full", facing === "user" && "-scale-x-100")}
            viewBox={`0 0 ${dims.w} ${dims.h}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            <polygon
              points={detection.quad.map((p) => `${p.x * dims.w},${p.y * dims.h}`).join(" ")}
              className="fill-primary/20 stroke-primary transition-all duration-300"
              strokeWidth={Math.max(dims.w, dims.h) / 250}
              strokeLinejoin="round"
            />
          </svg>
        )}
        {status === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-white/80">
            <Loader2 className="size-8 animate-spin" aria-hidden />
            Waiting for camera permission…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div role="alert" className="max-w-sm space-y-4 rounded-2xl bg-white/10 p-5 text-center">
              <p className="text-sm text-white/90">{error}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStatus("starting")
                    setAttempt((a) => a + 1)
                  }}
                >
                  <RefreshCw aria-hidden /> Try again
                </Button>
                <Button onClick={onUploadInstead}>
                  <Upload aria-hidden /> Upload photos
                </Button>
              </div>
            </div>
          </div>
        )}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 bg-white transition-opacity duration-150",
            flash ? "opacity-70" : "opacity-0"
          )}
        />
      </div>

      {/* bottom bar */}
      <div className="grid grid-cols-3 items-center px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="justify-self-start">
          {!single && (
            <Button
              variant="ghost"
              className="h-12 rounded-full px-3 text-white hover:bg-white/15 hover:text-white"
              aria-pressed={quick}
              aria-label={quick ? "Quick scan on: shots are cropped automatically" : "Quick scan off: review each shot"}
              onClick={() => onQuickChange(!quick)}
            >
              <Zap className={cn("size-5", quick && "fill-current text-warning")} aria-hidden />
              <span className="text-xs">{quick ? "Quick" : "Review"}</span>
            </Button>
          )}
        </div>
        <button
          type="button"
          onClick={capture}
          disabled={status !== "live"}
          aria-label="Capture page"
          className="justify-self-center rounded-full border-4 border-white/90 p-1 transition-transform outline-none focus-visible:ring-4 focus-visible:ring-primary active:scale-95 disabled:opacity-40"
        >
          <span className="block size-16 rounded-full bg-white" />
        </button>
        <div className="justify-self-end">
          {!single && count > 0 && (
            <Button
              className="h-12 rounded-full px-4"
              onClick={onClose}
              aria-label={`Done, ${count} page${count === 1 ? "" : "s"} captured`}
            >
              {processing > 0 ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
              {count}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
