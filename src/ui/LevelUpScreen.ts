import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import type { SfxName } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import type { MapScene } from '../scenes/MapScene';
import { Controls } from '../systems/Controls';
import type { LevelUpInfo } from '../systems/SkillStats';
import { STAT_MAX } from '../systems/SkillStats';
import { drawPanel, makeText, THEME } from './theme';

const DEPTH = 320;
/** Cuándo (ms) entra cada parte; el golpe de la fanfarria (sfxDefs.nivel_*) cae en IMPACT_MS. */
const IMPACT_MS = 700;
const LABEL_MS = 900;
const RANK_MS = 1250;
const ROWS_MS = 1550;
const ROW_GAP_MS = 380;
const FILL_MS = 650;
/** Las pulsaciones que ya venían en camino (la que cerró el minijuego) no cuentan. */
const INPUT_GRACE_MS = 800;
/** Si nadie pulsa nada, se cierra sola. */
const AUTO_CLOSE_MS = 20000;

const BADGE = { x: BASE_WIDTH / 2, y: 58, r: 25 };
const PANEL = { x: 50, y: 103, w: 220, h: 52 };
const BAR = { x: 144, w: 66, h: 5 };
const GOLD = 0xffd45a;

type ParticleStyle = 'confetti' | 'bubbles' | 'sparkles' | 'balls';

/** Cómo se festeja cada minijuego: tipo de partículas y sus colores. */
const FLAVOR: Record<string, { style: ParticleStyle; colors: number[] }> = {
  futbol: { style: 'confetti', colors: [0x3c9c58, 0xffffff, GOLD, 0x8fdc9f] },
  natacion: { style: 'bubbles', colors: [0x2aa8bc, 0x9fe8f4, 0xffffff] },
  salsa: { style: 'sparkles', colors: [0xe8607a, GOLD, 0xffffff, 0xff9ab0] },
  pinpon: { style: 'balls', colors: [0xf0a030, 0xffffff, 0xff7a3a] },
};
const DEFAULT_FLAVOR = { style: 'sparkles' as ParticleStyle, colors: [GOLD, 0xffffff] };

interface Particle {
  go: Phaser.GameObjects.Shape;
  vx: number;
  vy: number;
  /** Aceleración vertical (px/s²): positiva cae, negativa sube. */
  g: number;
  spin: number;
  age: number;
  life: number;
  /** Rebota en el piso (las pelotitas del pimpón). */
  bounce: boolean;
  /** Ondula de lado a lado (burbujas). */
  wobble: number;
  /** Titila (chispas). */
  twinkle: boolean;
  phase: number;
}

interface BarRow {
  g: Phaser.GameObjects.Graphics;
  value: Phaser.GameObjects.Text;
  plus: Phaser.GameObjects.Text | null;
  before: number;
  after: number;
  shown: number;
  tween: Phaser.Tweens.Tween | null;
}

/**
 * Pantalla de subida de nivel de un minijuego (fútbol, natación, salsa, pimpón): oscurece el mapa,
 * revienta una insignia con el nivel nuevo, llena las barras de stats y festeja con partículas y una
 * fanfarria propia de cada minijuego (nivel_* en sfxDefs). Pausa el mapa mientras está abierta.
 */
