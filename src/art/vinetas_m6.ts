import { PHONE } from '../systems/Phone';
import { Dialogue } from '../systems/DialogueManager';
import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { makeText } from '../ui/theme';
import type { VinetaBuilder } from '../ui/Vineta';
import { shade } from './palette';
import { disc, hex } from './vinetas';
import { addG, flat, floatHeart, lerp, outlined, popText, sparkle, type G } from './vinetas_kit';
import { bust, floatNote, INK, lookOf, side } from './vinetas_m5';

/**
 * Viñetas de la misión 6 (primera parte): la clase de natación del jueves, el chat con Sira (con la ubicación
 * compartida), el sábado con doña Mery (el consejo, el sancocho, el separador de guayacán), el viaje al centro
 * (el lustrabotas, la ruta del T31, el rapero, el bus varado) y la feria del libro en el Bulevar del Río.
 * Panel de 220 × 108 px.
 */

const SIRA_DIA = (): ReturnType<typeof lookOf> => lookOf('sira_feria');

function poolBack(g: G, x: number, y: number, w: number, h: number, night = false): void {
  g.fillStyle(hex(night ? '#141a2c' : '#2a3448'), 1).fillRect(x, y, w, h);
  for (let i = 0; i < 4; i++) g.fillStyle(hex('#fff6c8'), 1).fillRect(x + 20 + i * 55, y + 6, 12, 3);
  g.fillStyle(hex('#d8d4c8'), 1).fillRect(x, y + 56, w, 6);
  const bands = ['#4ab4e8', '#3ca4dc', '#2e94d0', '#2484c4'];
  bands.forEach((c, i) => g.fillStyle(hex(c), 1).fillRect(x, y + 62 + i * 12, w, 12));
}

// ---------------------------------------------------------------------------
// La clase de natación
// ---------------------------------------------------------------------------

/** La patada: Sira, de pie en el agua, te lleva de las manos; tú pataleas salpicando todo. */
const claseManos: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => poolBack(g, x, y, w, h));
  const me = { ...playerLook(), shirt: playerLook().skin };
  const sira = lookOf('sira_bano');
  const g = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t += 0.06;
    g.clear();
    // Sira, de pie, con el agua a la cintura (de lado, mirando a la izquierda).
    const sx = 150;
    g.fillStyle(hex(INK), 1).fillRect(sx - 6, 40, 12, 34);
    g.fillStyle(hex(sira.shirt), 1).fillRect(sx - 5, 52, 10, 20);
    g.fillStyle(hex(sira.skin), 1).fillRect(sx - 5, 41, 10, 11).fillRect(sx - 12, 58, 8, 3);
    g.fillStyle(hex('#2c8c8c'), 1).fillRect(sx - 6, 37, 12, 5);
    g.fillStyle(hex('#202028'), 1).fillRect(sx - 4, 45, 1, 2);
    // Tú, boca abajo, estirado hacia ella, pataleando.
    const k = Math.sin(t * 14) * 3;
    g.fillStyle(hex(me.skin), 1).fillRect(80, 60, 60, 4);
    g.fillStyle(hex('#2f6fd0'), 1).fillRect(92, 59, 12, 6);
    g.fillStyle(hex(me.skin), 1).fillRect(58, 60 + k, 22, 3).fillRect(58, 63 - k, 22, 3);
    g.fillStyle(hex(INK), 1).fillRect(130, 54, 10, 10);
    g.fillStyle(hex(me.skin), 1).fillRect(131, 55, 8, 8);
    g.fillStyle(hex(me.hair), 1).fillRect(131, 54, 8, 3);
    // El agua (encima del cuerpo) con la espuma de la patada.
    g.fillStyle(0x3ca4dc, 0.55).fillRect(0, 62, 220, 46);
    for (let i = 0; i < 6; i++) g.fillStyle(0xffffff, 0.8).fillRect(50 + ((i * 7 + t * 40) % 30), 58 + ((i * 3) % 6), 3, 2);
  });
  kit.every(1200, () => popText(kit, stage, 150, 20, Math.random() < 0.5 ? '¡Desde la cadera!' : '¡Eso!', '#ffffff', 8, 800));
  kit.every(2000, () => floatHeart(kit, stage, 140, 36));
};

/** Ocho menos cinco: sentados en el borde, con los pies en el agua. La piscina azul oscura, con brillitos. */
const borde: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#0e1424'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 26; i++) g.fillStyle(0xffffff, 0.6).fillRect(x + ((i * 37) % w), y + ((i * 17) % 40), 1, 1);
    g.fillStyle(hex('#cfc9be'), 1).fillRect(x, y + 66, w, 6);
    g.fillStyle(hex('#1c5c98'), 1).fillRect(x, y + 72, w, h - 72);
  });
  const me = { ...playerLook(), shirt: playerLook().skin };
  const sira = lookOf('sira_bano');
  side(kit, stage, me, 80, 86, { dir: 1, scale: 1, eyes: 'open' });
  const her = side(kit, stage, sira, 112, 86, { dir: -1, scale: 0.84, eyes: 'open' });
  const water = addG(kit, stage);
  let t = 0;
  kit.every(80, () => {
    t += 0.08;
    water.clear();
    water.fillStyle(0x1c5c98, 0.78).fillRect(0, 72, 220, 36);
    for (let i = 0; i < 12; i++) water.fillStyle(0x8cd0f8, 0.5).fillRect((i * 23 + t * 6) % 220, 78 + ((i * 5) % 26), 8, 1);
    // Reflejos de los pies.
    water.fillStyle(0xf8e2d4, 0.25).fillRect(88, 76 + Math.round(Math.sin(t) * 1), 6, 8).fillRect(116, 76 + Math.round(Math.cos(t) * 1), 5, 8);
  });
  // Ella se apoya en tu hombro, apenas.
  kit.after(1500, () => kit.progress(900, (q) => (her.body.setX(lerp(112, 106, q)), her.arm.setX(lerp(112, 106, q))), undefined, 'Sine.InOut'));
  kit.every(2300, () => floatHeart(kit, stage, 100 + Math.random() * 8, 32));
  kit.every(900, () => sparkle(kit, stage, Math.random() * 220, 80 + Math.random() * 20));
};

