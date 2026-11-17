import type Phaser from 'phaser';
import type { HumanLook } from './characters';
import { shade } from './palette';
import { hex } from './vinetas';
import { bust, INK, type BustOpts } from './vinetas_m5';

/**
 * Arte de los minijuegos del paseo a La Vorágine (PaseoScene, misión 10 / prefijo m11_): cuerpos enteros de frente,
 * cielos en degradé, cordilleras, selva y guaduas que se mecen, agua con brillos que corren, rocas con musgo y un
 * sistema chico de partículas (salpicaduras, polvo, neblina, luciérnagas). Todo con Graphics, a 320 × 180.
 */

type G = Phaser.GameObjects.Graphics;

// ---------------------------------------------------------------------------
// Cuerpos
// ---------------------------------------------------------------------------

export type Pose = 'quieto' | 'arriba' | 'salto' | 'camina' | 'agacha' | 'mano_der' | 'mano_izq' | 'lanza' | 'cana';

export interface CuerpoOpts extends BustOpts {
  pose?: Pose;
  /** Cuadro de la caminata (0/1). */
  paso?: number;
  /** Pelo mojado (gotas). */
  mojado?: boolean;
  /** Dibuja solo de la cintura para arriba (en el agua). */
  medio?: boolean;
  /** Mirando para el lado (voltea los brazos de la pose). */
  flip?: boolean;
}

/** ¿Va en traje de baño? (las hojas *_bano usan zapatos color piel). */
export function enBano(look: HumanLook): boolean {
  return look.shoes === look.skin;
}

/** El jugador en traje de baño (sin jockey ni mochila). */
export function deBano(look: HumanLook, trunks = '#2f6fd0'): HumanLook {
  if (enBano(look)) return look;
  const hair = look.hairStyle === 'cap' ? 'short' : look.hairStyle;
  return { ...look, shirt: look.skin, pants: trunks, shoes: look.skin, hairStyle: hair, cap: undefined, extras: (look.extras ?? []).filter((e) => e === 'glasses' || e === 'freckles' || e === 'beard' || e === 'mustache') };
}

/**
 * Cuerpo entero de frente a escala `s`, con el centro de la cara en (cx, cy) (igual que `bust`). Mide unas
 * 40 unidades de alto: la cara de -6 a 6, el torso de 12 a 20, las piernas de 24 a 33.
 */
