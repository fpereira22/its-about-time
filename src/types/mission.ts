import type { Condition } from './story';

export interface MapRef {
  map: string;
  spawn: string;
}

export interface RideStop {
  name: string;
  /** Dónde aparece el jugador si se baja en esta parada. */
  exit: MapRef;
  /** Bajarse aquí cuenta como llegar "en el vehículo" (no se marca `bajo_antes`). */
  final?: boolean;
  /** Solo metro: cuánto rato quedan abiertas las puertas en esta parada (si no, `doorsMs` del viaje). */
  doorsMs?: number;
  /** Hora a la que llega a esta parada (reloj de la historia): el reloj avanza hasta ella durante el tramo. */
  clock?: string;
  /** En vez de `clock`: cuántos minutos avanza el reloj en el tramo hasta esta parada (viajes a cualquier hora). */
  minutes?: number;
  /** Metro: diálogo que se abre al abrirse las puertas en esta parada (el chat con alguien, un vendedor que sube...). */
  dialogue?: string;
}

/**
 * Viaje en metro o micro (src/data/rides.json).
 * - metro: en cada estación se abren las puertas; el jugador se baja interactuando con una puerta.
 * - micro: el jugador toca el timbre; la micro para en la siguiente parada y se baja solo.
 */
export interface RideDef {
  type: 'metro' | 'micro';
  map: string;
  spawn: string;
  /** Texto secundario de los carteles (ej. "Línea 1 · Dir. Los Dominicos"). */
  line: string;
  /** Estación donde se sube (letrero LED). Por defecto, la de metro_l1.json → `here`. */
  origin?: string;
  /** Color de la línea en el letrero LED (por defecto, el rojo de la Línea 1). */
  color?: string;
  /** Cómo se llama el lugar en el HUD durante el viaje (por defecto «En metro» o «En micro»). */
  place?: string;
  /** Cartel grande con el nombre de cada estación al llegar (en el metro basta el letrero LED). */
  announce?: boolean;
  /** Hora de salida (reloj de la historia): si el jugador sube antes, se espera con las puertas abiertas. */
  departAt?: string;
  /** Diálogo al empezar el viaje (opcional). */
  startDialogue?: string;
  travelMs: number;
  /** Solo metro: cuánto rato quedan abiertas las puertas. */
  doorsMs?: number;
  stops: RideStop[];
  /**
   * Si el jugador no se bajó en ninguna parada: se muestra `banner`, se viaja un tramo más,
   * se abre `dialogue` y se lo deja en `exit`. `walked`: termina caminando (ruta "+ a pie").
   */
  end: { banner: string; dialogue: string; exit: MapRef; walked?: boolean };
}

export interface RouteDef {
  id: string;
  name: string;
  if?: Condition;
}

export interface MissionDestination {
  map: string;
  x: number;
  y: number;
  name: string;
  /** Con varios destinos (`destinations`), se usa el primero cuya condición se cumple. */
  if?: Condition;
}

export interface MissionDef {
  id: string;
  /** Número que se muestra en el título ("Misión 2"). */
  number: number;
  title: string;
  start: MapRef;
  introDialogue?: string;
  objective: string;
  /** Plata en efectivo al empezar (por defecto START_MONEY). */
  startMoney?: number;
  /** Flags con que parte la misión (ej. el jugador sin mochila). */
  startFlags?: string[];
  /**
   * Reloj de la historia (hora del día) en vez del cronómetro: "dom 21:00".
   * Avanza solo, pero nunca pasa del tope que fijan los efectos `clock` (ver README).
   */
  clock?: string;
  /** Clima al empezar (misión 4). Con clima, el HUD muestra el tiempo y la temperatura en vez del saldo Bip!. */
  weather?: 'despejado' | 'nublado' | 'lluvia' | 'tormenta';
  /** Lugar al que guía el mapa del celular (tile en un mapa exterior). */
  destination?: MissionDestination;
  /** Destinos por etapa: el primero cuya condición se cumple (si ninguno, `destination`). */
  destinations?: MissionDestination[];
  /** Evento de historia (story) que completa la misión. */
  victoryEvent: string;
  /** Medios de transporte usados; se muestran todos los que cumplen su condición (o `defaultRoute`). */
  routes: RouteDef[];
  defaultRoute: string;
  /** Sufijo de ruta si el jugador terminó caminando (ej. se bajó antes). */
  walkedSuffix: { if: Condition; text: string };
  collectibles: string[];
  /** Logros extra que se muestran en la pantalla final. */
  bonuses: Array<{ text: string; if: Condition }>;
  /** Easter eggs: se cuentan como encontrados cuando su flag está activa. */
  secrets: Array<{ flag: string; name: string }>;
  /** Finales alternativos: al completar la misión se anota el primero cuya condición se cumple. */
  endings?: Array<{ id: string; name: string; if?: Condition }>;
}

/** Estado de un viaje en curso, para la pantalla de recorrido del vagón (evento 'ride-progress'). */
export interface RideProgress {
  type: 'metro' | 'micro';
  line: string;
  /** Nombres de las paradas del viaje, en orden. */
  stops: string[];
  /** Estación donde se subió el jugador (ver RideDef.origin). */
  origin?: string;
  /** Color de la línea (ver RideDef.color). */
  color?: string;
  /** Índice de la parada actual o próxima en `stops` (-1 antes de partir). */
  index: number;
  /** moving: viajando hacia stops[index]; stopped: detenido en stops[index]; end: el viaje terminó. */
  state: 'moving' | 'stopped' | 'end';
}