// ---------------------------------------------------------------------------
// El chat con Sira (con ubicación compartida)
// ---------------------------------------------------------------------------

/** Dónde estás tú (según el mapa o la estación del viaje) y dónde está Sira (según la historia). */
function whereAmI(): string {
  const map = StoryState.location?.map ?? '';
  const est = Dialogue.vars.get('estacion');
  if (map === 'articulado') return `T31 · ${est ?? 'en camino'}`;
  if (map === 'bus_cali') return 'P47 · Calle 18';
  if (map === 'universidades' || map === 'guayacan_plaza') return 'Universidades';
  if (map === 'centro_cali') return 'Torre de Cali';
  if (map === 'taxi_m6') return 'Taxi a Pance';
  return 'Pance';
}

function whereIsShe(): string {
  if (StoryState.hasFlag('m6_mirador')) return 'San Fernando';
  if (StoryState.hasFlag('m6_t31_cerca') || StoryState.location?.map === 'articulado') return 'La Ermita';
  if (StoryState.hasFlag('m6_llego_universidades')) return 'En camino';
  return 'Su casa';
}

/** El celular con el chat de Sira (los últimos mensajes reales de la conversación) y el mapita de ubicaciones. */
const chat: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#2a2f45'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < w; i += 10) g.fillStyle(hex('#323853'), 1).fillRect(x + i, y, 5, h);
  });
  const phone = addG(kit, stage);
  outlined(phone, [[18, 2, 96, 104, '#1c1c24']]);
  flat(phone, [[22, 8, 88, 92, '#ece5dc'], [22, 8, 88, 12, '#3c9c6c'], [56, 4, 20, 2, '#3a3a44']]);
  const av = addG(kit, stage);
  disc(av, 30, 14, 4, '#e8a0b8');
  stage.add(makeText(kit.scene, 37, 9, 'Sira', { fontSize: '7px', fontStyle: '600', color: '#ffffff' }));
  const typing = makeText(kit.scene, 37, 15, 'en línea', { fontSize: '5px', color: '#d8f4e4' });
  stage.add(typing);
  // Los últimos mensajes de la conversación (los tuyos a la derecha).
  const ids = StoryState.phone.map((e) => e.id).filter((id) => PHONE.messages[id]?.from === 'sira').slice(-4);
  let y = 22;
  const bubbles = addG(kit, stage);
  ids.forEach((id, i) => {
    const m = PHONE.messages[id];
    const mine = m.mine === true;
    const text = makeText(kit.scene, mine ? 40 : 26, y + 2, m.text, { fontSize: '5px', color: INK, wordWrap: { width: 62, useAdvancedWrap: true } });
    const bh = Math.min(22, Math.ceil(text.height) + 4);
    bubbles.fillStyle(hex(mine ? '#d4f4c4' : '#ffffff'), 1).fillRoundedRect(mine ? 38 : 24, y, 68, bh, 3);
    text.setAlpha(0);
    stage.add(text);
    kit.after(150 + i * 250, () => kit.tween({ targets: text, alpha: 1, duration: 200 }));
    y += bh + 3;
    if (y > 92) text.setVisible(false);
  });
  // «Escribiendo...» que parpadea.
  kit.every(500, () => typing.setText(typing.text === 'escribiendo...' ? 'en línea' : 'escribiendo...'));
  // La ubicación compartida: tu puntito y el de ella.
  const map = addG(kit, stage);
  outlined(map, [[122, 14, 92, 80, '#dfe8d8']]);
  map.fillStyle(hex('#5a8c8c'), 1).fillRect(122, 52, 92, 4);
  map.fillStyle(hex('#ffffff'), 1).fillRect(122, 34, 92, 2).fillRect(150, 14, 2, 80).fillRect(190, 14, 2, 80);
  stage.add(makeText(kit.scene, 124, 16, 'Ubicación en vivo', { fontSize: '5px', fontStyle: '600', color: INK }));
  const pins = addG(kit, stage);
  const meLabel = makeText(kit.scene, 130, 80, `Tú: ${whereAmI()}`, { fontSize: '5px', color: '#2f6fd0' });
  const herLabel = makeText(kit.scene, 130, 87, `Sira: ${whereIsShe()}`, { fontSize: '5px', color: '#c84868' });
  stage.add([meLabel, herLabel]);
  let t = 0;
  kit.every(60, () => {
    t += 0.06;
    pins.clear();
    const pulse = 2 + Math.sin(t * 4);
    pins.fillStyle(0x2f6fd0, 0.3).fillCircle(140, 66, 4 + pulse).fillStyle(0x2f6fd0, 1).fillCircle(140, 66, 3);
    pins.fillStyle(0xe8607a, 0.3).fillCircle(198, 40, 4 + pulse).fillStyle(0xe8607a, 1).fillCircle(198, 40, 3);
    pins.lineStyle(1, 0x8a96b8, 0.7);
    for (let i = 0; i < 8; i++) {
      const a = i / 8;
      if (i % 2 === 0) pins.lineBetween(140 + (198 - 140) * a, 66 + (40 - 66) * a, 140 + (198 - 140) * (a + 0.0625), 66 + (40 - 66) * (a + 0.0625));
    }
  });
};

