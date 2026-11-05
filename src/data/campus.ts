import type { MapData, MapLabel, MapWarp } from '../types/map';
import type { NpcDef } from '../types/story';

/**
 * Edificios A1 y A2 de la Universidad Antonio Varas (ficticia), pisos -1 a 6.
 * Los 16 pisos son casi iguales, así que se generan aquí en vez de escribirse a mano:
 * un pasillo con salas arriba, el ascensor a la izquierda y la escalera a la derecha.
 * Los NPCs y salas especiales de la misión 2 están en src/data/npcs/mision2.json.
 */

export const CAMPUS_BUILDINGS = ['a1', 'a2'] as const;
export const CAMPUS_FLOORS = [-1, 1, 2, 3, 4, 5, 6] as const;

type Building = (typeof CAMPUS_BUILDINGS)[number];

/** Id del mapa de un piso: uav_a2_p4, uav_a1_pm1 (piso -1). */
export function floorMapId(b: Building, floor: number): string {
  return `uav_${b}_p${floor < 0 ? `m${-floor}` : floor}`;
}

const W = 24;
const H = 7;
/** Columnas de las puertas de las salas (fila 1). */
const DOOR_XS = [5, 9, 13, 17];
const ELEVATOR_XS = [1, 2];
const STAIRS_UP_X = 20;
const STAIRS_DOWN_X = 22;
const EXIT_X = 12;

/** Nombre y diálogo de cada sala; si no hay entrada, es una sala de clases normal. */
interface Room {
  name: string;
  dialogue: string;
}

function rooms(b: Building, floor: number): Room[] {
  const B = b.toUpperCase();
  if (floor === -1) {
    return [
      { name: 'CASINO', dialogue: 'u_casino' },
      { name: 'CAMARINES', dialogue: 'u_sala_cerrada' },
      { name: 'BODEGA', dialogue: 'u_bodega' },
      { name: 'SALA MÁQ.', dialogue: 'u_sala_cerrada' },
    ];
  }
  if (floor === 1) {
    return b === 'a1'
      ? [
          { name: 'BIBLIOTECA', dialogue: 'u_biblioteca' },
          { name: 'ADMISIÓN', dialogue: 'u_admision' },
          { name: 'FOTOCOPIAS', dialogue: 'u_fotocopias' },
          { name: 'ENFERMERÍA', dialogue: 'u_sala_cerrada' },
        ]
      : [
          { name: 'AUDITORIO', dialogue: 'u_auditorio' },
          { name: 'ASUNTOS EST.', dialogue: 'u_sala_cerrada' },
          { name: 'CENTRO ALUM.', dialogue: 'u_centro_alumnos' },
          { name: 'LAB. COMPU', dialogue: 'u_sala_clase' },
        ];
  }
  if (floor === 6) {
    return b === 'a2'
      ? [
          { name: 'OF. 601', dialogue: 'u_oficina' },
          { name: 'OF. 602', dialogue: 'u_oficina' },
          { name: 'OF. 604', dialogue: 'puerta_604' },
          { name: 'OF. 605', dialogue: 'u_oficina' },
        ]
      : [
          { name: 'DECANATURA', dialogue: 'u_sala_cerrada' },
          { name: 'SALA CONSEJO', dialogue: 'u_sala_cerrada' },
          { name: 'OF. 603', dialogue: 'u_oficina' },
          { name: 'TERRAZA', dialogue: 'u_terraza' },
        ];
  }
  return [1, 2, 3, 4].map((i) => {
    const name = `${B}-${floor}0${i}`;
    const special: Record<string, string> = { 'A2-403': 'puerta_403', 'A1-201': 'puerta_a1_201' };
    return { name, dialogue: special[name] ?? 'u_sala_clase' };
  });
}

