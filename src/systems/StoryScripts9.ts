import { playMusic, playSfx } from '../audio/sfx';
import type { FiestaMode, FiestaResult } from '../scenes/FiestaScene';
import type { SalsaResult } from '../scenes/SalsaScene';
import { quimica } from '../ui/QuimicaMeter';
import { Dialogue } from './DialogueManager';
import { EventSystem } from './EventSystem';
import { advanceClock, parseClock } from './Mission';
import { StoryState } from './StoryState';
import type { ScriptHost } from './StoryScripts';

/**
 * Scripts de la misión 9 («Arriba de todo»), otro recuerdo: una semana después de Salento. Empieza en el presente
 * (el sábado en la noche, en el depa, con un recuerdo de Fotogram que subió laaurii_14) y vuelve a esa noche: el
 * lobby del Bobo (Ximena y la sorpresa del ascensor: Laura), el taxi de Don Hernán (Laura, tú al medio y Mila, que
 * se sube en Bochalema), las curvas de Cristo Rey y la fiesta en la casa de Tami (que ahora anda con Steven):
 * el mirador con los amigos, el beer pong, el cacho, Laura (la botella, el baile en la pérgola y su celular) y la
 * piscina con Roxane. Si la besas, terminas durmiendo en un auto y la llevas al Bobo al amanecer; si no, vuelves en
 * taxi con Laura y Ximena. Al llegar al depa, laaurii_14 comenzó a seguirte en Fotogram. Y de vuelta al presente.
 * Se suman a SCRIPTS en StoryScripts.ts.
 */

type Script = (host: ScriptHost, data: Record<string, unknown>) => Promise<void> | void;

/** Química con Laura con la que se cuenta el final «laaurii_14». */
const ALTA = 8;

function clockTo(host: ScriptHost, at: string, ms: number): Promise<void> {
  return advanceClock(parseClock(at), ms, (w) => host.wait(w));
}

function clockAt(at: string, max?: string): void {
  const t = Math.max(StoryState.clock, parseClock(at));
  StoryState.setClock(t, max ? Math.max(t, parseClock(max)) : t);
}

function clockSet(at: string, max?: string): void {
  const t = parseClock(at);
  StoryState.setClock(t, max ? parseClock(max) : t);
}

function has(flag: string): boolean {
  return StoryState.hasFlag(flag);
}

function set(...flags: string[]): void {
  for (const f of flags) StoryState.setFlag(f);
}

function clear(...flags: string[]): void {
  for (const f of flags) StoryState.setFlag(f, false);
}

/** Los que caminan contigo en fila (flags `m9_sigue_<id>`). */
function crew(...ids: string[]): void {
  for (const id of ['laura', 'ximena', 'roxane']) StoryState.setFlag(`m9_sigue_${id}`, ids.includes(id));
}

function banner(title: string, subtitle?: string): void {
  EventSystem.emit('banner', { title, subtitle });
}

function fiesta(mode: FiestaMode): Promise<FiestaResult> {
  return new Promise<FiestaResult>((done) => EventSystem.emit('open-fiesta', { mode, done }));
}

/** El taxi de ida, tramo por tramo. */
const TAXI_IDA: Array<{ title: string; subtitle: string; at: string; dialogue: string; before?: () => void }> = [
  { title: 'El Bobo → Bochalema', subtitle: 'En taxi, hacia el sur', at: 'sáb 21:42', dialogue: 'm9_taxi_1' },
  { title: 'Bochalema', subtitle: 'Recogiendo a Mila', at: 'sáb 21:48', dialogue: 'm9_mila_sube', before: () => set('m9_mila_sube') },
  { title: 'Calle 5', subtitle: 'Atravesando Cali', at: 'sáb 21:58', dialogue: 'm9_taxi_2' },
  { title: 'Avenida Circunvalación', subtitle: 'Hacia el oeste, hacia los cerros', at: 'sáb 22:06', dialogue: 'm9_taxi_3' },
  { title: 'Los Cristales', subtitle: 'Empieza la subida', at: 'sáb 22:12', dialogue: 'm9_taxi_4' },
];

