import { playerLook, SWIM_TRUNKS } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { makeText } from '../ui/theme';
import type { VinetaBuilder } from '../ui/Vineta';
import type { HumanLook } from './characters';
import { shade } from './palette';
import { disc, hex } from './vinetas';
import { addG, flat, floatHeart, floatZ, lerp, outlined, popText, sparkle, type G } from './vinetas_kit';
import { bust, floatNote, INK, lookOf, side } from './vinetas_m5';

/**
 * Viñetas de la misión 5 (segunda parte): Grover de cerca (con todo su esplendor), el pavo real con las
 * llaves, el cacharro por la Calle 18, el panzazo desde el partidor, las toallas después del Marco Polo, Sira
 * (en la salida de la piscina y en la puerta de Pance Burger), la hamburguesa, el Equipo 5, el Instagram,
 * las buenas noches y el niño con sus gafas.
 */

// ---------------------------------------------------------------------------
// Grover
// ---------------------------------------------------------------------------

/**
 * La cara de Grover de cerca, en grande: monoceja frondosa, mullet, bigotito de adolescente, nariz de papa,
 * dientes de conejo, orejas de jarra, granos, un lunar con un pelo y una mosca que no lo deja en paz.
 */
export function groverFace(g: G, cx: number, cy: number, s: number, t: number, swim: boolean): void {
  const look = lookOf(swim ? 'grover_bano' : 'grover');
  const r = (x: number, y: number, w: number, h: number, c: string): void => {
    g.fillStyle(hex(c), 1).fillRect(Math.round(cx + x * s), Math.round(cy + y * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
  };
  const skin = look.skin;
  const skinD = shade(skin, -0.18);
  // Hombros: camiseta verde o, en la piscina, el pecho al aire con tres pelos.
  r(-10, 8, 20, 6, INK);
  r(-9, 9, 18, 5, swim ? skin : '#2c9c4c');
  if (swim) for (const [x, y] of [[-2, 10], [0, 11], [2, 10]] as const) r(x, y, 0.5, 1.2, '#141010');
  else r(-2, 9, 4, 2, '#f0f0e8');
  r(-2, 6, 4, 3, skinD);
  // El mullet que asoma por detrás de la nuca, hasta los hombros.
  r(-7, 1, 14, 9, look.hair);
  r(-7.5, 5, 2, 5, look.hair);
  r(5.5, 5, 2, 5, look.hair);
  // Orejas de jarra.
  r(-8, -1, 3, 4, INK);
  r(-7.5, -0.5, 2, 3, skin);
  r(5, -1, 3, 4, INK);
  r(5.5, -0.5, 2, 3, skin);
  // Cara (un poco chueca).
  r(-6, -6, 12, 13, INK);
  r(-5, -5, 10, 11, skin);
  r(-5, 4, 3, 2, skinD);
  // Pelo de arriba, con chasquilla recta de tijera casera.
  r(-6, -8, 12, 4, INK);
  r(-5, -7, 10, 2.6, look.hair);
  // Chasquilla recta de tijera casera, con un mechón parado.
  r(-5, -4.6, 10, 0.8, look.hair);
  r(1, -9, 1, 2, look.hair);
  // Monoceja: una sola, gruesa, que sube y baja.
  const brow = Math.sin(t * 5) > 0.3 ? -0.5 : 0;
  r(-4.5, -3 + brow, 9, 1.3, '#141010');
  // Ojos: uno más grande que el otro.
  r(-3.5, -1.5, 2, 2, '#f8f8f0');
  r(-2.8, -1, 1, 1.2, '#202028');
  r(1.2, -1.3, 2.4, 2.4, '#f8f8f0');
  r(2, -0.8, 1.2, 1.4, '#202028');
  // Nariz de papa.
  r(-1.2, -0.5, 2.6, 3.2, shade(skin, -0.1));
  r(-1.5, 2, 3.2, 1.2, shade(skin, -0.25));
  // Bigotito ralo y los dientes de conejo.
  for (let x = -2.5; x < 2.5; x += 1) r(x, 3.3, 0.6, 0.7, '#3a2a20');
  r(-2, 4.2, 4, 1.4, '#7a2a2a');
  r(-1, 4.2, 1, 1.8, '#f8f8f0');
  r(0.1, 4.2, 1, 1.8, '#f8f8f0');
  // Granos y el lunar con su pelo.
  r(-4, 1.5, 0.8, 0.8, '#d86a5a');
  r(3.5, 2.8, 0.8, 0.8, '#d86a5a');
  r(-3, -4.6, 0.7, 0.7, '#d86a5a');
  r(3.8, 0.8, 1, 1, '#4a3020');
  r(4.6, -0.2, 0.3, 1.2, '#141010');
  // La gota de sudor.
  if (Math.sin(t * 2) > 0) r(5.4, -4 + ((t * 3) % 3), 0.8, 1.4, '#a8e0ff');
}

const grover: VinetaBuilder = (kit) => {
  const swim = StoryState.hasFlag('en_bano');
  const stage = kit.framed((g, x, y, w, h) => {
    if (swim) {
      // Los camerinos: lockers azules.
      g.fillStyle(hex('#c8ccd0'), 1).fillRect(x, y, w, h);
      for (let i = 0; i < w; i += 22) g.fillStyle(hex('#3a6ab0'), 1).fillRect(x + i + 1, y + 6, 20, 70).fillStyle(hex('#2a4c80'), 1).fillRect(x + i + 1, y + 30, 20, 1);
    } else {
      // El parqueadero de la U al atardecer.
      g.fillStyle(hex('#f8c890'), 1).fillRect(x, y, w, h);
      g.fillStyle(hex('#c0684a'), 1).fillRect(x, y + 50, w, 30);
      for (let i = 0; i < w; i += 18) g.fillStyle(hex('#e8d8c0'), 1).fillRect(x + i + 4, y + 56, 8, 8);
      g.fillStyle(hex('#6a6c78'), 1).fillRect(x, y + 80, w, h - 80);
    }
  });
  const face = addG(kit, stage);
  const fly = addG(kit, stage);
  let t = 0;
  kit.every(70, () => {
    t += 0.07;
    face.clear();
    const bob = Math.round(Math.sin(t * 3) * 1);
    groverFace(face, 110, 52 + bob, 4.6, t, swim);
    // La mosca da vueltas alrededor de la cabeza.
    fly.clear();
    const fx = 110 + Math.cos(t * 4) * 46;
    const fy = 30 + Math.sin(t * 6) * 18;
    fly.fillStyle(hex('#202028'), 1).fillRect(Math.round(fx), Math.round(fy), 2, 2);
    fly.fillStyle(0xffffff, 0.7).fillRect(Math.round(fx) - 1, Math.round(fy) - 1 - (Math.floor(t * 30) % 2), 2, 1).fillRect(Math.round(fx) + 1, Math.round(fy) - 1 - (Math.floor(t * 30 + 1) % 2), 2, 1);
  });
  kit.every(1700, () => popText(kit, stage, 180, 20, ['¡CUMPA!', '¡Ya, ya!', 'bzzz', '¿Qué me mirás?'][Math.floor(Math.random() * 4)], '#ffffff', 8, 800));
  kit.every(900, () => sparkle(kit, stage, 70 + Math.random() * 10, 46));
};

/** El pavo real con las llaves en el pico: la cola se abre, el llavero brilla. */
const pavoLlaves: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#b8e0f0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#5aac4a'), 1).fillRect(x, y + 74, w, h - 74);
    g.fillStyle(hex('#c0684a'), 1).fillRect(x + 150, y + 16, 60, 58);
    g.fillStyle(hex('#f0e8d8'), 1).fillTriangle(x + 146, y + 18, x + 214, y + 18, x + 180, y + 2);
  });
  const tail = addG(kit, stage);
  const body = addG(kit, stage);
  const keys = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t += 0.06;
    const open = Math.min(1, Math.max(0, Math.sin(t * 1.2) * 1.5));
    tail.clear();
    // La cola: abanico de plumas con ocelos.
    for (let i = 0; i < 13; i++) {
      const a = Math.PI * (0.55 + (i / 12) * 0.9 * open + (1 - open) * 0.42);
      const len = 30 + open * 22;
      const x2 = 70 + Math.cos(a) * len;
      const y2 = 70 - Math.sin(a) * len;
      tail.lineStyle(3, hex('#2a6a34'), 1).lineBetween(70, 70, x2, y2);
      disc(tail, Math.round(x2), Math.round(y2), 3, '#e0b840');
      disc(tail, Math.round(x2), Math.round(y2), 1.5, '#1c2a8a');
    }
    body.clear();
    outlined(body, [
      [62, 56, 22, 18, '#1c8a8a'],
      [80, 40, 6, 20, '#2a5cc8'],
      [80, 32, 10, 10, '#2a5cc8'],
      [70, 74, 2, 10, '#8a8a94'],
      [78, 74, 2, 10, '#8a8a94'],
    ]);
    flat(body, [[86, 35, 2, 2, '#202028'], [90, 37, 4, 2, '#d8c8a0'], [82, 28, 1, 4, '#2a5cc8'], [85, 27, 1, 5, '#2a5cc8']]);
    // Las llaves y la llamita colgando del pico.
    keys.clear();
    const sw = Math.round(Math.sin(t * 5) * 2);
    keys.lineStyle(1, hex('#c8ccd4'), 1).strokeCircle(94 + sw, 44, 3);
    outlined(keys, [[94 + sw, 47, 2, 8, '#e0b840'], [96 + sw, 52, 7, 5, '#f4f0e6'], [101 + sw, 46, 3, 7, '#f4f0e6']]);
    flat(keys, [[96 + sw, 52, 4, 1, '#e84868'], [96 + sw, 53, 4, 1, '#f0c030'], [102 + sw, 47, 1, 1, '#202028']]);
  });
  kit.every(500, () => sparkle(kit, stage, 96 + Math.round(Math.random() * 8), 46 + Math.round(Math.random() * 10)));
  kit.every(2400, () => popText(kit, stage, 130, 20, '¡AAÉÉÉ!', '#ffffff', 9, 700));
};

