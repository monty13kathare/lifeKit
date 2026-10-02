"use client"

import { Aperture } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CameraView } from "@/components/tools/scanner/camera-view"
import { useCamera } from "@/components/tools/scanner/use-camera"

/** Live camera with a document frame and a Capture button. */
export function OcrCamera({ onCapture }: { onCapture: (canvas: HTMLCanvasElement) => void }) {
  const camera = useCamera()
  return (
    <CameraView
      camera={camera}
      viewfinder="document"
      idleTitle="Photograph printed text"
      idleDescription="Fill the frame with the text and hold steady. The camera starts only after you tap Start."
      toolbar={
        <Button
          size="lg"
          className="h-11 rounded-full px-5"
          onClick={() => {
            const canvas = camera.captureFrame(3000)
            if (canvas) {
              camera.stop()
              onCapture(canvas)
            }
          }}
        >
          <Aperture aria-hidden /> Capture
        </Button>
      }
    />
  )
}
