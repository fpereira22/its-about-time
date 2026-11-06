import { playMusic, playSfx } from '../audio/sfx';
import { TILE } from '../config/display';
import type { CocinaResult } from '../scenes/CocinaScene';
import { quimica } from '../ui/QuimicaMeter';
import { Dialogue } from './DialogueManager';
import { EventSystem } from './EventSystem';
import { advanceClock, parseClock } from './Mission';
import { formatMoney, StoryState } from './StoryState';
import type { ScriptHost } from './StoryScripts';

/**
 * Scripts de la misión 7 («Lluvia en el piso 8»): el ascensor del Bobo Unic Living, los helados del martes con las
 * amigas de Sira, el jueves los dos solos en la U (la maqueta, el almuerzo, el pavo real y el lago), el chat hasta
 * las 3 de la mañana, y el viernes en el depa del piso 8: la puerta, la boloñesa (CocinaScene), la Farmadía, el
 * ascensor con Sira, la comida, la peli, la siesta, el beso, la lluvia y el paradero de la Calle 18.
 * Se suman a SCRIPTS en StoryScripts.ts.
 */

type Script = (host: ScriptHost, data: Record<string, unknown>) => Promise<void> | void;

function clockTo(host: ScriptHost, at: string, ms: number): Promise<void> {
  return advanceClock(parseClock(at), ms, (w) => host.wait(w));
}

/** Pone el reloj en `at` (si todavía no llega) y su tope en `max`. */
function clockAt(at: string, max?: string): void {
  const t = Math.max(StoryState.clock, parseClock(at));
  StoryState.setClock(t, max ? Math.max(t, parseClock(max)) : Math.max(t, StoryState.clockMax));
}

/** Suma un punto de química con Sira (flag `m7_q_<id>`, una sola vez). */
function q(id: string): void {
  StoryState.setFlag(`m7_q_${id}`);
}

function set(...flags: string[]): void {
  for (const f of flags) StoryState.setFlag(f);
}

function clear(...flags: string[]): void {
  for (const f of flags) StoryState.setFlag(f, false);
}

/** Química con la que se cuenta el final («Lluvia en el piso 8»). */
const ALTA = 18;

/** Lo que cuesta cada cosa en la Farmadía. */
const PRECIOS = { bebida: 6500, crispetas: 4800, chocolatina: 2500 };

/** El paradero de la Calle 18 (frente a la torre): pista oriente, hacia el norte. */
const PARADERO_Y = 27;
const LANE_NORTE = 6;

