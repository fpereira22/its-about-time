import { playMusic, playSfx, type MusicTrack } from '../audio/sfx';
import type { FutbolResult } from '../scenes/FutbolScene';
import { TILE } from '../config/display';
import trayectosData from '../data/trayectos.json';
import type { Direction } from '../types/map';
import { Dialogue } from './DialogueManager';
import { EventSystem } from './EventSystem';
import { advanceClock, formatClock, parseClock } from './Mission';
import { StoryState } from './StoryState';
import { M5_SCRIPTS } from './StoryScripts5';
import { M6_SCRIPTS } from './StoryScripts6';
import { M7_SCRIPTS } from './StoryScripts7';
import { M8_SCRIPTS } from './StoryScripts8';

/** Lo que un script puede hacer con la escena de mapa activa (lo implementa MapScene). */
export interface ScriptHost {
  readonly mapWidthPx: number;
  setLocked(locked: boolean): void;
  wait(ms: number): Promise<void>;
  say(dialogueId: string): Promise<void>;
  startRide(rideId: string): void;
  completeMission(): void;
  /** Viaja a otro mapa (con fade). */
  goTo(mapId: string, spawn: string): void;
  /** Funde a negro (out = true) o vuelve desde negro. */
  fade(out: boolean, ms?: number): Promise<void>;
  facePlayer(dir: Direction): void;
  /** Pone al jugador en un spawn del mapa actual (sentado si es un asiento o la cama). */
  placePlayer(spawnId: string): void;
  /** Mueve un vehículo de xFrom a xTo (px). Devuelve el sprite para seguir moviéndolo. */
  drive(opts: DriveOptions): Promise<Phaser.GameObjects.Container>;
  /** Abre o cierra las puertas animadas del vehículo. */
  vehicleDoors(vehicle: Phaser.GameObjects.Container, open: boolean): Promise<void>;
  /** Sacude la cámara (despegue, turbulencia, baches). */
  shake(ms: number, intensity?: number): void;
  /** Lágrimas que caen de la cara del jugador ("player") o de un NPC (por su id) durante `ms`. */
  cry(who: string, ms: number): void;
}

export interface DriveOptions {
  texture: string;
  label?: string;
  /** Fila de tile sobre la que se apoya el vehículo (su borde inferior). */
  bottomTileY: number;
  xFrom: number;
  xTo: number;
  ms: number;
  ease?: string;
  existing?: Phaser.GameObjects.Container;
  destroyAtEnd?: boolean;
  /** Calle norte-sur: x (px) del centro de la pista; entonces `xFrom`/`xTo` son la y del frente (abajo). */
  laneX?: number;
}

/**
 * Viaje "de película" (src/data/trayectos.json): el jugador va sentado y no se puede bajar.
 * Cada tramo muestra un cartel, avanza el reloj hasta `clock` y abre su diálogo.
 */
interface TrayectoLeg {
  title: string;
  subtitle?: string;
  ms: number;
  clock?: string;
  /** En vez de `clock`: cuántos minutos avanza el reloj en el tramo (viajes que se repiten a distintas horas). */
  minutes?: number;
  dialogue?: string;
}

interface Trayecto {
  music?: MusicTrack;
  /** Flag que se marca al llegar (sirve para no repetir el viaje al continuar la partida). */
  flag?: string;
  /** Flags que se borran al llegar (el bus de Cali: `bus_a_u` / `bus_a_casa`). */
  clear?: string[];
  legs: TrayectoLeg[];
  exit: { map: string; spawn: string };
}

const TRAYECTOS = trayectosData as Record<string, Trayecto>;

/** Lo que se puede meter en la maleta (misión 3): un problema de la mochila de verdad. */
const MALETA_MAX_KG = 23;
const MALETA: Array<{ id: string; name: string; kg: number }> = [
  { id: 'ropa', name: 'la ropa', kg: 9 },
  { id: 'zapatillas', name: 'las zapatillas', kg: 3 },
  { id: 'libros', name: 'los libros de Optimización', kg: 6 },
  { id: 'almohada', name: 'tu almohada', kg: 2 },
  { id: 'manjar', name: 'los tarros de manjar', kg: 2 },
  { id: 'neceser', name: 'el neceser', kg: 1 },
  { id: 'cargador', name: 'el cargador', kg: 1 },
];

