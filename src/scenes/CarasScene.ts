import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/display';
import { Controls } from '../systems/Controls';
import { FaceCam } from '../systems/FaceCam';
import {
  advanceHold,
  FACE_CHALLENGES,
  pickChallenges,
  PASS_SCORE,
  ROUND_MS,
  roundPoints,
  verdict,
  type FaceChallenge,
  type FaceId,
  type Shapes,
} from '../systems/faceChallenges';
import { MiniScene } from './MiniScene';

/**
 * «Concurso de caras»: prueba de admin con la cámara (F2 → Cámara). El jurado pide siete caras (sonrisa, boca
 * abierta, cejas, guiño, besito, mejillas, póker) y hay que hacer cada una y sostenerla un momento, antes de que
 * se acabe el tiempo. Más rápido, más puntos. La cámara se ve a la izquierda, en pixeles, como un espejo.
 *
 * Modo `lab` («Probador de gestos»): sin juego, todos los retos con su puntaje en vivo y los números crudos de
 * MediaPipe. Sirve para ajustar los umbrales de src/systems/faceChallenges.ts.
 *
 * El detector corre en el navegador (src/systems/FaceCam.ts): el video no sale del equipo.
 * E: seguir · Esc: salir (apaga la cámara).
 */

export interface CarasResult {
  /** Puntos totales (máximo 200 por cara). */
  score: number;
  /** Caras logradas. */
  passed: number;
  rounds: number;
  /** Se salió antes de terminar (o no hubo cámara). */
  aborted: boolean;
}

export interface CarasSceneData {
  /** Al terminar. Sin esto vuelve al título. */
  done?: (r: CarasResult) => void;
  /** `lab`: el probador de gestos, sin juego. */
  mode?: 'game' | 'lab';
}

const ROUNDS = 7;
/** Lo que dura el cartel de cada cara antes de empezar a medir (para no arrastrar la anterior). */
const REVEAL_MS = 900;
const END_ROUND_MS = 1000;
/** La cámara en pantalla: 64×48 al doble (128×96 px del juego). */
const CAM = { x: 12, y: 24, cw: 64, ch: 48, scale: 2 };
const CAM_KEY = 'carasCam';
/** Resolución real del canvas de la cámara: 4× la cuadrícula de pixeles, para que la vista nítida se vea bien. */
const CAM_TEX = { w: CAM.cw * 4, h: CAM.ch * 4 };
/** Preferencia de vista (pixeles o nítida), recordada en este navegador. */
const VIEW_KEY = 'santiago-laberinto:cam-pixel';
const RIGHT_X = 158;
const RIGHT_W = 150;

type Phase = 'intro' | 'loading' | 'fail' | 'wait' | 'reveal' | 'round' | 'roundEnd' | 'end' | 'lab';

const INK = 0x2a2433;
const SKIN = 0xf0c08c;
const LIPS = 0xd8505c;

export class CarasScene extends MiniScene<CarasResult> {
  private mode: 'game' | 'lab' = 'game';
  private phase: Phase = 'intro';
  private phaseMs = 0;
  private challenges: FaceChallenge[] = [];
  private round = 0;
  private points = 0;
  private passed = 0;
  private held = 0;
  private timeLeft = ROUND_MS;
  /** Cuánto lleva la cara a la vista en 'wait' (para empezar cuando ya estás). */
  private seenMs = 0;
  private lastScore = 0;
  private lastShapes: Shapes | null = null;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private cam: Phaser.Textures.CanvasTexture | null = null;
  private camNote!: Phaser.GameObjects.Text;
  /** Vista de la cámara: en pixeles (cuadrícula de 64×48) o nítida. */
  private pixelView = readPixelPref();
  /** Cuadro intermedio de 64×48 de donde sale la vista en pixeles. */
  private small: HTMLCanvasElement | null = null;
  private viewChip!: Phaser.GameObjects.Text;
  private titleBig!: Phaser.GameObjects.Text;
  private hintBig!: Phaser.GameObjects.Text;
  private readout!: Phaser.GameObjects.Text;
  private labTexts: Phaser.GameObjects.Text[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  /** El «ponte frente a la cámara» de la espera (se crea al hacer falta). */
  private waitText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('Caras');
  }

