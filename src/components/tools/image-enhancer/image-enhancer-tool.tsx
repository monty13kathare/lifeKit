"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bandage,
  Check,
  Contrast,
  Copy,
  Download,
  Eraser,
  Focus,
  History,
  Layers,
  LoaderCircle,
  Maximize2,
  Paintbrush,
  Palette,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
  User,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { downloadBlob, formatBytes, replaceExtension } from "@/lib/files"
import { createCanvas, context2d, decodeImage, disposeCanvas, type DecodedImage } from "@/lib/image/canvas"
import { EXTENDED_IMAGE_ACCEPT, resolveOutput, type OutputChoice } from "@/lib/image/formats"
import {
  DEFAULT_ENHANCE_OPTIONS,
  ENHANCE_PRESETS,
  enhanceImage,
  type EnhanceOptions,
  type EnhancePreset,
} from "@/lib/image/enhancer"
import { autoDetectTears, inpaintTear } from "@/lib/image/inpaint"
import { CompareSlider } from "../image-shared/compare-slider"
import { useEncodableFormats, useObjectUrls } from "../image-shared/hooks"
import { useAiStatus } from "@/hooks/use-ai-status"
import { aiAssist } from "@/lib/ai/client"
import { cn } from "@/lib/utils"

interface SourceImage {
  file: File
  mime: string
  img: DecodedImage
  url: string
}

interface EnhancedResult {
  canvas: HTMLCanvasElement
  url: string
  blob: Blob
  width: number
  height: number
  scale: number
}

const PRESET_ICONS: Record<string, typeof Sparkles> = {
  Sparkles,
  History,
  Focus,
  User,
  Sliders,
}