// ---------------------------------------------------------------------------
// El cacharro de Grover
// ---------------------------------------------------------------------------

/** El carro de Grover de lado, a escala `s` (el mismo dibujo que el sprite del mapa, en grande). */
function groverCar(g: G, x: number, y: number, s: number, t: number): void {
  const r = (rx: number, ry: number, w: number, h: number, c: string, a = 1): void => {
    g.fillStyle(hex(c), a).fillRect(Math.round(x + rx * s), Math.round(y + ry * s), Math.round(w * s), Math.round(h * s));
  };
  const body = '#c8a038';
  r(1, 13, 28, 2, '#000000', 0.25);
  r(0, 4, 30, 9, INK);
  r(1, 7, 28, 5, body);
  r(1, 11, 28, 1, shade(body, -0.3));
  r(6, 1, 15, 7, INK);
  r(7, 2, 13, 5, body);
  r(7, 2, 13, 1, shade(body, 0.25));
  r(8, 3, 4, 3, '#88b8d8');
  r(13, 3, 6, 3, '#88b8d8');
  r(8, 3, 1, 3, '#d83838');
  r(9, 3, 1, 3, '#f0c030');
  r(10, 3, 1, 3, '#2c9c4c');
  // Grover y tú adentro (cabezas).
  r(14, 3, 2, 2, lookOf('grover').hair);
  r(15, 4.5, 1, 1, lookOf('grover').skin);
  r(11, 3, 2, 2, playerLook().hair);
  // La llamita del tablero, cabeceando.
  const nod = Math.sin(t * 9) > 0 ? 0 : 0.5;
  r(18, 3.5 + nod, 1.2, 2, '#f4f0e6');
  r(13, 7, 6, 4, '#8a8e98');
  r(3, 9, 2, 1, '#8a5428');
  r(24, 8, 1, 2, '#8a5428');
  r(28, 7, 2, 2, '#fff6a0');
  r(0, 7, 2, 2, '#7a2a2a');
  r(27, 11, 3, 1, '#a8acb4');
  r(4, 10, 6, 5, INK);
  r(5, 11, 4, 3, '#5a5e68');
  r(20, 10, 6, 5, INK);
  r(21, 11, 4, 3, '#2a2a30');
  // Rayos de las ruedas que giran.
  const spin = Math.floor(t * 20) % 2;
  r(6 + spin, 12, 1, 1, '#c8ccd4');
  r(22 + spin, 12, 1, 1, '#c8ccd4');
}

