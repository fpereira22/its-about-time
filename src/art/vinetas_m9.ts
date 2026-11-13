import { playerLook } from '../systems/PlayerLook';
import type { Backdrop, VinetaBuilder } from '../ui/Vineta';
import { disc, hex } from './vinetas';
import { addG, flat, floatHeart, floatZ, outlined, popText, sparkle, type G } from './vinetas_kit';
import { bust, INK, lookOf } from './vinetas_m5';
import { sinGorro } from './vinetas_m7';
import { BACKDROPS, compose, label, phoneFrame, PROPS, type Prop, type Spec } from './vinetas_m8';

/**
 * Viñetas de la misión 9 («Arriba de todo»): la fiesta en la casa de Tami, arriba de Cristo Rey. Usa el mismo
 * compositor de la misión 8 (fondo + bustos + objetos + efecto) con fondos nuevos (el depa de noche, el lobby del
 * Bobo, el taxi, el portón, la sala de la fiesta, el mirador con Cali prendida, la pérgola, la piscina, el auto y el
 * amanecer) y escenas propias: los recuerdos y avisos de Fotogram, la acuarela del celular de Laura, el 14, los
 * cinco en el taxi, el ascensor que se abre, el beso en la piscina, los dos dormidos en el auto y el amanecer.
 * Panel de 220 × 108 px.
 */

const W = 220;
const H = 108;

/** Lucecitas de una ciudad de noche (deterministas: siempre las mismas). */
function cityLights(g: G, x: number, y: number, w: number, h: number, n = 160, seed = 7): void {
  const cs = ['#f8dc68', '#f8f4ec', '#e8a040', '#9cd0f0'];
  for (let i = 0; i < n; i++) {
    const px = x + ((i * 37 + seed * 11) % w);
    const py = y + ((i * 13 + seed * 5) % h);
    g.fillStyle(hex(cs[i % cs.length]), 0.6 + ((i * 7) % 4) * 0.1).fillRect(px, py, 1, 1);
  }
}

function nightSky(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#0c1428'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#141c34'), 1).fillRect(x, y + h * 0.4, w, h * 0.6);
  for (let i = 0; i < 24; i++) g.fillStyle(0xf8f4ec, 0.7).fillRect(x + ((i * 53) % w), y + ((i * 29) % Math.max(1, h * 0.4)), 1, 1);
}

/** El Cristo Rey chiquito, iluminado, en lo alto de un cerro. */
function cristo(g: G, cx: number, base: number, s = 1): void {
  g.fillStyle(hex('#1c2a20'), 1).fillTriangle(cx - 40 * s, base, cx, base - 18 * s, cx + 40 * s, base);
  g.fillStyle(hex('#f8f0c8'), 0.25).fillCircle(cx, base - 24 * s, 9 * s);
  g.fillStyle(hex('#f8f0d8'), 1)
    .fillRect(cx - 1 * s, base - 30 * s, 2 * s, 12 * s)
    .fillRect(cx - 6 * s, base - 27 * s, 12 * s, 2 * s);
  disc(g, cx, base - 31 * s, 1.5 * s, '#f8f0d8');
}

// ---------------------------------------------------------------------------
// Fondos
// ---------------------------------------------------------------------------

