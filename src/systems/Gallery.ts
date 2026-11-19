import { STORAGE_KEYS } from './storageKeys';

/**
 * Lo que el jugador ya vio y jugó, para la Galería (Progreso → E): las viñetas en el orden en que salieron y los
 * minijuegos terminados. Vive en su propia clave (sobrevive a las partidas nuevas, como el Progreso) y va en el
 * respaldo en la nube.
 */

export interface SeenVineta {
  id: string;
  /** Misión en que se vio por primera vez. */
  mission: string;
}

interface Stored {
  vinetas: SeenVineta[];
  played: string[];
}

const MISSION_ID = /^mission\d+$/;

/** Lo guardado → solo entradas válidas y sin repetir. */
export function parseGallery(raw: unknown): Stored {
  const d = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const seen = new Set<string>();
  const vinetas: SeenVineta[] = [];
  for (const v of Array.isArray(d.vinetas) ? (d.vinetas as Array<Partial<SeenVineta> | null>) : []) {
    if (!v || typeof v.id !== 'string' || v.id === '' || seen.has(v.id)) continue;
    seen.add(v.id);
    vinetas.push({ id: v.id, mission: typeof v.mission === 'string' && MISSION_ID.test(v.mission) ? v.mission : '' });
  }
  const played = [...new Set((Array.isArray(d.played) ? d.played : []).filter((x): x is string => typeof x === 'string' && x !== ''))];
  return { vinetas, played };
}

class GalleryImpl {
  private data: Stored = read();

  /** Anota una viñeta vista (solo en partidas de misión: el modo libre y las vistas previas no cuentan). */
  seeVineta(id: string, mission: string): void {
    if (!MISSION_ID.test(mission) || this.data.vinetas.some((v) => v.id === id)) return;
    this.data.vinetas.push({ id, mission });
    this.save();
  }

  /** Anota un minijuego terminado (id de minigameId en data/gallery.ts). */
  markPlayed(id: string, mission: string): void {
    if (!MISSION_ID.test(mission) || this.data.played.includes(id)) return;
    this.data.played.push(id);
    this.save();
  }

  get vinetas(): readonly SeenVineta[] {
    return this.data.vinetas;
  }

  hasPlayed(id: string): boolean {
    return this.data.played.includes(id);
  }

  reload(): void {
    this.data = read();
  }

  private save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEYS.gallery, JSON.stringify(this.data));
    } catch {
      // Sin almacenamiento: dura esta sesión.
    }
  }
}

function read(): Stored {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.gallery);
    return parseGallery(raw ? JSON.parse(raw) : null);
  } catch {
    return parseGallery(null);
  }
}

export const Gallery = new GalleryImpl();
