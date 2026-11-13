import { PAL } from './palette';
import { PixelGrid } from './Painter';

/**
 * Objetos de 16×16 de la misión 9 (la fiesta en el cerro): el celular de Laura (con su funda roja y amarilla),
 * el vaso rojo del beer pong, el dado del cacho, la pulsera de neón, la foto de Cali de noche desde Cristo Rey y
 * la botella de aguardiente que se pasan de mano en mano.
 */
export const M9_OBJECTS: Record<string, () => PixelGrid> = {
  cel_laura: () => {
    const g = new PixelGrid();
    g.rect(4, 1, 8, 14, '#c8303c').rect(5, 2, 6, 11, '#1c1c24').rect(5, 3, 6, 9, '#9cc8e8');
    g.rect(6, 5, 4, 3, '#f4f0e6').rect(6, 8, 4, 1, '#e8b828').rect(4, 13, 8, 2, '#e8b828');
    return g.outline(PAL.outline);
  },
  vaso_rojo: () => {
    const g = new PixelGrid();
    g.rect(3, 3, 10, 2, '#e85a64').rect(4, 5, 8, 9, '#c8303c').rect(5, 13, 6, 1, '#8c1c28').rect(5, 6, 1, 6, '#e85a64');
    g.rect(4, 3, 8, 1, '#f4f0e6');
    return g.outline(PAL.outline);
  },
  dado_cacho: () => {
    const g = new PixelGrid();
    g.rect(3, 3, 10, 10, '#f8f4ec').rect(3, 12, 10, 1, '#d8d2c4');
    for (const [x, y] of [[5, 5], [10, 5], [7, 7], [5, 10], [10, 10]] as const) g.rect(x, y, 2, 2, '#1c1c24');
    return g.outline(PAL.outline);
  },
  pulsera_neon: () => {
    const g = new PixelGrid();
    g.rect(3, 4, 10, 2, '#58f0a0').rect(2, 6, 2, 4, '#58f0a0').rect(12, 6, 2, 4, '#58f0a0').rect(3, 10, 10, 2, '#58f0a0');
    g.rect(4, 4, 3, 1, '#c8fff0');
    return g.outline(PAL.outline);
  },
  foto_cali_noche: () => {
    const g = new PixelGrid();
    g.rect(1, 2, 14, 12, '#f4f0e6').rect(2, 3, 12, 8, '#141c34');
    for (const [x, y, c] of [[3, 8, '#f8dc68'], [5, 9, '#f8f4ec'], [7, 8, '#e8a040'], [9, 9, '#f8dc68'], [11, 8, '#9cd0f0'], [12, 10, '#f8dc68'], [4, 10, '#e8a040'], [8, 10, '#f8f4ec']] as const) g.rect(x, y, 1, 1, c);
    g.rect(2, 11, 12, 2, '#f4f0e6').rect(10, 12, 3, 1, '#c8303c');
    return g.outline(PAL.outline);
  },
  botella_guaro: () => {
    const g = new PixelGrid();
    g.rect(6, 1, 4, 2, '#c8303c').rect(6, 3, 4, 3, '#d8e8d8').rect(4, 6, 8, 9, '#d8e8d8').rect(5, 8, 6, 4, '#c8303c').rect(6, 9, 4, 2, '#f4f0e6');
    g.rect(5, 6, 1, 8, '#f8fff8');
    return g.outline(PAL.outline);
  },
};
