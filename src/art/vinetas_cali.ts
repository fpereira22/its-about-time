import { playSfx } from '../audio/sfx';
import { FONT_HUD } from '../config/display';
import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { makeText } from '../ui/theme';
import type { VinetaBuilder, VinetaKit } from '../ui/Vineta';
import type { HumanLook } from './characters';
import { characterLook } from './SpriteRegistry';
import { shade } from './palette';
import { disc, drawSideArm, drawSideBody, FIGURE_H, hex, type SideFigureOpts } from './vinetas';
import { addG, clockDigits, flat, lerp, outlined, popText, sparkle, type G, type Layer } from './vinetas_kit';

/**
 * Viñetas de la misión 4 (primer día en Cali):
 *  - cali_despertar  el celular marca 6:00 y el reloj de pulsera 8:00: todo da vueltas
 *  - cali_desayuno   arepa con quesito, huevos pericos, chocolate con queso y jugo de lulo
 *  - cali_aguacero   el cielo se cae sobre el campus: lluvia de lado, rayos y tú corriendo
 *  - fideos_agua / fideos_hierve / fideos_olla / fideos_hogao / fideos_plato   el almuerzo, paso a paso
 *  - cali_polera     la polera azul de la universidad, con el 14
 *  - cali_derrota    atardecer en la cancha: el equipo sentado en el pasto, molido
 *  - cali_rooftop    Cali de noche desde el piso 21: el mar de luces, el Cristo Rey y el brindis
 * Coordenadas locales del panel de la viñeta (220 × 108), en px de la resolución base.
 */

const W = 220;
const H = 108;
const INK = '#2a2433';

/** Números "aleatorios" fijos (el paisaje no cambia al repintarlo). */
function rand(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Figura de perfil (cuerpo y brazo) en (x, top). */
function figure(kit: VinetaKit, layer: Layer, look: HumanLook, x: number, top: number, opts: SideFigureOpts, hug = false): { body: G; arm: G } {
  const body = addG(kit, layer, x, top);
  const arm = addG(kit, layer, x, top);
  drawSideBody(body, look, opts);
  drawSideArm(arm, look, opts, hug);
  return { body, arm };
}

const lookOf = (id: string): HumanLook => (characterLook(id) as HumanLook | undefined) ?? playerLook();

// ---------------------------------------------------------------------------
// Despertar: dos relojes que no se ponen de acuerdo
// ---------------------------------------------------------------------------

const caliDespertar: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    // La pieza en penumbra, con la ventana clareando (amanecer rosado sobre los cerros).
    g.fillStyle(hex('#3a3448'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#5a4c5c'), 1).fillRect(x, y + h - 20, w, 20);
    g.fillStyle(hex('#6a5040'), 1).fillRect(x + 14, y + 10, 62, 50);
    g.fillStyle(hex('#f0a890'), 1).fillRect(x + 17, y + 13, 56, 22);
    g.fillStyle(hex('#f8d0a0'), 1).fillRect(x + 17, y + 35, 56, 6);
    g.fillStyle(hex('#3c6c58'), 1).fillTriangle(x + 17, y + 57, x + 45, y + 30, x + 73, y + 57);
    g.fillStyle(hex('#2a4c40'), 1).fillTriangle(x + 40, y + 57, x + 62, y + 38, x + 73, y + 50).fillRect(x + 17, y + 50, 56, 7);
    for (let bx = 22; bx < 72; bx += 9) g.fillStyle(hex(INK), 1).fillRect(x + bx, y + 13, 1, 44);
  });
  // El velador con el celular (hora de Cali) y el reloj de pulsera (hora de Chile).
  const g = addG(kit, stage);
  outlined(g, [
    [96, 66, 110, 6, '#8a5a38'],
    [100, 72, 102, 30, '#a87444'],
  ]);
  outlined(g, [[104, 40, 46, 24, '#1a1c24']]);
  flat(g, [[106, 42, 42, 20, '#1e2a48']]);
  outlined(g, [
    [160, 44, 38, 20, '#c8ccd4'],
    [174, 36, 10, 8, '#6a4428'],
    [174, 64, 10, 8, '#6a4428'],
  ]);
  flat(g, [[162, 46, 34, 16, '#d8e4c8']]);
  const screens = addG(kit, stage);
  stage.add(makeText(kit.scene, 127, 32, 'CALI', { fontFamily: FONT_HUD, fontSize: '8px', color: '#a8c8f0' }).setOrigin(0.5));
  stage.add(makeText(kit.scene, 179, 28, 'CHILE', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f0d0a0' }).setOrigin(0.5));
  let blink = true;
  const paint = (): void => {
    screens.clear();
    clockDigits(screens, 109, 46, '06:00', '#78c8f8', '#26345a', blink, 7, 12, 2);
    clockDigits(screens, 163, 49, '08:00', '#2a2433', '#c4d0b4', true, 6, 10, 1);
  };
  paint();
  kit.every(500, () => {
    blink = !blink;
    paint();
  });
  // Todo da vueltas: estrellitas y signos de pregunta orbitando.
  const swirl = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t += 0.12;
    swirl.clear();
    for (let i = 0; i < 4; i++) {
      const a = t + (i * Math.PI) / 2;
      const sx = Math.round(150 + Math.cos(a) * 46);
      const sy = Math.round(22 + Math.sin(a) * 8);
      swirl.fillStyle(hex(i % 2 ? '#f8e070' : '#ffffff'), 1).fillRect(sx - 1, sy, 3, 1).fillRect(sx, sy - 1, 1, 3);
    }
  });
  kit.after(400, () => popText(kit, stage, 150, 20, '¿?', '#f8e070', 12, 0));
};