export const M7_SCRIPTS: Record<string, Script> = {
  /** El ascensor del Bobo: del piso 8 al lobby y de vuelta. Con Sira y las bebidas, la espera larga. */
  async ascensor_m7(host, data) {
    const to = String(data.to ?? 'lobby');
    host.setLocked(true);
    if (to === 'piso8' && StoryState.hasFlag('m7_bebida_elegida') && !StoryState.hasFlag('m7_ascensor_juntos')) {
      playMusic('ascensor');
      await host.say('m7_ascensor_espera');
      playSfx('elevator');
      await host.wait(400);
      await host.say('m7_ascensor_adentro');
      set('m7_ascensor_juntos');
      playSfx('elevator');
      host.goTo('bobo_piso8', 'ascensor');
      return;
    }
    EventSystem.emit('banner', { title: to === 'lobby' ? 'Bajando...' : 'Subiendo al 8...', subtitle: 'Ascensor del Bobo Unic Living' });
    await host.wait(900);
    playSfx('elevator');
    if (to === 'lobby') host.goTo('bobo_lobby', 'ascensor');
    else host.goTo('bobo_piso8', 'ascensor');
  },

  /** Martes: los helados con Majo y Cata (y su interrogatorio); el miércoles, otra vez. El jueves, solos. */
  async helado_martes(host) {
    if (StoryState.hasFlag('m7_helado_martes')) return;
    host.setLocked(true);
    playMusic('sira');
    await host.say('m7_helado_pedir');
    await host.say('m7_helado_charla');
    await clockTo(host, 'mar 16:20', 1400);
    await host.say('m7_helado_fin');
    set('m7_helado_martes');
    await host.fade(true, 900);
    StoryState.setClock(parseClock('mié 15:30'), parseClock('mié 15:30'));
    await host.say('m7_miercoles');
    set('m7_jueves');
    StoryState.setWeather('despejado');
    StoryState.setClock(parseClock('jue 08:40'), parseClock('jue 10:00'));
    host.goTo('bobo_piso8', 'cama');
  },

  /** Jueves: almuerzo en la Cafetería Central (ella te roba los patacones). */
  async almuerzo_m7(host) {
    if (StoryState.hasFlag('m7_act_almuerzo')) return;
    host.setLocked(true);
    clockAt('jue 12:40');
    await host.say('m7_almuerzo');
    await clockTo(host, minutesFromNow(45), 1200);
    set('m7_act_almuerzo');
    host.setLocked(false);
  },

  /** El lago al atardecer: la conversación de verdad, el pavo real que grita, y el bus de Sira. */
  async lago_m7(host) {
    if (StoryState.hasFlag('m7_dia_u')) return;
    host.setLocked(true);
    // Que se vaya primero el cartel de la zona (El Lago), para que no tape la viñeta.
    await host.wait(1500);
    clear('m7_sira_sigue');
    set('m7_en_lago');
    host.placePlayer('orilla_lago');
    host.facePlayer('left');
    const planes = ['m7_act_maqueta', 'm7_act_almuerzo', 'm7_act_pavo'].filter((f) => StoryState.hasFlag(f)).length;
    Dialogue.vars.set('planes', String(planes));
    if (planes === 3) set('m7_tres_planes');
    clockAt('jue 17:15', 'jue 18:00');
    playMusic('sira');
    await host.wait(500);
    await host.say('m7_lago');
    await clockTo(host, 'jue 17:45', 1400);
    playSfx('pavo');
    host.shake(250, 0.004);
    await host.say('m7_lago_pavo');
    await host.say('m7_lago_fin');
    await host.fade(true, 800);
    clear('m7_en_lago');
    set('m7_dia_u');
    StoryState.setClock(Math.max(StoryState.clock, parseClock('jue 18:20')), parseClock('jue 22:30'));
    await host.say('m7_lago_bus');
    await host.fade(false, 800);
    playMusic('campus');
    host.setLocked(false);
  },

  /** En la cama, el jueves: chatear con Sira hasta las 3 y 12 de la mañana. Al otro día, la invitación. */
  async chat_noche_m7(host) {
    if (StoryState.hasFlag('m7_chat_hecho')) return;
    host.setLocked(true);
    set('en_pijama');
    clockAt('jue 22:40', 'jue 22:40');
    playMusic('sira');
    await host.say('m7_chat_1');
    await clockTo(host, 'jue 23:55', 1300);
    await host.say('m7_chat_2');
    await clockTo(host, 'vie 01:30', 1300);
    await host.say('m7_chat_3');
    await clockTo(host, 'vie 03:12', 1300);
    await host.say('m7_chat_4');
    const good = ['m7_q_chat_1', 'm7_q_chat_2', 'm7_q_chat_3', 'm7_q_chat_4'].every((f) => StoryState.hasFlag(f));
    if (good) set('m7_chat_perfecto');
    set('m7_chat_hecho', 'm7_invitada');
    await host.fade(true, 1200);
    playMusic(null);
    await host.say('m7_dormir');
    StoryState.setClock(parseClock('vie 11:25'), parseClock('vie 12:55'));
    StoryState.setWeather('nublado');
    set('m7_viernes');
    clear('en_pijama');
    host.placePlayer('cama');
    await host.fade(false, 900);
    playMusic('depa');
    await host.say('m7_viernes_despierta');
    host.setLocked(false);
  },

  /** Viernes: el agua para los fideos... y tocan la puerta. Llegó temprano. */
  async agua_m7(host) {
    if (StoryState.hasFlag('m7_agua')) return;
    host.setLocked(true);
    set('m7_agua');
    playSfx('hervir');
    await host.say('m7_agua_puesta');
    clockAt('vie 12:57', 'vie 12:58');
    await host.wait(1400);
    playSfx('toc_toc');
    host.shake(120, 0.002);
    await host.wait(500);
    set('m7_toc');
    await host.say('m7_toc_toc');
    host.setLocked(false);
  },

  /** Primera parte de la boloñesa (CocinaScene): picar y el sofrito. Después, la nevera vacía. */
  async cocina_m7_1(host) {
    if (StoryState.hasFlag('m7_cocina1')) return;
    host.setLocked(true);
    host.placePlayer('cocina');
    const r = await new Promise<CocinaResult>((done) => EventSystem.emit('open-cocina', { part: 1, done }));
    set('m7_cocina1');
    Dialogue.vars.set('pasos', String(r.score));
    if (r.cried) set('m7_lloro_cebolla');
    if (r.teamwork) {
      set('m7_sofrito_equipo');
      q('sofrito');
    }
    if (r.perfect) set('m7_cocina1_perfecta');
    if (r.score >= 2) q('cocina1');
    clockAt('vie 13:40', 'vie 13:45');
    host.placePlayer('cocina');
    playMusic('depa');
    await host.wait(400);
    await host.say('m7_post_cocina_1');
    set('m7_rumbo_farmadia', 'm7_sira_sigue');
    StoryState.setClock(StoryState.clock, parseClock('vie 14:30'));
    host.setLocked(false);
  },

  /** En el pasillo angosto de la Farmadía: se pasan a llevar. */
  async choque_m7(host) {
    if (StoryState.hasFlag('m7_choque')) return;
    host.setLocked(true);
    set('m7_choque');
    playSfx('golpe');
    host.shake(160, 0.004);
    await host.say('m7_choque');
    host.setLocked(false);
  },

  /** La caja de la Farmadía: la bebida y lo que hayan agarrado (crispetas, chocolatina). */
  async pagar_m7(host) {
    if (StoryState.hasFlag('m7_pago')) return;
    host.setLocked(true);
    let total = PRECIOS.bebida;
    if (StoryState.hasItem('crispetas')) total += PRECIOS.crispetas;
    if (StoryState.hasItem('chocolatina')) total += PRECIOS.chocolatina;
    Dialogue.vars.set('total', formatMoney(total));
    await host.say('m7_caja_pagar');
    if (StoryState.hasFlag('m7_sira_pago')) total -= PRECIOS.crispetas;
    StoryState.spend(Math.min(total, StoryState.money));
    playSfx('caja_registradora');
    set('m7_pago');
    await host.say('m7_caja_fin');
    host.setLocked(false);
  },

  /** Segunda parte de la boloñesa: los fideos y emplatar. Después, la comida, la peli, la siesta... y el beso. */
  async cocina_m7_2(host) {
    if (StoryState.hasFlag('m7_cocina2')) return;
    host.setLocked(true);
    host.placePlayer('cocina');
    const r = await new Promise<CocinaResult>((done) => EventSystem.emit('open-cocina', { part: 2, done }));
    set('m7_cocina2');
    if (r.score >= 1) q('cocina2');
    if (r.perfect) {
      set('m7_al_dente');
      if (StoryState.hasFlag('m7_cocina1_perfecta')) set('m7_cocina_perfecta');
    }
    clockAt('vie 14:50', 'vie 14:50');
    playMusic('depa');
    host.placePlayer('cocina');
    await host.wait(300);
    await host.say('m7_post_cocina_2');
    await comida(host);
  },

  /** El paradero de la Calle 18, de noche y con llovizna: el bus de Sira. Fin. */
  async paradero_m7(host) {
    if (StoryState.hasFlag('m7_despedida')) return;
    host.setLocked(true);
    set('m7_despedida');
    host.placePlayer('paradero');
    host.facePlayer('left');
    await host.wait(1500);
    await host.say('m7_paradero');
    // Llega el bus por la pista oriente, hacia el norte (el frente arriba).
    const stopY = (PARADERO_Y + 2) * TILE;
    const laneX = LANE_NORTE * TILE;
    playSfx('bus-brake');
    const bus = await host.drive({ texture: 'bus_cali_v_n', bottomTileY: 0, laneX, xFrom: stopY + 320, xTo: stopY, ms: 1900, ease: 'Cubic.Out' });
    playSfx('bus-doors-open');
    await host.say('m7_bus_llega');
    clear('m7_sira_sigue');
    playSfx('bus-doors-close');
    await host.wait(700);
    await host.say('m7_bus_ventana');
    playSfx('bus-pass');
    await host.drive({ texture: 'bus_cali_v_n', bottomTileY: 0, laneX, xFrom: bus.y, xTo: bus.y - 520, ms: 2200, ease: 'Cubic.In', existing: bus, destroyAtEnd: true });
    const v = quimica();
    Dialogue.vars.set('quimica', String(v));
    StoryState.setFlag('m7_final_alta', v >= ALTA);
    await host.wait(600);
    await host.say('m7_final');
    host.completeMission();
  },
};

