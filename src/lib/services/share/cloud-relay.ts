import { ShareError } from "./share-service"

export interface CloudUploadResponse {
  downloadUrl: string
  expiresAt?: string
}

/**
 * Upload an encrypted .lifekit package to the zero-knowledge ephemeral cloud relay.
 * The files are ALREADY encrypted with AES-256-GCM before this function is called.
 * The cloud server only ever sees the encrypted binary blob.
 */
export async function uploadToCloudRelay(
  encryptedPackage: File | Blob,
  fileName = "package.lifekit"
): Promise<CloudUploadResponse> {
  const formData = new FormData()
  formData.append("file", encryptedPackage, fileName)

  try {
    const res = await fetch("https://ul.sto.care", {
      method: "POST",
      body: formData,
    })

    if (!res.ok) {
      throw new Error(`Upload server responded with HTTP ${res.status}`)
    }

    const data = await res.json()
    if (!data || !data.url) {
      throw new Error("Invalid response from upload server.")
    }

    return {
      downloadUrl: data.url,
      expiresAt: data.expiresAt,
    }
  } catch (err) {
    console.error("[LifeKit Cloud Relay Error]", err)
    throw new ShareError(
      "unsupported",
      "Failed to upload encrypted package to cloud relay. Please check your internet connection or use the offline package option."
    )
  }
}

/**
 * Fetch and download an encrypted package from the cloud relay.
 */
export async function downloadFromCloudRelay(
  url: string,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      if (res.status === 404 || res.status === 410) {
        throw new ShareError("expired", "This shared link has expired or the file was deleted.")
      }
      throw new Error(`Download server responded with HTTP ${res.status}`)
    }

    const blob = await res.blob()
    if (blob.size < 20) {
      throw new ShareError("invalid-package", "The downloaded package appears empty or corrupted.")
    }

    return blob
  } catch (err) {
    if (err instanceof ShareError) throw err
    console.error("[LifeKit Cloud Download Error]", err)
    throw new ShareError(
      "invalid-package",
      "Could not download the shared package. The link may have expired or is blocked by network rules."
    )
  }
}

/**
 * Builds the complete public URL with zero-knowledge key in the hash fragment.
 * The hash fragment (#key=...) is NEVER sent over the wire to any server.
 */
export function buildPublicShareUrl(
  cloudDownloadUrl: string,
  shareKey?: string,
  hasPassword?: boolean
): string {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const base = `${origin}/tools/secure-share`
  const params = new URLSearchParams()
  params.set("pkg", cloudDownloadUrl)

  if (hasPassword) {
    params.set("pwd", "1")
    return `${base}?${params.toString()}`
  }

  if (shareKey) {
    return `${base}?${params.toString()}#key=${encodeURIComponent(shareKey)}`
  }

  return `${base}?${params.toString()}`
}