const M9_BACKDROPS: Record<string, Backdrop> = {
  depa_noche: (g, x, y, w, h) => {
    g.fillStyle(hex('#2a2a3a'), 1).fillRect(x, y, w, h);
    // El ventanal con Cali de noche y Cristo Rey arriba, en el cerro.
    g.fillStyle(hex('#0c1428'), 1).fillRect(x + 100, y + 8, 110, 66);
    cristo(g, x + 182, y + 44, 0.9);
    g.fillStyle(hex('#1c2440'), 1).fillRect(x + 100, y + 48, 110, 26);
    cityLights(g, x + 100, y + 50, 110, 22, 90, 3);
    g.fillStyle(hex('#3a3c44'), 1).fillRect(x + 154, y + 8, 2, 66).fillRect(x + 100, y + 8, 110, 2);
    g.fillStyle(hex('#3a4a78'), 1).fillRect(x, y + 80, w, h - 80);
  },
  lobby: (g, x, y, w, h) => {
    g.fillStyle(hex('#e8dcc8'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#c8b898'), 1).fillRect(x, y + 70, w, h - 70);
    // El ascensor (puertas metálicas) y la recepción.
    g.fillStyle(hex('#2a2a34'), 1).fillRect(x + 150, y + 14, 52, 58);
    g.fillStyle(hex('#a8b0bc'), 1).fillRect(x + 153, y + 17, 22, 55).fillRect(x + 177, y + 17, 22, 55);
    g.fillStyle(hex('#f05a3a'), 1).fillRect(x + 172, y + 8, 8, 4);
    g.fillStyle(hex('#5a3a24'), 1).fillRect(x + 6, y + 56, 60, 22);
    g.fillStyle(hex('#7a5434'), 1).fillRect(x + 6, y + 56, 60, 3);
  },
  taxi: (g, x, y, w, h) => {
    g.fillStyle(hex('#1c1c24'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#0c1428'), 1).fillRect(x + 10, y + 6, w - 20, 40);
    cityLights(g, x + 10, y + 22, w - 20, 22, 120, 9);
    g.fillStyle(hex('#3a3a48'), 1).fillRect(x, y + 50, w, h - 50);
    g.fillStyle(hex('#4a4a5c'), 1).fillRect(x + 6, y + 56, w - 12, 20);
    g.fillStyle(hex('#f8dc68'), 1).fillRect(x + 96, y + 2, 28, 5);
  },
  porton: (g, x, y, w, h) => {
    nightSky(g, x, y, w, h);
    cristo(g, x + 40, y + 50, 1);
    g.fillStyle(hex('#14301c'), 1).fillRect(x, y + 50, w, h - 50);
    // La casa, prendida, y el portón negro.
    g.fillStyle(hex('#e8e0d0'), 1).fillRect(x + 100, y + 30, 100, 40);
    g.fillStyle(hex('#8c3a1c'), 1).fillTriangle(x + 94, y + 30, x + 150, y + 12, x + 206, y + 30);
    for (const wx of [110, 140, 172]) g.fillStyle(hex('#f8dc68'), 0.9).fillRect(x + wx, y + 40, 16, 12);
    g.fillStyle(hex('#1c1c24'), 1).fillRect(x + 80, y + 62, 120, 30);
    for (let i = 0; i < 20; i++) g.fillStyle(hex('#3a3a44'), 1).fillRect(x + 82 + i * 6, y + 64, 3, 26);
    g.fillStyle(hex('#8c7454'), 1).fillRect(x, y + 92, w, h - 92);
  },
  sala: (g, x, y, w, h) => {
    g.fillStyle(hex('#2a2438'), 1).fillRect(x, y, w, h);
    // Luces de colores que giran en las paredes, y el parlante.
    const cs = ['#e868a8', '#58d4d0', '#f8dc68', '#7c3ca8'];
    for (let i = 0; i < 8; i++) g.fillStyle(hex(cs[i % 4]), 0.25).fillCircle(x + 20 + i * 27, y + 18 + (i % 3) * 10, 12);
    g.fillStyle(hex('#1c1c24'), 1).fillRect(x + 190, y + 30, 24, 44);
    disc(g, x + 202, y + 44, 7, '#3a3a44');
    disc(g, x + 202, y + 62, 5, '#3a3a44');
    g.fillStyle(hex('#8c6a48'), 1).fillRect(x, y + 78, w, h - 78);
  },
  mirador_cali: (g, x, y, w, h) => {
    nightSky(g, x, y, w, 50);
    g.fillStyle(hex('#1c2440'), 1).fillRect(x, y + 44, w, h - 44);
    cityLights(g, x, y + 46, w, h - 60, 320, 4);
    // La Torre de Cali con su lucecita roja y la mancha del estadio.
    g.fillStyle(hex('#2a3048'), 1).fillRect(x + 62, y + 30, 6, 30);
    g.fillStyle(hex('#f04040'), 1).fillRect(x + 64, y + 28, 2, 2);
    g.fillStyle(hex('#f8f4ec'), 0.35).fillEllipse(x + 120, y + 66, 26, 8);
    // La baranda de vidrio.
    g.fillStyle(hex('#9cd0f0'), 0.25).fillRect(x, y + 88, w, 14);
    g.fillStyle(hex('#c8ccd4'), 1).fillRect(x, y + 86, w, 2);
  },
  pergola: (g, x, y, w, h) => {
    nightSky(g, x, y, w, h);
    g.fillStyle(hex('#1c2440'), 1).fillRect(x, y + 50, w, 30);
    cityLights(g, x, y + 52, w, 26, 140, 6);
    g.fillStyle(hex('#5a3a20'), 1).fillRect(x, y + 6, w, 5).fillRect(x + 20, y + 6, 6, h).fillRect(x + w - 26, y + 6, 6, h);
    for (let i = 0; i < 22; i++) g.fillStyle(hex(['#f8dc68', '#e868a8', '#58d4d0'][i % 3]), 1).fillRect(x + i * 10 + 2, y + 16 + Math.round(Math.sin(i / 2) * 3), 2, 2);
    g.fillStyle(hex('#a87c54'), 1).fillRect(x, y + 80, w, h - 80);
  },
  piscina: (g, x, y, w, h) => {
    nightSky(g, x, y, w, 46);
    g.fillStyle(hex('#1c2440'), 1).fillRect(x, y + 34, w, 20);
    cityLights(g, x, y + 36, w, 16, 120, 2);
    g.fillStyle(hex('#1c8ac8'), 1).fillRect(x, y + 54, w, h - 54);
    for (let i = 0; i < 18; i++) g.fillStyle(hex('#58c8f0'), 0.7).fillRect(x + ((i * 41) % w), y + 60 + ((i * 17) % 40), 8, 1);
    g.fillStyle(hex('#e8e0d0'), 1).fillRect(x, y + 52, w, 3);
  },
  auto: (g, x, y, w, h) => {
    g.fillStyle(hex('#16161e'), 1).fillRect(x, y, w, h);
    // Los vidrios empañados con lucecitas borrosas.
    g.fillStyle(hex('#3a4458'), 1).fillRect(x + 12, y + 8, w - 24, 38);
    for (let i = 0; i < 40; i++) g.fillStyle(hex('#f8dc68'), 0.3).fillCircle(x + 16 + ((i * 31) % (w - 32)), y + 30 + ((i * 7) % 14), 2);
    g.fillStyle(hex('#c8d0dc'), 0.25).fillRect(x + 12, y + 8, w - 24, 38);
    g.fillStyle(hex('#4a3a3a'), 1).fillRect(x, y + 52, w, h - 52);
  },
  amanecer: (g, x, y, w, h) => {
    g.fillStyle(hex('#5a4c8c'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#e8806a'), 1).fillRect(x, y + 26, w, 30);
    g.fillStyle(hex('#f8c070'), 1).fillRect(x, y + 44, w, 14);
    disc(g, x + 150, y + 56, 12, '#f8e070');
    g.fillStyle(hex('#3a3c5c'), 1).fillTriangle(x, y + 60, x + 60, y + 40, x + 120, y + 60).fillTriangle(x + 100, y + 60, x + 180, y + 36, x + 240, y + 60);
    g.fillStyle(hex('#5a5878'), 1).fillRect(x, y + 60, w, h - 60);
    cityLights(g, x, y + 64, w, 30, 80, 8);
  },
};
Object.assign(BACKDROPS, M9_BACKDROPS);

// ---------------------------------------------------------------------------
// Objetos
// ---------------------------------------------------------------------------

const M9_PROPS: Record<string, Prop> = {
  botella: (g, cx, cy) => {
    outlined(g, [[cx - 3, cy - 22, 6, 6, '#d8e8d8'], [cx - 7, cy - 16, 14, 26, '#d8e8d8']]);
    flat(g, [[cx - 3, cy - 24, 6, 3, '#c8303c'], [cx - 6, cy - 10, 12, 10, '#c8303c'], [cx - 4, cy - 7, 8, 4, '#f4f0e6'], [cx - 6, cy - 15, 2, 22, '#f8fff8']]);
  },
  vaso_rojo: (g, cx, cy) => {
    outlined(g, [[cx - 8, cy - 10, 16, 4, '#e85a64'], [cx - 7, cy - 6, 14, 16, '#c8303c']]);
    flat(g, [[cx - 7, cy - 10, 14, 1, '#f4f0e6']]);
  },
  dados: (g, cx, cy) => {
    for (const [dx, dy, v] of [[-10, 0, 5], [6, -4, 3]] as const) {
      outlined(g, [[cx + dx - 6, cy + dy - 6, 12, 12, '#f8f4ec']]);
      const pips: Record<number, Array<[number, number]>> = { 3: [[-3, -3], [0, 0], [3, 3]], 5: [[-3, -3], [3, -3], [0, 0], [-3, 3], [3, 3]] };
      for (const [px, py] of pips[v]) g.fillStyle(hex(INK), 1).fillRect(cx + dx + px - 1, cy + dy + py - 1, 2, 2);
    }
  },
  cubilete: (g, cx, cy) => {
    outlined(g, [[cx - 9, cy - 12, 18, 22, '#5a2a18']]);
    flat(g, [[cx - 9, cy - 12, 18, 3, '#7a3a24'], [cx - 7, cy - 4, 14, 1, '#3a1a10']]);
  },
  cel_laura: (g, cx, cy) => {
    outlined(g, [[cx - 9, cy - 15, 18, 30, '#c8303c']]);
    flat(g, [[cx - 7, cy - 13, 14, 24, '#9cc8e8'], [cx - 9, cy + 11, 18, 4, '#e8b828']]);
  },
  pulsera: (g, cx, cy) => {
    g.lineStyle(3, hex('#58f0a0'), 1).strokeEllipse(cx, cy, 22, 12);
    g.lineStyle(1, hex('#c8fff0'), 1).strokeEllipse(cx, cy - 1, 18, 8);
  },
  manta: (g, cx, cy) => {
    outlined(g, [[cx - 20, cy - 6, 40, 14, '#7c3ca8']]);
    for (let i = 0; i < 5; i++) flat(g, [[cx - 18 + i * 8, cy - 5, 3, 12, '#a86cd0']]);
  },
  arepa_fria: (g, cx, cy) => {
    g.fillStyle(hex(INK), 1).fillEllipse(cx, cy, 24, 12);
    g.fillStyle(hex('#f0d890'), 1).fillEllipse(cx, cy, 22, 10);
  },
};
Object.assign(PROPS, M9_PROPS);

// ---------------------------------------------------------------------------
// Escenas propias
// ---------------------------------------------------------------------------

/** Fotogram, recuerdos: la foto de Cali de noche que subió laaurii_14 (y en la que te etiquetó). */
const fotogramRecuerdo: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.telefono);
  const g = phoneFrame(kit, stage);
  flat(g, [[74, 10, 72, 12, '#e868a8']]);
  label(kit, stage, 110, 12, 'Fotogram · Recuerdos', '#ffffff', 6, 70);
  flat(g, [[78, 26, 64, 46, '#0c1428'], [78, 50, 64, 22, '#1c2440']]);
  cityLights(g, 78, 52, 64, 18, 90, 5);
  cristo(g, 128, 50, 0.55);
  flat(g, [[96, 62, 8, 4, '#58f0a0']]);
  label(kit, stage, 110, 75, 'laaurii_14 te etiquetó', INK, 6, 72);
  label(kit, stage, 110, 88, 'Hace 2 semanas · Cristo Rey', '#8c8c98', 5, 72);
  kit.every(1200, () => floatHeart(kit, stage, 90 + Math.random() * 40, 70));
};

/** Fotogram: «laaurii_14 comenzó a seguirte», con su foto de perfil (una acuarela) y el botón «Seguir». */
const fotogramSigue: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.telefono);
  const g = phoneFrame(kit, stage);
  flat(g, [[74, 10, 72, 12, '#e868a8']]);
  label(kit, stage, 110, 12, 'Fotogram', '#ffffff', 7, 70);
  const av = addG(kit, stage);
  disc(av, 88, 36, 10, '#c8303c');
  bust(av, lookOf('laura'), 88, 35, 1.15, { mouth: 'grin', eyes: 'squint' });
  label(kit, stage, 122, 28, 'laaurii_14', INK, 7, 50);
  label(kit, stage, 122, 38, 'comenzó a seguirte', '#5a5a68', 5, 50);
  label(kit, stage, 110, 52, 'Bilbao → Cali · acuarelas · 14', '#8c8c98', 5, 70);
  const btn = addG(kit, stage);
  btn.fillStyle(hex('#2f6fd0'), 1).fillRoundedRect(84, 64, 52, 12, 3);
  const t = label(kit, stage, 110, 66, 'Seguir también', '#ffffff', 6, 52);
  kit.after(1300, () => {
    btn.clear().fillStyle(hex('#d8d8dc'), 1).fillRoundedRect(84, 64, 52, 12, 3);
    t.setText('Siguiendo').setColor(INK);
    sparkle(kit, stage, 138, 62);
  });
  const grid = addG(kit, stage);
  const cs = ['#c8303c', '#9cc8e8', '#e8b828', '#58d4d0', '#e868a8', '#5a8a5a'];
  for (let i = 0; i < 6; i++) grid.fillStyle(hex(cs[i]), 1).fillRect(78 + (i % 3) * 21, 80 + Math.floor(i / 3) * 9, 19, 7);
};

/** Fotogram: tu comentario «14 🙌» y el corazón de laaurii_14. */
const fotogramLike: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.telefono);
  const g = phoneFrame(kit, stage);
  flat(g, [[74, 10, 72, 12, '#e868a8'], [78, 26, 64, 30, '#0c1428']]);
  cityLights(g, 78, 38, 64, 16, 60, 5);
  label(kit, stage, 110, 12, 'Fotogram', '#ffffff', 7, 70);
  label(kit, stage, 110, 60, 'tú: 14 🙌', INK, 7, 70);
  kit.after(1200, () => {
    const n = addG(kit, stage);
    outlined(n, [[152, 54, 62, 20, '#ffffff']]);
    disc(n, 160, 64, 4, '#e84868');
    label(kit, stage, 186, 58, 'a laaurii_14 le\ngusta tu comentario', INK, 5, 50);
    floatHeart(kit, stage, 160, 52);
  });
};

