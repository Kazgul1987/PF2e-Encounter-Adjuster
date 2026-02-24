// src/foundry/constants.ts
var MODULE_ID = "pf2e-encounter-adjuster";
var SETTINGS_KEYS = {
  debug: "debugLogging",
  compendiums: "compendiumPacks",
  linkedMode: "spawnLinked",
  allowStacking: "defaultAllowStacking",
  maxTokens: "maxTokensPerPopulate",
  encounterData: "encounterData",
  monsterIndex: "monsterIndex"
};
var DEFAULT_COMPENDIUMS = [
  "pf2e.pathfinder-monster-core",
  "pf2e.npc-core"
];

// src/foundry/settings.ts
function registerSettings() {
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
    range: { min: 1, max: 1e3, step: 1 },
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
function getCompendiumList() {
  const raw = String(game.settings.get(MODULE_ID, SETTINGS_KEYS.compendiums) ?? "");
  return raw.split(",").map((x) => x.trim()).filter(Boolean);
}

// src/data/schema.ts
var isObj = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
function validateEncounterImport(input) {
  const errors = [];
  if (!isObj(input)) {
    return { ok: false, errors: [{ path: "$", message: "JSON root must be an object." }] };
  }
  if (input.schemaVersion !== 1) {
    errors.push({ path: "schemaVersion", message: "schemaVersion must be 1." });
  }
  if (typeof input.generatedAt !== "string") {
    errors.push({ path: "generatedAt", message: "generatedAt must be an ISO date string." });
  }
  if (!Array.isArray(input.scenes)) {
    errors.push({ path: "scenes", message: "scenes must be an array." });
  } else {
    input.scenes.forEach((scene, sIdx) => {
      if (!isObj(scene) || !isObj(scene.sceneRef) || !Array.isArray(scene.encounters)) {
        errors.push({ path: `scenes[${sIdx}]`, message: "scene entry must contain sceneRef and encounters." });
        return;
      }
      scene.encounters.forEach((enc, eIdx) => {
        if (!isObj(enc) || typeof enc.id !== "string" || typeof enc.label !== "string" || !Array.isArray(enc.placements)) {
          errors.push({ path: `scenes[${sIdx}].encounters[${eIdx}]`, message: "encounter must have id, label, placements." });
          return;
        }
        enc.placements.forEach((placement, pIdx) => {
          if (!isObj(placement) || !isObj(placement.monster) || typeof placement.quantity !== "number") {
            errors.push({ path: `scenes[${sIdx}].encounters[${eIdx}].placements[${pIdx}]`, message: "placement must contain monster and quantity." });
            return;
          }
          if (placement.quantity < 1 || placement.quantity > 999) {
            errors.push({ path: `scenes[${sIdx}].encounters[${eIdx}].placements[${pIdx}].quantity`, message: "quantity out of allowed range 1..999." });
          }
          const hasArea = isObj(placement.area) && ("rect" in placement.area || "points" in placement.area);
          const hasAreaRefObject = isObj(placement.areaRef);
          const hasAreaRefString = typeof placement.areaRef === "string" && placement.areaRef.trim().length > 0;
          if (!hasArea && !hasAreaRefObject && !hasAreaRefString) {
            errors.push({ path: `scenes[${sIdx}].encounters[${eIdx}].placements[${pIdx}]`, message: "placement requires area or areaRef." });
          }
          if (hasAreaRefObject) {
            const areaRefObj = placement.areaRef;
            if (areaRefObj.type !== "region") {
              errors.push({ path: `scenes[${sIdx}].encounters[${eIdx}].placements[${pIdx}].areaRef.type`, message: "areaRef.type must be 'region'." });
            }
            const hasRegionReference = typeof areaRefObj.regionId === "string" || typeof areaRefObj.regionName === "string" || typeof areaRefObj.roomLabel === "string";
            if (!hasRegionReference) {
              errors.push({ path: `scenes[${sIdx}].encounters[${eIdx}].placements[${pIdx}].areaRef`, message: "areaRef requires regionId, regionName or roomLabel." });
            }
          }
          if (typeof placement.monster.name !== "string") {
            errors.push({ path: `scenes[${sIdx}].encounters[${eIdx}].placements[${pIdx}].monster.name`, message: "monster.name must be string." });
          }
        });
      });
    });
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: input };
}

// src/data/store.ts
function getEncounterData() {
  return game.settings.get(MODULE_ID, SETTINGS_KEYS.encounterData);
}
async function setEncounterData(data) {
  await game.settings.set(MODULE_ID, SETTINGS_KEYS.encounterData, data);
}
function getMonsterIndex() {
  return game.settings.get(MODULE_ID, SETTINGS_KEYS.monsterIndex);
}
async function setMonsterIndex(data) {
  await game.settings.set(MODULE_ID, SETTINGS_KEYS.monsterIndex, data);
}

// src/foundry/regions.ts
function normalizeRegionText(value) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}
function extractRoomCode(value) {
  if (!value) return null;
  const normalized = normalizeRegionText(value).replace(/^[\s.]+|[\s.]+$/g, "");
  const match = normalized.match(/^([a-z]+[0-9]+)\b/);
  return match?.[1] ?? null;
}
function getSceneRegions(scene) {
  const direct = scene?.regions;
  if (direct && typeof direct[Symbol.iterator] === "function") {
    return Array.from(direct);
  }
  const embedded = scene?.getEmbeddedCollection?.("Region");
  if (embedded && typeof embedded[Symbol.iterator] === "function") {
    return Array.from(embedded);
  }
  return [];
}
function resolveRegion(scene, areaRef) {
  if (!areaRef || areaRef.type !== "region") return null;
  const regions = getSceneRegions(scene);
  if (areaRef.regionId) {
    const byId = regions.find((region) => String(region.id) === String(areaRef.regionId));
    if (byId) return byId;
  }
  const label = areaRef.roomLabel || areaRef.regionName;
  if (!label) return null;
  const codeWanted = extractRoomCode(label);
  if (codeWanted) {
    const byCode = regions.find((region) => extractRoomCode(String(region.name ?? "")) === codeWanted);
    if (byCode) return byCode;
  }
  const normalizedLabel = normalizeRegionText(label);
  return regions.find((region) => normalizeRegionText(String(region.name ?? "")).startsWith(normalizedLabel)) ?? null;
}
function getGridSize(scene) {
  return Number(scene?.grid?.size ?? scene?.dimensions?.size ?? 0);
}
function regionBounds(region) {
  const bounds = region?.bounds;
  if (bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && Number.isFinite(bounds.width ?? bounds.w) && Number.isFinite(bounds.height ?? bounds.h)) {
    return {
      x: Number(bounds.x),
      y: Number(bounds.y),
      w: Number(bounds.width ?? bounds.w),
      h: Number(bounds.height ?? bounds.h)
    };
  }
  const shapeData = Array.isArray(region?.shapes) ? region.shapes : Array.isArray(region?._source?.shapes) ? region._source.shapes : [];
  if (!shapeData.length) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const shape of shapeData) {
    const x = Number(shape.x ?? 0);
    const y = Number(shape.y ?? 0);
    if (Array.isArray(shape.points) && shape.points.length >= 2) {
      for (let i = 0; i < shape.points.length; i += 2) {
        const px = x + Number(shape.points[i] ?? 0);
        const py = y + Number(shape.points[i + 1] ?? 0);
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    } else {
      const w = Number(shape.width ?? shape.w ?? 0);
      const h = Number(shape.height ?? shape.h ?? 0);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
  return { x: minX, y: minY, w: Math.max(0, maxX - minX), h: Math.max(0, maxY - minY) };
}
function pointInPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 2; i < points.length; i += 2) {
    const xi = points[i];
    const yi = points[i + 1];
    const xj = points[j];
    const yj = points[j + 1];
    const intersect = yi > py !== yj > py && px < (xj - xi) * (py - yi) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
    j = i;
  }
  return inside;
}
function shapeContainsPoint(shape, px, py) {
  const type = String(shape.type ?? shape.shape ?? "rectangle").toLowerCase();
  const x = Number(shape.x ?? 0);
  const y = Number(shape.y ?? 0);
  if (Array.isArray(shape.points) && shape.points.length >= 6) {
    const worldPoints = shape.points.map((v, idx) => Number(v) + (idx % 2 === 0 ? x : y));
    return pointInPolygon(px, py, worldPoints);
  }
  const w = Number(shape.width ?? shape.w ?? 0);
  const h = Number(shape.height ?? shape.h ?? 0);
  if (type.includes("ellipse")) {
    if (!w || !h) return false;
    const rx = w / 2;
    const ry = h / 2;
    const cx = x + rx;
    const cy = y + ry;
    const nx = (px - cx) / rx;
    const ny = (py - cy) / ry;
    return nx * nx + ny * ny <= 1;
  }
  return px >= x && py >= y && px <= x + w && py <= y + h;
}
function regionContainsPoint(region, px, py) {
  if (typeof region?.containsPoint === "function") {
    return Boolean(region.containsPoint({ x: px, y: py }));
  }
  const shapeData = Array.isArray(region?.shapes) ? region.shapes : Array.isArray(region?._source?.shapes) ? region._source.shapes : [];
  return shapeData.some((shape) => shapeContainsPoint(shape, px, py));
}
function regionToGridCells(scene, region) {
  const gridSize = getGridSize(scene);
  const bounds = regionBounds(region);
  if (!gridSize || !bounds) return [];
  const minX = Math.floor(bounds.x / gridSize);
  const minY = Math.floor(bounds.y / gridSize);
  const maxX = Math.ceil((bounds.x + bounds.w) / gridSize);
  const maxY = Math.ceil((bounds.y + bounds.h) / gridSize);
  const cells = [];
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const px = x * gridSize + gridSize / 2;
      const py = y * gridSize + gridSize / 2;
      if (regionContainsPoint(region, px, py)) cells.push({ x, y });
    }
  }
  return cells;
}