// ---------------------------------------------------------------------------
// Desayuno valluno (vista desde arriba de la mesa)
// ---------------------------------------------------------------------------

const caliDesayuno: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    // Mantel de cuadritos verde y blanco.
    g.fillStyle(hex('#f4f0e4'), 1).fillRect(x, y, w, h);
    for (let yy = 0; yy < h; yy += 8) for (let xx = (yy / 8) % 2 ? 0 : 8; xx < w; xx += 16) g.fillStyle(hex('#b8dcb0'), 1).fillRect(x + xx, y + yy, 8, 8);
  });
  const g = addG(kit, stage);
  // Plato con la arepa (con su quesito derretido) y los huevos pericos.
  disc(g, 70, 56, 36, INK);
  disc(g, 70, 56, 35, '#f8f8f0');
  disc(g, 70, 56, 28, '#ece8dc');
  disc(g, 56, 50, 15, INK);
  disc(g, 56, 50, 14, '#e8c070');
  disc(g, 56, 50, 10, '#f0d088');
  flat(g, [
    [50, 46, 10, 4, '#f8f4e0'],
    [53, 50, 7, 3, '#f8f4e0'],
    [47, 41, 2, 2, '#c89048'],
    [61, 56, 2, 2, '#c89048'],
  ]);
  for (let i = 0; i < 26; i++) {
    const px = 76 + Math.round(rand(i) * 20);
    const py = 52 + Math.round(rand(i + 40) * 18);
    g.fillStyle(hex(i % 4 === 0 ? '#e84830' : i % 5 === 0 ? '#58a048' : '#f8d850'), 1).fillRect(px, py, 3, 2);
  }
  // Pocillo de chocolate con su queso adentro.
  disc(g, 150, 40, 15, INK);
  disc(g, 150, 40, 14, '#f8f8f0');
  disc(g, 150, 40, 11, '#6a3c20');
  disc(g, 152, 38, 4, '#f4f0d8');
  outlined(g, [[164, 37, 6, 6, '#f8f8f0']]);
  // Jugo de lulo (verde amarillento, con espumita).
  disc(g, 182, 82, 11, INK);
  disc(g, 182, 82, 10, '#d8e8f0');
  disc(g, 182, 82, 8, '#c8c848');
  disc(g, 180, 80, 3, '#e8e890');
  // Vapor que sube del chocolate.
  kit.every(320, () => {
    const s = addG(kit, stage, 146 + Math.round(Math.random() * 8), 26);
    s.fillStyle(0xffffff, 0.7).fillRect(0, 0, 1, 3);
    kit.progress(1100, (t) => s.setPosition(s.x + Math.round(Math.sin(t * 8)), Math.round(26 - t * 18)).setAlpha(0.7 * (1 - t)), () => s.destroy());
  });
};

