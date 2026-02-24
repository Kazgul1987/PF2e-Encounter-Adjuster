# PF2e Encounter Adjuster (Foundry VTT v13)

Ein Foundry-Modul für **Pathfinder 2e**, das extern erzeugte Encounter-JSON-Datensätze importiert, Monster auflöst und Tokens in Szenen per Grid-Auswahl spawnt.

## Features

- Export der Szenenliste als JSON (inkl. `sceneId`, `sceneUuid`, Grid/Dimensionen).
- Import von versionierten Encounter-Daten (`schemaVersion: 1`) via Datei oder Paste.
- Defensive Validierung mit verständlichen Fehlermeldungen (`Pfad: Nachricht`).
- Monster-Index aus World Actors + konfigurierbaren Compendiums.
- Resolver-Pipeline: `uuid` → `slug(+Hints)` → Name-Matching.
- Encounter-UI mit Preview, Populate und Grid-Auswahl-Aktivierung.
- Spawn-Optionen: linked/unlinked, hidden/disposition, Stacking-Regeln, Safety-Limits.

## Installation

### Entwicklungsmodus (Symlink)

1. Repository klonen.
2. Dependencies installieren:
   ```bash
   npm install
   ```
3. Build ausführen:
   ```bash
   npm run build
   ```
4. Das Modulverzeichnis in euren Foundry `Data/modules`-Ordner symlinken, z. B.:
   ```bash
   ln -s /workspace/PF2e-Encounter-Adjuster /path/to/FoundryVTT/Data/modules/pf2e-encounter-adjuster
   ```
5. Foundry neu laden und Modul aktivieren.

## Nutzung

1. **Settings → Module Settings** öffnen.
2. In der PF2e Encounter Adjuster Sektion:
   - **Szenenliste exportieren**
   - **Encounter JSON importieren**
   - **Monster-Index neu aufbauen**
   - **Encounter Adjuster öffnen**
3. Im Encounter-Fenster Szene + Encounter wählen, optional Grid-Auswahl aktivieren, dann **Preview** oder **Populate**.

## Import Schema (v1)

```json
{
  "schemaVersion": 1,
  "adventureId": "abomination-vaults",
  "sourceTitle": "Externes Tool",
  "generatedAt": "2026-01-05T19:30:00.000Z",
  "scenes": [
    {
      "sceneRef": { "sceneId": "abc123", "name": "Level 1" },
      "encounters": [
        {
          "id": "standard-4pc",
          "label": "Standard (4 PCs)",
          "placements": [
            {
              "monster": {
                "slug": "goblin-warrior",
                "name": "Goblin Warrior",
                "levelHint": -1,
                "sourceHint": "monster-core"
              },
              "quantity": 3,
              "area": { "rect": { "x": 12, "y": 8, "w": 4, "h": 3 } },
              "token": { "hidden": false, "disposition": -1 },
              "spawnRules": { "allowStacking": false, "randomizeWithinArea": true }
            }
          ]
        }
      ]
    }
  ]
}
```

## Troubleshooting

- **Import schlägt fehl**: JSON in Validator prüfen und Fehlpfad aus dem Dialog beachten.
- **Unresolved Monster**: Monster-Index neu aufbauen und Compendium-Liste in den Settings prüfen.
- **Zu viele Tokens**: `Maximale Token pro Populate` erhöhen oder Encounter anpassen.
- **Keine Token erscheinen**: Szene/Encounter-Auswahl und Grid-Cells prüfen.

## Build-Scripts

- `npm run build` – einmaliger Build nach `dist/main.js`
- `npm run watch` – Watch-Modus
- `npm run lint` – TypeScript Typecheck
