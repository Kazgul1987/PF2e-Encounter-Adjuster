import { DEFAULT_COMPENDIUMS, MODULE_ID, SETTINGS_KEYS } from "./constants";

export function registerSettings(): void {
  game.settings.register(MODULE_ID, SETTINGS_KEYS.debug, {
    name: game.i18n.localize("PF2E_EA.Settings.Debug"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTINGS_KEYS.compendiums, {
    name: game.i18n.localize("PF2E_EA.Settings.Compendiums"),
    hint: "Z. B. pf2e.pathfinder-monster-core,pf2e.npc-core",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_COMPENDIUMS.join(",")
  });

  game.settings.register(MODULE_ID, SETTINGS_KEYS.linkedMode, {
    name: game.i18n.localize("PF2E_EA.Settings.LinkedMode"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTINGS_KEYS.allowStacking, {
    name: game.i18n.localize("PF2E_EA.Settings.AllowStacking"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTINGS_KEYS.maxTokens, {
    name: game.i18n.localize("PF2E_EA.Settings.MaxTokens"),
    scope: "world",
    config: true,
    type: Number,
    range: { min: 1, max: 1000, step: 1 },
    default: 250
  });

  game.settings.register(MODULE_ID, SETTINGS_KEYS.encounterData, {
    name: "Encounter Datastore",
    scope: "world",
    config: false,
    type: Object,
    default: { schemaVersion: 1, scenes: [] }
  });

  game.settings.register(MODULE_ID, SETTINGS_KEYS.monsterIndex, {
    name: "Monster Index Cache",
    scope: "world",
    config: false,
    type: Object,
    default: { builtAt: null, entries: [] }
  });
}

export function getCompendiumList(): string[] {
  const raw = String(game.settings.get(MODULE_ID, SETTINGS_KEYS.compendiums) ?? "");
  return raw.split(",").map((x) => x.trim()).filter(Boolean);
}