export class LevelUpScreen {
  private readonly root: Phaser.GameObjects.Container;
  private active = false;
  private map: MapScene | null = null;
  private info: LevelUpInfo | null = null;
  private flavor = DEFAULT_FLAVOR;
  private particles: Particle[] = [];
  private rows: BarRow[] = [];
  private elapsed = 0;
  private ambientIn = 0;
  private rowsDone = false;
  private closing = false;
  private prompt: Phaser.GameObjects.Text | null = null;
  private timers: Phaser.Time.TimerEvent[] = [];
  private rays: Phaser.GameObjects.Graphics | null = null;
  /** Capa de partículas: detrás de la insignia y los textos. */
  private fx: Phaser.GameObjects.Container | null = null;
  /** Lo que va apareciendo con tweens y su estado final (para apurar la pantalla). */
  private reveals: Array<{ go: Phaser.GameObjects.Text | Phaser.GameObjects.Graphics; y?: number; scale?: number }> = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(DEPTH).setVisible(false);
  }

  get isOpen(): boolean {
    return this.active;
  }

  /** `map` null: sin mapa que pausar (la vista previa del modo admin). */
  open(map: MapScene | null, info: LevelUpInfo): void {
    if (this.active) return;
    this.map = map;
    this.info = info;
    this.flavor = FLAVOR[info.skillId] ?? DEFAULT_FLAVOR;
    this.active = true;
    this.closing = false;
    this.rowsDone = false;
    this.elapsed = 0;
    this.ambientIn = 0;
    this.particles = [];
    this.rows = [];
    this.reveals = [];
    this.timers = [];
    // Descarta las pulsaciones que venían de antes.
    Controls.consume('interact');
    Controls.consume('menu');
    if (map) this.scene.scene.pause(map.scene.key);
    this.build(info);
    this.root.setVisible(true).setAlpha(1);
    playSfx(`nivel_${info.skillId}` as SfxName);
  }

  update(delta: number): void {
    if (!this.active) return;
    const dt = Math.min(delta, 50) / 1000;
    this.elapsed += delta;
    this.stepParticles(dt);
    if (this.elapsed > IMPACT_MS && this.elapsed < AUTO_CLOSE_MS) this.ambient(dt);
    if (this.rays) this.rays.rotation += dt * 0.25;
    if (this.closing) return;

    const ok = Controls.consume('interact');
    const back = Controls.consume('menu');
    const press = this.elapsed > INPUT_GRACE_MS && (ok || back);
    if (press) {
      if (this.rowsDone) this.close();
      else this.finishRows();
    } else if (this.elapsed > AUTO_CLOSE_MS) {
      this.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Armado
  // ---------------------------------------------------------------------------

  private build(info: LevelUpInfo): void {
    const s = this.scene;
    const color = info.color;
    const light = Phaser.Display.Color.IntegerToColor(color).lighten(28).color;
    const cx = BASE_WIDTH / 2;

    // Fondo oscuro que se cierra sobre el mapa.
    const dim = s.add.rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0x070a14, 1).setOrigin(0, 0).setAlpha(0);
    s.tweens.add({ targets: dim, alpha: 0.9, duration: 450 });
    this.root.add(dim);

    // Rayos giratorios del color del minijuego, que revientan con el golpe.
    const rays = s.add.graphics().setPosition(BADGE.x, BADGE.y).setAlpha(0).setScale(0.2);
    const wedges = 16;
    for (let i = 0; i < wedges; i += 2) {
      const a0 = (i / wedges) * Math.PI * 2;
      const a1 = ((i + 1) / wedges) * Math.PI * 2;
      rays.fillStyle(color, 0.2).fillTriangle(0, 0, Math.cos(a0) * 230, Math.sin(a0) * 230, Math.cos(a1) * 230, Math.sin(a1) * 230);
    }
    this.rays = rays;
    this.root.add(rays);
    s.tweens.add({ targets: rays, alpha: 1, scale: 1, duration: 900, delay: IMPACT_MS, ease: 'Cubic.Out' });
    this.fx = s.add.container(0, 0);
    this.root.add(this.fx);

    // Carga: una bolita de luz que crece y chupa chispas hacia el centro antes del golpe.
    const charge = s.add.circle(BADGE.x, BADGE.y, 22, light, 0.55).setScale(0.05);
    this.root.add(charge);
    s.tweens.add({ targets: charge, scale: 0.8, alpha: 0.95, duration: IMPACT_MS, ease: 'Cubic.In' });
    s.tweens.add({ targets: charge, scale: 2.6, alpha: 0, duration: 380, delay: IMPACT_MS, ease: 'Cubic.Out', onComplete: () => charge.destroy() });
    for (let i = 0; i < 14; i++) {
      const at = Phaser.Math.Between(0, IMPACT_MS - 150);
      this.timers.push(s.time.delayedCall(at, () => this.suck(light)));
    }

    // Brillo detrás de la insignia que late.
    const glow = s.add.circle(BADGE.x, BADGE.y, 36, color, 0.3).setAlpha(0);
    this.root.add(glow);
    s.tweens.add({ targets: glow, alpha: 0.3, duration: 300, delay: IMPACT_MS });
    s.tweens.add({ targets: glow, scale: 1.25, alpha: 0.12, duration: 900, delay: IMPACT_MS + 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // Insignia hexagonal con el número de nivel.
    const badge = s.add.container(BADGE.x, BADGE.y).setScale(0);
    const g = s.add.graphics();
    this.hex(g, BADGE.r + 2.5, 0x070a14, 1);
    this.hex(g, BADGE.r, color, 1);
    this.hex(g, BADGE.r - 4.5, 0x1a2236, 1);
    // Un destello arriba a la izquierda, como el brillo de una medalla.
    g.fillStyle(0xffffff, 0.12).fillTriangle(-16, -9, -3, -19, -11, -2);
    const nivel = makeText(s, 0, -16, 'NIVEL', { fontFamily: FONT_HUD, fontSize: '8px', color: Phaser.Display.Color.IntegerToColor(light).rgba }).setOrigin(0.5, 0);
    const num = makeText(s, 0, 4, String(info.level), { fontFamily: FONT_HUD, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5, 0.5);
    num.setStroke('#070a14', 3);
    badge.add([g, nivel, num]);
    this.root.add(badge);
    s.tweens.add({ targets: badge, scale: 1, duration: 520, delay: IMPACT_MS, ease: 'Back.Out' });
    // Un rebote chiquito del número, como si el golpe lo hubiera sacudido.
    s.tweens.add({ targets: num, scale: 1.35, duration: 140, delay: IMPACT_MS + 300, yoyo: true, ease: 'Quad.Out' });

    // Destello blanco del golpe y un temblor corto.
    this.timers.push(
      s.time.delayedCall(IMPACT_MS, () => {
        const flash = s.add.rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0xffffff, 0.8).setOrigin(0, 0);
        this.root.add(flash);
        s.tweens.add({ targets: flash, alpha: 0, duration: 380, ease: 'Quad.Out', onComplete: () => flash.destroy() });
        s.cameras.main.shake(220, 0.006);
        this.burst();
      }),
    );

    // Título: ¡SUBISTE DE NIVEL! y el minijuego.
    const title = makeText(s, cx, 9, '¡SUBISTE DE NIVEL!', { fontFamily: FONT_HUD, fontSize: '9px', color: '#ffffff' }).setOrigin(0.5, 0);
    title.setStroke('#070a14', 3).setAlpha(0);
    const sub = makeText(s, cx, 20, info.name.toUpperCase(), { fontFamily: FONT_HUD, fontSize: '8px', color: Phaser.Display.Color.IntegerToColor(light).rgba }).setOrigin(0.5, 0);
    sub.setStroke('#070a14', 3).setAlpha(0);
    this.root.add([title, sub]);
    for (const [t, delay] of [[title, LABEL_MS], [sub, LABEL_MS + 120]] as const) {
      const y = t.y;
      t.y = y - 8;
      this.reveals.push({ go: t, y });
      s.tweens.add({ targets: t, alpha: 1, y, duration: 320, delay, ease: 'Back.Out' });
    }

    // Rango del nivel (el "título" que ganaste).
    if (info.rank) {
      const rank = makeText(s, cx, 89, info.rank, { fontSize: '11px', color: '#ffd45a' }).setOrigin(0.5, 0).setAlpha(0).setScale(0.6);
      rank.setStroke('#070a14', 3);
      this.root.add(rank);
      this.reveals.push({ go: rank, scale: 1 });
      s.tweens.add({ targets: rank, alpha: 1, scale: 1, duration: 360, delay: RANK_MS, ease: 'Back.Out' });
    }

    // Panel con las stats y sus barras.
    const panel = s.add.graphics().setAlpha(0);
    drawPanel(panel, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { radius: 6, fill: THEME.dark, edge: color, alpha: 0.94 });
    this.root.add(panel);
    this.reveals.push({ go: panel });
    s.tweens.add({ targets: panel, alpha: 1, duration: 300, delay: ROWS_MS - 250 });
    info.rows.forEach((row, i) => this.buildRow(row, i, color, light));

    // "Pulsa Enter" cuando todo terminó.
    const prompt = makeText(s, cx, BASE_HEIGHT - 12, 'PULSA ENTER PARA SEGUIR', { fontFamily: FONT_HUD, fontSize: '8px', color: '#b8c4e0' }).setOrigin(0.5, 0).setAlpha(0);
    this.root.add(prompt);
    this.prompt = prompt;
    const rowsEnd = ROWS_MS + (info.rows.length - 1) * ROW_GAP_MS + FILL_MS + 250;
    this.timers.push(s.time.delayedCall(rowsEnd, () => this.rowsFinished()));
  }

  private buildRow(row: LevelUpInfo['rows'][number], i: number, color: number, light: number): void {
    const s = this.scene;
    const y = PANEL.y + 7 + i * 14;
    const name = makeText(s, PANEL.x + 10, y - 1, row.name, { fontSize: '9px', color: '#d8e0f4' }).setAlpha(0);
    const value = makeText(s, BAR.x + BAR.w + 7, y - 1, String(row.before), { fontSize: '9px', color: '#ffffff' }).setAlpha(0);
    const g = s.add.graphics().setAlpha(0);
    const plus =
      row.after > row.before
        ? makeText(s, PANEL.x + PANEL.w - 8, y - 1, `+${row.after - row.before}`, { fontSize: '9px', color: '#ffd45a' }).setOrigin(1, 0).setAlpha(0)
        : null;
    this.root.add([name, g, value, ...(plus ? [plus] : [])]);
    this.reveals.push({ go: name }, { go: g }, { go: value });

    const bar: BarRow = { g, value, plus, before: row.before, after: row.after, shown: row.before, tween: null };
    this.rows.push(bar);
    this.drawBar(bar, y, color, light);

    const start = ROWS_MS + i * ROW_GAP_MS;
    s.tweens.add({ targets: [name, g, value], alpha: 1, duration: 220, delay: start });
    this.timers.push(
      s.time.delayedCall(start + 220, () => {
        if (row.after <= row.before) return;
        playSfx('nivel_tick');
        bar.tween = s.tweens.addCounter({
          from: row.before,
          to: row.after,
          duration: FILL_MS,
          ease: 'Cubic.Out',
          onUpdate: (tw) => {
            bar.shown = tw.getValue() ?? row.after;
            this.drawBar(bar, y, color, light);
          },
          onComplete: () => this.rowFilled(bar, y, color, light),
        });
      }),
    );
    // Sin cambio en esa stat: la barra se queda quieta.
  }

  /** La barra: lo que ya tenías (apagado) y lo que acabas de ganar (brillante), sobre un fondo oscuro. */
  private drawBar(bar: BarRow, rowY: number, color: number, light: number): void {
    const { g } = bar;
    const dark = Phaser.Display.Color.IntegerToColor(color).darken(35).color;
    const y = rowY + 3;
    const w = (v: number): number => Math.round((Math.min(v, STAT_MAX) / STAT_MAX) * BAR.w);
    g.clear();
    g.fillStyle(0x070a14, 1).fillRect(BAR.x - 1, y - 1, BAR.w + 2, BAR.h + 2);
    g.fillStyle(0x232d47, 1).fillRect(BAR.x, y, BAR.w, BAR.h);
    g.fillStyle(dark, 1).fillRect(BAR.x, y, w(Math.min(bar.shown, bar.before)), BAR.h);
    if (bar.shown > bar.before) {
      g.fillStyle(color, 1).fillRect(BAR.x + w(bar.before), y, w(bar.shown) - w(bar.before), BAR.h);
      g.fillStyle(light, 1).fillRect(BAR.x + w(bar.before), y, w(bar.shown) - w(bar.before), 1);
    }
    bar.value.setText(String(Math.round(bar.shown)));
  }

  private rowFilled(bar: BarRow, rowY: number, color: number, light: number): void {
    bar.tween = null;
    bar.shown = bar.after;
    this.drawBar(bar, rowY, color, light);
    bar.value.setColor('#ffd45a');
    if (bar.plus) {
      const y = bar.plus.y;
      bar.plus.setAlpha(1).setY(y + 5).setScale(1.6);
      this.scene.tweens.add({ targets: bar.plus, y, scale: 1, duration: 260, ease: 'Back.Out' });
    }
    this.sparkleAt(BAR.x + (bar.after / STAT_MAX) * BAR.w, rowY + 5);
  }

  /** Todas las barras llenas de una vez (el jugador apuró la pantalla). */
  private finishRows(): void {
    const info = this.info;
    if (!info) return;
    for (const t of this.timers) t.remove(false);
    this.timers = [];
    for (const r of this.reveals) {
      this.scene.tweens.killTweensOf(r.go);
      r.go.setAlpha(1);
      if (r.y !== undefined) r.go.setY(r.y);
      if (r.scale !== undefined) r.go.setScale(r.scale);
    }
    const { color } = info;
    const light = Phaser.Display.Color.IntegerToColor(color).lighten(28).color;
    this.rows.forEach((bar, i) => {
      bar.tween?.stop();
      bar.tween = null;
      if (bar.plus) {
        this.scene.tweens.killTweensOf(bar.plus);
        bar.plus.setAlpha(1).setScale(1);
        bar.plus.setY(PANEL.y + 7 + i * 14 - 1);
      }
      bar.shown = bar.after;
      bar.value.setColor(bar.after > bar.before ? '#ffd45a' : '#ffffff');
      this.drawBar(bar, PANEL.y + 7 + i * 14, color, light);
    });
    this.rowsFinished();
  }

  private rowsFinished(): void {
    if (this.rowsDone) return;
    this.rowsDone = true;
    const prompt = this.prompt;
    if (!prompt) return;
    this.scene.tweens.add({ targets: prompt, alpha: 1, duration: 250 });
    this.scene.tweens.add({ targets: prompt, alpha: 0.35, duration: 520, delay: 250, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    playSfx('close');
    for (const t of this.timers) t.remove(false);
    this.timers = [];
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: 260,
      onComplete: () => {
        this.root.removeAll(true);
        this.root.setVisible(false);
        for (const p of this.particles) p.go.destroy();
        this.particles = [];
        this.rows = [];
        this.rays = null;
        this.fx = null;
        this.reveals = [];
        this.prompt = null;
        this.active = false;
        this.closing = false;
        if (this.map) this.scene.scene.resume(this.map.scene.key);
        this.map = null;
        this.info = null;
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Partículas
  // ---------------------------------------------------------------------------

  private hex(g: Phaser.GameObjects.Graphics, r: number, color: number, alpha: number): void {
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    g.fillStyle(color, alpha).fillPoints(pts, true);
  }

  private pick(): number {
    return Phaser.Utils.Array.GetRandom(this.flavor.colors);
  }

  private makeShape(x: number, y: number): Phaser.GameObjects.Shape {
    const s = this.scene;
    const color = this.pick();
    let go: Phaser.GameObjects.Shape;
    switch (this.flavor.style) {
      case 'confetti':
        go = s.add.rectangle(x, y, Phaser.Math.Between(2, 4), Phaser.Math.Between(2, 3), color);
        break;
      case 'bubbles':
        go = s.add.circle(x, y, Phaser.Math.FloatBetween(1.5, 4.5), color, 0.15).setStrokeStyle(1, color, 0.9);
        break;
      case 'balls':
        go = s.add.circle(x, y, Phaser.Math.FloatBetween(2, 3), color).setStrokeStyle(0.5, 0x7a4a10, 0.6);
        break;
      default:
        go = s.add.star(x, y, 4, 0.8, Phaser.Math.FloatBetween(2.5, 4.5), color);
    }
    this.fx?.add(go);
    return go;
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number): Particle {
    const style = this.flavor.style;
    const p: Particle = {
      go: this.makeShape(x, y),
      vx,
      vy,
      g: style === 'confetti' ? 120 : style === 'balls' ? 260 : style === 'bubbles' ? -26 : 0,
      spin: style === 'confetti' ? Phaser.Math.FloatBetween(-8, 8) : 0,
      age: 0,
      life,
      bounce: style === 'balls',
      wobble: style === 'bubbles' ? Phaser.Math.FloatBetween(6, 14) : 0,
      twinkle: style === 'sparkles',
      phase: Math.random() * 6.28,
    };
    this.particles.push(p);
    return p;
  }

  /** El estallido de celebración desde la insignia. */
  private burst(): void {
    const n = this.flavor.style === 'balls' ? 26 : 46;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Phaser.Math.Between(50, this.flavor.style === 'sparkles' ? 110 : 150);
      const p = this.spawn(BADGE.x, BADGE.y, Math.cos(a) * sp, Math.sin(a) * sp - (this.flavor.style === 'confetti' ? 40 : 0), Phaser.Math.FloatBetween(1.6, 3));
      if (this.flavor.style === 'sparkles') p.g = 18;
    }
  }

  /** Chispas que se juntan hacia el centro mientras carga el golpe. */
  private suck(color: number): void {
    if (!this.active) return;
    const a = Math.random() * Math.PI * 2;
    const d = Phaser.Math.Between(46, 80);
    const dot = this.scene.add.circle(BADGE.x + Math.cos(a) * d, BADGE.y + Math.sin(a) * d, 1.4, color, 1);
    this.root.add(dot);
    this.scene.tweens.add({
      targets: dot,
      x: BADGE.x,
      y: BADGE.y,
      alpha: 0.2,
      duration: 260,
      ease: 'Cubic.In',
      onComplete: () => dot.destroy(),
    });
  }

  /** Un manojito de chispas donde terminó una barra. */
  private sparkleAt(x: number, y: number): void {
    for (let i = 0; i < 7; i++) {
      const dot = this.scene.add.star(x, y, 4, 0.6, Phaser.Math.FloatBetween(1.5, 3), GOLD);
      this.root.add(dot);
      const a = Math.random() * Math.PI * 2;
      const d = Phaser.Math.Between(6, 16);
      this.scene.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d - 3,
        alpha: 0,
        angle: 90,
        duration: 420,
        ease: 'Cubic.Out',
        onComplete: () => dot.destroy(),
      });
    }
  }

  /** La lluvia continua de festejo (confeti que cae, burbujas que suben, chispas que titilan, pelotitas que botan). */
  private ambient(dt: number): void {
    this.ambientIn -= dt;
    if (this.ambientIn > 0) return;
    this.ambientIn = 0.07;
    const x = Phaser.Math.Between(4, BASE_WIDTH - 4);
    switch (this.flavor.style) {
      case 'confetti':
        this.spawn(x, -4, Phaser.Math.FloatBetween(-12, 12), Phaser.Math.FloatBetween(20, 50), 6);
        break;
      case 'bubbles':
        this.spawn(x, BASE_HEIGHT + 4, 0, Phaser.Math.FloatBetween(-40, -20), 6);
        break;
      case 'balls':
        this.ambientIn = 0.2;
        this.spawn(x, -4, Phaser.Math.FloatBetween(-10, 10), 0, 4);
        break;
      default:
        this.spawn(x, Phaser.Math.Between(6, BASE_HEIGHT - 6), 0, 0, Phaser.Math.FloatBetween(0.7, 1.2));
    }
  }

  private stepParticles(dt: number): void {
    const floor = BASE_HEIGHT - 5;
    this.particles = this.particles.filter((p) => {
      p.age += dt;
      const dead = p.age >= p.life || p.go.y > BASE_HEIGHT + 12 || p.go.y < -12;
      if (dead) {
        p.go.destroy();
        return false;
      }
      p.vy += p.g * dt;
      if (this.flavor.style === 'sparkles') {
        p.vx *= 1 - 1.4 * dt;
        p.vy *= 1 - 1.4 * dt;
      }
      p.go.x += p.vx * dt + (p.wobble ? Math.sin(p.age * 4 + p.phase) * p.wobble * dt : 0);
      p.go.y += p.vy * dt;
      if (p.bounce && p.go.y > floor && p.vy > 0) {
        p.go.y = floor;
        p.vy *= -0.62;
        p.vx *= 0.92;
      }
      if (p.spin) p.go.rotation += p.spin * dt;
      const left = p.life - p.age;
      let a = left < 0.5 ? left / 0.5 : 1;
      if (p.twinkle) {
        const k = Math.sin((p.age / p.life) * Math.PI);
        p.go.setScale(0.3 + k * 1.1);
        a *= 0.4 + 0.6 * k;
      }
      p.go.setAlpha(a);
      return true;
    });
  }
}
