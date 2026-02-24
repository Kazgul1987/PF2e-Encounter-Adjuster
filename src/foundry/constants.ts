export const MODULE_ID = "pf2e-encounter-adjuster";
export const SETTINGS_KEYS = {
  debug: "debugLogging",
  compendiums: "compendiumPacks",
  linkedMode: "spawnLinked",
  allowStacking: "defaultAllowStacking",
  maxTokens: "maxTokensPerPopulate",
  encounterData: "encounterData",
  monsterIndex: "monsterIndex"
} as const;

export const DEFAULT_COMPENDIUMS = [
  "pf2e.pathfinder-monster-core",
  "pf2e.npc-core"
];
