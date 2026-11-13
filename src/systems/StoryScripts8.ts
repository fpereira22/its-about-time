import { playMusic, playSfx } from '../audio/sfx';
import type { AtraccionMode, AtraccionResult } from '../scenes/AtraccionScene';
import type { PinponResult } from '../scenes/PinponScene';
import type { PoolResult } from '../scenes/PoolScene';
import type { SalsaResult } from '../scenes/SalsaScene';
import { quimica } from '../ui/QuimicaMeter';
import { Dialogue } from './DialogueManager';
import { EventSystem } from './EventSystem';
import { advanceClock, parseClock } from './Mission';
import { StoryState } from './StoryState';
import type { ScriptHost } from './StoryScripts';

/**
 * Scripts de la misión 8 («Lo que pasó en Salento»), que es un recuerdo: pasó antes de la misión 7 pero se juega
 * después. El sábado en el depa, Fotogram muestra «hace tres semanas» y el juego vuelve al paseo de intercambio:
 * el bus a Salento sentado con Richi, la casita de los camarotes, el sábado en la plaza y el mercado con Juanpa y
 * Renzo, la chiva al Parque del Café (el Krater con Flor, el Barco, los chocones y la Rueda), el domingo con el
 * mercado, el pimpón y el tejo, y la noche: la Calle Real, el baile, la disco chiquita, el pool con Danilo, Tami
 * y el «¿y si...?», y la plaza con los mexicanos y Laura, el tequila y el Grito a las doce.
 * Se suman a SCRIPTS en StoryScripts.ts.
 */

type Script = (host: ScriptHost, data: Record<string, unknown>) => Promise<void> | void;

function clockTo(host: ScriptHost, at: string, ms: number): Promise<void> {
  return advanceClock(parseClock(at), ms, (w) => host.wait(w));
}

/** Pone el reloj en `at` (si todavía no llega) y su tope en `max`. */
function clockAt(at: string, max?: string): void {
  const t = Math.max(StoryState.clock, parseClock(at));
  StoryState.setClock(t, max ? Math.max(t, parseClock(max)) : t);
}

/** Pone el reloj exactamente en `at` (aunque sea "antes": el recuerdo vuelve atrás). */
function clockSet(at: string, max?: string): void {
  const t = parseClock(at);
  StoryState.setClock(t, max ? parseClock(max) : t);
}

function set(...flags: string[]): void {
  for (const f of flags) StoryState.setFlag(f);
}

function clear(...flags: string[]): void {
  for (const f of flags) StoryState.setFlag(f, false);
}

function takeFlag(flag: string): boolean {
  const had = StoryState.hasFlag(flag);
  StoryState.setFlag(flag, false);
  return had;
}

/** Los que caminan contigo (flags `m8_sigue_<id>`): se reemplaza la fila entera. */
function crew(...ids: string[]): void {
  for (const id of ['richi', 'juanpa', 'renzo', 'danilo', 'tami', 'laura', 'flor', 'meli']) StoryState.setFlag(`m8_sigue_${id}`, ids.includes(id));
}

function banner(title: string, subtitle?: string): void {
  EventSystem.emit('banner', { title, subtitle });
}

function atraccion(mode: AtraccionMode): Promise<AtraccionResult> {
  return new Promise<AtraccionResult>((done) => EventSystem.emit('open-atraccion', { mode, done }));
}

/** Química con Laura con la que se cuenta el final alto («Agur, chileno»). */
const ALTA = 6;

