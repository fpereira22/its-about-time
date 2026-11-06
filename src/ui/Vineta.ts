import Phaser from 'phaser';
import type { HumanLook } from '../art/characters';
import { characterLook } from '../art/SpriteRegistry';
import {
  DRAWING_H,
  DRAWING_LABELS,
  DRAWING_W,
  drawAirportBackdrop,
  drawBrotherDrawing,
  drawSideArm,
  drawSideBody,
  eyeOffset,
  FIGURE_H,
  TEAR_COLOR,
  type SideFigureOpts,
} from '../art/vinetas';
import { AUTO_VINETAS } from '../art/vinetas_auto';
import { CALI_VINETAS } from '../art/vinetas_cali';
import { CALI_VINETAS_2 } from '../art/vinetas_cali_2';
import { FUTBOL_VINETAS } from '../art/vinetas_futbol';
import { M5_VINETAS } from '../art/vinetas_m5';
import { M5_VINETAS_2 } from '../art/vinetas_m5_2';
import { M6_VINETAS } from '../art/vinetas_m6';
import { M6_VINETAS_2 } from '../art/vinetas_m6_2';
import { LIVE_VINETAS, M6_CHAT_VINETAS } from '../art/vinetas_m6_chat';
import { M6_VINETAS_3 } from '../art/vinetas_m6_3';
import { M7_VINETAS } from '../art/vinetas_m7';
import { M7_VINETAS_2 } from '../art/vinetas_m7_2';
import { CALLE_VINETAS } from '../art/vinetas_calle';
import { CASA_VINETAS } from '../art/vinetas_casa';
import { COMIDA_VINETAS } from '../art/vinetas_comida';
import { PIEZA_VINETAS } from '../art/vinetas_pieza';
import { VUELO_VINETAS } from '../art/vinetas_vuelo';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/display';
import { EventSystem } from '../systems/EventSystem';
import { playerLook } from '../systems/PlayerLook';
import { drawPanel, makeText } from './theme';

/** Encima del HUD (40) y debajo de la caja de diálogo (100). */
const DEPTH = 90;
const PANEL = { x: 50, y: 8, w: 220, h: 108 } as const;
const WALK_MS = 750;
const SWAY_MS = 700;
const FADE_MS = 160;

// ---------------------------------------------------------------------------
// Registro de viñetas: id → builder. Para agregar viñetas de otra misión, se escribe un
// `Record<string, VinetaBuilder>` en src/art/vinetas_<lugar>.ts y se suma a VINETAS.
// ---------------------------------------------------------------------------

/** Fondo de una viñeta, dibujado en coordenadas locales del panel (x, y = 0, 0). */
export type Backdrop = (g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) => void;

/** Lo que recibe cada viñeta para armarse. Los timers y tweens que pida aquí se cortan solos al cerrarla. */
export interface VinetaKit {
  readonly scene: Phaser.Scene;
  /** Panel de la viñeta, en px de pantalla. */
  readonly panel: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** Contenedor raíz (ya con el velo oscuro): para lo que va fuera del marco (ej. el dibujo del hermano). */
  readonly root: Phaser.GameObjects.Container;
  /**
   * Dibuja el marco con su fondo y devuelve el escenario: un contenedor con origen en la esquina del
   * panel (coordenadas locales 0..w × 0..h), recortado al marco.
   */
  framed(backdrop: Backdrop): Phaser.GameObjects.Container;
  /** Llama `fn` una vez después de `ms`. */
  after(ms: number, fn: () => void): void;
  /** Llama `fn` cada `ms` hasta que se cierre la viñeta. */
  every(ms: number, fn: () => void): void;
  /** Tween normal de Phaser (se detiene al cerrar). */
  tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween;
  /** Avanza `t` de 0 a 1 en `ms` (para trayectorias a mano: arcos, vaivenes). */
  progress(ms: number, onUpdate: (t: number) => void, onComplete?: () => void, ease?: string): Phaser.Tweens.Tween;
}

export type VinetaBuilder = (kit: VinetaKit) => void;

