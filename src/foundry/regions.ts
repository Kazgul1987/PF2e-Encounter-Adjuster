export interface RegionAreaRef {
  type: "region";
  regionId?: string;
  regionName?: string;
  roomLabel?: string;
}

export function normalizeRegionText(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

export function extractRoomCode(value?: string): string | null {
  if (!value) return null;
  const normalized = normalizeRegionText(value).replace(/^[\s.]+|[\s.]+$/g, "");
  const match = normalized.match(/^([a-z]+[0-9]+)\b/);
  return match?.[1] ?? null;
}

export function getSceneRegions(scene: any): any[] {
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

export function resolveRegion(scene: any, areaRef?: RegionAreaRef | null): any | null {
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

function getGridSize(scene: any): number {
  return Number(scene?.grid?.size ?? scene?.dimensions?.size ?? 0);
}

function regionBounds(region: any): { x: number; y: number; w: number; h: number } | null {
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

function pointInPolygon(px: number, py: number, points: number[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 2; i < points.length; i += 2) {
    const xi = points[i];
    const yi = points[i + 1];
    const xj = points[j];
    const yj = points[j + 1];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
    j = i;
  }
  return inside;
}

function shapeContainsPoint(shape: any, px: number, py: number): boolean {
  const type = String(shape.type ?? shape.shape ?? "rectangle").toLowerCase();
  const x = Number(shape.x ?? 0);
  const y = Number(shape.y ?? 0);

  if (Array.isArray(shape.points) && shape.points.length >= 6) {
    const worldPoints = shape.points.map((v: number, idx: number) => Number(v) + (idx % 2 === 0 ? x : y));
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

function regionContainsPoint(region: any, px: number, py: number): boolean {
  if (typeof region?.containsPoint === "function") {
    return Boolean(region.containsPoint({ x: px, y: py }));
  }

  const shapeData = Array.isArray(region?.shapes) ? region.shapes : Array.isArray(region?._source?.shapes) ? region._source.shapes : [];
  return shapeData.some((shape: any) => shapeContainsPoint(shape, px, py));
}

export function regionToGridCells(scene: any, region: any): Array<{ x: number; y: number }> {
  const gridSize = getGridSize(scene);
  const bounds = regionBounds(region);
  if (!gridSize || !bounds) return [];

  const minX = Math.floor(bounds.x / gridSize);
  const minY = Math.floor(bounds.y / gridSize);
  const maxX = Math.ceil((bounds.x + bounds.w) / gridSize);
  const maxY = Math.ceil((bounds.y + bounds.h) / gridSize);

  const cells: Array<{ x: number; y: number }> = [];
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const px = x * gridSize + gridSize / 2;
      const py = y * gridSize + gridSize / 2;
      if (regionContainsPoint(region, px, py)) cells.push({ x, y });
    }
  }

  return cells;
}