/** La pantalla de bloqueo del celular de Laura: una acuarela de un puente rojo sobre la ría, firmada «L.». */
const celFondo: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.telefono);
  const g = addG(kit, stage);
  outlined(g, [[70, 4, 80, 100, '#c8303c']]);
  flat(g, [[74, 10, 72, 88, '#c8d0d8'], [74, 10, 72, 40, '#a8b4c4'], [74, 66, 72, 32, '#7c90a4']]);
  // Montes, el puente de hierro y la ría (manchas suaves, como acuarela).
  g.fillStyle(hex('#6c8a6c'), 0.7).fillEllipse(90, 56, 50, 20).fillEllipse(134, 54, 46, 22);
  g.fillStyle(hex('#c8303c'), 1).fillRect(80, 42, 60, 3).fillRect(84, 42, 3, 26).fillRect(133, 42, 3, 26);
  for (let i = 0; i < 6; i++) g.fillStyle(hex('#c8303c'), 0.8).fillRect(88 + i * 8, 45, 1, 6);
  g.fillStyle(hex('#a8bcd0'), 0.6).fillRect(74, 70, 72, 2).fillRect(80, 78, 50, 1);
  label(kit, stage, 110, 22, '23:47', '#ffffff', 10, 70);
  label(kit, stage, 138, 88, 'L.', '#2a2433', 7, 20);
  flat(g, [[74, 98, 72, 4, '#e8b828']]);
};