const groverCarro: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#f8b078'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#e88868'), 1).fillRect(x, y + 30, w, 20);
    g.fillStyle(hex('#5a5c66'), 1).fillRect(x, y + 80, w, h - 80);
  });
  const city = addG(kit, stage);
  const road = addG(kit, stage);
  const car = addG(kit, stage);
  const smoke: Array<{ x: number; y: number; t: number }> = [];
  const puff = addG(kit, stage);
  let t = 0;
  kit.every(50, () => {
    t += 0.05;
    city.clear();
    for (let i = 0; i < 12; i++) {
      const bx = ((i * 40 - t * 30) % 480) - 20;
      const x = bx < -40 ? bx + 480 : bx;
      city.fillStyle(hex(['#c0684a', '#e8d4a0', '#b0b8c8'][i % 3]), 1).fillRect(Math.round(x), 40 + (i % 3) * 6, 30, 40 - (i % 3) * 6);
      // Palmas del separador.
      const px = ((i * 55 - t * 60) % 660) - 30;
      const pxx = px < -60 ? px + 660 : px;
      city.fillStyle(hex('#6a4a30'), 1).fillRect(Math.round(pxx), 56, 2, 26);
      city.fillStyle(hex('#3c9c48'), 1).fillRect(Math.round(pxx) - 6, 54, 14, 3);
    }
    road.clear();
    for (let i = 0; i < 12; i++) {
      const lx = ((i * 30 - t * 120) % 360) + (i * 30 - t * 120 < 0 ? 360 : 0);
      road.fillStyle(hex('#f0f0e8'), 1).fillRect(Math.round(lx % 240) - 10, 94, 12, 2);
    }
    car.clear();
    const bump = Math.round(Math.abs(Math.sin(t * 7)) * 2);
    groverCar(car, 60, 54 - bump, 3, t);
    if (Math.random() < 0.4) smoke.push({ x: 58, y: 84, t: 0 });
    puff.clear();
    for (const s of smoke) {
      s.t += 0.05;
      puff.fillStyle(0x6a6a70, Math.max(0, 0.6 - s.t * 0.5)).fillCircle(s.x - s.t * 40, s.y - s.t * 8, 3 + s.t * 6);
    }
    while (smoke.length > 0 && smoke[0].t > 1.2) smoke.shift();
  });
  kit.every(420, () => floatNote(kit, stage, 110 + Math.random() * 40, 50, '#f0d048'));
  kit.every(1600, () => popText(kit, stage, 170, 26, ['¡Morenada!', '¡Pi-pi-pi-pííí!', 'clonc clonc'][Math.floor(Math.random() * 3)], '#ffffff', 8, 800));
};