export function cuerpo(g: G, look: HumanLook, cx: number, cy: number, s: number, o: CuerpoOpts = {}): void {
  const r = (x: number, y: number, w: number, h: number, c: string, a = 1): void => {
    g.fillStyle(hex(c), a).fillRect(Math.round(cx + x * s), Math.round(cy + y * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
  };
  const bano = enBano(look);
  const heavy = look.build === 'heavy';
  const tw = heavy ? 9 : 7;
  const sleeve = bano ? look.skin : look.shirt;
  const leg = bano ? look.skin : look.pants;
  const feet = look.shoes ?? '#2a2a34';
  const pose = o.pose ?? 'quieto';
  const flip = o.flip ? -1 : 1;
  const step = o.paso ?? 0;

  // Piernas (no en el agua).
  if (!o.medio) {
    if (pose === 'salto') {
      r(-tw, 22, 6, 6, INK);
      r(tw - 6, 22, 6, 6, INK);
      r(-tw + 1, 22, 4, 5, leg);
      r(tw - 5, 22, 4, 5, leg);
      r(-tw - 1, 27, 5, 2, feet);
      r(tw - 4, 27, 5, 2, feet);
    } else if (pose === 'agacha') {
      r(-tw, 20, 6, 7, INK);
      r(tw - 6, 20, 6, 7, INK);
      r(-tw + 1, 20, 4, 6, leg);
      r(tw - 5, 20, 4, 6, leg);
      r(-tw, 26, 5, 2, feet);
      r(tw - 5, 26, 5, 2, feet);
    } else {
      const lA = pose === 'camina' && step === 1 ? -1 : 0;
      const lB = pose === 'camina' && step === 0 ? -1 : 0;
      r(-6, 23, 6, 10 + lA, INK);
      r(0, 23, 6, 10 + lB, INK);
      r(-5, 23, 4, 9 + lA, leg);
      r(1, 23, 4, 9 + lB, leg);
      r(-5.5, 32 + lA, 5, 2, feet);
      r(0.5, 32 + lB, 5, 2, feet);
    }
  }
  // Torso y cadera.
  r(-tw - 1, 11, tw * 2 + 2, 10, INK);
  r(-tw, 11, tw * 2, 9, look.shirt);
  if (bano && look.shirt === look.skin) {
    // Sin camiseta: el ombligo y la sombra del pecho.
    r(-tw + 2, 13, tw * 2 - 4, 1, shade(look.skin, -0.12));
    r(-0.5, 17, 1, 1, shade(look.skin, -0.3));
  }
  if (bano && look.shirt !== look.skin) {
    // Traje de una pieza o bikini: la piel del estómago.
    r(-tw + 1, 16, tw * 2 - 2, 2, look.skin);
  }
  if (!o.medio) {
    r(-tw - 1, 19, tw * 2 + 2, 5, INK);
    r(-tw, 19, tw * 2, 4, look.pants);
  }
  // Brazos.
  const armDown = (side: -1 | 1): void => {
    const x = side < 0 ? -tw - 4 : tw + 1;
    r(x, 11, 4, 11, INK);
    r(x + 1, 11, 2, 9, sleeve);
    r(x + 1, 19, 2, 2, look.skin);
  };
  const armUp = (side: -1 | 1): void => {
    const x = side < 0 ? -tw - 4 : tw + 1;
    r(x, -3, 4, 15, INK);
    r(x + 1, -2, 2, 13, sleeve);
    r(x + 1, -3, 2, 2, look.skin);
  };
  const armOut = (side: -1 | 1, len = 9): void => {
    const x = side < 0 ? -tw - len - 1 : tw;
    r(x, 11, len + 1, 4, INK);
    r(side < 0 ? x + 1 : x, 12, len, 2, sleeve);
    r(side < 0 ? x : x + len - 1, 12, 2, 2, look.skin);
  };
  if (pose === 'arriba' || pose === 'salto') {
    armUp(-1);
    armUp(1);
  } else if (pose === 'mano_der' || pose === 'mano_izq') {
    const side = (pose === 'mano_der' ? 1 : -1) * flip;
    armOut(side as -1 | 1);
    armDown((-side) as -1 | 1);
  } else if (pose === 'lanza') {
    armOut(flip as -1 | 1, 11);
    armUp((-flip) as -1 | 1);
  } else if (pose === 'cana') {
    armOut(flip as -1 | 1, 7);
    armOut(flip as -1 | 1, 5);
  } else if (pose === 'camina') {
    armDown(-1);
    armDown(1);
    r(step === 0 ? -tw - 3 : tw + 1, 18, 2, 2, look.skin);
  } else {
    armDown(-1);
    armDown(1);
  }
  bust(g, look, Math.round(cx), Math.round(cy), s, o);
  if (o.mojado) {
    r(-5, -3, 1, 2, '#bfe8f8');
    r(4, -2, 1, 2, '#bfe8f8');
    r(-1, -7, 1, 1, '#e8f8f4');
  }
}

/** Mano de piel (un cuadrito con contorno) entre dos puntos: los dos de la mano. */
export function manos(g: G, x1: number, y1: number, x2: number, y2: number, skin: string, s = 2): void {
  g.lineStyle(s + 2, hex(INK), 1).lineBetween(x1, y1, x2, y2);
  g.lineStyle(s, hex(skin), 1).lineBetween(x1, y1, x2, y2);
}

// ---------------------------------------------------------------------------
// Cielo, cerros y selva
// ---------------------------------------------------------------------------

function mix(a: string, b: string, k: number): number {
  const A = hex(a);
  const B = hex(b);
  const ch = (v: number, sh: number): number => (v >> sh) & 255;
  const m = (sh: number): number => Math.round(ch(A, sh) + (ch(B, sh) - ch(A, sh)) * k);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

export function mixColor(a: string, b: string, k: number): number {
  return mix(a, b, Math.max(0, Math.min(1, k)));
}

/** Cielo en degradé por bandas (pixel art). */
export function cielo(g: G, x: number, y: number, w: number, h: number, top: string, low: string, bands = 9): void {
  const bh = Math.ceil(h / bands);
  for (let i = 0; i < bands; i++) g.fillStyle(mix(top, low, i / (bands - 1)), 1).fillRect(x, y + i * bh, w, bh + 1);
}

/** Nubes que pasan lento. */
export function nubes(g: G, w: number, t: number, y: number, n = 4, alpha = 0.9, speed = 4): void {
  for (let i = 0; i < n; i++) {
    const cx = ((i * 97 + t * speed * (1 + (i % 2) * 0.4)) % (w + 80)) - 40;
    const cy = y + (i % 3) * 7;
    const s = 1 + (i % 2) * 0.4;
    g.fillStyle(0xffffff, alpha).fillEllipse(cx, cy, 30 * s, 7 * s).fillEllipse(cx + 8 * s, cy - 3 * s, 16 * s, 8 * s).fillEllipse(cx - 7 * s, cy - 1, 14 * s, 6 * s);
    g.fillStyle(0xd8e4ec, alpha * 0.7).fillEllipse(cx + 2, cy + 2 * s, 26 * s, 3 * s);
  }
}

/** Una cordillera dentada (los Farallones) desde `base` hacia arriba. */
export function cordillera(g: G, x: number, w: number, base: number, height: number, color: string, seed = 1, snow = false): void {
  const pts: Phaser.Types.Math.Vector2Like[] = [{ x, y: base }];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const v = Math.sin(k * 7.1 + seed) * 0.35 + Math.sin(k * 17.3 + seed * 2.1) * 0.18 + Math.sin(k * 3.1 + seed * 0.7) * 0.4;
    pts.push({ x: x + k * w, y: base - height * (0.55 + v * 0.55) });
  }
  pts.push({ x: x + w, y: base });
  g.fillStyle(hex(color), 1).fillPoints(pts, true);
  // Luz en las laderas.
  g.fillStyle(hex(shade(color, 0.12)), 1);
  for (let i = 1; i < pts.length - 2; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if ((a.y ?? 0) > (b.y ?? 0)) g.fillTriangle(a.x ?? 0, a.y ?? 0, b.x ?? 0, b.y ?? 0, b.x ?? 0, (b.y ?? 0) + 8);
  }
  if (snow) for (let i = 1; i < pts.length - 1; i++) if ((pts[i].y ?? 0) < base - height * 0.85) g.fillStyle(0xf4f8fc, 0.8).fillCircle(pts[i].x ?? 0, (pts[i].y ?? 0) + 2, 3);
}

/** Copas de árbol en fila (selva), con algo de vaivén. */
export function selva(g: G, x: number, w: number, y: number, color: string, size = 12, seed = 0, t = 0, density = 1): void {
  const step = Math.max(4, Math.round(size * 0.9 / density));
  const light = hex(shade(color, 0.16));
  const dark = hex(shade(color, -0.18));
  for (let i = -size; i < w + size; i += step) {
    const k = (i * 13 + seed * 31) % 17;
    const r = size * (0.7 + (k % 5) * 0.1);
    const sway = Math.sin(t * 1.3 + i * 0.07 + seed) * 1.2;
    const cx = x + i + sway;
    const cy = y + ((k * 7) % 6) - 2;
    g.fillStyle(dark, 1).fillCircle(cx, cy + 2, r);
    g.fillStyle(hex(color), 1).fillCircle(cx, cy, r * 0.92);
    g.fillStyle(light, 1).fillCircle(cx - r * 0.3, cy - r * 0.35, r * 0.4);
  }
  g.fillStyle(hex(color), 1).fillRect(x, y + 2, w, size);
}

/** Una guadua: caña verde con nudos y hojas arriba; `sway` la mece. */
export function guadua(g: G, x: number, y: number, h: number, sway = 0, color = '#7cbc4c'): void {
  const top = x + sway;
  g.lineStyle(3, hex(shade(color, -0.25)), 1).lineBetween(x + 1, y, top + 1, y - h);
  g.lineStyle(2, hex(color), 1).lineBetween(x, y, top, y - h);
  for (let k = 8; k < h; k += 9) {
    const px = x + (sway * k) / h;
    g.fillStyle(hex(shade(color, -0.35)), 1).fillRect(px - 1, y - k, 3, 1);
  }
  g.fillStyle(hex('#5aa04a'), 1).fillEllipse(top - 6, y - h + 2, 14, 4).fillEllipse(top + 6, y - h + 4, 14, 4).fillEllipse(top, y - h - 2, 8, 5);
}

/** Un helecho: hojas en abanico. */
export function helecho(g: G, x: number, y: number, s = 1, color = '#3c8c3c', t = 0): void {
  const c = hex(color);
  const l = hex(shade(color, 0.2));
  for (let i = -3; i <= 3; i++) {
    const ang = -Math.PI / 2 + i * 0.38 + Math.sin(t * 1.6 + x) * 0.05;
    const len = (14 - Math.abs(i) * 2) * s;
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len;
    g.lineStyle(Math.max(1, s * 1.5), c, 1).lineBetween(x, y, ex, ey);
    for (let k = 0.3; k < 1; k += 0.2) g.fillStyle(l, 1).fillRect(x + (ex - x) * k - 1, y + (ey - y) * k, 2 * s, 1);
  }
}

/** Una roca grande con luz, sombra y musgo. */
export function roca(g: G, cx: number, cy: number, w: number, h: number, color = '#8c867c', moss = true): void {
  g.fillStyle(hex(INK), 1).fillEllipse(cx, cy + 1, w + 2, h + 2);
  g.fillStyle(hex(shade(color, -0.22)), 1).fillEllipse(cx, cy, w, h);
  g.fillStyle(hex(color), 1).fillEllipse(cx - w * 0.06, cy - h * 0.1, w * 0.86, h * 0.76);
  g.fillStyle(hex(shade(color, 0.22)), 1).fillEllipse(cx - w * 0.2, cy - h * 0.25, w * 0.35, h * 0.25);
  if (moss) g.fillStyle(hex('#4a7c3c'), 1).fillEllipse(cx + w * 0.18, cy - h * 0.36, w * 0.3, h * 0.14);
}

/** Agua con brillos que corren hacia `dir` (1 derecha, -1 izquierda). */
export function agua(g: G, x: number, y: number, w: number, h: number, t: number, color = '#2a7c94', dir = 1, speed = 24): void {
  g.fillStyle(hex(color), 1).fillRect(x, y, w, h);
  g.fillStyle(hex(shade(color, 0.1)), 1).fillRect(x, y, w, Math.min(4, h));
  const rows = Math.max(1, Math.floor(h / 5));
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < Math.ceil(w / 40) + 1; i++) {
      const off = (i * 40 + r * 17 + dir * t * speed * (1 + (r % 3) * 0.2)) % (w + 40);
      const px = x + ((off + w + 40) % (w + 40)) - 20;
      const len = 6 + ((i + r) % 3) * 4;
      g.fillStyle(0xe8f8f4, 0.35 + ((i + r) % 2) * 0.25).fillRect(px, y + 2 + r * 5 + ((i * 3) % 3), len, 1);
    }
  }
}