// ---------------------------------------------------------------------------
// El sábado en Pance
// ---------------------------------------------------------------------------

function kitchen(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#f0e2c4'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#c86848'), 1).fillRect(x, y + 72, w, h - 72);
  for (let i = 0; i < w; i += 12) g.fillStyle(hex('#b85838'), 1).fillRect(x + i, y + 72, 1, h - 72);
  // Ventana con el guayacán amarillo afuera.
  g.fillStyle(hex('#8a5430'), 1).fillRect(x + 150, y + 10, 52, 40);
  g.fillStyle(hex('#a8d4f0'), 1).fillRect(x + 154, y + 14, 44, 32);
  g.fillStyle(hex('#f0c030'), 1).fillCircle(x + 176, y + 26, 13);
  g.fillStyle(hex('#6a4228'), 1).fillRect(x + 175, y + 32, 3, 14);
}

/** Doña Mery da consejos de cita con la cuchara de palo en la mano. */
const meryConsejo: VinetaBuilder = (kit) => {
  const stage = kit.framed(kitchen);
  const face = addG(kit, stage);
  const spoon = addG(kit, stage);
  let t = 0;
  kit.every(80, () => {
    t += 0.08;
    face.clear();
    bust(face, lookOf('anfitriona'), 70, 54, 4, { mouth: Math.floor(t * 5) % 2 ? 'open' : 'smile' });
    spoon.clear();
    const a = Math.sin(t * 5) * 6;
    spoon.fillStyle(hex('#a87048'), 1).fillRect(104 + Math.round(a), 30, 3, 26);
    spoon.fillStyle(hex('#8a5430'), 1).fillEllipse(105 + Math.round(a), 28, 8, 10);
  });
  kit.every(900, () => {
    const p = addG(kit, stage, 160 + Math.random() * 36, 16);
    p.fillStyle(0xf0c030, 1).fillRect(0, 0, 3, 2);
    kit.progress(1800, (q) => p.setPosition(p.x + Math.sin(q * 8) * 0.5, 16 + q * 30).setAlpha(1 - q), () => p.destroy());
  });
  kit.after(600, () => popText(kit, stage, 150, 70, '¿Qué está leyendo?', '#ffffff', 8, 0));
  kit.after(1600, () => popText(kit, stage, 150, 84, 'Algo que dure', '#f8e070', 8, 0));
};

/** El sancocho de gallina de los sábados. */
const sancocho: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#e8d8b8'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#c84848'), 1).fillRect(x, y + 60, w, h - 60);
    for (let i = 0; i < w; i += 16) for (let j = 60; j < h; j += 16) g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + i + ((j / 16) % 2) * 8, y + j, 8, 8);
  });
  const g = addG(kit, stage);
  // El plato hondo con el caldo, la presa, la mazorca, la yuca, el plátano y el cilantro.
  g.fillStyle(hex('#f8f8f0'), 1).fillEllipse(92, 70, 120, 40);
  g.fillStyle(hex('#e8c060'), 1).fillEllipse(92, 66, 100, 28);
  outlined(g, [[66, 58, 16, 9, '#e8c88c'], [86, 60, 12, 6, '#f0d048'], [100, 56, 18, 8, '#f4ecd8'], [74, 68, 14, 6, '#d8b060']]);
  for (let i = 0; i < 8; i++) g.fillStyle(hex('#3c9050'), 1).fillRect(70 + i * 6, 62 + (i % 3) * 3, 2, 1);
  // Arroz, aguacate y el ají.
  g.fillStyle(hex('#f8f8f0'), 1).fillEllipse(176, 72, 50, 20);
  g.fillStyle(hex('#fbfaf4'), 1).fillEllipse(176, 68, 38, 12);
  outlined(g, [[160, 54, 14, 8, '#7cb848'], [182, 52, 10, 10, '#c83c3c']]);
  g.fillStyle(hex('#f0e070'), 1).fillRect(162, 56, 10, 4);
  kit.every(350, () => {
    const s = addG(kit, stage, 80 + Math.random() * 30, 52);
    s.fillStyle(0xffffff, 0.5).fillRect(0, 0, 1, 6);
    kit.progress(1000, (q) => s.setY(52 - q * 26).setAlpha(0.6 - q * 0.6), () => s.destroy());
  });
  kit.after(800, () => popText(kit, stage, 110, 18, '¡SANCOCHO DE GALLINA!', '#c84848', 9, 0));
};