// src/foundry/logger.ts
function isDebugEnabled() {
  return Boolean(game.settings.get(MODULE_ID, SETTINGS_KEYS.debug));
}
function logDebug(message, data) {
  if (!isDebugEnabled()) return;
  console.debug(`[${MODULE_ID}] ${message}`, data ?? "");
}
function logInfo(message) {
  console.info(`[${MODULE_ID}] ${message}`);
}
function logError(message, err) {
  console.error(`[${MODULE_ID}] ${message}`, err ?? "");
}

// src/foundry/io.ts
function regionBounds2(region) {
  const bounds = region?.bounds;
  if (!bounds) return null;
  const width = Number(bounds.width ?? bounds.w);
  const height = Number(bounds.height ?? bounds.h);
  if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  return { x: Number(bounds.x), y: Number(bounds.y), w: width, h: height };
}
function buildScenesExport() {
  return {
    foundryVersion: game.version,
    systemId: game.system.id,
    worldId: game.world?.id ?? null,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    scenes: game.scenes.map((scene) => ({
      sceneId: scene.id,
      sceneUuid: scene.uuid,
      name: scene.name,
      gridSize: scene.grid?.size,
      width: scene.width,
      height: scene.height,
      background: scene.background?.src ?? null,
      notes: scene?.flags?.notes ?? null,
      regions: getSceneRegions(scene).map((region) => {
        const bounds = regionBounds2(region);
        return {
          id: String(region.id),
          name: String(region.name ?? ""),
          ...bounds ? { bounds } : {}
        };
      })
    }))
  };
}
async function exportScenesJson(copyToClipboard = false) {
  const data = buildScenesExport();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const filename = `scene-export-${Date.now()}.json`;
  saveDataToFile(blob, "application/json", filename);
  if (copyToClipboard && navigator.clipboard) {
    await navigator.clipboard.writeText(json);
  }
  logInfo("Scene export created.");
}
function summarizeAreaRefs(data) {
  let byRegionId = 0;
  let byLabel = 0;
  for (const scene of data.scenes ?? []) {
    for (const encounter of scene.encounters ?? []) {
      for (const placement of encounter.placements ?? []) {
        const areaRef = placement?.areaRef;
        if (!areaRef || areaRef.type !== "region") continue;
        if (areaRef.regionId) byRegionId++;
        if (areaRef.roomLabel || areaRef.regionName) byLabel++;
      }
    }
  }
  return { byRegionId, byLabel };
}
async function importEncounterJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    logError("Invalid JSON parse", err);
    ui.notifications.error("Import fehlgeschlagen: ung\xFCltiges JSON.");
    return;
  }
  const validation = validateEncounterImport(parsed);
  if (!validation.ok) {
    const msg = validation.errors.map((e) => `${e.path}: ${e.message}`).join("\n");
    ui.notifications.error("Schema-Validierung fehlgeschlagen. Details in Dialog.");
    await Dialog.prompt({
      title: "Import-Fehler",
      content: `<pre>${msg}</pre>`
    });
    return;
  }
  await setEncounterData(validation.data);
  const summary = summarizeAreaRefs(validation.data);
  logInfo("Encounter data imported.");
  ui.notifications.info("Encounter JSON erfolgreich importiert.");
  if (summary.byRegionId || summary.byLabel) {
    ui.notifications.info(`Region-Referenzen erkannt: ${summary.byRegionId} per regionId, ${summary.byLabel} per roomLabel/regionName.`);
  }
}
async function promptImportDialog() {
  const content = await renderTemplate("modules/pf2e-encounter-adjuster/templates/import-dialog.hbs", {});
  new Dialog({
    title: "Import Encounter JSON",
    content,
    buttons: {
      import: {
        label: "Importieren",
        callback: async (html) => {
          const text = html.find("textarea[name='encounter-json']").val();
          if (text) {
            await importEncounterJson(String(text));
            return;
          }
          const fileInput = html.find("input[name='encounter-file']")[0];
          const file = fileInput?.files?.[0];
          if (!file) {
            ui.notifications.warn("Bitte Datei w\xE4hlen oder JSON einf\xFCgen.");
            return;
          }
          const raw = await file.text();
          await importEncounterJson(raw);
        }
      }
    },
    default: "import"
  }).render(true);
}
function getStoredEncounterData() {
  return getEncounterData();
}

