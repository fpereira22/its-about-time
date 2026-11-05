import Phaser from 'phaser';
import { characterLook, ensureCharacterTexture } from '../art/SpriteRegistry';
import type { HumanLook } from '../art/characters';
import type { Outfit } from '../types/story';
import { Secrets } from './Secrets';
import { StoryState } from './StoryState';

/** Flags que cambian cómo se ve el jugador (las pone la historia). */
export const FLAG_PAJAMA = 'en_pijama';
export const FLAG_NO_BACKPACK = 'sin_mochila';
/** En traje de baño (misión 5, las piscinas): el de llamas que presta Grover. */
export const FLAG_SWIM = 'en_bano';
/** El traje de baño azul de Grover (las llamitas se ven en las viñetas). */
export const SWIM_TRUNKS = '#2f6fd0';

export interface HatOption {
  id: string;
  label: string;
  hairStyle: NonNullable<HumanLook['hairStyle']>;
  cap?: string;
  /** Solo aparece en el ropero con esta flag (los cortes de la Barbería 360, misión 5). */
  flag?: string;
}

export interface ColorOption {
  label: string;
  hex: string;
  /** Solo aparece en el ropero si tienes este ítem (ej. la polera de la universidad). */
  item?: string;
}

/** Peinados y gorros del ropero. */
export const HATS: HatOption[] = [
  { id: 'gorro_azul', label: 'Jockey azul', hairStyle: 'cap', cap: '#2f6fd0' },
  { id: 'gorro_rojo', label: 'Jockey rojo', hairStyle: 'cap', cap: '#d04848' },
  { id: 'gorro_negro', label: 'Jockey negro', hairStyle: 'cap', cap: '#2a2a38' },
  { id: 'gorro_verde', label: 'Jockey verde', hairStyle: 'cap', cap: '#3c9c5c' },
  { id: 'pelo_corto', label: 'Pelo corto', hairStyle: 'short' },
  { id: 'pelo_largo', label: 'Pelo largo', hairStyle: 'long' },
  { id: 'tomate', label: 'Tomate', hairStyle: 'bun' },
  { id: 'degradado', label: 'Degradado 360', hairStyle: 'fade', flag: 'corte_degradado' },
  { id: 'rapado', label: 'Rapado', hairStyle: 'bald', flag: 'corte_rapado' },
  { id: 'mullet', label: 'Mullet (el Grover)', hairStyle: 'mullet', flag: 'corte_mullet' },
];

/** Los peinados del ropero (los cortes de pelo, solo si te los hiciste). */
export function availableHats(): HatOption[] {
  return HATS.filter((h) => !h.flag || StoryState.hasFlag(h.flag));
}

export const SHIRTS: ColorOption[] = [
  { label: 'Roja', hex: '#e05050' },
  { label: 'Azul', hex: '#3c6cd0' },
  { label: 'Verde', hex: '#48a858' },
  { label: 'Amarilla', hex: '#f0c030' },
  { label: 'Blanca', hex: '#f0f0f8' },
  { label: 'Negra', hex: '#2a2a34' },
  { label: 'Morada', hex: '#9c6cb8' },
  { label: 'Naranja', hex: '#e88838' },
  { label: 'Azul PUCC', hex: '#2050a8', item: 'polera_pucc' },
];

/** Las poleras que hay en el ropero (las de ítem, solo si las tienes). */
export function availableShirts(): ColorOption[] {
  return SHIRTS.filter((s) => !s.item || StoryState.hasItem(s.item));
}

export const PANTS: ColorOption[] = [
  { label: 'Jeans', hex: '#3a4a78' },
  { label: 'Negro', hex: '#26262e' },
  { label: 'Beige', hex: '#c8b088' },
  { label: 'Gris', hex: '#6a6c78' },
  { label: 'Verde oliva', hex: '#5a6a3c' },
  { label: 'Café', hex: '#6a4a30' },
];

export const SHOES: ColorOption[] = [
  { label: 'Negras', hex: '#303038' },
  { label: 'Blancas', hex: '#e8e8e0' },
  { label: 'Rojas', hex: '#c83838' },
  { label: 'Azules', hex: '#2f5fb0' },
  { label: 'Café', hex: '#7a5030' },
];

/** La ropa con que parte cada partida (la del jugador en sprites.json). */
export const DEFAULT_OUTFIT: Outfit = {
  hat: 'gorro_azul',
  shirt: '#e05050',
  pants: '#3a4a78',
  shoes: '#303038',
  glasses: false,
};

const PAJAMA = { shirt: '#9cc0e8', pants: '#7a98c8' };

/** Ropa actual del jugador (la elegida en el ropero, o la de siempre). */
export function currentOutfit(): Outfit {
  return { ...DEFAULT_OUTFIT, ...(StoryState.outfit ?? {}) };
}

/** Aspecto completo del jugador según su ropa, el pijama, la mochila y el código Konami. */
export function playerLook(outfit: Outfit = currentOutfit(), context = true): HumanLook {
  const base = characterLook('player') as HumanLook;
  const pajama = context && StoryState.hasFlag(FLAG_PAJAMA);
  if (context && !pajama && Secrets.konamiActive()) return characterLook('player_dorado') as HumanLook;
  const hat = HATS.find((h) => h.id === outfit.hat) ?? HATS[0];
  const extras: NonNullable<HumanLook['extras']> = [];
  if (!pajama && !(context && StoryState.hasFlag(FLAG_NO_BACKPACK))) extras.push('backpack');
  if (outfit.glasses) extras.push('glasses');
  if (context && !pajama && StoryState.hasFlag(FLAG_SWIM)) {
    // Sin polera ni zapatillas: piel, el traje de baño y el pelo (el jockey queda en el locker).
    const hair = hat.hairStyle === 'cap' ? 'short' : hat.hairStyle;
    return { ...base, shirt: base.skin, pants: SWIM_TRUNKS, shoes: base.skin, hairStyle: hair, cap: undefined, extras: outfit.glasses ? ['glasses'] : [] };
  }
  return {
    ...base,
    shirt: pajama ? PAJAMA.shirt : outfit.shirt,
    pants: pajama ? PAJAMA.pants : outfit.pants,
    // Descalzo en pijama.
    shoes: pajama ? base.skin : outfit.shoes,
    hairStyle: pajama ? 'short' : hat.hairStyle,
    cap: hat.cap,
    extras,
  };
}

/** Textura (hoja de personaje) para un aspecto: se genera la primera vez y se reutiliza. */
export function lookTexture(scene: Phaser.Scene, look: HumanLook): string {
  const key = `char:player~${JSON.stringify(look)}`;
  ensureCharacterTexture(scene.textures, key, look);
  return key;
}

/** Textura del jugador tal como se ve ahora. */
export function playerTexture(scene: Phaser.Scene): string {
  return lookTexture(scene, playerLook());
}