/** Una tecla con su anillo de tiempo (la letra va en un texto aparte). */
export function tecla(g: G, cx: number, cy: number, k: number, color: number, pressed = false): void {
  // Anillo que se cierra (k: 1 → 0).
  g.lineStyle(2, 0x14182a, 0.85).strokeCircle(cx, cy, 16);
  if (k > 0) {
    g.lineStyle(2, k < 0.3 ? 0xe85a64 : 0xf8e070, 1);
    g.beginPath();
    g.arc(cx, cy, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, false);
    g.strokePath();
  }
  g.fillStyle(0x14182a, 1).fillRoundedRect(cx - 10, cy - 10 + (pressed ? 1 : 0), 20, 20, 4);
  g.fillStyle(color, 1).fillRoundedRect(cx - 9, cy - 9 + (pressed ? 2 : 0), 18, 16, 3);
  g.fillStyle(0xffffff, 0.25).fillRect(cx - 7, cy - 8 + (pressed ? 2 : 0), 14, 2);
}

// ---------------------------------------------------------------------------
// Partículas
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: number;
  size: number;
  grav: number;
  /** Se achica al morir. */
  shrink: boolean;
  /** Forma: cuadrado o círculo. */
  round: boolean;
  /** Opacidad máxima. */
  alpha: number;
}

