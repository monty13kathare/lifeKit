import { LocalShareService, MAX_SHARE_BYTES } from "./local-share-service"
import type { ShareService } from "./share-service"

let instance: ShareService | null = null

/**
 * The active share provider. Only the local (encrypt-to-file) implementation
 * exists today; a backend-backed service issuing real links can replace it here.
 */
export function getShareService(): ShareService {
  instance ??= new LocalShareService()
  return instance
}

export { LocalShareService, MAX_SHARE_BYTES }
export { PACKAGE_EXTENSION, PBKDF2_ITERATIONS } from "./package-format"
export { ShareError } from "./share-service"
export type {
  OpenedShare,
  ShareErrorCode,
  ShareOptions,
  SharePackageInfo,
  ShareProtection,
  ShareResult,
  ShareService,
  ShareStage,
  SharedFileInfo,
} from "./share-service"