// ---------------------------------------------------------------------------
// La piscina
// ---------------------------------------------------------------------------

function poolBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(hex('#141a2c'), 1).fillRect(x, y, w, h);
  for (const lx of [30, 110, 190]) {
    g.fillStyle(hex('#6a6e78'), 1).fillRect(x + lx, y + 4, 2, 30);
    g.fillStyle(hex('#fff6c8'), 1).fillRect(x + lx - 4, y + 2, 10, 4);
  }
  g.fillStyle(hex('#d8d4c8'), 1).fillRect(x, y + 60, w, 6);
  g.fillStyle(hex('#2a8ad0'), 1).fillRect(x, y + 66, w, h - 66);
  for (let i = 0; i < 18; i++) g.fillStyle(hex('#5cbcf0'), 1).fillRect(x + ((i * 37) % w), y + 70 + ((i * 13) % 34), 6, 1);
}

/** El panzazo: te subes al partidor, te tiras de clavado... y caes de guata. ¡PLAF! */
const panzazo: VinetaBuilder = (kit) => {
  const stage = kit.framed(poolBackdrop);
  const board = addG(kit, stage);
  // El partidor del carril 4, en el borde.
  outlined(board, [[0, 56, 40, 10, '#d8d4c8'], [24, 44, 16, 12, '#f4f4f0'], [24, 52, 16, 4, '#2050a8']]);
  board.fillStyle(hex('#202028'), 1).fillRect(30, 46, 4, 5);
  const me = { ...playerLook(), shirt: playerLook().skin, pants: SWIM_TRUNKS, extras: [] as HumanLook['extras'] };
  const fig = side(kit, stage, me, 24, 44, { dir: 1, scale: 0.8, eyes: 'open' });
  const splash = addG(kit, stage);
  const run = (): void => {
    fig.body.setRotation(0).setPosition(24, 44 - 45).setVisible(true);
    fig.arm.setRotation(0).setPosition(24, 44 - 45).setVisible(true);
    splash.clear();
    kit.progress(
      1300,
      (t) => {
        // Se agacha en el partidor, salta y vuela en arco, girando hasta quedar acostado.
        const x = t < 0.3 ? 24 : lerp(24, 140, (t - 0.3) / 0.7);
        const y = t < 0.3 ? -1 + Math.round(t * 10) : Math.round(2 - Math.sin(((t - 0.3) / 0.7) * Math.PI) * 26 + ((t - 0.3) / 0.7) * 44);
        const rot = t < 0.3 ? 0 : ((t - 0.3) / 0.7) * (Math.PI / 2);
        fig.body.setPosition(x, y).setRotation(rot);
        fig.arm.setPosition(x, y).setRotation(rot);
      },
      () => {
        fig.body.setVisible(false);
        fig.arm.setVisible(false);
        popText(kit, stage, 150, 40, '¡PLAF!', '#ffffff', 16, 900);
        kit.progress(
          900,
          (q) => {
            splash.clear();
            for (let i = 0; i < 16; i++) {
              const a = Math.PI * (i / 15);
              const r = q * 34;
              splash.fillStyle(0xe8f8ff, 1 - q).fillRect(Math.round(150 + Math.cos(a) * r), Math.round(70 - Math.sin(a) * r * 1.2), 3, 3);
            }
            splash.lineStyle(2, 0xffffff, 1 - q).strokeEllipse(150, 74, 20 + q * 50, 6 + q * 8);
          },
          () => {
            // Asoma la guata colorada flotando.
            splash.clear();
            splash.fillStyle(hex('#e86a5a'), 1).fillEllipse(150, 72, 18, 6);
            popText(kit, stage, 150, 58, 'auuu...', '#ffd0d0', 8, 900);
            kit.after(1200, run);
          },
        );
      },
      'Linear',
    );
  };
  run();
  kit.every(1700, () => popText(kit, stage, 196, 16, '¡PRRRT!', '#f0c030', 8, 500));
};

