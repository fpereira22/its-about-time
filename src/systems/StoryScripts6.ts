import { playMusic, playSfx } from '../audio/sfx';
import { TILE } from '../config/display';
import type { NatacionResult } from '../scenes/NatacionScene';
import type { PersecucionResult } from '../scenes/PersecucionScene';
import { quimica } from '../ui/QuimicaMeter';
import { Dialogue } from './DialogueManager';
import { EventSystem } from './EventSystem';
import { advanceClock, parseClock } from './Mission';
import { StoryState } from './StoryState';
import type { ScriptHost } from './StoryScripts';
import { FLAG_BLACKOUT, FLAG_SIRA_TORCH, FLAG_TORCH } from './Darkness';

/**
 * Scripts de la misión 6 («Letras sobre el río»): la clase de natación del jueves, el sábado en Pance, el T31
 * desde Universidades, la feria del libro en el Bulevar del Río (el poema express, la firma, el raponero),
 * la Heladería Corazones y la Colina de San Antonio de noche. Se suman a SCRIPTS en StoryScripts.ts.
 */

type Script = (host: ScriptHost, data: Record<string, unknown>) => Promise<void> | void;

function takeFlag(flag: string): boolean {
  const had = StoryState.hasFlag(flag);
  StoryState.setFlag(flag, false);
  return had;
}

function clockTo(host: ScriptHost, at: string, ms: number): Promise<void> {
  return advanceClock(parseClock(at), ms, (w) => host.wait(w));
}

/** Suma un punto de química con Sira (flag `m6_q_<id>`, una sola vez). */
function q(id: string): void {
  StoryState.setFlag(`m6_q_${id}`);
}

/** Palabras del poema express: la flag temporal `_poema_<grupo>_<i>` elige una de cada grupo. */
const POEM_WORDS: Record<string, string[]> = {
  a: ['el río', 'la piscina', 'el pandebono', 'la lluvia'],
  b: ['nadar', 'perderse', 'leer', 'llegar tarde'],
  c: ['un helado', 'un jueves', 'Chile', 'La Ermita'],
};

/**
 * El poema que escribe el poeta con las tres palabras (plantillas que riman más o menos; es poesía express).
 * Siempre termina mirando a los dos.
 */
