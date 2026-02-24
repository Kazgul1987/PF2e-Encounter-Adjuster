export type SceneRef = { sceneId?: string; sceneUuid?: string; name?: string };
export type PlacementArea =
  | { rect: { x: number; y: number; w: number; h: number } }
  | { points: Array<{ x: number; y: number }> };

export interface PlacementAreaRef {
  type: "region";
  regionId?: string;
  regionName?: string;
  roomLabel?: string;
}

export interface Placement {
  areaRef?: PlacementAreaRef | string;
  monster: {
    uuid?: string;
    slug?: string;
    name: string;
    sourceHint?: string;
    levelHint?: number;
  };
  quantity: number;
  area?: PlacementArea;
  tags?: string[];
  token?: {
    disposition?: number;
    hidden?: boolean;
    elevation?: number;
    scale?: number;
    rotation?: number;
  };
  spawnRules?: {
    allowStacking?: boolean;
    randomizeWithinArea?: boolean;
  };
}

export interface EncounterTemplate {
  id: string;
  label: string;
  notes?: string;
  placements: Placement[];
}

export interface ImportedScene {
  sceneRef: SceneRef;
  encounters: EncounterTemplate[];
}

export interface EncounterImport {
  schemaVersion: 1;
  adventureId?: string;
  sourceTitle?: string;
  generatedAt: string;
  scenes: ImportedScene[];
}

export interface ValidationErrorItem {
  path: string;
  message: string;
}

const isObj = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export function validateEncounterImport(input: unknown): { ok: true; data: EncounterImport } | { ok: false; errors: ValidationErrorItem[] } {
  const errors: ValidationErrorItem[] = [];
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
            const areaRefObj = placement.areaRef as Record<string, unknown>;
            if (areaRefObj.type !== "region") {
              errors.push({ path: `scenes[${sIdx}].encounters[${eIdx}].placements[${pIdx}].areaRef.type`, message: "areaRef.type must be 'region'." });
            }
            const hasRegionReference =
              typeof areaRefObj.regionId === "string" ||
              typeof areaRefObj.regionName === "string" ||
              typeof areaRefObj.roomLabel === "string";
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
  return { ok: true, data: input as unknown as EncounterImport };
}
