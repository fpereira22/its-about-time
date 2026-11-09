import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { Dialogue } from '../systems/DialogueManager';
import { EventSystem } from '../systems/EventSystem';
import { Phone, PHONE, phoneUi } from '../systems/Phone';
import { StoryState, type PhoneEntry } from '../systems/StoryState';
import { dialogueUi } from '../ui/DialogueBox';
import { fitText, makeText } from '../ui/theme';
import type { VinetaBuilder, VinetaKit } from '../ui/Vineta';
import { disc, hex } from './vinetas';
import { addG, INK, type G, type Layer } from './vinetas_kit';

/**
 * Misión 6: el chat con Sira durante el viaje Pance → feria del libro (y de vuelta, en el taxi).
 *
 * Es una viñeta «en vivo»: mientras está abierta escucha el celular. Cada mensaje nuevo de Sira llega
 * con «escribiendo...» (los tres puntitos) antes de aparecer; cada mensaje tuyo se teclea en la barra
 * de abajo, se manda y le salen los chulitos. Las burbujas se miden con el texto real y la conversación
 * hace scroll hacia arriba como un chat de verdad.
 *
 * A la derecha, la ubicación en vivo: un mapa esquemático de Cali (norte arriba) con el río Cali, los
 * Farallones, la ruta del P47 y la del T31, tu puntito (según dónde vas del viaje) y el de Sira.
 */

/** Panel 220 × 108. El celular a la izquierda, el mapa a la derecha. */
const PH = { x: 4, y: 2, w: 138, h: 104 } as const;
const SCR = { x: PH.x + 4, y: PH.y + 4, w: PH.w - 8, h: PH.h - 8 } as const;
const HEADER_BOTTOM = SCR.y + 18;
const INPUT_TOP = SCR.y + SCR.h - 13;
const LIST_BOTTOM = INPUT_TOP - 3;
const BUBBLE_MAX = 100;
const FONT = '7px';

/** Mensajes que la viñeta ya animó (para no repetir la animación si se vuelve a abrir). */
const animated = new Set<string>();
const keyOf = (e: PhoneEntry): string => `${e.id}@${e.at}`;
/** Un mensaje que llegó hace menos que esto (tiempo de juego) todavía se anima al abrir el chat. */
const RECENT_MS = 12000;

const isSiraChat = (id: string): boolean => PHONE.messages[id]?.from === 'sira';

// ---------------------------------------------------------------------------
// Geografía: dónde vas tú y dónde va ella
// ---------------------------------------------------------------------------

interface Place {
  lat: number;
  lon: number;
}

const P = {
  casa: { lat: 3.334, lon: -76.546 },
  pucc: { lat: 3.349, lon: -76.531 },
  canasgordas: { lat: 3.361, lon: -76.534 },
  universidades: { lat: 3.372, lon: -76.535 },
  sanFernando: { lat: 3.433, lon: -76.546 },
  ermita: { lat: 3.4527, lon: -76.5333 },
  torre: { lat: 3.4565, lon: -76.5318 },
  taxi: { lat: 3.398, lon: -76.531 },
  bobo: { lat: 3.3505, lon: -76.529 },
} satisfies Record<string, Place>;

/** Las paradas del T31 (mismo orden que rides.json), con su posición aproximada sobre la Calle 5. */
const T31: Array<[string, Place]> = [
  ['Universidades', P.universidades],
  ['Univalle', { lat: 3.376, lon: -76.537 }],
  ['Buitrera', { lat: 3.379, lon: -76.539 }],
  ['Meléndez', { lat: 3.382, lon: -76.541 }],
  ['Capri', { lat: 3.386, lon: -76.543 }],
  ['Caldas', { lat: 3.39, lon: -76.545 }],
  ['Refugio', { lat: 3.395, lon: -76.546 }],
  ['Pampalinda', { lat: 3.401, lon: -76.547 }],
  ['Guadalupe', { lat: 3.406, lon: -76.547 }],
  ['Unidad Deportiva', { lat: 3.412, lon: -76.546 }],
  ['Lido', { lat: 3.418, lon: -76.544 }],
  ['Tequendama', { lat: 3.423, lon: -76.543 }],
  ['Estadio', { lat: 3.429, lon: -76.541 }],
  ['Manzana del Saber', { lat: 3.434, lon: -76.539 }],
  ['Santa Librada', { lat: 3.438, lon: -76.537 }],
  ['San Bosco', { lat: 3.443, lon: -76.535 }],
  ['San Pascual', { lat: 3.446, lon: -76.533 }],
  ['Sucre', { lat: 3.449, lon: -76.531 }],
  ['Petecuy', { lat: 3.452, lon: -76.53 }],
  ['San Pedro', { lat: 3.454, lon: -76.531 }],
  ['Torre de Cali', P.torre],
];