/** Quién sale en un abrazo: hacia dónde mira, su tamaño, dónde termina y cada cuánto le cae una lágrima. */
interface CastMember {
  who: 'player' | 'mama' | 'papa' | 'hermano';
  dir: 1 | -1;
  scale: number;
  /** Borde izquierdo de la figura al abrazarse, relativo al centro del panel. */
  x: number;
  /** Desde dónde llega caminando (px hacia afuera). */
  from: number;
  /** Ms entre lágrimas (sin valor: no llora). */
  cry?: number;
  /** Se dibuja delante de los brazos de los demás (el hermano chico: si no, un brazo le tapa la cara). */
  front?: boolean;
}

interface HugDef {
  /** En orden de dibujo: los primeros quedan atrás. */
  cast: CastMember[];
  hearts?: boolean;
}

/** Abrazos de la despedida (misión 3). La caja de diálogo cuenta lo que pasa; la viñeta lo muestra. */
const HUGS: Record<string, HugDef> = {
  abrazo_papa: {
    cast: [
      { who: 'player', dir: 1, scale: 1, x: -18, from: -30 },
      { who: 'papa', dir: -1, scale: 1.08, x: -2, from: 30, cry: 1300 },
    ],
  },
  abrazo_hermano: {
    cast: [
      { who: 'player', dir: 1, scale: 1, x: -16, from: -30 },
      { who: 'hermano', dir: -1, scale: 0.72, x: -1, from: 30, cry: 260, front: true },
    ],
  },
  abrazo_mama: {
    hearts: true,
    cast: [
      { who: 'player', dir: 1, scale: 1, x: -18, from: -30, cry: 420 },
      { who: 'mama', dir: -1, scale: 0.95, x: -2, from: 30, cry: 300 },
    ],
  },
  abrazo_familia: {
    hearts: true,
    cast: [
      { who: 'papa', dir: 1, scale: 1.08, x: -30, from: -40 },
      { who: 'mama', dir: 1, scale: 0.95, x: -15, from: -34, cry: 340 },
      { who: 'player', dir: -1, scale: 1, x: 3, from: 34, cry: 480 },
      { who: 'hermano', dir: 1, scale: 0.72, x: -8, from: -26, cry: 300, front: true },
    ],
  },
};

/** Todas las viñetas del juego. */
const VINETAS: Record<string, VinetaBuilder> = {
  ...Object.fromEntries(Object.entries(HUGS).map(([id, def]) => [id, (kit: VinetaKit) => buildHug(kit, def)])),
  dibujo: buildDrawing,
  ...CASA_VINETAS,
  ...PIEZA_VINETAS,
  ...AUTO_VINETAS,
  ...VUELO_VINETAS,
  ...CALLE_VINETAS,
  ...COMIDA_VINETAS,
  ...CALI_VINETAS,
  ...CALI_VINETAS_2,
  ...FUTBOL_VINETAS,
  ...M5_VINETAS,
  ...M5_VINETAS_2,
  ...M6_VINETAS,
  ...M6_VINETAS_2,
  ...M6_VINETAS_3,
  ...M6_CHAT_VINETAS,
  ...M7_VINETAS,
  ...M7_VINETAS_2,
};

/** Ids de viñeta válidos (para el efecto `vineta` de los diálogos). */
export const VINETA_IDS = Object.keys(VINETAS);

function lookOf(who: CastMember['who']): HumanLook {
  return who === 'player' ? playerLook() : (characterLook(who) as HumanLook);
}

/**
 * Viñeta: una escena 2D, sobre el juego y bajo la caja de diálogo, que acompaña un diálogo
 * (efecto `{ "vineta": "<id>" }`). Se cierra sola cuando termina ese diálogo, o con `{ "vineta": "" }`.
 */
export class Vineta {
  private root: Phaser.GameObjects.Container | null = null;
  private currentId = '';
  private timers: Phaser.Time.TimerEvent[] = [];
  private tweens: Phaser.Tweens.Tween[] = [];