export class Particles {
  private list: Particle[] = [];

  clear(): void {
    this.list = [];
  }

  get count(): number {
    return this.list.length;
  }

  add(p: Partial<Particle> & { x: number; y: number }): void {
    const max = p.max ?? p.life ?? 1;
    this.list.push({ vx: 0, vy: 0, life: 1, color: 0xffffff, size: 2, grav: 0, shrink: true, round: false, alpha: 1, ...p, max });
    if (this.list.length > 600) this.list.shift();
  }

  /** Una salpicadura (o polvo) en abanico. */
  burst(x: number, y: number, n: number, color: number, speed = 60, grav = 160, life = 0.7, size = 2, up = true): void {
    for (let i = 0; i < n; i++) {
      const a = up ? -Math.PI / 2 + (Math.random() - 0.5) * 2.2 : Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      const l = life * (0.6 + Math.random() * 0.6);
      this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: l, max: l, color, size: size * (0.6 + Math.random() * 0.8), grav, round: Math.random() < 0.5 });
    }
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(g: G): void {
    for (const p of this.list) {
      const k = Math.max(0, p.life / p.max);
      const s = Math.max(1, p.shrink ? p.size * (0.4 + 0.6 * k) : p.size);
      g.fillStyle(p.color, Math.min(1, k * 1.6) * p.alpha);
      if (p.round) g.fillCircle(p.x, p.y, s / 2 + 0.5);
      else g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.ceil(s), Math.ceil(s));
    }
  }
}
