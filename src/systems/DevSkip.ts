import Phaser from 'phaser';
import { MapScene } from '../scenes/MapScene';
import { Admin } from './Admin';
import { EventSystem } from './EventSystem';
import { parseClock } from './Mission';
import { currentOutfit } from './PlayerLook';
import { StoryState } from './StoryState';

/** Lo que el jugador ya habría hecho al bajarse del metro en Manuel Montt (misión 2). */
const M2_FLAGS = [
  'platos_retirados',
  'platos_lavados',
  'manana',
  'despierto',
  'vestido',
  'tiene_mochila',
  'salio_casa',
  'bip_cargada',
  'pago_tren',
  'tomo_tren',
  'tomo_metro',
];
const M2_CLEAR = ['en_pijama', 'sin_mochila', '_posponer'];
const FARE_TRAIN = 1060;
const FARE_METRO = 800;
const M2_ARRIVAL = 'lun 08:25';

/** Misión 3: cena, maleta (23 kg exactos) y viaje en auto hechos; se llega al aeropuerto. */
const M3_FLAGS = [
  'hablo_papa', 'hablo_mama', 'hablo_hermano', 'pidio', 'comio', 'cena_terminada', 'en_casa', 'dio_manjar',
  'junto_ropa', 'junto_zapatillas', 'junto_libros', 'junto_almohada', 'junto_neceser', 'junto_cargador',
  'maleta_ropa', 'maleta_zapatillas', 'maleta_libros', 'maleta_almohada', 'maleta_manjar', 'maleta_neceser',
  'maleta_cerrada', 'maleta_optima', 'llego_scl',
];
const M3_ARRIVAL = 'vie 22:55';

/** Misión 4: mañana, aguacero, almuerzo, polera y clase hechos; se llega a la cancha antes del partido. */
const M4_FLAGS = [
  'despierto', 'banado', 'vestido', 'tiene_mochila', 'desayuno', 'tomo_bus', 'llego_u', 'reunion_ok', 'comio_u',
  'tormenta_vista', 'volvio_casa', 'almorzo', 'tarde_u', 'polera', 'clase_ok',
  // Escenas de llegada ya vistas (si no, al llegar a la cancha se largaría el aguacero otra vez).
  'enter_pance_casa_despertar', 'enter_pance_casa_vuelve_mojado', 'enter_pucc_campus_tormenta', 'enter_pucc_campus_tarde',
];
const M4_CLEAR = ['en_pijama', 'sin_mochila', 'reloj_chile', 'desorientado', 'mojado'];
const M4_ARRIVAL = 'lun 16:20';

/** Misión 5: la mañana, la barbería y las llaves hechas; se llega al borde de la piscina en traje de baño. */
const M5_POOL_FLAGS = [
  'm5_desayuno', 'm5_llego_u', 'm5_estudio', 'm5_correo_equipo', 'm5_corte', 'corte_degradado', 'm5_grover_visto',
  'm5_llaves_listas', 'tomo_carro_grover', 'm5_en_deportivo', 'm5_entrada', 'en_bano', 'm5_en_bano', 'sin_mochila',
  'enter_pance_casa_m5_inicio', 'enter_pucc_piscina_llegada',
];
/** Y después de la piscina: Sira conocida, de vuelta en Pance, rumbo a la hamburguesería. */
const M5_BURGER_FLAGS = ['m5_nado', 'm5_vestido_post', 'm5_sira_conocida', 'm5_volvio_piscina', 'm5_sira_p1'];