export const M9_SCRIPTS: Record<string, Script> = {
  /** El presente: el recuerdo de Fotogram. Fundido y... dos semanas antes, el lobby del Bobo. */
  async recuerdo_m9(host) {
    host.setLocked(true);
    playSfx('rebobinar');
    await host.fade(true, 1400);
    set('m9_recuerdo');
    playMusic('recuerdo');
    clockSet('sáb 21:25', 'sáb 21:32');
    StoryState.setWeather('despejado');
    banner('Dos semanas antes...', 'Una semana después de Salento');
    await host.wait(1800);
    host.goTo('bobo_lobby', 'ascensor');
  },

  /** La puerta del Bobo: el taxi amarillo espera afuera. */
  async taxi_m9(host) {
    if (has('m9_en_taxi')) return;
    host.setLocked(true);
    await host.say('m9_taxi_subir');
    set('m9_en_taxi');
    crew();
    playSfx('door');
    await host.fade(true, 600);
    host.goTo('taxi_m9', 'asiento');
  },

  /** El taxi: la ida (cinco tramos y las curvas de Cristo Rey) o la vuelta (con Roxane o con Laura y Ximena). */
  async viaje_taxi_m9(host) {
    if (has('m9_vuelta_roxane')) {
      await vueltaRoxane(host);
      return;
    }
    if (has('m9_vuelta_grupo')) {
      await vueltaGrupo(host);
      return;
    }
    if (has('m9_taxi_ida')) return;
    set('m9_taxi_ida');
    host.setLocked(true);
    playMusic('taxi_noche');
    await host.wait(500);
    await host.say('m9_taxi_puestos');
    set('m9_quimica_visible');
    for (const leg of TAXI_IDA) {
      banner(leg.title, leg.subtitle);
      host.shake(300, 0.0015);
      await clockTo(host, leg.at, 2200);
      if (leg.before) {
        playSfx('bus-brake');
        leg.before();
        await host.wait(500);
      }
      await host.say(leg.dialogue);
    }
    banner('Vía a Cristo Rey', 'Las curvas');
    await host.wait(900);
    const r = await fiesta('curvas');
    set('m9_curvas');
    if (r.good || r.skipped) set('m9_curvas_bien');
    if (r.perfect) set('m9_curvas_perfectas');
    playMusic('taxi_noche');
    await clockTo(host, 'sáb 22:22', 1200);
    await host.say('m9_curvas_post');
    clear('m9_quimica_visible');
    await host.fade(true, 700);
    host.goTo('casa_tami', 'llegada');
  },

  /** Llegar al portón de Tami (la escena con Tami y Steven); después Laura se va con los mexicanos. */
  async llegada_m9(host) {
    if (has('m9_en_casa')) return;
    host.setLocked(true);
    host.facePlayer('down');
    await host.wait(500);
    playMusic('fiesta');
    await host.say('m9_llegada');
    set('m9_en_casa');
    clockAt('sáb 22:25', 'sáb 22:45');
    host.setLocked(false);
  },

  /** La baranda del patio: Cali entera, los amigos, el juego de adivinar lugares y lo de Tami. */
  async mirador_m9(host) {
    if (has('m9_mirador')) return;
    host.setLocked(true);
    host.placePlayer('mirador');
    host.facePlayer('down');
    await host.say('m9_mirador');
    set('m9_mirador');
    clockAt('sáb 22:50', 'dom+ 00:30');
    host.setLocked(false);
  },

  async beerpong_m9(host) {
    if (has('m9_beerpong')) return;
    host.setLocked(true);
    host.placePlayer('beerpong');
    const r = await fiesta('beerpong');
    set('m9_beerpong');
    if (r.good) set('m9_beerpong_gano');
    playMusic('fiesta');
    host.placePlayer('beerpong');
    await host.wait(300);
    await host.say('m9_beerpong_post');
    host.setLocked(false);
  },

  async cacho_m9(host) {
    if (has('m9_cacho')) return;
    host.setLocked(true);
    host.placePlayer('cacho');
    const r = await fiesta('cacho');
    set('m9_cacho');
    if (r.good) set('m9_cacho_gano');
    if (r.perfect) set('secreto_m9_quina');
    playMusic('fiesta');
    host.placePlayer('cacho');
    await host.wait(300);
    await host.say('m9_cacho_post');
    host.setLocked(false);
  },

  /** Bailar con Laura bajo la pérgola (después de la botella). Al terminar, te pasa su celular. */
  async baile_m9(host) {
    host.setLocked(true);
    host.placePlayer('pergola');
    const r = await new Promise<SalsaResult>((done) => EventSystem.emit('open-salsa', { partner: 'laura', done }));
    set('m9_bailo');
    if (r.score >= 2) set('m9_baile_bien', 'm9_q_baile');
    if (r.perfect) set('m9_baile_perfecto');
    playMusic('fiesta');
    host.placePlayer('pergola');
    await host.wait(300);
    await host.say('m9_baile_post');
    host.setLocked(false);
  },

  /** ¡A la piscina!: Roxane, la pelea de gallinas y el borde de la piscina (¿el beso?). */
  async piscina_m9(host) {
    if (has('m9_piscina')) return;
    host.setLocked(true);
    host.placePlayer('piscina');
    host.facePlayer('down');
    clockAt('dom+ 00:35', 'dom+ 01:40');
    await host.say('m9_piscina');
    const r = await fiesta('gallina');
    set('m9_piscina');
    if (r.good) set('m9_gallina_gano');
    playMusic('fiesta');
    host.placePlayer('piscina');
    await host.wait(300);
    await host.say('m9_gallina_post');
    if (has('m9_beso_roxane')) {
      crew('roxane');
      await host.say('m9_roxane_auto_obj');
      host.setLocked(false);
      return;
    }
    // Sin beso: Laura (y Ximena) se van, y tú con ellas.
    await clockTo(host, 'dom+ 01:50', 1000);
    await host.say('m9_irse');
    await host.fade(true, 800);
    crew();
    set('m9_vuelta_grupo');
    host.goTo('taxi_m9', 'asiento');
  },

  /** El estacionamiento con Roxane: dormir de lado en el auto y despertar con el amanecer. */
  async auto_m9(host) {
    if (has('m9_auto') || StoryState.hasItem('cel_laura')) return;
    host.setLocked(true);
    set('m9_auto');
    crew();
    host.placePlayer('auto');
    await host.say('m9_auto');
    await host.fade(true, 1600);
    playMusic(null);
    await host.wait(1200);
    clockSet('dom+ 05:40', 'dom+ 05:50');
    await host.fade(false, 1000);
    playMusic('recuerdo');
    await host.say('m9_amanecer');
    await host.fade(true, 800);
    set('m9_vuelta_roxane');
    host.goTo('taxi_m9', 'asiento');
  },

  /** De vuelta en el depa (con Roxane o después del ascensor con Laura): Fotogram, y el presente. */
  async casa_m9(host) {
    host.setLocked(true);
    await host.wait(600);
    playMusic('depa');
    await host.say(has('m9_beso_roxane') ? 'm9_bobo_roxane' : 'm9_ascensor_laura');
    await host.say('m9_fotogram_sigue');
    await host.fade(true, 1600);
    playSfx('rebobinar');
    // El presente: el mismo sábado en la noche, dos semanas después.
    clear('m9_recuerdo', 'm9_roxane_cama', 'm9_sigue_laura', 'm9_sigue_ximena', 'm9_sigue_roxane', 'm9_en_bobo');
    const v = quimica();
    Dialogue.vars.set('quimica', String(v));
    StoryState.setFlag('m9_final_alta', v >= ALTA);
    StoryState.setWeather('despejado');
    clockSet('sáb 23:15', 'sáb 23:30');
    host.placePlayer('sofa');
    await host.wait(800);
    await host.fade(false, 1000);
    await host.say('m9_presente');
    host.completeMission();
  },
};

