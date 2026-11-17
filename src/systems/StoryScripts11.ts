import { playMusic, playSfx } from '../audio/sfx';
import type { PaseoMode, PaseoResult } from '../scenes/PaseoScene';
import type { PinponResult } from '../scenes/PinponScene';
import type { SalsaResult } from '../scenes/SalsaScene';
import { quimica } from '../ui/QuimicaMeter';
import { Dialogue } from './DialogueManager';
import { EventSystem } from './EventSystem';
import { advanceClock, parseClock } from './Mission';
import { StoryState } from './StoryState';
import type { ScriptHost } from './StoryScripts';

/**
 * Scripts de la misión 10 «Luna llena en el 11» (en pantalla, Misión 9). Las flags, diálogos y viñetas usan el
 * prefijo `m11_` (el `m10_` ya lo usa el final de la misión 9 en el Pance).
 *
 * Sábado: Laura toca el 805 con pandebonos, la Itsisi (la biblioteca, el helado en la Plaza Samán), el pimpón del
 * lobby, Bakio, Txinparta y Walle. Lunes: la U solo, el fútbol 5 en el GLD y, de noche, el helado y la salsa en la
 * acera de la Farmadía. Jueves: natación con Sira; Danilo y Mila; San Antonio; el Al Toque del Pato; las pelis del
 * 1104, el balcón y la noche de luna. Viernes a domingo (Laura y Danilo en Calima): el mall, Begoña, la maqueta, la
 * salsoteca y los mensajes desde el lago. Domingo: el balcón con Danilo y la decisión; las salchipapas. Lunes
 * festivo: La Vorágine y la Chorrera del Indio (PaseoScene) y, de noche, las hamburguesas, la cama y el mensaje de
 * Sira. Se suman a SCRIPTS en StoryScripts.ts.
 */

type Script = (host: ScriptHost, data: Record<string, unknown>) => Promise<void> | void;

