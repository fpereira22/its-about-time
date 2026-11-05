import type { Direction } from '../types/map';
import type { GameMap } from './GameMap';

/**
 * Cómo se ve alguien sentado en un tipo de asiento: hacia dónde mira, cuántas filas del sprite
 * (de arriba hacia abajo) se ven y cuántos px baja respecto de estar de pie en ese tile.
 */
export interface SeatPose {
  dir: Direction;
  rows: number;
  dy: number;
}

/** Tiles de asiento (clave de tiles.ts) donde se sientan el jugador y los pasajeros. */
export const SEAT_POSES: Record<string, SeatPose> = {
  // Respaldo contra la ventana de arriba: mira hacia el pasillo.
  vagon_asiento: { dir: 'down', rows: 13, dy: 2 },
  // Respaldo abajo: se ve de espaldas y el respaldo le tapa la cintura.
  vagon_asiento_s: { dir: 'up', rows: 12, dy: -1 },
  // Asientos de la micro mirando hacia adelante (el chofer está a la izquierda).
  micro_asiento: { dir: 'left', rows: 13, dy: 1 },
  // Tren EFE: igual que el vagón del metro.
  efe_asiento: { dir: 'down', rows: 13, dy: 2 },
  efe_asiento_s: { dir: 'up', rows: 12, dy: -1 },
  // Silla del comedor (la mesa queda arriba) y pupitre de la sala (la pizarra queda arriba): de espaldas.
  silla: { dir: 'up', rows: 12, dy: -1 },
  pupitre: { dir: 'up', rows: 11, dy: -1 },
  // Cama: solo asoma la cabeza sobre la almohada; la frazada tapa el resto.
  cama: { dir: 'down', rows: 8, dy: 0 },
  // Restorán: sillas abajo de la mesa (de espaldas) y arriba (mirando hacia abajo).
  silla_resto: { dir: 'up', rows: 12, dy: -1 },
  silla_resto_n: { dir: 'down', rows: 13, dy: 2 },
  // Sala de embarque: filas de asientos con respaldo arriba o abajo.
  aero_asiento: { dir: 'down', rows: 13, dy: 2 },
  aero_asiento_s: { dir: 'up', rows: 12, dy: -1 },
  // Auto, avión y furgón: todos miran hacia adelante (a la izquierda), como en la micro.
  auto_asiento: { dir: 'left', rows: 13, dy: 1 },
  avion_asiento: { dir: 'left', rows: 13, dy: 1 },
  avion_asiento_premium: { dir: 'left', rows: 13, dy: 1 },
  furgon_asiento: { dir: 'left', rows: 13, dy: 1 },
  // Cafetería de la PUCC y rooftop (misión 4): respaldo abajo, mirando hacia la mesa de arriba.
  silla_cafe: { dir: 'up', rows: 12, dy: -1 },
  silla_terraza: { dir: 'up', rows: 12, dy: -1 },
  // Misión 5: el sillón del barbero y el sofá de espera (mirando al espejo / a la sala), las gradas
  // de la piscina y las bancas largas de la hamburguesería (abajo de la mesa, de espaldas; arriba, de frente).
  barber_silla: { dir: 'up', rows: 12, dy: -1 },
  barber_sofa: { dir: 'down', rows: 13, dy: 2 },
  gradas: { dir: 'down', rows: 13, dy: 2 },
  banca_camerino: { dir: 'down', rows: 13, dy: 1 },
  burger_banca: { dir: 'up', rows: 12, dy: -1 },
  burger_banca_n: { dir: 'down', rows: 13, dy: 2 },
  // Misión 6: los asientos del articulado (como el vagón), las sillas de la heladería y las gradas de los cuenteros.
  art_asiento: { dir: 'down', rows: 13, dy: 2 },
  art_asiento_s: { dir: 'up', rows: 12, dy: -1 },
  helado_silla: { dir: 'up', rows: 12, dy: -1 },
  helado_silla_n: { dir: 'down', rows: 13, dy: 2 },
  grada_piedra: { dir: 'up', rows: 12, dy: -1 },
};

export function seatPoseAt(map: GameMap, x: number, y: number): SeatPose | undefined {
  return SEAT_POSES[map.tileKeyAt(x, y) ?? ''];
}