/** Los cinco en el taxi, vistos desde el parabrisas: Don Hernán y Ximena adelante; Laura, tú y (después) Mila atrás. */
function taxiCinco(withMila: boolean, singing = false): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed(BACKDROPS.taxi);
    const back = addG(kit, stage);
    bust(back, lookOf('laura'), withMila ? 70 : 84, 44, 2.4, singing ? { mouth: 'open' } : { mouth: 'grin', eyes: 'squint' });
    bust(back, sinGorro(playerLook()), withMila ? 110 : 128, 46, 2.4, singing ? { mouth: 'o' } : { mouth: 'smile' });
    if (withMila) bust(back, lookOf('mila'), 152, 44, 2.6, singing ? { mouth: 'open' } : { mouth: 'grin', eyes: 'squint' });
    const front = addG(kit, stage);
    bust(front, lookOf('hernan'), 60, 78, 3, { mouth: 'smile' });
    bust(front, lookOf('ximena'), 160, 78, 3, singing ? { mouth: 'open' } : { mouth: 'teeth' });
    front.fillStyle(hex('#2a2a34'), 1).fillRect(96, 92, 28, 16);
    if (singing) kit.every(400, () => popText(kit, stage, 30 + Math.random() * 160, 20, '♪', '#f8dc68', 10, 600));
  };
}

