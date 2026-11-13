import { PAL } from './palette';
import { PixelGrid } from './Painter';

/**
 * Objetos de 16×16 de la misión 8: los íconos de lo que se compra en Salento (oblea, arepa de choclo,
 * solterita, café, el llavero de palma de cera...), la foto del Krater y los puestos del mercado campesino.
 */

function stall(goods: Array<[number, number, number, number, string]>, roof: string): PixelGrid {
  const g = new PixelGrid();
  g.rect(0, 0, 16, 4, roof);
  for (let x = 1; x < 16; x += 4) g.rect(x, 0, 2, 4, '#f4f0e6');
  g.rect(1, 4, 1, 6, '#6a4428').rect(14, 4, 1, 6, '#6a4428');
  g.rect(0, 9, 16, 7, '#a87c4c').rect(0, 9, 16, 1, '#c89c68');
  for (const [x, y, w, h, c] of goods) g.rect(x, y, w, h, c);
  return g.outline(PAL.outline);
}

export const M8_OBJECTS: Record<string, () => PixelGrid> = {
  oblea_salento: () => {
    const g = new PixelGrid();
    g.rect(2, 4, 12, 9, '#f0dca0').rect(3, 6, 10, 5, '#c8884c').rect(4, 7, 2, 2, '#5c1c3c').rect(9, 8, 2, 2, '#5c1c3c').rect(6, 5, 3, 1, '#f8f4ec');
    return g.outline(PAL.outline);
  },
  arepa_choclo: () => {
    const g = new PixelGrid();
    g.rect(2, 5, 12, 7, '#e8c848').rect(3, 4, 10, 1, '#e8c848').rect(5, 6, 6, 2, '#f8f4ec').rect(7, 5, 2, 1, '#f8e070');
    return g.outline(PAL.outline);
  },
  solterita: () => {
    const g = new PixelGrid();
    g.rect(2, 7, 12, 5, '#d8a058').rect(3, 5, 10, 2, '#c8884c').rect(3, 4, 10, 1, '#f4f0e6').set(5, 3, '#f4f0e6').set(10, 3, '#f4f0e6');
    return g.outline(PAL.outline);
  },
  cafe_salento: () => {
    const g = new PixelGrid();
    g.rect(3, 3, 10, 12, '#c8a070').rect(3, 3, 10, 2, '#a87c4c').rect(5, 7, 6, 4, '#f4f0e6').rect(6, 8, 2, 2, '#3a2010').rect(8, 9, 2, 1, '#3a2010');
    return g.outline(PAL.outline);
  },
  llavero_palma: () => {
    const g = new PixelGrid();
    g.rect(6, 1, 4, 1, '#c8c8d0').rect(5, 2, 1, 2, '#c8c8d0').rect(10, 2, 1, 2, '#c8c8d0');
    g.rect(7, 6, 2, 9, '#d8d4cc').rect(3, 5, 10, 2, '#2c6a34').rect(4, 4, 8, 1, '#5c9c4c');
    return g.outline(PAL.outline);
  },
  foto_krater: () => {
    const g = new PixelGrid();
    g.rect(1, 2, 14, 12, '#f8f8f0').rect(2, 3, 12, 8, '#9cd0f0').rect(2, 8, 12, 3, '#5c9c4c').rect(4, 6, 8, 2, '#c8303c').set(6, 5, '#f0c8a0').set(9, 5, '#f4d8c0');
    return g.outline(PAL.outline);
  },
  aji_casa: () => {
    const g = new PixelGrid();
    g.rect(4, 4, 8, 11, '#c8303c').rect(5, 2, 6, 2, '#2c9c58').rect(5, 6, 2, 6, '#e85a64').rect(8, 8, 2, 2, '#f4f0e6');
    return g.outline(PAL.outline);
  },
  manilla_parque: () => {
    const g = new PixelGrid();
    g.rect(2, 6, 12, 4, '#f8dc68').rect(2, 6, 12, 1, '#fff2a0').rect(5, 7, 6, 2, '#c8303c');
    return g.outline(PAL.outline);
  },
  corona_carton: () => {
    const g = new PixelGrid();
    g.rect(2, 8, 12, 5, '#f8dc68').rect(2, 4, 2, 4, '#f8dc68').rect(7, 3, 2, 5, '#f8dc68').rect(12, 4, 2, 4, '#f8dc68').rect(4, 10, 8, 1, '#c8303c');
    return g.outline(PAL.outline);
  },
  cafe_cosecha: () => {
    const g = new PixelGrid();
    g.rect(3, 4, 10, 11, '#d8b878').rect(3, 4, 10, 2, '#c8a060').rect(5, 8, 6, 4, '#f4ecd8').rect(6, 9, 1, 1, '#6a3c1c').rect(8, 10, 2, 1, '#6a3c1c').set(9, 9, '#c8303c');
    return g.outline(PAL.outline);
  },
  puesto_frutas_obj: () => stall([[2, 11, 3, 3, '#e8c020'], [6, 11, 3, 3, '#5c1c3c'], [10, 11, 4, 3, '#e86c1c']], '#c8303c'),
  puesto_queso_obj: () => stall([[2, 11, 5, 3, '#f8f0c8'], [8, 11, 6, 3, '#f0e0a0']], '#2c64c0'),
  puesto_cafe_obj: () => stall([[2, 11, 4, 4, '#8c5a34'], [7, 11, 4, 4, '#6a3c1c'], [12, 11, 3, 4, '#c8a070']], '#2c9c58'),
  puesto_artesania_obj: () => stall([[2, 11, 3, 3, '#c8303c'], [6, 11, 3, 3, '#2c64c0'], [10, 11, 4, 3, '#e8b828']], '#7c3ca8'),
  puesto_plantas_obj: () => stall([[2, 10, 3, 5, '#2c9c58'], [7, 10, 3, 5, '#1c6a3c'], [11, 10, 3, 5, '#5cc880']], '#e8b828'),
};