// src/data/indexer.ts
function isCreature(actor) {
  const type = String(actor?.type ?? "").toLowerCase();
  return ["npc", "creature", "hazard"].includes(type);
}
function toEntry(actor, sourcePack) {
  return {
    uuid: actor.uuid,
    name: actor.name,
    slug: actor?.system?.slug,
    img: actor.img,
    type: actor.type,
    level: actor?.system?.details?.level?.value,
    traits: actor?.system?.traits?.value ?? [],
    sourcePack
  };
}
async function rebuildMonsterIndex() {
  const entries = [];
  for (const actor of game.actors) {
    if (isCreature(actor)) entries.push(toEntry(actor));
  }
  for (const packId of getCompendiumList()) {
    const pack = game.packs.get(packId);
    if (!pack || pack.documentName !== "Actor") continue;
    const docs = await pack.getDocuments();
    for (const actor of docs) {
      if (isCreature(actor)) entries.push(toEntry(actor, packId));
    }
  }
  await setMonsterIndex({ builtAt: (/* @__PURE__ */ new Date()).toISOString(), entries });
  logInfo(`Monster index rebuilt (${entries.length} entries).`);
  return { count: entries.length };
}
function norm(value) {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
async function resolveMonster(monster) {
  if (monster.uuid) {
    const doc = await fromUuidSafe(monster.uuid);
    if (doc) return { status: "resolved", entry: toEntry(doc) };
  }
  const index = getMonsterIndex();
  const entries = index?.entries ?? [];
  if (monster.slug) {
    const slugMatches = entries.filter((e) => e.slug === monster.slug);
    const filtered = slugMatches.filter((e) => {
      const okLevel = typeof monster.levelHint !== "number" || e.level === monster.levelHint;
      const okSource = !monster.sourceHint || (e.sourcePack ?? "").includes(monster.sourceHint);
      return okLevel && okSource;
    });
    if (filtered.length === 1) return { status: "resolved", entry: filtered[0] };
    if (filtered.length > 1) return { status: "conflict", candidates: filtered };
  }
  const nameMatches = entries.filter((e) => norm(e.name) === norm(monster.name));
  if (nameMatches.length === 1) return { status: "resolved", entry: nameMatches[0] };
  if (nameMatches.length > 1) return { status: "conflict", candidates: nameMatches };
  logDebug("Monster unresolved", monster);
  return { status: "unresolved" };
}
async function fromUuidSafe(uuid) {
  try {
    return await fromUuid(uuid);
  } catch {
    return null;
  }
}

// src/foundry/grid-selection.ts
var GridSelectionManager = class _GridSelectionManager {
  static _instance;
  active = false;
  selected = /* @__PURE__ */ new Set();
  static get instance() {
    if (!this._instance) this._instance = new _GridSelectionManager();
    return this._instance;
  }
  activate() {
    this.active = true;
    ui.notifications.info("Grid-Auswahl aktiviert. Klick zum Toggle, Drag f\xFCr Rechteck.");
    logDebug("Grid selection activated.");
  }
  deactivate() {
    this.active = false;
  }
  clear() {
    this.selected.clear();
  }
  toggleCell(x, y) {
    const key = `${x},${y}`;
    if (this.selected.has(key)) this.selected.delete(key);
    else this.selected.add(key);
  }
  setRectangle(x1, y1, x2, y2) {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
        this.selected.add(`${x},${y}`);
      }
    }
  }
  getCells() {
    return [...this.selected].map((k) => {
      const [x, y] = k.split(",").map((v) => Number(v));
      return { x, y };
    });
  }
  isActive() {
    return this.active;
  }
};