/** Al amanecer, con Roxane dormida en tu hombro (y Don Hernán otra vez). */
async function vueltaRoxane(host: ScriptHost): Promise<void> {
  if (has('m9_en_bobo')) return;
  host.setLocked(true);
  playMusic('taxi_noche');
  clockSet('dom+ 06:00', 'dom+ 06:00');
  await host.wait(500);
  await host.say('m9_taxi_roxane');
  banner('Vía a Cristo Rey → el Bobo', 'Amaneciendo');
  await clockTo(host, 'dom+ 06:30', 2600);
  await host.fade(true, 900);
  set('m9_en_bobo', 'm9_roxane_cama');
  host.goTo('bobo_piso8', 'sofa');
}

/** De madrugada, con Laura, Ximena y Mila (que se baja en Bochalema). */
async function vueltaGrupo(host: ScriptHost): Promise<void> {
  if (has('m9_en_bobo')) return;
  host.setLocked(true);
  playMusic('taxi_noche');
  clockSet('dom+ 01:55', 'dom+ 01:55');
  await host.wait(500);
  await host.say('m9_taxi_vuelta_grupo');
  banner('Bochalema → el Bobo', 'De madrugada');
  await clockTo(host, 'dom+ 02:40', 2600);
  await host.fade(true, 900);
  set('m9_en_bobo');
  host.goTo('bobo_piso8', 'puerta_dentro');
}
