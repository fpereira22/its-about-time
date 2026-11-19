import { CHANGELOG, NEWS_MAX_ITEMS, type NewsEntry } from '../data/changelog';
import { STORAGE_KEYS } from './storageKeys';

/** Lo que muestra el aviso de novedades. */
export interface NewsView {
  /** Id de la entrada más nueva: lo que se guarda al mostrarlo. */
  id: string;
  date: string;
  items: string[];
}

/**
 * Entradas que el jugador aún no vio, de la más nueva a la más vieja. Sin registro (o con uno que ya
 * no existe en la lista) solo cuenta la última: nadie necesita el historial entero de golpe.
 */
export function unseenEntries(entries: readonly NewsEntry[], seenId: string | null): NewsEntry[] {
  if (entries.length === 0) return [];
  const at = seenId === null ? -1 : entries.findIndex((e) => e.id === seenId);
  return at === -1 ? [entries[0]] : entries.slice(0, at);
}

/** Junta lo pendiente en un solo aviso: la fecha de lo más nuevo y las líneas de todos, hasta el tope. */
export function buildNews(entries: readonly NewsEntry[], seenId: string | null): NewsView | null {
  const unseen = unseenEntries(entries, seenId);
  if (unseen.length === 0) return null;
  const [latest] = unseen;
  return { id: latest.id, date: latest.date, items: unseen.flatMap((e) => e.items).slice(0, NEWS_MAX_ITEMS) };
}

/** Lo ya mostrado en esta sesión: cubre un navegador sin almacenamiento (si no, saldría en cada vuelta al título). */
let shownInSession: string | null = null;
/** Modo admin: la próxima vez que el título pregunte, mostrar la última novedad aunque ya se haya visto. */
let previewNext = false;

function readSeen(): string | null {
  if (shownInSession) return shownInSession;
  try {
    return window.localStorage.getItem(STORAGE_KEYS.news);
  } catch {
    return null;
  }
}

function writeSeen(id: string): void {
  shownInSession = id;
  try {
    window.localStorage.setItem(STORAGE_KEYS.news, id);
  } catch {
    // Sin almacenamiento: queda solo en memoria.
  }
}

/**
 * Novedades de cada actualización: se muestran una vez, en el título. Quien abre el juego por primera
 * vez (sin partida ni progreso) no ve nada: para esa persona todo es nuevo, no hay "novedades".
 */
export const News = {
  /** El aviso que toca mostrar ahora (y queda registrado como visto), o `null`. */
  take(hasProgress: boolean, entries: readonly NewsEntry[] = CHANGELOG): NewsView | null {
    if (previewNext) {
      // Prueba del admin: no toca lo guardado, así que el jugador real igual la verá la primera vez.
      previewNext = false;
      return buildNews(entries, null);
    }
    const seen = readSeen();
    if (seen === null && !hasProgress) {
      if (entries[0]) writeSeen(entries[0].id);
      return null;
    }
    const view = buildNews(entries, seen);
    if (view) writeSeen(view.id);
    return view;
  },

  /** Para probar la tarjeta (selector de etapas del admin): el título la muestra la próxima vez, sin registrarla como vista. */
  preview(): void {
    previewNext = true;
  },

  /** Los tests parten de cero. */
  reset(): void {
    shownInSession = null;
    previewNext = false;
  },
};
