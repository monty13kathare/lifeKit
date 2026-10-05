"use client"

import { useEffect, useRef, useState } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createDecoder, type Decoder, type DetectedCode } from "@/lib/qr/detect"
import { formatLabel, type CodeFormat } from "@/lib/qr/formats"
import { cn } from "@/lib/utils"
import { CameraView, type Viewfinder } from "./camera-view"
import { useCamera, type CameraController } from "./use-camera"

interface CameraScannerProps {
  formats: CodeFormat[]
  onDetect: (code: DetectedCode) => void
  /** Called when the user taps "Scan again" after a hit. */
  onResume?: () => void
  viewfinder?: Viewfinder
  idleTitle?: string
  idleDescription?: string
  /** Extra toolbar buttons; receives the camera so callers can capture frames. */
  toolbar?: (camera: CameraController) => React.ReactNode
  /** Short summary of the last hit shown in the paused overlay. */
  pausedLabel?: (code: DetectedCode) => React.ReactNode
  className?: string
}

/**
 * Live camera scanner: native BarcodeDetector when available, otherwise
 * html5-qrcode/ZXing. Pauses after each hit until "Scan again".
 */
export function CameraScanner({
  formats,
  onDetect,
  onResume,
  viewfinder = "square",
  idleTitle = "Point your camera at a code",
  idleDescription,
  toolbar,
  pausedLabel,
  className,
}: CameraScannerProps) {
  const camera = useCamera()
  const [hit, setHit] = useState<DetectedCode | null>(null)
  const [engine, setEngine] = useState<Decoder["kind"] | null>(null)
  const [engineError, setEngineError] = useState<string | null>(null)
  const decoderRef = useRef<Decoder | null>(null)
  const onDetectRef = useRef(onDetect)
  const formatsKey = formats.join(",")

  useEffect(() => {
    onDetectRef.current = onDetect
  }, [onDetect])

  // Build the decoder once the camera is live (lazy-loads ZXing if needed).
  useEffect(() => {
    if (camera.status !== "live" || decoderRef.current) return
    let cancelled = false
    createDecoder(formatsKey.split(",") as CodeFormat[], { maxDim: 640 })
      .then((d) => {
        if (cancelled) return d.dispose()
        decoderRef.current = d
        setEngine(d.kind)
        setEngineError(null)
      })
      .catch(() => {
        if (!cancelled) setEngineError("The barcode reader couldn't be loaded. Check your connection and try again.")
      })
    return () => {
      cancelled = true
    }
  }, [camera.status, formatsKey])

  // Dispose the decoder when formats change or on unmount.
  useEffect(() => {
    return () => {
      decoderRef.current?.dispose()
      decoderRef.current = null
    }
  }, [formatsKey])

  // Detection loop.
  useEffect(() => {
    if (camera.status !== "live" || hit || !engine) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const interval = engine === "native" ? 120 : 400
    const tick = async () => {
      const video = camera.videoRef.current
      const decoder = decoderRef.current
      if (stopped || !video || !decoder) return
      if (video.readyState >= 2) {
        const result = await decoder.decode(video)
        if (stopped) return
        if (result) {
          try {
            navigator.vibrate?.(60)
          } catch {
            /* unsupported */
          }
          setHit(result)
          onDetectRef.current(result)
          return
        }
      }
      timer = setTimeout(tick, interval)
    }
    timer = setTimeout(tick, 250)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [camera.status, camera.videoRef, hit, engine])

  const resume = () => {
    setHit(null)
    onResume?.()
  }

  return (
    <div className={cn("space-y-2", className)}>
      <CameraView
        camera={camera}
        viewfinder={viewfinder}
        idleTitle={idleTitle}
        idleDescription={idleDescription}
        scanning={!hit && !!engine}
        toolbar={toolbar?.(camera)}
        overlay={
          hit ? (
            <div className="w-full max-w-xs rounded-2xl bg-card/95 p-4 text-center text-card-foreground shadow-soft backdrop-blur">
              <p className="text-xs font-medium tracking-wide text-success uppercase">{formatLabel(hit.format)} detected</p>
              <p className="mt-1 line-clamp-2 text-sm break-all">{pausedLabel ? pausedLabel(hit) : hit.value}</p>
              <Button className="mt-3 w-full" onClick={resume}>
                <RotateCcw aria-hidden /> Scan again
              </Button>
            </div>
          ) : null
        }
      />
      {camera.status === "live" ? (
        <p className="text-center text-xs text-muted-foreground" aria-live="polite">
          {engineError
            ? engineError
            : !engine
              ? "Loading reader…"
              : hit
                ? "Paused — tap Scan again to continue."
                : `Scanning${engine === "zxing" ? " (compatibility mode)" : ""}… hold the code steady inside the frame.`}
        </p>
      ) : null}
    </div>
  )
}