/** El bus de Cali a Salento, tramo por tramo (sentado con Richi). */
const BUS_LEGS: Array<{ title: string; subtitle: string; at: string; dialogue: string }> = [
  { title: 'Recta Cali–Palmira', subtitle: 'Expreso Cafetero · Cali → Salento', at: 'vie 14:05', dialogue: 'm8_viaje_1' },
  { title: 'Buga', subtitle: 'La Basílica, a lo lejos', at: 'vie 15:00', dialogue: 'm8_viaje_2' },
  { title: 'Tuluá – La Paila', subtitle: 'Cañaduzales a los dos lados', at: 'vie 16:05', dialogue: 'm8_viaje_3' },
  { title: 'Subiendo la cordillera', subtitle: 'Entrando al Quindío', at: 'vie 17:10', dialogue: 'm8_viaje_4' },
  { title: 'Armenia', subtitle: 'La ciudad milagro', at: 'vie 18:05', dialogue: 'm8_viaje_5' },
  { title: 'Boquía', subtitle: 'El río Quindío y la neblina', at: 'vie 18:45', dialogue: 'm8_viaje_6' },
];

const CHIVA_IDA: Array<{ title: string; subtitle: string; at: string; dialogue?: string }> = [
  { title: 'Salento → Armenia', subtitle: 'En chiva, por la vía de Boquía', at: 'sáb 13:55', dialogue: 'm8_chiva_1' },
  { title: 'Armenia', subtitle: 'Bordeando la ciudad', at: 'sáb 14:15', dialogue: 'm8_chiva_2' },
  { title: 'Montenegro', subtitle: 'Kilómetro 6, vía a Pueblo Tapao', at: 'sáb 14:35', dialogue: 'm8_chiva_3' },
];