/** Frente al Bobo, de noche: el taxi amarillo espera con la puerta de atrás abierta y la salsa sonando bajito. */
const taxiAfuera: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    nightSky(g, x, y, w, h);
    // El edificio del Bobo, con ventanas prendidas, y la vereda.
    g.fillStyle(hex('#2a3048'), 1).fillRect(x + 6, y + 4, 78, 70);
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 5; c++) {
        const on = (r * 5 + c) % 3 !== 1;
        g.fillStyle(hex(on ? '#f8d070' : '#1c2238'), on ? 0.85 : 1).fillRect(x + 12 + c * 14, y + 10 + r * 10, 8, 6);
      }
    }
    g.fillStyle(hex('#a8b0bc'), 1).fillRect(x + 34, y + 62, 20, 12);
    g.fillStyle(hex('#5a5e68'), 1).fillRect(x, y + 74, w, 4);
    g.fillStyle(hex('#3a3a44'), 1).fillRect(x, y + 78, w, h - 78);
    // Un farol.
    g.fillStyle(hex('#5a5e68'), 1).fillRect(x + 200, y + 30, 2, 44);
    g.fillStyle(hex('#f8d070'), 1).fillRect(x + 197, y + 26, 8, 5);
    g.fillStyle(0xf8d070, 0.12).fillCircle(x + 201, y + 32, 24);
  });
  const car = addG(kit, stage, 86, 48);
  // Carrocería, cabina y vidrios (mira a la izquierda).
  outlined(car, [[0, 20, 108, 22, '#f0c818'], [18, 4, 64, 18, '#f0c818']]);
  flat(car, [[22, 7, 26, 13, '#5a7a8c'], [0, 30, 108, 2, '#c89c10']]);
  // La puerta de atrás abierta: el hueco oscuro y la puerta asomada hacia afuera.
  flat(car, [[52, 7, 28, 33, '#2a2433'], [56, 24, 22, 8, '#4a3a3a']]);
  outlined(car, [[80, 2, 12, 38, '#f0c818']]);
  flat(car, [[82, 5, 8, 13, '#5a7a8c']]);
  // El letrerito del techo, faros y ruedas.
  outlined(car, [[38, -3, 22, 7, '#f8f4ec']]);
  flat(car, [[0, 24, 6, 4, '#f8f4ec'], [102, 24, 6, 4, '#e84040']]);
  car.fillStyle(hex(INK), 1).fillCircle(20, 43, 7).fillCircle(88, 43, 7);
  car.fillStyle(hex('#8c8c98'), 1).fillCircle(20, 43, 3).fillCircle(88, 43, 3);
  label(kit, stage, 135, 46, 'TAXI', INK, 5, 22);
  // Los faros alumbran la calle.
  const glow = addG(kit, stage);
  glow.fillStyle(0xf8f4ec, 0.15).fillTriangle(86, 74, 30, 66, 30, 92);
  // La salsa, bajito, sale por la puerta abierta.
  kit.every(650, () => popText(kit, stage, 152 + Math.random() * 10, 50, '♪', '#f8dc68', 8, 700));
};