function writePoem(a: string, b: string, c: string): string {
  const templates = [
    `Dijeron que ${a} no se podía leer,\nque ${b} era cosa de otro día;\npero ustedes dos, en el Bulevar,\nse miran como quien guarda ${c}.`,
    `${cap(a)} pasa y no pregunta,\n${b} también es una forma de quedarse.\nSi alguien busca ${c} esta tarde,\nque los busque a ustedes dos, aquí.`,
    `Antes de ${b} hubo ${a},\ny antes de ${a}, nadie.\nAhora hay ${c}, dos sillas,\ny un silencio que no es silencio.`,
  ];
  return templates[(a.length + b.length + c.length) % templates.length];
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Dónde se detiene el articulado en Universidades (frente a la puerta del T31) y por qué carril llega. */
const T31_DOOR_X = 47;
const T31_LANE = 33;

/** Química con la que se cuentan los finales. */
const PURA = 12;
const CASI = 7;

export const M6_SCRIPTS: Record<string, Script> = {
  /** Jueves 7 p. m.: la clase de natación con Sira (NatacionScene) y, al salir, la invitación a la feria. */
  async clase_natacion(host) {
    host.setLocked(true);
    await host.say('m6_clase_antes');
    const r = await new Promise<NatacionResult>((done) => EventSystem.emit('open-natacion', { done }));
    StoryState.setFlag('m6_clase');
    Dialogue.vars.set('ejercicios', String(r.lessons));
    if (r.lessons >= 5) StoryState.setFlag('m6_clase_completa');
    if (r.perfect) StoryState.setFlag('m6_clase_perfecta');
    if (r.wonRace) {
      StoryState.setFlag('m6_gano_carrera');
      q('carrera');
    }
    if (r.held) q('estrella');
    if (r.lessons >= 3) q('alumno');
    host.placePlayer('borde');
    playMusic('sira');
    await host.wait(500);
    await host.say('m6_post_clase');
    // Dos días después.
    await host.fade(true, 900);
    await host.say('m6_jueves_a_sabado');
    StoryState.setFlag('en_bano', false);
    StoryState.setFlag('sin_mochila', false);
    StoryState.setFlag('m6_sabado');
    StoryState.setWeather('despejado');
    StoryState.setClock(parseClock('sáb 09:30'), parseClock('sáb 12:50'));
    host.goTo('pance_casa', 'pieza');
  },

  /** El almuerzo del sábado con doña Mery: sancocho de gallina (y sus consejos). */
  async almuerzo_m6(host) {
    host.setLocked(true);
    await host.fade(true, 600);
    host.placePlayer('comedor');
    StoryState.setClock(Math.max(StoryState.clock, parseClock('sáb 13:00')), parseClock('sáb 13:00'));
    await host.fade(false, 600);
    await host.say('m6_almuerzo');
    await clockTo(host, 'sáb 13:50', 1400);
    StoryState.setFlag('m6_almorzo');
    StoryState.setClock(StoryState.clock, parseClock('sáb 15:40'));
    await host.say('m6_almuerzo_fin');
    host.setLocked(false);
  },

  /** El separador: la flor de guayacán prensada en un libro de doña Mery (veinte minutos con la plancha). */
  async separador(host) {
    host.setLocked(true);
    await host.fade(true, 500);
    await host.say('m6_separador_hacer');
    StoryState.setClock(StoryState.clock + 20, Math.max(StoryState.clockMax, StoryState.clock + 20));
    StoryState.addItem('separador_guayacan');
    playSfx('item');
    await host.fade(false, 500);
    await host.say('m6_separador_listo');
    host.setLocked(false);
  },

  /** Universidades, andén del T31: llega el articulado, abre las puertas y subes (o no). */
  async articulado_t31(host) {
    host.setLocked(true);
    EventSystem.emit('banner', { title: 'Esperando el T31...', subtitle: 'Universidades → Chiminangos (por el Centro)' });
    await host.wait(900);
    StoryState.setClock(StoryState.clock + 3, Math.max(StoryState.clockMax, StoryState.clock + 3));
    // Llega por el carril exclusivo desde el oriente y frena con la primera puerta frente al andén.
    const stopX = T31_DOOR_X * TILE + TILE / 2 + 112 / 2 - 18 - 4;
    playSfx('bus-brake');
    const bus = await host.drive({ texture: 'articulado_izq', label: 'T31', bottomTileY: T31_LANE, xFrom: stopX + 420, xTo: stopX, ms: 2200, ease: 'Cubic.Out' });
    playSfx('bus-doors-open');
    await host.vehicleDoors(bus, true);
    await host.say('m6_t31_llega');
    if (takeFlag('_subir')) {
      StoryState.setFlag('m6_tomo_t31');
      host.startRide('t31_centro');
      return;
    }
    playSfx('bus-doors-close');
    await host.vehicleDoors(bus, false);
    playSfx('bus-pass');
    await host.drive({ texture: 'articulado_izq', bottomTileY: T31_LANE, xFrom: bus.x, xTo: bus.x - 520, ms: 1800, ease: 'Cubic.In', existing: bus, destroyAtEnd: true });
    host.setLocked(false);
  },

  /** Afuera de La Ermita: Sira te espera mirando las cometas. */
  async encuentro_ermita(host) {
    if (StoryState.hasFlag('m6_con_sira')) return;
    host.setLocked(true);
    playMusic('sira');
    // Que se vaya primero el cartel de la zona (La Ermita), para que no tape la viñeta.
    await host.wait(1600);
    // Puntual si llegaste antes de las 4 y cinco (ella llegó a las 3:50, obvio).
    if (StoryState.clock <= parseClock('sáb 16:05')) {
      StoryState.setFlag('m6_puntual');
      q('puntual');
    }
    await host.say('m6_encuentro');
    StoryState.setFlag('m6_con_sira');
    StoryState.setFlag('m6_sira_sigue');
    StoryState.setClock(StoryState.clock, parseClock('sáb 17:30'));
    playMusic('feria');
    host.setLocked(false);
  },

  /** El poeta de la máquina de escribir: tres palabras (una de cada grupo) y sale un poema. */
  async poema_express(host) {
    host.setLocked(true);
    await host.say('m6_poeta_palabras');
    const pick = (group: string): string => {
      const words = POEM_WORDS[group];
      const i = words.findIndex((_, k) => takeFlag(`_poema_${group}_${k}`));
      return words[Math.max(0, i)];
    };
    const a = pick('a');
    const b = pick('b');
    const c = pick('c');
    Dialogue.vars.set('poema', writePoem(a, b, c));
    playSfx('teclas');
    await host.wait(900);
    playSfx('teclas');
    await host.wait(700);
    StoryState.setFlag('m6_poema');
    q('poema');
    if (!StoryState.hasItem('poema_express')) StoryState.addItem('poema_express');
    await host.say('m6_poeta_poema');
    host.setLocked(false);
  },

  /** La fila para que Amparo Ledesma le firme el libro a Sira. */
  async firma_autora(host) {
    host.setLocked(true);
    EventSystem.emit('banner', { title: 'La fila de la firma', subtitle: 'Avanza... de a poquito' });
    await host.say('m6_fila_1');
    await clockTo(host, minutesFromNow(15), 1500);
    await host.say('m6_fila_2');
    await clockTo(host, minutesFromNow(10), 1000);
    await host.say('m6_firma');
    StoryState.setFlag('m6_firmado');
    host.setLocked(false);
  },

  /** En el Puente Ortiz: el raponero le arranca la bolsa a Sira y empieza la persecución (PersecucionScene). */
  async raponazo(host) {
    if (StoryState.hasFlag('m6_persecucion')) return;
    host.setLocked(true);
    StoryState.setFlag('m6_persecucion');
    playSfx('raponazo');
    host.shake(300, 0.006);
    await host.say('m6_raponazo');
    const r = await new Promise<PersecucionResult>((done) => EventSystem.emit('open-persecucion', { done }));
    if (r.caught) {
      StoryState.setFlag('m6_atrapo');
      q('heroe');
    }
    if (r.hits === 0) StoryState.setFlag('m6_persecucion_limpia');
    q('rescate');
    StoryState.setClock(Math.max(StoryState.clock, parseClock('sáb 17:40')), parseClock('sáb 18:20'));
    host.placePlayer('puente_ortiz');
    playMusic('sira');
    await host.wait(400);
    await host.say(r.caught ? 'm6_rescate_atrapo' : 'm6_rescate_tinto');
    await host.say('m6_atardecer');
    StoryState.setFlag('m6_rumbo_helado');
    playMusic('feria');
    host.setLocked(false);
  },

  /** Heladería Corazones: sentados con los helados; la conversación de verdad. */
  async helado_mesa(host) {
    if (StoryState.hasFlag('m6_helado')) return;
    host.setLocked(true);
    host.placePlayer('mesa');
    await host.wait(400);
    await host.say('m6_helado_conversa');
    await clockTo(host, 'sáb 19:15', 1500);
    await host.say('m6_helado_fin');
    StoryState.setFlag('m6_helado');
    StoryState.setClock(Math.max(StoryState.clock, parseClock('sáb 19:20')), parseClock('sáb 21:30'));
    host.setLocked(false);
  },

  /** Subiendo la escalinata: se va la luz en todo el barrio. */
  async apagon(host) {
    if (StoryState.hasFlag('m6_apagon_visto')) return;
    host.setLocked(true);
    StoryState.setFlag('m6_apagon_visto');
    playSfx('apagon');
    StoryState.setFlag(FLAG_BLACKOUT);
    playMusic(null);
    await host.wait(900);
    await host.say('m6_apagon');
    playMusic('colina');
    await host.wait(1200);
    playSfx('gato');
    host.shake(150, 0.003);
    await host.say('m6_apagon_gato');
    host.setLocked(false);
  },

  /** Los cuenteros siguen con velas: la leyenda del Buziraco... y el susto. */
  async cuentero_buziraco(host) {
    if (StoryState.hasFlag('m6_buziraco')) return;
    host.setLocked(true);
    await host.wait(1500);
    await host.say('m6_cuentero');
    playSfx('golpe');
    host.shake(400, 0.01);
    await host.say('m6_cuentero_susto');
    StoryState.setFlag('m6_buziraco');
    StoryState.setFlag('secreto_buziraco');
    host.setLocked(false);
  },

  /** El mirador: vuelve la luz a la ciudad, la conversación, el «casi»... y Grover. */
  async mirador_noche(host) {
    if (StoryState.hasFlag('m6_mirador')) return;
    host.setLocked(true);
    StoryState.setFlag('m6_mirador');
    host.facePlayer('up');
    await host.say('m6_mirador_oscuro');
    // Vuelve la luz: primero abajo, en la ciudad, y después en la colina.
    playSfx('elevator');
    StoryState.setFlag(FLAG_BLACKOUT, false);
    StoryState.setFlag(FLAG_TORCH, false);
    StoryState.setFlag(FLAG_SIRA_TORCH, false);
    playMusic('sira');
    await host.wait(700);
    await host.say('m6_mirador');
    await clockTo(host, 'sáb 20:40', 1600);
    // La química decide el tono del final (nunca pasa nada... todavía).
    const v = quimica();
    Dialogue.vars.set('quimica', String(v));
    StoryState.setFlag('m6_final_pura', v >= PURA);
    StoryState.setFlag('m6_final_casi', v >= CASI && v < PURA);
    for (let i = 0; i < 3; i++) {
      playSfx('latido');
      await host.wait(520);
    }
    await host.say('m6_casi');
    playSfx('ring');
    await host.wait(500);
    playSfx('ring');
    await host.say('m6_casi_grover');
    for (let i = 0; i < 3; i++) {
      playSfx('fuegos');
      await host.wait(700);
    }
    await host.say('m6_fuegos');
    await host.fade(true, 900);
    StoryState.setFlag('m6_sira_sigue', false);
    StoryState.setFlag('m6_bajando');
    await host.say('m6_despedida');
    StoryState.setClock(Math.max(StoryState.clock, parseClock('sáb 21:20')), parseClock('sáb 22:30'));
    host.goTo('taxi_m6', 'asiento');
  },
};

function minutesFromNow(n: number): string {
  const at = StoryState.clock + n;
  const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const day = days[Math.floor(at / 1440) % 7];
  const m = Math.floor(at % 1440);
  return `${day} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