/** Kilos que lleva la maleta (flags `maleta_<id>`). */
export function maletaKg(): number {
  return MALETA.filter((i) => StoryState.hasFlag(`maleta_${i.id}`)).reduce((kg, i) => kg + i.kg, 0);
}

/** Hora a la que empieza el embarque del vuelo a Cali. */
const BOARDING_AT = 'sáb 01:10';

/** Pisos del Costanera donde puede estar la mamá (cada uno tiene su NPC y su mensaje). */
const MOM_FLOORS = [2, 3, 5, 6];

type Script = (host: ScriptHost, data: Record<string, unknown>) => Promise<void> | void;

/** Lee y borra una flag temporal (las que el diálogo usa para responderle al script). */
function takeFlag(flag: string): boolean {
  const had = StoryState.hasFlag(flag);
  StoryState.setFlag(flag, false);
  return had;
}

/**
 * Scripts de eventos con nombre. Se disparan con el efecto `{ "event": "nombre", "data": {...} }`
 * en un diálogo o con un trigger del mapa.
 */
export const SCRIPTS: Record<string, Script> = {
  /** Esperar micro en el paradero: pasa una llena, luego llegan la 210 y la 411. */
  async micro_esperar(host, data) {
    const stopX = Number(data.x) * TILE + TILE / 2;
    const lane = Number(data.lane);
    const left = stopX - 260;
    const right = stopX + 260;
    host.setLocked(true);

    playSfx('bus-pass');
    await host.drive({ texture: 'micro_llena', label: '411', bottomTileY: lane, xFrom: left, xTo: right, ms: 1700, destroyAtEnd: true });
    await host.say('micro_pasa_llena');

    for (const [route, ride] of [
      ['210', 'micro_210'],
      ['411', 'micro_411'],
    ] as const) {
      playSfx('bus-brake');
      const bus = await host.drive({ texture: 'micro', label: route, bottomTileY: lane, xFrom: left, xTo: stopX - 4, ms: 1300, ease: 'Cubic.Out' });
      playSfx('bus-doors-open');
      await host.vehicleDoors(bus, true);
      Dialogue.vars.set('micro', route);
      await host.say('micro_llega');
      if (takeFlag('_subir')) {
        host.startRide(ride);
        return;
      }
      playSfx('bus-doors-close');
      await host.wait(700);
      await host.vehicleDoors(bus, false);
      await host.wait(350);
      playSfx('bus-pass');
      await host.drive({ texture: 'micro', bottomTileY: lane, xFrom: bus.x, xTo: right, ms: 1100, ease: 'Cubic.In', existing: bus, destroyAtEnd: true });
    }
    await host.say('micro_no_subio');
    host.setLocked(false);
  },

  /**
   * Esperar el tren en un andén. data: { ride, track (fila de la vía), dir: "right" | "left",
   * texture? (por defecto "tren"), arrive? (hora a la que llega: si es temprano, el reloj se adelanta) }
   */
  async metro_esperar_tren(host, data) {
    const ride = String(data.ride);
    const texture = String(data.texture ?? 'tren');
    const track = Number(data.track);
    const goingRight = data.dir !== 'left';
    const center = host.mapWidthPx / 2;
    const off = host.mapWidthPx / 2 + 200;
    host.setLocked(true);

    if (data.arrive) {
      const at = parseClock(String(data.arrive));
      if (StoryState.clock < at) {
        EventSystem.emit('banner', { title: 'Esperando el tren...', subtitle: `Llega a las ${formatClock(at)}` });
        await advanceClock(at, 2600, (ms) => host.wait(ms));
      }
    }

    playSfx('train-arrive');
    const train = await host.drive({
      texture,
      bottomTileY: track,
      xFrom: goingRight ? center - off : center + off,
      xTo: center,
      ms: 1600,
      ease: 'Cubic.Out',
    });
    playSfx('metro-doors-open');
    await host.vehicleDoors(train, true);
    await host.say('metro_tren_llega');
    if (takeFlag('_subir')) {
      host.startRide(ride);
      return;
    }
    playSfx('metro-doors-close');
    await host.wait(1250);
    await host.vehicleDoors(train, false);
    await host.wait(500);
    playSfx('train-depart');
    await host.drive({
      texture,
      bottomTileY: track,
      xFrom: train.x,
      xTo: goingRight ? center + off : center - off,
      ms: 1400,
      ease: 'Cubic.In',
      existing: train,
      destroyAtEnd: true,
    });
    host.setLocked(false);
  },

  /** Abre el mapa interactivo de la Línea 1 (muro de la estación). */
  mapa_linea() {
    EventSystem.emit('open-line-map');
  },

  /** Al entrar al Costanera: la mamá queda en un piso al azar y llama por teléfono (phone.json). */
  entrar_costanera() {
    StoryState.setFlag('entro_costanera');
    if (!MOM_FLOORS.some((n) => StoryState.hasFlag(`mama_piso_${n}`))) {
      StoryState.setFlag(`mama_piso_${MOM_FLOORS[Math.floor(Math.random() * MOM_FLOORS.length)]}`);
      StoryState.setObjective('Entra al Costanera y contesta el celular');
    }
  },

  start_ride(host, data) {
    host.startRide(String(data.ride));
  },

  // --- Misión 2 ---

  /** Abre el ropero para elegir la ropa. */
  ropero() {
    EventSystem.emit('open-wardrobe');
  },

  /** Funde a negro, muestra un diálogo (ducha, lavar la loza) y vuelve. data: { dialogue } */
  async fundido(host, data) {
    host.setLocked(true);
    await host.fade(true, 500);
    await host.say(String(data.dialogue));
    await host.wait(300);
    await host.fade(false, 500);
    host.setLocked(false);
  },

  /** Domingo en la noche: a dormir. Despierta el lunes a las 7:00 con la alarma. */
  async dormir(host) {
    host.setLocked(true);
    await host.fade(true, 900);
    await host.say('dormir_noche');
    host.placePlayer('cama');
    await host.wait(500);
    await host.fade(false, 900);
    await alarmLoop(host);
    host.setLocked(false);
  },

  // --- Misión 3 ---

  /** Viaje sentado de un lugar a otro (auto, furgón). data: { id } de trayectos.json */
  async trayecto(host, data) {
    const t = TRAYECTOS[String(data.id)];
    if (!t) {
      console.error(`Trayecto "${String(data.id)}" no existe en trayectos.json`);
      return;
    }
    host.setLocked(true);
    if (t.music) playMusic(t.music);
    for (const leg of t.legs) {
      EventSystem.emit('banner', { title: leg.title, subtitle: leg.subtitle });
      await travelLeg(host, leg.ms, leg.clock ?? (leg.minutes !== undefined ? StoryState.clock + leg.minutes : undefined));
      if (leg.dialogue) await host.say(leg.dialogue);
    }
    if (t.flag) StoryState.setFlag(t.flag);
    for (const f of t.clear ?? []) StoryState.setFlag(f, false);
    host.goTo(t.exit.map, t.exit.spawn);
  },

  /** Tu papá trae el auto a la puerta de la casa y parten al aeropuerto. */
  async auto_familia(host) {
    host.setLocked(true);
    playSfx('bus-brake');
    await host.drive({ texture: 'sedan_gris', bottomTileY: 7, xFrom: -40, xTo: 6 * TILE + TILE / 2, ms: 1800, ease: 'Cubic.Out' });
    await host.say('auto_subir');
    host.goTo('auto_familia', 'asiento');
  },

  /**
   * Armar la maleta: máximo 23 kilos. El diálogo `maleta_menu` marca `_meter_<id>`, `_vaciar_maleta`
   * o `_cerrar_maleta`; con 23 kilos exactos se gana el logro de la maleta óptima.
   */
  async maleta(host) {
    host.setLocked(true);
    for (;;) {
      Dialogue.vars.set('peso', String(maletaKg()));
      await host.say('maleta_menu');
      const item = MALETA.find((i) => takeFlag(`_meter_${i.id}`));
      if (item) {
        if (maletaKg() + item.kg > MALETA_MAX_KG) {
          Dialogue.vars.set('objeto', item.name);
          playSfx('error');
          await host.say('maleta_pesada');
        } else {
          StoryState.setFlag(`maleta_${item.id}`);
          if (item.id === 'manjar') StoryState.removeItem('manjar');
          playSfx('item');
        }
        continue;
      }
      if (takeFlag('_vaciar_maleta')) {
        for (const i of MALETA) {
          if (!StoryState.hasFlag(`maleta_${i.id}`)) continue;
          StoryState.setFlag(`maleta_${i.id}`, false);
          if (i.id === 'manjar') StoryState.addItem('manjar');
        }
        continue;
      }
      if (takeFlag('_cerrar_maleta')) {
        if (maletaKg() === MALETA_MAX_KG) StoryState.setFlag('maleta_optima');
        StoryState.setFlag('maleta_cerrada');
        StoryState.addItem('maleta');
        Dialogue.vars.set('peso', String(maletaKg()));
        playSfx('item');
        await host.say('maleta_cerrada');
      }
      break;
    }
    host.setLocked(false);
  },

  /** Check-in: la maleta a la balanza (el diálogo muestra los kilos con {peso}). */
  async pesar_maleta(host) {
    host.setLocked(true);
    Dialogue.vars.set('peso', String(maletaKg()));
    playSfx('bip');
    await host.wait(500);
    await host.say('checkin_balanza');
    host.setLocked(false);
  },

  /** Cinta 2 en Cali: minijuego con el mouse para encontrar tu maleta entre las que dan vueltas. */
  async cinta_maletas(host) {
    host.setLocked(true);
    const result = await new Promise<{ found: boolean; mistakes: number }>((done) =>
      EventSystem.emit('open-baggage-claim', { done }),
    );
    if (result.found) {
      if (result.mistakes >= 3) await host.say('cinta_porfiado');
      await host.say('cinta_encontrada');
    } else {
      await host.say('cinta_rendirse');
    }
    host.setLocked(false);
  },

  /** La despedida en el acceso a embarque internacional: abrazos, lágrimas y música triste. */
  async despedida(host) {
    host.setLocked(true);
    host.facePlayer('up');
    playMusic('despedida');
    await host.wait(600);
    await host.say('despedida_inicio');
    await host.say('despedida_papa');
    host.cry('m3_hermano_scl', 9000);
    await host.say('despedida_hermano');
    host.cry('m3_mama_scl', 30000);
    await host.say('despedida_mama');
    host.cry('player', 12000);
    await host.say('despedida_final');
    StoryState.setFlag('despedida');
    host.setLocked(false);
  },

  /** Sentado en la puerta D6: se espera hasta el embarque y llaman por grupos. */
  async esperar_embarque(host) {
    if (StoryState.hasFlag('embarcando')) return;
    host.setLocked(true);
    const at = parseClock(BOARDING_AT);
    if (StoryState.clock < at) {
      EventSystem.emit('banner', { title: 'Esperando el embarque...', subtitle: `Embarque a las ${formatClock(at)}` });
      await advanceClock(at, 3200, (ms) => host.wait(ms));
    }
    playSfx('anuncio');
    await host.wait(900);
    await host.say('embarque_llamado');
    host.setLocked(false);
  },

  /** Sentado en el 18A: despegue, la cordillera, la comida, la vecina de asiento, dormir y aterrizar en Cali. */
  async vuelo(host) {
    host.setLocked(true);
    StoryState.setFlag('en_vuelo');
    await host.say('vuelo_sentado');
    await host.say('vuelo_seguridad');
    EventSystem.emit('banner', { title: 'Despegue', subtitle: 'Santiago (SCL) → Cali (CLO)' });
    playSfx('avion');
    host.shake(3400, 0.004);
    await clockTo(host, 'sáb 02:00', 3400);
    playMusic('despedida');
    await host.say('vuelo_despegue');
    EventSystem.emit('banner', { title: 'Sobre la cordillera', subtitle: 'Altura de crucero · 11.000 metros' });
    await clockTo(host, 'sáb 02:40', 2400);
    playMusic('aeropuerto');
    await host.say('vuelo_cordillera');
    await clockTo(host, 'sáb 03:30', 2000);
    await host.say('vuelo_comida');
    await host.say('vuelo_vecina');
    EventSystem.emit('banner', { title: 'Turbulencia', subtitle: 'Abróchese el cinturón' });
    playSfx('chime');
    host.shake(2600, 0.006);
    await host.wait(1400);
    await host.say('vuelo_turbulencia');
    await host.fade(true, 1200);
    await host.say('vuelo_dormir');
    await clockTo(host, 'sáb 07:20', 2600);
    await host.fade(false, 1200);
    playSfx('anuncio');
    await host.say('vuelo_descenso');
    EventSystem.emit('banner', { title: 'Aterrizaje', subtitle: 'Cali · Aeropuerto Alfonso Bonilla Aragón' });
    playSfx('avion');
    host.shake(2200, 0.007);
    await host.wait(2600);
    StoryState.setFlag('aterrizo');
    await host.say('vuelo_aterrizaje');
    host.goTo('clo_llegadas', 'avion');
  },

  // --- Misión 4 ---

  /** Lunes 6:00 en Pance: la alarma, el desfase de las dos horas y (si pospones) doña Mery golpeando. */
  async despertar_cali(host) {
    host.setLocked(true);
    await host.wait(700);
    await ring(host);
    await host.say('m4_alarma');
    if (takeFlag('_posponer')) {
      StoryState.setFlag('pospuso_cali');
      await host.fade(true, 800);
      const at = StoryState.clock + 15;
      StoryState.setClock(at, at);
      await host.wait(900);
      await host.fade(false, 800);
      playSfx('door');
      await host.say('m4_mery_golpea');
    }
    await host.say('m4_desorientado');
    host.setLocked(false);
  },

  /**
   * Esperar el bus P27. data: { destino: "u" | "casa", lane?, x? } en una calle oriente-poniente (Pance)
   * o { laneX, y } en la Calle 18, que corre de norte a sur (y = fila donde frena el frente del bus).
   */
  async bus_cali(host, data) {
    const destino = String(data.destino);
    // La ruta del letrero (la P27 a la U; en la misión 6, el P47 a Universidades).
    const ruta = String(data.ruta ?? 'P27');
    host.setLocked(true);
    let bus: Phaser.GameObjects.Container | null = null;
    const stopX = Number(data.x ?? 0) * TILE + TILE / 2;
    const lane = data.lane === undefined ? undefined : Number(data.lane);
    const laneX = data.laneX === undefined ? undefined : Number(data.laneX) * TILE;
    const stopY = Number(data.y ?? 0) * TILE;
    EventSystem.emit('banner', { title: 'Esperando el bus...', subtitle: `Ruta ${ruta}` });
    await host.wait(900);
    StoryState.setClock(StoryState.clock + 4, Math.max(StoryState.clockMax, StoryState.clock + 4));
    if (lane !== undefined) {
      // Pance: viene del oriente por la pista norte (la de la vereda del paradero), hacia el poniente.
      playSfx('bus-brake');
      bus = await host.drive({ texture: 'bus_cali_izq', label: ruta, bottomTileY: lane, xFrom: stopX + 300, xTo: stopX + 4, ms: 1700, ease: 'Cubic.Out' });
      playSfx('bus-doors-open');
      await host.vehicleDoors(bus, true);
    } else if (laneX !== undefined) {
      // Calle 18: baja de norte a sur por la pista poniente y frena frente al paradero.
      playSfx('bus-brake');
      bus = await host.drive({ texture: 'bus_cali_v', bottomTileY: 0, laneX, xFrom: stopY - 260, xTo: stopY, ms: 1800, ease: 'Cubic.Out' });
      playSfx('bus-doors-open');
    }
    await host.say('bus_llega');
    if (takeFlag('_subir')) {
      StoryState.setFlag(`bus_a_${destino}`);
      StoryState.setFlag('tomo_bus');
      host.goTo('bus_cali', 'asiento');
      return;
    }
    if (bus && lane !== undefined) {
      playSfx('bus-doors-close');
      await host.vehicleDoors(bus, false);
      playSfx('bus-pass');
      await host.drive({ texture: 'bus_cali_izq', bottomTileY: lane, xFrom: bus.x, xTo: bus.x - 360, ms: 1300, ease: 'Cubic.In', existing: bus, destroyAtEnd: true });
    } else if (bus && laneX !== undefined) {
      playSfx('bus-pass');
      await host.drive({ texture: 'bus_cali_v', bottomTileY: 0, laneX, xFrom: bus.y, xTo: bus.y + 320, ms: 1300, ease: 'Cubic.In', existing: bus, destroyAtEnd: true });
    }
    host.setLocked(false);
  },

  /** 9:00 en la Plaza Central: llega el resto del grupo de intercambio y la coordinadora. */
  async reunion_intercambio(host) {
    host.setLocked(true);
    const at = parseClock('lun 09:00');
    if (StoryState.clock < at) {
      EventSystem.emit('banner', { title: 'Esperando al grupo...', subtitle: 'Encuentro de intercambio · 9:00' });
      await advanceClock(at, 2400, (ms) => host.wait(ms));
    }
    for (const d of ['reunion_monica', 'reunion_presentaciones', 'reunion_viaje', 'reunion_impresiones', 'reunion_partido']) await host.say(d);
    host.setLocked(false);
  },

  /** El almuerzo: fideos con hogao, paso a paso. Sin errores, quedan perfectos (logro). */
  async cocinar_fideos(host) {
    host.setLocked(true);
    StoryState.setFlag('fideos_error', false);
    for (const step of ['fideos_paso_agua', 'fideos_paso_sal', 'fideos_paso_hervir', 'fideos_paso_echar', 'fideos_paso_hogao', 'fideos_paso_colar']) {
      await host.say(step);
    }
    if (!StoryState.hasFlag('fideos_error')) StoryState.setFlag('fideos_perfectos');
    await host.say('fideos_listo');
    host.placePlayer('comedor');
    await host.wait(400);
    await host.say('fideos_comer');
    host.setLocked(false);
  },

  /** El partido en su propia escena (FutbolScene); después, la celebración o la derrota. */
  async partido(host, data) {
    host.setLocked(true);
    const result = await new Promise<FutbolResult>((done) => EventSystem.emit('open-futbol', { done, tutorial: data.tutorial === true }));
    const win = result.us > result.them;
    StoryState.setFlag('partido_jugado');
    StoryState.setFlag(win ? 'gano_partido' : result.us === result.them ? 'empato_partido' : 'perdio_partido');
    if (result.myGoals > 0) StoryState.setFlag('gol_propio');
    if (result.myGoals >= 3) StoryState.setFlag('hat_trick');
    if (result.myGoals >= 2) StoryState.setFlag('figura_partido');
    if (result.ownGoals > 0) StoryState.setFlag('autogol_propio');
    if (result.us - result.them >= 3) StoryState.setFlag('goleada');
    Dialogue.vars.set('marcador', `${result.us} – ${result.them}`);
    Dialogue.vars.set('goles', String(result.myGoals));
    host.placePlayer('post_partido');
    playMusic(win ? 'salsa' : 'despedida');
    await host.wait(500);
    await host.say(win ? 'post_victoria' : 'post_derrota');
    if (!win) {
      host.setLocked(false);
      return;
    }
    await host.fade(true, 900);
    await host.say('taxi_rooftop');
    StoryState.setFlag('tomo_taxi');
    host.goTo('rooftop_cali', 'llegada');
  },

  /** La noche en el rooftop: a las 21:30 pasa una llovizna y a las 22:00 escampa. */
  async rooftop(host) {
    await untilClock(host, 'lun 21:30');
    StoryState.setWeather('lluvia');
    await sayWhenFree(host, 'rooftop_llovizna');
    await untilClock(host, 'lun 22:00');
    StoryState.setWeather('despejado');
    await sayWhenFree(host, 'rooftop_escampa');
  },

  // --- Misión 5 (src/systems/StoryScripts5.ts) ---
  ...M5_SCRIPTS,

  // --- Misión 6 (src/systems/StoryScripts6.ts) ---
  ...M6_SCRIPTS,

  // --- Misión 7 (src/systems/StoryScripts7.ts) ---
  ...M7_SCRIPTS,
  ...M8_SCRIPTS,
};

