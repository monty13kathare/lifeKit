import { DEFAULT_SETTINGS, settingsStore } from "@/lib/storage"

export interface UserProfile {
  id: string
  displayName: string
  /** Local profiles have no account; a backend adapter would populate these. */
  email?: string
  isLocal: boolean
}

export interface UserService {
  getProfile(): Promise<UserProfile>
  updateProfile(patch: Partial<Pick<UserProfile, "displayName">>): Promise<UserProfile>
}

export class LocalUserService implements UserService {
  async getProfile(): Promise<UserProfile> {
    const s = settingsStore.get()
    return { id: "local", displayName: s.displayName, isLocal: true }
  }

  async updateProfile(patch: Partial<Pick<UserProfile, "displayName">>) {
    settingsStore.set((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...patch }))
    return this.getProfile()
  }
}
