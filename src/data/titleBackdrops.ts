import type { Weather } from '../systems/StoryState';

/**
 * Lugares que se ven de fondo en el menú principal (ver ui/TitleBackdrop.ts). Van rotando: solo
 * aparecen los de misiones ya desbloqueadas, y los de la misión en curso salen más seguido.
 */

/** Pista por donde pasan vehículos: `row` es la fila (del mapa) donde apoyan las ruedas. */
export interface BackdropLane {
  row: number;
  /** 1 = hacia la derecha, -1 = hacia la izquierda. */
  dir: 1 | -1;
  vehicles: string[];
  /** Pausa entre un vehículo y el siguiente (ms, mínimo y máximo). */
  every?: [number, number];
}

export interface TitleBackdropDef {
  id: string;
  map: string;
  /** Lo que se muestra en el pie al aparecer. */
  place: string;
  /** Aparece desde que esta misión está desbloqueada... */
  mission: string;
  /** ...o solo después de terminarla (finales que serían spoiler). */
  afterComplete?: boolean;
  /** Esquina superior izquierda (en tiles) al empezar. */
  col: number;
  row: number;
  /** Hacia dónde se desliza la cámara (se detiene en el borde del mapa). */
  pan: 'right' | 'left' | 'down' | 'up';
  lanes?: BackdropLane[];
  /** Lugares que lucen de noche (luces de la ciudad): salen más cuando el reloj del título está oscuro. */
  night?: boolean;
  /** Clima propio del lugar (si no, se sortea según cuánto lleva esperando). */
  weather?: Weather;
}

const SEDANS = ['sedan_blanco', 'sedan_rojo', 'sedan_azul', 'sedan_gris', 'hatchback_verde', 'hatchback_naranjo'];
const SANTIAGO = [...SEDANS, 'taxi', 'micro', 'micro_llena'];
const CALI = [...SEDANS, 'taxi_cali', 'taxi_cali', 'bus_cali'];