/** El 14, gigante, con confeti. */
const catorce: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.taxi);
  const g = addG(kit, stage);
  bust(g, lookOf('laura'), 50, 60, 3, { mouth: 'open' });
  bust(g, sinGorro(playerLook()), 170, 60, 3, { mouth: 'open' });
  kit.after(300, () => popText(kit, stage, W / 2, 50, '14', '#f8dc68', 30, 0));
  kit.every(90, () => {
    const c = addG(kit, stage);
    const x = Math.random() * W;
    const col = [0xc8303c, 0xe8b828, 0x58f0a0, 0xe868a8][Math.floor(Math.random() * 4)];
    kit.progress(1300, (k) => c.clear().fillStyle(col, 1).fillRect(x + Math.sin(k * 8) * 4, -4 + k * 116, 2, 3), () => c.destroy());
  });
};

/** El ascensor del Bobo se abre: Laura, con un pie adentro y otro afuera. */
const ascensorAbre: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.lobby);
  const inside = addG(kit, stage);
  inside.fillStyle(hex('#d8dce4'), 1).fillRect(153, 17, 46, 55);
  bust(inside, lookOf('laura'), 176, 44, 2.6, { mouth: 'o' });
  const doors = addG(kit, stage);
  kit.progress(900, (k) => {
    const open = Math.round(k * 22);
    doors.clear().fillStyle(hex('#a8b0bc'), 1).fillRect(153 - open, 17, 22, 55).fillRect(177 + open, 17, 22, 55);
  });
  kit.after(200, () => popText(kit, stage, 176, 6, 'ding', '#f8e070', 8, 700));
};

/** En la piscina, con Cali atrás: el beso. */
const beso: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.piscina);
  const g = addG(kit, stage);
  bust(g, sinGorro(playerLook()), 96, 56, 3, { eyes: 'closed', mouth: 'smile' });
  bust(g, lookOf('roxane'), 124, 56, 3, { eyes: 'closed', mouth: 'smile' });
  g.fillStyle(hex('#1c8ac8'), 0.85).fillRect(0, 76, W, H - 76);
  kit.after(500, () => floatHeart(kit, stage, 110, 30));
  kit.every(900, () => floatHeart(kit, stage, 90 + Math.random() * 40, 34));
  kit.every(300, () => sparkle(kit, stage, Math.random() * W, Math.random() * 30));
};