/** Espera (sin bloquear al jugador) a que el reloj de la historia llegue a `at`. */
async function untilClock(host: ScriptHost, at: string): Promise<void> {
  const target = parseClock(at);
  while (StoryState.clock < target) await host.wait(400);
}

/** Abre un diálogo apenas no haya otro abierto. */
async function sayWhenFree(host: ScriptHost, dialogueId: string): Promise<void> {
  while (Dialogue.active) await host.wait(300);
  await host.say(dialogueId);
}

/** Tramo de un trayecto: la cámara se mueve con los baches y el reloj avanza hasta `clock` ("lun 08:30" o minutos). */
async function travelLeg(host: ScriptHost, ms: number, clock?: string | number): Promise<void> {
  const to = typeof clock === 'string' ? parseClock(clock) : clock;
  const from = StoryState.clock;
  const step = 300;
  for (let t = 0; t < ms; t += step) {
    if (t % 1200 === 0) host.shake(200, 0.0015);
    await host.wait(Math.min(step, ms - t));
    if (to !== undefined && from < to) StoryState.setClock(from + ((to - from) * Math.min(ms, t + step)) / ms, to);
  }
}

/** Adelanta el reloj de la historia hasta `at` en `ms` reales. */
function clockTo(host: ScriptHost, at: string, ms: number): Promise<void> {
  return advanceClock(parseClock(at), ms, (w) => host.wait(w));
}

