import { playMusic, playSfx } from '../audio/sfx';
import { TILE } from '../config/display';
import type { CincoResult } from '../scenes/CincoScene';
import type { PiscinaResult } from '../scenes/PiscinaScene';
import { EventSystem } from './EventSystem';
import { advanceClock, formatClock, parseClock } from './Mission';
import { currentOutfit } from './PlayerLook';
import { StoryState } from './StoryState';
import type { ScriptHost } from './StoryScripts';

/**
 * Scripts de la misión 5 («Un martes cualquiera»): estudiar en la biblioteca, el corte de pelo en la
 * Barbería 360, el cacharro de Grover, el Marco Polo en la piscina del Centro Deportivo (el «GLD») y la noche de
 * hamburguesas con el Equipo 5 (con el Cinco). Se suman a SCRIPTS en StoryScripts.ts.
 */

type Script = (host: ScriptHost, data: Record<string, unknown>) => Promise<void> | void;

/** Lee y borra una flag temporal (las que el diálogo usa para responderle al script). */
function takeFlag(flag: string): boolean {
  const had = StoryState.hasFlag(flag);
  StoryState.setFlag(flag, false);
  return had;
}

function clockTo(host: ScriptHost, at: string, ms: number): Promise<void> {
  return advanceClock(parseClock(at), ms, (w) => host.wait(w));
}

/** Los cortes de la Barbería 360: flag temporal del diálogo → peinado del ropero (PlayerLook.HATS) y flag del corte. */
const CORTES = [
  { temp: '_corte_mullet', hat: 'mullet', flag: 'corte_mullet' },
  { temp: '_corte_rapado', hat: 'rapado', flag: 'corte_rapado' },
  { temp: '_corte_degradado', hat: 'degradado', flag: 'corte_degradado' },
] as const;

/** Dónde queda estacionado el carro de Grover en el parqueadero principal de la PUCC (tiles). */
const CAR_SPOT = { x: 44, bottomRow: 2 };

/** Quiénes juegan el Cinco, en orden (0 = tú): para la flag de quién ganó. */
const CINCO_FLAGS = ['', '_cinco_profe', '_cinco_vale', '_cinco_sira', '_cinco_camilo'];