/** Los dos dormidos de lado en el asiento de atrás del auto, con los vidrios empañados. */
const autoDormidos: VinetaBuilder = (kit) => {
  const stage = kit.framed(BACKDROPS.auto);
  const g = addG(kit, stage);
  outlined(g, [[30, 58, 160, 26, '#5a4a4a']]);
  bust(g, sinGorro(playerLook()), 70, 62, 2.6, { eyes: 'closed', mouth: 'o' });
  bust(g, lookOf('roxane'), 98, 64, 2.6, { eyes: 'closed', mouth: 'smile' });
  outlined(g, [[100, 74, 80, 12, '#1ca8a8']]);
  kit.every(900, () => floatZ(kit, stage, 80 + Math.random() * 30, 40));
};

/** El mirador: Cali entera, con los nombres de lo que se ve. */
function mirador(names: boolean): VinetaBuilder {
  return (kit) => {
    const stage = kit.framed(BACKDROPS.mirador_cali);
    kit.every(260, () => sparkle(kit, stage, Math.random() * W, 50 + Math.random() * 30));
    if (!names) return;
    kit.after(400, () => popText(kit, stage, 66, 22, 'Torre de Cali', '#f8e070', 6, 0));
    kit.after(900, () => popText(kit, stage, 120, 56, 'Estadio', '#f8e070', 6, 0));
    kit.after(1400, () => popText(kit, stage, 190, 78, 'el Bobo (¡chiquitito!)', '#58f0a0', 6, 0));
  };
}

// ---------------------------------------------------------------------------
// Viñetas por especificación
// ---------------------------------------------------------------------------