/** Después del Marco Polo: los dos envueltos en toallas, arrugados como pasas, tiritando. */
const piscinaToallas: VinetaBuilder = (kit) => {
  const stage = kit.framed(poolBackdrop);
  const g = addG(kit, stage);
  const figs = addG(kit, stage);
  let t = 0;
  kit.every(70, () => {
    t += 0.07;
    figs.clear();
    const sh = Math.round(Math.sin(t * 40));
    // Tú, con toalla amarilla; Grover, con una toalla de llamas (claro).
    bust(figs, { ...playerLook(), shirt: '#f0c030' }, 76 + sh, 48, 3.6, { mouth: 'teeth', eyes: 'squint' });
    bust(figs, { ...lookOf('grover'), shirt: '#e84868' }, 146 - sh, 48, 3.6, { mouth: 'open' });
    // Rayitas de frío.
    for (const cx of [56, 96, 126, 166]) figs.fillStyle(0xffffff, 0.8).fillRect(cx, 44 + (Math.floor(t * 8) % 2) * 2, 3, 1);
  });
  g.fillStyle(hex('#f4f0e6'), 1).fillRect(0, 0, 0, 0);
  const winner = StoryState.hasFlag('m5_marco_gane') ? 'GANADOR: ¡TÚ!' : StoryState.hasFlag('m5_marco_perdi') ? 'GANADOR: GROVER' : 'GANADOR: NADIE';
  popText(kit, stage, 110, 98, winner, '#f0d048', 10, 0);
  kit.every(1100, () => popText(kit, stage, 110, 14, ['brrr...', 'achís', 'mis dedos parecen pasas'][Math.floor(Math.random() * 3)], '#ffffff', 7, 700));
};

const antiparras: VinetaBuilder = (kit) => {
  const stage = kit.framed(poolBackdrop);
  const kid = addG(kit, stage);
  let t = 0;
  kit.every(60, () => {
    t += 0.06;
    kid.clear();
    const hop = Math.round(Math.abs(Math.sin(t * 6)) * 8);
    bust(kid, lookOf('nino_piscina'), 110, 50 - hop, 4, { mouth: 'grin' });
    // Las gafas puestas.
    kid.fillStyle(hex('#2050a8'), 1).fillRect(90, 46 - hop, 40, 2);
    outlined(kid, [[96, 44 - hop, 10, 7, '#58c8f0'], [114, 44 - hop, 10, 7, '#58c8f0']]);
  });
  kit.every(300, () => sparkle(kit, stage, 80 + Math.random() * 60, 20 + Math.random() * 40));
  popText(kit, stage, 110, 98, '¡GRACIAS!', '#f0d048', 10, 0);
};

// ---------------------------------------------------------------------------
// Sira
// ---------------------------------------------------------------------------

/**
 * La salida de las piscinas, de noche: Sira (chiquitita, pelo mojado en moño, toalla amarilla) y tú, de lado.
 * Se miran, ella desvía la mirada y se pone colorada. Corazones, pero discretos: uno a la vez, chiquitos.
 */
const sira: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#141a2c'), 1).fillRect(x, y, w, h);
    // El coliseo de carpa blanca al fondo, con sus mástiles de luz, y unas palmas.
    for (let i = 0; i < 4; i++) g.fillStyle(hex('#e8e4dc'), 1).fillTriangle(x + 30 + i * 40, y + 60, x + 50 + i * 40, y + 30, x + 70 + i * 40, y + 60);
    g.fillStyle(hex('#cfc9be'), 1).fillRect(x + 30, y + 52, 160, 8);
    for (const lx of [64, 110, 156]) {
      g.fillStyle(hex('#e8e8f0'), 1).fillRect(x + lx, y + 2, 2, 50);
      g.fillStyle(hex('#fff6c8'), 1).fillRect(x + lx - 5, y, 12, 5);
      g.fillStyle(0xfff6c8, 0.07).fillTriangle(x + lx - 5, y + 5, x + lx + 7, y + 5, x + lx + 30, y + 70);
    }
    for (const px of [12, 204]) {
      g.fillStyle(hex('#6a5a48'), 1).fillRect(x + px, y + 30, 3, 34);
      g.fillStyle(hex('#3a5a40'), 1).fillRect(x + px - 8, y + 26, 19, 6);
    }
    g.fillStyle(hex('#e8e2d0'), 1).fillRect(x, y + 64, w, 4);
    g.fillStyle(hex('#b8b2a4'), 1).fillRect(x, y + 68, w, h - 68);
  });
  const floor = 100;
  const me = playerLook();
  const siraLook = lookOf('sira');
  side(kit, stage, me, 66, floor, { dir: 1, scale: 1, eyes: 'open' });
  const her = side(kit, stage, { ...siraLook, extras: [] }, 128, floor, { dir: -1, scale: 0.84, eyes: 'open' });
  // La toalla amarilla al hombro.
  const towel = addG(kit, stage);
  outlined(towel, [[136, floor - 34, 6, 18, '#f0c030']]);
  flat(towel, [[136, floor - 30, 6, 1, '#e84868'], [136, floor - 22, 6, 1, '#e84868']]);
  // Gotitas del pelo mojado.
  kit.every(700, () => {
    const d = addG(kit, stage, 140, floor - 50);
    d.fillStyle(0xa8e0ff, 1).fillRect(0, 0, 1, 2);
    kit.progress(600, (q) => d.setPosition(140, Math.round(floor - 50 + q * 14)).setAlpha(1 - q), () => d.destroy());
  });
  // Ella desvía la mirada (se da vuelta un ratito) y se sonroja.
  const blush = addG(kit, stage);
  let look = 0;
  kit.every(1600, () => {
    look++;
    const away = look % 3 === 1;
    her.body.setScale(away ? -1 : 1, 1).setX(away ? 128 + 17 : 128);
    her.arm.setScale(away ? -1 : 1, 1).setX(away ? 128 + 17 : 128);
    blush.clear();
    if (away) blush.fillStyle(hex('#f08098'), 0.9).fillRect(134, floor - 41, 2, 1);
  });
  kit.every(2100, () => floatHeart(kit, stage, 96 + Math.round(Math.random() * 20), 40));
  kit.every(1300, () => sparkle(kit, stage, 60 + Math.random() * 100, 10 + Math.random() * 30));
};

