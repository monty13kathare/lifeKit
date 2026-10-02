import { LocalFileService, type FileService } from "./file-service"
import { LocalUserService, type UserService } from "./user-service"

/**
 * Service container. Swap these local adapters for API-backed ones later
 * (e.g. `new ApiFileService(baseUrl)`) without touching UI components.
 * Translation and sharing providers are registered by their features in
 * `services/translation` and `services/share`.
 */
export const services: { file: FileService; user: UserService } = {
  file: new LocalFileService(),
  user: new LocalUserService(),
}

export type { FileService, StoredFile } from "./file-service"
export type { UserService, UserProfile } from "./user-service"
export type { TranslationService, TranslationRequest, TranslationResult } from "./translation-service"