// src/foundry/spawn.ts
function cellsFromArea(area) {
  if (area?.rect) {
    const cells = [];
    for (let y = area.rect.y; y < area.rect.y + area.rect.h; y++) {
      for (let x = area.rect.x; x < area.rect.x + area.rect.w; x++) cells.push({ x, y });
    }
    return cells;
  }
  if (Array.isArray(area?.points)) return area.points;
  return [];
}
function shuffle(arr) {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}
function areaRefLabel(areaRef) {
  if (!areaRef) return "";
  if (areaRef.type === "region") return areaRef.roomLabel || areaRef.regionName || areaRef.regionId || "region";
  return String(areaRef);
}
function getPlacementCells(scene, placement, selectedCells) {
  if (selectedCells.length) {
    return { cells: selectedCells, unresolvedRegion: false };
  }
  if (placement.area) {
    return { cells: cellsFromArea(placement.area), unresolvedRegion: false };
  }
  if (placement.areaRef?.type === "region") {
    const region = resolveRegion(scene, placement.areaRef);
    if (!region) return { cells: [], unresolvedRegion: true };
    return { cells: regionToGridCells(scene, region), unresolvedRegion: false };
  }
  return { cells: [], unresolvedRegion: false };
}
async function previewPopulate(scene, placements, selectedCells) {
  const warnings = [];
  const unresolved = [];
  const unresolvedRegions = [];
  let total = 0;
  for (const p of placements) {
    const res = await resolveMonster(p.monster);
    if (res.status !== "resolved") unresolved.push(p.areaRef ? `${p.monster.name} [${areaRefLabel(p.areaRef)}]` : p.monster.name);
    if (!selectedCells.length && p.areaRef?.type === "region" && !resolveRegion(scene, p.areaRef)) {
      unresolvedRegions.push(areaRefLabel(p.areaRef));
    }
    total += p.quantity;
  }
  const max = Number(game.settings.get(MODULE_ID, SETTINGS_KEYS.maxTokens));
  if (total > max) warnings.push(`Token-Limit \xFCberschritten (${total}/${max}).`);
  if (unresolved.length) warnings.push(`Unresolved Monster: ${unresolved.join(", ")}`);
  if (unresolvedRegions.length) warnings.push(`Unresolved Regions: ${unresolvedRegions.join(", ")}`);
  if (selectedCells.length && total > selectedCells.length) warnings.push("Mehr Tokens als ausgew\xE4hlte Squares.");
  return warnings;
}
async function populateScene(scene, placements, selectedCells) {
  const max = Number(game.settings.get(MODULE_ID, SETTINGS_KEYS.maxTokens));
  const linked = Boolean(game.settings.get(MODULE_ID, SETTINGS_KEYS.linkedMode));
  const defaultAllowStacking = Boolean(game.settings.get(MODULE_ID, SETTINGS_KEYS.allowStacking));
  const docs = [];
  let total = 0;
  for (const placement of placements) {
    total += placement.quantity;
    if (total > max) throw new Error(`Max token limit exceeded (${max}).`);
    const resolved = await resolveMonster(placement.monster);
    if (resolved.status !== "resolved" || !resolved.entry) continue;
    const actor = await fromUuid(resolved.entry.uuid);
    if (!actor) continue;
    const { cells: rawCells, unresolvedRegion } = getPlacementCells(scene, placement, selectedCells);
    if (unresolvedRegion) {
      ui.notifications.warn(`Region f\xFCr Raumlabel ${areaRefLabel(placement.areaRef)} nicht gefunden.`);
      continue;
    }
    if (!rawCells.length) {
      ui.notifications.warn(`Keine Grid-Zellen f\xFCr Placement ${placement.monster.name} (${areaRefLabel(placement.areaRef)}).`);
      continue;
    }
    const randomized = placement.spawnRules?.randomizeWithinArea ? shuffle(rawCells) : [...rawCells];
    const allowStacking = placement.spawnRules?.allowStacking ?? defaultAllowStacking;
    const available = allowStacking ? randomized : randomized.slice(0, placement.quantity);
    if (!allowStacking && placement.quantity > available.length) {
      const areaSuffix = areaRefLabel(placement.areaRef) ? ` [${areaRefLabel(placement.areaRef)}]` : "";
      throw new Error(`Not enough cells for placement ${placement.monster.name}${areaSuffix}.`);
    }
    for (let i = 0; i < placement.quantity; i++) {
      const cell = allowStacking ? randomized[i % Math.max(1, randomized.length)] : available[i];
      if (!cell) continue;
      const px = cell.x * scene.grid.size + scene.grid.size / 2;
      const py = cell.y * scene.grid.size + scene.grid.size / 2;
      docs.push({
        actorId: actor.id,
        x: px,
        y: py,
        hidden: placement.token?.hidden ?? false,
        elevation: placement.token?.elevation ?? 0,
        rotation: placement.token?.rotation ?? 0,
        disposition: placement.token?.disposition ?? CONST.TOKEN_DISPOSITIONS.HOSTILE,
        actorLink: linked,
        texture: {
          scaleX: placement.token?.scale ?? 1,
          scaleY: placement.token?.scale ?? 1
        }
      });
    }
  }
  if (!docs.length) {
    ui.notifications.warn("Keine spawnbaren Tokens gefunden.");
    return;
  }
  await scene.createEmbeddedDocuments("Token", docs);
  ui.notifications.info(`${docs.length} Token gespawnt.`);
}