export const M8_SCRIPTS: Record<string, Script> = {
  /** El presente: el recuerdo de Fotogram. Fundido y... tres semanas antes, el bus en la Terminal de Cali. */
  async recuerdo_m8(host) {
    host.setLocked(true);
    playSfx('rebobinar');
    await host.fade(true, 1400);
    set('m8_recuerdo');
    playMusic('recuerdo');
    clockSet('vie 13:20', 'vie 13:40');
    StoryState.setWeather('despejado');
    banner('Tres semanas antes...', 'El paseo de los de intercambio');
    await host.wait(1800);
    host.goTo('bus_salento', 'puerta');
  },

  /** Sentado con Richi: el bus de Cali a Salento, tramo por tramo, hasta la Terminal de Salento. */
  async bus_salento_m8(host) {
    if (StoryState.hasFlag('m8_en_salento') || StoryState.hasFlag('m8_viajando')) return;
    host.setLocked(true);
    set('m8_viajando');
    playMusic('salento');
    await host.say('m8_bus_sentarse');
    for (const leg of BUS_LEGS) {
      banner(leg.title, leg.subtitle);
      host.shake(300, 0.0015);
      await clockTo(host, leg.at, 2400);
      await host.say(leg.dialogue);
    }
    await host.fade(true, 900);
    set('m8_en_salento', 'm8_frio');
    clear('m8_viajando');
    StoryState.setWeather('nublado');
    clockSet('vie 19:05', 'vie 19:40');
    crew('richi', 'juanpa', 'renzo', 'danilo', 'tami');
    host.goTo('salento', 'terminal');
  },

  /** Acostarse en el camarote. Viernes → sábado, sábado → domingo, domingo (de madrugada) → el presente. */
  async dormir_m8(host, data) {
    host.setLocked(true);
    const arriba = data.cama === 'arriba';
    if (!StoryState.hasFlag('m8_sabado')) {
      set(arriba ? 'm8_cama_arriba' : 'm8_cama_abajo');
      playMusic('casita');
      await host.say('m8_noche_camarotes');
      await host.fade(true, 1400);
      playMusic(null);
      await host.say('m8_noche_sueno');
      clockSet('sáb 07:45', 'sáb 12:25');
      StoryState.setWeather('despejado');
      set('m8_sabado');
      host.placePlayer(arriba ? 'cama_arriba' : 'cama');
      await host.fade(false, 1000);
      playMusic('casita');
      await host.say('m8_sabado_despierta');
      crew('juanpa', 'renzo');
      host.setLocked(false);
      return;
    }
    if (StoryState.hasFlag('m8_vuelta_parque') && !StoryState.hasFlag('m8_domingo')) {
      if (!StoryState.hasFlag('m8_cena_sabado')) {
        await host.say('m8_aun_no_dormir');
        host.setLocked(false);
        return;
      }
      await host.say('m8_noche_sabado');
      await host.fade(true, 1400);
      playMusic(null);
      clockSet('dom+ 08:50', 'dom+ 11:30');
      StoryState.setWeather('lluvia');
      set('m8_domingo', 'm8_mercado_domingo');
      clear('m8_vuelta_parque');
      crew();
      host.placePlayer(arriba || StoryState.hasFlag('m8_cama_arriba') ? 'cama_arriba' : 'cama');
      await host.fade(false, 1000);
      playMusic('casita');
      await host.say('m8_domingo_despierta');
      host.setLocked(false);
      return;
    }
    if (StoryState.hasFlag('m8_vuelta_plaza')) {
      await finalM8(host);
      return;
    }
    await host.say('m8_aun_no_dormir');
    host.setLocked(false);
  },

  /** Sábado al mediodía: la trucha frente a la plaza con Juanpa y Renzo. */
  async almuerzo_m8(host) {
    if (StoryState.hasFlag('m8_almorzo')) return;
    host.setLocked(true);
    clockAt('sáb 12:30', 'sáb 12:30');
    await host.say('m8_trucha');
    await clockTo(host, 'sáb 13:15', 1200);
    set('m8_almorzo');
    await host.say('m8_trucha_fin');
    StoryState.setClock(StoryState.clock, parseClock('sáb 13:35'));
    host.setLocked(false);
  },

  /** Subirse a la chiva (ida al Parque del Café o vuelta a Salento). */
  async chiva_m8(host) {
    host.setLocked(true);
    playSfx('bus-brake');
    await host.fade(true, 600);
    crew();
    host.goTo('chiva', 'asiento');
  },

  /** El viaje en chiva: ida (con las canciones) o vuelta (de noche, cansados). */
  async viaje_chiva_m8(host) {
    host.setLocked(true);
    playMusic('chiva');
    if (!StoryState.hasFlag('m8_en_parque')) {
      for (const leg of CHIVA_IDA) {
        banner(leg.title, leg.subtitle);
        host.shake(400, 0.003);
        await clockTo(host, leg.at, 2200);
        if (leg.dialogue) await host.say(leg.dialogue);
      }
      await host.fade(true, 700);
      set('m8_en_parque');
      clear('m8_frio');
      StoryState.setWeather('despejado');
      clockSet('sáb 14:40', 'sáb 17:50');
      crew('juanpa', 'renzo');
      host.goTo('parque_cafe', 'llegada');
      return;
    }
    banner('Montenegro → Salento', 'De noche, en chiva');
    await clockTo(host, 'sáb 18:40', 2400);
    await host.say('m8_chiva_vuelta_1');
    banner('Boquía', 'Ya casi');
    await clockTo(host, 'sáb 19:25', 2200);
    await host.say('m8_chiva_vuelta_2');
    await host.fade(true, 700);
    clear('m8_en_parque');
    set('m8_vuelta_parque', 'm8_frio');
    StoryState.setWeather('nublado');
    clockSet('sáb 19:35', 'sáb 21:30');
    crew('richi');
    host.goTo('salento', 'chiva');
  },

  /** El Krater con Flor (y la foto). */
  async krater_m8(host) {
    host.setLocked(true);
    clear('m8_sigue_flor', 'm8_sigue_meli');
    await host.say('m8_krater_fila');
    const r = await atraccion('krater');
    set('m8_krater');
    if (!r.skipped) {
      StoryState.addItem('foto_krater');
      set(`m8_foto_${r.photo ?? 'panico'}`);
      if (r.good) set('m8_flor_krater');
    } else set('m8_krater_cobarde');
    Dialogue.vars.set('valentia', String(r.score));
    await host.wait(300);
    await host.say('m8_krater_post');
    if (!StoryState.hasFlag('m8_con_argentinas')) set('m8_con_argentinas');
    crew('juanpa', 'renzo', 'flor', 'meli');
    host.setLocked(false);
  },

  async barco_m8(host) {
    host.setLocked(true);
    await host.say('m8_barco_fila');
    const r = await atraccion('barco');
    set('m8_barco');
    if (r.good) set('m8_barco_ok');
    if (r.score === 3) set('m8_barco_fierro');
    await host.wait(300);
    await host.say('m8_barco_post');
    host.setLocked(false);
  },

  async chocones_m8(host) {
    host.setLocked(true);
    await host.say('m8_chocones_fila');
    const r = await atraccion('chocones');
    set('m8_chocones');
    Dialogue.vars.set('choques', String(r.score));
    if (r.good) set('m8_chocones_ok');
    if (r.hitFlor) set('m8_flor_chocones');
    await host.wait(300);
    await host.say('m8_chocones_post');
    host.setLocked(false);
  },

  /** La Rueda Panorámica con Flor, al atardecer: arriba de todo... y quién sabe. Después cierra el parque. */
  async rueda_m8(host) {
    if (StoryState.hasFlag('m8_rueda')) return;
    host.setLocked(true);
    clockAt('sáb 17:20', 'sáb 17:50');
    crew('juanpa', 'renzo');
    playMusic('recuerdo');
    await host.say('m8_rueda');
    // Mientras sube: el celular y el paisaje (y una selfie con Flor, si te mira).
    const fotos = await atraccion('rueda');
    if (!fotos.skipped && (fotos.photos?.length ?? 0) >= 6) set('m8_fotos_rueda');
    if (fotos.selfie) set('m8_selfie_flor', 'secreto_m8_selfie_flor');
    await clockTo(host, 'sáb 17:40', 1600);
    await host.say('m8_rueda_arriba');
    host.shake(500, 0.004);
    playSfx('golpe');
    await host.say('m8_rueda_frenazo');
    set('m8_rueda');
    playMusic('parque');
    await host.say('m8_parque_cierra');
    set('m8_parque_cerrando');
    crew('juanpa', 'renzo');
    StoryState.setClock(StoryState.clock, parseClock('sáb 18:05'));
    host.setLocked(false);
  },

  /** El Yippe, la montaña rusa de los niños, con Renzo. */
  async yippe_m8(host) {
    host.setLocked(true);
    const r = await atraccion('yippe');
    host.setLocked(false);
    if (r.skipped) return;
    set('m8_yippe');
    if (r.good) set('m8_yippe_ok');
    Dialogue.vars.set('valentia', String(r.score));
    await host.wait(300);
    await host.say('m8_yippe_post');
  },

  /** Los Rápidos: ¿quién se moja? */
  async rapidos_m8(host) {
    host.setLocked(true);
    const r = await atraccion('rapidos');
    host.setLocked(false);
    if (r.skipped) return;
    set('m8_rapidos');
    StoryState.setFlag('m8_rapidos_seco', (r.wet ?? 0) < 25);
    if ((r.wet ?? 0) >= 40) set('mojado');
    if (r.renzoWet) set('m8_rapidos_renzo', 'secreto_m8_renzo_mojado');
    Dialogue.vars.set('mojado', String(r.wet ?? 0));
    await host.wait(300);
    await host.say('m8_rapidos_post');
  },

  /** El Lago de Fábulas: botes chocones con cañón de agua. */
  async fabulas_m8(host) {
    host.setLocked(true);
    const r = await atraccion('fabulas');
    host.setLocked(false);
    if (r.skipped) return;
    set('m8_fabulas');
    if (r.good) set('m8_fabulas_ok');
    Dialogue.vars.set('mojaste', String(r.score));
    await host.wait(300);
    await host.say('m8_fabulas_post');
  },

  /** El Tren del Café: saludar y pitar desde la ventana. */
  async tren_m8(host) {
    host.setLocked(true);
    const r = await atraccion('tren');
    host.setLocked(false);
    if (r.skipped) return;
    set('m8_tren');
    if (r.good) set('m8_tren_ok');
    Dialogue.vars.set('saludos', String(r.score));
    await host.wait(300);
    await host.say('m8_tren_post');
  },

  /** El Show del Café: el pasillo con la bailarina (Tami aplaude). */
  async show_m8(host) {
    host.setLocked(true);
    const r = await atraccion('show');
    host.setLocked(false);
    if (r.skipped) {
      await host.say('m8_show_nervios');
      return;
    }
    set('m8_show_bailo', 'm8_tami_show');
    if (r.good) set('m8_show_ok');
    Dialogue.vars.set('pasos', String(r.score));
    await host.wait(300);
    await host.say('m8_show_post');
  },

  /** El Ciclón: las sillas voladoras y los banderines. */
  async ciclon_m8(host) {
    host.setLocked(true);
    const r = await atraccion('ciclon');
    host.setLocked(false);
    if (r.skipped) return;
    set('m8_ciclon');
    if (r.score >= 10) set('m8_ciclon_cholado');
    Dialogue.vars.set('banderines', String(r.score));
    await host.wait(300);
    await host.say('m8_ciclon_post');
  },

  /** El teleférico: fotos mientras cruza el cañón; el diálogo de llegada hace el warp (data.post). */
  async teleferico_m8(host, data) {
    host.setLocked(true);
    const r = await atraccion('teleferico');
    host.setLocked(false);
    if (!r.skipped && (r.photos?.length ?? 0) >= 6) set('m8_fotos_teleferico');
    Dialogue.vars.set('fotos', String(r.photos?.length ?? 0));
    await host.wait(300);
    await host.say(String(data.post ?? 'm8_teleferico_post_e'));
  },

  /** La Torre Mirador: el parque entero en el celular. */
  async torre_m8(host) {
    host.setLocked(true);
    const r = await atraccion('torre');
    host.setLocked(false);
    if (r.skipped) return;
    set('m8_torre');
    if ((r.photos?.length ?? 0) >= 6) set('m8_fotos_torre');
    Dialogue.vars.set('fotos', String(r.photos?.length ?? 0));
    await host.wait(300);
    await host.say('m8_torre_post');
  },

  /** El Recorrido Cafetero completo: sembrar, coger, despulpar, tostar, moler, colar y probar tu café. */
  async cafe_m8(host) {
    host.setLocked(true);
    const r = await atraccion('cafe');
    host.setLocked(false);
    if (r.skipped || !r.cafe) return;
    set('m8_cafe');
    StoryState.setFlag('m8_cafe_bueno', r.cafe.calidad >= 70);
    StoryState.setFlag('m8_cafe_quemado', r.cafe.tueste === 'quemado');
    if (r.cafe.calidad >= 85) set('secreto_m8_cafe');
    Dialogue.vars.set('calidad', String(r.cafe.calidad));
    Dialogue.vars.set('tueste', r.cafe.tueste);
    await host.wait(300);
    await host.say('m8_cafe_post');
  },

  /** Domingo: el torneo de pimpón en el patio de la casita. */
  async pinpon_m8(host) {
    if (StoryState.hasFlag('m8_pinpon')) return;
    host.setLocked(true);
    host.placePlayer('pinpon');
    clockAt('dom+ 12:10', 'dom+ 12:10');
    await host.say('m8_pinpon_intro');
    const r = await new Promise<PinponResult>((done) => EventSystem.emit('open-pinpon', { done }));
    set('m8_pinpon');
    Dialogue.vars.set('ganados', String(r.wins));
    if (r.champion) set('m8_pinpon_campeon');
    if (r.beatRichi) set('m8_pinpon_richi');
    clockAt('dom+ 13:30', 'dom+ 13:30');
    playMusic('casita');
    host.placePlayer('pinpon');
    await host.wait(300);
    await host.say('m8_pinpon_post');
    clockAt('dom+ 15:00', 'dom+ 19:40');
    StoryState.setWeather('nublado');
    host.setLocked(false);
  },

  /** Domingo en la tarde: el tejo en Los Compadres con Juanpa (opcional). */
  async tejo_m8(host) {
    if (StoryState.hasFlag('m8_tejo')) return;
    host.setLocked(true);
    await host.say('m8_tejo_intro');
    const r = await atraccion('tejo');
    set('m8_tejo');
    Dialogue.vars.set('puntos', String(r.score));
    if (r.mecha) set('m8_tejo_mecha');
    if (r.score >= 9) set('secreto_m8_monona');
    await clockTo(host, '17:30', 900);
    playMusic('salento');
    await host.say('m8_tejo_post');
    host.setLocked(false);
  },

  /** Domingo de noche, en la Calle Real: bailar con quien invitaste (data.partner). */
  async baile_m8(host, data) {
    const partner = String(data.partner ?? 'tami');
    host.setLocked(true);
    const r = await new Promise<SalsaResult>((done) => EventSystem.emit('open-salsa', { partner, done }));
    set('m8_bailo', `m8_bailo_${partner}`);
    if (r.score >= 2) set('m8_baile_bien');
    if (r.perfect) set('m8_baile_perfecto');
    if (partner === 'tami') set('m8_tami_bailo');
    Dialogue.vars.set('pareja', partner === 'gladys' ? 'doña Gladys' : partner[0].toUpperCase() + partner.slice(1));
    playMusic('salento');
    await host.wait(300);
    await host.say(`m8_baile_post_${partner}`);
    host.setLocked(false);
  },

  /** La disco chiquita: no era tan buena. Se van con Danilo al bar de al lado. */
  async disco_m8(host) {
    if (StoryState.hasFlag('m8_disco_vista')) return;
    host.setLocked(true);
    await host.wait(400);
    await host.say('m8_disco');
    await clockTo(host, 'dom+ 22:55', 1400);
    await host.say('m8_disco_fin');
    set('m8_disco_vista', 'm8_bar_abierto');
    crew('danilo');
    host.setLocked(false);
  },

  /** Billares El Arriero: el pool con Danilo y la terapia. Después llega Tami. */
  async pool_m8(host) {
    if (StoryState.hasFlag('m8_pool')) return;
    host.setLocked(true);
    clear('m8_sigue_danilo');
    host.placePlayer('mesa');
    await host.say('m8_pool_intro');
    const r = await new Promise<PoolResult>((done) => EventSystem.emit('open-pool', { done }));
    set('m8_pool');
    if (r.won) set('m8_pool_gano');
    if (r.double) set('m8_pool_doble');
    playMusic('billar');
    host.placePlayer('mesa');
    await host.wait(300);
    await host.say(r.won ? 'm8_pool_post_gano' : 'm8_pool_post_perdio');
    await clockTo(host, 'dom+ 23:25', 1400);
    await host.say('m8_terapia');
    await clockTo(host, 'dom+ 23:35', 1000);
    playSfx('door');
    await host.say('m8_tami_llega');
    if (takeFlag('_whatif')) {
      await whatIf(host);
      return;
    }
    await quedarseConDanilo(host);
  },

  /** La plaza a la medianoche: los mexicanos, Laura, el tequila y el Grito. */
  async plaza_m8(host) {
    if (StoryState.hasFlag('m8_plaza')) return;
    host.setLocked(true);
    set('m8_plaza');
    crew();
    host.placePlayer('plaza');
    host.facePlayer('up');
    await host.wait(1200);
    playMusic('mariachi');
    await host.say('m8_mexicanos');
    set('m8_quimica_visible');
    await host.say('m8_laura');
    await clockTo(host, 'dom+ 23:52', 1200);
    await host.say('m8_tequila');
    await host.say('m8_laura_charla');
    await clockTo(host, 'dom+ 23:59', 1200);
    await host.say('m8_cuenta_regresiva');
    clockSet('lun+ 00:00', 'lun+ 00:00');
    playSfx('grito_mx');
    host.shake(400, 0.004);
    await host.say('m8_grito');
    playSfx('grito_mx');
    await clockTo(host, 'lun+ 00:30', 1600);
    await host.say('m8_laura_final');
    await host.say('m8_despedidas');
    set('m8_vuelta_plaza');
    clear('m8_quimica_visible');
    crew('danilo');
    StoryState.setClock(StoryState.clock, parseClock('lun+ 00:55'));
    host.setLocked(false);
  },

  /** Los triggers de los dos camarotes libres de la casita. */
  async dormir_arriba_m8(host) {
    await M8_SCRIPTS.dormir_m8(host, { cama: 'arriba' });
  },
  async dormir_abajo_m8(host) {
    await M8_SCRIPTS.dormir_m8(host, { cama: 'abajo' });
  },

  /** Selector de etapas (admin): el «¿y si...?» directo, sin jugar el pool. */
  async whatif_m8(host) {
    await whatIf(host);
  },
};