  /**
   * `standalone`: la usa otra escena directamente (el partido), sin escuchar los eventos de los diálogos.
   * `onShow` recibe el contenedor raíz recién armado (ej. para que la cámara del mundo lo ignore).
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: { standalone?: boolean; onShow?: (root: Phaser.GameObjects.Container) => void } = {},
  ) {
    if (opts.standalone) return;
    EventSystem.onScene(scene, 'vineta', (id) => (id ? this.show(id) : this.hide()));
    EventSystem.onScene(scene, 'dialogue-close', () => this.hide());
  }

  get isOpen(): boolean {
    return this.root !== null;
  }

  show(id: string): void {
    // Una viñeta en vivo (el chat) que ya está abierta sigue como está: no se rearma.
    if (this.root && id === this.currentId && LIVE_VINETAS.has(id)) return;
    this.destroy();
    this.currentId = id;
    const build = VINETAS[id];
    if (!build) {
      console.error(`Viñeta "${id}" no existe (hay: ${VINETA_IDS.join(', ')})`);
      return;
    }
    const root = this.scene.add.container(0, 0).setDepth(DEPTH).setAlpha(0);
    this.root = root;
    root.add(this.scene.add.rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0x000000, 0.35).setOrigin(0));
    build(this.kit(root));
    this.opts.onShow?.(root);
    this.scene.tweens.add({ targets: root, alpha: 1, duration: FADE_MS });
  }

  hide(): void {
    const root = this.root;
    if (!root) return;
    this.stopTimers();
    this.root = null;
    this.scene.tweens.add({ targets: root, alpha: 0, duration: FADE_MS, onComplete: () => root.destroy() });
  }

  private destroy(): void {
    this.stopTimers();
    this.root?.destroy();
    this.root = null;
  }

  private stopTimers(): void {
    for (const t of this.timers) t.remove();
    for (const t of this.tweens) t.remove();
    this.timers = [];
    this.tweens = [];
  }

  private kit(root: Phaser.GameObjects.Container): VinetaKit {
    const scene = this.scene;
    const track = (t: Phaser.Tweens.Tween): Phaser.Tweens.Tween => {
      this.tweens.push(t);
      return t;
    };
    return {
      scene,
      panel: PANEL,
      root,
      framed: (backdrop) => {
        const frame = scene.add.graphics();
        drawPanel(frame, PANEL.x - 3, PANEL.y - 3, PANEL.w + 6, PANEL.h + 6, { radius: 6 });
        const bg = scene.add.graphics({ x: PANEL.x, y: PANEL.y });
        backdrop(bg, 0, 0, PANEL.w, PANEL.h);
        root.add([frame, bg]);
        const stage = scene.add.container(PANEL.x, PANEL.y);
        const mask = scene.make.graphics({}, false).fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
        stage.setMask(mask.createGeometryMask());
        // El fondo también va recortado: así puede dibujar cerros o nubes que se salgan del marco.
        bg.setMask(mask.createGeometryMask());
        root.add(stage);
        return stage;
      },
      after: (ms, fn) => {
        this.timers.push(scene.time.delayedCall(ms, fn));
      },
      every: (ms, fn) => {
        this.timers.push(scene.time.addEvent({ delay: ms, loop: true, callback: fn }));
      },
      tween: (config) => track(scene.tweens.add(config)),
      progress: (ms, onUpdate, onComplete, ease = 'Linear') =>
        track(
          scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: ms,
            ease,
            onUpdate: (tw) => onUpdate(tw.getValue() ?? 0),
            onComplete: () => onComplete?.(),
          }),
        ),
    };
  }
}

// ---------------------------------------------------------------------------
// Misión 3: abrazos y el dibujo del hermano
// ---------------------------------------------------------------------------

function buildHug(kit: VinetaKit, def: HugDef): void {
  const { scene, panel } = kit;
  // Todo lo que se mece durante el abrazo va en `stage`, recortado al marco.
  const stage = kit.framed(drawAirportBackdrop);

  const cx = Math.round(panel.w / 2);
  const floor = panel.h - 6;
  const figures = def.cast.map((c) => {
    const look = lookOf(c.who);
    const opts: SideFigureOpts = { dir: c.dir, scale: c.scale, eyes: 'open' };
    const top = Math.round(floor - FIGURE_H * c.scale);
    const endX = Math.round(cx + c.x);
    const body = scene.add.graphics({ x: endX + c.from, y: top });
    const arm = scene.add.graphics({ x: endX + c.from, y: top });
    drawSideBody(body, look, opts);
    drawSideArm(arm, look, opts, false);
    return { c, look, opts, top, endX, body, arm };
  });
  // Primero todos los cuerpos y encima los brazos: cada uno abraza por encima de la espalda del otro.
  // Los que van al frente (el hermano chico) se dibujan al final, cuerpo y brazo.
  const back = figures.filter((f) => !f.c.front);
  const front = figures.filter((f) => f.c.front);
  stage.add(back.map((f) => f.body));
  stage.add(back.map((f) => f.arm));
  stage.add(front.flatMap((f) => [f.body, f.arm]));

  // Llegan caminando (un saltito por paso) y se abrazan.
  for (const f of figures) {
    kit.tween({
      targets: [f.body, f.arm],
      x: f.endX,
      duration: WALK_MS,
      ease: 'Sine.InOut',
      onUpdate: (tween) => {
        const bob = Math.floor(tween.progress * 6) % 2;
        f.body.setPosition(Math.round(f.body.x), f.top - bob);
        f.arm.setPosition(Math.round(f.arm.x), f.top - bob);
      },
    });
  }
  kit.after(WALK_MS, () => {
    for (const f of figures) {
      f.opts.eyes = 'closed';
      f.body.clear().setPosition(f.endX, f.top);
      f.arm.clear().setPosition(f.endX, f.top);
      drawSideBody(f.body, f.look, f.opts);
      drawSideArm(f.arm, f.look, f.opts, true);
      if (f.c.cry) startTears(kit, stage, f.endX, f.top, f.opts, f.c.cry);
    }
    const y0 = stage.y;
    kit.tween({
      targets: stage,
      y: y0 + 1,
      duration: SWAY_MS,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
      onUpdate: () => stage.setY(Math.round(stage.y)),
    });
    if (def.hearts) startHearts(kit, stage, cx, floor - FIGURE_H - 4);
  });
}

/** Lágrimas que caen del ojo de una figura. */
function startTears(kit: VinetaKit, stage: Phaser.GameObjects.Container, x: number, y: number, opts: SideFigureOpts, every: number): void {
  const eye = eyeOffset(opts);
  kit.every(every, () => {
    const drop = kit.scene.add.rectangle(x + eye.x, y + eye.y + 1, 1, 2, TEAR_COLOR).setOrigin(0);
    stage.add(drop);
    kit.tween({
      targets: drop,
      y: drop.y + 12,
      x: drop.x - opts.dir,
      alpha: 0,
      duration: 800,
      onComplete: () => drop.destroy(),
    });
  });
}

/** Corazoncitos que suben sobre las cabezas. */
function startHearts(kit: VinetaKit, stage: Phaser.GameObjects.Container, cx: number, y: number): void {
  kit.every(650, () => {
    const heart = kit.scene.add.graphics({ x: Math.round(cx - 12 + Math.random() * 24), y: y + 8 });
    heart.fillStyle(0xe8607a, 1).fillRect(0, 0, 2, 1).fillRect(3, 0, 2, 1).fillRect(0, 1, 5, 1).fillRect(1, 2, 3, 1).fillRect(2, 3, 1, 1);
    stage.add(heart);
    kit.tween({
      targets: heart,
      y: heart.y - 18,
      alpha: 0,
      duration: 1400,
      onUpdate: () => heart.setY(Math.round(heart.y)),
      onComplete: () => heart.destroy(),
    });
  });
}

/** El dibujo del hermano, pegado con cinta: los nombres y «VUELVE PRONTO» con la N al revés. */
function buildDrawing(kit: VinetaKit): void {
  const { scene, root } = kit;
  const px = Math.round((BASE_WIDTH - DRAWING_W) / 2);
  const py = 10;
  const paper = scene.add.container(0, 24);
  const g = scene.add.graphics();
  drawBrotherDrawing(g, px, py);
  paper.add(g);
  for (const l of DRAWING_LABELS) {
    paper.add(makeText(scene, px + l.x, py + l.y, l.text, { fontSize: '8px', color: '#2a2433' }).setOrigin(0.5));
  }
  // Letras de lápiz rojo; la N, como la escribió él: al revés.
  const style = { fontSize: '12px', color: '#d83838', fontStyle: '600' };
  const parts = ['VUELVE PRO', 'N', 'TO'].map((t) => makeText(scene, 0, 0, t, style));
  parts[1].setFlipX(true);
  const total = parts.reduce((w, t) => w + t.width, 0);
  let x = px + DRAWING_W / 2 - total / 2;
  for (const t of parts) {
    t.setPosition(Math.round(x), py + DRAWING_H - 17);
    x += t.width;
  }
  paper.add(parts);
  root.add(paper);
  kit.tween({ targets: paper, y: 0, duration: 280, ease: 'Back.Out', onUpdate: () => paper.setY(Math.round(paper.y)) });
}
