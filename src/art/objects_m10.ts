import { PAL } from './palette';
import { PixelGrid } from './Painter';

/**
 * Objetos de 16×16 de la misión 10 (el río Pance con Danilo): la piedra lisa del río, la foto del puente colgante,
 * la pluma azul del barranquero, el vaso de lulada, la hoja de plátano del fiambre (coleccionables), la toalla, el
 * bloqueador, el neumático que alquila el Mono, la olla del sancocho de doña Fanny y las llaves del carro de Danilo.
 */
export const M10_OBJECTS: Record<string, () => PixelGrid> = {
  piedra_lisa: () => {
    const g = new PixelGrid();
    g.rect(2, 5, 12, 7, '#8c968c').rect(3, 4, 10, 1, '#8c968c').rect(3, 12, 10, 1, '#6c7468');
    g.rect(4, 5, 5, 2, '#b8c4b8').rect(6, 9, 6, 1, '#d8dcd0');
    return g.outline(PAL.outline);
  },
  foto_puente: () => {
    const g = new PixelGrid();
    g.rect(1, 2, 14, 12, '#f4f0e6').rect(2, 3, 12, 8, '#3c8040');
    g.rect(2, 8, 12, 3, '#3c9cac').rect(2, 6, 12, 1, '#c8ccd4').rect(3, 7, 10, 1, '#b08a5c');
    g.rect(6, 4, 1, 3, '#a87048').rect(9, 4, 1, 3, '#f8e2d4').set(6, 3, '#1c1418').set(9, 3, '#1c1418');
    g.rect(2, 11, 12, 2, '#f4f0e6');
    return g.outline(PAL.outline);
  },
  pluma_barranquero: () => {
    const g = new PixelGrid();
    for (let i = 0; i < 9; i++) g.rect(4 + i, 12 - i, 2, 2, i < 6 ? '#2c9cc8' : '#58d4d0');
    g.rect(12, 2, 2, 2, '#1c1c24').rect(13, 1, 1, 1, '#2c9cc8');
    for (let i = 1; i < 8; i++) g.set(5 + i, 13 - i, '#e8f4f8');
    g.rect(2, 13, 2, 2, '#5a3a20');
    return g.outline(PAL.outline);
  },
  vaso_lulada: () => {
    const g = new PixelGrid();
    g.rect(4, 3, 8, 11, '#f4f8f4').rect(5, 5, 6, 8, '#e8c030').rect(5, 5, 6, 1, '#f8e070');
    g.set(6, 8, '#3c8c3c').set(9, 10, '#3c8c3c').set(7, 11, '#3c8c3c').rect(9, 1, 1, 6, '#e85a64');
    return g.outline(PAL.outline);
  },
  hoja_fiambre: () => {
    const g = new PixelGrid();
    g.rect(2, 4, 12, 9, '#3c8c3c').rect(2, 8, 12, 1, '#2c6a2c').rect(3, 4, 10, 1, '#5aac4c');
    g.rect(6, 2, 4, 2, '#c8a070').rect(7, 13, 2, 2, '#c8a070');
    return g.outline(PAL.outline);
  },
  toalla_rio: () => {
    const g = new PixelGrid();
    g.rect(2, 3, 12, 11, '#e8742c').rect(2, 6, 12, 2, '#f4f0e6').rect(2, 10, 12, 2, '#2f6fd0');
    return g.outline(PAL.outline);
  },
  bloqueador: () => {
    const g = new PixelGrid();
    g.rect(5, 1, 6, 3, '#f4f0e6').rect(4, 4, 8, 11, '#f8c838').rect(5, 7, 6, 4, '#f4f0e6').rect(7, 8, 2, 2, '#e8742c');
    return g.outline(PAL.outline);
  },
  neumatico: () => {
    const g = new PixelGrid();
    g.circle(8, 8, 7, '#2a2a30').circle(8, 8, 3, null as unknown as string);
    g.rect(3, 4, 2, 1, '#4a4a54').rect(10, 12, 3, 1, '#4a4a54');
    return g.outline(PAL.outline);
  },
  olla_sancocho: () => {
    const g = new PixelGrid();
    g.rect(2, 6, 12, 8, '#3a3a44').rect(1, 5, 14, 2, '#686874').rect(3, 7, 10, 1, '#e8c030');
    g.set(5, 7, '#f4f0e6').set(9, 7, '#3c8c3c').set(5, 3, '#d8d8e0').set(8, 2, '#d8d8e0').set(11, 3, '#d8d8e0');
    g.rect(0, 8, 1, 2, '#3a3a44').rect(15, 8, 1, 2, '#3a3a44');
    return g.outline(PAL.outline);
  },
  llaves_danilo: () => {
    const g = new PixelGrid();
    g.circle(5, 5, 3, '#c8ccd4').circle(5, 5, 1, null as unknown as string);
    g.rect(7, 7, 6, 2, '#c8ccd4').rect(11, 9, 1, 2, '#c8ccd4').rect(9, 9, 1, 1, '#c8ccd4');
    g.rect(2, 9, 4, 5, '#1c1c24').rect(3, 10, 2, 2, '#e8c030');
    return g.outline(PAL.outline);
  },
};
