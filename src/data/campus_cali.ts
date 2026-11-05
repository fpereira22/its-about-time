import type { MapData, MapLabel, MapWarp } from '../types/map';
import type { DialogueChoice, DialogueFile, DialogueTree, NpcDef } from '../types/story';

/**
 * Edificios de la Universidad Cristiana-Caleña (PUCC, ficticia), en Pance (misión 4).
 * El campus (src/data/maps/pucc_campus.json) sigue el trazado real de la Javeriana Cali;
 * los pisos de cada edificio son casi iguales, así que se generan aquí como los de la UAV
 * (src/data/campus.ts): un pasillo con salas arriba, el ascensor (si el edificio tiene 4 pisos o más)
 * a la izquierda y la escalera a la derecha. La cantidad de pisos es la de OpenStreetMap.
 */

interface Room {
  name: string;
  dialogue: string;
}

interface Building {
  /** Nombre del edificio en los carteles. */
  name: string;
  /** Prefijo de las salas ("ALM 201"). */
  prefix: string;
  floors: number;
  /** Salas especiales por piso (las que faltan son salas de clases). */
  special?: Record<number, Room[]>;
}

const CLASS = 'pucc_sala_clase';
const CLOSED = 'pucc_sala_cerrada';
const OFFICE = 'pucc_oficina';

export const PUCC_BUILDINGS: Record<string, Building> = {
  palmas: { name: 'Edificio Palmas', prefix: 'PAL', floors: 5 },
  guayacanes: { name: 'Edificio Guayacanes', prefix: 'GUA', floors: 5 },
  lago: {
    name: 'Edificio El Lago',
    prefix: 'LAG',
    floors: 3,
    special: { 1: [{ name: 'LAB. PROCESOS', dialogue: 'pucc_lab' }, { name: 'LAB. SIMULACIÓN', dialogue: 'pucc_lab' }] },
  },
  economia: { name: 'Ciencias Económicas', prefix: 'ECO', floors: 3 },
  biblioteca: {
    name: 'Biblioteca',
    prefix: 'BIB',
    floors: 3,
    special: {
      1: [
        { name: 'PRÉSTAMO', dialogue: 'm5_bibliotecaria' },
        { name: 'HEMEROTECA', dialogue: 'pucc_biblioteca' },
        { name: 'SALA LECTURA', dialogue: 'pucc_silencio' },
        { name: 'COMPUTADORES', dialogue: 'pucc_silencio' },
      ],
      2: [
        { name: 'COLECCIÓN', dialogue: 'pucc_silencio' },
        { name: 'ESTUDIO A', dialogue: 'pucc_sala_estudio' },
        { name: 'ESTUDIO B', dialogue: 'pucc_sala_estudio' },
        { name: 'MAPOTECA', dialogue: 'pucc_silencio' },
      ],
      3: [
        { name: 'GRUPAL 1', dialogue: 'pucc_silencio' },
        { name: 'GRUPAL 2', dialogue: 'pucc_silencio' },
        { name: 'GRUPAL 3', dialogue: 'pucc_silencio' },
        { name: 'ARCHIVO', dialogue: CLOSED },
      ],
    },
  },
  administrativo: {
    name: 'Edificio Administrativo',
    prefix: 'ADM',
    floors: 4,
    special: {
      1: [
        { name: 'REGISTRO', dialogue: 'pucc_registro' },
        { name: 'TESORERÍA', dialogue: 'pucc_tesoreria' },
        { name: 'ADMISIONES', dialogue: OFFICE },
        { name: 'REL. INTERNAC.', dialogue: 'pucc_ori' },
      ],
      2: [{ name: 'RECTORÍA', dialogue: CLOSED }, { name: 'SECRETARÍA', dialogue: OFFICE }, { name: 'OF. 203', dialogue: OFFICE }, { name: 'OF. 204', dialogue: OFFICE }],
      3: [{ name: 'OF. 301', dialogue: OFFICE }, { name: 'OF. 302', dialogue: OFFICE }, { name: 'OF. 303', dialogue: OFFICE }, { name: 'OF. 304', dialogue: OFFICE }],
      4: [{ name: 'SALA CONSEJO', dialogue: CLOSED }, { name: 'OF. 402', dialogue: OFFICE }, { name: 'OF. 403', dialogue: OFFICE }, { name: 'ARCHIVO', dialogue: CLOSED }],
    },
  },
  educon: {
    name: 'Educación Continua',
    prefix: 'EC',
    floors: 3,
    special: {
      1: [
        { name: 'RECEPCIÓN', dialogue: 'pucc_ec_recepcion' },
        { name: 'MERCADEO', dialogue: OFFICE },
        { name: 'CONSULTORÍA', dialogue: OFFICE },
        { name: 'CAFÉ', dialogue: 'pucc_ec_cafe' },
      ],
      2: [
        { name: 'EC 201', dialogue: CLASS },
        { name: 'EC 202', dialogue: CLASS },
        { name: 'EC 203', dialogue: 'puerta_logistica' },
        { name: 'EC 204', dialogue: CLASS },
      ],
      3: [
        { name: 'COMUNICAC.', dialogue: OFFICE },
        { name: 'RELACIONAM.', dialogue: OFFICE },
        { name: 'SALA JUNTAS', dialogue: CLOSED },
        { name: 'OF. 304', dialogue: OFFICE },
      ],
    },
  },
  bienestar: {
    name: 'Centro de Bienestar',
    prefix: 'BIE',
    floors: 2,
    special: {
      1: [
        { name: 'DEPORTES', dialogue: 'pucc_deportes' },
        { name: 'PSICOLOGÍA', dialogue: OFFICE },
        { name: 'ENFERMERÍA', dialogue: 'pucc_enfermeria' },
        { name: 'ARTE Y CULT.', dialogue: OFFICE },
      ],
      2: [
        { name: 'SALA DANZA', dialogue: 'pucc_danza' },
        { name: 'SALA MÚSICA', dialogue: 'pucc_musica' },
        { name: 'SALA YOGA', dialogue: CLOSED },
        { name: 'CAMARINES', dialogue: CLOSED },
      ],
    },
  },
  acacias: { name: 'Edificio Las Acacias', prefix: 'ACA', floors: 3 },
  saman: { name: 'Edificio El Samán', prefix: 'SAM', floors: 2 },
  almendros: { name: 'Edificio Los Almendros', prefix: 'ALM', floors: 4 },
  cedro: {
    name: 'Edificio Cedro Rosado',
    prefix: 'CED',
    floors: 6,
    special: {
      1: [
        { name: 'DESIGN FACT.', dialogue: 'pucc_design_factory' },
        { name: 'LAB. 1', dialogue: 'pucc_lab' },
        { name: 'LAB. 2', dialogue: 'pucc_lab' },
        { name: 'CAFÉ', dialogue: 'pucc_ec_cafe' },
      ],
      6: [
        { name: 'TERRAZA', dialogue: 'pucc_terraza_solar' },
        { name: 'OF. 602', dialogue: OFFICE },
        { name: 'OF. 603', dialogue: OFFICE },
        { name: 'SALA MÁQ.', dialogue: CLOSED },
      ],
    },
  },
  salud: {
    name: 'Ciencias de la Salud',
    prefix: 'SAL',
    floors: 4,
    special: { 1: [{ name: 'ANATOMÍA', dialogue: 'pucc_anatomia' }, { name: 'SIMULACIÓN', dialogue: 'pucc_lab' }] },
  },
};

