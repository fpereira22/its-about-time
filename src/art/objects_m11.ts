import { PAL } from './palette';
import { PixelGrid } from './Painter';

/**
 * Objetos de 16×16 de la misión 10 (prefijo m11_): el libro de La vorágine que Laura devuelve a la Itsisi, el
 * separador de Vale, la servilleta del Pato, la llave del 1104, la tira del fotomatón con Sira, la piedra con forma
 * de corazón de la Chorrera, la tele del 1104 y la carreta de las salchipapas de doña Chela.
 */
export const M11_OBJECTS: Record<string, () => PixelGrid> = {
  libro_voragine: () => {
    const g = new PixelGrid();
    g.rect(3, 2, 10, 12, '#2c6a34').rect(12, 2, 1, 12, '#f4f0e6');
    g.rect(5, 4, 6, 1, '#e8c060').rect(5, 6, 5, 1, '#e8c060').rect(5, 11, 6, 1, '#e8c060');
    return g.outline(PAL.outline);
  },
  separador_voragine: () => {
    const g = new PixelGrid();
    g.rect(6, 1, 4, 14, '#f4e8c8');
    g.rect(6, 3, 4, 2, '#3c8c3c').set(8, 5, '#6a4c30').set(8, 6, '#6a4c30');
    g.rect(7, 9, 2, 1, '#5a5048').rect(7, 11, 2, 1, '#5a5048');
    return g.outline(PAL.outline);
  },
  servilleta_pato: () => {
    const g = new PixelGrid();
    g.rect(2, 3, 12, 10, '#f8f8f4');
    g.rect(3, 4, 10, 2, '#d42c2c').rect(3, 4, 3, 1, '#1c3c9c');
    g.rect(3, 8, 8, 1, '#8c8c94').rect(3, 10, 6, 1, '#8c8c94');
    return g.outline(PAL.outline);
  },
  llave_1104: () => {
    const g = new PixelGrid();
    g.rect(2, 3, 5, 5, '#c8a040');
    for (let y = 4; y < 7; y++) for (let x = 3; x < 6; x++) g.set(x, y, null);
    g.rect(7, 5, 7, 2, '#c8a040').rect(12, 7, 1, 2, '#c8a040').rect(10, 7, 1, 1, '#c8a040');
    g.rect(2, 9, 5, 5, '#c8303c').rect(3, 11, 3, 1, '#f4f0e6');
    return g.outline(PAL.outline);
  },
  tira_fotomaton: () => {
    const g = new PixelGrid();
    g.rect(5, 0, 6, 16, '#f8f8f4');
    for (let i = 0; i < 4; i++) g.rect(6, 1 + i * 4, 4, 3, i === 3 ? '#e8a0b8' : '#c8b8a0');
    g.set(7, 14, '#c8303c').set(8, 14, '#c8303c');
    return g.outline(PAL.outline);
  },
  piedra_corazon: () => {
    const g = new PixelGrid();
    g.rect(3, 4, 4, 4, '#8c968c').rect(9, 4, 4, 4, '#8c968c').rect(3, 6, 10, 4, '#8c968c').rect(5, 10, 6, 2, '#8c968c').rect(7, 12, 2, 1, '#8c968c');
    g.rect(4, 5, 2, 1, '#b8c4b8').rect(10, 5, 2, 1, '#b8c4b8');
    return g.outline(PAL.outline);
  },
  tele_1104: () => {
    const g = new PixelGrid();
    g.rect(1, 3, 14, 9, '#1c1c24').rect(2, 4, 12, 7, '#5a8cc8').rect(3, 5, 4, 2, '#9cd0f0');
    g.rect(6, 12, 4, 2, '#3a3a44').rect(4, 14, 8, 1, '#3a3a44');
    return g.outline(PAL.outline);
  },
  carreta_salchipapa: () => {
    const g = new PixelGrid();
    g.rect(1, 6, 14, 7, '#e8c030').rect(1, 6, 14, 2, '#c8303c');
    g.rect(2, 2, 12, 4, '#f4f0e6').rect(3, 3, 3, 2, '#f0c050').rect(7, 3, 3, 2, '#c8583c');
    g.rect(3, 13, 2, 2, '#2a2433').rect(11, 13, 2, 2, '#2a2433');
    return g.outline(PAL.outline);
  },
};