// ---------------------------------------------------------------------------
// El aguacero
// ---------------------------------------------------------------------------

const caliAguacero: VinetaBuilder = (kit) => {
  const sky = { color: '#4a5468' };
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex(sky.color), 1).fillRect(x, y, w, h);
    // Nubes negras, gordas, bajas.
    for (let i = 0; i < 9; i++) disc(g, x + 12 + i * 26, y + 6 + Math.round(rand(i) * 8), 16, i % 2 ? '#3a4254' : '#2e3444');
    // Edificio de ladrillo de la U, con su fila de ventanas, y una palma.
    g.fillStyle(hex('#8e4630'), 1).fillRect(x + 120, y + 34, 100, 56);
    g.fillStyle(hex('#a85a40'), 1).fillRect(x + 122, y + 36, 96, 52);
    for (let wx = 128; wx < 214; wx += 14) g.fillStyle(hex('#5a7898'), 1).fillRect(x + wx, y + 44, 8, 10).fillRect(x + wx, y + 64, 8, 10);
    g.fillStyle(hex('#8a6a40'), 1).fillRect(x + 40, y + 36, 3, 54);
    g.fillStyle(hex('#3c7c48'), 1).fillRect(x + 28, y + 32, 28, 4).fillRect(x + 24, y + 36, 8, 3).fillRect(x + 52, y + 36, 8, 3);
    // Pasto y el camino, ya con charcos.
    g.fillStyle(hex('#3c6c38'), 1).fillRect(x, y + 88, w, 20);
    g.fillStyle(hex('#8a7a6c'), 1).fillRect(x, y + 94, w, 10);
    g.fillStyle(hex('#7890a8'), 1).fillRect(x + 30, y + 98, 30, 3).fillRect(x + 130, y + 99, 40, 3);
  });
  const umbrella = StoryState.hasItem('paraguas');
  const look = playerLook();
  const runner = kit.scene.add.container(-30, 0);
  stage.add(runner);
  const top = 94 - FIGURE_H;
  const opts: SideFigureOpts = { dir: 1, scale: 1, eyes: 'open' };
  const body = addG(kit, runner, 0, top);
  drawSideBody(body, look, opts);
  const arm = addG(kit, runner, 0, top);
  drawSideArm(arm, look, opts, true);
  const cover = addG(kit, runner, 0, top);
  if (umbrella) {
    // Paraguas negro (prestado por doña Mery) que el viento quiere dar vuelta.
    cover.fillStyle(hex(INK), 1).fillRect(12, -14, 1, 18);
    for (let i = -16; i <= 16; i++) cover.fillRect(12 + i, -14 - Math.round(Math.sqrt(256 - i * i) / 2), 1, Math.round(Math.sqrt(256 - i * i) / 2) + 1);
    cover.fillStyle(hex('#3a3c48'), 1);
    for (let i = -15; i <= 15; i++) cover.fillRect(12 + i, -13 - Math.round(Math.sqrt(225 - i * i) / 2), 1, Math.round(Math.sqrt(225 - i * i) / 2));
  } else {
    // La mochila encima de la cabeza, de techito.
    outlined(cover, [[2, -6, 18, 8, look.extras?.includes('backpack') ? '#e8a030' : '#5a6070']]);
  }
  kit.progress(4200, (t) => runner.setPosition(lerp(-30, 240, t), Math.round(Math.abs(Math.sin(t * 40)) * -2)), undefined, 'Linear');

  // Lluvia de lado (se repinta cada cuadro) y salpicaduras.
  const rain = addG(kit, stage);
  let ms = 0;
  kit.every(40, () => {
    ms += 40;
    rain.clear().fillStyle(0xc8d8f0, 0.7);
    for (let i = 0; i < 120; i++) {
      const x = ((rand(i) * 260 + ms * 0.12) % 260) - 20;
      const y = (rand(i + 300) * 120 + ms * (0.45 + rand(i + 600) * 0.2)) % 120 - 10;
      rain.fillRect(Math.round(x - y * 0.3), Math.round(y), 1, 4);
    }
    for (let i = 0; i < 6; i++) rain.fillRect(Math.round(rand(i + Math.floor(ms / 200)) * 220), 100 + (i % 3), 3, 1);
  });
  // Un rayo que ilumina todo.
  const flash = kit.scene.add.rectangle(0, 0, W, H, 0xf0f4ff).setAlpha(0).setOrigin(0);
  stage.add(flash);
  const bolt = addG(kit, stage);
  kit.after(900, () => {
    bolt.fillStyle(hex('#f8f0a0'), 1);
    let bx = 80;
    for (let y = 0; y < 40; y += 4) {
      bx += Math.round((rand(y) - 0.5) * 8);
      bolt.fillRect(bx, y, 2, 4);
    }
    flash.setAlpha(0.8);
    kit.tween({ targets: flash, alpha: 0, duration: 500 });
    kit.after(120, () => bolt.clear());
    kit.after(500, () => playSfx('trueno'));
  });
};

