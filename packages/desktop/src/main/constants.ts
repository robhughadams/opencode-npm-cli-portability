import { app } from "electron"

type Channel = "dev" | "beta" | "prod"
const raw = import.meta.env.OPENCODE_CHANNEL
export const CHANNEL: Channel = raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const SETTINGS_STORE = "opencode.settings"
export const DEFAULT_SERVER_URL_KEY = "defaultServerUrl"
export const WSL_ENABLED_KEY = "wslEnabled"
// Personal fork: desktop updates stay disabled unless explicitly re-enabled for local testing.
export const UPDATER_ENABLED = Boolean(process.env.OPENCODE_FORK_ENABLE_UPDATER) && app.isPackaged && CHANNEL !== "dev"