export const PUCC_CAMPUS_MAP = 'pucc_campus';

/** Id del mapa de un piso: pucc_cedro_p6. */
export function puccFloorId(building: string, floor: number): string {
  return `pucc_${building}_p${floor}`;
}

const W = 24;
const H = 7;
const DOOR_XS = [5, 9, 13, 17];
const ELEVATOR_XS = [1, 2];
const STAIRS_UP_X = 20;
const STAIRS_DOWN_X = 22;
const EXIT_X = 12;
/** Desde cuántos pisos el edificio tiene ascensor. */
const ELEVATOR_FROM = 4;

function rooms(b: Building, floor: number): Room[] {
  const special = b.special?.[floor] ?? [];
  return DOOR_XS.map((_, i) => special[i] ?? { name: `${b.prefix} ${floor}0${i + 1}`, dialogue: CLASS });
}

function buildFloor(id: string, b: Building, floor: number): { map: MapData; npcs: NpcDef[] } {
  const mapId = puccFloorId(id, floor);
  const top = floor === b.floors;
  const ground = floor === 1;
  const elevator = b.floors >= ELEVATOR_FROM;

  const wallRow = [...'W'.repeat(W)];
  if (elevator) for (const x of ELEVATOR_XS) wallRow[x] = 'L';
  else wallRow[1] = 'v';
  for (const x of DOOR_XS) wallRow[x] = 'd';
  wallRow[W - 2] = 'c';

  const bottomRow = [...'WvWWvWWvWWvWWvWWvWWWWWvW'];
  if (!top) bottomRow[STAIRS_UP_X] = 'E';
  if (!ground) bottomRow[STAIRS_DOWN_X] = 'E';
  if (ground) bottomRow[EXIT_X] = 'P';

  const warps: MapWarp[] = [];
  if (!top) warps.push({ x: STAIRS_UP_X, y: 5, to: puccFloorId(id, floor + 1), spawn: 'desde_abajo' });
  if (!ground) warps.push({ x: STAIRS_DOWN_X, y: 5, to: puccFloorId(id, floor - 1), spawn: 'desde_arriba' });
  if (ground) warps.push({ x: EXIT_X, y: 5, to: PUCC_CAMPUS_MAP, spawn: id });

  const roomList = rooms(b, floor);
  const labels: MapLabel[] = [
    ...roomList.map((r, i) => ({ x: DOOR_XS[i], y: 0.5, text: r.name })),
    { x: 8, y: 6.5, text: `${b.name.toUpperCase()} · PISO ${floor}`, color: '#f0d048' },
  ];
  if (elevator) labels.push({ x: 1.5, y: 0.5, text: 'ASCENSOR' });
  if (!top) labels.push({ x: STAIRS_UP_X, y: 6.5, text: 'SUBE' });
  if (!ground) labels.push({ x: STAIRS_DOWN_X, y: 6.5, text: 'BAJA' });
  if (ground) labels.push({ x: EXIT_X, y: 6.5, text: 'SALIDA' });

  const map: MapData = {
    id: mapId,
    name: `${b.name} · Piso ${floor}`,
    kind: 'interior',
    tileSize: 16,
    width: W,
    height: H,
    background: '#1a1a22',
    music: 'campus',
    legend: {
      '^': 'muro_techo',
      W: 'p_muro',
      v: 'p_ventana',
      d: 'p_puerta',
      c: 'p_cartel',
      L: 'ascensor',
      E: 'escalera',
      P: 'puerta',
      '.': 'u_piso',
    },
    rows: ['^'.repeat(W), wallRow.join(''), '.'.repeat(W), '.'.repeat(W), '.'.repeat(W), bottomRow.join(''), '^'.repeat(W)],
    zones: [{ name: `${b.name} · Piso ${floor}`, subtitle: 'Universidad Cristiana-Caleña', x: 0, y: 0, w: W, h: H }],
    spawns: {
      ascensor: { x: 2, y: 2, dir: 'down' },
      desde_abajo: { x: STAIRS_DOWN_X, y: 4, dir: 'left' },
      desde_arriba: { x: STAIRS_UP_X, y: 4, dir: 'left' },
      entrada: { x: EXIT_X, y: 4, dir: 'up' },
      ...Object.fromEntries(DOOR_XS.map((x, i) => [`sala_${i + 1}`, { x, y: 2, dir: 'down' as const }])),
    },
    warps,
    labels,
    crowd: { lines: 'pucc', areas: [{ x: 4, y: 2, w: 15, h: 3, count: ground ? 4 : 2 }] },
  };

  const npcs: NpcDef[] = [
    ...(elevator ? ELEVATOR_XS.map((x) => ({ id: `${mapId}_ascensor_${x}`, map: mapId, x, y: 1, dialogue: elevatorDialogueId(id) })) : []),
    ...roomList.map((r, i) => ({ id: `${mapId}_sala_${i + 1}`, map: mapId, x: DOOR_XS[i], y: 1, dialogue: r.dialogue })),
    { id: `${mapId}_diario_mural`, map: mapId, x: W - 2, y: 1, dialogue: 'pucc_diario_mural' },
  ];
  return { map, npcs };
}

