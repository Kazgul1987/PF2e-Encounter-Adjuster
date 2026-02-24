import { getCompendiumList } from "../foundry/settings";
import { logDebug, logInfo } from "../foundry/logger";
import { getMonsterIndex, setMonsterIndex } from "./store";

export interface MonsterIndexEntry {
  uuid: string;
  name: string;
  slug?: string;
  img?: string;
  type?: string;
  level?: number;
  traits?: string[];
  sourcePack?: string;
}

function isCreature(actor: any): boolean {
  const type = String(actor?.type ?? "").toLowerCase();
  return ["npc", "creature", "hazard"].includes(type);
}

function toEntry(actor: any, sourcePack?: string): MonsterIndexEntry {
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

export async function rebuildMonsterIndex(): Promise<{ count: number }> {
  const entries: MonsterIndexEntry[] = [];

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

  await setMonsterIndex({ builtAt: new Date().toISOString(), entries });
  logInfo(`Monster index rebuilt (${entries.length} entries).`);
  return { count: entries.length };
}

function norm(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export async function resolveMonster(monster: any): Promise<{ status: "resolved" | "unresolved" | "conflict"; entry?: MonsterIndexEntry; candidates?: MonsterIndexEntry[] }> {
  if (monster.uuid) {
    const doc = await fromUuidSafe(monster.uuid);
    if (doc) return { status: "resolved", entry: toEntry(doc) };
  }

  const index = getMonsterIndex();
  const entries: MonsterIndexEntry[] = index?.entries ?? [];

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

async function fromUuidSafe(uuid: string): Promise<any | null> {
  try {
    return await fromUuid(uuid);
  } catch {
    return null;
  }
}