// ---------------------------------------------------------------------------
// Fideos con hogao, paso a paso (la estufa vista de frente)
// ---------------------------------------------------------------------------

type FideosStep = 'agua' | 'hierve' | 'olla' | 'hogao' | 'plato';

function stoveBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  // Baldosas blancas de la cocina de doña Mery, con la cenefa de colores.
  g.fillStyle(hex('#f0ece4'), 1).fillRect(x, y, w, h);
  for (let yy = 0; yy < 70; yy += 10) g.fillStyle(hex('#d8d2c6'), 1).fillRect(x, y + yy, w, 1);
  for (let xx = 0; xx < w; xx += 10) g.fillStyle(hex('#d8d2c6'), 1).fillRect(x + xx, y, 1, 70);
  for (let xx = 0; xx < w; xx += 20) g.fillStyle(hex(xx % 40 ? '#3c9c5c' : '#e8a030'), 1).fillRect(x + xx, y + 30, 10, 4);
  // La estufa: cubierta negra y las perillas.
  g.fillStyle(hex(INK), 1).fillRect(x, y + 74, w, 34);
  g.fillStyle(hex('#3a3c44'), 1).fillRect(x, y + 76, w, 32);
  for (const kx of [40, 80, 140, 180]) disc(g, x + kx, y + 96, 4, '#c8ccd4');
}

/** Llamas azules de la hornilla en `cx` (se repintan cada cuadro). */
function flames(g: G, cx: number, ms: number): void {
  for (let i = -10; i <= 10; i += 3) {
    const h = 3 + Math.round((Math.sin(ms / 70 + i) + 1) * 1.5);
    g.fillStyle(hex('#4888f0'), 1).fillRect(cx + i, 74 - h, 2, h);
    g.fillStyle(hex('#a8d0ff'), 1).fillRect(cx + i, 74 - 1, 2, 1);
  }
}