const SPECS: Record<string, Spec> = {
  m9_depa_noche: { b: 'depa_noche', c: ['player smile'], p: ['cel_laura'], fx: 'stars' },
  m9_lobby_ximena: { b: 'lobby', c: ['ximena grin', 'player blush'], t: '¡Qué guapo, güey!' },
  m9_laura_lobby: { b: 'lobby', c: ['laura o'], fx: 'sparkle', t: '¿TÚ?' },
  m9_lobby_trio: { b: 'lobby', c: ['ximena open', 'laura grin', 'player grin'] },
  m9_laura_risa: { b: 'taxi', c: ['laura grin'], fx: 'sparkle' },
  m9_wilmer: { b: 'lobby', c: ['wilmer smile'] },
  m9_wilmer_seis: { b: 'lobby', c: ['wilmer squint', 'player sad', 'roxane sleep'], t: 'Las seis, joven.' },
  m9_hernan: { b: 'taxi', c: ['hernan smile'], t: 'Don Hernán' },
  m9_laura_taxi: { b: 'taxi', c: ['player smile', 'laura smile'] },
  m9_mila: { b: 'porton', c: ['mila grin'], t: '¡Habla, gente!' },
  m9_mila_risa: { b: 'taxi', c: ['mila grin'], fx: 'sparkle' },
  m9_taxi_apretados: { b: 'taxi', c: ['laura squint', 'player o', 'mila grin'], s: 2.6, fx: 'sweat' },
  m9_pulseras: { b: 'taxi', c: ['ximena grin'], p: ['pulsera'], fx: 'sparkle' },
  m9_laura_acuarela: { b: 'taxi', c: ['laura smile'], p: ['cel_laura'], t: 'acuarelas', fx: 'sparkle' },
  m9_laura_examen: { b: 'taxi', c: ['laura squint', 'player o'], t: 'Examen sorpresa' },
  m9_ventana_cali: { b: 'mirador_cali', c: ['laura o'], fx: 'stars' },
  m9_laura_ventana: { b: 'taxi', c: ['laura closed'], fx: 'notes' },
  m9_porton: { b: 'porton', fx: 'notes' },
  m9_tami_porton: { b: 'porton', c: ['tami sad'], t: '...hola.' },
  m9_tami: { b: 'sala', c: ['tami sad'] },
  m9_steven: { b: 'sala', c: ['steven grin'], t: '¿Qué fue, mi pana?' },
  m9_steven_tami: { b: 'sala', c: ['tami smile', 'steven grin'] },
  m9_laura_susurro: { b: 'porton', c: ['laura squint', 'player blush'] },
  m9_laura_guino: { b: 'sala', c: ['laura grin'], fx: 'heart1' },
  m9_ximena: { b: 'sala', c: ['ximena grin'], t: '¡Órale!' },
  m9_mexicanos: { b: 'sala', c: ['chuy grin', 'renata smile', 'ximena grin'], p: ['tequila', 'limon'] },
  m9_mirador_amigos: { b: 'mirador_cali', c: ['renzo grin', 'danilo smile', 'juanpa grin', 'richi open'], s: 2.6 },
  m9_juanpa: { b: 'mirador_cali', c: ['juanpa grin'] },
  m9_richi: { b: 'mirador_cali', c: ['richi open'], t: '¡Ala!' },
  m9_renzo: { b: 'sala', c: ['renzo grin'], p: ['cubilete'] },
  m9_danilo_serio: { b: 'mirador_cali', c: ['danilo squint', 'player smile'] },
  m9_danilo_risa: { b: 'mirador_cali', c: ['danilo grin', 'player grin'], t: 'Insight', fx: 'sparkle' },
  m9_laura_sala: { b: 'sala', c: ['laura grin'], fx: 'lights' },
  m9_botella: { b: 'sala', c: ['laura grin'], p: ['botella'], fx: 'lights' },
  m9_botella_misma: { b: 'sala', c: ['player blush', 'laura grin'], p: ['botella'], fx: ['lights', 'heart1'] },
  m9_pergola_baile: { b: 'pergola', c: ['player grin', 'laura grin'], fx: ['notes', 'stars'] },
  m9_cel_entrega: { b: 'pergola', c: ['laura smile'], p: ['cel_laura'], t: 'Cuídamelo' },
  m9_cel_devuelve: { b: 'pergola', c: ['laura grin'], p: ['cel_laura'], fx: 'sparkle' },
  m9_cel_zapato: { b: 'piscina', p: ['cel_laura'], t: 'a salvo' },
  m9_laura_pergola: { b: 'pergola', c: ['laura smile'] },
  m9_laura_seria: { b: 'pergola', c: ['laura sad'], fx: 'stars' },
  m9_laura_agur: { b: 'pergola', c: ['laura smile'], t: 'Agur', fx: 'stars' },
  m9_juanpa_bp: { b: 'sala', c: ['juanpa grin', 'richi open'], p: ['vaso_rojo'], fx: 'lights' },
  m9_mila_cacho: { b: 'sala', c: ['mila grin', 'renzo open'], p: ['cubilete', 'dados'] },
  m9_parlante: { b: 'sala', fx: ['lights', 'notes'] },
  m9_barra: { b: 'sala', p: ['botella', 'limon', 'arepa_fria'], fx: 'lights' },
  m9_cristo: { b: 'mirador_cali', t: 'Cristo Rey', fx: 'stars' },
  m9_piscina_grito: { b: 'piscina', c: ['juanpa open'], t: '¡A LA PISCINAAA!' },
  m9_piscina_bomba: { b: 'piscina', c: ['richi open', 'renzo open', 'ximena grin'], t: '¡PLAF!', fx: 'sweat' },
  m9_piscina_dentro: { b: 'piscina', c: ['player grin'], fx: 'stars' },
  m9_roxane: { b: 'piscina', c: ['roxane smile'], t: 'Ideay, chele' },
  m9_roxane_risa: { b: 'piscina', c: ['roxane grin'], fx: 'sparkle' },
  m9_gallina: { b: 'piscina', c: ['player teeth', 'roxane grin'], t: '¡Pelea de gallinas!' },
  m9_roxane_borde: { b: 'piscina', c: ['player smile', 'roxane smile'], fx: 'stars' },
  m9_roxane_cerca: { b: 'piscina', c: ['player blush', 'roxane blush'], fx: 'heart1' },
  m9_auto: { b: 'auto', c: ['roxane sleep'] },
  m9_amanecer: { b: 'amanecer', c: ['player squint', 'roxane sleep'] },
  m9_roxane_sueno: { b: 'auto', c: ['roxane squint'], fx: 'zzz' },
  m9_taxi_amanecer: { b: 'amanecer', c: ['player smile', 'roxane sleep'] },
  m9_roxane_cama: { b: 'depa_noche', c: ['roxane sleep'], p: ['manta'], fx: 'zzz' },
  m9_ascensor_laura: { b: 'lobby', c: ['laura smile', 'player smile'], t: 'Piso 8' },
};

export const M9_VINETAS: Record<string, VinetaBuilder> = {
  ...Object.fromEntries(Object.entries(SPECS).map(([id, spec]) => [id, compose(spec)])),
  m9_fotogram_recuerdo: fotogramRecuerdo,
  m9_fotogram_sigue: fotogramSigue,
  m9_fotogram_like: fotogramLike,
  m9_cel_fondo: celFondo,
  m9_taxi_afuera: taxiAfuera,
  m9_taxi_puestos: taxiCinco(false),
  m9_taxi_canta: taxiCinco(true, true),
  m9_catorce: catorce,
  m9_ascensor_abre: ascensorAbre,
  m9_beso: beso,
  m9_auto_dormidos: autoDormidos,
  m9_mirador: mirador(false),
  m9_mirador_puntos: mirador(true),
};
