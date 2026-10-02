"use client"

import { Camera, CameraOff, Flashlight, FlashlightOff, Loader2, SwitchCamera } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Notice, UnsupportedNotice } from "@/components/common/notice"
import { cn } from "@/lib/utils"
import type { CameraController } from "./use-camera"

export type Viewfinder = "square" | "wide" | "document" | "none"

interface CameraViewProps {
  camera: CameraController
  viewfinder?: Viewfinder
  /** Shown over the idle preview. */
  idleTitle?: string
  idleDescription?: string
  /** Dim the video and show this over it (e.g. a "Scan again" panel). */
  overlay?: React.ReactNode
  /** Extra buttons in the floating toolbar (right side). */
  toolbar?: React.ReactNode
  /** Animated scan line inside the viewfinder while live. */
  scanning?: boolean
  className?: string
}

const frames: Record<Exclude<Viewfinder, "none">, string> = {
  square: "aspect-square w-[68%] max-w-72",
  wide: "aspect-[2/1] w-[82%] max-w-md",
  document: "aspect-[3/4] h-[82%]",
}

/** Camera preview with viewfinder, idle/starting/error states and a floating toolbar. */
export function CameraView({
  camera,
  viewfinder = "square",
  idleTitle = "Camera is off",
  idleDescription = "We'll only use the camera after you tap Start.",
  overlay,
  toolbar,
  scanning,
  className,
}: CameraViewProps) {
  const { videoRef, status, error, facing, torchSupported, torchOn, canSwitch } = camera
  const reduceMotion = useReducedMotion()
  const live = status === "live"

  return (
    <div className={cn("space-y-3", className)}>
      {status === "error" && error ? (
        error.kind === "unsupported" || error.kind === "insecure" ? (
          <UnsupportedNotice feature="camera access" alternative={error.message} />
        ) : (
          <Notice
            tone="warning"
            title="Camera unavailable"
            action={
              <Button size="sm" variant="outline" onClick={() => void camera.start()}>
                <Camera aria-hidden /> Try again
              </Button>
            }
          >
            {error.message}
          </Notice>
        )
      ) : null}

      <div
        className={cn(
          "relative isolate mx-auto w-full overflow-hidden rounded-3xl bg-neutral-950 shadow-soft",
          "aspect-[3/4] max-h-[68dvh] sm:aspect-[4/3] lg:aspect-video",
          status === "error" && "hidden"
        )}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Camera preview"
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-300",
            live ? "opacity-100" : "opacity-0",
            facing === "user" && "-scale-x-100",
            overlay && "opacity-40 blur-[2px]"
          )}
        />

        {live && viewfinder !== "none" && !overlay ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
            <div className={cn("relative rounded-2xl shadow-[0_0_0_9999px_rgb(0_0_0/0.38)]", frames[viewfinder])}>
              {(["top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl"] as const).map(
                (pos) => (
                  <span key={pos} className={cn("absolute size-8 border-white", pos)} />
                )
              )}
              {scanning && !reduceMotion ? (
                <motion.span
                  className="absolute inset-x-3 h-0.5 rounded-full bg-primary shadow-[0_0_12px_2px] shadow-primary/70"
                  initial={{ top: "8%" }}
                  animate={{ top: ["8%", "92%", "8%"] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {status === "idle" || status === "starting" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
            <div className="flex size-16 items-center justify-center rounded-3xl bg-white/10">
              {status === "starting" ? <Loader2 className="size-7 animate-spin" aria-hidden /> : <Camera className="size-7" aria-hidden />}
            </div>
            <div>
              <p className="text-base font-medium">{status === "starting" ? "Starting camera…" : idleTitle}</p>
              {status === "idle" ? <p className="mt-1 max-w-xs text-sm text-white/70">{idleDescription}</p> : null}
            </div>
            {status === "idle" ? (
              <Button size="lg" onClick={() => void camera.start()} className="min-w-44">
                <Camera aria-hidden /> Start camera
              </Button>
            ) : null}
          </div>
        ) : null}

        {overlay ? <div className="absolute inset-0 flex items-center justify-center p-4">{overlay}</div> : null}

        {live ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-linear-to-t from-black/70 to-transparent p-3 pt-10">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="secondary"
                className="rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
                aria-label="Stop camera"
                onClick={camera.stop}
              >
                <CameraOff aria-hidden />
              </Button>
              {canSwitch ? (
                <Button
                  size="icon"
                  variant="secondary"
                  className="rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
                  aria-label={facing === "environment" ? "Switch to front camera" : "Switch to rear camera"}
                  onClick={camera.switchCamera}
                >
                  <SwitchCamera aria-hidden />
                </Button>
              ) : null}
              {torchSupported ? (
                <Button
                  size="icon"
                  variant="secondary"
                  className={cn(
                    "rounded-full text-white backdrop-blur",
                    torchOn ? "bg-amber-400/90 text-black hover:bg-amber-400" : "bg-white/15 hover:bg-white/25"
                  )}
                  aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
                  aria-pressed={torchOn}
                  onClick={() => void camera.toggleTorch()}
                >
                  {torchOn ? <FlashlightOff aria-hidden /> : <Flashlight aria-hidden />}
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">{toolbar}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
