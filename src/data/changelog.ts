/**
 * Novedades de cada actualización, la más nueva primero. El título las muestra una sola vez por
 * jugador (src/systems/News.ts, src/ui/NewsCard.ts).
 *
 * Al hacer un commit con cambios que el jugador note: súmale arriba una entrada con un `id` nuevo
 * (la fecha, y una letra si hay más de una el mismo día).
 *
 * Cómo se escribe (es lo que lee el jugador, no un registro técnico):
 * - Solo mejoras, en lenguaje humano y a grandes rasgos. Nada de nombres de archivos, sistemas ni detalles.
 * - Sin spoilers: di de qué trata lo nuevo, no lo que pasa. Ej.: "Nueva misión 12: Laura vuelve a
 *   Cali", no cómo termina ni qué se descubre.
 * - Una cosa por línea, corta. Una misión o minijuego nuevo es UNA línea, no una por cada parte.
 * - Lo que no se nota jugando (tests, refactors, modo admin) no va.
 */
export interface NewsEntry {
  /** Único y estable: es lo que se guarda para no volver a mostrarlo. */
  id: string;
  /** AAAA-MM-DD. */
  date: string;
  /** Lo nuevo, de a una cosa por línea (máx. NEWS_MAX_ITEMS líneas de NEWS_MAX_ITEM_CHARS letras: la tarjeta es chica). */
  items: string[];
}

export const NEWS_MAX_ITEMS = 3;
export const NEWS_MAX_ITEM_CHARS = 46;

export const CHANGELOG: readonly NewsEntry[] = [
  {
    id: '2026-11-19',
    date: '2026-11-19',
    items: [
      'Nuevo: puedes jugar pimpón con la cámara.',
      'Más fluido en celulares con lluvia y clima.',
    ],
  },
];