export function ImageEnhancerTool() {
  const urls = useObjectUrls()
  const encodable = useEncodableFormats()
  const aiStatus = useAiStatus()

  // Workspace Mode
  const [activeTab, setActiveTab] = useState<"enhance" | "repair">("enhance")

  // Source & Results
  const [source, setSource] = useState<SourceImage | null>(null)
  const [loading, setLoading] = useState(false)
  const [activePreset, setActivePreset] = useState<string>("ultra-hd")
  const [options, setOptions] = useState<EnhanceOptions>(DEFAULT_ENHANCE_OPTIONS)
  const [result, setResult] = useState<EnhancedResult | null>(null)
  const [enhancing, setEnhancing] = useState(false)
  const [progressMsg, setProgressMsg] = useState("Initializing…")
  const [progressVal, setProgressVal] = useState(0)
  const [format, setFormat] = useState<OutputChoice>("image/png")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Repair / Inpaint State
  const [repairTool, setRepairTool] = useState<"brush" | "eraser">("brush")
  const [brushSize, setBrushSize] = useState<number>(24)
  const [detectSensitivity, setDetectSensitivity] = useState<number>(65)
  const [repairing, setRepairing] = useState<boolean>(false)
  const [repairProgress, setRepairProgress] = useState<string>("Ready")
  const [maskHasContent, setMaskHasContent] = useState<boolean>(false)

  // Canvas Refs
  const runId = useRef(0)
  const activeCanvas = useRef<HTMLCanvasElement | null>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const maskHistory = useRef<ImageData[]>([])
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  // Clean up source memory when unmounting or changing image
  useEffect(() => {
    return () => {
      source?.img.release()
      if (activeCanvas.current) {
        disposeCanvas(activeCanvas.current)
      }
    }
  }, [source])

  const handleFileDrop = async (file: File, initialTab: "enhance" | "repair" = "enhance") => {
    setLoading(true)
    setResult(null)
    setAiAnalysis(null)
    maskHistory.current = []
    setMaskHasContent(false)
    try {
      const img = await decodeImage(file)
      const url = urls.create(file)
      setSource({ file, mime: file.type || "image/png", img, url })
      setActiveTab(initialTab)
      setActivePreset("ultra-hd")
      setOptions(DEFAULT_ENHANCE_OPTIONS)
      if (initialTab === "repair") {
        toast.info("Image loaded in Repair Mode. Paint over torn parts or click Auto-Detect.")
      } else {
        toast.success("Image loaded. Applying Ultra HD enhancement…")
      }
    } catch {
      toast.error("Couldn't read that image. Please try a different file.")
    } finally {
      setLoading(false)
    }
  }

  // Automatically trigger enhancement when source or options change
  useEffect(() => {
    if (!source || activeTab !== "enhance") return

    const currentRun = ++runId.current
    setEnhancing(true)
    setProgressVal(0.1)
    setProgressMsg("Starting enhancement…")

    const timer = setTimeout(async () => {
      try {
        const enhancedCanvas = await enhanceImage(
          source.img.source,
          options,
          (prog, msg) => {
            if (runId.current === currentRun) {
              setProgressVal(prog)
              setProgressMsg(msg)
            }
          }
        )

        if (runId.current !== currentRun) {
          disposeCanvas(enhancedCanvas)
          return
        }

        enhancedCanvas.toBlob(
          (blob) => {
            if (!blob || runId.current !== currentRun) {
              disposeCanvas(enhancedCanvas)
              return
            }
            if (activeCanvas.current) {
              disposeCanvas(activeCanvas.current)
            }
            activeCanvas.current = enhancedCanvas
            const url = urls.create(blob)
            setResult({
              canvas: enhancedCanvas,
              url,
              blob,
              width: enhancedCanvas.width,
              height: enhancedCanvas.height,
              scale: options.scale,
            })
            setEnhancing(false)
          },
          "image/png",
          1
        )
      } catch (err) {
        if (runId.current === currentRun) {
          setEnhancing(false)
          toast.error(err instanceof Error ? err.message : "Enhancement failed. Try a lower scale.")
        }
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [source, options, urls, activeTab])

  // Initialize and sync Mask Canvas when entering Repair Mode
  useEffect(() => {
    if (activeTab === "repair" && source && maskCanvasRef.current) {
      const c = maskCanvasRef.current
      if (c.width !== source.img.width || c.height !== source.img.height) {
        c.width = source.img.width
        c.height = source.img.height
        const ctx = c.getContext("2d")
        if (ctx) ctx.clearRect(0, 0, c.width, c.height)
        maskHistory.current = []
        setMaskHasContent(false)
      }
    }
  }, [activeTab, source])

  // --- Tear Inpainting & Mask Drawing Logic ---

  const saveMaskSnapshot = () => {
    const c = maskCanvasRef.current
    if (!c) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    const snap = ctx.getImageData(0, 0, c.width, c.height)
    maskHistory.current.push(snap)
    if (maskHistory.current.length > 10) maskHistory.current.shift()
    setMaskHasContent(true)
  }

  const handleUndoMask = () => {
    const c = maskCanvasRef.current
    if (!c || maskHistory.current.length === 0) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    maskHistory.current.pop() // remove current state
    if (maskHistory.current.length > 0) {
      const prev = maskHistory.current[maskHistory.current.length - 1]
      ctx.putImageData(prev, 0, 0)
      setMaskHasContent(true)
    } else {
      ctx.clearRect(0, 0, c.width, c.height)
      setMaskHasContent(false)
    }
  }

  const handleClearMask = () => {
    const c = maskCanvasRef.current
    if (!c) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    maskHistory.current = []
    setMaskHasContent(false)
    toast("Repair mask cleared")
  }

  const handleAutoDetectTears = () => {
    if (!source || !maskCanvasRef.current) return
    const srcCanvas = createCanvas(source.img.width, source.img.height)
    const sCtx = context2d(srcCanvas)
    sCtx.drawImage(source.img.source, 0, 0)

    try {
      const detectedCanvas = autoDetectTears(srcCanvas, detectSensitivity)
      const maskCtx = maskCanvasRef.current.getContext("2d")
      if (maskCtx) {
        saveMaskSnapshot()
        maskCtx.drawImage(detectedCanvas, 0, 0)
        setMaskHasContent(true)
        toast.success("Tears & cracks detected! Painted on repair mask.")
      }
      disposeCanvas(detectedCanvas)
    } catch {
      toast.error("Auto-detect failed. Please brush over the tear manually.")
    } finally {
      disposeCanvas(srcCanvas)
    }
  }

  const handleInpaintAndHeal = async () => {
    if (!source || !maskCanvasRef.current) return
    if (!maskHasContent) {
      toast.info("Please brush over the torn/damaged part first or click Auto-Detect.")
      return
    }

    setRepairing(true)
    setRepairProgress("Preparing image context…")

    const srcCanvas = createCanvas(source.img.width, source.img.height)
    const sCtx = context2d(srcCanvas)
    sCtx.drawImage(source.img.source, 0, 0)

    try {
      const healedCanvas = await inpaintTear(
        srcCanvas,
        maskCanvasRef.current,
        (_p, msg) => setRepairProgress(msg)
      )

      healedCanvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error("Failed to generate healed image.")
          setRepairing(false)
          disposeCanvas(healedCanvas)
          return
        }

        const newImg = await decodeImage(blob)
        const newFile = new File([blob], source.file.name.replace(/\.[^.]+$/, "") + "-healed.png", {
          type: "image/png",
        })
        const newUrl = urls.create(blob)

        source.img.release()
        setSource({ file: newFile, mime: "image/png", img: newImg, url: newUrl })
        disposeCanvas(healedCanvas)
        handleClearMask()
        setRepairing(false)
        setActiveTab("enhance")
        toast.success("Tears & damaged parts reconstructed! Now applying Ultra HD Super-Resolution…")
      }, "image/png")
    } catch (err) {
      setRepairing(false)
      toast.error(err instanceof Error ? err.message : "Reconstruction failed.")
    } finally {
      disposeCanvas(srcCanvas)
    }
  }

  // Pointer drawing handlers for the repair mask
  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawing.current = true
    saveMaskSnapshot()
    const pos = getCanvasCoordinates(e)
    lastPos.current = pos

    const canvas = maskCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.save()
    if (repairTool === "brush") {
      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = "rgba(239, 68, 68, 0.75)"
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.globalCompositeOperation = "destination-out"
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !lastPos.current) return
    const pos = getCanvasCoordinates(e)
    const canvas = maskCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.save()
    if (repairTool === "brush") {
      ctx.globalCompositeOperation = "source-over"
      ctx.strokeStyle = "rgba(239, 68, 68, 0.75)"
      ctx.lineWidth = brushSize
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    } else {
      ctx.globalCompositeOperation = "destination-out"
      ctx.lineWidth = brushSize
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    }
    ctx.restore()

    lastPos.current = pos
  }

  const handlePointerUp = () => {
    isDrawing.current = false
    lastPos.current = null
  }

  // --- End Repair Logic ---

  const applyPreset = (preset: EnhancePreset) => {
    setActivePreset(preset.id)
    setOptions({ ...preset.options })
    toast(`Preset: ${preset.name} applied`)
  }

  const handleAiAutoTune = async () => {
    if (!source) return
    setAiAnalyzing(true)
    try {
      const description = `File: ${source.file.name}, Dimensions: ${source.img.width}x${source.img.height}, Size: ${formatBytes(source.file.size)}.`
      const advice = await aiAssist("image-enhancer-advice", JSON.stringify({ description }))
      setAiAnalysis(advice.diagnosis + (advice.tip ? ` Tip: ${advice.tip}` : ""))
      setActivePreset(advice.recommendedPreset)
      setOptions({
        scale: Number(advice.scale) as 1 | 2 | 4,
        sharpness: advice.sharpness,
        denoise: advice.denoise,
        clarity: advice.clarity,
        vibrance: advice.vibrance,
        contrast: advice.contrast,
        brightness: advice.brightness,
        autoLevels: true,
        autoWhiteBalance: advice.autoWhiteBalance,
        faceEnhance: advice.faceEnhance,
      })
      toast.success("AI analyzed photo & applied custom optimal settings!")
    } catch {
      toast.error("AI analysis not available. Continuing with local presets.")
    } finally {
      setAiAnalyzing(false)
    }
  }

  const handleDownload = () => {
    if (!result || !source) return
    const outType = resolveOutput(format, source.mime, encodable)
    const ext = outType.replace("image/", "")
    const outName = `${source.file.name.replace(/\.[^.]+$/, "")}-UltraHD-${result.width}x${result.height}.${ext}`

    if (outType === "image/png") {
      downloadBlob(result.blob, outName)
      toast.success("Ultra HD Image downloaded!")
    } else {
      result.canvas.toBlob(
        (blob) => {
          if (blob) {
            downloadBlob(blob, outName)
            toast.success("Ultra HD Image downloaded!")
          }
        },
        outType,
        0.95
      )
    }
  }

  const handleCopy = async () => {
    if (!result) return
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": result.blob })])
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast.success("Enhanced image copied to clipboard!")
      } else {
        toast.info("Clipboard copy not supported on this browser. Use Download instead.")
      }
    } catch {
      toast.error("Couldn't copy to clipboard.")
    }
  }

  const loadDemoPhoto = () => {
    const c = document.createElement("canvas")
    c.width = 480
    c.height = 360
    const ctx = c.getContext("2d")
    if (!ctx) return

    // Vintage sunset landscape
    const grad = ctx.createLinearGradient(0, 0, 0, 360)
    grad.addColorStop(0, "#d97706")
    grad.addColorStop(0.35, "#f59e0b")
    grad.addColorStop(0.6, "#fbbf24")
    grad.addColorStop(0.85, "#475569")
    grad.addColorStop(1, "#1e293b")
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 480, 360)

    // Sun
    ctx.fillStyle = "#fef08a"
    ctx.beginPath()
    ctx.arc(240, 150, 45, 0, Math.PI * 2)
    ctx.fill()

    // Mountains
    ctx.fillStyle = "#334155"
    ctx.beginPath()
    ctx.moveTo(0, 300)
    ctx.lineTo(120, 190)
    ctx.lineTo(240, 270)
    ctx.lineTo(360, 180)
    ctx.lineTo(480, 320)
    ctx.lineTo(480, 360)
    ctx.lineTo(0, 360)
    ctx.closePath()
    ctx.fill()

    // Vintage film grain & sepia tone
    const imgData = ctx.getImageData(0, 0, 480, 360)
    const d = imgData.data
    for (let i = 0; i < d.length; i += 4) {
      const grain = (Math.random() - 0.5) * 35
      d[i] = Math.max(0, Math.min(255, d[i] + grain + 12))
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + grain))
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + grain - 12))
    }
    ctx.putImageData(imgData, 0, 0)

    // Stamp text
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)"
    ctx.font = "bold 20px serif"
    ctx.fillText("Vintage Sunset 1984", 24, 45)
    ctx.font = "12px sans-serif"
    ctx.fillText("480 × 360 · Low Resolution Sample", 24, 68)

    c.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], "vintage_sunset_sample.jpg", { type: "image/jpeg" })
      handleFileDrop(file, "enhance")
    }, "image/jpeg", 0.7)
  }

  const loadDemoTornPhoto = () => {
    const c = document.createElement("canvas")
    c.width = 540
    c.height = 400
    const ctx = c.getContext("2d")
    if (!ctx) return

    // Draw scenic vintage mountain and lake
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 240)
    skyGrad.addColorStop(0, "#38bdf8")
    skyGrad.addColorStop(0.5, "#bae6fd")
    skyGrad.addColorStop(1, "#fed7aa")
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, 540, 400)

    // Sun
    ctx.fillStyle = "#fef08a"
    ctx.beginPath()
    ctx.arc(380, 90, 40, 0, Math.PI * 2)
    ctx.fill()

    // Mountain
    ctx.fillStyle = "#475569"
    ctx.beginPath()
    ctx.moveTo(80, 250)
    ctx.lineTo(260, 100)
    ctx.lineTo(440, 250)
    ctx.closePath()
    ctx.fill()

    // Lake & ground
    const waterGrad = ctx.createLinearGradient(0, 250, 0, 400)
    waterGrad.addColorStop(0, "#0284c7")
    waterGrad.addColorStop(1, "#0f172a")
    ctx.fillStyle = waterGrad
    ctx.fillRect(0, 250, 540, 150)

    // Trees
    ctx.fillStyle = "#15803d"
    for (let x = 20; x < 520; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 270)
      ctx.lineTo(x + 18, 205)
      ctx.lineTo(x + 36, 270)
      ctx.closePath()
      ctx.fill()
    }

    // Add vintage photo tone
    const imgData = ctx.getImageData(0, 0, 540, 400)
    const d = imgData.data
    for (let i = 0; i < d.length; i += 4) {
      const grain = (Math.random() - 0.5) * 22
      d[i] = Math.max(0, Math.min(255, d[i] + grain + 12))
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + grain + 8))
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + grain - 8))
    }
    ctx.putImageData(imgData, 0, 0)

    // Realistic jagged rip line down the middle ("bich se pat gaya")
    ctx.save()
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 14
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)"
    ctx.shadowBlur = 6
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2

    ctx.beginPath()
    let currX = 270
    ctx.moveTo(currX, 0)
    for (let y = 10; y <= 400; y += 15) {
      currX += (Math.random() - 0.5) * 20
      ctx.lineTo(currX, y)
    }
    ctx.stroke()

    // Inner dark crack seam
    ctx.strokeStyle = "#1e293b"
    ctx.lineWidth = 3.5
    ctx.shadowBlur = 0
    ctx.stroke()
    ctx.restore()

    // Label
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)"
    ctx.font = "bold 13px sans-serif"
    ctx.fillText("⚠️ Sample: Torn Down the Middle (Bich se phata hua)", 20, 30)

    c.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], "torn_photo_sample.jpg", { type: "image/jpeg" })
      handleFileDrop(file, "repair")
    }, "image/jpeg", 0.85)
  }

  // 1. Initial State: Upload dropzone
  if (!source) {
    return (
      <div className="space-y-6">
        <div className="relative">
          <FileDropzone
            accept={EXTENDED_IMAGE_ACCEPT}
            maxBytes={30 * 1024 * 1024}
            warnBytes={15 * 1024 * 1024}
            onFiles={(files) => files[0] && handleFileDrop(files[0])}
            title="Upload or drop image to enhance or repair"
            hint="JPG, PNG, WebP or AVIF up to 30 MB"
          />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadDemoPhoto}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <Sparkles className="size-3.5 mr-1.5 text-primary" /> Try Low-Res Sample (Ultra HD test)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadDemoTornPhoto}
              className="text-xs text-rose-500 hover:text-rose-600 border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10"
            >
              <Bandage className="size-3.5 mr-1.5" /> Try Torn Photo (Tear Repair & Inpaint test)
            </Button>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-card p-4 shadow-soft transition-all hover:border-primary/40">
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
              <Sparkles className="size-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Ultra HD 4K Clarity</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Dual-scale Laplacian detail recovery and auto-levels dehazing for razor-sharp micro-textures.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-soft transition-all hover:border-rose-500/40">
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <Bandage className="size-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Torn & Crack Reconstruction</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Intelligently heals photos ripped in half, cracked, or with missing chunks using context-aware texture synthesis.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-soft transition-all hover:border-sky-500/40">
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
              <Focus className="size-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Deblur & Sharpen</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Contrast-adaptive deblurring recovers shaky photos, fuzzy edges, and unreadable text without halos.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-soft transition-all hover:border-emerald-500/40">
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <User className="size-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">100% Faithful (No Fakes)</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Enhances your authentic photo pixels right in your browser — preserving genuine facial identities without AI hallucinations.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 2. Active Workspace
  const aspect = source.img.width / source.img.height
  const originalMegapixels = ((source.img.width * source.img.height) / 1_000_000).toFixed(1)
  const enhancedMegapixels = result ? ((result.width * result.height) / 1_000_000).toFixed(1) : originalMegapixels

  return (
    <div className="space-y-6">
      {/* Top Bar: Mode Selector & Image Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3 shadow-soft">
        {/* Mode Switcher Tabs */}
        <div className="inline-flex rounded-xl bg-muted/80 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("enhance")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition-all",
              activeTab === "enhance"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>🌟 Ultra HD Enhance</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("repair")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition-all",
              activeTab === "repair"
                ? "bg-background text-rose-500 shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bandage className="size-3.5 text-rose-500" />
            <span>🩹 Repair Torn & Damaged Parts</span>
            <span className="rounded-full bg-rose-500/10 px-1.5 py-0.2 text-[10px] text-rose-600 font-bold">
              Inpaint
            </span>
          </button>
        </div>

        {/* Change Photo Button */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {source.file.name} ({source.img.width}×{source.img.height})
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSource(null)}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5 mr-1" /> Change photo
          </Button>
        </div>
      </div>

      {/* AI Analysis Banner (if triggered) */}
      {aiAnalysis && activeTab === "enhance" && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs">
          <Wand2 className="size-4 shrink-0 text-primary mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-foreground">AI Photo Diagnosis: </span>
            <span className="text-muted-foreground">{aiAnalysis}</span>
          </div>
        </div>
      )}

      {/* TAB 1: ULTRA HD ENHANCE */}
      {activeTab === "enhance" && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Interactive Before/After Comparison */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <div className="rounded-2xl border bg-card p-3 sm:p-4 shadow-soft">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">Before & After Ultra HD Comparison</span>
                </div>

                {/* Resolution Badges */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-surface-muted px-2.5 py-1 text-muted-foreground font-mono">
                    {source.img.width}×{source.img.height} ({originalMegapixels} MP)
                  </span>
                  <span className="text-muted-foreground font-bold">➔</span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary font-mono font-semibold">
                    {result ? `${result.width}×${result.height} (${enhancedMegapixels} MP ${options.scale}x)` : "Processing…"}
                  </span>
                </div>
              </div>

              {/* Comparison Slider */}
              <div className="relative min-h-[320px] flex items-center justify-center">
                {result ? (
                  <CompareSlider
                    before={source.url}
                    after={result.url}
                    beforeLabel="Original / Repaired"
                    afterLabel={`Ultra HD (${options.scale}x)`}
                    aspect={aspect}
                    className="w-full"
                  />
                ) : (
                  <div className="flex h-80 w-full flex-col items-center justify-center gap-3 rounded-xl border bg-checker">
                    <LoaderCircle className="size-8 animate-spin text-primary" />
                    <p className="text-xs font-medium text-muted-foreground">{progressMsg}</p>
                  </div>
                )}

                {/* Progress Overlay during re-enhancement */}
                <AnimatePresence>
                  {enhancing && result && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-background/60 backdrop-blur-xs"
                    >
                      <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-xs font-semibold shadow-soft border">
                        <LoaderCircle className="size-4 animate-spin text-primary" />
                        <span>{progressMsg}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Right Column: Presets & Controls */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-soft space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Enhancement Modes</h2>
                <span className="text-xs text-muted-foreground">High Precision</span>
              </div>

              {/* AI Auto-Tune Button (if Gemini is configured) */}
              {aiStatus?.configured && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAiAutoTune}
                  disabled={aiAnalyzing}
                  className="w-full border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                >
                  {aiAnalyzing ? (
                    <>
                      <LoaderCircle className="size-3.5 mr-1.5 animate-spin" /> Analyzing Photo with AI…
                    </>
                  ) : (
                    <>
                      <Wand2 className="size-3.5 mr-1.5" /> ✨ AI Auto-Tune Settings
                    </>
                  )}
                </Button>
              )}

              {/* One-Click Presets */}
              <div className="grid grid-cols-2 gap-2">
                {ENHANCE_PRESETS.map((p) => {
                  const Icon = PRESET_ICONS[p.iconName] || Sparkles
                  const isActive = activePreset === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-all",
                        isActive
                          ? "border-primary bg-primary/10 text-primary shadow-xs"
                          : "border-border/60 bg-surface hover:border-border hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-medium text-xs">
                        <Icon className="size-3.5" />
                        <span>{p.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground line-clamp-1">{p.description}</span>
                    </button>
                  )
                })}
              </div>

              {/* Upscale Multiplier Selector */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <Label className="text-muted-foreground font-medium flex items-center gap-1">
                    <Maximize2 className="size-3.5" /> Output Resolution
                  </Label>
                  <span className="font-semibold text-primary">
                    {options.scale === 4 ? "4x Ultra HD 4K" : options.scale === 2 ? "2x HD" : "1x (Original Size)"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([1, 2, 4] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setActivePreset("custom")
                        setOptions((prev) => ({ ...prev, scale: s }))
                      }}
                      className={cn(
                        "h-8 rounded-lg border text-xs font-semibold transition-all",
                        options.scale === s
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border/60 bg-surface hover:bg-muted"
                      )}
                    >
                      {s}x {s === 4 ? "Ultra HD" : s === 2 ? "HD" : "Detail"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Sliders (Collapsible / Toggle) */}
              <div className="border-t pt-3 space-y-3.5">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex w-full items-center justify-between text-xs font-semibold text-foreground hover:text-primary transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Sliders className="size-3.5" /> Fine-Tune Adjustments
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {showAdvanced ? "Hide" : "Customize"}
                  </span>
                </button>

                {showAdvanced && (
                  <div className="space-y-3 pt-1">
                    {/* Sharpness & Deblur */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Deblur & Ultra Sharpen</span>
                        <span className="font-mono font-medium">{options.sharpness}%</span>
                      </div>
                      <Slider
                        value={options.sharpness}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={(v) => {
                          setActivePreset("custom")
                          setOptions((o) => ({ ...o, sharpness: v as number }))
                        }}
                      />
                    </div>

                    {/* Auto-Levels Dehazing Switch */}
                    <div className="flex items-center justify-between py-1">
                      <div>
                        <Label htmlFor="autolevels-switch" className="text-xs cursor-pointer block font-medium">
                          Auto-Levels & Dehaze (Removes Fog)
                        </Label>
                        <span className="text-[10px] text-muted-foreground">
                          Stretches dynamic range so blacks are deep and whites are crisp.
                        </span>
                      </div>
                      <Switch
                        id="autolevels-switch"
                        checked={options.autoLevels}
                        onCheckedChange={(checked) => {
                          setActivePreset("custom")
                          setOptions((o) => ({ ...o, autoLevels: checked }))
                        }}
                      />
                    </div>

                    {/* Denoise & Artifact Removal */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Denoise & Artifact Removal</span>
                        <span className="font-mono font-medium">{options.denoise}%</span>
                      </div>
                      <Slider
                        value={options.denoise}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={(v) => {
                          setActivePreset("custom")
                          setOptions((o) => ({ ...o, denoise: v as number }))
                        }}
                      />
                    </div>

                    {/* Micro-Contrast & Clarity */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Clarity & 3D Texture Depth</span>
                        <span className="font-mono font-medium">{options.clarity}%</span>
                      </div>
                      <Slider
                        value={options.clarity}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={(v) => {
                          setActivePreset("custom")
                          setOptions((o) => ({ ...o, clarity: v as number }))
                        }}
                      />
                    </div>

                    {/* Color Vibrance */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Color Vibrance (Faded Revival)</span>
                        <span className="font-mono font-medium">{options.vibrance}%</span>
                      </div>
                      <Slider
                        value={options.vibrance}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={(v) => {
                          setActivePreset("custom")
                          setOptions((o) => ({ ...o, vibrance: v as number }))
                        }}
                      />
                    </div>

                    {/* Toggle Switches */}
                    <div className="pt-2 space-y-2 border-t">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="awb-switch" className="text-xs cursor-pointer">
                          Auto White Balance (Remove Yellow Cast)
                        </Label>
                        <Switch
                          id="awb-switch"
                          checked={options.autoWhiteBalance}
                          onCheckedChange={(checked) => {
                            setActivePreset("custom")
                            setOptions((o) => ({ ...o, autoWhiteBalance: checked }))
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="face-switch" className="text-xs cursor-pointer">
                          Face & Skin Smoothing
                        </Label>
                        <Switch
                          id="face-switch"
                          checked={options.faceEnhance}
                          onCheckedChange={(checked) => {
                            setActivePreset("custom")
                            setOptions((o) => ({ ...o, faceEnhance: checked }))
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions: Download & Copy */}
              <div className="space-y-2 border-t pt-4">
                <Button
                  size="lg"
                  onClick={handleDownload}
                  disabled={!result || enhancing}
                  className="w-full bg-primary text-primary-foreground font-semibold shadow-md hover:bg-primary/90"
                >
                  <Download className="size-4 mr-2" />
                  Download Ultra HD Image
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    disabled={!result}
                    className="text-xs"
                  >
                    {copied ? <Check className="size-3.5 mr-1 text-emerald-500" /> : <Copy className="size-3.5 mr-1" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>

                  <div className="flex items-center">
                    <Select
                      items={[
                        { value: "png", label: "PNG (Lossless)" },
                        { value: "jpeg", label: "JPG (Standard)" },
                        { value: "webp", label: "WebP (Modern)" },
                      ]}
                      value={format}
                      onValueChange={(v) => v && setFormat(v as OutputChoice)}
                    >
                      <SelectTrigger className="h-8 text-xs w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="png">PNG (Lossless)</SelectItem>
                        <SelectItem value="jpeg">JPG</SelectItem>
                        <SelectItem value="webp">WebP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REPAIR TORN & DAMAGED IMAGE (INPAINT) */}
      {activeTab === "repair" && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Interactive Drawing Canvas */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <div className="rounded-2xl border bg-card p-3 sm:p-4 shadow-soft">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                    <Bandage className="size-4" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">Interactive Tear Repair Canvas</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    Paint in red over the rip down the middle or missing holes
                  </span>
                </div>
              </div>

              {/* Drawing Area Container */}
              <div
                className="relative mx-auto overflow-hidden rounded-xl border bg-checker touch-none select-none max-w-full flex items-center justify-center"
                style={{
                  aspectRatio: aspect && Number.isFinite(aspect) ? String(aspect) : "4 / 3",
                  maxHeight: "680px",
                }}
              >
                {/* Background Image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={source.url}
                  alt="Original to repair"
                  className="pointer-events-none absolute inset-0 size-full object-contain"
                />

                {/* Mask Drawing Overlay */}
                <canvas
                  ref={maskCanvasRef}
                  width={source.img.width}
                  height={source.img.height}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className={cn(
                    "absolute inset-0 size-full object-contain cursor-crosshair z-10 transition-opacity",
                    repairing && "pointer-events-none opacity-50"
                  )}
                />

                {/* Progress Overlay during inpainting */}
                <AnimatePresence>
                  {repairing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-background/75 backdrop-blur-xs gap-3"
                    >
                      <LoaderCircle className="size-8 animate-spin text-rose-500" />
                      <div className="text-center space-y-1">
                        <p className="text-sm font-semibold text-foreground">AI Reconstructing Missing Parts…</p>
                        <p className="text-xs text-muted-foreground">{repairProgress}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
                <span>💡 Tip: Click &quot;Auto-Detect Tears&quot; or brush along the rip line.</span>
                {maskHasContent && (
                  <span className="text-rose-500 font-medium flex items-center gap-1">
                    <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                    Repair mask active
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Inpaint Controls & Tools */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-soft space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Tear Repair Tools</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Highlight torn seams, scratches, and missing parts to synthesize context.
                </p>
              </div>

              {/* Tool Selector: Brush vs Eraser */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRepairTool("brush")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all",
                    repairTool === "brush"
                      ? "border-rose-500 bg-rose-500/10 text-rose-500 shadow-xs"
                      : "border-border/60 bg-surface hover:bg-muted"
                  )}
                >
                  <Paintbrush className="size-4" />
                  <span>Brush Tear</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRepairTool("eraser")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all",
                    repairTool === "eraser"
                      ? "border-rose-500 bg-rose-500/10 text-rose-500 shadow-xs"
                      : "border-border/60 bg-surface hover:bg-muted"
                  )}
                >
                  <Eraser className="size-4" />
                  <span>Eraser</span>
                </button>
              </div>

              {/* Brush Size Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Brush Size</span>
                  <span className="font-mono font-semibold">{brushSize}px</span>
                </div>
                <Slider
                  value={brushSize}
                  min={6}
                  max={80}
                  step={2}
                  onValueChange={(v) => setBrushSize(v as number)}
                />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Thin scratch (6px)</span>
                  <span>Wide rip (80px)</span>
                </div>
              </div>

              {/* Auto-Detect Tears Section */}
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-rose-500" />
                    Auto-Detect Tears & Cracks
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Sens: {detectSensitivity}%
                  </span>
                </div>
                <Slider
                  value={detectSensitivity}
                  min={20}
                  max={95}
                  step={5}
                  onValueChange={(v) => setDetectSensitivity(v as number)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoDetectTears}
                  disabled={repairing}
                  className="w-full border-rose-500/30 text-rose-600 hover:bg-rose-500/10 text-xs font-medium"
                >
                  ✨ Auto-Scan & Mark Tears
                </Button>
              </div>

              {/* Undo & Clear Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUndoMask}
                  disabled={repairing || maskHistory.current.length === 0}
                  className="text-xs"
                >
                  <Undo2 className="size-3.5 mr-1" /> Undo Stroke
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearMask}
                  disabled={repairing || !maskHasContent}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5 mr-1" /> Clear Mask
                </Button>
              </div>

              {/* Primary Action: Reconstruct & Heal */}
              <div className="border-t pt-4 space-y-2">
                <Button
                  size="lg"
                  onClick={handleInpaintAndHeal}
                  disabled={repairing || !maskHasContent}
                  className="w-full bg-rose-600 text-white font-semibold shadow-md hover:bg-rose-700 disabled:opacity-50"
                >
                  {repairing ? (
                    <>
                      <LoaderCircle className="size-4 mr-2 animate-spin" />
                      Reconstructing…
                    </>
                  ) : (
                    <>
                      <Bandage className="size-4 mr-2" />
                      🪄 Heal & Reconstruct Missing Part
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-center text-muted-foreground">
                  Fills the tear using surrounding textures, colors, and gradients, then switches to Ultra HD Enhance.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
