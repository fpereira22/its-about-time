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
  /** Nivel de química con Sira y Laura (ver Chemistry): sigue entre partidas. */
  chemistry: 'santiago-laberinto:chemistry',
  /** Mensajes del celular de misiones anteriores (ver ChatLog): sigue entre partidas. */
  chatlog: 'santiago-laberinto:chatlog',
  /** Viñetas vistas y minijuegos jugados para la Galería (ver Gallery): sigue entre partidas. */
  gallery: 'santiago-laberinto:gallery',
  konami: 'santiago-laberinto:konami',
  snakeBest: 'santiago-laberinto:culebrita',
  rankingPlayer: 'santiago-laberinto:ranking-player',
  /** Estado del respaldo en la nube (qué se subió por última vez). No se respalda. */
  cloud: 'santiago-laberinto:cloud',
  /** Contador de visitas para los datos de uso. No se respalda. */
  usage: 'santiago-laberinto:usage',
  /** Última novedad que se le mostró al jugador (ver News). No se respalda: cada dispositivo la ve una vez. */
  news: 'santiago-laberinto:news',
} as const;