/** El separador: la flor de guayacán prensada en el diccionario, con la plancha encima. */
const separador: VinetaBuilder = (kit) => {
  const stage = kit.framed(kitchen);
  const g = addG(kit, stage);
  outlined(g, [[40, 56, 70, 18, '#7a3a28'], [44, 52, 62, 6, '#f4ecd8']]);
  stage.add(makeText(kit.scene, 50, 62, 'DICCIONARIO', { fontSize: '6px', fontStyle: '600', color: '#f0c030' }));
  const iron = addG(kit, stage);
  let t = 0;
  kit.every(70, () => {
    t += 0.07;
    iron.clear();
    const x = 56 + Math.round(Math.sin(t * 2) * 10);
    outlined(iron, [[x, 36, 34, 14, '#c8ccd4'], [x + 8, 30, 16, 6, '#3a3a44']]);
    iron.fillStyle(0xe85a48, 1).fillRect(x + 4, 40, 3, 2);
    if (Math.random() < 0.3) iron.fillStyle(0xffffff, 0.5).fillRect(x + 30 + Math.random() * 6, 30 - Math.random() * 8, 1, 3);
  });
  kit.after(1600, () => {
    const s = addG(kit, stage);
    outlined(s, [[132, 22, 18, 52, '#fbf6ea']]);
    disc(s, 141, 44, 6, '#f0c030');
    s.fillStyle(hex('#c89820'), 1).fillRect(140, 43, 2, 2);
    s.fillStyle(hex('#58a048'), 1).fillRect(140, 50, 1, 12);
    s.fillStyle(hex('#c83c3c'), 1).fillRect(139, 16, 4, 7);
    sparkle(kit, stage, 152, 24);
    sparkle(kit, stage, 128, 60);
    popText(kit, stage, 141, 86, 'Dura años', '#2a2433', 8, 0);
  });
};

// ---------------------------------------------------------------------------
// Universidades y el T31
// ---------------------------------------------------------------------------

/** El lustrabotas frente a la estación: betún, cepillo y un trapo que zumba. */
const lustrabotas: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#d8cfc0'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < w; i += 16) g.fillStyle(hex('#b8ae9e'), 1).fillRect(x + i, y, 1, h);
  });
  const g = addG(kit, stage);
  // El cajón de lustrar y el zapato encima.
  outlined(g, [[60, 66, 100, 30, '#8a5430'], [64, 60, 92, 6, '#a87048']]);
  const shoe = addG(kit, stage);
  const rag = addG(kit, stage);
  let t = 0;
  let shine = 0;
  kit.every(60, () => {
    t += 0.06;
    shine = Math.min(1, shine + 0.006);
    shoe.clear();
    const c = shade('#3a2418', shine * 0.3);
    outlined(shoe, [[80, 40, 60, 18, c], [124, 30, 18, 12, c]]);
    shoe.fillStyle(0xffffff, 0.3 + shine * 0.6).fillRect(90, 43, 20 + shine * 20, 2);
    rag.clear();
    const rx = 96 + Math.round(Math.sin(t * 14) * 16);
    rag.fillStyle(hex('#f0e070'), 1).fillRect(rx, 32, 16, 6);
  });
  kit.every(400, () => sparkle(kit, stage, 90 + Math.random() * 50, 36 + Math.random() * 16));
  kit.after(1800, () => popText(kit, stage, 110, 14, '¡Como espejo!', '#2a2433', 9, 0));
};

/** La ruta del T31: Universidades → Torre de Cali, con el bus que avanza parada por parada. */
const rutaT31: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => g.fillStyle(hex('#1c2a24'), 1).fillRect(x, y, w, h));
  const stops = ['Universidades', 'Univalle', 'Buitrera', 'Meléndez', 'Capri', 'Caldas', 'Refugio', 'Pampalinda', 'Guadalupe', 'U. Deportiva', 'Lido', 'Tequendama', 'Estadio', 'M. del Saber', 'Sta. Librada', 'San Bosco', 'San Pascual', 'Sucre', 'Petecuy', 'San Pedro', 'Torre de Cali', 'La Ermita'];
  const g = addG(kit, stage);
  const x0 = 14;
  const dx = (220 - 28) / (stops.length - 1);
  g.fillStyle(hex('#2c8c5c'), 1).fillRect(x0, 52, 220 - 28, 4);
  stops.forEach((s, i) => {
    const x = Math.round(x0 + i * dx);
    const big = s === 'Universidades' || s === 'Torre de Cali';
    g.fillStyle(hex(big ? '#f0c030' : '#f8f8f0'), 1).fillCircle(x, 54, big ? 4 : 2);
    const label = makeText(kit.scene, x, i % 2 ? 62 : 36, s, { fontSize: '5px', color: big ? '#f0c030' : '#d8f4e4' }).setOrigin(0.5, 0);
    label.setAngle(i % 2 ? 0 : 0);
    if (big || i % 3 === 0) stage.add(label);
    else label.destroy();
  });
  stage.add(makeText(kit.scene, 110, 8, 'T31 · TODAS LAS PARADAS', { fontSize: '8px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5, 0));
  stage.add(makeText(kit.scene, 110, 86, 'Bájate en Torre de Cali (y no en el expreso E31)', { fontSize: '6px', color: '#f0c030' }).setOrigin(0.5, 0));
  const bus = addG(kit, stage);
  kit.every(50, () => {
    const t = (Date.now() / 3500) % 1;
    const x = x0 + t * (stops.length - 2) * dx;
    bus.clear();
    outlined(bus, [[Math.round(x) - 6, 46, 12, 6, '#48b07c']]);
  });
};

/** El rapero de los bombombunes, con su parlante colgado. */
const rapero: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#eef0f0'), 1).fillRect(x, y, w, h);
    for (let i = 8; i < w; i += 36) g.fillStyle(hex('#8cb8d8'), 1).fillRect(x + i, y + 10, 28, 26);
    g.fillStyle(hex('#7c8088'), 1).fillRect(x, y + 88, w, h - 88);
    g.fillStyle(hex('#2c8c5c'), 1).fillRect(x, y + 36, w, 3);
  });
  const r = side(kit, stage, lookOf('rapero_bus'), 96, 98, { dir: 1, scale: 1.1, eyes: 'open' });
  const spk = addG(kit, stage);
  outlined(spk, [[104, 60, 14, 12, '#2a2a34']]);
  disc(spk, 111, 66, 3, '#5a5a66');
  let t = 0;
  kit.every(120, () => {
    t++;
    r.body.setY(t % 2 ? -1 : 0);
    r.arm.setY(t % 2 ? -1 : 0);
  });
  kit.every(450, () => floatNote(kit, stage, 112 + Math.random() * 10, 56));
  const lines = ['¡Tres por mil, mi llave!', 'No vengo a robar...', '...¡vengo a rimar!', '¡Endulza el camino!'];
  lines.forEach((l, i) => kit.after(300 + i * 900, () => popText(kit, stage, 170, 20 + (i % 2) * 14, l, '#2a2433', 8, 800)));
  const bb = addG(kit, stage);
  for (let i = 0; i < 3; i++) {
    bb.fillStyle(hex('#f8f8f0'), 1).fillRect(140 + i * 10, 72, 1, 8);
    disc(bb, 140 + i * 10, 70, 3, ['#e84868', '#f0c030', '#48a868'][i]);
  }
};