function fideos(step: FideosStep): VinetaBuilder {
  return (kit) => {
    if (step === 'plato') return fideosPlato(kit);
    const stage = kit.framed(stoveBackdrop);
    const fire = addG(kit, stage);
    const pot = addG(kit, stage);
    const fx = addG(kit, stage);
    const potX = 50;
    const panX = 150;
    // La olla: metal, con el agua (y los fideos) adentro.
    outlined(pot, [
      [potX - 26, 40, 52, 34, '#a8b0bc'],
      [potX - 32, 44, 6, 4, '#303038'],
      [potX + 26, 44, 6, 4, '#303038'],
    ]);
    flat(pot, [
      [potX - 24, 42, 48, 4, '#5a8ab8'],
      [potX - 22, 48, 3, 22, '#d4dae2'],
    ]);
    if (step === 'olla' || step === 'hogao') {
      // Los fideos ya adentro, blanditos.
      for (let i = 0; i < 9; i++) pot.fillStyle(hex('#f0d890'), 1).fillRect(potX - 20 + i * 5, 40 - (i % 3), 2, 4);
    }
    if (step === 'hogao') {
      // La sartén con el hogao: tomate, cebolla larga y ajo.
      outlined(pot, [
        [panX - 28, 58, 56, 16, '#3a3c44'],
        [panX + 28, 62, 26, 4, '#303038'],
      ]);
      for (let i = 0; i < 18; i++) pot.fillStyle(hex(i % 3 === 0 ? '#f0f0d8' : i % 4 === 0 ? '#68a848' : '#d84830'), 1).fillRect(panX - 24 + Math.round(rand(i) * 46), 58 + Math.round(rand(i + 9) * 4), 3, 2);
    }
    let ms = 0;
    const boiling = step !== 'agua';
    kit.every(60, () => {
      ms += 60;
      fire.clear();
      flames(fire, potX, ms);
      if (step === 'hogao') flames(fire, panX, ms + 200);
      fx.clear();
      if (boiling) {
        // Burbujas que revientan y vapor.
        for (let i = 0; i < 6; i++) {
          const bx = potX - 20 + Math.round(rand(i + Math.floor(ms / 240)) * 40);
          fx.fillStyle(0xd8eaff, 1).fillRect(bx, 41, 3, 2);
        }
        for (let i = 0; i < 4; i++) {
          const k = (ms / 900 + i / 4) % 1;
          fx.fillStyle(0xffffff, 0.6 * (1 - k)).fillRect(potX - 12 + i * 8 + Math.round(Math.sin(k * 6 + i) * 2), Math.round(36 - k * 30), 2, 3);
        }
      }
      if (step === 'hogao' && Math.floor(ms / 120) % 2 === 0) fx.fillStyle(0xf8f0c0, 1).fillRect(panX - 20 + Math.round(rand(ms) * 40), 55, 1, 1);
    });
    if (boiling) kit.every(900, () => playSfx('hervir'));
    if (step === 'olla') {
      // Los fideos entran derechitos y se doblan al tocar el agua.
      const sticks = addG(kit, stage);
      kit.progress(1400, (t) => {
        sticks.clear();
        for (let i = 0; i < 7; i++) {
          const x0 = potX - 14 + i * 4;
          const bend = Math.round(t * 10);
          sticks.fillStyle(hex('#e8c878'), 1).fillRect(x0 + bend, 8 + Math.round(t * 22), 1, 26 - Math.round(t * 14));
        }
      });
    }
    if (step === 'hogao') {
      // La cuchara de palo revuelve.
      const spoon = addG(kit, stage);
      kit.every(80, () => {
        const a = kit.scene.time.now / 300;
        spoon.clear();
        outlined(spoon, [[panX + Math.round(Math.cos(a) * 12) - 2, 30 + Math.round(Math.sin(a) * 3), 4, 30, '#b88050']]);
      });
    }
  };
}

function fideosPlato(kit: VinetaKit): void {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#c8704c'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#f4f0e4'), 1).fillRect(x + 20, y + 8, w - 40, h - 16);
  });
  const g = addG(kit, stage);
  disc(g, 110, 56, 40, INK);
  disc(g, 110, 56, 39, '#f8f8f0');
  disc(g, 110, 56, 30, '#ece8dc');
  // Los fideos (hilos dorados enredados) con el hogao encima.
  for (let i = 0; i < 70; i++) {
    const a = rand(i) * Math.PI * 2;
    const r = rand(i + 70) * 22;
    g.fillStyle(hex(i % 2 ? '#f0d890' : '#e0c070'), 1).fillRect(110 + Math.round(Math.cos(a) * r), 56 + Math.round(Math.sin(a) * r * 0.8), 4, 1);
  }
  disc(g, 110, 52, 12, '#c84830');
  for (let i = 0; i < 14; i++) g.fillStyle(hex(i % 3 ? '#e86848' : '#f0f0d8'), 1).fillRect(102 + Math.round(rand(i + 5) * 16), 46 + Math.round(rand(i + 20) * 12), 2, 2);
  // Tenedor, vaso de jugo y una servilleta.
  outlined(g, [[164, 30, 3, 46, '#c8ccd4']]);
  flat(g, [
    [161, 28, 1, 8, '#c8ccd4'],
    [169, 28, 1, 8, '#c8ccd4'],
  ]);
  disc(g, 52, 30, 10, INK);
  disc(g, 52, 30, 9, '#e8a040');
  kit.every(360, () => {
    const s = addG(kit, stage, 104 + Math.round(Math.random() * 12), 40);
    s.fillStyle(0xffffff, 0.7).fillRect(0, 0, 1, 3);
    kit.progress(1100, (t) => s.setPosition(s.x + Math.round(Math.sin(t * 7)), Math.round(40 - t * 20)).setAlpha(0.7 * (1 - t)), () => s.destroy());
  });
  kit.after(300, () => sparkle(kit, stage, 132, 34));
}

