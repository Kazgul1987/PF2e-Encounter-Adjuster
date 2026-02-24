import { MODULE_ID, SETTINGS_KEYS } from "../foundry/constants";
import type { EncounterImport } from "./schema";

export function getEncounterData(): EncounterImport {
  return game.settings.get(MODULE_ID, SETTINGS_KEYS.encounterData) as EncounterImport;
}

export async function setEncounterData(data: EncounterImport): Promise<void> {
  await game.settings.set(MODULE_ID, SETTINGS_KEYS.encounterData, data);
}

export function getMonsterIndex(): any {
  return game.settings.get(MODULE_ID, SETTINGS_KEYS.monsterIndex);
}

export async function setMonsterIndex(data: any): Promise<void> {
  await game.settings.set(MODULE_ID, SETTINGS_KEYS.monsterIndex, data);
}
