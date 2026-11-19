import { playSfx } from '../audio/sfx';
import { EventSystem } from './EventSystem';
import { STORAGE_KEYS } from './storageKeys';
import { StoryState } from './StoryState';

/**
 * Nivel de química con Sira y con Laura, entre misiones.
 *
 * Los medidores de corazones (ui/QuimicaMeter.ts) se reinician con cada misión, pero el vínculo no: cuando
 * en una misión llenas los corazones de alguien, sube de nivel y el nivel se queda para siempre (como el
 * Progreso, vive aparte de las partidas). Cada misión con esa persona se puede "llenar" una sola vez, así
 * que repetirla no sube más el nivel.
 *
 * El nivel llega a la historia como flags `qlvl_<quien>_<n>` (qlvl_sira_2, qlvl_laura_3...): con ellas un diálogo
 * puede mostrar algo extra a quien ya se conoce mejor. Se ponen al empezar cada misión y apenas se sube.
 */

export type Person = 'sira' | 'laura';
export const PEOPLE: readonly Person[] = ['sira', 'laura'];
export const PERSON_NAME: Record<Person, string> = { sira: 'Sira', laura: 'Laura' };
/** Nivel más alto (el 1 es el de partida). */
export const MAX_LEVEL = 4;

/** Dato guardado: las misiones cuyo medidor ya se llenó, por persona. */
type Stored = Record<Person, string[]>;

export const levelFlag = (who: Person, level: number): string => `qlvl_${who}_${level}`;

/** Nivel según cuántas misiones se llenaron (1 sin ninguna). */
export function levelFor(filled: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.max(0, filled));
}

class ChemistryImpl {
  private data: Stored = read();

  level(who: Person): number {
    return levelFor(this.data[who].length);
  }

  /** Ya se llenó el medidor de `who` en esa misión (en alguna partida). */
  isFilled(who: Person, mission: string): boolean {
    return this.data[who].includes(mission);
  }

  /**
   * El medidor de `who` llegó al tope en la misión en curso. Sube el nivel si es la primera vez en
   * esta misión. `announce` avisa en pantalla (no al cargar una partida que ya lo tenía).
   */
  reachFull(who: Person, mission: string, announce = true): boolean {
    if (this.isFilled(who, mission)) return false;
    this.data[who].push(mission);
    this.save();
    this.syncFlags();
    const level = this.level(who);
    if (announce && level > 1) {
      playSfx('complete');
      EventSystem.emit('banner', { title: `¡Química con ${PERSON_NAME[who]}: nivel ${level}!`, subtitle: 'Se queda para las próximas misiones' });
    }
    return true;
  }

  /** Pone en la partida las flags de nivel (al empezar una misión, al cargar y al subir). */
  syncFlags(): void {
    for (const who of PEOPLE) {
      for (let n = 2; n <= MAX_LEVEL; n++) StoryState.setFlag(levelFlag(who, n), n <= this.level(who));
    }
  }

  /** Vuelve a leer lo guardado (los tests parten de cero). */
  reload(): void {
    this.data = read();
  }

  private save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEYS.chemistry, JSON.stringify(this.data));
    } catch {
      // Sin almacenamiento: dura esta sesión.
    }
  }
}

/** Lo guardado → solo listas de textos; lo roto queda vacío. */
export function parseChemistry(raw: unknown): Stored {
  const d = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const list = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && /^mission\d+$/.test(x)))] : []);
  return { sira: list(d.sira), laura: list(d.laura) };
}

function read(): Stored {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.chemistry);
    return parseChemistry(raw ? JSON.parse(raw) : null);
  } catch {
    return parseChemistry(null);
  }
}

export const Chemistry = new ChemistryImpl();