/** La puerta de Pance Burger: entra Sira y los dos se reconocen. ¡!¡! */
const siraSorpresa: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    for (let row = 0; row < h; row += 6) for (let i = row % 12 ? -6 : 0; i < w; i += 12) g.fillStyle(hex(row % 12 ? '#a8503a' : '#7c3424'), 1).fillRect(x + i, y + row, 11, 5);
    g.fillStyle(hex('#4c2c18'), 1).fillRect(x + 140, y + 20, 50, 70);
    g.fillStyle(hex('#1a2040'), 1).fillRect(x + 144, y + 24, 42, 66);
    g.fillStyle(hex('#6a4228'), 1).fillRect(x, y + 90, w, h - 90);
    // El neón de la hamburguesa.
    g.fillStyle(hex('#f8a838'), 1).fillRect(x + 30, y + 10, 30, 6).fillRect(x + 30, y + 22, 30, 5);
    g.fillStyle(hex('#58e070'), 1).fillRect(x + 30, y + 17, 30, 2);
    g.fillStyle(hex('#e85a48'), 1).fillRect(x + 30, y + 19, 30, 3);
  });
  side(kit, stage, playerLook(), 70, 92, { dir: 1, scale: 1, eyes: 'open' });
  const her = side(kit, stage, lookOf('sira_noche'), 150, 92, { dir: -1, scale: 0.84, eyes: 'open' });
  kit.progress(600, (t) => (her.body.setX(lerp(176, 150, t)), her.arm.setX(lerp(176, 150, t))), undefined, 'Cubic.Out');
  kit.after(650, () => {
    popText(kit, stage, 80, 18, '!', '#f8e070', 18, 0);
    popText(kit, stage, 158, 26, '!', '#f8e070', 18, 0);
  });
  kit.after(1200, () => popText(kit, stage, 118, 8, '¿¡TÚ!?', '#ffffff', 10, 0));
  kit.every(900, () => sparkle(kit, stage, 100 + Math.random() * 40, 30 + Math.random() * 20));
};

// ---------------------------------------------------------------------------
// Pance Burger
// ---------------------------------------------------------------------------

function tableBackdrop(g: G, x: number, y: number, w: number, h: number): void {
  for (let row = 0; row < 50; row += 6) for (let i = row % 12 ? -6 : 0; i < w; i += 12) g.fillStyle(hex(row % 12 ? '#a8503a' : '#7c3424'), 1).fillRect(x + i, y + row, 11, 5);
  for (let i = 10; i < w; i += 40) g.fillStyle(hex('#f8d878'), 1).fillCircle(x + i, y + 6, 2);
  g.fillStyle(hex('#a87040'), 1).fillRect(x, y + 70, w, h - 70);
  g.fillStyle(hex('#c8905c'), 1).fillRect(x, y + 70, w, 2);
}