/** Misión 6: el jueves, el sábado en Pance y el viaje hechos; se llega a Torre de Cali a las 3:58. */
const M6_CENTRO_FLAGS = [
  'm6_jueves_visto', 'm6_clase', 'm6_sabado', 'm6_consejo_mery', 'm6_mandado', 'm6_mandado_ok', 'm6_almorzo', 'm6_salio_casa',
  'm6_llego_universidades', 'm6_tomo_t31', 'enter_pucc_piscina_m6_jueves', 'enter_pance_casa_m6_sabado', 'enter_universidades_llegada',
  'tel_m6_grover_jueves', 'tel_m6_grover_sabado', 'llamada_grover_m6_sabado', 'm6_q_invitacion', 'm6_q_chat_manana',
];
/** Y después: la feria, la persecución y la heladería hechas; de noche en San Antonio, al pie de la escalinata. */
const M6_COLINA_FLAGS = [
  'm6_llego_centro', 'm6_con_sira', 'm6_sira_sigue', 'm6_firmado', 'm6_persecucion', 'm6_rumbo_helado', 'm6_helados_listos', 'm6_helado',
  'enter_centro_cali_llegada', 'enter_san_antonio_llegada', 'enter_heladeria_corazones_llegada', 'm6_q_rescate', 'm6_q_puntual', 'm6_q_cumplido',
];

/**
 * Atajo de prueba: Ctrl + < adelanta la misión 2 hasta la llegada a Manuel Montt
 * (casa, tren y metro hechos; pasajes descontados de la Bip!), la misión 3 hasta el aeropuerto
 * y la misión 4 hasta la cancha, justo antes del partido. Solo funciona en modo admin (src/systems/Admin.ts).
 */
class DevSkipImpl {
  private attached = false;

