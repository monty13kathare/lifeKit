# LifeKit

An installable, mobile-first **everyday utility PWA**: PDF and image tools, QR and barcode scanning, OCR, speech, calculators, tasks, calendar, wellness and more. It is **frontend-only**: there is no backend, files are processed in the browser, and personal data stays in this browser's local storage.

Built with Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), Framer Motion, React Hook Form and Zod.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production build (registers the service worker)
```

Camera, microphone and installation need a secure context. That means `localhost`, or HTTPS when testing on a phone (for example via a tunnel).

## Features

| Area | Tools |
| --- | --- |
| Documents | Image to PDF, PDF Editor (reorder, rotate, delete, text, draw, highlight, signature, watermark, page numbers), PDF Scanner (detect, crop, perspective-correct, enhance), OCR |
| Images | Resize (presets), Compress (batch, target size), Convert (JPG/PNG/WebP, and AVIF where supported) |
| Scan | Scan Everything, QR Scanner (URL safety warnings), Barcode Scanner, QR Generator (PNG/SVG, logo) |
| Communication | Voice to Text, Text to Voice, Translator (pluggable provider, with a demo dictionary built in) |
| Finance | Smart Calculator (natural input like `20% of 15000`, no `eval`), EMI (prepayment, comparison), GST, Percentage, Unit Converter |
| Security | Password Generator (crypto-strong, never stored), SecureShare (AES-GCM encrypted packages) |
| My Life | Tasks, Daily Routine, Calendar (month/week/day/agenda), Reminders, Notes, Wellness, Bookmarks, Important Info (optional passphrase encryption) |

## Architecture

```
src/
  app/                 routes (thin), manifest.ts, layout, hubs (/, /tools, /my-life, /scan, /settings, /more)
  components/
    ui/                shadcn/ui on Base UI
    common/            ToolPage, FileDropzone, Notice, ResponsiveSheet, CopyButton, EmptyState, ProgressRing
    layout/ navigation/ app shell, sidebar, bottom nav, install prompt
    dashboard/ settings/ cards/
    tools/<feature>/   feature components
  data/tools.ts        tool registry (drives nav, hubs, dashboard)
  hooks/               useTasks, useCalendar, useSettings, … (over the storage layer)
  lib/
    storage/           the only place localStorage is touched (typed stores, demo seed, reset)
    services/          FileService / TranslationService / UserService / ShareService interfaces + local adapters
    dates.ts files.ts reminders.ts pdf/ …
  types/               domain types
```

- **Backend-ready.** The UI depends on service interfaces in `src/lib/services`. To add an API later, implement the interface (for example an `ApiFileService`) and swap it into the service container. UI components don't change.
- **Persistence.** Each domain is a typed store with cross-tab sync, created through `createCollectionStore` and `createValueStore`. Components use the hooks in `src/hooks/use-lifekit-data.ts`.
- **Performance.** Heavy libraries (pdf-lib, pdf.js, tesseract.js, html5-qrcode, jszip, image compression) are loaded with dynamic `import()` only when a tool needs them, and CPU-heavy scanner work runs in a Web Worker.
- **PWA.** `app/manifest.ts` provides the icons, shortcuts and standalone display. `public/sw.js` caches only hashed static assets and icons. There is intentionally **no offline mode**. Regenerate the icons with `node scripts/generate-icons.mjs`.

See `AGENTS.md` for coding conventions, including the Base UI differences from Radix-era shadcn.

## Honest limitations (frontend-only)

- **Sharing.** SecureShare and the file-type QR codes do not create public internet links. Any local links are labelled as working only in this browser.
- **Reminders.** They fire while LifeKit is open. Without a push server, closed apps may not get notifications.
- **Translation.** The built-in mode is a demo dictionary. Full translation needs a backend proxy (`NEXT_PUBLIC_TRANSLATION_ENDPOINT`).
- **Speech recognition.** Availability depends on the browser. Chrome processes audio through Google's speech service.
- **OCR.** Language data downloads once from a CDN. Images never leave the device.
- **Storage.** Local storage is not a secure vault. Use the encryption option for sensitive details.
