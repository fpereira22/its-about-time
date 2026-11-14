/** Los fondos del menú principal apuntan a mapas, misiones y vehículos que existen, y caben en el mapa. */
import { describe, expect, it } from 'vitest';
import { VEHICLE_ART } from '../src/art/vehicles';
import { BASE_HEIGHT, BASE_WIDTH, TILE } from '../src/config/display';
import { TITLE_BACKDROPS } from '../src/data/titleBackdrops';
import { GameMap } from '../src/systems/GameMap';
import { MISSIONS } from '../src/systems/Mission';

describe('fondos del título', () => {
  it('nombran mapas, misiones y vehículos que existen', () => {
    const bad: string[] = [];
    const ids = new Set<string>();
    for (const b of TITLE_BACKDROPS) {
      if (ids.has(b.id)) bad.push(`${b.id}: id repetido`);
      ids.add(b.id);
      if (!GameMap.ids().includes(b.map)) {
        bad.push(`${b.id}: mapa ${b.map} no existe`);
        continue;
      }
      if (!MISSIONS.some((m) => m.id === b.mission)) bad.push(`${b.id}: misión ${b.mission} no existe`);
      const map = GameMap.get(b.map);
      if (map.data.kind !== 'overworld') bad.push(`${b.id}: ${b.map} no es exterior`);
      if (b.col < 0 || (b.col * TILE > map.width * TILE - BASE_WIDTH && b.col > 0)) bad.push(`${b.id}: col ${b.col} fuera del mapa`);
      if (b.row < 0 || (b.row * TILE > map.height * TILE - BASE_HEIGHT && b.row > 0)) bad.push(`${b.id}: row ${b.row} fuera del mapa`);
      for (const lane of b.lanes ?? []) {
        if (b.pan === 'up' || b.pan === 'down') bad.push(`${b.id}: pistas con paneo vertical`);
        if (lane.row < b.row || (lane.row + 1 - b.row) * TILE > BASE_HEIGHT) bad.push(`${b.id}: pista ${lane.row} no se ve`);
        else if (!/calle|mio_carril|cebra/.test(map.tileKeyAt(Math.min(map.width - 1, b.col + 2), lane.row) ?? ''))
          bad.push(`${b.id}: la fila ${lane.row} no es calle (${map.tileKeyAt(b.col + 2, lane.row)})`);
        for (const v of lane.vehicles) if (!(v in VEHICLE_ART)) bad.push(`${b.id}: vehículo ${v} no existe`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('el prólogo tiene al menos un fondo (es el de una partida nueva)', () => {
    expect(TITLE_BACKDROPS.some((b) => b.mission === MISSIONS[0].id)).toBe(true);
  });
});