// ---------------------------------------------------------------------------
// La polera azul de la universidad
// ---------------------------------------------------------------------------

const caliPolera: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#e8e4dc'), 1).fillRect(x, y, w, h);
    for (let i = 0; i < 12; i++) g.fillStyle(hex('#dcd6ca'), 1).fillRect(x, y + i * 9, w, 1);
  });
  const shirt = kit.scene.add.container(W / 2, 140);
  stage.add(shirt);
  const g = kit.scene.add.graphics();
  shirt.add(g);
  const blue = '#2050a8';
  outlined(g, [
    [-30, -40, 60, 70, blue],
    [-48, -40, 20, 22, blue],
    [28, -40, 20, 22, blue],
  ]);
  flat(g, [
    [-10, -40, 20, 5, '#f0c030'],
    [-30, 26, 60, 4, shade(blue, -0.25)],
    [-46, -22, 16, 2, '#f0c030'],
    [30, -22, 16, 2, '#f0c030'],
  ]);
  // El 11 y las letras de la universidad.
  const number = makeText(kit.scene, 0, -6, '14', { fontFamily: FONT_HUD, fontSize: '22px', color: '#f8f8f0', stroke: INK, strokeThickness: 2 }).setOrigin(0.5);
  const label = makeText(kit.scene, 0, -26, 'PUCC', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f0c030' }).setOrigin(0.5);
  shirt.add([number, label]);
  kit.tween({ targets: shirt, y: 62, duration: 520, ease: 'Back.Out', onUpdate: () => shirt.setY(Math.round(shirt.y)) });
  kit.after(560, () => {
    for (let i = 0; i < 5; i++) kit.after(i * 140, () => sparkle(kit, stage, 70 + Math.round(rand(i) * 80), 20 + Math.round(rand(i + 9) * 60)));
  });
};

// ---------------------------------------------------------------------------
// Después de la derrota: el atardecer en la cancha
// ---------------------------------------------------------------------------

