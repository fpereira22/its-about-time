/** Paleta limitada estilo GBA. Todo el arte procedural sale de aquí. */
export const PAL = {
  black: '#181820',
  outline: '#2a2433',
  white: '#f8f8f0',

  grass: '#78c060',
  grassDark: '#58a048',
  grassLight: '#98d878',
  grassShadow: '#4c8c44',
  flowerRed: '#e86070',
  flowerYellow: '#f8e070',

  walk: '#d8cfc0',
  walkDark: '#b8ae9e',
  walkLight: '#ece6da',

  road: '#5c5c6c',
  roadDark: '#4c4c5a',
  roadLight: '#6c6c7c',
  lineYellow: '#f0d048',
  lineWhite: '#e8e8e0',

  cobble: '#c89878',
  cobbleDark: '#a87858',
  cobbleLight: '#e0b494',

  leaf: '#3c9050',
  leafDark: '#2a6a3c',
  leafLight: '#68b868',
  leafOutline: '#1f4d2c',
  trunk: '#7a5030',
  wood: '#a87048',
  woodDark: '#7a4c30',

  metal: '#a0a8b8',
  metalDark: '#68707e',
  metalLight: '#d0d6e0',

  glass: '#78a8d8',
  glassDark: '#4a78a8',
  glassLight: '#c8e4f8',

  water: '#4a7cc8',
  waterDark: '#3a64a8',
  waterLight: '#7cacec',

  /** Rojo de la Línea 1 del metro. */
  metroRed: '#d8232a',
  metroRedDark: '#9c1a1f',
  metroRedLight: '#ee5a5f',
  yellow: '#f0c030',
  yellowDark: '#c89820',
  red: '#d04848',
  redDark: '#983030',
  green: '#48a858',
  orange: '#e88838',

  floor: '#d8d8e0',
  floorDark: '#c0c0cc',
  wallIn: '#e8e4dc',
  wallInDark: '#b8b0a4',
  wallTop: '#3a3846',
  wallTopLight: '#5a5868',
  gravel: '#4a4038',
  gravelLight: '#6a5a4c',
  rail: '#b8c0cc',

  trainFloor: '#8a8d94',
  trainFloorDark: '#7a7d84',
  trainWall: '#eef0f2',
  trainWallDark: '#c4c8cf',
  seatMetro: '#c8202a',
  seatMetroDark: '#8c1418',
  seatMetroLight: '#e8484e',
  tunnel: '#1c1c28',

  busFloor: '#8c8478',
  busFloorDark: '#746c62',
  seatRed: '#c84c3c',
  seatRedDark: '#983828',
  seatRedLight: '#e06c5c',
  sky: '#9cd0f0',
} as const;

export interface BuildingStyle {
  wall: string;
  wallDark: string;
  wallLight: string;
  roof: string;
  roofDark: string;
  roofLight: string;
  awning: string;
}

export const BUILDING_STYLES: Record<string, BuildingStyle> = {
  ladrillo: {
    wall: '#c87858',
    wallDark: '#9a5440',
    wallLight: '#e09a78',
    roof: '#8c7480',
    roofDark: '#6c5662',
    roofLight: '#a8909c',
    awning: '#3c8c5c',
  },
  crema: {
    wall: '#e8d4a0',
    wallDark: '#c0a878',
    wallLight: '#f8ecc8',
    roof: '#9c8c84',
    roofDark: '#7a6c66',
    roofLight: '#b8aaa2',
    awning: '#d04848',
  },
  gris: {
    wall: '#b0b8c8',
    wallDark: '#8890a4',
    wallLight: '#d0d8e4',
    roof: '#6c7488',
    roofDark: '#525a6c',
    roofLight: '#8890a4',
    awning: '#2a52a0',
  },
  /** Casa de pueblo: muro blanco de adobe y techo de tejas (Paine). */
  teja: {
    wall: '#f0ece0',
    wallDark: '#c8bca4',
    wallLight: '#fcfaf2',
    roof: '#b85838',
    roofDark: '#8c3c24',
    roofLight: '#d8784c',
    awning: '#3c8c5c',
  },
  /** Universidad Cristiana-Caleña (misión 4): ladrillo a la vista y losa clara, como los edificios de Pance. */
  pucc: {
    wall: '#c0684a',
    wallDark: '#8e4630',
    wallLight: '#e8d8c0',
    roof: '#b4aca0',
    roofDark: '#8c8478',
    roofLight: '#d4cec4',
    awning: '#2050a8',
  },
  /** Casas de barrio de Cali (misión 5, Ciudad Pacífica): muro pintado de amarillo y techo de teja. */
  barrio: {
    wall: '#f0c868',
    wallDark: '#c89a40',
    wallLight: '#f8e4a8',
    roof: '#b85838',
    roofDark: '#8c3c24',
    roofLight: '#d8784c',
    awning: '#2c9c8c',
  },
  /** Conjuntos residenciales del sur de Cali: blanco con ventanas grandes y techo gris. */
  conjunto: {
    wall: '#ece8e0',
    wallDark: '#c0bab0',
    wallLight: '#fbf9f4',
    roof: '#8a8e98',
    roofDark: '#6a6e78',
    roofLight: '#a8acb4',
    awning: '#3c8c5c',
  },
  /** Casas coloniales de San Antonio (misión 6): muros encalados de colores suaves y teja de barro. */
  colonial: {
    wall: '#f4e2b8',
    wallDark: '#c8ac78',
    wallLight: '#fcf2d8',
    roof: '#b4553a',
    roofDark: '#8a3a26',
    roofLight: '#d4744e',
    awning: '#2c7cb0',
  },
  /** Centro comercial de la misión 6: paneles crema con vidrio y techo de lámina clara. */
  mall: {
    wall: '#ece4d4',
    wallDark: '#c4b8a4',
    wallLight: '#fbf6ec',
    roof: '#c8ccd0',
    roofDark: '#a4a8b0',
    roofLight: '#e4e8ec',
    awning: '#2c9c6c',
  },
  /** Edificios de oficinas del centro de Cali (misión 6): concreto gris tostado. */
  centro: {
    wall: '#c8bca8',
    wallDark: '#a09480',
    wallLight: '#e0d8c8',
    roof: '#7c7468',
    roofDark: '#5c564c',
    roofLight: '#9c9488',
    awning: '#c84848',
  },
  vidrio: {
    wall: '#5c94cc',
    wallDark: '#3c6c9c',
    wallLight: '#a0ccf0',
    roof: '#4c5c78',
    roofDark: '#38455c',
    roofLight: '#6c7c98',
    awning: '#e8c040',
  },
};

/** Estilos que se eligen al azar (determinista) para el autotile "edificio". */
export const RANDOM_BUILDING_STYLES = ['ladrillo', 'crema', 'gris'] as const;

/** Oscurece o aclara un color hex. amount en [-1, 1]. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.max(0, Math.min(255, Math.round(v)));
  });
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}