function buildFloor(b: Building, floor: number): { map: MapData; npcs: NpcDef[] } {
  const id = floorMapId(b, floor);
  const B = b.toUpperCase();
  const top = floor === 6;
  const bottom = floor === -1;

  const wallRow = [...'W'.repeat(W)];
  for (const x of ELEVATOR_XS) wallRow[x] = 'L';
  for (const x of DOOR_XS) wallRow[x] = 'd';
  wallRow[W - 2] = 'c';

  const bottomRow = [...'WvWWvWWvWWvWWvWWvWWWWWvW'];
  if (!top) bottomRow[STAIRS_UP_X] = 'E';
  if (!bottom) bottomRow[STAIRS_DOWN_X] = 'E';
  if (floor === 1) bottomRow[EXIT_X] = 'P';

  const rows = ['^'.repeat(W), wallRow.join(''), '.'.repeat(W), '.'.repeat(W), '.'.repeat(W), bottomRow.join(''), '^'.repeat(W)];

  const warps: MapWarp[] = [];
  const idx = CAMPUS_FLOORS.indexOf(floor as (typeof CAMPUS_FLOORS)[number]);
  if (!top) warps.push({ x: STAIRS_UP_X, y: 5, to: floorMapId(b, CAMPUS_FLOORS[idx + 1]), spawn: 'desde_abajo' });
  if (!bottom) warps.push({ x: STAIRS_DOWN_X, y: 5, to: floorMapId(b, CAMPUS_FLOORS[idx - 1]), spawn: 'desde_arriba' });
  if (floor === 1) warps.push({ x: EXIT_X, y: 5, to: 'antonio_varas', spawn: b });

  const roomList = rooms(b, floor);
  const labels: MapLabel[] = [
    { x: 1.5, y: 0.5, text: 'ASCENSOR' },
    ...roomList.map((r, i) => ({ x: DOOR_XS[i], y: 0.5, text: r.name })),
    { x: 8, y: 6.5, text: `${B} · PISO ${floor}`, color: '#f0d048' },
  ];
  if (!top) labels.push({ x: STAIRS_UP_X, y: 6.5, text: 'SUBE' });
  if (!bottom) labels.push({ x: STAIRS_DOWN_X, y: 6.5, text: 'BAJA' });
  if (floor === 1) labels.push({ x: EXIT_X, y: 6.5, text: 'SALIDA' });

  const map: MapData = {
    id,
    name: `Edificio ${B} · Piso ${floor}`,
    kind: 'interior',
    tileSize: 16,
    width: W,
    height: H,
    background: '#1a1a22',
    music: 'station',
    legend: {
      '^': 'muro_techo',
      W: 'u_muro',
      v: 'u_ventana',
      d: 'u_puerta',
      c: 'u_cartel',
      L: 'ascensor',
      E: 'escalera',
      P: 'puerta',
      '.': 'u_piso',
    },
    rows,
    zones: [{ name: `Edificio ${B} · Piso ${floor}`, subtitle: 'Universidad Antonio Varas', x: 0, y: 0, w: W, h: H }],
    spawns: {
      ascensor: { x: 2, y: 2, dir: 'down' },
      desde_abajo: { x: STAIRS_DOWN_X, y: 4, dir: 'left' },
      desde_arriba: { x: STAIRS_UP_X, y: 4, dir: 'left' },
      entrada: { x: EXIT_X, y: 4, dir: 'up' },
      ...Object.fromEntries(DOOR_XS.map((x, i) => [`sala_${i + 1}`, { x, y: 2, dir: 'down' as const }])),
    },
    warps,
    crowd: { lines: 'universidad', areas: [{ x: 4, y: 2, w: 15, h: 3, count: floor === 1 ? 4 : 2 }] },
  };
  // Al salir de la sala 403 con la prueba perfecta, el profe te invita a su oficina.
  if (id === floorMapId('a2', 4)) {
    map.enter = [{ id: 'profe_invita', dialogue: 'profe_invita', if: { all: [{ flag: 'examen_perfecto' }, { notFlag: 'invitado_oficina' }] } }];
  }

  const npcs: NpcDef[] = [
    ...ELEVATOR_XS.map((x) => ({ id: `${id}_ascensor_${x}`, map: id, x, y: 1, dialogue: `ascensor_${b}` })),
    ...roomList.map((r, i) => ({ id: `${id}_sala_${i + 1}`, map: id, x: DOOR_XS[i], y: 1, dialogue: r.dialogue })),
    { id: `${id}_diario_mural`, map: id, x: W - 2, y: 1, dialogue: 'u_diario_mural' },
  ];
  return { map, npcs };
}

const built = CAMPUS_BUILDINGS.flatMap((b) => CAMPUS_FLOORS.map((f) => buildFloor(b, f)));

export const CAMPUS_MAPS: MapData[] = built.map((f) => f.map);
export const CAMPUS_NPCS: NpcDef[] = built.flatMap((f) => f.npcs);