const P47: Place[] = [P.casa, { lat: 3.34, lon: -76.536 }, P.pucc, P.canasgordas, P.universidades];

function received(id: string): boolean {
  return StoryState.phone.some((e) => e.id === id);
}

function t31Index(): number {
  const est = Dialogue.vars.get('estacion');
  const i = T31.findIndex(([n]) => n === est);
  return i < 0 ? 0 : i;
}

function mix(a: Place, b: Place, t: number): Place {
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
}

interface Spot {
  at: Place;
  label: string;
}

/** Cómo se llenan el chat y el mapa en cada misión. */
interface ChatConfig {
  isChat: (id: string) => boolean;
  mySpot: () => Spot;
  herSpot: () => Spot;
  /** Rutas y nombres que se dibujan en el mapa. */
  drawRoutes: (kit: VinetaKit, stage: Layer, g: G) => void;
}

/** Tu posición: según el mapa en que vas y lo que ya pasó en la historia. */
function mySpot(): Spot {
  const map = StoryState.location?.map ?? '';
  if (received('sira_m6_llegue') || map === 'taxi_m6') return { at: P.taxi, label: 'Taxi a Pance' };
  if (map === 'articulado') {
    const i = t31Index();
    return { at: T31[i][1], label: `T31 · ${T31[i][0]}` };
  }
  if (map === 'centro_cali') return { at: P.torre, label: 'Torre de Cali' };
  if (StoryState.hasFlag('m6_llego_universidades')) return { at: P.universidades, label: 'Est. Universidades' };
  if (StoryState.hasFlag('m6_salio_casa')) return { at: P.pucc, label: 'P47 · Calle 18' };
  return { at: P.casa, label: 'Casa (Pance)' };
}

function herSpot(): Spot {
  if (received('sira_m6_llegue')) return { at: P.sanFernando, label: 'En su casa' };
  if (received('sira_m6_ermita')) return { at: P.ermita, label: 'La Ermita' };
  if (received('sira_m6_saliendo')) {
    const map = StoryState.location?.map ?? '';
    const t = map === 'articulado' ? 0.35 + 0.6 * (t31Index() / (T31.length - 1)) : StoryState.hasFlag('m6_llego_universidades') ? 0.25 : 0.08;
    return { at: mix(P.sanFernando, P.ermita, t), label: 'Va al centro' };
  }
  return { at: P.sanFernando, label: 'San Fernando' };
}

