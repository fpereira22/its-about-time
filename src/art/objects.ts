import { PAL, shade } from './palette';
import { PixelGrid } from './Painter';
import { M8_OBJECTS } from './objects_m8';

/**
 * Objetos estáticos de 16×16 (un solo frame): carteles, máquinas, coleccionables e íconos.
 * Cada función devuelve una PixelGrid ya contorneada.
 */
export const OBJECT_ART: Record<string, () => PixelGrid> = {
  paradero: () => {
    const g = new PixelGrid();
    g.rect(7, 7, 2, 9, PAL.metalDark).rect(7, 7, 1, 9, PAL.metal);
    g.rect(3, 0, 10, 8, PAL.white).rect(3, 0, 10, 2, '#1e8c8c');
    g.rect(5, 3, 6, 3, PAL.outline).rect(6, 4, 4, 1, PAL.yellow);
    return g.outline(PAL.outline);
  },
  cartel: () => {
    const g = new PixelGrid();
    g.rect(7, 8, 2, 8, PAL.metalDark);
    g.rect(1, 1, 14, 7, '#2c6e9c').rect(2, 2, 12, 5, '#3c8ccc').rect(3, 4, 10, 1, PAL.white);
    return g.outline(PAL.outline);
  },
  /** Letrero de andén del metro (rojo L1, sin logos). */
  cartel_metro: () => {
    const g = new PixelGrid();
    g.rect(7, 9, 2, 7, PAL.metalDark).rect(7, 9, 1, 7, PAL.metal);
    g.rect(1, 1, 14, 8, PAL.metroRed).rect(2, 2, 12, 6, PAL.white);
    g.rect(3, 4, 10, 2, PAL.metroRed).rect(4, 3, 2, 4, PAL.white).rect(4, 4, 2, 2, PAL.metroRed);
    g.set(11, 4, PAL.white).set(11, 5, PAL.white);
    return g.outline(PAL.outline);
  },
  maquina_bip: () => {
    const g = new PixelGrid();
    g.rect(3, 1, 10, 15, PAL.metal).rect(3, 1, 10, 3, PAL.metroRed).rect(4, 5, 8, 5, PAL.tunnel);
    g.rect(5, 6, 6, 3, '#58c8a8').rect(6, 12, 4, 1, PAL.outline).rect(4, 15, 8, 1, PAL.metalDark);
    return g.outline(PAL.outline);
  },
  maquina_bip_mala: () => {
    const g = OBJECT_ART.maquina_bip();
    g.rect(4, 5, 8, 5, PAL.tunnel);
    for (let i = 0; i < 4; i++) g.set(5 + i, 6 + i % 3, PAL.red).set(10 - i, 6 + i % 3, PAL.red);
    g.rect(2, 10, 12, 2, PAL.yellow).rect(4, 10, 2, 2, PAL.black).rect(9, 10, 2, 2, PAL.black);
    return g;
  },
  carro_sopaipillas: () => {
    const g = new PixelGrid();
    for (let x = 1; x < 15; x++) {
      const top = Math.round(4 - Math.sqrt(Math.max(0, 49 - (x - 7.5) ** 2)) / 2);
      g.rect(x, Math.max(0, top), 1, 5 - Math.max(0, top), Math.floor(x / 2) % 2 ? PAL.red : PAL.white);
    }
    g.rect(7, 5, 1, 3, PAL.metalDark);
    g.rect(2, 8, 12, 5, PAL.yellow).rect(2, 10, 12, 1, PAL.red).rect(2, 8, 12, 1, shade(PAL.yellow, 0.3));
    g.rect(4, 7, 2, 1, PAL.orange).rect(9, 7, 3, 1, PAL.orange);
    g.rect(3, 13, 3, 2, PAL.outline).rect(10, 13, 3, 2, PAL.outline);
    return g.outline(PAL.outline);
  },
  carro_completos: () => {
    const g = new PixelGrid();
    for (let x = 1; x < 15; x++) {
      const top = Math.round(4 - Math.sqrt(Math.max(0, 49 - (x - 7.5) ** 2)) / 2);
      g.rect(x, Math.max(0, top), 1, 5 - Math.max(0, top), Math.floor(x / 2) % 2 ? '#2a52a0' : PAL.white);
    }
    g.rect(7, 5, 1, 3, PAL.metalDark);
    g.rect(2, 8, 12, 5, PAL.metalLight).rect(2, 10, 12, 1, PAL.red).rect(3, 8, 10, 1, PAL.white);
    g.rect(4, 7, 3, 1, '#78b048').rect(9, 7, 3, 1, PAL.red);
    g.rect(3, 13, 3, 2, PAL.outline).rect(10, 13, 3, 2, PAL.outline);
    return g.outline(PAL.outline);
  },
  empanada: () => {
    const g = new PixelGrid();
    for (let x = 3; x <= 12; x++) {
      const h = Math.round(Math.sqrt(Math.max(0, 25 - (x - 7.5) ** 2)));
      g.rect(x, 11 - h, 1, h + 1, '#e0a050');
    }
    g.rect(3, 11, 10, 1, '#b87830');
    for (let x = 4; x <= 11; x += 2) g.set(x, 11 - Math.round(Math.sqrt(Math.max(0, 25 - (x - 7.5) ** 2))), '#f8d090');
    g.set(6, 8, '#f8d090').set(7, 8, '#f8d090');
    return g.outline(PAL.outline);
  },
  completo: () => {
    const g = new PixelGrid();
    g.rect(1, 7, 14, 5, '#e0a860').rect(1, 11, 14, 1, '#b88040');
    g.rect(2, 6, 12, 2, '#c85838');
    g.rect(2, 5, 12, 2, '#78b048');
    g.set(3, 5, PAL.red).set(6, 5, PAL.red).set(9, 5, PAL.red).set(12, 5, PAL.red);
    for (let x = 2; x < 14; x += 3) g.set(x, 4, PAL.white).set(x + 1, 4, PAL.white);
    return g.outline(PAL.outline);
  },
  mote: () => {
    const g = new PixelGrid();
    g.rect(4, 2, 8, 13, '#e8f0f8').rect(5, 5, 6, 9, '#c88848').rect(5, 5, 6, 1, '#e0a868');
    g.rect(6, 7, 3, 3, PAL.orange).set(6, 7, '#f8b868');
    g.set(9, 11, PAL.white).set(7, 12, PAL.white).set(9, 13, PAL.white).set(6, 11, PAL.white);
    g.rect(10, 0, 1, 6, PAL.red);
    return g.outline(PAL.outline);
  },
  sopaipilla: () => {
    const g = new PixelGrid();
    g.circle(8, 9, 5.5, '#e8a048').circle(7, 8, 3, '#f0b860').set(6, 7, '#f8d890');
    g.rect(4, 3, 2, 2, PAL.red).rect(9, 2, 3, 2, PAL.red);
    return g.outline(PAL.outline);
  },
  bip: () => {
    const g = new PixelGrid();
    g.rect(1, 4, 14, 9, '#3cb4c8').rect(1, 4, 14, 2, '#2a8c9c').rect(3, 8, 4, 3, PAL.yellow);
    g.rect(9, 9, 4, 1, PAL.white).rect(9, 11, 3, 1, PAL.white);
    return g.outline(PAL.outline);
  },
  plata: () => {
    const g = new PixelGrid();
    g.circle(8, 8, 6, PAL.yellow).circle(8, 8, 4.5, '#f8d860').rect(7, 5, 2, 6, PAL.yellowDark);
    return g.outline(PAL.outline);
  },
  hueso: () => {
    const g = new PixelGrid();
    g.rect(4, 7, 8, 2, PAL.white).rect(2, 5, 3, 3, PAL.white).rect(2, 8, 3, 3, PAL.white);
    g.rect(11, 5, 3, 3, PAL.white).rect(11, 8, 3, 3, PAL.white);
    return g.outline(PAL.outline);
  },
  mapa: () => {
    const g = new PixelGrid();
    g.rect(2, 3, 12, 10, '#f0e0b0').rect(6, 3, 1, 10, '#c8b080').rect(10, 3, 1, 10, '#c8b080');
    g.rect(3, 7, 9, 1, PAL.red).set(12, 6, PAL.red).set(12, 8, PAL.red);
    return g.outline(PAL.outline);
  },
  torniquete: () => {
    const g = new PixelGrid();
    g.rect(1, 5, 3, 10, PAL.metal).rect(12, 5, 3, 10, PAL.metal);
    g.rect(1, 5, 3, 2, PAL.metalLight).rect(12, 5, 3, 2, PAL.metalLight);
    g.rect(4, 9, 8, 2, PAL.red).rect(4, 9, 8, 1, PAL.seatRedLight);
    g.rect(12, 7, 2, 1, PAL.green);
    return g.outline(PAL.outline);
  },
  timbre: () => {
    const g = new PixelGrid();
    g.rect(5, 2, 6, 10, PAL.metalLight).rect(6, 4, 4, 4, PAL.red).rect(7, 5, 2, 2, PAL.seatRedLight);
    return g.outline(PAL.outline);
  },
  mochila: () => {
    const g = new PixelGrid();
    g.rect(4, 4, 8, 11, '#e8a030').rect(4, 4, 8, 2, '#f8c060').rect(5, 9, 6, 4, '#c87820').rect(5, 9, 6, 1, '#f0b050');
    g.rect(6, 2, 4, 2, '#a86818').set(7, 3, null).set(8, 3, null).rect(7, 11, 2, 1, PAL.metalLight);
    return g.outline(PAL.outline);
  },
  platos: () => {
    const g = new PixelGrid();
    g.circle(6, 9, 4.5, '#f4f4f0').circle(6, 9, 2.5, '#e0dccc').set(5, 8, '#c89050').set(7, 10, '#a85838');
    g.circle(11, 7, 3.5, '#e8e8f0').circle(11, 7, 1.8, '#d8d4c8');
    g.rect(13, 10, 1, 5, PAL.metalLight).rect(2, 3, 1, 4, PAL.metalLight);
    return g.outline(PAL.outline);
  },
  marraqueta: () => {
    const g = new PixelGrid();
    g.circle(5.5, 9, 4, '#e0a860').circle(10.5, 9, 4, '#e0a860').rect(8, 6, 1, 7, '#b88040');
    g.rect(3, 7, 10, 2, '#78b048').rect(4, 7, 8, 1, '#98d060');
    return g.outline(PAL.outline);
  },
  cafe: () => {
    const g = new PixelGrid();
    g.rect(4, 5, 8, 10, '#f4f0e4').rect(4, 5, 8, 2, '#5a3820').rect(4, 9, 8, 3, '#c83838');
    g.rect(5, 3, 6, 2, PAL.white).rect(7, 0, 1, 2, '#c8c8c8').rect(9, 1, 1, 2, '#c8c8c8');
    return g.outline(PAL.outline);
  },
  // --- Misión 3 ---
  maleta: () => {
    const g = new PixelGrid();
    g.rect(3, 4, 10, 11, '#2f4a8c').rect(3, 4, 10, 2, '#4a6ab8').rect(7, 4, 2, 11, '#1e3060');
    g.rect(6, 1, 4, 1, PAL.metalDark).rect(6, 1, 1, 3, PAL.metalDark).rect(9, 1, 1, 3, PAL.metalDark);
    g.rect(4, 15, 2, 1, PAL.outline).rect(10, 15, 2, 1, PAL.outline).rect(10, 8, 2, 3, '#f0d048');
    return g.outline(PAL.outline);
  },
  carnet: () => {
    const g = new PixelGrid();
    g.rect(1, 4, 14, 9, '#d8e8f0').rect(1, 4, 14, 2, '#2f5fb0').rect(2, 7, 4, 5, '#c8a888').rect(3, 7, 2, 2, '#4a3020');
    g.rect(7, 7, 6, 1, '#6a6c78').rect(7, 9, 5, 1, '#6a6c78').rect(7, 11, 3, 1, '#d84848');
    return g.outline(PAL.outline);
  },
  pase: () => {
    const g = new PixelGrid();
    g.rect(1, 4, 14, 8, PAL.white).rect(1, 4, 14, 2, '#2f6fd0').rect(11, 6, 1, 6, '#c8ccd4');
    g.rect(3, 7, 6, 1, '#2a2433').rect(3, 9, 4, 1, '#6a6c78').rect(12, 7, 2, 4, '#2a2433');
    return g.outline(PAL.outline);
  },
  dibujo: () => {
    const g = new PixelGrid();
    g.rect(2, 2, 12, 12, PAL.white).rect(3, 9, 10, 4, '#78c060');
    // Tres monitos de palito y un avión: la familia despidiéndose.
    for (const x of [4, 7, 10]) g.rect(x, 7, 1, 3, '#2a2433').set(x, 6, '#e86050');
    g.rect(8, 3, 5, 1, '#2f6fd0').set(10, 2, '#2f6fd0').set(4, 3, '#f0c030');
    return g.outline(PAL.outline);
  },
  alfajor: () => {
    const g = new PixelGrid();
    g.circle(8, 9, 5.5, '#5a3418').circle(8, 8, 5, '#7a4828').rect(3, 8, 10, 1, '#f0e0c0').set(6, 6, '#9a6440');
    return g.outline(PAL.outline);
  },
  pandebono: () => {
    const g = new PixelGrid();
    g.circle(8, 9, 5, '#e8b860').circle(7, 8, 3, '#f4d088').set(6, 7, '#fff0c0').set(10, 11, '#c88838');
    return g.outline(PAL.outline);
  },
  chontaduro: () => {
    const g = new PixelGrid();
    g.circle(6, 9, 3.5, '#e86830').circle(10.5, 8, 3.5, '#f08838').set(5, 8, '#f8b068').set(10, 7, '#f8b068');
    g.rect(3, 13, 10, 1, '#c8a060').set(13, 12, '#f0f0e0');
    return g.outline(PAL.outline);
  },
  manjar: () => {
    const g = new PixelGrid();
    g.rect(4, 5, 8, 10, '#e8e4dc').rect(4, 4, 8, 2, '#d84848').rect(5, 8, 6, 5, '#a8682c').rect(5, 8, 6, 1, '#c88848');
    return g.outline(PAL.outline);
  },
  lapiz_rojo: () => {
    const g = new PixelGrid();
    for (let i = 0; i < 10; i++) g.set(3 + i, 12 - i, '#d82838').set(4 + i, 12 - i, '#a81828');
    g.set(2, 13, '#f0d0a0').set(3, 13, '#2a2433').set(13, 2, '#f0a0a8').set(14, 2, '#f0a0a8');
    return g.outline(PAL.outline);
  },
  plato_cena: () => {
    const g = new PixelGrid();
    g.circle(8, 9, 6, '#f4f4f0').circle(8, 9, 4, '#e8e4d8');
    // Pastel de choclo dorado con azúcar y una ensalada a la chilena.
    g.rect(5, 7, 5, 4, '#e8b840').rect(5, 7, 5, 1, '#f8d870').set(6, 8, '#c88820');
    g.rect(10, 9, 2, 2, '#e85040').set(11, 8, '#f8f0e8');
    return g.outline(PAL.outline);
  },
  cartel_vuelos: () => {
    const g = new PixelGrid();
    g.rect(7, 10, 2, 6, PAL.metalDark);
    g.rect(0, 1, 16, 10, '#1a1c24').rect(1, 2, 14, 8, '#14286a');
    for (const y of [3, 5, 7]) g.rect(2, y, 4, 1, '#f0d048').rect(7, y, 6, 1, '#e8ecf8');
    return g.outline(PAL.outline);
  },
  cartel_chofer: () => {
    const g = new PixelGrid();
    g.rect(1, 3, 14, 8, PAL.white).rect(1, 3, 14, 2, '#3cb46c').rect(3, 6, 10, 1, '#2a2433').rect(4, 8, 8, 1, '#2a2433');
    g.rect(4, 11, 1, 5, '#8a6a40').rect(11, 11, 1, 5, '#8a6a40');
    return g.outline(PAL.outline);
  },
  // --- Misión 4 (Cali) ---
  paraguas: () => {
    const g = new PixelGrid();
    for (let x = 1; x < 15; x++) {
      const top = Math.round(6 - Math.sqrt(Math.max(0, 49 - (x - 7.5) ** 2)));
      g.rect(x, Math.max(0, top), 1, 7 - Math.max(0, top), x % 4 < 2 ? '#2a2c38' : '#3c3e4c');
    }
    g.rect(7, 7, 1, 7, PAL.metalDark).rect(5, 13, 3, 1, '#7a5030').set(5, 12, '#7a5030');
    return g.outline(PAL.outline);
  },
  carnet_pucc: () => {
    const g = new PixelGrid();
    g.rect(1, 4, 14, 9, '#f8f8f0').rect(1, 4, 14, 3, '#2050a8').rect(2, 8, 4, 4, '#c8d8e8').rect(3, 9, 2, 2, '#f0c8a0');
    g.rect(7, 8, 6, 1, '#8a8a96').rect(7, 10, 5, 1, '#8a8a96').rect(1, 7, 14, 1, '#f0c030');
    return g.outline(PAL.outline);
  },
  polera: () => {
    const g = new PixelGrid();
    g.rect(4, 3, 8, 11, '#2050a8').rect(1, 3, 3, 4, '#2050a8').rect(12, 3, 3, 4, '#2050a8').rect(6, 3, 4, 1, '#f0c030');
    g.rect(7, 6, 1, 4, PAL.white).rect(9, 6, 1, 4, PAL.white).rect(4, 13, 8, 1, '#183c80');
    return g.outline(PAL.outline);
  },
  bunuelo: () => {
    const g = new PixelGrid();
    g.circle(8, 9, 5, '#d89840').circle(8, 8, 4, '#e8b058').set(6, 6, '#f8d890').set(7, 6, '#f8d890').set(10, 11, '#b87828');
    return g.outline(PAL.outline);
  },
  lulada: () => {
    const g = new PixelGrid();
    g.rect(4, 3, 8, 12, '#e0eef4').rect(5, 6, 6, 8, '#c8c840').rect(5, 6, 6, 1, '#e8e890').set(6, 9, '#4a8a38').set(9, 11, '#4a8a38');
    g.rect(9, 0, 1, 6, '#e84848');
    return g.outline(PAL.outline);
  },
  cholado: () => {
    const g = new PixelGrid();
    g.rect(4, 6, 8, 9, '#e0eef4').rect(5, 7, 6, 7, '#f0f0f8').rect(5, 10, 6, 4, '#e86878').rect(5, 8, 6, 2, '#f8e070');
    g.circle(8, 5, 3, '#f8f0e0').set(7, 3, '#e83848').set(9, 4, '#68b848').set(8, 2, '#f8c838');
    return g.outline(PAL.outline);
  },
  aborrajado: () => {
    const g = new PixelGrid();
    g.rect(2, 6, 12, 6, '#d88830').rect(3, 5, 10, 1, '#e8a848').rect(3, 7, 10, 2, '#f0b858').rect(5, 9, 6, 2, '#f8f0c8');
    g.rect(4, 12, 9, 1, '#a86020');
    return g.outline(PAL.outline);
  },
  iguana: () => {
    const g = new PixelGrid();
    g.rect(2, 9, 9, 3, '#58a048').rect(10, 8, 4, 3, '#68b058').set(13, 9, '#202028').set(11, 11, '#c8b048');
    for (let x = 3; x < 10; x += 2) g.set(x, 8, '#3c7c38');
    g.rect(0, 11, 3, 1, '#58a048').set(0, 12, '#58a048').rect(3, 12, 1, 2, '#3c7c38').rect(8, 12, 1, 2, '#3c7c38');
    return g.outline(PAL.outline);
  },
  paradero_cali: () => {
    const g = new PixelGrid();
    g.rect(7, 7, 2, 9, PAL.metalDark).rect(7, 7, 1, 9, PAL.metal);
    g.rect(2, 0, 12, 8, PAL.white).rect(2, 0, 12, 3, '#2c9c4c').rect(4, 4, 8, 2, '#2a2433').rect(5, 5, 2, 1, PAL.yellow);
    return g.outline(PAL.outline);
  },
  pelota: () => {
    const g = new PixelGrid();
    g.circle(8, 9, 5, '#f8f8f0').rect(7, 8, 2, 2, '#2a2433').set(5, 7, '#2a2433').set(11, 11, '#2a2433').set(11, 6, '#2a2433');
    return g.outline(PAL.outline);
  },
  carro_cholados: () => {
    const g = new PixelGrid();
    for (let x = 1; x < 15; x++) {
      const top = Math.round(4 - Math.sqrt(Math.max(0, 49 - (x - 7.5) ** 2)) / 2);
      g.rect(x, Math.max(0, top), 1, 5 - Math.max(0, top), Math.floor(x / 2) % 2 ? '#e86878' : PAL.white);
    }
    g.rect(7, 5, 1, 3, PAL.metalDark);
    g.rect(2, 8, 12, 5, '#58b8e8').rect(2, 8, 12, 1, '#a8e0f8').rect(4, 9, 2, 2, '#f8e070').rect(9, 9, 3, 2, '#e86878');
    g.rect(3, 13, 3, 2, PAL.outline).rect(10, 13, 3, 2, PAL.outline);
    return g.outline(PAL.outline);
  },
  apuntes: () => {
    const g = new PixelGrid();
    g.rect(3, 2, 10, 13, '#f8f8f0').rect(3, 2, 2, 13, '#3c6cd0');
    for (const y of [5, 7, 9, 11]) g.rect(6, y, 6, 1, '#8a8a96');
    g.rect(6, 12, 3, 1, PAL.red);
    return g.outline(PAL.outline);
  },

  // --- Misión 5 ---

  /** Poste giratorio de barbería: rayas rojas, blancas y azules en un tubo de vidrio. */
  poste_barberia: () => {
    const g = new PixelGrid();
    g.rect(6, 0, 4, 2, '#d8a838').rect(6, 13, 4, 3, '#d8a838');
    for (let y = 2; y < 13; y++) {
      for (let x = 6; x < 10; x++) {
        const k = (x + y) % 6;
        g.set(x, y, k < 2 ? '#d83838' : k < 4 ? '#f4f4f0' : '#2f5fb0');
      }
    }
    g.set(6, 3, '#ffffff').set(6, 7, '#ffffff');
    return g.outline(PAL.outline);
  },
  /** Las llaves del carro de Grover, con el llavero de llama tejida. */
  llaves_grover: () => {
    const g = new PixelGrid();
    g.circle(5, 5, 3, '#c8ccd4');
    g.set(4, 4, null).set(5, 4, null).set(4, 5, null).set(5, 5, null);
    g.rect(6, 7, 1, 6, '#e0b840').rect(7, 9, 2, 1, '#e0b840').rect(7, 11, 1, 1, '#e0b840');
    // La llama: cuerpo blanco, cuello largo y una mantita de colores.
    g.rect(9, 9, 5, 3, '#f4f0e6').rect(12, 5, 2, 5, '#f4f0e6').set(13, 4, '#f4f0e6').set(12, 6, '#202028');
    g.rect(9, 9, 3, 1, '#e84868').rect(9, 10, 3, 1, '#f0c030').rect(9, 12, 1, 2, '#f4f0e6').rect(12, 12, 1, 2, '#f4f0e6');
    return g.outline(PAL.outline);
  },
  mango_biche: () => {
    const g = new PixelGrid();
    g.rect(4, 2, 8, 13, '#e8f0f4').rect(5, 3, 6, 11, '#f4f8fa');
    for (const [x, y] of [[5, 4], [8, 5], [6, 8], [9, 9], [5, 11], [8, 12]] as const) g.rect(x, y, 2, 2, '#9cd048').set(x, y, '#c8e878');
    g.set(7, 6, '#e85838').set(10, 11, '#e85838').set(6, 10, '#f8f8f0');
    return g.outline(PAL.outline);
  },
  salpicon: () => {
    const g = new PixelGrid();
    g.rect(4, 3, 8, 12, '#e8f0f4').rect(5, 5, 6, 9, '#e84868').rect(5, 5, 6, 1, '#f08898');
    const bits: Array<[number, number, string]> = [[6, 7, '#f0c030'], [9, 8, '#68b848'], [7, 10, '#f8a838'], [9, 12, '#f8f0e0'], [6, 12, '#a050c0']];
    for (const [x, y, c] of bits) g.rect(x, y, 2, 1, c);
    g.rect(10, 0, 1, 6, '#f0f0f0');
    return g.outline(PAL.outline);
  },
  champus: () => {
    const g = new PixelGrid();
    g.rect(4, 4, 8, 11, '#e0eef4').rect(5, 6, 6, 8, '#f0b830').rect(5, 6, 6, 1, '#f8d870');
    g.set(6, 8, '#f8f0c0').set(8, 9, '#f8f0c0').set(9, 11, '#c87828').set(6, 12, '#78a838');
    g.rect(7, 0, 1, 6, '#c87828').set(8, 1, '#78a838');
    return g.outline(PAL.outline);
  },
  pan_de_yuca: () => {
    const g = new PixelGrid();
    for (let x = 2; x < 14; x++) {
      const y = Math.round(8 - Math.sin(((x - 2) / 11) * Math.PI) * 3);
      g.rect(x, y, 1, 4, '#f0d090');
    }
    g.rect(4, 7, 8, 1, '#f8e8b8').set(3, 10, '#d0a058').set(12, 10, '#d0a058');
    return g.outline(PAL.outline);
  },
  carreta_mango: () => {
    const g = new PixelGrid();
    g.rect(1, 1, 14, 3, '#f0c030').rect(1, 1, 14, 1, '#f8e070').rect(7, 4, 1, 4, PAL.metalDark);
    g.rect(1, 8, 14, 5, '#3c9c48').rect(2, 8, 12, 2, '#e8f0f4');
    for (const x of [3, 6, 9, 12]) g.set(x, 8, '#9cd048').set(x, 9, '#e85838');
    g.rect(3, 13, 3, 2, PAL.outline).rect(10, 13, 3, 2, PAL.outline);
    return g.outline(PAL.outline);
  },
  puesto_salpicon: () => {
    const g = new PixelGrid();
    g.rect(0, 0, 16, 4, '#e84868').rect(0, 0, 16, 1, '#f08898');
    for (let x = 1; x < 16; x += 4) g.rect(x, 0, 2, 4, '#f4f4f0');
    g.rect(1, 4, 1, 5, PAL.metalDark).rect(14, 4, 1, 5, PAL.metalDark);
    g.rect(1, 9, 14, 6, '#f4f0e6').rect(3, 7, 4, 3, '#e0eef4').rect(4, 8, 2, 2, '#e84868').rect(9, 7, 4, 3, '#e0eef4').rect(10, 8, 2, 2, '#f0b830');
    return g.outline(PAL.outline);
  },
  antiparras: () => {
    const g = new PixelGrid();
    g.rect(1, 7, 14, 1, '#2050a8');
    g.rect(2, 5, 5, 5, '#2a2433').rect(3, 6, 3, 3, '#58c8f0').set(3, 6, '#c8f0ff');
    g.rect(9, 5, 5, 5, '#2a2433').rect(10, 6, 3, 3, '#58c8f0').set(10, 6, '#c8f0ff');
    g.rect(7, 7, 2, 1, '#2a2433');
    return g.outline(PAL.outline);
  },
  hamburguesa: () => {
    const g = new PixelGrid();
    g.rect(3, 3, 10, 3, '#e8a040').rect(4, 2, 8, 1, '#e8a040').set(6, 3, '#f8e8b8').set(9, 4, '#f8e8b8');
    g.rect(2, 6, 12, 1, '#68c048').rect(3, 7, 10, 1, '#f8d030').rect(2, 8, 12, 2, '#7a3a20').rect(3, 10, 10, 1, '#e84838');
    g.rect(3, 11, 10, 2, '#d88830');
    return g.outline(PAL.outline);
  },
  semaforo: () => {
    const g = new PixelGrid();
    g.rect(7, 9, 2, 7, PAL.metalDark);
    g.rect(5, 0, 6, 10, '#2a2a30').circle(8, 2, 1.5, '#e83838').circle(8, 5, 1.5, '#4a4020').circle(8, 8, 1.5, '#204a28');
    return g.outline(PAL.outline);
  },
  mesa_domino: () => {
    const g = new PixelGrid();
    g.rect(1, 3, 14, 9, '#2c7c48').rect(1, 3, 14, 1, '#3c9c5c').rect(2, 12, 2, 4, '#6a4a30').rect(12, 12, 2, 4, '#6a4a30');
    for (const [x, y] of [[3, 5], [6, 6], [9, 5], [11, 8], [5, 9]] as const) g.rect(x, y, 2, 1, '#f8f8f0').set(x, y, '#202028');
    return g.outline(PAL.outline);
  },
  jaula_loro: () => {
    const g = new PixelGrid();
    g.rect(7, 0, 2, 1, '#d8a838');
    for (let x = 3; x < 13; x += 2) g.rect(x, 2, 1, 12, '#d8a838');
    g.rect(3, 1, 10, 1, '#d8a838').rect(3, 14, 10, 2, '#d8a838');
    g.rect(6, 5, 4, 6, '#3cb048').rect(7, 3, 3, 3, '#3cb048').set(9, 4, '#202028').set(10, 4, '#f0c030').rect(6, 9, 2, 3, '#e84838');
    return g.outline(PAL.outline);
  },
  kiosko_champus: () => {
    const g = new PixelGrid();
    g.rect(0, 0, 16, 4, '#2050a8').rect(0, 0, 16, 1, '#3c70c8').rect(1, 4, 1, 4, PAL.metalDark).rect(14, 4, 1, 4, PAL.metalDark);
    g.rect(1, 8, 14, 7, '#e8e4d8').rect(3, 5, 3, 4, '#f0b830').rect(10, 6, 3, 3, '#f0d090');
    return g.outline(PAL.outline);
  },
  maquina_snacks: () => {
    const g = new PixelGrid();
    g.rect(2, 0, 12, 16, '#c83838').rect(3, 1, 8, 12, '#1a2030');
    const colors = ['#f0c030', '#58c070', '#3c8ce0'];
    for (const y of [2, 5, 8]) for (const x of [4, 6, 8]) g.rect(x, y, 2, 2, colors[(x + y) % 3]);
    g.rect(12, 3, 1, 4, '#e8e8f0').rect(4, 13, 6, 2, '#2a2a30');
    return g.outline(PAL.outline);
  },
  cartas_cinco: () => {
    const g = new PixelGrid();
    g.rect(2, 4, 7, 10, '#f8f8f0').rect(3, 5, 5, 8, '#e84838').rect(5, 7, 1, 4, '#f8f8f0');
    g.rect(7, 2, 7, 10, '#f8f8f0').rect(8, 3, 5, 8, '#2f6fd0');
    g.rect(9, 4, 3, 1, '#f8f8f0').rect(9, 4, 1, 3, '#f8f8f0').rect(9, 6, 3, 1, '#f8f8f0').rect(11, 6, 1, 3, '#f8f8f0').rect(9, 8, 3, 1, '#f8f8f0');
    return g.outline(PAL.outline);
  },
  toalla: () => {
    const g = new PixelGrid();
    g.rect(2, 4, 12, 9, '#f0c030').rect(2, 6, 12, 1, '#e84868').rect(2, 10, 12, 1, '#e84868').rect(2, 4, 12, 1, '#f8e070');
    return g.outline(PAL.outline);
  },
  traje_bano: () => {
    const g = new PixelGrid();
    g.rect(3, 3, 10, 4, '#2f6fd0').rect(3, 7, 4, 6, '#2f6fd0').rect(9, 7, 4, 6, '#2f6fd0');
    for (const [x, y] of [[4, 4], [9, 5], [5, 9], [10, 10]] as const) g.rect(x, y, 2, 2, '#f4f0e6').set(x, y + 1, '#e84868');
    g.rect(3, 3, 10, 1, '#f0c030');
    return g.outline(PAL.outline);
  },
  // --- Misión 6 ---
  tarjeta_recorre: () => {
    const g = new PixelGrid();
    g.rect(1, 4, 14, 9, '#2c8c5c').rect(2, 5, 12, 2, '#48b07c').rect(3, 8, 4, 3, '#f0c030').rect(9, 9, 4, 1, '#f8f8f0').rect(9, 11, 3, 1, '#f8f8f0');
    return g.outline(PAL.outline);
  },
  separador: () => {
    const g = new PixelGrid();
    g.rect(5, 1, 6, 14, '#f4ecd8').rect(6, 2, 4, 12, '#fbf6ea').rect(7, 0, 2, 2, '#c83c3c');
    g.rect(6, 6, 4, 3, '#f0c030').set(7, 7, '#c89820').set(8, 5, '#f8e070').set(8, 9, '#58a048').set(8, 10, '#58a048');
    return g.outline(PAL.outline);
  },
  libro_regalo: () => {
    const g = new PixelGrid();
    g.rect(3, 2, 10, 12, '#e86078').rect(3, 2, 2, 12, '#b83c58').rect(6, 4, 5, 2, '#f8f0e0').rect(6, 7, 5, 1, '#f8f0e0');
    g.rect(3, 13, 10, 1, '#f8f0e0').rect(12, 2, 1, 12, '#f8f0e0');
    return g.outline(PAL.outline);
  },
  girasol: () => {
    const g = new PixelGrid();
    g.rect(7, 8, 2, 8, '#3c9050').rect(9, 11, 3, 2, '#58a048');
    g.circle(8, 5.5, 5, '#f0c030').circle(8, 5.5, 2.4, '#6a4228');
    return g.outline(PAL.outline);
  },
  oblea: () => {
    const g = new PixelGrid();
    g.circle(8, 8, 6.5, '#f4e2b0').circle(8, 8, 5, '#e8c888').rect(4, 7, 8, 2, '#c87838').rect(5, 6, 3, 1, '#7c2c5c');
    return g.outline(PAL.outline);
  },
  bombombun: () => {
    const g = new PixelGrid();
    g.rect(7, 8, 2, 7, '#f8f8f0').circle(8, 5.5, 4, '#e84868').rect(6, 4, 2, 2, '#f8a0b8');
    return g.outline(PAL.outline);
  },
  fanzine: () => {
    const g = new PixelGrid();
    g.rect(3, 2, 10, 12, '#f4f2ea').rect(3, 2, 10, 3, '#2a2433').rect(5, 6, 6, 6, '#c83c3c').rect(6, 7, 1, 1, '#f0c030').rect(9, 7, 1, 1, '#f0c030');
    g.rect(5, 6, 1, 2, '#2a2433').rect(10, 6, 1, 2, '#2a2433');
    return g.outline(PAL.outline);
  },
  tinto: () => {
    const g = new PixelGrid();
    g.rect(4, 5, 8, 9, '#f8f8f0').rect(5, 5, 6, 2, '#4a2a18').rect(5, 1, 1, 3, '#e8e8f0').rect(8, 0, 1, 3, '#e8e8f0');
    return g.outline(PAL.outline);
  },
  poema: () => {
    const g = new PixelGrid();
    g.rect(3, 1, 10, 14, '#fbf8ee');
    for (let y = 3; y < 13; y += 2) g.rect(5, y, 6 - (y % 4), 1, '#5a5468');
    g.rect(10, 11, 2, 2, '#e86078');
    return g.outline(PAL.outline);
  },
  estatua: () => {
    // Monumento de bronce sobre su pedestal (Jorge Isaacs, los poetas del parque).
    const g = new PixelGrid();
    g.rect(3, 11, 10, 5, '#b8b0a0').rect(3, 11, 10, 1, '#d8d0c0');
    g.rect(6, 4, 4, 7, '#5a6a5a').rect(6, 1, 4, 3, '#6a7c6a').rect(4, 5, 2, 4, '#5a6a5a').rect(10, 5, 2, 4, '#5a6a5a').rect(7, 2, 1, 1, '#8aa08a');
    return g.outline(PAL.outline);
  },
  tablero_rutas: () => {
    const g = new PixelGrid();
    g.rect(7, 10, 2, 6, PAL.metalDark);
    g.rect(1, 0, 14, 11, '#1c2a24').rect(2, 1, 12, 9, '#2c8c5c');
    g.rect(3, 3, 10, 1, '#f8f8f0').rect(3, 5, 8, 1, '#f0c030').rect(3, 7, 9, 1, '#f8f8f0');
    return g.outline(PAL.outline);
  },
  piedra: () => {
    const g = new PixelGrid();
    g.circle(8, 9, 5.5, '#3c78c8').rect(4, 7, 3, 1, '#7cacec');
    g.rect(7, 8, 4, 2, '#f0c030').set(11, 8, '#f0c030').set(12, 7, '#f0c030').set(12, 10, '#f0c030').set(8, 8, '#2a2433');
    return g.outline(PAL.outline);
  },
  mazorcas: () => {
    const g = new PixelGrid();
    g.rect(2, 9, 12, 6, '#d8d0b8').rect(2, 9, 12, 1, '#a8a090');
    g.rect(4, 2, 3, 9, '#f0d048').rect(9, 3, 3, 8, '#f0d048').rect(5, 3, 1, 7, '#c8a830').rect(10, 4, 1, 6, '#c8a830');
    g.rect(3, 6, 1, 5, '#68b848').rect(12, 6, 1, 5, '#68b848').rect(7, 1, 2, 6, '#3c9050');
    return g.outline(PAL.outline);
  },

  // --- Misión 7 ---
  carrito_helados: () => {
    // El carrito de don Efraín: caja blanca con la sombrilla de rayas y las ruedas.
    const g = new PixelGrid();
    g.rect(1, 1, 14, 3, '#e85a7a').rect(3, 1, 2, 3, '#f8f8f0').rect(7, 1, 2, 3, '#f8f8f0').rect(11, 1, 2, 3, '#f8f8f0');
    g.rect(7, 4, 1, 4, PAL.metalDark);
    g.rect(2, 8, 12, 5, '#f8f8f0').rect(2, 8, 12, 1, '#c8e4f0').rect(4, 9, 3, 2, '#f0c830').rect(8, 9, 3, 2, '#e8a0b8');
    g.rect(3, 13, 3, 3, '#3a3a44').rect(10, 13, 3, 3, '#3a3a44');
    return g.outline(PAL.outline);
  },
  cono_helado: () => {
    const g = new PixelGrid();
    g.circle(8, 5, 4, '#c8884c').rect(6, 3, 2, 1, '#e8b880');
    g.rect(5, 8, 6, 2, '#d8a058').rect(6, 10, 4, 2, '#d8a058').rect(7, 12, 2, 2, '#d8a058').set(8, 14, '#d8a058');
    g.set(6, 9, '#a87838').set(9, 10, '#a87838');
    return g.outline(PAL.outline);
  },
  maqueta: () => {
    // La maqueta del mirador sobre el río Pance: base de cartón, el río, el mirador de palitos y una banderita.
    const g = new PixelGrid();
    g.rect(1, 8, 14, 6, '#e8d8b0').rect(1, 13, 14, 1, '#b8a880');
    g.rect(1, 10, 14, 2, '#6aa8d8');
    g.rect(5, 3, 6, 6, '#f4efe4').rect(5, 3, 6, 1, '#a87048').rect(6, 4, 1, 4, '#a87048').rect(9, 4, 1, 4, '#a87048');
    g.rect(12, 4, 1, 5, '#5a5a64').rect(13, 4, 2, 1, '#d83c3c').rect(13, 5, 2, 1, '#f8f8f0');
    g.rect(2, 6, 2, 3, '#58a048').rect(3, 5, 1, 1, '#58a048');
    return g.outline(PAL.outline);
  },
  foto_pavo: () => {
    const g = new PixelGrid();
    g.rect(2, 2, 12, 12, '#f8f8f0').rect(3, 3, 10, 8, '#3c7c58');
    g.circle(8, 7, 3.2, '#2c8c9c').set(8, 7, '#f0c830');
    g.rect(4, 8, 2, 3, '#f8e2d4').rect(10, 8, 2, 3, '#f0c8a0');
    return g.outline(PAL.outline);
  },
  bolsa_mercado: () => {
    const g = new PixelGrid();
    g.rect(3, 6, 10, 9, '#e8dcc0').rect(3, 6, 10, 1, '#c8bca0').rect(5, 3, 1, 4, '#c8bca0').rect(10, 3, 1, 4, '#c8bca0');
    g.circle(6, 5, 2, '#d83c3c').rect(9, 2, 1, 5, '#e88838').rect(9, 1, 1, 1, '#58a048').rect(11, 3, 2, 3, '#58a048');
    return g.outline(PAL.outline);
  },
  caja_mudanza: () => {
    const g = new PixelGrid();
    g.rect(1, 3, 14, 12, '#c89c6c').rect(1, 3, 14, 1, '#e0b88c').rect(7, 3, 2, 12, '#e8d8a8').rect(3, 9, 3, 2, '#7a4c30').rect(10, 9, 3, 2, '#7a4c30');
    return g.outline(PAL.outline);
  },
  ropa_tirada: () => {
    const g = new PixelGrid();
    g.rect(1, 9, 7, 5, '#2050a8').rect(2, 8, 5, 1, '#2050a8').rect(8, 10, 6, 3, '#3a3c44').rect(10, 13, 4, 2, '#3a3c44');
    g.rect(4, 14, 3, 1, '#f8f8f0').rect(12, 7, 3, 3, '#e8e8e0');
    return g.outline(PAL.outline);
  },
  botella_calena: () => {
    // La Caleña: gaseosa dorada «sabor a fiesta», etiqueta roja con una palmita.
    const g = new PixelGrid();
    g.rect(7, 0, 2, 3, '#d83c3c').rect(6, 3, 4, 2, '#e8b030').rect(5, 5, 6, 10, '#e8b030');
    g.rect(5, 8, 6, 4, '#d83c3c').rect(7, 9, 1, 2, '#58a048').rect(8, 9, 1, 1, '#58a048').rect(6, 5, 1, 3, '#f8d880');
    return g.outline(PAL.outline);
  },
  botella_kola: () => {
    const g = new PixelGrid();
    g.rect(7, 0, 2, 3, '#d83c3c').rect(6, 3, 4, 2, '#3a2418').rect(5, 5, 6, 10, '#3a2418');
    g.rect(5, 8, 6, 3, '#d83c3c').rect(6, 9, 4, 1, '#f8f8f0').rect(6, 5, 1, 3, '#7a4c30');
    return g.outline(PAL.outline);
  },
  botella_rojo: () => {
    const g = new PixelGrid();
    g.rect(7, 0, 2, 3, '#2c9c4c').rect(6, 3, 4, 2, '#d83c3c').rect(5, 5, 6, 10, '#d83c3c');
    g.rect(5, 8, 6, 4, '#f8f8f0').circle(8, 10, 1.6, '#d83c3c').set(8, 8, '#2c9c4c').rect(6, 5, 1, 3, '#f08080');
    return g.outline(PAL.outline);
  },
  crispetas: () => {
    const g = new PixelGrid();
    g.rect(4, 6, 8, 9, '#f8f8f0').rect(4, 6, 2, 9, '#d83c3c').rect(8, 6, 2, 9, '#d83c3c');
    for (const [x, y] of [[4, 4], [6, 3], [8, 4], [10, 3], [11, 5], [5, 5], [9, 2], [7, 5]] as const) g.rect(x, y, 2, 2, '#fff4c8');
    return g.outline(PAL.outline);
  },
  chocolatina: () => {
    const g = new PixelGrid();
    g.rect(2, 5, 12, 6, '#5a2a18').rect(2, 5, 12, 2, '#e8c040').rect(2, 9, 12, 2, '#e8c040').rect(6, 7, 4, 2, '#8a4a28');
    return g.outline(PAL.outline);
  },
  olla_fideos: () => {
    const g = new PixelGrid();
    g.rect(3, 6, 10, 8, '#9ca4b0').rect(3, 6, 10, 1, '#c8d0dc').rect(1, 7, 2, 1, '#3a3a44').rect(13, 7, 2, 1, '#3a3a44');
    g.rect(4, 4, 2, 2, '#e8ecf0').rect(9, 3, 2, 2, '#e8ecf0').rect(6, 1, 2, 2, '#e8ecf0');
    return g.outline(PAL.outline);
  },
  // Misión 8: Salento y el Parque del Café.
  ...M8_OBJECTS,
};