/** El T31 varado entre Lido y Tequendama: «falla técnica» y el reloj que corre. */
const varado: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#eef0f0'), 1).fillRect(x, y, w, h);
    for (let i = 8; i < w; i += 36) g.fillStyle(hex('#a8b8c0'), 1).fillRect(x + i, y + 10, 28, 26);
    g.fillStyle(hex('#7c8088'), 1).fillRect(x, y + 88, w, h - 88);
  });
  const face = addG(kit, stage);
  bust(face, playerLook(), 60, 60, 3.4, { mouth: 'o' });
  const sweat = addG(kit, stage);
  kit.every(500, () => {
    const d = addG(kit, stage, 72, 44);
    d.fillStyle(0xa8e0ff, 1).fillRect(0, 0, 2, 3);
    kit.progress(700, (q) => d.setY(44 + q * 14).setAlpha(1 - q), () => d.destroy());
  });
  // El reloj del celular corriendo.
  const clock = addG(kit, stage);
  const label = makeText(kit.scene, 150, 50, '', { fontSize: '12px', fontStyle: '600', color: '#c83c3c' }).setOrigin(0.5);
  stage.add(label);
  let m = 38;
  kit.every(260, () => {
    m = Math.min(59, m + 1);
    label.setText(`3:${String(m).padStart(2, '0')}`);
    clock.clear();
    outlined(clock, [[124, 36, 52, 28, '#1c1c24']]);
    clock.fillStyle(hex('#f4f0e6'), 1).fillRect(126, 38, 48, 24);
    sweat.clear();
  });
  stage.add(label);
  kit.after(200, () => popText(kit, stage, 110, 12, 'FALLA TÉCNICA', '#c83c3c', 10, 0));
};

// ---------------------------------------------------------------------------
// La Ermita y la feria
// ---------------------------------------------------------------------------

function ermitaBack(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#a8d4f0'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex('#cfe8f8'), 1).fillRect(x, y, w, 30);
  // La Ermita: blanca, con sus agujas grises.
  const ex = x + 120;
  g.fillStyle(hex('#f2f0ea'), 1).fillRect(ex, y + 34, 70, 52);
  for (const [sx, sw, sh] of [[ex, 12, 40], [ex + 58, 12, 40], [ex + 28, 14, 54]] as const) {
    g.fillStyle(hex('#f2f0ea'), 1).fillRect(sx, y + 86 - sh, sw, sh);
    g.fillStyle(hex('#7c8494'), 1).fillTriangle(sx - 1, y + 86 - sh, sx + sw / 2, y + 86 - sh - 18, sx + sw + 1, y + 86 - sh);
  }
  g.fillStyle(hex('#5a6cb8'), 1).fillCircle(ex + 35, y + 54, 7);
  g.fillStyle(hex('#f0c048'), 1).fillRect(ex + 34, y + 47, 2, 14).fillRect(ex + 28, y + 53, 14, 2);
  g.fillStyle(hex('#5a3a28'), 1).fillRect(ex + 29, y + 70, 12, 16);
  g.fillStyle(hex('#cfc8bc'), 1).fillRect(x, y + 86, w, h - 86);
}