const caliDerrota: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w) => {
    const bands = ['#5a4c88', '#8a5c98', '#d87878', '#f0a060', '#f8c878'];
    bands.forEach((c, i) => g.fillStyle(hex(c), 1).fillRect(x, y + i * 12, w, 12));
    disc(g, x + 160, y + 58, 14, '#f8e0a0');
    // Los Farallones en silueta y la cancha.
    g.fillStyle(hex('#3a3050'), 1).fillTriangle(x, y + 70, x + 60, y + 40, x + 120, y + 70).fillTriangle(x + 80, y + 70, x + 150, y + 46, x + 220, y + 70);
    g.fillStyle(hex('#3c7c40'), 1).fillRect(x, y + 70, w, 38);
    g.fillStyle(hex('#f0f0e8'), 0.7).fillRect(x, y + 84, w, 1);
    // El arco a lo lejos.
    g.fillStyle(hex('#f0f0e8'), 1).fillRect(x + 190, y + 56, 2, 16).fillRect(x + 212, y + 56, 2, 16).fillRect(x + 190, y + 56, 24, 2);
  });
  // El equipo sentado en el pasto (de perfil, mirando el atardecer), con las poleras azules. El pasto de
  // adelante tapa la mitad de abajo del cuerpo y encima van las piernas estiradas.
  const GROUND = 94;
  const team: Array<[string, number]> = [
    ['alvaro_u', 22],
    ['player', 60],
    ['nacho_u', 98],
    ['diego_u', 136],
  ];
  const seated = team.map(([id, x], i) => {
    const look = id === 'player' ? { ...playerLook(), shirt: '#2050a8', pants: '#f0f0e8' } : lookOf(id);
    const c = kit.scene.add.container(x, 0);
    stage.add(c);
    const body = addG(kit, c, 0, GROUND - 30);
    drawSideBody(body, { ...look, extras: [] }, { dir: 1, scale: 0.9, eyes: i === 1 ? 'closed' : 'open' });
    return { c, look, i };
  });
  const grass = addG(kit, stage);
  grass.fillStyle(hex('#3c7c40'), 1).fillRect(0, GROUND, W, H - GROUND);
  grass.fillStyle(hex('#4c8c48'), 1).fillRect(0, GROUND, W, 1);
  for (const s of seated) {
    const legs = addG(kit, s.c);
    outlined(legs, [[8, GROUND - 5, 20, 5, s.look.pants]]);
    outlined(legs, [[28, GROUND - 7, 4, 7, s.look.shoes ?? '#303038']]);
    kit.tween({ targets: s.c, y: 1, duration: 900 + s.i * 120, yoyo: true, repeat: -1, ease: 'Sine.InOut', onUpdate: () => s.c.setY(Math.round(s.c.y)) });
  }
  // La pelota quieta y una gota de sudor.
  const g = addG(kit, stage);
  disc(g, 160, 96, 5, INK);
  disc(g, 160, 96, 4, '#f8f8f0');
  g.fillStyle(hex(INK), 1).fillRect(159, 95, 2, 2);
  kit.every(1400, () => {
    const d = addG(kit, stage, 64, 54);
    d.fillStyle(0xa8e0ff, 1).fillRect(0, 0, 1, 2);
    kit.progress(700, (t) => d.setPosition(64, Math.round(54 + t * 8)).setAlpha(1 - t), () => d.destroy());
  });
};

// ---------------------------------------------------------------------------
// El rooftop: Cali de noche
// ---------------------------------------------------------------------------

const CITY = Array.from({ length: 260 }, (_, i) => ({
  x: Math.round(rand(i) * W),
  y: 58 + Math.round(Math.pow(rand(i + 900), 0.7) * 34),
  c: rand(i + 400) < 0.7 ? '#f0a848' : rand(i + 800) < 0.5 ? '#f8e0a0' : '#f0f0e0',
  tw: rand(i + 1200) < 0.12,
}));
const STARS = Array.from({ length: 30 }, (_, i) => ({ x: Math.round(rand(i + 2000) * W), y: Math.round(rand(i + 2100) * 34) }));