  init(data: CarasSceneData): void {
    this.initMini(data.done ?? (() => this.scene.start('Title')));
    this.mode = data.mode ?? 'game';
    this.phase = 'intro';
    this.phaseMs = 0;
    this.challenges = [];
    this.round = 0;
    this.points = 0;
    this.passed = 0;
    this.held = 0;
    this.seenMs = 0;
    this.lastScore = 0;
    this.lastShapes = null;
    this.labTexts = [];
    this.waitText = null;
  }

  create(): void {
    this.g = this.add.graphics().setDepth(1);
    this.hud = this.add.graphics().setDepth(40);
    this.createUi('#2a1838');
    this.drawStage(this.g);

    if (this.textures.exists(CAM_KEY)) this.textures.remove(CAM_KEY);
    this.cam = this.textures.createCanvas(CAM_KEY, CAM_TEX.w, CAM_TEX.h);
    this.small = document.createElement('canvas');
    this.small.width = CAM.cw;
    this.small.height = CAM.ch;
    if (this.cam) this.add.image(CAM.x + 2, CAM.y + 2, CAM_KEY).setOrigin(0, 0).setScale((CAM.cw * CAM.scale) / CAM_TEX.w).setDepth(5);
    // El botón de la vista: tecla F (o el botón F táctil) o un toque/clic sobre la cámara.
    this.viewChip = this.addText(CAM.x + 5, CAM.y + CAM.ch * CAM.scale - 7, '', { fontSize: '8px', fontStyle: '600', color: '#f8e070', stroke: '#14182a', strokeThickness: 3 }).setDepth(9);
    this.add
      .zone(CAM.x + 2, CAM.y + 2, CAM.cw * CAM.scale, CAM.ch * CAM.scale)
      .setOrigin(0, 0)
      .setDepth(9)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleView());
    this.applyView();
    this.camNote = this.addText(CAM.x + 2 + (CAM.cw * CAM.scale) / 2, CAM.y + 2 + (CAM.ch * CAM.scale) / 2, 'CÁMARA APAGADA', { fontSize: '8px', fontStyle: '600', color: '#fbf6ee', align: 'center', stroke: '#14182a', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(8);

    this.titleBig = this.addText(RIGHT_X + RIGHT_W / 2, 84, '', { fontSize: '11px', fontStyle: '600', color: '#f8e070', stroke: '#14182a', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(10);
    this.hintBig = this.addText(RIGHT_X + RIGHT_W / 2, 99, '', { fontSize: '8px', color: '#fbf6ee', align: 'center', wordWrap: { width: RIGHT_W } }).setOrigin(0.5, 0).setDepth(10);
    this.readout = this.addText(CAM.x, CAM.y + CAM.ch * CAM.scale + 8, '', { fontSize: '8px', color: '#9fb0d4', wordWrap: { width: 138 } }).setDepth(10);
    this.scoreText = this.addText(BASE_WIDTH - 6, 4, '', { fontSize: '8px', fontStyle: '600', color: '#fbf6ee' }).setOrigin(1, 0).setDepth(50);

    if (this.mode === 'lab') this.buildLab();
    this.titleText.setText(this.mode === 'lab' ? 'Probador de gestos' : 'Concurso de caras');
    this.hintText.setText(`${this.mode === 'lab' ? '' : 'Haz la cara que pide el jurado · '}F: ver en pixeles o nítida · Esc: salir`);
    playMusic(this.mode === 'lab' ? null : 'feria');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => FaceCam.stop());

    this.banner(
      this.mode === 'lab'
        ? 'Probador de gestos\nUsa tu cámara para ver cada gesto en vivo.\nSolo se usa para jugar: el video no se guarda ni se envía.\n(E: activar la cámara)'
        : 'CONCURSO DE CARAS\nEl jurado te pedirá 7 caras. Hazlas y sostenlas.\nUsa tu cámara solo para jugar: el video no se guarda ni se envía.\n(E: activar la cámara)',
    );
  }

  override update(_t: number, delta: number): void {
    this.tickUi(delta);
    if (this.leaving) return;
    this.phaseMs += delta;
    if (Controls.consume('menu')) return this.exit();
    if (Controls.consume('trick')) this.toggleView();

    switch (this.phase) {
      case 'intro':
      case 'fail':
        if (Controls.consume('interact')) this.activate();
        break;
      case 'wait':
        this.updateWait(delta);
        break;
      case 'reveal':
        this.sample();
        if (this.phaseMs >= REVEAL_MS) this.setPhase('round');
        break;
      case 'round':
        this.updateRound(delta);
        break;
      case 'roundEnd':
        this.sample();
        if (this.phaseMs >= END_ROUND_MS) this.nextRound();
        break;
      case 'end':
        if (this.phaseMs > 500 && Controls.consume('interact')) this.exit(false);
        break;
      case 'lab':
        this.sample();
        break;
      default:
        break;
    }
    this.draw();
  }

  // ─── Cámara ─────────────────────────────────────────────────────────────────────────────────────

  private activate(): void {
    this.hideBanner();
    playSfx('select');
    this.setPhase('loading');
    this.banner('Prendiendo la cámara...\n(la primera vez descarga ~18 MB)');
    void FaceCam.start((step) => {
      if (this.phase !== 'loading') return;
      this.banner(step === 'camera' ? 'Acepta el permiso de la cámara...' : step === 'library' ? 'Descargando el detector de caras...' : 'Cargando el modelo...\n(la primera vez son ~18 MB)');
    }).then(() => {
      if (this.leaving || this.phase !== 'loading') return;
      if (FaceCam.status === 'ready') {
        this.hideBanner();
        if (this.mode === 'lab') this.setPhase('lab');
        else this.setPhase('wait');
        playSfx('open');
        return;
      }
      this.setPhase('fail');
      this.banner(failMessage());
      playSfx('error');
    });
  }

  /** Lee la cara (si hay cámara) y deja el puntaje del reto actual. */
  private sample(): void {
    this.lastShapes = FaceCam.status === 'ready' ? FaceCam.read() : null;
    const ch = this.challenges[this.round];
    this.lastScore = this.lastShapes && ch ? ch.score(this.lastShapes) : 0;
  }

  // ─── Juego ──────────────────────────────────────────────────────────────────────────────────────

  private updateWait(delta: number): void {
    this.sample();
    this.seenMs = this.lastShapes ? this.seenMs + delta : 0;
    if (this.seenMs < 800) return;
    this.challenges = pickChallenges(ROUNDS);
    this.round = 0;
    this.startRound();
  }

  private startRound(): void {
    this.held = 0;
    this.timeLeft = ROUND_MS;
    this.setPhase('reveal');
    playSfx('blip');
  }

  private updateRound(delta: number): void {
    const ch = this.challenges[this.round];
    this.sample();
    this.held = advanceHold(this.held, this.lastScore, delta, ch.holdMs);
    this.timeLeft -= delta;
    if (this.held >= ch.holdMs) {
      const pts = roundPoints(this.timeLeft);
      this.points += pts;
      this.passed++;
      this.float(`¡+${pts}!`, '#a8e0a0', RIGHT_X + 26, 54);
      playSfx('item');
      this.setPhase('roundEnd');
    } else if (this.timeLeft <= 0) {
      this.float('¡Tiempo!', '#ff9c9c', RIGHT_X + 26, 54);
      playSfx('error');
      this.setPhase('roundEnd');
    }
  }

  private nextRound(): void {
    this.round++;
    if (this.round < this.challenges.length) return this.startRound();
    this.setPhase('end');
    playSfx(this.passed >= 4 ? 'item' : 'cancel');
    this.banner(`¡Se acabó el concurso!\n${this.passed} de ${this.challenges.length} caras · ${this.points} puntos\n${verdict(this.points, this.challenges.length)}\n(E para salir)`);
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseMs = 0;
  }

  /** Apaga la cámara y vuelve (Esc en cualquier momento, o E al final). */
  private exit(aborted = true): void {
    FaceCam.stop();
    this.finish({ score: this.points, passed: this.passed, rounds: this.challenges.length, aborted: aborted && this.phase !== 'end' });
  }

  // ─── Dibujo ─────────────────────────────────────────────────────────────────────────────────────

  private draw(): void {
    this.drawCamera();
    const h = this.hud;
    h.clear();
    this.drawBars(h);
    const showing = this.phase === 'reveal' || this.phase === 'round' || this.phase === 'roundEnd';
    const ch = this.challenges[this.round];
    this.titleBig.setVisible(showing);
    this.hintBig.setVisible(showing);
    this.scoreText.setText(this.mode === 'game' && this.challenges.length > 0 ? `Cara ${Math.min(this.round + 1, this.challenges.length)}/${this.challenges.length} · ${this.points} pts` : '');

    if (showing && ch) {
      this.titleBig.setText(ch.title);
      this.hintBig.setText(ch.hint);
      this.drawFace(h, ch.id, RIGHT_X + RIGHT_W / 2, 50, this.time.now);
      this.drawMeters(h, ch);
    } else if (this.phase === 'wait') {
      this.drawWait(h);
    }
    if (this.mode === 'lab') this.drawLab(h);

    // Valores crudos del reto (para ajustar umbrales) o, en el probador, los más altos.
    this.readout.setText(this.readoutText(ch));
  }

  /** Pinta el cuadro de la cámara en el canvas pequeño (o lo deja oscuro si no hay). */
  private drawCamera(): void {
    const cam = this.cam;
    if (!cam) return;
    const ctx = cam.context;
    let live = false;
    if (FaceCam.status === 'ready') {
      const smallCtx = this.pixelView ? this.small?.getContext('2d') : null;
      if (smallCtx) {
        // Pixeles: se achica a 64×48 y se estira sin suavizar.
        live = FaceCam.drawMirrored(smallCtx, CAM.cw, CAM.ch);
        if (live && this.small) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(this.small, 0, 0, CAM_TEX.w, CAM_TEX.h);
        }
      } else {
        ctx.imageSmoothingEnabled = true;
        live = FaceCam.drawMirrored(ctx, CAM_TEX.w, CAM_TEX.h);
      }
    }
    if (!live) {
      ctx.fillStyle = '#10141f';
      ctx.fillRect(0, 0, CAM_TEX.w, CAM_TEX.h);
    }
    cam.refresh();
    const noFace = live && !this.lastShapes && this.phase !== 'end';
    this.camNote.setVisible(!live || noFace);
    const loading = FaceCam.status === 'starting' || FaceCam.status === 'ready';
    this.camNote.setText(live ? 'NO TE VEO\n(acércate a la luz)' : loading ? 'CARGANDO...' : 'CÁMARA APAGADA');
  }

  /** Cambia entre ver la cámara en pixeles o nítida (y lo recuerda). */
  private toggleView(): void {
    this.pixelView = !this.pixelView;
    try {
      window.localStorage.setItem(VIEW_KEY, this.pixelView ? '1' : '0');
    } catch {
      // Sin almacenamiento: dura esta sesión.
    }
    playSfx('select');
    this.applyView();
  }

  /** Filtro de la textura (cuadrado o suave) y la etiqueta del botón, según la vista elegida. */
  private applyView(): void {
    this.cam?.setFilter(this.pixelView ? Phaser.Textures.FilterMode.NEAREST : Phaser.Textures.FilterMode.LINEAR);
    this.viewChip.setText(`F: ${this.pixelView ? 'PIXELES' : 'NÍTIDA'}`);
  }

  private drawStage(g: Phaser.GameObjects.Graphics): void {
    // El escenario: fondo morado, cortinas rojas a los costados y reflectores.
    g.fillStyle(0x2a1838, 1).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    g.fillStyle(0x3a2250, 1).fillRect(0, 118, BASE_WIDTH, 62);
    for (let x = 0; x < BASE_WIDTH; x += 20) g.fillStyle(0x34204a, 1).fillRect(x, 118, 1, 62);
    for (const [x, w] of [[0, 8], [BASE_WIDTH - 8, 8]] as const) {
      g.fillStyle(0x8c1c34, 1).fillRect(x, 0, w, BASE_HEIGHT);
      g.fillStyle(0xb02848, 1).fillRect(x + (x === 0 ? 2 : 3), 0, 2, BASE_HEIGHT);
    }
    g.fillStyle(0xfff0b0, 0.06).fillTriangle(RIGHT_X + 75, 0, RIGHT_X + 5, 130, RIGHT_X + 145, 130);
    g.fillStyle(0xfff0b0, 0.05).fillTriangle(60, 0, 8, 120, 112, 120);
    // Marco de la cámara, tipo televisor.
    const w = CAM.cw * CAM.scale + 4;
    const h = CAM.ch * CAM.scale + 4;
    g.fillStyle(0x14182a, 1).fillRoundedRect(CAM.x - 2, CAM.y - 2, w + 4, h + 4, 4);
    g.fillStyle(0x6a6480, 1).fillRoundedRect(CAM.x, CAM.y, w, h, 3);
    g.fillStyle(0x10141f, 1).fillRect(CAM.x + 2, CAM.y + 2, CAM.cw * CAM.scale, CAM.ch * CAM.scale);
    g.fillStyle(0xe05050, 1).fillCircle(CAM.x + w - 5, CAM.y - 7, 2);
  }

  private drawWait(h: Phaser.GameObjects.Graphics): void {
    const cx = RIGHT_X + RIGHT_W / 2;
    this.drawFace(h, 'poker', cx, 50, this.time.now, true);
    const bar = Phaser.Math.Clamp(this.seenMs / 800, 0, 1);
    h.fillStyle(0x14182a, 1).fillRect(RIGHT_X, 118, RIGHT_W, 6);
    h.fillStyle(0xf8e070, 1).fillRect(RIGHT_X + 1, 119, (RIGHT_W - 2) * bar, 4);
    if (!this.waitText) {
      this.waitText = this.addText(cx, 90, 'Ponte frente a la cámara\ny que se te vea la cara', { fontSize: '9px', fontStyle: '600', color: '#fbf6ee', align: 'center', stroke: '#14182a', strokeThickness: 3 })
        .setOrigin(0.5, 0)
        .setDepth(10);
    }
  }

  /** Medidor del reto: el puntaje en vivo (con la raya del mínimo), lo que lleva sostenido y el tiempo. */
  private drawMeters(h: Phaser.GameObjects.Graphics, ch: FaceChallenge): void {
    this.waitText?.destroy();
    this.waitText = null;
    const x = RIGHT_X;
    const w = RIGHT_W;
    const measuring = this.phase === 'round';
    const ok = this.lastScore >= PASS_SCORE;
    h.fillStyle(0x14182a, 1).fillRoundedRect(x, 122, w, 10, 3);
    h.fillStyle(ok ? 0x6ad08a : 0xe8a850, 1).fillRoundedRect(x + 1, 123, Math.max(0, (w - 2) * this.lastScore), 8, 2);
    h.fillStyle(0xfbf6ee, 1).fillRect(x + 1 + (w - 2) * PASS_SCORE, 120, 1, 14);
    // Sostener: barrita fina debajo.
    h.fillStyle(0x14182a, 1).fillRect(x, 136, w, 4);
    h.fillStyle(0x6ac8f0, 1).fillRect(x + 1, 137, (w - 2) * Phaser.Math.Clamp(this.held / ch.holdMs, 0, 1), 2);
    // Tiempo.
    const t = Phaser.Math.Clamp(this.timeLeft / ROUND_MS, 0, 1);
    h.fillStyle(0x14182a, 1).fillRect(x, 144, w, 5);
    h.fillStyle(t > 0.3 ? 0xf8e070 : 0xe05050, 1).fillRect(x + 1, 145, (w - 2) * (measuring || this.phase === 'roundEnd' ? t : 1), 3);
  }

  private buildLab(): void {
    FACE_CHALLENGES.forEach((c, i) => {
      this.labTexts.push(this.addText(RIGHT_X, 22 + i * 17, c.title.replace(/[¡!]/g, ''), { fontSize: '8px', color: '#fbf6ee' }).setDepth(10));
    });
  }

  private drawLab(h: Phaser.GameObjects.Graphics): void {
    FACE_CHALLENGES.forEach((c, i) => {
      const s = this.lastShapes ? c.score(this.lastShapes) : 0;
      const y = 22 + i * 17;
      const ok = s >= PASS_SCORE;
      this.labTexts[i]?.setColor(ok ? '#a8e0a0' : '#fbf6ee');
      h.fillStyle(0x14182a, 1).fillRoundedRect(RIGHT_X, y + 9, RIGHT_W, 5, 2);
      h.fillStyle(ok ? 0x6ad08a : 0xe8a850, 1).fillRect(RIGHT_X + 1, y + 10, (RIGHT_W - 2) * s, 3);
      h.fillStyle(0xfbf6ee, 1).fillRect(RIGHT_X + 1 + (RIGHT_W - 2) * PASS_SCORE, y + 8, 1, 7);
    });
  }

  private readoutText(ch: FaceChallenge | undefined): string {
    const s = this.lastShapes;
    if (this.phase === 'intro' || this.phase === 'loading' || this.phase === 'fail') return '';
    if (!s) return this.mode === 'lab' || this.phase === 'wait' ? 'Sin cara a la vista.' : '';
    if (this.mode === 'lab') {
      return Object.entries(s)
        .filter(([k]) => !k.startsWith('_'))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k, v]) => `${k} ${v.toFixed(2)}`)
        .join('\n');
    }
    if (!ch) return '';
    return `puntaje ${this.lastScore.toFixed(2)} · ${ch.keys.map((k) => `${shortKey(k)} ${(s[k] ?? 0).toFixed(2)}`).join(' ')}`;
  }

  // ─── La cara de ejemplo ─────────────────────────────────────────────────────────────────────────

  /** Dibuja la cara que hay que imitar, en pixel art. `idle`: cara neutra con ojos que parpadean. */
  private drawFace(g: Phaser.GameObjects.Graphics, id: FaceId, cx: number, cy: number, now: number, idle = false): void {
    const R = 22;
    const bob = Math.round(Math.sin(now / 260) * 1.5);
    cy += bob;
    g.fillStyle(0x000000, 0.25).fillEllipse(cx, cy + R + 4, R * 1.6, 5);
    // Mejillas infladas: dos globos a los lados.
    if (id === 'mejillas') {
      for (const s of [-1, 1]) {
        g.fillStyle(INK, 1).fillCircle(cx + s * 17, cy + 7, 10);
        g.fillStyle(SKIN, 1).fillCircle(cx + s * 17, cy + 7, 9);
        g.fillStyle(0xf09a8c, 0.7).fillCircle(cx + s * 17, cy + 8, 5);
      }
    }
    g.fillStyle(INK, 1).fillCircle(cx, cy, R + 1);
    g.fillStyle(SKIN, 1).fillCircle(cx, cy, R);

    const blink = idle && Math.floor(now / 1800) % 2 === 0 && now % 1800 < 160;
    const eyeY = cy - 5;
    const wide = id === 'boca' || id === 'cejas';
    const drawEye = (ex: number, shut: boolean): void => {
      if (shut || blink) g.fillStyle(INK, 1).fillRect(ex - 3, eyeY + 1, 6, 2);
      else if (wide) g.fillStyle(0xfbf6ee, 1).fillCircle(ex, eyeY, 4).fillStyle(INK, 1).fillCircle(ex, eyeY, 2);
      else g.fillStyle(INK, 1).fillRect(ex - 2, eyeY - 2, 4, 5);
    };
    drawEye(cx - 8, id === 'guino');
    drawEye(cx + 8, false);

    // Cejas.
    const brow = (ex: number, dy: number, tilt: number): void => {
      g.lineStyle(2, INK, 1).beginPath().moveTo(ex - 5, eyeY + dy + tilt).lineTo(ex + 5, eyeY + dy - tilt).strokePath();
    };
    if (id === 'cejas') {
      brow(cx - 8, -9 - 3 * (0.5 + 0.5 * Math.sin(now / 200)), 1);
      brow(cx + 8, -9 - 3 * (0.5 + 0.5 * Math.sin(now / 200)), -1);
    } else if (id === 'poker') {
      brow(cx - 8, -7, 0);
      brow(cx + 8, -7, 0);
    }

    // Boca.
    g.lineStyle(2, INK, 1);
    switch (id) {
      case 'sonrisa':
      case 'guino':
        g.beginPath().arc(cx, cy + 3, 10, 0.2, Math.PI - 0.2).strokePath();
        break;
      case 'boca':
        g.fillStyle(INK, 1).fillEllipse(cx, cy + 11, 13, 15);
        g.fillStyle(LIPS, 1).fillEllipse(cx, cy + 14, 8, 6);
        break;
      case 'cejas':
        g.fillStyle(INK, 1).fillEllipse(cx, cy + 11, 5, 6);
        break;
      case 'besito': {
        g.fillStyle(INK, 1).fillCircle(cx, cy + 10, 4);
        g.fillStyle(LIPS, 1).fillCircle(cx, cy + 10, 3);
        g.fillStyle(INK, 1).fillCircle(cx, cy + 10, 1);
        // El corazón que sale volando.
        const t = (now / 900) % 1;
        const hx = cx + 14 + t * 10;
        const hy = cy - 4 - t * 16;
        g.fillStyle(0xe8486c, 1 - t * 0.6).fillCircle(hx - 2, hy, 2.5).fillCircle(hx + 2, hy, 2.5).fillTriangle(hx - 4.5, hy + 1, hx + 4.5, hy + 1, hx, hy + 6);
        break;
      }
      case 'mejillas':
        g.fillStyle(INK, 1).fillRect(cx - 4, cy + 10, 8, 2);
        break;
      case 'poker':
        g.fillStyle(INK, 1).fillRect(cx - 7, cy + 10, 14, 2);
        // Lentes oscuros.
        g.fillStyle(INK, 1).fillRect(cx - 14, eyeY - 3, 12, 7).fillRect(cx + 2, eyeY - 3, 12, 7).fillRect(cx - 3, eyeY - 2, 6, 2);
        g.fillStyle(0x6a6a9c, 1).fillRect(cx - 12, eyeY - 2, 3, 2).fillRect(cx + 4, eyeY - 2, 3, 2);
        break;
      default:
        g.fillStyle(INK, 1).fillRect(cx - 5, cy + 10, 10, 2);
    }
  }
}

/** ¿Vista en pixeles? Por defecto sí (el look del juego). */
function readPixelPref(): boolean {
  try {
    return window.localStorage.getItem(VIEW_KEY) !== '0';
  } catch {
    return true;
  }
}

function shortKey(k: string): string {
  return k
    .replace('mouth', 'bo.')
    .replace('brow', 'ce.')
    .replace('eyeBlink', 'ojo')
    .replace('cheekPuff', 'mej')
    .replace('jawOpen', 'mand');
}

function failMessage(): string {
  switch (FaceCam.status) {
    case 'denied':
      return 'La cámara no tiene permiso.\nActívala con el candado de la barra del navegador y reintenta.\n(E: reintentar · Esc: salir)';
    case 'unsupported':
      return 'Este navegador no deja usar la cámara\n(necesita HTTPS y un navegador reciente).\n(Esc: salir)';
    default:
      return `No se pudo iniciar la cámara.\n${FaceCam.detail.slice(0, 90)}\n(E: reintentar · Esc: salir)`;
  }
}