/** Elegiste irte con Tami: el «¿y si...?». Al final se rebobina y vuelves al bar. */
async function whatIf(host: ScriptHost): Promise<void> {
  host.setLocked(true);
  set('m8_whatif');
  playSfx('rebobinar');
  await host.fade(true, 600);
  banner('¿Y si...?', 'Esto no pasó. O sí. Quién sabe.');
  playMusic('recuerdo');
  await host.wait(1200);
  host.placePlayer('entrada');
  await host.fade(false, 600);
  await host.say('m8_whatif_tami');
  const algo = StoryState.hasFlag('m8_whatif_algo');
  set(algo ? 'm8_whatif_visto_algo' : 'm8_whatif_visto_nada');
  await host.fade(true, 700);
  playSfx('rebobinar');
  host.shake(700, 0.01);
  await host.wait(900);
  host.placePlayer('mesa');
  await host.fade(false, 500);
  playMusic('billar');
  await host.say('m8_rebobinar');
  await quedarseConDanilo(host);
}

/** Lo que pasó de verdad: te quedas con Danilo, Tami se va, y a la plaza. */
async function quedarseConDanilo(host: ScriptHost): Promise<void> {
  host.setLocked(true);
  await host.say('m8_tami_se_va');
  set('m8_rumbo_plaza');
  crew('danilo');
  clockAt('dom+ 23:40', 'dom+ 23:45');
  host.setLocked(false);
}

/** De vuelta en el camarote, la última noche. Y de vuelta en el presente. */
async function finalM8(host: ScriptHost): Promise<void> {
  host.setLocked(true);
  crew();
  await host.say('m8_ultima_noche');
  await host.fade(true, 1600);
  playSfx('rebobinar');
  playMusic('recuerdo');
  await host.say('m8_lunes');
  // El presente: el depa del piso 8, el sábado (tres semanas después).
  clear('m8_recuerdo', 'm8_frio', 'm8_sigue_danilo');
  StoryState.setWeather('despejado');
  clockSet('sáb+ 10:40', 'sáb+ 11:00');
  const v = quimica();
  Dialogue.vars.set('quimica', String(v));
  StoryState.setFlag('m8_final_alta', v >= ALTA);
  set('m8_presente');
  host.goTo('bobo_piso8', 'cama');
}

/** El presente, de vuelta en el depa: el tinto de Sira, el piso 11 y el fin. Lo dispara el `enter` de bobo_piso8. */
export async function presenteM8(host: ScriptHost): Promise<void> {
  host.setLocked(true);
  await host.wait(800);
  playMusic('depa');
  await host.say('m8_presente');
  host.completeMission();
}

M8_SCRIPTS.presente_m8 = presenteM8;