function clockTo(host: ScriptHost, at: string, ms: number): Promise<void> {
  return advanceClock(parseClock(at), ms, (w) => host.wait(w));
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

const CREW = ['laura', 'danilo', 'mila', 'laura_bano', 'danilo_bano', 'mila_bano', 'sira_m7', 'majo', 'cata', 'fiorella', 'ariana'];

/** Quiénes caminan contigo (flags `m11_sigue_<id>`). */
function crew(...ids: string[]): void {
  for (const id of CREW) StoryState.setFlag(`m11_sigue_${id}`, ids.includes(id));
}

/** Los que te siguen, para volver a armar la fila después de mover al jugador. */
function crewNow(): string[] {
  return CREW.filter((id) => has(`m11_sigue_${id}`));
}

async function regroup(host: ScriptHost, spawn: string): Promise<void> {
  const ids = crewNow();
  crew();
  host.placePlayer(spawn);
  await host.wait(60);
  crew(...ids);
}

function banner(title: string, subtitle?: string): void {
  EventSystem.emit('banner', { title, subtitle });
}

function paseo(mode: PaseoMode): Promise<PaseoResult> {
  return new Promise((done) => EventSystem.emit('open-paseo', { mode, done }));
}

function salsa(partner: string): Promise<SalsaResult> {
  return new Promise((done) => EventSystem.emit('open-salsa', { partner, done }));
}

async function legs(host: ScriptHost, list: Array<{ title: string; subtitle: string; at: string; dialogue?: string }>): Promise<void> {
  for (const leg of list) {
    banner(leg.title, leg.subtitle);
    host.shake(300, 0.0015);
    await clockTo(host, leg.at, 2200);
    if (leg.dialogue) await host.say(leg.dialogue);
  }
}

/** Un día que pasa: fundido, cartel, la hora nueva y el jugador en `spawn`. */
async function nuevoDia(host: ScriptHost, title: string, subtitle: string, at: string, max: string, spawn: string): Promise<void> {
  host.setLocked(true);
  await host.fade(true, 1200);
  playMusic(null);
  clockSet(at, max);
  banner(title, subtitle);
  host.placePlayer(spawn);
  await host.wait(1400);
  await host.fade(false, 1000);
  playMusic('depa');
}

export const M11_SCRIPTS: Record<string, Script> = {
  /** El ascensor del Bobo: lobby, piso 8 o piso 11. */
  async ascensor_m11(host, data) {
    const to = String(data.to ?? 'lobby');
    while (Dialogue.active) await host.wait(100);
    host.setLocked(true);
    banner(to === 'lobby' ? 'Bajando al lobby...' : to === 'piso11' ? 'Subiendo al 11...' : 'Al piso 8...', 'Ascensor del Bobo Unic Living');
    playMusic('ascensor');
    await host.wait(1000);
    playSfx('elevator');
    host.goTo(to === 'lobby' ? 'bobo_lobby' : to === 'piso11' ? 'bobo_piso11' : 'bobo_piso8', 'ascensor');
  },

  /** El pimpón contra Laura en la mesa nueva del lobby; después, el sofá: Bakio, Txinparta y Walle. */
  async pinpon_m11(host) {
    host.setLocked(true);
    const r = await new Promise<PinponResult>((done) => EventSystem.emit('open-pinpon', { rival: 'laura', done }));
    set('m11_pinpon');
    if (r.wins >= 1) {
      set('m11_pinpon_gano');
      await host.say('m11_pinpon_gana');
    } else await host.say('m11_pinpon_pierde');
    await host.wait(400);
    await host.say('m11_bakio');
    host.setLocked(false);
  },

  /** La cama del 805: según lo que ya pasó, salta al día siguiente (o todavía no es hora). */
  async dormir_m11(host) {
    if (Dialogue.active) return;
    if (has('m11_dia1_fin') && !has('m11_lunes')) {
      await nuevoDia(host, 'Domingo', 'Un día cualquiera', 'dom+ 17:50', 'dom+ 18:30', 'cama');
      await host.say('m11_domingo');
      await nuevoDia(host, 'Lunes', 'A la U, solo', 'lun+ 07:20', 'lun+ 08:00', 'cama');
      await host.say('m11_lunes');
      host.setLocked(false);
      return;
    }
    if (has('m11_dia2_fin') && !has('m11_jueves')) {
      await nuevoDia(host, 'Martes · Miércoles', 'Dos chats abiertos', 'mié+ 22:00', 'mié+ 23:00', 'cama');
      await host.say('m11_martes_miercoles');
      await nuevoDia(host, 'Jueves', 'Natación a las 7', 'jue+ 18:20', 'jue+ 19:00', 'cama');
      await host.say('m11_jueves');
      host.setLocked(false);
      return;
    }
    if (has('m11_viernes_fin') && !has('m11_sabado')) {
      await nuevoDia(host, 'Sábado', 'Laura y Danilo en Calima · día 2', 'sáb+ 09:30', 'sáb+ 10:30', 'cama');
      await host.say('m11_sabado_calima');
      host.setLocked(false);
      return;
    }
    if (has('m11_sabado_fin') && !has('m11_domingo_vuelta')) {
      await nuevoDia(host, 'Domingo', 'Hoy vuelven de Calima', 'dom++ 11:00', 'dom++ 17:20', 'cama');
      await host.say('m11_domingo_calima');
      host.setLocked(false);
      return;
    }
    if (has('m11_salchipapa') && !has('m11_festivo')) {
      await nuevoDia(host, 'Lunes festivo', 'La Vorágine', 'lun++ 07:15', 'lun++ 08:00', 'cama');
      await host.say('m11_festivo');
      host.setLocked(false);
      return;
    }
    if (!has('m11_a_la_cama')) await host.say('m11_dormir_no');
  },

  /** El fútbol 5 en la sintética del GLD. */
  async futbol_m11(host) {
    host.setLocked(true);
    const r = await new Promise<{ us: number; them: number }>((done) => EventSystem.emit('open-futbol', { cinco: true, done }));
    if (r.us > r.them) await host.say('m11_futbol_gana');
    else await host.say('m11_futbol_pierde');
    await host.wait(400);
    await host.say('m11_futbol_despues');
    host.setLocked(false);
  },

  /** La salsa en la acera de la Farmadía, con la música de la tienda de al lado. */
  async salsa_farma_m11(host) {
    host.setLocked(true);
    const r = await salsa('laura_farma');
    if (r.score >= 2) set('m11_salsa_farma_bien');
    playMusic('depa');
    await host.say('m11_salsa_farma_despues');
    crew('laura');
    host.setLocked(false);
  },

  /** La clase de natación del jueves, con Sira. */
  async natacion_m11(host) {
    host.setLocked(true);
    const r = await new Promise<{ perfect: boolean }>((done) => EventSystem.emit('open-natacion', { done }));
    if (r.perfect) set('m11_natacion_perfecta');
    await host.say('m11_natacion_despues');
    host.setLocked(false);
  },

  /** Subirse al carro de Danilo (Mila de copiloto, Laura atrás contigo). */
  async carro_m11(host) {
    host.setLocked(true);
    set('m11_carro');
    crew();
    playSfx('door');
    await host.fade(true, 600);
    host.goTo('carro_danilo', 'atras');
  },

  async viaje_carro_m11(host) {
    if (has('m11_carro_llego')) return;
    host.setLocked(true);
    playMusic('salsa');
    await host.wait(400);
    await legs(host, [
      { title: 'El Bobo → Avenida Cañasgordas', subtitle: 'En el carro de Danilo, de noche', at: 'jue+ 21:12', dialogue: 'm11_carro_1' },
      { title: 'Calle 5', subtitle: 'Hacia el centro', at: 'jue+ 21:25', dialogue: 'm11_carro_2' },
      { title: 'Calle 5 · Avenida Roosevelt', subtitle: 'Cali de noche', at: 'jue+ 21:34', dialogue: 'm11_carro_3' },
      { title: 'Subiendo a San Antonio', subtitle: 'El barrio de las casas viejas', at: 'jue+ 21:45', dialogue: 'm11_carro_4' },
    ]);
    set('m11_carro_llego');
    await host.fade(true, 700);
    crew('laura', 'danilo', 'mila');
    host.goTo('san_antonio', 'atrio');
  },

  /** Del mirador de San Antonio al Al Toque. */
  async resto_m11(host) {
    host.setLocked(true);
    await host.fade(true, 700);
    crew();
    playMusic('salsa');
    banner('San Antonio → Granada', 'En el carro de Danilo');
    await clockTo(host, 'jue+ 22:30', 1600);
    set('m11_en_resto');
    host.goTo('resto_chileno', 'entrada');
  },

  /** Del Al Toque al Bobo. */
  async vuelta_resto_m11(host) {
    host.setLocked(true);
    await host.fade(true, 700);
    playMusic('taxi_noche');
    banner('Granada → el Bobo', 'Medianoche en Cali');
    await clockTo(host, 'jue+ 23:30', 1800);
    set('m11_bobo_noche_go');
    host.goTo('bobo_cuadra', 'lobby');
  },

  /** La peli en el sofá del 1104. */
  async pelis_m11(host) {
    host.setLocked(true);
    await host.fade(true, 900);
    clockSet('jue+ 23:55', 'vie+ 00:10');
    host.placePlayer('sofa');
    banner('La peli', 'Depa 1104');
    await host.wait(900);
    await host.fade(false, 900);
    await host.say('m11_peli_durante');
    set('m11_peli_vista');
    clockSet('vie+ 01:10', 'vie+ 01:30');
    host.setLocked(false);
  },

  /** Del balcón al cuarto de Laura: la noche de luna llena. */
  async cuarto_m11(host) {
    host.setLocked(true);
    await host.fade(true, 1200);
    playMusic('recuerdo');
    clockSet('vie+ 01:40', 'vie+ 01:40');
    host.placePlayer('cama');
    await host.wait(800);
    await host.fade(false, 1400);
    await host.say('m11_luna');
  },

  /** La mañana del viernes: Laura se va a Calima con Danilo. */
  async manana_calima_m11(host) {
    host.setLocked(true);
    await host.fade(true, 1600);
    playMusic(null);
    clockSet('vie+ 06:40', 'vie+ 07:00');
    banner('Viernes', 'Laura se va a Calima');
    host.placePlayer('living');
    await host.wait(1400);
    await host.fade(false, 1000);
    playMusic('depa');
    await host.say('m11_manana_calima');
    host.setLocked(false);
  },

  /** Al volver al 805 el viernes: el día con Sira empieza. */
  async calima_vie_m11(host) {
    if (has('m11_viernes')) return;
    set('m11_viernes');
    host.setLocked(true);
    await host.fade(true, 900);
    clockSet('vie+ 10:12', 'vie+ 15:05');
    await host.wait(600);
    await host.fade(false, 900);
    await host.say('m11_viernes');
  },

  async mall_m11(host) {
    host.setLocked(true);
    await host.fade(true, 800);
    banner('C.C. Guayacán Plaza', 'Viernes en la tarde');
    clockSet('vie+ 15:40', 'vie+ 19:00');
    host.goTo('guayacan_plaza', 'puerta');
  },

  async mall_salida_m11(host) {
    host.setLocked(true);
    await host.fade(true, 900);
    crew();
    set('m11_mall_fin');
    clockSet('vie+ 22:40', 'vie+ 23:30');
    host.goTo('bobo_piso8', 'sofa');
  },

  /** La salsoteca de San Fernando con Sira, Majo y Cata. */
  async salsoteca_m11(host) {
    host.setLocked(true);
    await host.fade(true, 900);
    crew();
    clockSet('sáb+ 21:30', 'sáb+ 23:59');
    banner('Una salsoteca en San Fernando', 'Sábado en la noche');
    await host.wait(900);
    await host.fade(false, 700);
    await host.say('m11_salsoteca_llega');
    const r = await salsa('sira_salsoteca');
    if (r.perfect) set('m11_salsoteca_perfecta');
    clockSet('dom++ 01:00', 'dom++ 01:20');
    await host.say('m11_salsoteca_despues');
  },

  async sabado_noche_m11(host) {
    host.setLocked(true);
    await host.fade(true, 900);
    set('m11_salsoteca');
    clockSet('dom++ 01:40', 'dom++ 02:30');
    host.goTo('bobo_piso8', 'cama');
  },

  /** Los Uber de La Vorágine: de ida (al pueblo) y de vuelta (al Bobo). */
  async uber_m11(host, data) {
    host.setLocked(true);
    StoryState.setFlag('m11_uber_ida', data.tramo === 'ida');
    StoryState.setFlag('m11_uber_vuelta', data.tramo === 'vuelta');
    crew();
    playSfx('door');
    await host.fade(true, 700);
    host.goTo('uber_m11', 'asiento');
  },

  async viaje_uber_m11(host) {
    host.setLocked(true);
    playMusic('carro_danilo');
    await host.wait(400);
    if (has('m11_uber_ida') && !has('m11_en_voragine')) {
      await legs(host, [
        { title: 'El Bobo → Vía a Pance', subtitle: 'En Uber, lunes festivo', at: 'lun++ 08:20', dialogue: 'm11_uber_1' },
        { title: 'Vía a Pance', subtitle: 'Río arriba', at: 'lun++ 08:40', dialogue: 'm11_uber_2' },
        { title: 'La Vorágine', subtitle: 'Corregimiento de Pance', at: 'lun++ 08:55' },
      ]);
      await host.fade(true, 700);
      host.goTo('voragine', 'llegada');
      return;
    }
    if (has('m11_uber_vuelta') && !has('m11_uber_vuelta_llego')) {
      await host.say('m11_uber_vuelta_1');
      await legs(host, [
        { title: 'San Francisco → La Vorágine', subtitle: 'Bajando en campero', at: 'lun++ 18:10' },
        { title: 'Vía a Pance', subtitle: 'En Uber, de noche', at: 'lun++ 18:40' },
        { title: 'Calle 18', subtitle: 'El Bobo', at: 'lun++ 19:10', dialogue: 'm11_uber_vuelta_2' },
      ]);
      set('m11_uber_vuelta_llego');
      await host.fade(true, 700);
      host.goTo('bobo_lobby', 'entrada');
    }
  },

  /** El campero de La Vorágine a San Francisco por la trocha. */
  async trocha_m11(host) {
    host.setLocked(true);
    set('m11_trocha');
    crew();
    await host.fade(true, 700);
    banner('La Vorágine → San Francisco', 'En campero, por la vía destapada');
    const r = await paseo('trocha');
    if (r.together) set('m11_trocha_juntos', 'm11_ql_trocha_brazo');
    if (r.perfect) set('m11_trocha_perfecta');
    clockSet('lun++ 10:05', 'lun++ 11:30');
    set('m11_en_chorrera');
    crew('laura_bano', 'danilo_bano', 'mila_bano', 'fiorella', 'ariana');
    host.goTo('chorrera', 'llegada');
  },

  /** Los juegos del paseo: los patitos en La Vorágine y, en la Chorrera, el pozo, las piedras, la cascada, la truchera, la subida y la bajada. */
  async paseo_m11(host, data) {
    const mode = String(data.mode ?? 'salto') as PaseoMode;
    while (Dialogue.active) await host.wait(100);
    host.setLocked(true);
    const r = await paseo(mode);
    playMusic('rio');
    const flag = { salto: 'm11_salto', mano: 'm11_mano', cascada: 'm11_cascada', subida: 'm11_subida_hecha', bajada: 'm11_bajada' }[mode as 'salto'] ?? `m11_${mode}`;
    set(flag);
    if (r.good) set(`m11_${mode}_bien`);
    if (r.perfect) set(`m11_${mode}_perfecta`);
    if (r.together && r.good) set(`m11_${mode}_juntos`);
    if (mode === 'patitos') {
      // Mientras se llena el campero, en la playa de piedras de La Vorágine.
      clockSet('lun++ 09:40', 'lun++ 10:00');
      await host.say('m11_patitos_despues');
    } else if (mode === 'trucha') {
      // La truchera de don Efraín, antes del almuerzo donde doña Ofelia.
      clockSet('lun++ 12:50', 'lun++ 13:20');
      await host.say('m11_truchas_despues');
    } else if (mode === 'salto') {
      clockSet('lun++ 11:00', 'lun++ 11:40');
      await host.say('m11_pozo_despues');
    } else if (mode === 'mano') {
      await regroup(host, 'piedras_norte');
      await host.say('m11_piedras_despues');
    } else if (mode === 'cascada') {
      clockSet('lun++ 12:10', 'lun++ 13:00');
      await host.say('m11_cascada_despues');
    } else if (mode === 'subida') {
      await host.fade(true, 600);
      clockSet('lun++ 15:40', 'lun++ 16:00');
      await regroup(host, 'mirador');
      await host.fade(false, 600);
      await host.say('m11_mirador_pance');
      return;
    } else if (mode === 'bajada') {
      await host.fade(true, 700);
      clockSet('lun++ 17:30', 'lun++ 17:50');
      await regroup(host, 'llegada');
      await host.fade(false, 700);
      await host.say('m11_bajada_despues');
      return;
    }
    host.setLocked(false);
  },

  /** Las hamburguesas del 805. */
  async burger_m11(host) {
    host.setLocked(true);
    const r = await paseo('burger');
    if (r.good) set('m11_burger_bien');
    if (r.perfect) set('m11_burger_perfecta');
    playMusic('depa');
    clockSet('lun++ 21:20', 'lun++ 21:40');
    await host.say('m11_burger_despues');
  },

  /** La espera hasta que Laura toca la puerta (23:04). */
  async espera_m11(host) {
    host.setLocked(true);
    await clockTo(host, 'lun++ 21:40', 1500);
    await host.say('m11_espera_1');
    await clockTo(host, 'lun++ 22:15', 2000);
    await host.say('m11_espera_2');
    await clockTo(host, 'lun++ 22:51', 2000);
    await host.say('m11_espera_3');
    await clockTo(host, 'lun++ 23:04', 1500);
    playSfx('toc_toc');
    await host.wait(500);
    await host.say('m11_toc_final');
    clockSet('lun++ 23:40', 'mar++ 01:10');
    host.setLocked(false);
  },

  /** A la cama del 805, con Laura. */
  async cama_final_m11(host) {
    host.setLocked(true);
    await host.fade(true, 1200);
    playMusic('recuerdo');
    clockSet('mar++ 01:20', 'mar++ 01:47');
    host.placePlayer('cama');
    await host.wait(800);
    await host.fade(false, 1200);
    await host.say('m11_cama_final');
  },

  /** El final: la química con las dos y la pantalla de misión completa. */
  async final_m11(host) {
    host.setLocked(true);
    await host.fade(true, 1800);
    playMusic(null);
    Dialogue.vars.set('quimica', String(quimica('m11_ql_')));
    Dialogue.vars.set('quimica_sira', String(quimica('m11_qs_')));
    await host.wait(1200);
    host.completeMission();
  },
};