/** Afuera de La Ermita: Sira, con el pelo suelto y la bolsa de tela, saluda con la mano entre las cometas. */
const siraErmita: VinetaBuilder = (kit) => {
  const stage = kit.framed(ermitaBack);
  // Cometas en el cielo.
  const kites = addG(kit, stage);
  let t = 0;
  kit.every(70, () => {
    t += 0.07;
    kites.clear();
    for (const [kx, ky, c] of [[30, 16, '#e84868'], [70, 10, '#f0c030'], [200, 14, '#3c78c8']] as const) {
      const ox = Math.sin(t + kx) * 4;
      kites.fillStyle(hex(c), 1).fillTriangle(kx + ox, ky, kx + 6 + ox, ky + 6, kx + ox, ky + 12).fillTriangle(kx + ox, ky, kx - 6 + ox, ky + 6, kx + ox, ky + 12);
      kites.lineStyle(1, 0x2a2433, 0.5).lineBetween(kx + ox, ky + 12, kx - 10, 90);
    }
  });
  side(kit, stage, playerLook(), 40, 100, { dir: 1, scale: 1, eyes: 'open' });
  const her = side(kit, stage, SIRA_DIA(), 92, 100, { dir: -1, scale: 0.84, eyes: 'open' });
  // La bolsa de tela al hombro.
  const bag = addG(kit, stage);
  outlined(bag, [[100, 70, 9, 12, '#e8dcc0']]);
  // Saluda con la mano (el brazo sube y baja).
  kit.every(320, () => her.arm.setY(her.arm.y === 0 ? -4 : 0));
  // Palomas.
  const doves = addG(kit, stage);
  kit.every(200, () => {
    doves.clear();
    for (let i = 0; i < 3; i++) {
      const px = 150 + i * 14 + (Math.random() < 0.3 ? 1 : 0);
      doves.fillStyle(hex('#7a7c88'), 1).fillRect(px, 96, 5, 3);
      doves.fillStyle(hex('#a8aab4'), 1).fillRect(px + 4, 95, 2, 2);
    }
  });
  kit.after(700, () => popText(kit, stage, 96, 30, '¡Hola!', '#ffffff', 9, 0));
  kit.every(1600, () => floatHeart(kit, stage, 70 + Math.random() * 10, 44));
};

/** La firma: la mano de la autora escribe la dedicatoria en el libro. */
const firma: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f0c040'), 1).fillRect(x, y, w, 20);
    for (let i = 0; i < w; i += 20) g.fillStyle(hex('#f4f2ec'), 1).fillRect(x + i, y, 10, 20);
    g.fillStyle(hex('#8a5430'), 1).fillRect(x, y + 20, w, h - 20);
  });
  const g = addG(kit, stage);
  outlined(g, [[40, 30, 140, 70, '#fbf8ee']]);
  g.fillStyle(hex('#d8d0c0'), 1).fillRect(109, 30, 2, 70);
  stage.add(makeText(kit.scene, 46, 34, 'El río que no\nse quiso ir', { fontSize: '7px', fontStyle: '600', color: INK }));
  stage.add(makeText(kit.scene, 46, 54, 'Amparo Ledesma', { fontSize: '6px', color: '#7a7488' }));
  const text = StoryState.hasFlag('m6_q_dedicatoria') ? 'Para Sira,\nque nada contra\nla corriente.\nY para el que\nla sigue.' : 'Para Sira,\ncon cariño.\nQue el río\nnunca te lleve\nlo que amas.';
  const words = makeText(kit.scene, 116, 36, '', { fontSize: '6px', color: '#3c3c9c', lineSpacing: 1 });
  stage.add(words);
  let n = 0;
  const pen = addG(kit, stage);
  kit.every(70, () => {
    if (n < text.length) n++;
    words.setText(text.slice(0, n));
    pen.clear();
    const b = words.getBounds();
    const px = 116 + (b.width % 50);
    outlined(pen, [[px, 36 + b.height - 6, 3, 18, '#2a2433']]);
  });
  kit.after(text.length * 70 + 200, () => sparkle(kit, stage, 160, 80));
};

/** El poema express: la máquina de escribir y el poema que sale renglón por renglón. */
const poema: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#d8c8b0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#8a5430'), 1).fillRect(x, y + 80, w, h - 80);
  });
  const g = addG(kit, stage);
  outlined(g, [[56, 70, 108, 22, '#3c7c5c'], [64, 62, 92, 10, '#2a2433']]);
  for (let i = 0; i < 10; i++) g.fillStyle(hex('#e8e8e0'), 1).fillRect(66 + i * 9, 76, 5, 3).fillRect(70 + i * 9, 82, 5, 3);
  const paper = addG(kit, stage);
  outlined(paper, [[72, 6, 76, 60, '#fbf8ee']]);
  const full = Dialogue.vars.get('poema') ?? 'El río pasa y no pregunta.';
  const txt = makeText(kit.scene, 76, 9, '', { fontSize: '5px', color: INK, wordWrap: { width: 70, useAdvancedWrap: true } });
  stage.add(txt);
  let n = 0;
  kit.every(45, () => {
    if (n < full.length) n += 1;
    txt.setText(full.slice(0, n));
  });
  kit.every(140, () => {
    const k = addG(kit, stage, 70 + Math.random() * 80, 74);
    k.fillStyle(0xffffff, 1).fillRect(0, 0, 4, 2);
    kit.after(80, () => k.destroy());
  });
};