  attach(game: Phaser.Game): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', (e) => {
      if (!e.ctrlKey || (e.key !== '<' && e.code !== 'IntlBackslash')) return;
      // Solo en modo admin (siempre con npm run dev): un jugador normal no se salta partes.
      if (!Admin.active) return;
      e.preventDefault();
      if (StoryState.missionId === 'mission03') this.skipMission3(game);
      else if (StoryState.missionId === 'mission04') this.skipMission4(game);
      else if (StoryState.missionId === 'mission05') this.skipMission5(game);
      else if (StoryState.missionId === 'mission06') this.skipMission6(game);
      else this.skipMission2(game);
    });
  }

  /** La escena de mapa activa, si el jugador está libre (sin diálogo ni menú). */
  private freeScene(game: Phaser.Game): MapScene | undefined {
    const scene = game.scene
      .getScenes(true)
      .find((s): s is MapScene => s instanceof MapScene);
    if (!scene?.canOpenMenu) {
      EventSystem.emit('banner', { title: 'Atajo no disponible', subtitle: 'Cierra el diálogo o el menú primero' });
      return undefined;
    }
    return scene;
  }

  private skipMission3(game: Phaser.Game): void {
    const scene = this.freeScene(game);
    if (!scene || StoryState.hasFlag('llego_scl')) return;
    for (const item of ['carnet', 'maleta', 'marraqueta']) if (!StoryState.hasItem(item)) StoryState.addItem(item);
    if (StoryState.hasItem('manjar')) StoryState.removeItem('manjar');
    for (const f of M3_FLAGS) StoryState.setFlag(f);
    const at = parseClock(M3_ARRIVAL);
    StoryState.setClock(at, at);
    scene.goTo('scl_salidas', 'auto');
  }

  private skipMission4(game: Phaser.Game): void {
    const scene = this.freeScene(game);
    if (!scene || StoryState.hasFlag('partido_jugado')) return;
    for (const item of ['carnet_pucc', 'polera_pucc']) if (!StoryState.hasItem(item)) StoryState.addItem(item);
    for (const f of M4_CLEAR) StoryState.setFlag(f, false);
    for (const f of M4_FLAGS) StoryState.setFlag(f);
    StoryState.setOutfit({ ...currentOutfit(), shirt: '#2050a8' });
    StoryState.setWeather('despejado');
    const at = parseClock(M4_ARRIVAL);
    StoryState.setClock(at, parseClock('lun 16:30'));
    StoryState.setObjective('Partido a las 4:30: cancha de fútbol (al sur, junto al Cedro Rosado)');
    scene.goTo('pucc_campus', 'cancha');
  }

  /** Ctrl + < en la misión 5: primero al borde de la piscina (antes del Marco Polo); después, a Pance Burger. */
  private skipMission5(game: Phaser.Game): void {
    const scene = this.freeScene(game);
    if (!scene || StoryState.hasFlag('m5_cinco_jugado')) return;
    if (!StoryState.hasItem('carnet_pucc')) StoryState.addItem('carnet_pucc');
    for (const f of M5_POOL_FLAGS) StoryState.setFlag(f);
    StoryState.setOutfit({ ...currentOutfit(), hat: 'degradado' });
    StoryState.setWeather('despejado');
    if (!StoryState.hasFlag('m5_nado')) {
      StoryState.setClock(parseClock('mar 18:57'), parseClock('mar 18:59'));
      StoryState.setObjective('Ve al borde de la piscina (al sur de los carriles)');
      scene.goTo('pucc_piscina', 'borde');
      return;
    }
    for (const f of M5_BURGER_FLAGS) StoryState.setFlag(f);
    for (const f of ['en_bano', 'sin_mochila']) StoryState.setFlag(f, false);
    StoryState.setClock(parseClock('mar 20:58'), parseClock('mar 21:00'));
    StoryState.setObjective('Siéntate con tu equipo (mesa larga del fondo, frente al profe)');
    scene.goTo('pance_burger', 'puerta');
  }

  /** Ctrl + < en la misión 6: primero a Torre de Cali (justo antes de encontrarte con Sira); después, a la colina de noche. */
  private skipMission6(game: Phaser.Game): void {
    const scene = this.freeScene(game);
    if (!scene || StoryState.hasFlag('m6_mirador')) return;
    for (const f of ['en_bano', 'sin_mochila']) StoryState.setFlag(f, false);
    if (!StoryState.hasItem('tarjeta_recorre')) StoryState.addItem('tarjeta_recorre');
    for (const f of M6_CENTRO_FLAGS) StoryState.setFlag(f);
    StoryState.setWeather('despejado');
    if (!StoryState.hasFlag('m6_con_sira')) {
      StoryState.setClock(parseClock('sáb 15:58'), parseClock('sáb 17:30'));
      StoryState.setObjective('Camina a La Ermita (la iglesia blanca junto al río): Sira te espera afuera');
      scene.goTo('centro_cali', 'torre_cali');
      return;
    }
    for (const f of M6_COLINA_FLAGS) StoryState.setFlag(f);
    StoryState.setClock(parseClock('sáb 19:25'), parseClock('sáb 21:30'));
    StoryState.setObjective('Sube con Sira a la Colina de San Antonio (la escalinata de la Carrera 10)');
    scene.goTo('san_antonio', 'escalinata');
  }

  private skipMission2(game: Phaser.Game): void {
    if (StoryState.missionId !== 'mission02') return;
    const scene = this.freeScene(game);
    if (!scene) return;

    // Pasajes que faltan por pagar; se carga la Bip! con lo justo (en miles, como en la máquina).
    let fares = 0;
    if (!StoryState.hasFlag('tomo_metro')) fares += FARE_METRO;
    if (!StoryState.hasFlag('pago_tren')) fares += FARE_TRAIN;
    if (StoryState.bip < fares) {
      const charge = Math.ceil((fares - StoryState.bip) / 1000) * 1000;
      StoryState.spend(Math.min(charge, StoryState.money));
      StoryState.chargeBip(charge);
    }
    if (fares > 0) StoryState.payBip(fares);

    if (!StoryState.hasItem('mochila')) StoryState.addItem('mochila');
    for (const f of M2_CLEAR) StoryState.setFlag(f, false);
    for (const f of M2_FLAGS) StoryState.setFlag(f);
    const at = parseClock(M2_ARRIVAL);
    StoryState.setClock(at, at);
    scene.goTo('antonio_varas', 'metro');
  }
}

export const DevSkip = new DevSkipImpl();
