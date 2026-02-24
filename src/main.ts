import { registerSettings } from "./foundry/settings";
import { MODULE_ID } from "./foundry/constants";
import { exportScenesJson, promptImportDialog } from "./foundry/io";
import { rebuildMonsterIndex } from "./data/indexer";
import { EncounterAdjusterApp } from "./ui/app";
import { GridSelectionManager } from "./foundry/grid-selection";

let app: EncounterAdjusterApp | null = null;

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", () => {
  Hooks.on("renderSettingsConfig", (_app: any, html: any) => {
    const block = $(
      `<div class="form-group">\n        <label>PF2e Encounter Adjuster</label>\n        <div class="form-fields">\n          <button type="button" data-action="ea-export">Szenenliste exportieren</button>\n          <button type="button" data-action="ea-import">Encounter JSON importieren</button>\n          <button type="button" data-action="ea-index">Monster-Index neu aufbauen</button>\n          <button type="button" data-action="ea-open">Encounter Adjuster öffnen</button>\n        </div>\n      </div>`
    );
    html.find(".tab[data-tab='modules'] .settings-list").append(block);

    block.find("button[data-action='ea-export']").on("click", async () => exportScenesJson(false));
    block.find("button[data-action='ea-import']").on("click", async () => promptImportDialog());
    block.find("button[data-action='ea-index']").on("click", async () => {
      const r = await rebuildMonsterIndex();
      ui.notifications.info(`Monster-Index aktualisiert (${r.count} Einträge).`);
    });
    block.find("button[data-action='ea-open']").on("click", async () => {
      app ??= new EncounterAdjusterApp();
      app.render(true);
    });
  });

  Hooks.on("getSceneControlButtons", (controls: any[]) => {
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