/** Cita a ciegas con un libro: el papel kraft se abre y aparece la tapa. */
const ciegas: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#e05a4c'), 1).fillRect(x, y, w, 18);
    for (let i = 0; i < w; i += 16) g.fillStyle(hex('#f4f2ec'), 1).fillRect(x + i, y, 8, 18);
    g.fillStyle(hex('#d8c8b0'), 1).fillRect(x, y + 18, w, h - 18);
  });
  const ok = StoryState.hasFlag('m6_ciegas_ok');
  const book = addG(kit, stage);
  outlined(book, [[80, 24, 60, 78, ok ? '#f0c030' : '#9c5cc8']]);
  stage.add(makeText(kit.scene, 110, 36, ok ? '¡QUE VIVA\nLA MÚSICA!' : 'MANUAL', { fontSize: '8px', fontStyle: '700', color: INK, align: 'center' }).setOrigin(0.5, 0));
  stage.add(makeText(kit.scene, 110, 84, ok ? 'Andrés Caicedo' : '4.ª edición', { fontSize: '6px', color: INK }).setOrigin(0.5, 0));
  if (ok) for (let i = 0; i < 5; i++) book.fillStyle(hex(['#e84868', '#3c78c8', '#48a868', '#f8f8f0', '#2a2433'][i]), 1).fillRect(90 + i * 8, 60, 6, 14 - (i % 2) * 4);
  // El papel que se abre hacia los lados.
  const wrapL = addG(kit, stage);
  const wrapR = addG(kit, stage);
  wrapL.fillStyle(hex('#c8a878'), 1).fillRect(80, 24, 30, 78);
  wrapR.fillStyle(hex('#c8a878'), 1).fillRect(110, 24, 30, 78);
  kit.after(400, () => {
    kit.tween({ targets: wrapL, x: -60, angle: -20, duration: 700, ease: 'Cubic.Out' });
    kit.tween({ targets: wrapR, x: 60, angle: 20, duration: 700, ease: 'Cubic.Out' });
  });
  if (ok) kit.every(700, () => sparkle(kit, stage, 70 + Math.random() * 80, 30 + Math.random() * 60));
  if (ok) kit.every(1300, () => floatHeart(kit, stage, 150, 50));
};

/** Leyéndoles «El tigre que se comió la luna» a los niños; Sira mira desde el toldo. */
const cuento: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f0c040'), 1).fillRect(x, y, w, 16);
    for (let i = 0; i < w; i += 16) g.fillStyle(hex('#f4f2ec'), 1).fillRect(x + i, y, 8, 16);
    g.fillStyle(hex('#d8c8b0'), 1).fillRect(x, y + 16, w, h - 16);
  });
  side(kit, stage, playerLook(), 64, 96, { dir: 1, scale: 1, eyes: 'open' });
  const book = addG(kit, stage);
  outlined(book, [[80, 50, 22, 16, '#f8f4e8']]);
  book.fillStyle(hex('#f08838'), 1).fillRect(82, 54, 8, 6);
  book.fillStyle(hex('#f8f0c8'), 1).fillCircle(96, 56, 3);
  const kids = addG(kit, stage);
  let t = 0;
  kit.every(140, () => {
    t++;
    kids.clear();
    for (let i = 0; i < 4; i++) bust(kids, lookOf(i % 2 ? 'nino_feria' : 'nino'), 120 + i * 18, 88 + ((t + i) % 3 === 0 ? -1 : 0), 1.6, { mouth: (t + i) % 4 === 0 ? 'open' : 'smile' });
  });
  side(kit, stage, SIRA_DIA(), 196, 96, { dir: -1, scale: 0.84, eyes: 'open' });
  kit.after(300, () => popText(kit, stage, 90, 28, '¡GRRR!', '#f08838', 12, 900));
  kit.every(1500, () => floatHeart(kit, stage, 196, 40));
};

/** Bailando salsa (o algo entre cueca y salsa) frente al toldo de los discos. */
const baile: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#3c78c8'), 1).fillRect(x, y, w, 16);
    for (let i = 0; i < w; i += 16) g.fillStyle(hex('#f4f2ec'), 1).fillRect(x + i, y, 8, 16);
    g.fillStyle(hex('#d8c8b0'), 1).fillRect(x, y + 16, w, h - 16);
    for (let i = 0; i < 4; i++) {
      disc(g, x + 20 + i * 14, y + 40, 6, '#1c1c24');
      disc(g, x + 20 + i * 14, y + 40, 2, ['#e84868', '#f0c030', '#48a868', '#f8f8f0'][i]);
    }
  });
  const me = side(kit, stage, playerLook(), 96, 100, { dir: 1, scale: 1, eyes: 'open' }, true);
  const her = side(kit, stage, SIRA_DIA(), 118, 100, { dir: -1, scale: 0.84, eyes: 'closed' }, true);
  let t = 0;
  kit.every(230, () => {
    t++;
    const step = [0, 4, 0, -4][t % 4];
    me.body.setX(96 + step);
    me.arm.setX(96 + step);
    her.body.setX(118 + step);
    her.arm.setX(118 + step);
    if (t % 8 === 4) {
      her.body.setScale(-1, 1).setX(118 + 17 + step);
      her.arm.setScale(-1, 1).setX(118 + 17 + step);
    } else if (t % 8 === 5) {
      her.body.setScale(1, 1);
      her.arm.setScale(1, 1);
    }
  });
  kit.every(380, () => floatNote(kit, stage, 60 + Math.random() * 120, 40));
  kit.every(1700, () => floatHeart(kit, stage, 112, 40));
  kit.after(300, () => popText(kit, stage, 110, 22, '1, 2, 3... 5, 6, 7', '#2a2433', 8, 0));
};

// ---------------------------------------------------------------------------
// El raponazo, el abrazo y el atardecer
// ---------------------------------------------------------------------------

