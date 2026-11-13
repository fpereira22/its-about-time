import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import { BASE_WIDTH } from '../config/display';
import { Controls } from '../systems/Controls';
import type { AtraccionResult } from './AtraccionScene';
import { MiniScene } from './MiniScene';

/**
 * Misión 8: el Recorrido Cafetero del Parque del Café, jugable de punta a punta con don Arnulfo, el guía:
 *  1. Sembrar un colino: E rápido para cavar, E cuando el colino quede sobre el hoyo, mantén E para regar y suelta
 *     en la franja verde.
 *  2. Recoger: WASD mueve la mano por la mata, E coge el grano. Solo los rojos («cereza»); los verdes no.
 *  3. Despulpar: dale vuelta a la manivela (W, D, S, A en círculo).
 *  4. Tostar: A/D revuelven (si no, se tuesta disparejo) y E lo saca del fogón. El punto: tueste medio.
 *  5. Moler: otra vez en círculo (W, D, S, A).
 *  6. Colar en el chorreador: mantén E para echar agua sin que se rebose ni se quede seco.
 *  7. Probar: cómo sabe depende de todo lo anterior.
 * Esc: dejar el recorrido.
 */

type Step = 'sembrar' | 'recoger' | 'despulpar' | 'tostar' | 'moler' | 'colar' | 'probar';
const STEPS: Step[] = ['sembrar', 'recoger', 'despulpar', 'tostar', 'moler', 'colar', 'probar'];

export interface CafeSceneData {
  done: (r: AtraccionResult) => void;
}

const SKIN = 0xf0c8a0;
const INK = 0x2a2433;

interface Cherry {
  x: number;
  y: number;
  /** Madurez: verde < 0.45 < pintón < 0.7 < rojo < 1 < sobremaduro. */
  r: number;
  picked: boolean;
}

const ROAST_ZONES: Array<{ to: number; name: string; color: number }> = [
  { to: 0.32, name: 'verde', color: 0x9cac6c },
  { to: 0.52, name: 'claro', color: 0xc8a060 },
  { to: 0.8, name: 'medio', color: 0x8c5430 },
  { to: 0.96, name: 'oscuro', color: 0x4c2a18 },
  { to: 99, name: 'quemado', color: 0x1c120c },
];

function roastZone(v: number): { name: string; color: number } {
  return ROAST_ZONES.find((z) => v < z.to) ?? ROAST_ZONES[ROAST_ZONES.length - 1];
}

/** El círculo de la manivela: W, D, S, A (arriba, derecha, abajo, izquierda). */
const CIRCLE = ['up', 'right', 'down', 'left'] as const;

export class CafeScene extends MiniScene<AtraccionResult> {
  private stepIdx = 0;
  private phase: 'intro' | 'play' | 'done' | 'end' = 'intro';
  private t = 0;
  private skipped = false;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private infoText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;

  // Sembrar
  private sub = 0;
  private dig = 0;
  private swing = 0;
  private water = 0;
  private siembra = 0;

  // Recoger
  private cherries: Cherry[] = [];
  private hand = { x: 160, y: 90 };
  private picked = { rojo: 0, pinton: 0, verde: 0, sobre: 0 };

  // Despulpar y moler
  private crank = 0;
  private crankNext = 0;
  private turns = 0;
  private despulpe = 0;
  private molienda = 0;

  // Tostar
  private roast = 0;
  private even = 1;
  private stirSide = 0;
  private crackDone = false;
  private tueste = { name: 'medio', even: 1 };

  // Colar
  private level = 0;
  private inBand = 0;
  private spills = 0;
  private colado = 0;

  constructor() {
    super('Cafe');
  }

  init(data: CafeSceneData): void {
    this.initMini(data.done);
    this.stepIdx = 0;
    this.phase = 'intro';
    this.t = 0;
    this.skipped = false;
    this.siembra = 0;
    this.picked = { rojo: 0, pinton: 0, verde: 0, sobre: 0 };
    this.despulpe = 0;
    this.molienda = 0;
    this.tueste = { name: 'medio', even: 1 };
    this.colado = 0;
  }

