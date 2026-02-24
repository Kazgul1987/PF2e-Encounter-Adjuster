import { getStoredEncounterData } from "../foundry/io";
import { GridSelectionManager } from "../foundry/grid-selection";
import { populateScene, previewPopulate } from "../foundry/spawn";
import { resolveMonster } from "../data/indexer";

const BaseApp: any = foundry?.applications?.api?.ApplicationV2 ?? Application;

export class EncounterAdjusterApp extends BaseApp {
  declare render: (force?: boolean) => unknown;
  static DEFAULT_OPTIONS = {
    id: "pf2e-encounter-adjuster-app",
    classes: ["pf2e-encounter-adjuster"],
    window: { title: "Encounter Adjuster", resizable: true },
    position: { width: 900, height: 700 }
  };

  async _prepareContext(): Promise<any> {
    const data = getStoredEncounterData();
    const scenes = (data.scenes ?? []).map((s: any, idx: number) => ({ idx, name: s.sceneRef?.name || s.sceneRef?.sceneId || `Szene ${idx + 1}` }));
    const activeSceneId = canvas?.scene?.id ?? "";
    return {
      scenes,
      data,
      activeSceneId,
      selectedCells: GridSelectionManager.instance.getCells().length
    };
  }

  async _renderHTML(context: any): Promise<string> {
    return renderTemplate("modules/pf2e-encounter-adjuster/templates/app.hbs", context);
  }

  async _replaceHTML(result: string, content: HTMLElement): Promise<void> {
    content.innerHTML = result;
  }

  activateListeners(html: any): void {
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
      } catch (err: any) {
        ui.notifications.error(`Populate fehlgeschlagen: ${err.message}`);
      }
    });

    html.find("button[data-action='resolve']").on("click", async () => {
      const { placements } = this.extractSelection(html);
      const unresolved: string[] = [];
      for (const p of placements) {
        const result = await resolveMonster(p.monster);
        if (result.status !== "resolved") unresolved.push(p.monster.name);
      }
      if (unresolved.length) {
        ui.notifications.warn(`Unresolved: ${unresolved.join(", ")}`);
      } else {
        ui.notifications.info("Alle Placements aufgelöst.");
      }
      this.render();
    });
  }

  extractSelection(html: any): { scene: any; placements: any[] } {
    const data = getStoredEncounterData();
    const sIdx = Number(html.find("select[name='scene']").val() ?? 0);
    const eIdx = Number(html.find("select[name='encounter']").val() ?? 0);
    const selectedScene = data.scenes[sIdx];
    const sceneId = selectedScene?.sceneRef?.sceneId;
    const scene = game.scenes.get(sceneId) ?? canvas.scene;
    const placements = selectedScene?.encounters?.[eIdx]?.placements ?? [];
    return { scene, placements };
  }
}
