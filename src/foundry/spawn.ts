import { resolveMonster } from "../data/indexer";
import { MODULE_ID, SETTINGS_KEYS } from "./constants";
import { regionToGridCells, resolveRegion } from "./regions";

function cellsFromArea(area: any): Array<{ x: number; y: number }> {
  if (area?.rect) {
    const cells: Array<{ x: number; y: number }> = [];
    for (let y = area.rect.y; y < area.rect.y + area.rect.h; y++) {
      for (let x = area.rect.x; x < area.rect.x + area.rect.w; x++) cells.push({ x, y });
    }
    return cells;
  }
  if (Array.isArray(area?.points)) return area.points;
  return [];
}

function shuffle<T>(arr: T[]): T[] {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function areaRefLabel(areaRef: any): string {
  if (!areaRef) return "";
  if (areaRef.type === "region") return areaRef.roomLabel || areaRef.regionName || areaRef.regionId || "region";
  return String(areaRef);
}

function getPlacementCells(scene: any, placement: any, selectedCells: Array<{ x: number; y: number }>): { cells: Array<{ x: number; y: number }>; unresolvedRegion: boolean } {
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

export async function previewPopulate(scene: any, placements: any[], selectedCells: Array<{ x: number; y: number }>): Promise<string[]> {
  const warnings: string[] = [];
  const unresolved: string[] = [];
  const unresolvedRegions: string[] = [];
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
  if (total > max) warnings.push(`Token-Limit überschritten (${total}/${max}).`);
  if (unresolved.length) warnings.push(`Unresolved Monster: ${unresolved.join(", ")}`);
  if (unresolvedRegions.length) warnings.push(`Unresolved Regions: ${unresolvedRegions.join(", ")}`);
  if (selectedCells.length && total > selectedCells.length) warnings.push("Mehr Tokens als ausgewählte Squares.");
  return warnings;
}

export async function populateScene(scene: any, placements: any[], selectedCells: Array<{ x: number; y: number }>): Promise<void> {
  const max = Number(game.settings.get(MODULE_ID, SETTINGS_KEYS.maxTokens));
  const linked = Boolean(game.settings.get(MODULE_ID, SETTINGS_KEYS.linkedMode));
  const defaultAllowStacking = Boolean(game.settings.get(MODULE_ID, SETTINGS_KEYS.allowStacking));

  const docs: any[] = [];
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
      ui.notifications.warn(`Region für Raumlabel ${areaRefLabel(placement.areaRef)} nicht gefunden.`);
      continue;
    }

    if (!rawCells.length) {
      ui.notifications.warn(`Keine Grid-Zellen für Placement ${placement.monster.name} (${areaRefLabel(placement.areaRef)}).`);
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
      const cell = allowStacking
        ? randomized[i % Math.max(1, randomized.length)]
        : available[i];
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