// src/ui/app.ts
var BaseApp = foundry?.applications?.api?.ApplicationV2 ?? Application;
function areaRefDisplay(areaRef) {
  if (!areaRef) return "";
  if (areaRef.type === "region") {
    return areaRef.roomLabel || areaRef.regionName || areaRef.regionId || "Region";
  }
  return String(areaRef);
}
var EncounterAdjusterApp = class extends BaseApp {
  static DEFAULT_OPTIONS = {
    id: "pf2e-encounter-adjuster-app",
    classes: ["pf2e-encounter-adjuster"],
    window: { title: "Encounter Adjuster", resizable: true },
    position: { width: 900, height: 700 }
  };
  async _prepareContext() {
    const data = getStoredEncounterData();
    const scenes = (data.scenes ?? []).map((s, idx) => ({ idx, name: s.sceneRef?.name || s.sceneRef?.sceneId || `Szene ${idx + 1}` }));
    const selectedScene = data.scenes?.[0];
    const selectedEncounter = selectedScene?.encounters?.[0];
    const sceneId = selectedScene?.sceneRef?.sceneId;
    const sceneDoc = game.scenes.get(sceneId) ?? canvas.scene;
    const placementRows = (selectedEncounter?.placements ?? []).map((placement) => {
      const isRegion = placement.areaRef?.type === "region";
      const regionLabel = isRegion ? areaRefDisplay(placement.areaRef) : "";
      const unresolvedRegion = isRegion && !resolveRegion(sceneDoc, placement.areaRef);
      return {
        ...placement,
        areaLabel: placement.area?.rect ? "Rect" : placement.area?.points ? "Polygon" : "-",
        regionLabel,
        hasRegion: isRegion,
        unresolvedRegion,
        unresolvedRegionTooltip: `Region f\xFCr Raumlabel ${regionLabel} nicht gefunden`
      };
    });
    const activeSceneId = canvas?.scene?.id ?? "";
    return {
      scenes,
      data,
      activeSceneId,
      selectedCells: GridSelectionManager.instance.getCells().length,
      placementRows
    };
  }
  async _renderHTML(context) {
    return renderTemplate("modules/pf2e-encounter-adjuster/templates/app.hbs", context);
  }
  async _replaceHTML(result, content) {
    content.innerHTML = result;
  }
  activateListeners(html) {
    super.activateListeners?.(html);
    html.find("button[data-action='activate-grid']").on("click", () => GridSelectionManager.instance.activate());
    html.find("button[data-action='clear-grid']").on("click", () => {
      GridSelectionManager.instance.clear();
      this.render();
    });
    html.find("button[data-action='preview']").on("click", async () => {
      const { scene, placements } = this.extractSelection(html);
      const warnings = await previewPopulate(scene, placements, GridSelectionManager.instance.getCells());
      const content = warnings.length ? warnings.join("<br>") : "Keine Warnungen.";
      await Dialog.prompt({ title: "Preview", content: `<p>${content}</p>` });
    });
    html.find("button[data-action='populate']").on("click", async () => {
      const { scene, placements } = this.extractSelection(html);
      try {
        await populateScene(scene, placements, GridSelectionManager.instance.getCells());
      } catch (err) {
        ui.notifications.error(`Populate fehlgeschlagen: ${err.message}`);
      }
    });
    html.find("button[data-action='resolve']").on("click", async () => {
      const { placements } = this.extractSelection(html);
      const unresolved = [];
      for (const p of placements) {
        const result = await resolveMonster(p.monster);
        if (result.status !== "resolved") unresolved.push(p.monster.name);
      }
      if (unresolved.length) {
        ui.notifications.warn(`Unresolved: ${unresolved.join(", ")}`);
      } else {
        ui.notifications.info("Alle Placements aufgel\xF6st.");
      }
      this.render();
    });
  }
  extractSelection(html) {
    const data = getStoredEncounterData();
    const sIdx = Number(html.find("select[name='scene']").val() ?? 0);
    const eIdx = Number(html.find("select[name='encounter']").val() ?? 0);
    const selectedScene = data.scenes[sIdx];
    const sceneId = selectedScene?.sceneRef?.sceneId;
    const scene = game.scenes.get(sceneId) ?? canvas.scene;
    const placements = selectedScene?.encounters?.[eIdx]?.placements ?? [];
    return { scene, placements };
  }
};

