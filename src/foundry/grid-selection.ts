import { logDebug } from "./logger";

export class GridSelectionManager {
  private static _instance: GridSelectionManager;
  private active = false;
  private selected = new Set<string>();

  static get instance(): GridSelectionManager {
    if (!this._instance) this._instance = new GridSelectionManager();
    return this._instance;
  }

  activate(): void {
    this.active = true;
    ui.notifications.info("Grid-Auswahl aktiviert. Klick zum Toggle, Drag für Rechteck.");
    logDebug("Grid selection activated.");
  }

  deactivate(): void {
    this.active = false;
  }

  clear(): void {
    this.selected.clear();
  }

  toggleCell(x: number, y: number): void {
    const key = `${x},${y}`;
    if (this.selected.has(key)) this.selected.delete(key);
    else this.selected.add(key);
  }

  setRectangle(x1: number, y1: number, x2: number, y2: number): void {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
        this.selected.add(`${x},${y}`);
      }
    }
  }

  getCells(): Array<{ x: number; y: number }> {
    return [...this.selected].map((k) => {
      const [x, y] = k.split(",").map((v) => Number(v));
      return { x, y };
    });
  }

  isActive(): boolean {
    return this.active;
  }
}