  create(): void {
    this.g = this.add.graphics();
    this.hud = this.add.graphics().setDepth(40);
    this.createUi('#4c8c3c');
    this.infoText = this.addText(BASE_WIDTH - 6, 4, '', { fontSize: '8px', color: '#fbf6ee' }).setOrigin(1, 0).setDepth(50);
    this.promptText = this.addText(BASE_WIDTH / 2, 26, '', { fontSize: '9px', fontStyle: '600', color: '#f8e070', stroke: '#2a2433', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(52);
    playMusic('salento');
    this.startStep();
  }

  private get step(): Step {
    return STEPS[this.stepIdx];
  }

  private startStep(): void {
    this.phase = 'intro';
    this.t = 0;
    this.sub = 0;
    this.promptText.setText('');
    const n = this.stepIdx + 1;
    const intros: Record<Step, [string, string, string]> = {
      sembrar: [
        'Sembrar',
        'E: cavar / soltar el colino / mantén E para regar · Esc: dejar el recorrido',
        'Don Arnulfo, el guía: «Bienvenidos al cafetal, mis extranjeros. Aquí el café no sale de un frasco:\nsale de la tierra. Primero, a sembrar un colinito.»\nCava con E (rápido), suelta el colino sobre el hoyo (E) y riégalo (mantén E, suelta en lo verde).\n(E para empezar)',
      ],
      recoger: [
        'Recoger',
        'WASD: mover la mano · E: coger el grano · Esc: dejar el recorrido',
        'Don Arnulfo: «El café se coge a mano, grano por grano. Solo los rojitos, los que están como una cereza.\nLos verdes no, que amargan. Y los negritos ya se pasaron.»\n25 segundos. Llena el canasto.\n(E para empezar)',
      ],
      despulpar: [
        'Despulpar',
        'W, D, S, A en círculo: darle a la manivela · Esc: dejar el recorrido',
        'Don Arnulfo: «A la despulpadora: la manivela se le da en redondo, sin parar.\nLa pulpa sale por un lado y el grano por el otro.»\n(E para empezar)',
      ],
      tostar: [
        'Tostar',
        'A/D: revolver · E: sacarlo del fogón · Esc: dejar el recorrido',
        'Don Arnulfo: «Esto tarda días secándose al sol. Pero como ustedes se van hoy...»\nCambia tu costal por uno ya seco. Guiña un ojo.\n«Al fogón. Revuelva sin parar (A/D) o se le tuesta disparejo. Cuando esté color chocolate,\nni más ni menos, lo saca (E). Primero cruje: ahí ya va llegando.»\n(E para empezar)',
      ],
      moler: [
        'Moler',
        'W, D, S, A en círculo: moler · Esc: dejar el recorrido',
        'Don Arnulfo: «Al molino. Vueltas parejitas. Doce vueltas y tiene para el tinto de todos.»\n(E para empezar)',
      ],
      colar: [
        'Colar',
        'Mantén E: echar agua · Esc: dejar el recorrido',
        'Don Arnulfo: «En el chorreador, como lo hacía mi abuela: el agua bien caliente, despacito,\nque no se rebose ni se quede seco. Ocho segunditos.»\nMantén E para echar agua; suelta para que baje.\n(E para empezar)',
      ],
      probar: ['Probar', 'E: probar', 'Don Arnulfo sirve tu café en pocillos de peltre. Todos esperan que tú lo pruebes primero.\n(E para probar)'],
    };
    const [title, hint, text] = intros[this.step];
    this.titleText.setText(`Recorrido cafetero · ${n}/7 ${title}`);
    this.hintText.setText(hint);
    this.banner(text);
    if (this.step === 'recoger') this.setupBush();
    if (this.step === 'despulpar' || this.step === 'moler') {
      this.crank = 0;
      this.crankNext = 0;
      this.turns = 0;
    }
    if (this.step === 'tostar') {
      this.roast = 0;
      this.even = 1;
      this.crackDone = false;
    }
    if (this.step === 'colar') {
      this.level = 0;
      this.inBand = 0;
      this.spills = 0;
    }
    if (this.step === 'sembrar') {
      this.dig = 0;
      this.swing = 0;
      this.water = 0;
    }
  }

  override update(_t: number, delta: number): void {
    this.tickUi(delta);
    if (this.leaving) return;
    const dt = Math.min(delta, 40) / 1000;
    if (this.phase === 'intro') {
      if (Controls.consume('interact')) {
        this.hideBanner();
        this.phase = 'play';
        this.t = 0;
        if (this.step === 'probar') this.probar();
      } else if (Controls.consume('menu')) this.quit();
    } else if (this.phase === 'play') {
      this.t += dt;
      if (Controls.consume('menu')) this.quit();
      else if (this.step === 'sembrar') this.sembrar(dt);
      else if (this.step === 'recoger') this.recoger(dt);
      else if (this.step === 'despulpar' || this.step === 'moler') this.manivela();
      else if (this.step === 'tostar') this.tostar(dt);
      else if (this.step === 'colar') this.colar(dt);
    } else if (this.phase === 'done') {
      if (Controls.consume('interact')) {
        this.hideBanner();
        this.stepIdx++;
        this.startStep();
      }
    } else if (this.phase === 'end') {
      if (Controls.consume('interact')) this.finish(this.result());
    }
    this.draw();
  }

  private quit(): void {
    this.skipped = true;
    this.phase = 'end';
    this.promptText.setText('');
    this.banner('Te sales del recorrido. Don Arnulfo: «Bueno, mijo, el café no es para todo el mundo.»\n(E para seguir)');
  }

  /** Cierra la etapa con un comentario y pasa a la siguiente. */
  private stepDone(text: string): void {
    this.phase = 'done';
    this.promptText.setText('');
    playSfx('item');
    this.banner(`${text}\n(E para seguir)`);
  }

  // -------------------------------------------------------------------------
  // 1. Sembrar
  // -------------------------------------------------------------------------

  private sembrar(dt: number): void {
    if (this.sub === 0) {
      this.promptText.setText('¡Cava! (E, E, E...)');
      if (Controls.consume('interact')) {
        this.dig = Math.min(1, this.dig + 0.1);
        playSfx('golpe');
      }
      if (this.dig >= 1 || this.t > 6) {
        if (this.dig >= 1) this.siembra++;
        this.float(this.dig >= 1 ? '¡Hoyo hondo!' : 'Hoyo... chiquito.', this.dig >= 1 ? '#a8e0a0' : '#ff9c9c', 160, 110);
        this.sub = 1;
        this.t = 0;
      }
    } else if (this.sub === 1) {
      this.promptText.setText('Suelta el colino sobre el hoyo (E)');
      this.swing = Math.sin(this.t * 2.6) * 60;
      if (Controls.consume('interact')) {
        const off = Math.abs(this.swing);
        if (off < 10) this.siembra++;
        this.float(off < 10 ? '¡Derechito!' : off < 25 ? 'Medio chueco.' : 'Quedó acostado.', off < 10 ? '#a8e0a0' : '#ff9c9c', 160, 110);
        this.swing = Phaser.Math.Clamp(this.swing, -25, 25);
        this.sub = 2;
        this.t = 0;
        playSfx('select');
      }
    } else if (this.sub === 2) {
      this.promptText.setText('Mantén E para regar · suelta en lo verde');
      if (Controls.isHeld('interact')) {
        this.water = Math.min(1.1, this.water + dt * 0.45);
        if (Math.random() < dt * 4) playSfx('splash');
      } else if (this.water > 0.05) {
        const ok = this.water >= 0.6 && this.water <= 0.82;
        if (ok) this.siembra++;
        this.float(ok ? '¡Bien regado!' : this.water > 0.82 ? 'Lo ahogaste un poquito.' : 'Le faltó agüita.', ok ? '#a8e0a0' : '#ff9c9c', 160, 110);
        this.sub = 3;
        const verdict = this.siembra === 3 ? 'Don Arnulfo: «¡Eso, mijo! En tres años da café. Vuelva a cogerlo.»' : this.siembra === 2 ? 'Don Arnulfo: «Ahí va, ahí va. Algo saldrá.»' : 'Don Arnulfo: «Bueno... la tierra es generosa.»';
        this.stepDone(`Colino sembrado (${this.siembra}/3).\n${verdict}`);
      }
      if (this.water >= 1.1) {
        this.sub = 3;
        this.stepDone(`Colino sembrado (${this.siembra}/3), y ahogado.\nDon Arnulfo: «Eso ya es un arrozal, mijo.»`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Recoger
  // -------------------------------------------------------------------------

  private setupBush(): void {
    this.cherries = [];
    for (let i = 0; i < 34; i++) {
      const branch = i % 6;
      const x = 160 + (branch < 3 ? -1 : 1) * (12 + Math.random() * 62);
      const y = 54 + (branch % 3) * 30 + Math.random() * 14;
      this.cherries.push({ x, y, r: Math.random() < 0.55 ? 0.72 + Math.random() * 0.24 : Math.random() < 0.6 ? Math.random() * 0.45 : Math.random() < 0.5 ? 0.5 + Math.random() * 0.2 : 1.02 + Math.random() * 0.2, picked: false });
    }
    this.hand = { x: 160, y: 90 };
  }

  private recoger(dt: number): void {
    const sp = 120;
    if (Controls.isHeld('left')) this.hand.x -= sp * dt;
    if (Controls.isHeld('right')) this.hand.x += sp * dt;
    if (Controls.isHeld('up')) this.hand.y -= sp * dt;
    if (Controls.isHeld('down')) this.hand.y += sp * dt;
    this.hand.x = Phaser.Math.Clamp(this.hand.x, 70, 250);
    this.hand.y = Phaser.Math.Clamp(this.hand.y, 40, 140);
    for (const c of this.cherries) if (!c.picked) c.r += dt * 0.012;
    if (Controls.consume('interact')) {
      let best: Cherry | null = null;
      let bestD = 8;
      for (const c of this.cherries) {
        const d = Math.hypot(c.x - this.hand.x, c.y - this.hand.y);
        if (!c.picked && d < bestD) (best = c), (bestD = d);
      }
      if (best) {
        best.picked = true;
        if (best.r < 0.45) {
          this.picked.verde++;
          this.float('¡Verde no, mijo!', '#ff9c9c', best.x, best.y - 8);
          playSfx('error');
        } else if (best.r < 0.7) {
          this.picked.pinton++;
          this.float('Pintón...', '#f8e070', best.x, best.y - 8);
          playSfx('cursor');
        } else if (best.r < 1) {
          this.picked.rojo++;
          this.float('¡Cereza!', '#a8e0a0', best.x, best.y - 8);
          playSfx('coin');
        } else {
          this.picked.sobre++;
          this.float('Se pasó (pasilla).', '#dfe6f4', best.x, best.y - 8);
          playSfx('cursor');
        }
      }
    }
    if (this.t >= 25 || this.cherries.every((c) => c.picked || c.r < 0.45)) {
      const p = this.picked;
      const total = p.rojo + p.pinton + p.verde + p.sobre;
      const verdict = p.verde > 3 ? 'Don Arnulfo saca los verdes uno por uno, sin decir nada. Pero suspira.' : p.rojo >= 14 ? 'Don Arnulfo: «¡Usted es recolector de los buenos! Le doy trabajo en cosecha.»' : 'Don Arnulfo: «Bien, bien. Con eso alcanza para unos tintos.»';
      this.stepDone(`Canasto: ${total} granos (${p.rojo} rojos, ${p.pinton} pintones, ${p.verde} verdes, ${p.sobre} pasados).\n${verdict}`);
    }
  }

  // -------------------------------------------------------------------------
  // 3 y 5. La manivela (despulpar, moler)
  // -------------------------------------------------------------------------

  private manivela(): void {
    const want = CIRCLE[this.crankNext];
    for (const dir of CIRCLE) {
      if (!Controls.consume(dir)) continue;
      if (dir === want) {
        this.crankNext = (this.crankNext + 1) % 4;
        this.crank += Math.PI / 2;
        if (this.crankNext === 0) {
          this.turns++;
          playSfx(this.step === 'moler' ? 'cuchillo' : 'golpe');
        }
      } else if (dir !== CIRCLE[(this.crankNext + 3) % 4]) {
        this.float('Para el otro lado...', '#ff9c9c', 160, 60);
      }
    }
    const goal = 12;
    const limit = this.step === 'moler' ? 12 : 10;
    this.promptText.setText(`Siguiente: ${{ up: 'W ↑', right: 'D →', down: 'S ↓', left: 'A ←' }[want]}`);
    if (this.turns >= goal || this.t >= limit) {
      const pct = Math.min(1, this.turns / goal);
      if (this.step === 'despulpar') {
        this.despulpe = pct;
        this.stepDone(pct >= 1 ? 'Grano limpio, sin pulpa. Don Arnulfo: «¡Brazo de cafetero!»' : `Despulpaste ${Math.round(pct * 100)}%. Don Arnulfo termina el resto: «Es que tiene maña, esto.»`);
      } else {
        this.molienda = pct;
        this.stepDone(pct >= 1 ? 'Molido parejito. Huele a gloria.' : `Molido ${Math.round(pct * 100)}%. Quedó medio grueso, pero sirve.`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. Tostar
  // -------------------------------------------------------------------------

  private tostar(dt: number): void {
    this.roast += dt * 0.062;
    const left = Controls.consume('left');
    const right = Controls.consume('right');
    if ((left && this.stirSide >= 0) || (right && this.stirSide <= 0)) {
      this.stirSide = left ? -1 : 1;
      this.even = Math.min(1, this.even + 0.06);
    }
    this.even = Math.max(0, this.even - dt * 0.12);
    if (Math.floor(this.t) !== Math.floor(this.t - dt)) playSfx('sarten');
    if (!this.crackDone && this.roast >= 0.5) {
      this.crackDone = true;
      playSfx('taco');
      this.float('¡Crac, crac! (el primer crack)', '#f8e070', 160, 60);
    }
    const z = roastZone(this.roast);
    this.promptText.setText(`Tueste: ${z.name} · E para sacarlo`);
    if (Controls.consume('interact') || this.roast >= 1.15) {
      this.tueste = { name: z.name, even: this.even };
      const said: Record<string, string> = {
        verde: 'Don Arnulfo: «Mijo, eso todavía está crudo. Eso es pa\' sembrar otra vez.»',
        claro: 'Don Arnulfo: «Clarito. Va a quedar ácido, como limonada con cafeína.»',
        medio: 'Don Arnulfo: «¡ESO! Color chocolate. Así se tuesta en esta finca.»',
        oscuro: 'Don Arnulfo: «Oscurito. Fuerte, pa\' los madrugadores.»',
        quemado: 'Sale humo. Mucho humo. Don Arnulfo abre la ventana sin decir nada.',
      };
      const parejo = this.even > 0.55 ? 'Parejito.' : 'Quedó disparejo: unos claros, otros negros.';
      this.stepDone(`${said[z.name]}\n${parejo}`);
    }
  }

  // -------------------------------------------------------------------------
  // 6. Colar
  // -------------------------------------------------------------------------

  private colar(dt: number): void {
    if (Controls.isHeld('interact')) this.level += dt * 0.55;
    this.level = Math.max(0, this.level - dt * 0.28);
    if (this.level > 1) {
      this.level = 0.85;
      this.spills++;
      this.float('¡Se rebosó!', '#ff9c9c', 160, 70);
      playSfx('splash');
    }
    if (this.level >= 0.35 && this.level <= 0.8) this.inBand += dt;
    this.promptText.setText(this.level < 0.35 ? 'Más agua (mantén E)' : this.level > 0.8 ? '¡Cuidado, se rebosa!' : 'Así, despacito...');
    if (this.t >= 8) {
      this.colado = Math.max(0, Math.min(1, this.inBand / 7 - this.spills * 0.15));
      this.stepDone(this.colado > 0.7 ? 'Un chorrito oscuro y brillante cae en el pocillo. Huele a finca.' : this.spills > 0 ? 'Quedó un charco en la mesa, pero el tinto salió.' : 'Salió clarito. Más agüita que tinto.');
    }
  }

  // -------------------------------------------------------------------------
  // 7. Probar
  // -------------------------------------------------------------------------

  /** Calidad 0..100 con lo que hiciste en cada etapa. */
  private calidad(): number {
    const p = this.picked;
    const total = Math.max(1, p.rojo + p.pinton + p.verde + p.sobre);
    const madurez = (p.rojo + p.pinton * 0.5) / total - (p.verde / total) * 0.6;
    const tueste = { verde: 0, claro: 0.45, medio: 1, oscuro: 0.6, quemado: 0 }[this.tueste.name] ?? 0.5;
    const q = 8 * (this.siembra / 3) + 22 * Phaser.Math.Clamp(madurez, 0, 1) + 8 * this.despulpe + 30 * tueste * (0.6 + 0.4 * this.tueste.even) + 12 * this.molienda + 20 * this.colado;
    return Math.round(Phaser.Math.Clamp(q, 0, 100));
  }

  private nota(): string {
    const p = this.picked;
    const verdes = p.verde > 3 ? ' Algo astringente: se colaron granos verdes.' : '';
    const n = this.tueste.name;
    if (n === 'quemado') return `Sabe a llanta. A llanta quemada, específicamente. Todos se lo toman igual, por educación.${verdes}`;
    if (n === 'verde') return `Sabe a agüita de maíz con limón. Don Arnulfo: «Le faltó candela, mijo.»${verdes}`;
    if (n === 'claro') return `Ácido y ligero, como a mandarina. Meli: «Esto es casi un té. Me gusta.»${verdes}`;
    if (n === 'oscuro') return `Fuerte, a cacao amargo. Juanpa: «Este es tinto de verdad, parce. De camionero.»${verdes}`;
    return this.calidad() >= 70
      ? `Dulce, a panela y chocolate, con un toquecito de mandarina. Renzo cierra los ojos: «Causa... esto es poesía.»${verdes}`
      : `Rico, a panela. Le falta algo, pero es tuyo: lo sembraste, lo cogiste y lo tostaste.${verdes}`;
  }

  private probar(): void {
    playSfx('eat');
    const q = this.calidad();
    const stars = q >= 85 ? '★★★★★' : q >= 70 ? '★★★★☆' : q >= 50 ? '★★★☆☆' : q >= 30 ? '★★☆☆☆' : '★☆☆☆☆';
    const guia = q >= 85 ? 'Don Arnulfo: «Este café yo lo vendo. ¿Seguro que usted es chileno?»' : q >= 50 ? 'Don Arnulfo: «Buen tinto. Con cariño todo sabe mejor.»' : 'Don Arnulfo: «El primer café de uno nunca es el mejor. El mío sabía a barro.»';
    this.phase = 'end';
    this.banner(`Tu café: ${stars} (${q}/100) · tueste ${this.tueste.name}\n${this.nota()}\n${guia}\n(E para seguir)`);
  }

  private result(): AtraccionResult {
    const q = this.skipped ? 0 : this.calidad();
    return {
      mode: 'cafe',
      score: q,
      good: !this.skipped && q >= 70,
      skipped: this.skipped,
      cafe: { calidad: q, tueste: this.tueste.name, nota: this.skipped ? '' : this.nota() },
    };
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private draw(): void {
    const g = this.g;
    g.clear();
    this.drawFinca(g);
    switch (this.step) {
      case 'sembrar':
        this.drawSembrar(g);
        break;
      case 'recoger':
        this.drawRecoger(g);
        break;
      case 'despulpar':
        this.drawDespulpadora(g);
        break;
      case 'tostar':
        this.drawTostar(g);
        break;
      case 'moler':
        this.drawMolino(g);
        break;
      case 'colar':
        this.drawChorreador(g);
        break;
      default:
        this.drawProbar(g);
    }
    const h = this.hud;
    h.clear();
    this.drawBars(h);
    this.infoText.setText(this.info());
    if (this.phase !== 'play') return;
    if (this.step === 'sembrar' && this.sub === 2) this.meter(h, this.water / 1.1, [0.6 / 1.1, 0.82 / 1.1]);
    if (this.step === 'sembrar' && this.sub === 0) this.meter(h, this.dig, null);
    if (this.step === 'tostar') {
      // La barra de tueste con sus colores y la marca de dónde vas.
      let x = 60;
      for (const z of ROAST_ZONES) {
        const from = ROAST_ZONES.indexOf(z) === 0 ? 0 : ROAST_ZONES[ROAST_ZONES.indexOf(z) - 1].to;
        const to = Math.min(1.15, z.to);
        const w = ((to - from) / 1.15) * 200;
        h.fillStyle(z.color, 1).fillRect(x, 160, w, 6);
        x += w;
      }
      h.fillStyle(0xffffff, 1).fillRect(60 + (Math.min(1.15, this.roast) / 1.15) * 200 - 1, 157, 2, 12);
      h.fillStyle(0x0c1020, 0.8).fillRect(8, 20, 60, 10);
      h.fillStyle(this.even > 0.55 ? 0x5cc880 : 0xf8a040, 1).fillRect(10, 22, 56 * this.even, 6);
    }
    if (this.step === 'colar') this.meter(h, Math.min(1, this.level), [0.35, 0.8]);
  }

  private meter(h: Phaser.GameObjects.Graphics, v: number, band: [number, number] | null): void {
    h.fillStyle(0x0c1020, 0.85).fillRect(290, 40, 14, 110);
    if (band) h.fillStyle(0x48b860, 0.6).fillRect(292, 148 - band[1] * 106, 10, (band[1] - band[0]) * 106);
    h.fillStyle(0x5cb8f0, 1).fillRect(294, 148 - Math.max(0, v) * 106, 6, Math.max(0, v) * 106);
  }

  private info(): string {
    if (this.step === 'recoger') return `Canasto: ${this.picked.rojo + this.picked.pinton + this.picked.verde + this.picked.sobre} · ${Math.max(0, Math.ceil(25 - this.t))} s`;
    if (this.step === 'despulpar' || this.step === 'moler') return `Vueltas: ${this.turns}/12 · ${Math.max(0, Math.ceil((this.step === 'moler' ? 12 : 10) - this.t))} s`;
    if (this.step === 'colar') return `${Math.max(0, Math.ceil(8 - this.t))} s`;
    if (this.step === 'tostar') return 'Revolver (A/D) · parejo';
    return '';
  }

  /** El fondo: ladera de cafetal con guamos, y don Arnulfo con su sombrero aguadeño y su carriel. */
  private drawFinca(g: Phaser.GameObjects.Graphics): void {
    const W = BASE_WIDTH;
    g.fillStyle(0x9cd0f0, 1).fillRect(0, 0, W, 50);
    g.fillStyle(0x7a9cb8, 1).fillTriangle(-20, 50, 60, 18, 140, 50).fillTriangle(100, 50, 200, 12, 300, 50).fillTriangle(240, 50, 300, 26, 360, 50);
    g.fillStyle(0x5c9c4c, 1).fillRect(0, 44, W, 136);
    for (let r = 0; r < 7; r++) for (let k = 0; k < 14; k++) g.fillStyle(0x3c7c34, 1).fillCircle(k * 24 + (r % 2) * 12, 52 + r * 18, 6);
    g.fillStyle(0x2c6c2c, 0.8).fillCircle(20, 30, 26).fillCircle(300, 26, 24);
    const inside = this.step === 'tostar' || this.step === 'colar' || this.step === 'probar' || this.step === 'moler';
    if (inside) {
      // La cocina de la casa de bahareque.
      g.fillStyle(0xe8dcc0, 1).fillRect(0, 14, W, 166);
      for (let y = 30; y < 160; y += 22) g.fillStyle(0xd8c8a8, 1).fillRect(0, y, W, 1);
      g.fillStyle(0x6a3c1c, 1).fillRect(0, 14, W, 6).fillRect(0, 134, W, 46);
      g.fillStyle(0x8c5c34, 1).fillRect(0, 134, W, 3);
      g.fillStyle(0x7cb8e0, 1).fillRect(230, 36, 50, 36);
      g.fillStyle(0x6a3c1c, 1).fillRect(254, 36, 2, 36).fillRect(230, 53, 50, 2);
    }
    // Don Arnulfo.
    const gx = 34;
    const gy = inside ? 120 : 132;
    g.fillStyle(0xf4f0e6, 1).fillRect(gx - 7, gy - 10, 14, 18);
    g.fillStyle(0xc8303c, 1).fillRect(gx - 8, gy - 10, 16, 4);
    g.fillStyle(0x6a3c1c, 1).fillRect(gx + 4, gy - 2, 6, 8);
    g.fillStyle(SKIN, 1).fillCircle(gx, gy - 15, 6);
    g.fillStyle(0xf4ecd8, 1).fillEllipse(gx, gy - 20, 22, 5).fillRect(gx - 6, gy - 26, 12, 6);
    g.fillStyle(INK, 1).fillRect(gx - 6, gy - 22, 12, 1);
    g.fillStyle(0x8c8c98, 1).fillRect(gx - 4, gy - 12, 8, 2);
  }

  private drawSembrar(g: Phaser.GameObjects.Graphics): void {
    // Corte del terreno con el hoyo.
    g.fillStyle(0x6a4428, 1).fillRect(80, 120, 160, 40);
    const depth = 4 + this.dig * 26;
    g.fillStyle(0x3a2414, 1).fillEllipse(160, 120 + depth / 2, 26, depth);
    g.fillStyle(0x8c5c34, 1).fillEllipse(186, 116, 20, 8);
    // El azadón.
    if (this.sub === 0) {
      const up = Math.sin(this.t * 20) > 0 ? -8 : 0;
      g.fillStyle(0x8c5c34, 1).fillRect(176, 70 + up, 3, 44);
      g.fillStyle(0x8c8c98, 1).fillRect(166, 110 + up, 14, 5);
    }
    // El colino (columpiándose o ya sembrado).
    const cx = 160 + (this.sub === 1 ? this.swing : this.sub > 1 ? this.swing * 0.4 : 999);
    if (cx < 900) {
      const cy = this.sub === 1 ? 74 : 118;
      g.fillStyle(0x5a3c1c, 1).fillRect(cx - 4, cy, 8, 7);
      g.fillStyle(0x6a8c3c, 1).fillRect(cx - 1, cy - 18, 2, 18);
      for (let k = 0; k < 3; k++) g.fillStyle(0x3c8c3c, 1).fillEllipse(cx - 5, cy - 14 + k * 5, 8, 3).fillEllipse(cx + 5, cy - 16 + k * 5, 8, 3);
    }
    if (this.sub === 2) {
      g.fillStyle(0x5a90c8, 1).fillRect(184, 74, 18, 14);
      g.fillStyle(0x5a90c8, 1).fillRect(170, 78, 14, 3);
      if (Controls.isHeld('interact')) for (let k = 0; k < 5; k++) g.fillStyle(0x9cd8ff, 1).fillRect(168 - k * 2, 84 + ((this.t * 60 + k * 7) % 30), 1, 3);
    }
  }

  private drawRecoger(g: Phaser.GameObjects.Graphics): void {
    // La mata grande de café: hojas brillantes y ramas cargadas.
    g.fillStyle(0x6a4428, 1).fillRect(158, 50, 4, 110);
    for (let b = 0; b < 3; b++) {
      g.fillStyle(0x5a3c1c, 1).fillRect(86, 56 + b * 30, 148, 2);
      for (let k = 0; k < 14; k++) {
        const x = 90 + k * 10.5;
        g.fillStyle(k % 2 ? 0x2c6c2c : 0x3c8c3c, 1).fillEllipse(x, 50 + b * 30 + (k % 2) * 3, 12, 6);
        g.fillEllipse(x + 4, 62 + b * 30 - (k % 2) * 3, 12, 6);
      }
    }
    for (const c of this.cherries) {
      if (c.picked) continue;
      const color = c.r < 0.45 ? 0x6cac3c : c.r < 0.7 ? 0xe8c030 : c.r < 1 ? 0xd8202c : 0x4a1424;
      g.fillStyle(INK, 1).fillCircle(c.x, c.y, 3.2);
      g.fillStyle(color, 1).fillCircle(c.x, c.y, 2.6);
      g.fillStyle(0xffffff, 0.5).fillRect(c.x - 1, c.y - 2, 1, 1);
    }
    // El canasto amarrado a la cintura.
    g.fillStyle(0xc8a060, 1).fillRect(130, 150, 60, 22);
    for (let x = 132; x < 188; x += 6) g.fillStyle(0x8c6c3c, 1).fillRect(x, 150, 2, 22);
    const n = this.picked.rojo + this.picked.pinton + this.picked.verde + this.picked.sobre;
    for (let i = 0; i < Math.min(40, n); i++) g.fillStyle(i < this.picked.rojo ? 0xd8202c : 0x8c6c3c, 1).fillCircle(136 + (i % 16) * 3.2, 150 - Math.floor(i / 16) * 3, 1.6);
    // La mano.
    const { x, y } = this.hand;
    g.fillStyle(INK, 1).fillCircle(x, y, 5);
    g.fillStyle(SKIN, 1).fillCircle(x, y, 4);
    g.fillStyle(SKIN, 1).fillRect(x - 1, y - 8, 2, 5);
    g.lineStyle(1, 0xffffff, 0.6).strokeCircle(x, y, 8);
  }

  private drawCrank(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
    g.lineStyle(2, 0x5a5a68, 1).strokeCircle(cx, cy, r);
    const a = this.crank - Math.PI / 2;
    const hx = cx + Math.cos(a) * r;
    const hy = cy + Math.sin(a) * r;
    g.lineStyle(3, 0x3a3a48, 1).lineBetween(cx, cy, hx, hy);
    g.fillStyle(0x8c5c34, 1).fillCircle(hx, hy, 4);
    // Hacia dónde va la siguiente: una flechita.
    const na = this.crank + Math.PI / 2 - Math.PI / 2;
    g.fillStyle(0xf8e070, 0.8).fillCircle(cx + Math.cos(na) * (r + 8), cy + Math.sin(na) * (r + 8), 2);
  }

  private drawDespulpadora(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x6a6c78, 1).fillRect(120, 70, 70, 60);
    g.fillStyle(0x8c8c98, 1).fillRect(124, 74, 62, 52);
    g.fillStyle(0x5a5a68, 1).fillTriangle(124, 70, 186, 70, 155, 44);
    g.fillStyle(0xd8202c, 1).fillEllipse(155, 58, 30, 10);
    g.fillStyle(0x6a4428, 1).fillRect(110, 130, 90, 30);
    this.drawCrank(g, 210, 100, 18);
    // Sale la pulpa por un lado y el grano por el otro.
    const flow = Math.min(1, this.turns / 12);
    for (let k = 0; k < Math.round(flow * 12); k++) {
      g.fillStyle(0x8c2c24, 1).fillCircle(112 - (k % 4) * 4, 150 - Math.floor(k / 4) * 3, 2);
      g.fillStyle(0xe8dcb0, 1).fillEllipse(170 + (k % 4) * 5, 150 - Math.floor(k / 4) * 3, 4, 3);
    }
  }

  private drawTostar(g: Phaser.GameObjects.Graphics): void {
    // El fogón de leña y la paila.
    g.fillStyle(0x8c8c98, 1).fillRect(100, 120, 120, 30);
    g.fillStyle(0x3a2a1c, 1).fillRect(120, 128, 80, 14);
    for (let k = 0; k < 6; k++) {
      const fh = 6 + Math.sin(this.t * 12 + k) * 3;
      g.fillStyle(k % 2 ? 0xf8a030 : 0xe8501c, 1).fillTriangle(126 + k * 13, 140, 132 + k * 13, 140 - fh, 138 + k * 13, 140);
    }
    g.fillStyle(0x3a3a48, 1).fillEllipse(160, 116, 110, 22);
    g.fillStyle(0x5a5a68, 1).fillEllipse(160, 113, 100, 16);
    // Los granos: el color depende del tueste; si no revuelves, unos se pasan y otros no.
    for (let i = 0; i < 46; i++) {
      const x = 118 + ((i * 37) % 84);
      const y = 108 + ((i * 13) % 10);
      const spread = (1 - this.even) * (((i * 53) % 10) / 10 - 0.5) * 0.7;
      const z = roastZone(Math.max(0, this.roast + spread));
      g.fillStyle(z.color, 1).fillEllipse(x, y, 5, 3);
      g.fillStyle(0x000000, 0.3).fillRect(x - 1, y, 3, 1);
    }
    // La cuchara de palo.
    const sx = 160 + this.stirSide * 18;
    g.fillStyle(0x8c5c34, 1).fillRect(sx - 1, 70, 3, 42);
    g.fillEllipse(sx, 110, 8, 5);
    if (this.roast > 0.7) for (let k = 0; k < 4; k++) g.fillStyle(0xd8d0c8, Math.min(0.7, (this.roast - 0.7) * 2)).fillCircle(140 + k * 14, 96 - ((this.t * 20 + k * 9) % 40), 5);
  }

  private drawMolino(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x8c5c34, 1).fillRect(80, 124, 160, 10);
    g.fillStyle(0x6a3c1c, 1).fillRect(90, 134, 8, 30).fillRect(222, 134, 8, 30);
    g.fillStyle(0x6a6c78, 1).fillRect(140, 80, 30, 44);
    g.fillStyle(0x8c8c98, 1).fillTriangle(132, 80, 178, 80, 155, 58);
    g.fillStyle(0x4c2a18, 1).fillEllipse(155, 66, 26, 6);
    this.drawCrank(g, 190, 98, 16);
    const flow = Math.min(1, this.turns / 12);
    g.fillStyle(0xf4f0e6, 1).fillRect(140, 134, 30, 16);
    g.fillStyle(0x4c2a18, 1).fillRect(142, 150 - flow * 14, 26, flow * 14);
  }

  private drawChorreador(g: Phaser.GameObjects.Graphics): void {
    // El soporte de alambre, el colador de tela y el pocillo.
    g.fillStyle(0x6a3c1c, 1).fillRect(100, 132, 120, 6);
    g.lineStyle(1, 0x5a5a68, 1).lineBetween(140, 132, 140, 70).lineBetween(180, 132, 180, 70).lineBetween(140, 70, 180, 70);
    g.fillStyle(0xf4ecd8, 1).fillTriangle(142, 72, 178, 72, 160, 110);
    g.fillStyle(0x4c2a18, 1).fillTriangle(148, 76, 172, 76, 160, 100);
    const lv = Math.min(1, this.level);
    g.fillStyle(0x6a3c1c, 0.9).fillTriangle(160 - 16 * lv, 104 - 30 * lv, 160 + 16 * lv, 104 - 30 * lv, 160, 106);
    if (this.level > 0.05) for (let k = 0; k < 4; k++) g.fillStyle(0x4c2a18, 1).fillRect(159, 110 + ((this.t * 50 + k * 5) % 14), 2, 3);
    g.fillStyle(0xf4f0f0, 1).fillRect(146, 120, 28, 12);
    g.lineStyle(1, 0x2c64c0, 1).strokeRect(146, 120, 28, 12);
    // La olleta.
    const pour = Controls.isHeld('interact') && this.phase === 'play';
    g.save();
    g.translateCanvas(206, 56);
    g.rotateCanvas(pour ? -0.6 : 0);
    g.fillStyle(0x8c8c98, 1).fillRect(-12, -10, 24, 20);
    g.fillStyle(0x3a3a48, 1).fillRect(12, -4, 10, 3);
    g.restore();
    if (pour) for (let k = 0; k < 5; k++) g.fillStyle(0xc8e0f0, 1).fillRect(186 - k * 4, 58 + k * 3, 2, 2);
  }

  private drawProbar(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x8c5c34, 1).fillRect(60, 124, 200, 10);
    // Pocillos de peltre (blancos con borde azul) para todos.
    for (let k = 0; k < 5; k++) {
      const x = 90 + k * 34;
      g.fillStyle(0xf4f0f0, 1).fillRect(x - 7, 110, 14, 14);
      g.lineStyle(1, 0x2c64c0, 1).strokeRect(x - 7, 110, 14, 14);
      g.fillStyle(0x4c2a18, 1).fillRect(x - 6, 111, 12, 3);
      for (let s = 0; s < 3; s++) g.fillStyle(0xffffff, 0.4).fillCircle(x - 3 + s * 3, 104 - ((this.time.now / 60 + s * 7) % 16), 2);
    }
    // La gente.
    for (const [x, color, hair] of [[90, 0x2c64c0, 0x3a2418], [124, 0xe8742c, 0x1c1418], [158, 0x2c9c58, 0x1c1418], [192, 0xe868a8, 0xd8b070], [226, 0xf8dc68, 0x8c5c34]] as const) {
      g.fillStyle(color, 1).fillRect(x - 8, 84, 16, 22);
      g.fillStyle(SKIN, 1).fillCircle(x, 76, 7);
      g.fillStyle(hair, 1).fillRect(x - 7, 68, 14, 4);
    }
  }
}
