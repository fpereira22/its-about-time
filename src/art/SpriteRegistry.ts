import Phaser from 'phaser';
import spritesData from '../data/sprites.json';
import { drawCharacterSheet, SHEET_COLS, SHEET_ROWS, type CharacterLook } from './characters';
import { OBJECT_ART } from './objects';
import { Painter } from './Painter';
import { TILE_DEFS } from './tiles';
import { VEHICLE_ART } from './vehicles';
import { TILE } from '../config/display';

/**
 * Punto único de acceso a las texturas.
 *
 * Hoy todo se genera por código. Para reemplazar un sprite por arte real, agrega en
 * `src/data/sprites.json` → "sheets" una entrada `"char:player": "sprites/player.png"`
 * (ruta relativa a /public). Si la hoja existe, se usa en vez de la generada.
 * Personajes: hoja de 48×64 (3 columnas × 4 filas, ver characters.ts). Objetos: 16×16.
 */
interface SpritesManifest {
  characters: Record<string, { look: CharacterLook }>;
  objects: string[];
  sheets: Record<string, string>;
}

const manifest = spritesData as unknown as SpritesManifest;

export const TILESET_KEY = 'tiles';
/** Columnas de la grilla del tileset (los mapas usan el índice de TILE_DEFS; Phaser lo ubica en la grilla). */
export const TILESET_COLS = 32;

export function charKey(id: string): string {
  return `char:${id}`;
}

export function objKey(id: string): string {
  return `obj:${id}`;
}

export function vehicleKey(id: string): string {
  return `veh:${id}`;
}

export function hasCharacter(id: string): boolean {
  return id in manifest.characters;
}

export function hasObject(id: string): boolean {
  return manifest.objects.includes(id);
}

/** Encola las hojas externas declaradas en el manifiesto (llamar desde preload()). */
export function queueExternalSheets(load: Phaser.Loader.LoaderPlugin): void {
  for (const [key, url] of Object.entries(manifest.sheets)) {
    if (key.startsWith('char:')) {
      load.spritesheet(key, url, { frameWidth: TILE, frameHeight: TILE });
    } else {
      load.image(key, url);
    }
  }
}

/** Aspecto declarado de un personaje de sprites.json (para variarlo, ej. la ropa del jugador). */
export function characterLook(id: string): CharacterLook | undefined {
  return manifest.characters[id]?.look;
}

/** Crea (si no existe) la hoja 48×64 de un personaje con el aspecto dado. */
export function ensureCharacterTexture(textures: Phaser.Textures.TextureManager, key: string, look: CharacterLook): void {
  if (textures.exists(key)) return;
  const tex = textures.createCanvas(key, SHEET_COLS * TILE, SHEET_ROWS * TILE);
  if (!tex) throw new Error(`No se pudo crear la textura ${key}`);
  drawCharacterSheet(tex.getContext(), look);
  for (let i = 0; i < SHEET_COLS * SHEET_ROWS; i++) {
    tex.add(i, 0, (i % SHEET_COLS) * TILE, Math.floor(i / SHEET_COLS) * TILE, TILE, TILE);
  }
  tex.refresh();
}

/** Genera todas las texturas que no fueron cargadas desde archivos. */
export function generateTextures(scene: Phaser.Scene): void {
  const textures = scene.textures;

  if (!textures.exists(TILESET_KEY)) {
    // Grilla de TILESET_COLS columnas: una sola fila superaría el ancho máximo de textura de algunas GPU.
    const rows = Math.ceil(TILE_DEFS.length / TILESET_COLS);
    const tex = textures.createCanvas(TILESET_KEY, TILESET_COLS * TILE, rows * TILE);
    if (!tex) throw new Error('No se pudo crear el tileset');
    const ctx = tex.getContext();
    TILE_DEFS.forEach((def, i) => def.draw(new Painter(ctx, (i % TILESET_COLS) * TILE, Math.floor(i / TILESET_COLS) * TILE)));
    tex.refresh();
  }

  for (const [id, entry] of Object.entries(manifest.characters)) {
    ensureCharacterTexture(textures, charKey(id), entry.look);
  }

  for (const [id, art] of Object.entries(VEHICLE_ART)) {
    const key = vehicleKey(id);
    if (textures.exists(key)) continue;
    const tex = textures.createCanvas(key, art.w, art.h);
    if (!tex) throw new Error(`No se pudo crear la textura ${key}`);
    const ctx = tex.getContext();
    if (art.mirror) ctx.setTransform(-1, 0, 0, 1, art.w, 0);
    else if (art.flipY) ctx.setTransform(1, 0, 0, -1, 0, art.h);
    art.draw(new Painter(ctx, 0, 0, Math.max(art.w, art.h)));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    tex.refresh();
  }

  for (const id of manifest.objects) {
    const key = objKey(id);
    if (textures.exists(key)) continue;
    const art = OBJECT_ART[id];
    if (!art) throw new Error(`Objeto "${id}" declarado en sprites.json pero sin arte en objects.ts`);
    const tex = textures.createCanvas(key, TILE, TILE);
    if (!tex) throw new Error(`No se pudo crear la textura ${key}`);
    art().draw(tex.getContext(), 0, 0);
    tex.refresh();
  }
}
