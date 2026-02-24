import { validateEncounterImport } from "../data/schema";
import { getEncounterData, setEncounterData } from "../data/store";
import { getSceneRegions } from "./regions";
import { logError, logInfo } from "./logger";

function regionBounds(region: any): { x: number; y: number; w: number; h: number } | null {
  const bounds = region?.bounds;
  if (!bounds) return null;
  const width = Number(bounds.width ?? bounds.w);
  const height = Number(bounds.height ?? bounds.h);
  if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  return { x: Number(bounds.x), y: Number(bounds.y), w: width, h: height };
}

export function buildScenesExport(): any {
  return {
    foundryVersion: game.version,
    systemId: game.system.id,
    worldId: game.world?.id ?? null,
    generatedAt: new Date().toISOString(),
    scenes: game.scenes.map((scene: any) => ({
      sceneId: scene.id,
      sceneUuid: scene.uuid,
      name: scene.name,
      gridSize: scene.grid?.size,
      width: scene.width,
      height: scene.height,
      background: scene.background?.src ?? null,
      notes: scene?.flags?.notes ?? null,
      regions: getSceneRegions(scene).map((region: any) => {
        const bounds = regionBounds(region);
        return {
          id: String(region.id),
          name: String(region.name ?? ""),
          ...(bounds ? { bounds } : {})
        };
      })
    }))
  };
}

export async function exportScenesJson(copyToClipboard = false): Promise<void> {
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

function summarizeAreaRefs(data: any): { byRegionId: number; byLabel: number } {
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

export async function importEncounterJson(raw: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    logError("Invalid JSON parse", err);
    ui.notifications.error("Import fehlgeschlagen: ungültiges JSON.");
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

export async function promptImportDialog(): Promise<void> {
  const content = await renderTemplate("modules/pf2e-encounter-adjuster/templates/import-dialog.hbs", {});
  new Dialog({
    title: "Import Encounter JSON",
    content,
    buttons: {
      import: {
        label: "Importieren",
        callback: async (html: any) => {
          const text = html.find("textarea[name='encounter-json']").val();
          if (text) {
            await importEncounterJson(String(text));
            return;
          }
          const fileInput = html.find("input[name='encounter-file']")[0] as HTMLInputElement;
          const file = fileInput?.files?.[0];
          if (!file) {
            ui.notifications.warn("Bitte Datei wählen oder JSON einfügen.");
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

export function getStoredEncounterData(): any {
  return getEncounterData();
}
