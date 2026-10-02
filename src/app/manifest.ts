import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LifeKit — Everyday Utility Toolbox",
    short_name: "LifeKit",
    description:
      "PDF, image, scan, QR, OCR, calculators, tasks and more — all processed privately in your browser.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#f8f9fc",
    theme_color: "#4f46e5",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Scan", short_name: "Scan", url: "/scan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Image to PDF", short_name: "To PDF", url: "/tools/image-to-pdf", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Tasks", short_name: "Tasks", url: "/tools/todo", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Calculator", short_name: "Calc", url: "/tools/calculators/smart", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  }
}