const hamburguesa: VinetaBuilder = (kit) => {
  const stage = kit.framed(tableBackdrop);
  const g = addG(kit, stage);
  const calena = StoryState.hasFlag('m5_caleña');
  let bites = 0;
  const draw = (): void => {
    g.clear();
    // Plato y papas criollas.
    g.fillStyle(hex('#f4f4f0'), 1).fillEllipse(110, 92, 150, 22);
    for (let i = 0; i < 9; i++) disc(g, 150 + (i % 3) * 9, 82 + Math.floor(i / 3) * 4, 4, '#f0c030');
    const layers: Array<[number, string]> = [
      [10, '#e8a040'],
      [3, '#68c048'],
      [3, '#f8d030'],
      ...(calena ? ([[4, '#f0b848'], [3, '#f8e070']] as Array<[number, string]>) : []),
      [9, '#7a3a20'],
      [3, '#e84838'],
      [7, '#d88830'],
    ];
    let y = 34;
    for (const [hh, c] of layers) {
      outlined(g, [[60, y, 80, hh, c]]);
      y += hh;
    }
    // Semillas del pan.
    for (const [sx, sy] of [[74, 37], [90, 36], [106, 38], [120, 36]] as const) g.fillStyle(hex('#f8e8b8'), 1).fillRect(sx, sy, 3, 1);
    // Mordiscos: semicírculos del color del fondo.
    for (let b = 0; b < bites; b++) {
      disc(g, 140, 44 + b * 10, 9, '#a87040');
    }
    // Una gota de salsa que chorrea.
    g.fillStyle(hex('#e84838'), 1).fillRect(80, y - 2, 2, 4 + (Date.now() / 200) % 4);
  };
  draw();
  kit.every(1300, () => {
    bites = (bites + 1) % 4;
    if (bites > 0) popText(kit, stage, 156, 30, '¡ÑAM!', '#ffffff', 9, 600);
    draw();
  });
  kit.every(400, () => {
    const s = addG(kit, stage, 90 + Math.random() * 30, 30);
    s.fillStyle(0xffffff, 0.5).fillRect(0, 0, 1, 5);
    kit.progress(900, (q) => s.setY(30 - q * 16).setAlpha(0.6 - q * 0.6), () => s.destroy());
  });
  if (calena) popText(kit, stage, 110, 14, 'LA CALEÑA: maduro + piña', '#f8e070', 8, 0);
};

/** El Equipo 5 en la mesa larga: el profe, Vale con su cronograma, Camilo barajando y un puesto vacío. */
const equipo: VinetaBuilder = (kit) => {
  const stage = kit.framed(tableBackdrop);
  const people: Array<{ id: string; x: number; name: string }> = [
    { id: 'profe_julian', x: 36, name: 'Profe Julián' },
    { id: 'valentina', x: 84, name: 'Vale' },
    { id: 'camilo', x: 132, name: 'Camilo' },
  ];
  const faces = addG(kit, stage);
  const extra = addG(kit, stage);
  let t = 0;
  kit.every(90, () => {
    t += 0.09;
    faces.clear();
    for (const [i, p] of people.entries()) bust(faces, lookOf(p.id), p.x, 52 + Math.round(Math.sin(t * 3 + i) * 1), 3.2, { mouth: Math.floor(t * 4 + i) % 3 === 0 ? 'open' : 'smile' });
    // El puesto vacío (S. Martínez llega tarde).
    faces.fillStyle(0xffffff, 0.15).fillRect(166, 32, 28, 40);
    extra.clear();
    // El cronograma de Vale (barras de colores) y las cartas de Camilo.
    outlined(extra, [[68, 76, 34, 20, '#2a2a30']]);
    for (let k = 0; k < 4; k++) extra.fillStyle(hex(['#e84848', '#f0c030', '#3cae5c', '#2f6fd0'][k]), 1).fillRect(70 + k * 3, 79 + k * 4, 12 + (k % 2) * 6, 3);
    const sh = Math.round(Math.sin(t * 10) * 3);
    outlined(extra, [[124 + sh, 80, 10, 14, '#f8f6ee'], [130 - sh, 80, 10, 14, '#e84848']]);
  });
  people.forEach((p, i) => kit.after(300 + i * 500, () => popText(kit, stage, p.x, 16, p.name, '#f8e070', 8, 0)));
  kit.after(1900, () => popText(kit, stage, 180, 20, '¿S. Martínez?', '#ffffff', 8, 0));
};

