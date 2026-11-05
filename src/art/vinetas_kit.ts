import Phaser from 'phaser';
import type { VinetaKit } from '../ui/Vineta';
import { makeText } from '../ui/theme';
import { hex } from './vinetas';

/**
 * Ayudas de dibujo y efectos chicos compartidos por las viñetas de src/art/vinetas_<lugar>.ts
 * (contornos, brillitos, corazones, "Zzz" y textos que saltan).
 */

export type G = Phaser.GameObjects.Graphics;
export type Layer = Phaser.GameObjects.Container;
export type Part = [x: number, y: number, w: number, h: number, color: string];
export interface Pt {
  x: number;
  y: number;
}

export const INK = '#2a2433';

/** Rectángulos con contorno: primero todos los contornos y después los rellenos (piezas unidas por dentro). */
export function outlined(g: G, parts: Part[], ox = 0, oy = 0): void {
  g.fillStyle(hex(INK), 1);
  for (const [x, y, w, h] of parts) g.fillRect(ox + x - 1, oy + y - 1, w + 2, h + 2);
  for (const [x, y, w, h, c] of parts) g.fillStyle(hex(c), 1).fillRect(ox + x, oy + y, w, h);
}

/** Rectángulos sin contorno (detalles). */
export function flat(g: G, parts: Part[], ox = 0, oy = 0): void {
  for (const [x, y, w, h, c] of parts) g.fillStyle(hex(c), 1).fillRect(ox + x, oy + y, w, h);
}

export const lerp = (a: number, b: number, t: number): number => Math.round(a + (b - a) * t);

/** Agrega un Graphics a una capa, en (x, y). */
export function addG(kit: VinetaKit, layer: Layer, x = 0, y = 0): G {
  const g = kit.scene.add.graphics({ x, y });
  layer.add(g);
  return g;
}

/** Brillito de cuatro puntas que crece y se apaga. */
export function sparkle(kit: VinetaKit, layer: Layer, x: number, y: number): void {
  const g = addG(kit, layer, x, y);
  [1, 2, 3, 2, 1].forEach((s, i) =>
    kit.after(i * 70, () => {
      g.clear().fillStyle(0xffffff, 1).fillRect(-s, 0, s * 2 + 1, 1).fillRect(0, -s, 1, s * 2 + 1);
      g.fillStyle(hex('#fff2a0'), 1).fillRect(0, 0, 1, 1);
    }),
  );
  kit.after(5 * 70, () => g.destroy());
}

/** Corazoncito que sube y se desvanece. */
export function floatHeart(kit: VinetaKit, layer: Layer, x: number, y: number): void {
  const heart = addG(kit, layer, x, y);
  heart.fillStyle(0xe8607a, 1).fillRect(0, 0, 2, 1).fillRect(3, 0, 2, 1).fillRect(0, 1, 5, 1).fillRect(1, 2, 3, 1).fillRect(2, 3, 1, 1);
  kit.progress(1400, (t) => heart.setPosition(x + Math.round(Math.sin(t * 6) * 2), Math.round(y - 18 * t)).setAlpha(1 - t), () => heart.destroy());
}

/** Una "z" de sueño que sube en diagonal, crece un poco y se desvanece. */
export function floatZ(kit: VinetaKit, layer: Layer, x: number, y: number, color = '#dce4f8'): void {
  const z = makeText(kit.scene, x, y, 'z', { fontSize: '7px', fontStyle: '600', color }).setOrigin(0.5);
  layer.add(z);
  kit.progress(
    1600,
    (t) => z.setPosition(Math.round(x + t * 8 + Math.sin(t * 7) * 1.5), Math.round(y - t * 14)).setScale(1 + t * 0.5).setAlpha(t < 0.7 ? 1 : (1 - t) / 0.3),
    () => z.destroy(),
  );
}

/** Texto que salta (¡click!, ¡PUM!): aparece grande, se asienta y se queda `ms` (0 = para siempre). */
export function popText(kit: VinetaKit, layer: Layer, x: number, y: number, text: string, color: string, size = 10, ms = 900): Phaser.GameObjects.Text {
  const t = makeText(kit.scene, x, y, text, { fontSize: `${size}px`, fontStyle: '600', color, stroke: INK, strokeThickness: 2 }).setOrigin(0.5);
  layer.add(t);
  t.setScale(1.6);
  kit.tween({ targets: t, scale: 1, duration: 180, ease: 'Back.Out' });
  if (ms > 0) {
    kit.after(ms, () => kit.tween({ targets: t, alpha: 0, y: y - 4, duration: 260, onUpdate: () => t.setY(Math.round(t.y)), onComplete: () => t.destroy() }));
  }
  return t;
}

/** Rayitas de vibración a los lados de algo (cajita de `w` × `h` con esquina en x, y); `on` las prende o apaga. */
export function drawShakeLines(g: G, x: number, y: number, w: number, h: number, on: boolean, color = INK): void {
  g.clear();
  if (!on) return;
  const my = Math.round(y + h / 2);
  g.fillStyle(hex(color), 1);
  for (const dy of [-5, 0, 5]) {
    g.fillRect(x - 6 - Math.abs(dy) / 5, my + dy, 3, 1);
    g.fillRect(x + w + 3 + Math.abs(dy) / 5, my + dy, 3, 1);
  }
}

/**
 * Dígito de 7 segmentos (reloj digital) de `w` × `h`, con trazo `t`. Los segmentos apagados se ven tenues.
 * `digit` = 0..9, o -1 para dibujar solo los segmentos apagados.
 */
const SEGMENTS = ['abcedf', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];

export function seg7(g: G, x: number, y: number, digit: number, color: string, off: string, w = 8, h = 14, t = 2): void {
  const on = digit >= 0 ? SEGMENTS[digit] : '';
  const mid = Math.round(y + h / 2 - t / 2);
  const rects: Record<string, [number, number, number, number]> = {
    a: [x + t, y, w - 2 * t, t],
    b: [x + w - t, y + t, t, mid - y - t],
    c: [x + w - t, mid + t, t, y + h - t - mid - t],
    d: [x + t, y + h - t, w - 2 * t, t],
    e: [x, mid + t, t, y + h - t - mid - t],
    f: [x, y + t, t, mid - y - t],
    g: [x + t, mid, w - 2 * t, t],
  };
  for (const [k, [rx, ry, rw, rh]] of Object.entries(rects)) {
    g.fillStyle(hex(on.includes(k) ? color : off), 1).fillRect(rx, ry, rw, rh);
  }
}

/** Hora "HH:MM" en 7 segmentos (los dos puntos parpadean con `colon`). Mide 4 dígitos + 6 px de los dos puntos. */
export function clockDigits(g: G, x: number, y: number, hhmm: string, color: string, off: string, colon = true, w = 8, h = 14, t = 2): void {
  const digits = hhmm.replace(':', '').split('').map(Number);
  const gap = 2;
  let cx = x;
  digits.forEach((d, i) => {
    seg7(g, cx, y, d, color, off, w, h, t);
    cx += w + gap;
    if (i === 1) {
      g.fillStyle(hex(colon ? color : off), 1).fillRect(cx, y + Math.round(h * 0.28), t, t).fillRect(cx, y + Math.round(h * 0.65), t, t);
      cx += t + gap;
    }
  });
}

/** Ancho total de `clockDigits`. */
export function clockWidth(w = 8, t = 2): number {
  return 4 * w + 3 * 2 + t + 2;
}