/** El despertador suena dos veces. */
async function ring(host: ScriptHost): Promise<void> {
  for (let i = 0; i < 2; i++) {
    playSfx('ring');
    await host.wait(650);
  }
}

/** Las veces que se puede posponer la alarma antes de quedarse dormido (easter egg). */
const MAX_SNOOZES = 3;
const SNOOZE_MINUTES = 5;

/**
 * Alarma de las 7:00: levantarse o posponer 5 minutos. A la tercera vez que pospones
 * te quedas dormido y faltas al control... hasta que despiertas: era una pesadilla.
 */
async function alarmLoop(host: ScriptHost): Promise<void> {
  for (;;) {
    await ring(host);
    await host.say('alarma');
    if (!takeFlag('_posponer')) return;
    StoryState.setFlag('pospuso');
    const snoozes = [1, 2].filter((n) => StoryState.hasFlag(`posponer_${n}`)).length + 1;
    if (snoozes >= MAX_SNOOZES) {
      await nightmare(host);
      return;
    }
    StoryState.setFlag(`posponer_${snoozes}`);
    await host.fade(true, 700);
    StoryState.setClock(StoryState.clock + SNOOZE_MINUTES);
    await host.wait(900);
    await host.fade(false, 700);
  }
}

/** Final secreto: te quedaste dormido y faltaste al control de Optimización. */
async function nightmare(host: ScriptHost): Promise<void> {
  await host.fade(true, 1400);
  await host.say('pesadilla');
  StoryState.setFlag('secreto_dormido');
  EventSystem.emit('banner', { title: 'FINAL SECRETO', subtitle: 'Te quedaste dormido' });
  await host.wait(2600);
  playSfx('ring');
  await host.wait(400);
  playSfx('ring');
  await host.say('pesadilla_despertar');
  StoryState.setFlag('posponer_1', false);
  StoryState.setFlag('posponer_2', false);
  await host.fade(false, 700);
}