/** La mesa (el brindis, la boloñesa y la conversación), la peli en el sofá, la siesta... y el beso. */
async function comida(host: ScriptHost): Promise<void> {
  host.setLocked(true);
  await host.fade(true, 500);
  set('m7_sira_mesa');
  host.placePlayer('mesa');
  await host.fade(false, 500);
  playSfx('destapar');
  await host.say('m7_comida');
  await clockTo(host, 'vie 15:30', 1400);
  await host.say('m7_comida_fin');
  // El sofá y la peli.
  await host.fade(true, 600);
  clear('m7_sira_mesa');
  set('m7_sira_sofa');
  host.placePlayer('sofa');
  await host.fade(false, 600);
  await host.say('m7_peli_elegir');
  playSfx('tele');
  await host.say('m7_peli');
  await clockTo(host, 'vie 17:20', 2200);
  host.cry('player', 1800);
  host.cry('m7_sira_sofa', 2200);
  await host.say('m7_peli_fin');
  // La siesta (trasnochados desde las 3 y 12).
  await host.say('m7_sueno');
  await host.fade(true, 700);
  clear('m7_sira_sofa');
  set('m7_sira_cama');
  host.placePlayer('cama');
  await host.fade(false, 700);
  playMusic('sira');
  await host.say('m7_cama');
  for (let i = 0; i < 3; i++) {
    playSfx('latido');
    await host.wait(480);
  }
  await host.say('m7_confesion');
  playSfx('beso');
  // Y justo ahí, afuera, se larga la lluvia.
  StoryState.setWeather('lluvia');
  playSfx('trueno');
  await host.say('m7_beso');
  await host.fade(true, 1600);
  playMusic(null);
  StoryState.setClock(parseClock('vie 20:35'), parseClock('vie 21:30'));
  await host.say('m7_horas');
  await host.fade(false, 1200);
  playMusic('depa');
  await host.say('m7_despiertan');
  clear('m7_sira_cama');
  set('m7_rumbo_paradero', 'm7_sira_sigue', 'm7_noche');
  host.setLocked(false);
}

function minutesFromNow(n: number): string {
  const at = StoryState.clock + n;
  const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const day = days[Math.floor(at / 1440) % 7];
  const m = Math.floor(at % 1440);
  return `${day} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
