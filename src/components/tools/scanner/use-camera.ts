"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

export type CameraStatus = "idle" | "starting" | "live" | "error"
export type CameraErrorKind = "unsupported" | "insecure" | "denied" | "notfound" | "inuse" | "other"

export interface CameraError {
  kind: CameraErrorKind
  message: string
}

const noop = () => () => {}

function cameraSupportSnapshot(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia
}

/** Whether the browser exposes getUserMedia. `true` during SSR to avoid a flash. */
export function useCameraSupported(): boolean {
  return useSyncExternalStore(noop, cameraSupportSnapshot, () => true)
}

function describeError(err: unknown): CameraError {
  const name = err instanceof DOMException || err instanceof Error ? err.name : ""
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return { kind: "denied", message: "Camera permission was denied. Allow camera access in your browser settings, or upload an image instead." }
    case "NotFoundError":
    case "OverconstrainedError":
      return { kind: "notfound", message: "No camera was found on this device. Please upload an image instead." }
    case "NotReadableError":
    case "AbortError":
      return { kind: "inuse", message: "The camera is being used by another app or tab. Close it and try again." }
    default:
      return { kind: "other", message: "The camera couldn't be started. Please try again or upload an image instead." }
  }
}

interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean
}

/**
 * Minimal camera controller. The camera is only requested when `start()` is
 * called (from a user gesture), and every track is stopped on `stop()` and on
 * unmount.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>("idle")
  const [error, setError] = useState<CameraError | null>(null)
  const [facing, setFacing] = useState<"environment" | "user">("environment")
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [canSwitch, setCanSwitch] = useState(false)

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const open = useCallback(
    async (mode: "environment" | "user") => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError({ kind: "unsupported", message: "This browser does not support camera access. Please upload an image instead." })
        setStatus("error")
        return
      }
      if (!window.isSecureContext) {
        setError({ kind: "insecure", message: "Camera access needs a secure (https) connection. Please upload an image instead." })
        setStatus("error")
        return
      }
      release()
      setStatus("starting")
      setError(null)
      setTorchOn(false)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
        streamRef.current = stream
        const video = videoRef.current
        if (!video) {
          release()
          setStatus("idle")
          return
        }
        video.srcObject = stream
        video.muted = true
        video.setAttribute("playsinline", "true")
        await video.play().catch(() => undefined)
        const track = stream.getVideoTracks()[0]
        const caps = (track?.getCapabilities?.() ?? {}) as TorchCapabilities
        setTorchSupported(!!caps.torch)
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          setCanSwitch(devices.filter((d) => d.kind === "videoinput").length > 1)
        } catch {
          setCanSwitch(false)
        }
        setStatus("live")
      } catch (err) {
        release()
        setError(describeError(err))
        setStatus("error")
      }
    },
    [release]
  )

  const start = useCallback(() => open(facing), [open, facing])

  const stop = useCallback(() => {
    release()
    setStatus("idle")
    setTorchOn(false)
  }, [release])

  const switchCamera = useCallback(() => {
    const next = facing === "environment" ? "user" : "environment"
    setFacing(next)
    void open(next)
  }, [facing, open])

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] })
      setTorchOn((v) => !v)
    } catch {
      setTorchSupported(false)
    }
  }, [torchOn])

  /** Grab the current frame as a canvas (downscaled to `maxDim`). */
  const captureFrame = useCallback((maxDim = 2000): HTMLCanvasElement | null => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas
  }, [])

  // Always release the camera when the component goes away.
  useEffect(() => release, [release])

  // Release the camera when the tab is hidden; the user can restart it.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && streamRef.current) {
        release()
        setStatus("idle")
        setTorchOn(false)
      }
    }
    document.addEventListener("visibilitychange", onHide)
    return () => document.removeEventListener("visibilitychange", onHide)
  }, [release])

  return {
    videoRef,
    status,
    error,
    facing,
    torchSupported,
    torchOn,
    canSwitch,
    start,
    stop,
    switchCamera,
    toggleTorch,
    captureFrame,
  }
}

export type CameraController = ReturnType<typeof useCamera>