function elevatorDialogueId(id: string): string {
  return `ascensor_pucc_${id}`;
}

/** Botonera del ascensor: hasta 4 pisos por página, como la del edificio A2 de la UAV. */
function elevatorDialogue(id: string, b: Building): DialogueTree {
  const title = `ASCENSOR · ${b.name.toUpperCase()}. ¿A qué piso vas?`;
  const floors = Array.from({ length: b.floors }, (_, i) => i + 1);
  const choice = (f: number): DialogueChoice => ({
    label: f === 1 ? '1 · Salida' : `Piso ${f}`,
    effects: [{ sfx: 'elevator' }, { warp: { map: puccFloorId(id, f), spawn: 'ascensor' } }],
  });
  if (floors.length <= 4) {
    return { start: 'inicio', nodes: { inicio: { text: title, choices: [...floors.map(choice), { label: 'Cancelar' }] } } };
  }
  const low = floors.slice(0, 3);
  const high = floors.slice(3);
  return {
    start: 'inicio',
    nodes: {
      inicio: {
        text: title,
        choices: [{ label: `Pisos 1 a ${low[low.length - 1]}`, goto: 'bajos' }, { label: `Pisos ${high[0]} a ${b.floors}`, goto: 'altos' }, { label: 'Cancelar' }],
      },
      bajos: { text: title, choices: [...low.map(choice), { label: 'Volver', goto: 'inicio' }] },
      altos: { text: title, choices: [...high.map(choice), { label: 'Volver', goto: 'inicio' }] },
    },
  };
}

const built = Object.entries(PUCC_BUILDINGS).flatMap(([id, b]) =>
  Array.from({ length: b.floors }, (_, i) => buildFloor(id, b, i + 1)),
);

export const PUCC_MAPS: MapData[] = built.map((f) => f.map);
export const PUCC_NPCS: NpcDef[] = built.flatMap((f) => f.npcs);
export const PUCC_DIALOGUES: DialogueFile = Object.fromEntries(
  Object.entries(PUCC_BUILDINGS)
    .filter(([, b]) => b.floors >= ELEVATOR_FROM)
    .map(([id, b]) => [elevatorDialogueId(id), elevatorDialogue(id, b)]),
);