/** El Instagram de Sira en tu celular (la app Fotogram): Seguir → Siguiendo, y un corazón en tu foto. */
const insta: VinetaBuilder = (kit) => {
  const stage = kit.framed(tableBackdrop);
  const phone = addG(kit, stage);
  outlined(phone, [[70, 4, 80, 100, '#1c1c24']]);
  flat(phone, [[74, 10, 72, 88, '#fbfaf6'], [100, 6, 20, 2, '#3a3a44']]);
  // Cabecera de la app.
  stage.add(makeText(kit.scene, 78, 13, 'Fotogram', { fontSize: '8px', fontStyle: '700', color: INK }));
  const avatar = addG(kit, stage);
  disc(avatar, 88, 32, 10, '#e8a0b8');
  bust(avatar, lookOf('sira_noche'), 88, 31, 1.15, { mouth: 'smile' });
  stage.add(makeText(kit.scene, 102, 24, '@sira.mtz', { fontSize: '8px', fontStyle: '600', color: INK }));
  stage.add(makeText(kit.scene, 102, 34, '214 fotos', { fontSize: '6px', color: '#7a7488' }));
  stage.add(makeText(kit.scene, 78, 46, 'Nado, como, estudio.', { fontSize: '6px', color: INK }));
  const btn = addG(kit, stage);
  const label = makeText(kit.scene, 110, 62, 'Seguir', { fontSize: '8px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5);
  stage.add(btn);
  btn.fillStyle(hex('#2f6fd0'), 1).fillRoundedRect(80, 56, 60, 12, 3);
  stage.add(label);
  // Mini grilla de fotos (piscina, una hamburguesa, Cali).
  const grid = addG(kit, stage);
  const colors = ['#2a8ad0', '#f0a030', '#3cae5c', '#e84868', '#58c8f0', '#c0684a'];
  for (let i = 0; i < 6; i++) grid.fillStyle(hex(colors[i]), 1).fillRect(76 + (i % 3) * 23, 74 + Math.floor(i / 3) * 11, 21, 9);
  kit.after(900, () => {
    btn.clear().fillStyle(hex('#d8d8dc'), 1).fillRoundedRect(80, 56, 60, 12, 3);
    label.setText('Siguiendo').setColor(INK);
    sparkle(kit, stage, 140, 56);
  });
  kit.after(1700, () => {
    const note = addG(kit, stage);
    outlined(note, [[154, 30, 62, 22, '#ffffff']]);
    disc(note, 162, 41, 4, '#e84868');
    stage.add(makeText(kit.scene, 168, 34, 'sira.mtz le\ngustó tu foto', { fontSize: '6px', color: INK }));
    floatHeart(kit, stage, 162, 30);
  });
  kit.every(900, () => floatHeart(kit, stage, 60 + Math.random() * 8, 70));
};

/** Buenas noches: en la cama, a oscuras, con la cara iluminada por el celular. */
const buenasNoches: VinetaBuilder = (kit) => {
  const stage = kit.framed((g, x, y, w, h) => {
    g.fillStyle(hex('#1a1e30'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex('#2a3048'), 1).fillRect(x + 150, y + 10, 50, 40);
    g.fillStyle(hex('#3a4462'), 1).fillRect(x + 154, y + 14, 42, 32);
    disc(g, x + 182, y + 26, 6, '#f8f0c8');
    disc(g, x + 184, y + 24, 5, '#3a4462');
    g.fillStyle(hex('#5a3a30'), 1).fillRect(x + 20, y + 70, 130, 10);
    g.fillStyle(hex('#9cc0e8'), 1).fillRect(x + 24, y + 58, 120, 14);
    g.fillStyle(hex('#f4f0e6'), 1).fillRect(x + 26, y + 54, 26, 10);
  });
  const face = addG(kit, stage);
  const glow = addG(kit, stage);
  let t = 0;
  kit.every(80, () => {
    t += 0.08;
    face.clear();
    bust(face, playerLook(), 44, 50, 2.4, { mouth: 'teeth', eyes: Math.sin(t) > 0.8 ? 'closed' : 'open' });
    glow.clear();
    glow.fillStyle(0xbfe0ff, 0.25 + Math.sin(t * 2) * 0.05).fillTriangle(66, 40, 46, 30, 46, 64);
    outlined(glow, [[64, 38, 8, 14, '#1c1c24']]);
    glow.fillStyle(hex('#bfe0ff'), 1).fillRect(65, 40, 6, 10);
  });
  kit.after(500, () => {
    const b = addG(kit, stage);
    outlined(b, [[80, 14, 120, 28, '#ffffff']]);
    stage.add(makeText(kit.scene, 84, 17, 'Sira: Llegaste bien? Jueves 7pm\nen la piscina. Sin Marco Polo.\nBueno, un poquito.', { fontSize: '6px', color: INK }));
  });
  kit.every(1000, () => floatHeart(kit, stage, 76, 44));
  kit.every(1400, () => floatZ(kit, stage, 30, 40));
};

export const M5_VINETAS_2: Record<string, VinetaBuilder> = {
  m5_grover: grover,
  m5_pavo_llaves: pavoLlaves,
  m5_grover_carro: groverCarro,
  m5_panzazo: panzazo,
  m5_piscina_toallas: piscinaToallas,
  m5_antiparras: antiparras,
  m5_sira: sira,
  m5_sira_sorpresa: siraSorpresa,
  m5_hamburguesa: hamburguesa,
  m5_equipo: equipo,
  m5_insta: insta,
  m5_buenas_noches: buenasNoches,
};
