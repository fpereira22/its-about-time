import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { EventSystem } from '../systems/EventSystem';
import { StoryState } from '../systems/StoryState';
import { TouchControls } from '../systems/TouchControls';
import { drawPanel, makeText, THEME } from './theme';

/**
 * Tutorial del Prólogo: una guía chiquita abajo de la pantalla que enseña los controles de a uno, mientras
 * el jugador camina por Providencia. La activa el diálogo de inicio (flag `tutorial_pendiente`); cada paso
 * hecho queda en un flag `tut_<n>`, así que cargar una partida retoma donde iba. Las partidas anteriores
 * no tienen el flag y no ven nada.
 */

/** Lo que la UI le cuenta cada cuadro: qué panel hay abierto y si el jugador anda libre. */
export interface TutorialProbe {
  phoneOpen: boolean;
  inventoryOpen: boolean;
  menuOpen: boolean;
  /** Sin diálogo, viñeta, viaje ni transición: se puede mostrar la guía. */
  free: boolean;
  /** Tile del jugador (para saber si ya caminó). */
  tileX: number;
  tileY: number;
}

interface Step {
  /** Texto de cada paso: en pantallas táctiles se nombran los botones en vez de las teclas. */
  title: string;
  keys: string;
  touchKeys: string;
  text: string;
  touchText: string;
}

const STEPS: Step[] = [
  {
    title: 'MOVERTE',
    keys: 'W A S D',
    touchKeys: 'CRUCETA',
    text: 'Camina un poquito por la vereda (también sirven las flechas).',
    touchText: 'Arrastra la cruceta para caminar por la vereda.',
  },
  {
    title: 'HABLAR Y REVISAR',
    keys: 'E',
    touchKeys: 'BOTÓN E',
    text: 'Párate frente a la señora o el cartel y presiona E.',
    touchText: 'Párate frente a la señora o el cartel y toca E.',
  },
  {
    title: 'TU MOCHILA',
    keys: 'TAB',
    touchKeys: 'BOLSO',
    text: 'Abre el inventario: ahí ves tus cosas y tu plata.',
    touchText: 'Toca BOLSO para ver tus cosas y tu plata.',
  },
  {
    title: 'TU CELULAR',
    keys: 'Q',
    touchKeys: 'CELU',
    text: 'Ábrelo: tu mamá te escribió. También trae mapa y el Bip.',
    touchText: 'Toca CELU: tu mamá te escribió. También trae mapa y el Bip.',
  },
  {
    title: 'PAUSA Y GUARDAR',
    keys: 'ESC',
    touchKeys: 'MENÚ',
    text: 'Abre el menú: ahí guardas la partida y ajustas el sonido.',
    touchText: 'Toca MENÚ para guardar la partida y ajustar el sonido.',
  },
];

const FLAG_ON = 'tutorial_pendiente';
const FLAG_DONE = 'tutorial_hecho';
const stepFlag = (i: number): string => `tut_${i}`;

/** Hasta aquí camina el paso 1: tres tiles desde donde estaba. */
const WALK_TILES = 3;

export class Tutorial {
  private box: Phaser.GameObjects.Container | null = null;
  private shownStep = -1;
  private walkFrom: { x: number; y: number } | null = null;
  private talked = false;
  private finishing = false;

  constructor(private readonly scene: Phaser.Scene) {
    EventSystem.onScene(scene, 'dialogue-open', () => {
      if (this.current() === 1) this.talked = true;
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hide());
  }

  /** ¿Sigue el tutorial en curso? */
  get active(): boolean {
    return StoryState.hasFlag(FLAG_ON) && !StoryState.hasFlag(FLAG_DONE);
  }

  /** Índice del paso actual (el primero sin flag), o STEPS.length si ya hizo todos. */
  private current(): number {
    if (!this.active) return -1;
    let i = 0;
    while (i < STEPS.length && StoryState.hasFlag(stepFlag(i))) i++;
    return i;
  }

  update(p: TutorialProbe): void {
    if (this.finishing) return;
    const step = this.current();
    if (step < 0) return this.hide();
    if (step >= STEPS.length) return this.finish();

    // Los pasos de paneles se cumplen apenas el panel abre (aunque la guía esté oculta detrás).
    if (step === 2 && p.inventoryOpen) return this.complete(step);
    if (step === 3 && p.phoneOpen) return this.complete(step);
    if (step === 4 && p.menuOpen) return this.complete(step);

    if (!p.free) return this.hide();

    if (step === 0) {
      this.walkFrom ??= { x: p.tileX, y: p.tileY };
      const dist = Math.abs(p.tileX - this.walkFrom.x) + Math.abs(p.tileY - this.walkFrom.y);
      if (dist >= WALK_TILES) return this.complete(step);
    }
    if (step === 1 && this.talked) return this.complete(step);
    // Quien ya se alejó mucho del inicio no necesita que le expliquen a caminar.
    if (step === 0 && p.tileX > 40) return this.complete(step);

    this.show(step);
  }

  private complete(step: number): void {
    StoryState.setFlag(stepFlag(step));
    playSfx('select');
    this.hide();
    this.talked = false;
  }

  private finish(): void {
    this.finishing = true;
    StoryState.setFlag(FLAG_DONE);
    EventSystem.emit('banner', { title: '¡Listo!', subtitle: 'Ahora sigue Providencia al oriente, hasta el Costanera' });
    this.hide();
  }

  private show(step: number): void {
    if (this.box && this.shownStep === step) return;
    this.hide();
    this.shownStep = step;
    const s = STEPS[step];
    const touch = TouchControls.enabled;
    const scene = this.scene;

    const keys = makeText(scene, 0, 0, touch ? s.touchKeys : s.keys, {
      fontFamily: FONT_HUD,
      fontSize: '8px',
      color: THEME.ink,
      backgroundColor: '#e9e2d2',
      padding: { x: 4, y: 2 },
    }).setOrigin(0, 0);
    const title = makeText(scene, 0, 0, `TUTORIAL ${step + 1}/${STEPS.length} · ${s.title}`, {
      fontFamily: FONT_HUD,
      fontSize: '7px',
      color: '#b8c4e0',
    });
    const body = makeText(scene, 0, 0, touch ? s.touchText : s.text, {
      fontSize: '8px',
      color: THEME.white,
      wordWrap: { width: 182 },
    });

    const w = 200;
    const h = 20 + body.height + 8;
    const bg = scene.add.graphics();
    drawPanel(bg, 0, 0, w, h, { radius: 5, fill: THEME.dark, edge: 0x0a0e18, alpha: 0.94 });
    const accent = scene.add.graphics().fillStyle(THEME.accent, 1).fillRect(6, 15, w - 12, 1);
    title.setPosition(8, 5);
    body.setPosition(9, 20);
    keys.setPosition(w - keys.width - 6, 3);
    const box = scene.add.container((BASE_WIDTH - w) / 2, BASE_HEIGHT + 4, [bg, accent, title, body, keys]).setDepth(120);
    this.box = box;
    scene.tweens.add({ targets: box, y: BASE_HEIGHT - h - 6, duration: 260, ease: 'Back.Out' });
    // La tecla late un poco para llamar la atención.
    scene.tweens.add({ targets: keys, alpha: 0.55, duration: 520, yoyo: true, repeat: -1 });
  }

  private hide(): void {
    const box = this.box;
    this.shownStep = -1;
    if (!box) return;
    this.box = null;
    box.destroy();
  }
}
