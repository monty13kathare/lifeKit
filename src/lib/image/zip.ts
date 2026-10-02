/** Bundle blobs into a ZIP in the browser. `jszip` is loaded on demand. */
export async function zipBlobs(
  files: { name: string; blob: Blob }[],
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const { default: JSZip } = await import("jszip")
  const zip = new JSZip()
  const used = new Set<string>()
  for (const f of files) {
    zip.file(uniqueName(f.name, used), f.blob)
  }
  // Images are already compressed — storing avoids wasting time re-deflating.
  return zip.generateAsync({ type: "blob", compression: "STORE" }, (meta) => onProgress?.(meta.percent))
}

function uniqueName(name: string, used: Set<string>) {
  let candidate = name
  let n = 1
  const dot = name.lastIndexOf(".")
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ""
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} (${n++})${ext}`
  }
  used.add(candidate.toLowerCase())
  return candidate
}