export const M5_SCRIPTS: Record<string, Script> = {
  /** La Sala de Estudio: tres preguntas de ruteo con capacidad mientras el reloj corre hasta el mediodía. */
  async estudiar_m5(host) {
    host.setLocked(true);
    await host.say('m5_estudio_inicio');
    EventSystem.emit('banner', { title: 'Estudiando...', subtitle: 'Ruteo con capacidad · Biblioteca, 2º piso' });
    await clockTo(host, 'mar 09:20', 1600);
    await host.say('m5_estudio_q1');
    await clockTo(host, 'mar 10:10', 1300);
    await host.say('m5_estudio_q2');
    await clockTo(host, 'mar 11:00', 1300);
    await host.say('m5_estudio_q3');
    await clockTo(host, 'mar 11:40', 1200);
    playSfx('phone');
    await host.say('m5_estudio_correo');
    await host.fade(true, 500);
    await clockTo(host, 'mar 11:55', 700);
    await host.fade(false, 500);
    await host.say('m5_estudio_fin');
    host.setLocked(false);
  },

  /**
   * El corte en la Barbería 360: sentado en la silla del medio, Fredy cuenta su vida (Chile, Dubái, Japón)
   * mientras el reloj corre tres horas. El corte que eliges cambia el peinado del jugador.
   */
  async corte_pelo(host) {
    host.setLocked(true);
    host.placePlayer('silla');
    playMusic('barberia');
    await host.wait(400);
    await host.say('m5_corte_1');
    const corte = CORTES.find((c) => takeFlag(c.temp)) ?? CORTES[2];
    for (const c of CORTES) takeFlag(c.temp);
    await clockTo(host, 'mar 13:40', 1500);
    await host.say('m5_corte_2');
    await clockTo(host, 'mar 14:50', 1500);
    await host.say('m5_corte_3');
    await host.fade(true, 700);
    playSfx('maquina');
    EventSystem.emit('banner', { title: '«Veinte minuticos»', subtitle: 'Fredy sigue hablando...' });
    await clockTo(host, 'mar 15:40', 2200);
    StoryState.setFlag(corte.flag);
    StoryState.setOutfit({ ...currentOutfit(), hat: corte.hat });
    await host.fade(false, 700);
    await host.say('m5_corte_espejo');
    host.setLocked(false);
  },

  /** El cacharro de Grover estacionado en el parqueadero principal (se dibuja cada vez que se entra al campus). */
  async carro_grover_estacionado(host) {
    const x = CAR_SPOT.x * TILE + 15;
    await host.drive({ texture: 'carro_grover', bottomTileY: CAR_SPOT.bottomRow, xFrom: x, xTo: x, ms: 1 });
  },

  /** Con las llaves: el cacharro arranca a la tercera y parten al Centro Deportivo (está al otro lado del campus, pero Grover no camina). */
  async grover_arranca(host) {
    host.setLocked(true);
    playSfx('bocina_grover');
    await host.wait(700);
    await host.fade(true, 700);
    StoryState.setFlag('tomo_carro_grover');
    StoryState.setObjective('Viaja con Grover al GLD (Centro Deportivo)');
    host.goTo('carro_grover', 'asiento');
  },

  /** De vuelta a Pance en el cacharro, después de conocer a Sira. */
  async grover_vuelta(host) {
    host.setLocked(true);
    playSfx('bocina_grover');
    await host.fade(true, 700);
    StoryState.setObjective('Vuelve a Pance en el cacharro de Grover');
    host.goTo('carro_grover', 'asiento');
  },

  /** A las 7 liberan los carriles 7 y 8: Marco Polo con Grover en su propia escena (PiscinaScene). */
  async piscina_m5(host) {
    host.setLocked(true);
    const at = parseClock('mar 19:00');
    if (StoryState.clock < at) {
      EventSystem.emit('banner', { title: 'Esperando las siete...', subtitle: `Carriles libres a las ${formatClock(at)}` });
      await advanceClock(at, 2400, (ms) => host.wait(ms));
    }
    await host.say('m5_piscina_agua');
    const result = await new Promise<PiscinaResult>((done) => EventSystem.emit('open-piscina', { done }));
    if (result.swam25) StoryState.setFlag('m5_25m');
    // El que es Marco cuando suena el silbato pierde (el diálogo y la viñeta del final lo cuentan).
    StoryState.setFlag('m5_marco_gane', result.winner === 'you');
    StoryState.setFlag('m5_marco_perdi', result.winner === 'grover');
    StoryState.setClock(parseClock('mar 19:58'), parseClock('mar 20:00'));
    host.placePlayer('borde');
    playMusic('piscina');
    await host.wait(400);
    await host.say('m5_piscina_fin');
    host.setLocked(false);
  },

  /**
   * Pance Burger, sentado frente al profe: pedir, presentarse, la llegada de Sira (¡es S. Martínez!),
   * el Cinco (CincoScene) y, cuando el resto se va, la conversación a solas que termina en su Instagram.
   */
  async hamburguesas(host) {
    if (StoryState.hasFlag('m5_cinco_jugado')) return;
    host.setLocked(true);
    StoryState.setObjective('Conoce al Equipo 5 (y come algo)');
    StoryState.setClock(Math.max(StoryState.clock, parseClock('mar 21:05')), parseClock('mar 21:20'));
    await host.wait(300);
    await host.say('m5_burger_pedir');
    await clockTo(host, 'mar 21:20', 800);
    for (const d of ['m5_presenta_profe', 'm5_presenta_vale', 'm5_presenta_camilo', 'm5_presenta_tu']) await host.say(d);
    StoryState.setFlag('m5_sira_llega');
    playMusic('sira');
    await host.wait(500);
    await host.say('m5_sira_llega');
    playMusic('hamburguesas');
    await clockTo(host, 'mar 21:45', 700);
    await host.say('m5_cinco_intro');
    const result = await new Promise<CincoResult>((done) => EventSystem.emit('open-cinco', { done }));
    StoryState.setFlag('m5_cinco_jugado');
    if (result.mesaPerfecta) StoryState.setFlag('m5_mesa_perfecta');
    StoryState.setClock(Math.max(StoryState.clock, parseClock('mar 22:15')), parseClock('mar 22:20'));
    if (result.winner === 0) {
      await host.say('m5_cinco_gano');
    } else {
      StoryState.setFlag(CINCO_FLAGS[result.winner] || '_cinco_camilo');
      await host.say('m5_cinco_perdio');
      for (const f of CINCO_FLAGS) if (f) takeFlag(f);
    }
    await host.say('m5_despedida_equipo');
    playMusic('sira');
    await host.wait(600);
    await host.say('m5_coqueteo');
    playMusic('hamburguesas');
    host.setLocked(false);
  },
};