// src/main.ts
var app = null;
Hooks.once("init", () => {
  registerSettings();
});
Hooks.once("ready", () => {
  Hooks.on("renderSettingsConfig", (_app, html) => {
    const block = $(
      `<div class="form-group">
        <label>PF2e Encounter Adjuster</label>
        <div class="form-fields">
          <button type="button" data-action="ea-export">Szenenliste exportieren</button>
          <button type="button" data-action="ea-import">Encounter JSON importieren</button>
          <button type="button" data-action="ea-index">Monster-Index neu aufbauen</button>
          <button type="button" data-action="ea-open">Encounter Adjuster \xF6ffnen</button>
        </div>
      </div>`
    );
    html.find(".tab[data-tab='modules'] .settings-list").append(block);
    block.find("button[data-action='ea-export']").on("click", async () => exportScenesJson(false));
    block.find("button[data-action='ea-import']").on("click", async () => promptImportDialog());
    block.find("button[data-action='ea-index']").on("click", async () => {
      const r = await rebuildMonsterIndex();
      ui.notifications.info(`Monster-Index aktualisiert (${r.count} Eintr\xE4ge).`);
    });
    block.find("button[data-action='ea-open']").on("click", async () => {
      app ??= new EncounterAdjusterApp();
      app.render(true);
    });
  });
  Hooks.on("getSceneControlButtons", (controls) => {
    if (!game.user.isGM) return;
    controls.push({
      name: MODULE_ID,
      title: "Encounter Adjuster",
      icon: "fas fa-dragon",
      layer: "TokenLayer",
      tools: [
        {
          name: "ea-grid-toggle",
          title: "Grid-Square togglen",
          icon: "fas fa-vector-square",
          button: true,
          onClick: () => GridSelectionManager.instance.activate()
        }
      ]
    });
  });
});
//# sourceMappingURL=main.js.map
