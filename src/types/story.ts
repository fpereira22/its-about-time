import type { SfxName } from '../audio/sfx';
import type { Direction } from './map';

/**
 * Condición sobre el estado de la historia. Todos los campos presentes deben cumplirse (AND).
 * Usa `any` para OR y `not` para negar.
 */
export interface Condition {
  flag?: string | string[];
  notFlag?: string | string[];
  hasItem?: string | string[];
  notItem?: string | string[];
  minMoney?: number;
  minBip?: number;
  /** Solo en esta misión (o una de estas): id de missions/*.json. Sirve en mapas que comparten varias misiones. */
  mission?: string | string[];
  /** Solo si el jugador está en este mapa (o uno de estos): el celular guía a otro destino según dónde estés. */
  map?: string | string[];
  any?: Condition[];
  all?: Condition[];
  not?: Condition;
}

/** Efecto que modifica el estado o el mundo. Cada objeto lleva exactamente una clave de acción. */
export type Effect =
  | { setFlag: string | string[] }
  | { clearFlag: string | string[] }
  | { giveItem: string; qty?: number; silent?: boolean }
  | { takeItem: string; qty?: number }
  | { giveMoney: number }
  | { pay: number }
  | { chargeBip: number }
  | { payBip: number }
  | { warp: { map: string; spawn: string } }
  | { startScene: string; data?: Record<string, unknown> }
  | { event: string; data?: unknown }
  | { objective: string }
  | { addTime: number }
  | { sfx: SfxName }
  | { message: string }
  | { call: string }
  /** Reloj de la historia: fija la hora ("lun 07:15", o "07:15" = mismo día) y opcionalmente el tope. */
  | { clock: string; max?: string }
  /** Sube (o baja) el tope del reloj de la historia sin cambiar la hora. */
  | { clockMax: string }
  /** Adelanta el reloj de la historia `n` minutos (una conversación larga en el rooftop). */
  | { clockAdd: number }
  /** Carnet en pantalla (controles migratorios): mostrar, marcar la foto, timbrar (id del timbre) o guardar. */
  | { doc: 'show' | 'focus' | 'stamp' | 'hide'; id?: string }
  /** Pantalla de vuelos dibujada mientras dure el diálogo (id de src/ui/FlightBoard.ts, "" la cierra). */
  | { board: string }
  /** Viñeta 2D sobre el juego mientras dure el diálogo: abrazos o el dibujo del hermano ("" la cierra). */
  | { vineta: string }
  /** Cartel dibujado mientras dure el diálogo (id de src/ui/SignView.ts, "" lo cierra). En la prueba, `step` marca la pregunta. */
  | { sign: string; step?: number }
  /** Marca la pregunta actual de la pizarra de la prueba como buena o mala. */
  | { signMark: 'ok' | 'bad' }
  /** Clima de la historia (misión 4): despejado, nublado, lluvia o tormenta. */
  | { weather: 'despejado' | 'nublado' | 'lluvia' | 'tormenta' }
  /** Cambia parte de la ropa del jugador (ej. ponerse la polera de la universidad). */
  | { outfit: Partial<Outfit> };

export interface DialogueChoice {
  label: string;
  if?: Condition;
  effects?: Effect[];
  goto?: string;
}

export interface DialogueBranch {
  if?: Condition;
  goto: string;
}

/**
 * Nodo de diálogo.
 * - Con `branches` y sin `text`: nodo enrutador (va al primer branch cuya condición se cumple).
 * - Con `text`: muestra el texto (string o páginas). Al terminar muestra `choices`, o va a `next`, o cierra.
 */
export interface DialogueNode {
  speaker?: string;
  text?: string | string[];
  branches?: DialogueBranch[];
  effects?: Effect[];
  choices?: DialogueChoice[];
  next?: string;
}

export interface DialogueTree {
  start: string;
  nodes: Record<string, DialogueNode>;
}

/** Archivo de diálogos: id del diálogo → árbol. */
export type DialogueFile = Record<string, DialogueTree>;

export interface ItemDef {
  name: string;
  description: string;
  /** Id de objeto en sprites.json usado como ícono. */
  icon: string;
  collectible?: boolean;
  /** Id de diálogo que se abre al usar el ítem desde el inventario (Tab). Sin `use`, no se puede usar. */
  use?: string;
  /** Texto de la acción en el inventario (por defecto "Usar"), ej. "Comer", "Leer". */
  useLabel?: string;
  /** Sonido que suena si el ítem se consumió al usarlo (ej. "eat"). */
  useSfx?: SfxName;
}

export interface NpcDef {
  id: string;
  map: string;
  x: number;
  y: number;
  dir?: Direction;
  /** Personaje de sprites.json → characters. */
  sprite?: string;
  /** Objeto de sprites.json → objects (no gira ni camina). */
  object?: string;
  dialogue: string;
  /** Solo existe en el mapa si la condición se cumple. */
  if?: Condition;
  /** Radio (en tiles) en que deambula. 0 o ausente = quieto. */
  wander?: number;
  /** Si es false se puede caminar a través (ej. un letrero en el suelo). */
  solid?: boolean;
}

/** Ropa elegida en el ropero (valores de las listas de src/systems/PlayerLook.ts). */
export interface Outfit {
  /** Id del peinado o gorro (ej. "gorro_azul", "pelo_largo"). */
  hat: string;
  shirt: string;
  pants: string;
  shoes: string;
  glasses: boolean;
}
