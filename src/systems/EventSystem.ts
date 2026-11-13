import Phaser from 'phaser';
import type { AmbientState, MusicTrack, SfxName, SkylineAmbient } from '../audio/sfx';
import type { MapZone } from '../types/map';
import type { RideProgress } from '../types/mission';

/** Eventos globales del juego y sus argumentos. */
export interface GameEvents {
  /** Cambió cualquier flag, ítem, plata o saldo. */
  'state-changed': [];
  /** Viajar a otro mapa (con fade). */
  warp: [{ map: string; spawn: string }];
  'start-scene': [{ scene: string; data?: Record<string, unknown> }];
  /** Evento de guion con nombre libre (ver scripts de la misión). */
  story: [{ name: string; data?: unknown }];
  'dialogue-open': [];
  'dialogue-close': [];
  'zone-entered': [MapZone];
  'objective-changed': [string];
  /** Cambió el lugar actual (zona, mapa interior o viaje en curso). Lo usa el HUD. */
  'location-changed': [{ name: string; subtitle?: string }];
  /** Cartel grande arriba (nombre de calle, próxima estación). */
  banner: [{ title: string; subtitle?: string }];
  /** Efecto de sonido (lo reproduce AudioManager). Usa playSfx() de src/audio/sfx.ts. */
  sfx: [SfxName];
  /** Cambiar la música de fondo (null = silencio). Usa playMusic(). El bpm opcional fuerza otro tempo y la reinicia. */
  music: [MusicTrack | null, number?];
  /** Sonido ambiente (la lluvia). Usa setAmbient(). */
  ambient: [AmbientState];
  /** Viento y murmullo de la ciudad en lo alto (rooftop). Usa setSkylineAmbient(). */
  'skyline-ambient': [SkylineAmbient];
  /** Cambió el clima de la historia (misión 4): lo dibuja la escena de mapa. */
  weather: [string];
  /** Abrir el partido de fútbol (misión 4); `done` recibe el marcador. */
  'open-futbol': [{ tutorial?: boolean; done: (result: { us: number; them: number; myGoals: number; ownGoals: number }) => void }];
  /** Misión 5: el Marco Polo en la piscina (PiscinaScene); `done` dice si nadaste los 25 metros. */
  'open-piscina': [{ done: (result: { swam25: boolean; tags: number; caught: number; winner: 'you' | 'grover' | 'nadie' }) => void }];
  /** Misión 5: el Cinco en Pance Burger (CincoScene); `done` recibe quién ganó (0 = tú). */
  'open-cinco': [{ done: (result: { winner: number; mesaPerfecta: boolean }) => void }];
  /** Misión 6: la clase de natación con Sira (NatacionScene); `done` recibe qué ejercicios saliste bien. */
  'open-natacion': [{ done: (result: { lessons: number; perfect: boolean; wonRace: boolean; held: boolean }) => void }];
  /** Misión 6: la persecución del ladrón por el Bulevar (PersecucionScene); `done` dice si lo alcanzaste. */
  'open-persecucion': [{ done: (result: { caught: boolean; hits: number; dodges: number }) => void }];
  /** Misión 7: la boloñesa con Sira en el depa (CocinaScene); parte 1 = picar y sofreír, parte 2 = los fideos y emplatar. */
  'open-salsa': [{ partner?: string; done: (result: { score: number; total: number; perfect: boolean; hits: number; notes: number }) => void }];
  /** Misión 8: pool con Danilo, el torneo de pimpón y las atracciones del Parque del Café (y el tejo). */
  'open-pool': [{ done: (result: import('../scenes/PoolScene').PoolResult) => void }];
  'open-pinpon': [{ done: (result: import('../scenes/PinponScene').PinponResult) => void }];
  'open-atraccion': [{ mode: import('../scenes/AtraccionScene').AtraccionMode; done: (result: import('../scenes/AtraccionScene').AtraccionResult) => void }];
  /** Misión 9: los juegos de la fiesta en la casa de Tami (las curvas del taxi, beer pong, cacho y la pelea de gallinas). */
  'open-fiesta': [{ mode: import('../scenes/FiestaScene').FiestaMode; done: (result: import('../scenes/FiestaScene').FiestaResult) => void }];
  /** Misión 10: los juegos del río Pance (parquear, el chorro, el neumático, el puente colgante, las fotos y la historia). */
  'open-rio': [{ mode: import('../scenes/RioScene').RioMode; photos?: string[]; done: (result: import('../scenes/RioScene').RioResult) => void }];
  'open-cocina': [{ part: 1 | 2; done: (result: { score: number; total: number; perfect: boolean; cried: boolean; teamwork: boolean }) => void }];
  /** Abrir el mapa interactivo de la Línea 1 (escena UI). */
  'open-line-map': [];
  /** Abrir el ropero (elegir la ropa del jugador). */
  'open-wardrobe': [];
  /** Avance de un viaje en metro/micro (pantalla de recorrido). */
  'ride-progress': [RideProgress];
  /** Abrir/cerrar las puertas del vagón o la micro en que va el jugador. */
  'vehicle-doors': [{ open: boolean }];
  /** Llegó un mensaje al celular (notificación). */
  'phone-message': [{ id: string }];
  /** Alternar entre vista interior y exterior en un viaje en micro. */
  'toggle-ride-view': [];
  /** Mostrar u ocultar el mapa lateral del celular (app Mapa). */
  'side-map': [{ show: boolean }];
  /** Carnet dibujado en pantalla durante un diálogo (efecto `doc`). */
  document: [{ doc: 'show' | 'focus' | 'stamp' | 'hide'; id?: string }];
  /** Pantalla de vuelos durante un diálogo (efecto `board`; "" la cierra). */
  board: [string];
  /** Abrir el minijuego de la cinta de equipaje; `done` recibe si encontraste tu maleta. */
  'open-baggage-claim': [{ done: (result: { found: boolean; mistakes: number }) => void }];
  /** Viñeta 2D durante un diálogo (efecto `vineta`; id de src/ui/Vineta.ts, "" la cierra). */
  vineta: [string];
  /** Cartel dibujado durante un diálogo (efecto `sign`; id de src/ui/SignView.ts, "" lo cierra). */
  sign: [{ id: string; step?: number }];
  /** Marca de la pregunta actual en la pizarra de la prueba (efecto `signMark`). */
  'sign-mark': ['ok' | 'bad'];
  /** Estado del viaje en micro para la UI y botones de vista. */
  'bus-ride-status': [{ active: boolean; mode?: 'interior' | 'exterior'; rideId?: string; line?: string }];
  /** Cambió un ajuste del jugador (volúmenes, silencio, velocidad del texto): ver src/systems/Settings.ts. */
  'settings-changed': [];
}

type Handler<K extends keyof GameEvents> = (...args: GameEvents[K]) => void;

/** Bus de eventos tipado y compartido entre escenas. */
class EventSystemImpl {
  private readonly emitter = new Phaser.Events.EventEmitter();

  on<K extends keyof GameEvents>(event: K, fn: Handler<K>): () => void {
    this.emitter.on(event, fn);
    return () => this.emitter.off(event, fn);
  }

  /** Suscribe y se desuscribe solo cuando la escena se apaga. */
  onScene<K extends keyof GameEvents>(scene: Phaser.Scene, event: K, fn: Handler<K>): void {
    const off = this.on(event, fn);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  emit<K extends keyof GameEvents>(event: K, ...args: GameEvents[K]): void {
    this.emitter.emit(event, ...args);
  }
}

export const EventSystem = new EventSystemImpl();
