import Phaser from 'phaser';
import { RANDOM_BUILDING_STYLES } from '../art/palette';
import { hash2 } from '../art/Painter';
import { TILESET_KEY } from '../art/SpriteRegistry';
import { TILE_DEFS, TILE_INDEX } from '../art/tiles';
import { CAMPUS_MAPS } from '../data/campus';
import { PUCC_MAPS } from '../data/campus_cali';
import type { MapData, MapSpawn, MapWarp, MapZone, MapTrigger } from '../types/map';

const mapModules = import.meta.glob<MapData>('../data/maps/*.json', { eager: true, import: 'default' });

const registry = new Map<string, MapData>();
for (const data of Object.values(mapModules)) registry.set(data.id, data);
// Pisos generados por código (edificios de la universidad, misión 2).
for (const data of CAMPUS_MAPS) registry.set(data.id, data);
// Pisos de los edificios de la PUCC en Cali (misión 4).
for (const data of PUCC_MAPS) registry.set(data.id, data);

/** Ancho (en tiles) de cada "edificio" dentro de una manzana del autotile. */
const BUILDING_SEGMENT = 5;

/**
 * Mapa ya interpretado: índices de tileset, colisiones y consultas espaciales.
 * Formato documentado en docs/map-format.md.
 */
export class GameMap {
  readonly width: number;
  readonly height: number;
  private readonly indices: number[][];
  private readonly solid: boolean[][];

  static ids(): string[] {
    return [...registry.keys()];
  }

  static get(id: string): GameMap {
    const data = registry.get(id);
    if (!data) throw new Error(`Mapa "${id}" no existe. Disponibles: ${GameMap.ids().join(', ')}`);
    return new GameMap(data);
  }

  private constructor(readonly data: MapData) {
    validate(data);
    this.width = data.width;
    this.height = data.height;
    const keys = data.rows.map((row) => [...row].map((ch) => data.legend[ch]));
    this.indices = keys.map((row, y) => row.map((key, x) => TILE_INDEX[resolveTileKey(keys, key, x, y)]));
    this.solid = this.indices.map((row) => row.map((i) => TILE_DEFS[i].solid));
  }

  get id(): string {
    return this.data.id;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isSolid(x: number, y: number): boolean {
    return !this.inBounds(x, y) || this.solid[y][x];
  }

  /** Clave del tile ya resuelto (autotile incluido) en (x, y). */
  tileKeyAt(x: number, y: number): string | undefined {
    return this.inBounds(x, y) ? TILE_DEFS[this.indices[y][x]].key : undefined;
  }

  spawn(id: string): MapSpawn {
    const s = this.data.spawns[id];
    if (!s) throw new Error(`Spawn "${id}" no existe en el mapa "${this.id}"`);
    return s;
  }

  warpAt(x: number, y: number): MapWarp | undefined {
    return this.data.warps?.find((w) => w.x === x && w.y === y);
  }

  zoneAt(x: number, y: number): MapZone | undefined {
    return this.data.zones?.find((z) => inRect(z, x, y));
  }

  triggersAt(x: number, y: number): MapTrigger[] {
    return (this.data.triggers ?? []).filter((t) => inRect(t, x, y));
  }

  createLayer(scene: Phaser.Scene): Phaser.Tilemaps.TilemapLayer {
    const tilemap = scene.make.tilemap({
      data: this.indices,
      tileWidth: this.data.tileSize,
      tileHeight: this.data.tileSize,
    });
    const tileset = tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, this.data.tileSize, this.data.tileSize, 0, 0);
    if (!tileset) throw new Error('No se pudo crear el tileset');
    const layer = tilemap.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error(`No se pudo crear la capa del mapa ${this.id}`);
    return layer;
  }
}

function inRect(r: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

function isBuilding(key: string | undefined): boolean {
  return key !== undefined && (key === 'edificio' || key.startsWith('edificio:'));
}

/**
 * Autotile de edificios: "edificio" o "edificio:<estilo>" se convierte en techo, borde,
 * fachada alta o fachada a nivel de calle según los vecinos de arriba y abajo.
 */
function resolveTileKey(keys: (string | undefined)[][], key: string, x: number, y: number): string {
  if (!isBuilding(key)) return key;
  const at = (dy: number): string | undefined => keys[y + dy]?.[x];
  const style = key.includes(':')
    ? key.split(':')[1]
    : RANDOM_BUILDING_STYLES[hash2(Math.floor(x / BUILDING_SEGMENT), blockTop(keys, x, y)) % RANDOM_BUILDING_STYLES.length];

  if (!isBuilding(at(1))) {
    return hash2(x, y) % 3 === 0 ? `${style}_vitrina` : `${style}_fachada`;
  }
  if (!isBuilding(at(2))) return `${style}_fachada_alta`;
  if (!isBuilding(at(-1))) return `${style}_borde`;
  const detail = hash2(x * 7, y * 13) % 11;
  if (detail === 0) return `${style}_techo_equipo`;
  if (detail === 1) return `${style}_techo_claraboya`;
  return `${style}_techo`;
}

/** Fila superior de la manzana en esta columna (para que cada edificio tenga un solo estilo). */
function blockTop(keys: (string | undefined)[][], x: number, y: number): number {
  let top = y;
  while (top > 0 && isBuilding(keys[top - 1]?.[x])) top--;
  return top;
}

function validate(data: MapData): void {
  const where = `Mapa "${data.id}"`;
  if (data.rows.length !== data.height) {
    throw new Error(`${where}: height=${data.height} pero hay ${data.rows.length} filas`);
  }
  data.rows.forEach((row, y) => {
    if ([...row].length !== data.width) {
      throw new Error(`${where}: la fila ${y} mide ${[...row].length}, se esperaba ${data.width}`);
    }
    for (const ch of row) {
      const key = data.legend[ch];
      if (key === undefined) throw new Error(`${where}: caracter '${ch}' (fila ${y}) no está en legend`);
      if (!isBuilding(key) && TILE_INDEX[key] === undefined) {
        throw new Error(`${where}: tile "${key}" no existe en tiles.ts`);
      }
      if (key.startsWith('edificio:') && TILE_INDEX[`${key.split(':')[1]}_techo`] === undefined) {
        throw new Error(`${where}: estilo de edificio "${key}" no existe`);
      }
    }
  });
  for (const [id, s] of Object.entries(data.spawns)) {
    if (s.x < 0 || s.y < 0 || s.x >= data.width || s.y >= data.height) {
      throw new Error(`${where}: spawn "${id}" fuera del mapa`);
    }
  }
  for (const w of data.warps ?? []) {
    const target = registry.get(w.to);
    if (!target) throw new Error(`${where}: warp en (${w.x},${w.y}) apunta a mapa inexistente "${w.to}"`);
    if (!target.spawns[w.spawn]) {
      throw new Error(`${where}: warp en (${w.x},${w.y}) apunta a spawn inexistente "${w.to}.${w.spawn}"`);
    }
  }
}