export const TITLE_BACKDROPS: TitleBackdropDef[] = [
  // Prólogo · Santiago
  {
    id: 'providencia',
    map: 'providencia',
    place: 'Av. Providencia · Santiago',
    mission: 'mission01',
    col: 0,
    row: 8,
    pan: 'right',
    lanes: [
      { row: 17, dir: 1, vehicles: ['micro', 'micro', ...SEDANS] },
      { row: 15, dir: -1, vehicles: SANTIAGO },
    ],
  },
  // Misión 1
  {
    id: 'antonio_varas',
    map: 'antonio_varas',
    place: 'Antonio Varas · Providencia',
    mission: 'mission02',
    col: 0,
    row: 8,
    pan: 'right',
    lanes: [
      { row: 17, dir: 1, vehicles: SANTIAGO },
      { row: 15, dir: -1, vehicles: SANTIAGO },
    ],
  },
  {
    id: 'paine',
    map: 'paine',
    place: 'Paine',
    mission: 'mission02',
    col: 0,
    row: 2,
    pan: 'right',
    lanes: [
      { row: 8, dir: 1, vehicles: SEDANS, every: [3000, 8000] },
      { row: 6, dir: -1, vehicles: [...SEDANS, 'micro'], every: [3000, 8000] },
    ],
  },
  // Misión 2-3 · Pance
  {
    id: 'pance',
    map: 'pance',
    place: 'Pance · Cali',
    mission: 'mission03',
    col: 0,
    row: 4,
    pan: 'right',
    lanes: [
      { row: 9, dir: 1, vehicles: [...CALI, 'carro_grover'] },
      { row: 7, dir: -1, vehicles: [...SEDANS, 'taxi_cali', 'bus_cali_izq', 'carro_grover_izq'] },
    ],
  },
  {
    id: 'pucc_campus',
    map: 'pucc_campus',
    place: 'Universidad Cristiana-Caleña',
    mission: 'mission04',
    col: 12,
    row: 0,
    pan: 'down',
  },
  {
    id: 'rooftop_cali',
    map: 'rooftop_cali',
    place: 'Rooftop de Antoine',
    mission: 'mission04',
    afterComplete: true,
    col: 0,
    row: 0,
    pan: 'right',
    night: true,
  },
  // Misión 4
  {
    id: 'ruta_barberia',
    map: 'ruta_barberia',
    place: 'Carrera 121 · Ciudad Pacífica',
    mission: 'mission05',
    col: 0,
    row: 7,
    pan: 'right',
    lanes: [
      { row: 15, dir: 1, vehicles: [...CALI, 'carro_grover'] },
      { row: 13, dir: -1, vehicles: [...SEDANS, 'taxi_cali', 'bus_cali_izq', 'carro_grover_izq'] },
    ],
  },
  {
    id: 'pucc_piscina',
    map: 'pucc_piscina',
    place: 'Centro Deportivo · PUCC',
    mission: 'mission05',
    col: 0,
    row: 8,
    pan: 'right',
  },
  // Misión 5
  {
    id: 'universidades',
    map: 'universidades',
    place: 'Estación Universidades · MIO',
    mission: 'mission06',
    col: 30,
    row: 30,
    pan: 'right',
    lanes: [
      { row: 31, dir: 1, vehicles: CALI },
      { row: 33, dir: 1, vehicles: ['articulado'], every: [5000, 11000] },
      { row: 40, dir: -1, vehicles: ['articulado_izq'], every: [6000, 12000] },
    ],
  },
  {
    id: 'centro_cali',
    map: 'centro_cali',
    place: 'Centro de Cali',
    mission: 'mission06',
    col: 0,
    row: 0,
    pan: 'right',
    lanes: [
      { row: 7, dir: 1, vehicles: CALI },
      { row: 5, dir: -1, vehicles: [...SEDANS, 'taxi_cali', 'bus_cali_izq'] },
      { row: 9, dir: 1, vehicles: ['articulado'], every: [5000, 11000] },
    ],
  },
  {
    id: 'bulevar',
    map: 'centro_cali',
    place: 'Bulevar del Río · Cali',
    mission: 'mission06',
    col: 0,
    row: 26,
    pan: 'right',
  },
  {
    id: 'san_antonio',
    map: 'san_antonio',
    place: 'Colina de San Antonio',
    mission: 'mission06',
    col: 0,
    row: 0,
    pan: 'right',
    night: true,
  },
  // Misión 6
  {
    id: 'bobo_cuadra',
    map: 'bobo_cuadra',
    place: 'Calle 18 · Cañasgordas',
    mission: 'mission07',
    col: 0,
    row: 28,
    pan: 'right',
    weather: 'lluvia',
    lanes: [
      { row: 38, dir: 1, vehicles: CALI },
      { row: 36, dir: -1, vehicles: [...SEDANS, 'taxi_cali', 'bus_cali_izq'] },
    ],
  },
  // Misión 7 · Salento
  {
    id: 'salento',
    map: 'salento',
    place: 'Salento · Quindío',
    mission: 'mission08',
    col: 20,
    row: 60,
    pan: 'down',
  },
  {
    id: 'parque_cafe',
    map: 'parque_cafe',
    place: 'Parque del Café',
    mission: 'mission08',
    col: 22,
    row: 80,
    pan: 'down',
  },
  // Misión 8
  {
    id: 'casa_tami',
    map: 'casa_tami',
    place: 'Cristo Rey · Cali',
    mission: 'mission09',
    col: 0,
    row: 18,
    pan: 'right',
    night: true,
  },
  {
    id: 'pance_rio',
    map: 'pance_rio',
    place: 'Río Pance',
    mission: 'mission09',
    afterComplete: true,
    col: 0,
    row: 14,
    pan: 'right',
  },
  // Misión 9 (mission10, prefijo m11_)
  {
    id: 'itsisi',
    map: 'itsisi',
    place: 'Calle 18 · Universidad Itsisi',
    mission: 'mission10',
    col: 23,
    row: 0,
    pan: 'right',
    lanes: [
      { row: 7, dir: 1, vehicles: CALI },
      { row: 9, dir: -1, vehicles: CALI },
    ],
  },
  {
    id: 'voragine',
    map: 'voragine',
    place: 'La Vorágine · Pance',
    mission: 'mission10',
    col: 40,
    row: 6,
    pan: 'down',
  },
  {
    id: 'chorrera',
    map: 'chorrera',
    place: 'Chorrera del Indio · San Francisco',
    mission: 'mission10',
    afterComplete: true,
    col: 18,
    row: 28,
    pan: 'right',
  },
];