const caliRooftop: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    const bands = ['#0e1230', '#141a3c', '#1c2248', '#262a54', '#3a3460'];
    bands.forEach((c, i) => g.fillStyle(hex(c), 1).fillRect(x, y + i * 12, w, 12));
    g.fillStyle(hex('#4a3c64'), 1).fillRect(x, y + 56, w, 6);
    // Cerros del occidente: los Farallones y el cerro de Cristo Rey con la estatua iluminada.
    g.fillStyle(hex('#10142a'), 1).fillTriangle(x - 10, y + 62, x + 50, y + 26, x + 110, y + 62).fillTriangle(x + 60, y + 62, x + 120, y + 34, x + 190, y + 62);
    g.fillStyle(hex('#0c1024'), 1).fillTriangle(x + 130, y + 62, x + 180, y + 44, x + 240, y + 62);
    g.fillStyle(hex('#f8f0d0'), 1).fillRect(x + 51, y + 18, 1, 8).fillRect(x + 48, y + 20, 7, 1).fillRect(x + 50, y + 26, 3, 1);
    // Las tres cruces en el otro cerro.
    for (const cx of [118, 122, 126]) g.fillStyle(hex('#f0e0b0'), 1).fillRect(x + cx, y + 30, 1, 5).fillRect(x + cx - 1, y + 31, 3, 1);
    g.fillStyle(hex('#141428'), 1).fillRect(x, y + 62, w, h - 62);
  });
  const city = addG(kit, stage);
  let ms = 0;
  const paint = (): void => {
    city.clear();
    for (const s of STARS) if ((s.x + Math.floor(ms / 400)) % 7) city.fillStyle(0xe8ecf8, 1).fillRect(s.x, s.y, 1, 1);
    CITY.forEach((p, i) => {
      if (p.tw && (Math.floor(ms / 180) + i) % 4 === 0) return;
      city.fillStyle(hex(p.c), 1).fillRect(p.x, p.y, 1, 1);
    });
    // Unas torres con su luz roja de aviso arriba.
    for (const [tx, th] of [
      [150, 30],
      [168, 22],
      [196, 26],
    ] as const) {
      city.fillStyle(hex('#1c2040'), 1).fillRect(tx, 92 - th, 8, th);
      for (let wy = 92 - th + 3; wy < 90; wy += 4) city.fillStyle(hex('#f0c060'), 0.8).fillRect(tx + 2, wy, 1, 1).fillRect(tx + 5, wy + 1, 1, 1);
      if (Math.floor(ms / 600) % 2 === 0) city.fillStyle(0xff4040, 1).fillRect(tx + 3, 92 - th - 2, 2, 2);
    }
  };
  paint();
  kit.every(90, () => {
    ms += 90;
    paint();
  });

  // La baranda de vidrio y el grupo brindando delante de la ciudad.
  const rail = addG(kit, stage);
  rail.fillStyle(0xb8d8f0, 0.25).fillRect(0, 84, W, 16);
  rail.fillStyle(hex('#c8ccd4'), 1).fillRect(0, 84, W, 2);
  for (let x = 6; x < W; x += 36) rail.fillRect(x, 84, 2, 24);

  const friends: Array<[string, number, 1 | -1]> = [
    ['antoine', 30, 1],
    ['alvaro', 62, 1],
    ['player', 96, 1],
    ['diego', 128, -1],
    ['nacho', 160, -1],
  ];
  const glasses: G[] = [];
  for (const [id, x, dir] of friends) {
    const look = id === 'player' ? playerLook() : lookOf(id);
    figure(kit, stage, { ...look, extras: [] }, x, 108 - FIGURE_H + 4, { dir, scale: 1, eyes: 'open' });
    const glass = addG(kit, stage, x + (dir === 1 ? 20 : -2), 70);
    glass.fillStyle(hex('#f0c040'), 1).fillRect(0, 2, 3, 5);
    glass.fillStyle(0xffffff, 0.9).fillRect(0, 0, 3, 2);
    glasses.push(glass);
  }
  // ¡Salud! Los vasos suben al centro y chocan.
  kit.after(700, () => {
    for (const glassG of glasses) kit.tween({ targets: glassG, x: 108, y: 56, duration: 450, ease: 'Cubic.Out' });
    kit.after(470, () => {
      playSfx('brindis');
      popText(kit, stage, 110, 46, '¡SALUD!', '#f8e070', 12, 0);
      for (let i = 0; i < 6; i++) kit.after(i * 90, () => sparkle(kit, stage, 96 + Math.round(rand(i) * 28), 44 + Math.round(rand(i + 3) * 16)));
    });
  });
};

export const CALI_VINETAS: Record<string, VinetaBuilder> = {
  cali_despertar: caliDespertar,
  cali_desayuno: caliDesayuno,
  cali_aguacero: caliAguacero,
  fideos_agua: fideos('agua'),
  fideos_hierve: fideos('hierve'),
  fideos_olla: fideos('olla'),
  fideos_hogao: fideos('hogao'),
  fideos_plato: fideos('plato'),
  cali_polera: caliPolera,
  cali_derrota: caliDerrota,
  cali_rooftop: caliRooftop,
};