function bridgeBack(g: G, x: number, y: number, w: number, h: number, sunset = 0): void {
  const sky = sunset > 0 ? ['#f8d4a4', '#f4bc8c', '#eca484', '#a486b4'] : ['#cfe8f8', '#b8dcf4', '#a8d4f0', '#98c8e8'];
  sky.forEach((c, i) => g.fillStyle(hex(c), 1).fillRect(x, y + i * 16, w, 17));
  g.fillStyle(hex('#5a8c8c'), 1).fillRect(x, y + 64, w, h - 64);
  // El Puente Ortiz: el arco de ladrillo.
  g.fillStyle(hex('#b4604a'), 1).fillRect(x, y + 58, w, 12);
  g.fillStyle(hex('#5a8c8c'), 1).fillEllipse(x + w / 2, y + 78, 90, 26);
  for (let i = 0; i < w; i += 10) g.fillStyle(hex('#8a4434'), 1).fillRect(x + i, y + 58, 1, 12);
  g.fillStyle(hex('#d07a60'), 1).fillRect(x, y + 56, w, 3);
}

/** ¡Zas! El de la gorra roja le arranca la bolsa a Sira. */
const raponazo: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => bridgeBack(g, x, y, w, h, 1));
  const her = side(kit, stage, SIRA_DIA(), 70, 56, { dir: 1, scale: 0.84, eyes: 'open' });
  const thief = side(kit, stage, lookOf('raponero'), 120, 56, { dir: 1, scale: 1, eyes: 'open' });
  const bag = addG(kit, stage);
  outlined(bag, [[86, 30, 9, 12, '#e8dcc0']]);
  kit.after(250, () => {
    kit.progress(700, (q) => {
      const x = lerp(120, 200, q);
      thief.body.setX(x);
      thief.arm.setX(x);
      bag.setX(lerp(0, 120, q));
    });
    her.body.setScale(1, 1);
    popText(kit, stage, 110, 14, '¡ZAS!', '#ffffff', 14, 0);
  });
  kit.every(80, () => {
    const l = addG(kit, stage, thief.body.x - 10 - Math.random() * 20, 30 + Math.random() * 20);
    l.fillStyle(0xffffff, 0.8).fillRect(0, 0, 8, 1);
    kit.after(160, () => l.destroy());
  });
  kit.after(800, () => popText(kit, stage, 70, 4, '¡MI LIBRO!', '#f8e070', 9, 0));
};

/** El abrazo después de recuperar la bolsa (un segundo, dos...). */
const abrazo: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => bridgeBack(g, x, y, w, h, 1));
  const me = side(kit, stage, playerLook(), 86, 58, { dir: 1, scale: 1, eyes: 'closed' }, true);
  const her = side(kit, stage, SIRA_DIA(), 104, 58, { dir: -1, scale: 0.84, eyes: 'closed' }, true);
  kit.progress(500, (q) => {
    me.body.setX(lerp(70, 86, q));
    me.arm.setX(lerp(70, 86, q));
    her.body.setX(lerp(122, 104, q));
    her.arm.setX(lerp(122, 104, q));
  }, undefined, 'Cubic.Out');
  kit.after(2200, () =>
    kit.progress(300, (q) => {
      me.body.setX(lerp(86, 80, q));
      me.arm.setX(lerp(86, 80, q));
      her.body.setX(lerp(104, 112, q));
      her.arm.setX(lerp(104, 112, q));
    }),
  );
  kit.every(450, () => floatHeart(kit, stage, 96 + Math.random() * 10, 10));
  kit.after(2300, () => popText(kit, stage, 110, 10, '...', '#ffffff', 10, 0));
};

/** El atardecer desde el Puente Ortiz: el río naranja, rosado, morado. */
const atardecer: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => bridgeBack(g, x, y, w, h, 1));
  const sky = addG(kit, stage);
  const sun = addG(kit, stage);
  let t = 0;
  kit.every(80, () => {
    t = Math.min(1, t + 0.006);
    sky.clear();
    sky.fillStyle(0x6a4c8c, t * 0.4).fillRect(0, 0, 220, 64);
    sun.clear();
    disc(sun, 170, 30 + Math.round(t * 30), 10, '#f8a838');
    sun.fillStyle(0xf8d070, 0.4).fillRect(120, 66 + Math.round(t * 4), 100, 2);
    sun.fillStyle(0xb4604a, 1).fillRect(0, 56, 220, 14);
  });
  // Los dos de espaldas, apoyados en el pretil.
  const backs = addG(kit, stage);
  const me = playerLook();
  const her = SIRA_DIA();
  for (const [bx, look, s] of [[90, me, 1], [112, her, 0.84]] as const) {
    const hh = Math.round(14 * s);
    backs.fillStyle(hex(INK), 1).fillRect(bx - 1, 56 - hh - 18, 14, 18 + hh);
    backs.fillStyle(hex(look.shirt), 1).fillRect(bx, 56 - hh, 12, hh);
    backs.fillStyle(hex(look.hair), 1).fillRect(bx + 1, 56 - hh - 16, 10, look.hairStyle === 'long' ? 18 : 9);
  }
  kit.every(2400, () => floatHeart(kit, stage, 108, 16));
};

export const M6_VINETAS: Record<string, VinetaBuilder> = {
  m6_clase_manos: claseManos,
  m6_borde: borde,
  m6_chat: chat,
  m6_mery_consejo: meryConsejo,
  m6_sancocho: sancocho,
  m6_separador: separador,
  m6_lustrabotas: lustrabotas,
  m6_ruta_t31: rutaT31,
  m6_rapero: rapero,
  m6_varado: varado,
  m6_sira_ermita: siraErmita,
  m6_firma: firma,
  m6_poema: poema,
  m6_ciegas: ciegas,
  m6_cuento: cuento,
  m6_baile: baile,
  m6_raponazo: raponazo,
  m6_abrazo: abrazo,
  m6_atardecer: atardecer,
};
