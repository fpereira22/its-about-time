/**
 * Claves de localStorage del juego, en un solo lugar: el respaldo en la nube (CloudSave) sube y baja
 * justamente estas. Una clave nueva que guarde progreso del jugador va acá y en las partes de CloudSave.
 */
export const STORAGE_KEYS = {
  save: 'santiago-laberinto:save',
  slots: 'santiago-laberinto:slots',
  records: 'santiago-laberinto:records',
  skills: 'santiago-laberinto:skills',
  settings: 'santiago-laberinto:settings',
  konami: 'santiago-laberinto:konami',
  snakeBest: 'santiago-laberinto:culebrita',
  rankingPlayer: 'santiago-laberinto:ranking-player',
  /** Estado del respaldo en la nube (qué se subió por última vez). No se respalda. */
  cloud: 'santiago-laberinto:cloud',
  /** Contador de visitas para los datos de uso. No se respalda. */
  usage: 'santiago-laberinto:usage',
} as const;
