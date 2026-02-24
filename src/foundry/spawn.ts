import { resolveMonster } from "../data/indexer";
import { MODULE_ID, SETTINGS_KEYS } from "./constants";

function cellsFromArea(area: any): Array<{ x: number; y: number }> {
  if (area.rect) {
    const cells: Array<{ x: number; y: number }> = [];
    for (let y = area.rect.y; y < area.rect.y + area.rect.h; y++) {
      for (let x = area.rect.x; x < area.rect.x + area.rect.w; x++) cells.push({ x, y });
    }
    return cells;
  }
  if (Array.isArray(area.points)) return area.points;
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

export async function previewPopulate(scene: any, placements: any[], selectedCells: Array<{ x: number; y: number }>): Promise<string[]> {
  const warnings: string[] = [];
  const unresolved: string[] = [];
  let total = 0;
  for (const p of placements) {
    const res = await resolveMonster(p.monster);
    if (res.status !== "resolved") unresolved.push(p.areaRef ? `${p.monster.name} [${p.areaRef}]` : p.monster.name);
    total += p.quantity;
  }
  const max = Number(game.settings.get(MODULE_ID, SETTINGS_KEYS.maxTokens));
  if (total > max) warnings.push(`Token-Limit überschritten (${total}/${max}).`);
  if (unresolved.length) warnings.push(`Unresolved: ${unresolved.join(", ")}`);
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

    const areaCells = selectedCells.length ? selectedCells : cellsFromArea(placement.area);
    const randomized = placement.spawnRules?.randomizeWithinArea ? shuffle(areaCells) : [...areaCells];
    const allowStacking = placement.spawnRules?.allowStacking ?? defaultAllowStacking;
    const available = allowStacking ? randomized : randomized.slice(0, placement.quantity);

    if (!allowStacking && placement.quantity > available.length) {
      const areaSuffix = placement.areaRef ? ` [${placement.areaRef}]` : "";
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
    const areaRefs = placements.map((placement) => placement.areaRef).filter((ref): ref is string => typeof ref === "string" && ref.length > 0);
    const suffix = areaRefs.length ? ` Betroffene Bereiche: ${areaRefs.join(", ")}.` : "";
    ui.notifications.warn(`Keine spawnbaren Tokens gefunden.${suffix}`);
    return;
  }

  await scene.createEmbeddedDocuments("Token", docs);
  ui.notifications.info(`${docs.length} Token gespawnt.`);
}