/** Distancia en línea recta (km). */
function km(a: Place, b: Place): number {
  const dy = (a.lat - b.lat) * 111;
  const dx = (a.lon - b.lon) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

// ---------------------------------------------------------------------------
// El mapa
// ---------------------------------------------------------------------------

const MAP = { x: 146, y: 4, w: 70, h: 78 } as const;
const BOUNDS = { latN: 3.462, latS: 3.326, lonW: -76.566, lonE: -76.508 } as const;

function toMap(p: Place): { x: number; y: number } {
  return {
    x: MAP.x + ((p.lon - BOUNDS.lonW) / (BOUNDS.lonE - BOUNDS.lonW)) * MAP.w,
    y: MAP.y + 8 + ((BOUNDS.latN - p.lat) / (BOUNDS.latN - BOUNDS.latS)) * (MAP.h - 10),
  };
}

function polyline(g: G, pts: Place[], width: number, color: number, alpha = 1): void {
  g.lineStyle(width, color, alpha);
  g.beginPath();
  pts.forEach((p, i) => {
    const q = toMap(p);
    if (i === 0) g.moveTo(q.x, q.y);
    else g.lineTo(q.x, q.y);
  });
  g.strokePath();
}

function drawMap(kit: VinetaKit, stage: Layer, cfg: ChatConfig): void {
  const g = addG(kit, stage);
  // Marco y fondo (la ciudad, gris clarito).
  g.fillStyle(hex(INK), 1).fillRect(MAP.x - 1, MAP.y - 1, MAP.w + 2, MAP.h + 2);
  g.fillStyle(hex('#ece8dc'), 1).fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
  // Manzanas.
  for (let x = MAP.x + 2; x < MAP.x + MAP.w; x += 6) for (let y = MAP.y + 10; y < MAP.y + MAP.h; y += 6) g.fillStyle(hex('#e0dccf'), 1).fillRect(x, y, 4, 4);
  // Los Farallones (al occidente) y el cerro de las Tres Cruces arriba a la izquierda.
  g.fillStyle(hex('#b4cf98'), 1);
  g.beginPath();
  g.moveTo(MAP.x, MAP.y + 8);
  for (const [lat, lon] of [[3.462, -76.556], [3.44, -76.556], [3.41, -76.558], [3.38, -76.556], [3.35, -76.558], [3.326, -76.556]] as const) {
    const q = toMap({ lat, lon });
    g.lineTo(q.x, q.y);
  }
  g.lineTo(MAP.x, MAP.y + MAP.h);
  g.closePath();
  g.fillPath();
  // Ríos: el Cali (cruza el centro) y el Pance (abajo).
  polyline(g, [{ lat: 3.452, lon: -76.566 }, { lat: 3.451, lon: -76.545 }, { lat: 3.455, lon: -76.534 }, { lat: 3.46, lon: -76.522 }, { lat: 3.462, lon: -76.512 }], 2, 0x4a9ad8);
  polyline(g, [{ lat: 3.33, lon: -76.566 }, { lat: 3.333, lon: -76.548 }, { lat: 3.338, lon: -76.53 }, { lat: 3.343, lon: -76.508 }], 1, 0x4a9ad8);
  cfg.drawRoutes(kit, stage, g);
  // Barra de título.
  g.fillStyle(hex('#3c9c6c'), 1).fillRect(MAP.x, MAP.y, MAP.w, 8);
  stage.add(makeText(kit.scene, MAP.x + 7, MAP.y + 1, 'Ubicación en vivo', { fontSize: '5px', fontStyle: '600', color: '#ffffff' }));
  // Brújula.
  stage.add(makeText(kit.scene, MAP.x + MAP.w - 6, MAP.y + 10, 'N', { fontSize: '5px', fontStyle: '600', color: INK }));
  g.fillStyle(hex(INK), 1).fillTriangle(MAP.x + MAP.w - 5, MAP.y + 19, MAP.x + MAP.w - 4, MAP.y + 16, MAP.x + MAP.w - 3, MAP.y + 19);
}

/** Rutas de la misión 6: el P47, el T31, La Ermita y la casita de Pance. */
function routesM6(kit: VinetaKit, stage: Layer, g: G): void {
  // Rutas: el P47 (naranjo, punteado) y el T31 por la Calle 5 (verde MIO).
  polyline(g, P47, 1, 0xe8903c);
  polyline(g, T31.map(([, p]) => p), 2, 0x2c8c5c);
  for (const [name, p] of T31) {
    const q = toMap(p);
    const big = name === 'Universidades' || name === 'Torre de Cali';
    g.fillStyle(big ? 0xf0c030 : 0xffffff, 1).fillRect(Math.round(q.x) - (big ? 1 : 0), Math.round(q.y) - (big ? 1 : 0), big ? 3 : 1, big ? 3 : 1);
  }
  // La Ermita (la iglesia) y San Fernando.
  const e = toMap(P.ermita);
  g.fillStyle(0xffffff, 1).fillRect(Math.round(e.x) + 2, Math.round(e.y) - 3, 3, 4);
  g.fillStyle(0x7c8494, 1).fillTriangle(e.x + 1.5, e.y - 3, e.x + 3.5, e.y - 7, e.x + 5.5, e.y - 3);
  // La casita de Pance.
  const c = toMap(P.casa);
  g.fillStyle(0xc86848, 1).fillTriangle(c.x - 3, c.y - 1, c.x, c.y - 4, c.x + 3, c.y - 1);
  g.fillStyle(0xf4ecd8, 1).fillRect(Math.round(c.x) - 2, Math.round(c.y) - 1, 4, 3);
  // Nombres de barrio (chiquititos, gris).
  const small = { fontSize: '5px', color: '#7a7488' };
  for (const [txt, p, ox] of [['Centro', P.torre, 3], ['Pance', P.casa, 6], ['Univ.', P.universidades, 3]] as const) {
    const q = toMap(p);
    stage.add(makeText(kit.scene, Math.round(q.x + ox), Math.round(q.y - 3), txt, small));
  }
}

/** La ruta del bus de Sira en la misión 7: de San Fernando por la Calle 5 hasta la U y el Bobo. */
const RUTA_SIRA: Place[] = [P.sanFernando, { lat: 3.429, lon: -76.541 }, ...T31.slice(0, 11).map(([, p]) => p).reverse(), P.pucc, P.bobo];

function routesM7(kit: VinetaKit, stage: Layer, g: G): void {
  polyline(g, RUTA_SIRA, 2, 0x2c8c5c);
  const b = toMap(P.bobo);
  g.fillStyle(0xa86a4c, 1).fillRect(Math.round(b.x) - 2, Math.round(b.y) - 7, 5, 8);
  g.fillStyle(0xf8e070, 1).fillRect(Math.round(b.x) - 1, Math.round(b.y) - 5, 1, 1).fillRect(Math.round(b.x) + 1, Math.round(b.y) - 3, 1, 1);
  const small = { fontSize: '5px', color: '#7a7488' };
  for (const [txt, p, ox] of [['S. Fernando', P.sanFernando, -24], ['Bobo', P.bobo, 5], ['Pance', P.casa, 6]] as const) {
    const q = toMap(p);
    stage.add(makeText(kit.scene, Math.round(q.x + ox), Math.round(q.y - 3), txt, small));
  }
}

const M6_CHAT: ChatConfig = { isChat: isSiraChat, mySpot, herSpot, drawRoutes: routesM6 };

/** Misión 7: dónde estás tú, según el mapa. */
function mySpotM7(): Spot {
  switch (StoryState.location?.map) {
    case 'pucc_campus':
      return { at: P.pucc, label: 'La U' };
    case 'bobo_cuadra':
      return { at: P.bobo, label: 'Calle 18' };
    case 'bobo_lobby':
      return { at: P.bobo, label: 'Lobby del Bobo' };
    case 'farmadia':
      return { at: P.bobo, label: 'Farmadía' };
    default:
      return { at: P.bobo, label: 'Bobo · piso 8' };
  }
}

/** Misión 7: dónde va Sira, según lo que te ha escrito. */
function herSpotM7(): Spot {
  if (received('m7_sira_bus')) return { at: mix(P.bobo, P.sanFernando, 0.12), label: 'En el bus' };
  if (received('m7_v2_lobby')) return { at: P.bobo, label: 'Recepción del Bobo' };
  if (received('m7_v2_bus')) return { at: mix(P.sanFernando, P.bobo, 0.72), label: 'Bus · Calle 5' };
  if (!StoryState.hasFlag('m7_helado_martes') && received('m7_sira_martes')) return { at: P.pucc, label: 'Plaza Central' };
  return { at: P.sanFernando, label: 'En su casa' };
}

const M7_CHAT: ChatConfig = {
  isChat: (id) => id.startsWith('m7_') && isSiraChat(id),
  mySpot: mySpotM7,
  herSpot: herSpotM7,
  drawRoutes: routesM7,
};

/** Pines (con pulso), la línea punteada entre los dos y la leyenda de abajo. Devuelve cómo refrescarlos. */
function livePins(kit: VinetaKit, stage: Layer, cfg: ChatConfig): () => void {
  const pins = addG(kit, stage);
  const rec = addG(kit, stage);
  const legend = addG(kit, stage);
  const meText = makeText(kit.scene, MAP.x + 5, MAP.y + MAP.h + 2, '', { fontSize: '6px', color: '#9cc4ff' });
  const herText = makeText(kit.scene, MAP.x + 5, MAP.y + MAP.h + 9, '', { fontSize: '6px', color: '#ff9cb4' });
  const dist = makeText(kit.scene, MAP.x + MAP.w, MAP.y + MAP.h + 16, '', { fontSize: '5px', color: '#d8dcec' }).setOrigin(1, 0);
  stage.add([meText, herText, dist]);
  legend.fillStyle(0x2f6fd0, 1).fillCircle(MAP.x + 1, MAP.y + MAP.h + 6, 2);
  legend.fillStyle(0xe8607a, 1).fillCircle(MAP.x + 1, MAP.y + MAP.h + 13, 2);

  let me = toMap(cfg.mySpot().at);
  let her = toMap(cfg.herSpot().at);
  let target = { me, her };
  const refresh = (): void => {
    const a = cfg.mySpot();
    const b = cfg.herSpot();
    target = { me: toMap(a.at), her: toMap(b.at) };
    fitText(meText, `Tú: ${a.label}`, MAP.w - 4);
    fitText(herText, `Sira: ${b.label}`, MAP.w - 4);
    const d = km(a.at, b.at);
    dist.setText(d < 0.25 ? '¡están juntos!' : `a ${d.toFixed(1).replace('.', ',')} km`);
  };
  refresh();
  let t = 0;
  kit.every(50, () => {
    t += 0.05;
    // Los puntitos se deslizan a su nueva posición.
    me = { x: me.x + (target.me.x - me.x) * 0.12, y: me.y + (target.me.y - me.y) * 0.12 };
    her = { x: her.x + (target.her.x - her.x) * 0.12, y: her.y + (target.her.y - her.y) * 0.12 };
    pins.clear();
    // Punteado entre los dos.
    const n = Math.max(2, Math.round(Math.hypot(her.x - me.x, her.y - me.y) / 3));
    pins.fillStyle(0x5a5470, 0.8);
    for (let i = 1; i < n; i += 2) {
      const q = i / n;
      pins.fillRect(Math.round(me.x + (her.x - me.x) * q), Math.round(me.y + (her.y - me.y) * q), 1, 1);
    }
    const pulse = 2 + Math.sin(t * 5) * 1.5;
    for (const [p, c] of [[her, 0xe8607a], [me, 0x2f6fd0]] as const) {
      pins.fillStyle(c, 0.25).fillCircle(p.x, p.y, 3 + pulse);
      pins.fillStyle(0xffffff, 1).fillCircle(p.x, p.y, 3);
      pins.fillStyle(c, 1).fillCircle(p.x, p.y, 2);
    }
    // «EN VIVO» parpadea.
    rec.clear();
    if (Math.sin(t * 4) > -0.3) rec.fillStyle(0xff4848, 1).fillCircle(MAP.x + 4, MAP.y + 4, 1.5);
  });
  return refresh;
}

// ---------------------------------------------------------------------------
// El celular
// ---------------------------------------------------------------------------

interface Bubble {
  box: Phaser.GameObjects.Container;
  h: number;
  mine: boolean;
  ticks?: Phaser.GameObjects.Text;
}

const makeChat = (cfg: ChatConfig): VinetaBuilder => (kit) => {
  const scene = kit.scene;
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#2a2f45'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < w; i += 10) g.fillStyle(hex('#323853'), 1).fillRect(x + i, y, 5, h);
  });

  // Pantalla del chat (fondo beige con dibujitos), bajo las burbujas.
  const back = addG(kit, stage);
  back.fillStyle(hex('#1c1c24'), 1).fillRoundedRect(PH.x, PH.y, PH.w, PH.h, 6);
  back.fillStyle(hex('#ece5dc'), 1).fillRect(SCR.x, SCR.y, SCR.w, SCR.h);
  for (let i = 0; i < 18; i++) back.fillStyle(hex('#e2d9cc'), 1).fillRect(SCR.x + ((i * 37) % SCR.w), HEADER_BOTTOM + ((i * 23) % (INPUT_TOP - HEADER_BOTTOM)), 2, 2);

  const list = scene.add.container(0, 0);
  stage.add(list);

  // Lo de arriba (tapa las burbujas que suben): borde, barra de estado y cabecera.
  const top = addG(kit, stage);
  top.fillStyle(hex('#1c1c24'), 1).fillRect(PH.x, 0, PH.w, SCR.y);
  top.fillStyle(hex('#2e7a54'), 1).fillRect(SCR.x, SCR.y, SCR.w, 6);
  top.fillStyle(hex('#3c9c6c'), 1).fillRect(SCR.x, SCR.y + 6, SCR.w, 12);
  top.fillStyle(0xffffff, 1).fillTriangle(SCR.x + 3, SCR.y + 12, SCR.x + 6, SCR.y + 9, SCR.x + 6, SCR.y + 15);
  disc(top, SCR.x + 14, SCR.y + 12, 5, '#e8a0b8');
  top.fillStyle(hex('#5a3a28'), 1).fillRect(SCR.x + 10, SCR.y + 7, 8, 3).fillRect(SCR.x + 9, SCR.y + 9, 2, 6).fillRect(SCR.x + 17, SCR.y + 9, 2, 6);
  // Íconos de llamada y video.
  top.fillStyle(0xffffff, 1).fillRect(SCR.x + SCR.w - 18, SCR.y + 10, 6, 4).fillTriangle(SCR.x + SCR.w - 12, SCR.y + 12, SCR.x + SCR.w - 10, SCR.y + 10, SCR.x + SCR.w - 10, SCR.y + 14);
  top.fillStyle(0xffffff, 1).fillRect(SCR.x + SCR.w - 6, SCR.y + 9, 2, 6);
  const clock = makeText(scene, SCR.x + 3, SCR.y, Phone.clock(), { fontSize: '5px', color: '#ffffff' });
  top.fillStyle(0xffffff, 1).fillRect(SCR.x + SCR.w - 10, SCR.y + 2, 7, 3).fillRect(SCR.x + SCR.w - 3, SCR.y + 3, 1, 1);
  stage.add(clock);
  stage.add(makeText(scene, SCR.x + 21, SCR.y + 5, 'Sira', { fontSize: '7px', fontStyle: '600', color: '#ffffff' }));
  const status = makeText(scene, SCR.x + 21, SCR.y + 11, 'en línea', { fontSize: '5px', color: '#d8f4e4' });
  stage.add(status);

  // Barra de escribir.
  const bar = addG(kit, stage);
  bar.fillStyle(hex('#ece5dc'), 1).fillRect(SCR.x, INPUT_TOP - 1, SCR.w, SCR.y + SCR.h - INPUT_TOP + 1);
  bar.fillStyle(0xffffff, 1).fillRoundedRect(SCR.x + 2, INPUT_TOP, SCR.w - 16, 11, 5);
  const send = addG(kit, stage);
  const drawSend = (on: boolean): void => {
    send.clear();
    send.fillStyle(on ? 0x48c47c : 0x3c9c6c, 1).fillCircle(SCR.x + SCR.w - 7, INPUT_TOP + 5.5, 5.5);
    send.fillStyle(0xffffff, 1).fillTriangle(SCR.x + SCR.w - 9, INPUT_TOP + 2.5, SCR.x + SCR.w - 4, INPUT_TOP + 5.5, SCR.x + SCR.w - 9, INPUT_TOP + 8.5);
  };
  drawSend(false);
  const input = makeText(scene, SCR.x + 6, INPUT_TOP + 2, 'Mensaje', { fontSize: '6px', color: '#a8a4b0' });
  stage.add(input);
  const caret = addG(kit, stage);

  // --- Burbujas ---
  const bubbles: Bubble[] = [];
  // Mientras eliges qué contestar, el cuadro de opciones tapa la parte de abajo: la conversación sube.
  let listBottom = LIST_BOTTOM;
  const layout = (animate: boolean): void => {
    let y = listBottom;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      y -= b.h;
      if (animate) kit.tween({ targets: b.box, y, duration: 180, ease: 'Sine.Out' });
      else b.box.setY(y);
      y -= 3;
    }
    // Las que ya se fueron muy arriba no se ven más: se borran.
    while (bubbles.length > 0) {
      let total = 0;
      for (let i = 1; i < bubbles.length; i++) total += bubbles[i].h + 3;
      if (LIST_BOTTOM - total > HEADER_BOTTOM - 30) break;
      bubbles.shift()?.box.destroy();
    }
  };

  const makeBubble = (id: string, entry: PhoneEntry | null): Bubble => {
    const m = PHONE.messages[id];
    const mine = m.mine === true;
    const text = makeText(scene, 4, 3, m.text, { fontSize: FONT, color: INK, wordWrap: { width: BUBBLE_MAX - 8, useAdvancedWrap: true }, lineSpacing: 1 });
    const time = Phone.clock(entry ?? undefined);
    const meta = makeText(scene, 0, 0, mine ? `${time} ✓` : time, { fontSize: '5px', color: mine ? '#5a8a6a' : '#8a8494' });
    const w = Math.max(Math.ceil(text.width) + 8, Math.ceil(meta.width) + 8, 24);
    const h = Math.ceil(text.height) + 10;
    meta.setPosition(w - 3 - meta.width, h - 7);
    const g = scene.add.graphics();
    const fill = hex(mine ? '#d4f4c4' : '#ffffff');
    g.fillStyle(0x000000, 0.12).fillRoundedRect(0, 1, w, h, 4);
    g.fillStyle(fill, 1).fillRoundedRect(0, 0, w, h, 4);
    // Colita de la burbuja.
    if (mine) g.fillTriangle(w - 4, 0, w + 3, 0, w - 4, 6);
    else g.fillTriangle(4, 0, -3, 0, 4, 6);
    const x = mine ? SCR.x + SCR.w - 5 - w : SCR.x + 5;
    const box = scene.add.container(x, LIST_BOTTOM + 20, [g, text, meta]);
    list.add(box);
    return { box, h, mine, ticks: mine ? meta : undefined };
  };

  const push = (id: string, entry: PhoneEntry | null, animate: boolean): Bubble => {
    const b = makeBubble(id, entry);
    bubbles.push(b);
    if (animate) {
      b.box.setY(listBottom - b.h + 6).setAlpha(0);
      kit.tween({ targets: b.box, alpha: 1, duration: 160 });
    }
    layout(animate);
    return b;
  };

  /** La burbujita con los tres puntos de «escribiendo...». */
  const typingBubble = (): { done: () => void } => {
    const g = scene.add.graphics();
    const box = scene.add.container(SCR.x + 5, LIST_BOTTOM + 10, [g]);
    list.add(box);
    const b: Bubble = { box, h: 12, mine: false };
    bubbles.push(b);
    layout(true);
    let t = 0;
    const timer = scene.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        if (!g.active) return void timer.remove();
        t++;
        g.clear();
        g.fillStyle(0xffffff, 1).fillRoundedRect(0, 0, 26, 12, 5);
        for (let i = 0; i < 3; i++) g.fillStyle(0x8a8494, 1).fillCircle(7 + i * 6, 6 - (Math.floor(t / 2) % 3 === i ? 2 : 0), 1.6);
      },
    });
    return {
      done: () => {
        timer.remove();
        const i = bubbles.indexOf(b);
        if (i >= 0) bubbles.splice(i, 1);
        box.destroy();
      },
    };
  };

  // --- La cola de animaciones (un mensaje a la vez) ---
  const queue: PhoneEntry[] = [];
  let busy = false;
  let alive = true;
  const wait = (ms: number): Promise<void> => new Promise((res) => kit.after(ms, res));

  const playIncoming = async (e: PhoneEntry): Promise<void> => {
    const len = PHONE.messages[e.id].text.length;
    status.setText('escribiendo...').setColor('#ffffff');
    const dots = typingBubble();
    await wait(Math.min(2200, 700 + len * 9));
    if (!alive) return;
    dots.done();
    status.setText('en línea').setColor('#d8f4e4');
    push(e.id, e, true);
    playSfx('notify');
    StoryState.markRead([e.id]);
  };

  const playMine = async (e: PhoneEntry): Promise<void> => {
    const full = Array.from(PHONE.messages[e.id].text);
    input.setColor(INK);
    const step = Math.max(18, Math.min(45, 1300 / full.length));
    for (let i = 1; i <= full.length; i++) {
      if (!alive) return;
      // Solo cabe una línea: se ve el final de lo que vas escribiendo.
      let shown = full.slice(0, i).join('');
      input.setText(shown);
      while (input.width > SCR.w - 24 && shown.length > 1) {
        shown = shown.slice(1);
        input.setText(shown);
      }
      caret.clear().fillStyle(0x3c9c6c, 1).fillRect(input.x + input.width + 1, INPUT_TOP + 2, 1, 7);
      await wait(step);
    }
    if (!alive) return;
    drawSend(true);
    await wait(220);
    if (!alive) return;
    drawSend(false);
    caret.clear();
    input.setText('Mensaje').setColor('#a8a4b0');
    const b = push(e.id, e, true);
    playSfx('enviado');
    // Leído: los dos chulitos se ponen azules.
    await wait(700);
    if (!alive || !b.ticks?.active) return;
    b.ticks.setText(`${Phone.clock(e)} ✓✓`).setColor('#2f8ad8');
  };

  const pump = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    while (alive && queue.length > 0) {
      const e = queue.shift()!;
      animated.add(keyOf(e));
      if (PHONE.messages[e.id].mine) await playMine(e);
      else await playIncoming(e);
      if (alive) await wait(260);
    }
    busy = false;
  };

  // --- Lo que ya estaba en la conversación ---
  const known = new Set<string>();
  const entries = StoryState.phone.filter((e) => cfg.isChat(e.id));
  for (const e of entries) {
    known.add(keyOf(e));
    const fresh = !animated.has(keyOf(e)) && StoryState.playTimeMs - e.at < RECENT_MS;
    if (fresh) queue.push(e);
    else push(e.id, e, false);
  }
  // Si no hay nada viejo (primer mensaje del día), el chat parte vacío con la fecha.
  if (bubbles.length === 0) {
    const day = makeText(scene, 0, 0, 'HOY', { fontSize: '5px', fontStyle: '600', color: '#6a6478' });
    const g = scene.add.graphics().fillStyle(0xd8eef0, 1).fillRoundedRect(-3, -1, day.width + 6, 7, 3);
    const box = scene.add.container(SCR.x + SCR.w / 2 - day.width / 2, 0, [g, day]);
    list.add(box);
    bubbles.push({ box, h: 7, mine: false });
    layout(false);
  }

  drawMap(kit, stage, cfg);
  const refreshPins = livePins(kit, stage, cfg);

  // --- En vivo: cada mensaje nuevo del chat entra a la cola ---
  const onChange = (): void => {
    for (const e of StoryState.phone) {
      if (!cfg.isChat(e.id) || known.has(keyOf(e))) continue;
      known.add(keyOf(e));
      queue.push(e);
    }
    refreshPins();
    void pump();
  };
  const offState = EventSystem.on('state-changed', onChange);
  const clockTimer = scene.time.addEvent({ delay: 1000, loop: true, callback: () => clock.setText(Phone.clock()) });
  kit.every(80, () => {
    const top = dialogueUi.choicesTop;
    const want = top === null ? LIST_BOTTOM : Math.min(LIST_BOTTOM, Math.round(top - kit.panel.y - 4));
    if (want === listBottom) return;
    listBottom = want;
    layout(true);
  });
  phoneUi.chatOpen = true;
  stage.once(Phaser.GameObjects.Events.DESTROY, () => {
    alive = false;
    offState();
    clockTimer.remove();
    phoneUi.chatOpen = false;
  });
  // Se abre la viñeta y enseguida empieza a llegar lo nuevo.
  kit.after(250, () => void pump());
};

export const M6_CHAT_VINETAS: Record<string, VinetaBuilder> = {
  m6_chat: makeChat(M6_CHAT),
  m7_chat: makeChat(M7_CHAT),
};

/** Viñetas «en vivo»: si el diálogo vuelve a pedir la misma, no se rearma (sigue la conversación). */
export const LIVE_VINETAS = new Set(['m6_chat', 'm7_chat']);
