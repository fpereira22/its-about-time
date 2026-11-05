import type { MusicTrack, SfxName } from '../audio/sfx';
import type { Condition } from './story';

export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export const DIR_VECTORS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/** Rectángulo en coordenadas de tile. */
export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Tramo con nombre (calle, plaza, estación). Se muestra un cartel al entrar. */
export interface MapZone extends TileRect {
  name: string;
  /** Texto secundario opcional del cartel (ej. "Providencia"). */
  subtitle?: string;
}

export interface MapSpawn {
  x: number;
  y: number;
  dir: Direction;
}

/** Al pisar el tile (x, y) se viaja al mapa `to`, apareciendo en el spawn `spawn`. */
export interface MapWarp {
  x: number;
  y: number;
  to: string;
  spawn: string;
  /** Condición opcional (ver Conditions). Si no se cumple, se dispara `blockedDialogue`. */
  if?: Condition;
  blockedDialogue?: string;
}

/** Zona que dispara un evento al entrar en ella. */
export interface MapTrigger extends TileRect {
  id: string;
  event: string;
  /** Si es true, solo se dispara una vez por partida. */
  once?: boolean;
  if?: Condition;
}

/** Texto decorativo fijo en el mundo (letreros). */
export interface MapLabel {
  x: number;
  y: number;
  text: string;
  color?: string;
}

/** Rectángulo donde se para gente de relleno (ver `MapCrowd`). */
export interface CrowdArea extends TileRect {
  /** Cuántas personas de pie poner en el área (si caben sin tapar el paso). */
  count: number;
  /** Hacia dónde miran casi siempre (por defecto, a cualquier lado). */
  dir?: Direction;
}

/** Gente de relleno del mapa: pasajeros en los asientos y de pie en las áreas. */
export interface MapCrowd {
  /** Grupo de frases de `src/data/crowd.json` → `lines` que dicen al hablarles. */
  lines: string;
  /** Fracción (0 a 1) de asientos ocupados. Siempre quedan algunos libres para el jugador. */
  seats?: number;
  areas?: CrowdArea[];
}

/**
 * Al entrar al mapa (cada vez que aparece el jugador) se abre `dialogue` si se cumple `if`.
 * Sirve para ajustar el reloj de la misión o para escenas al llegar. `once`: una vez por partida.
 */
export interface MapEnter {
  id: string;
  dialogue: string;
  if?: Condition;
  once?: boolean;
}

export interface MapData {
  id: string;
  name: string;
  kind: 'overworld' | 'interior';
  tileSize: number;
  width: number;
  height: number;
  /** Caracter → clave de tile (ver src/art/tiles.ts). "edificio" y "edificio:<estilo>" son autotiles. */
  legend: Record<string, string>;
  rows: string[];
  background?: string;
  zones?: MapZone[];
  spawns: Record<string, MapSpawn>;
  warps?: MapWarp[];
  triggers?: MapTrigger[];
  labels?: MapLabel[];
  crowd?: MapCrowd;
  enter?: MapEnter[];
  /** Pista de música (por defecto: calle en exteriores, estación en interiores). */
  music?: MusicTrack;
  /** Guirnaldas de ampolletas que brillan de noche (rooftop): de (x, y) a lo ancho de `w` tiles. */
  lights?: Array<{ x: number; y: number; w: number }>;
  /** Mapa en lo alto de un edificio: la ciudad de abajo (`vista_ciudad`) se mueve y sopla el viento. */
  skyline?: boolean;
  /** Ciudad del mapa: en Cali el tráfico lleva taxis amarillos y la gente dice otras cosas. Por defecto, Santiago. */
  region?: 'cali';
  /** Animales que aparecen en lugares al azar cada vez que se entra al mapa (los pavos reales del campus). */
  fauna?: MapFauna[];
}

export interface MapFauna {
  /** Personaje de sprites.json → characters. */
  sprite: string;
  /** Hoja alternativa que se muestra de vez en cuando (el pavo real con la cola abierta). */
  display?: string;
  count: number;
  dialogue: string;
  /** Dónde pueden aparecer (sobre tiles caminables de `tiles`). */
  area: TileRect;
  tiles: string[];
  /** Radio (en tiles) en que deambula desde donde apareció. */
  wander?: number;
  /** Efecto de sonido cuando abre la cola (si el jugador está cerca). */
  sfx?: SfxName;
}
