import { MODULE_ID, SETTINGS_KEYS } from "./constants";

export function isDebugEnabled(): boolean {
  return Boolean(game.settings.get(MODULE_ID, SETTINGS_KEYS.debug));
}

export function logDebug(message: string, data?: unknown): void {
  if (!isDebugEnabled()) return;
  console.debug(`[${MODULE_ID}] ${message}`, data ?? "");
}

export function logInfo(message: string): void {
  console.info(`[${MODULE_ID}] ${message}`);
}

export function logError(message: string, err?: unknown): void {
  console.error(`[${MODULE_ID}] ${message}`, err ?? "");
}
