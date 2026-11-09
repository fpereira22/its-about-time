import Phaser from 'phaser';
import { playMusic, playSfx, setAmbient } from '../audio/sfx';
import type { HumanLook } from '../art/characters';
import { characterLook } from '../art/SpriteRegistry';
import { drawSideArm, drawSideBody, type SideFigureOpts } from '../art/vinetas';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { Controls } from '../systems/Controls';
import { playerLook } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import { THEME } from '../ui/theme';
import { BaseScene } from './BaseScene';

/**
 * Misión 7: la boloñesa casera con Sira en el depa del piso 8. Vista de lado del mesón de la cocina: tú a la
 * izquierda, Sira a la derecha y lo que se cocina al medio. Dos partes (la primera antes de ir a comprar las
 * bebidas, la segunda al volver):
 *
 * Parte 1
 *  1. La cebolla: el cuchillo va y viene; E corta cuando pasa por la marca. Cada corte te pican más los ojos;
 *     F te secas las lágrimas (si se llena, lloras y no ves nada por un rato).
 *  2. Zanahoria y tomate: A/D alternados pican la zanahoria; W/S alternados rallan el tomate. Sira pela al lado.
 *  3. El sofrito: W/S suben y bajan el fuego para que la sartén quede en lo verde; E revuelve cuando ella dice
 *     «¡revuelve!». A la mitad, Sira pone su mano sobre la tuya en la cuchara.
 * Parte 2
 *  4. Los fideos al dente: el reloj de la olla corre; E prueba un fideo, W tira uno a la pared (si se pega, está
 *     listo: el truco de la abuela de Sira) y F cuela.
 *  5. Emplatar: el cucharón va y viene sobre el plato; E suelta los fideos, la salsa y el queso con albahaca.
 * Esc salta el paso (no cuenta como bien hecho).
 */

export interface CocinaResult {
  /** Pasos bien hechos en esta parte. */
  score: number;
  total: number;
  perfect: boolean;
  /** Te ganó la cebolla (lloraste). */
  cried: boolean;
  /** El sofrito salió bien con la mano de Sira (trabajo en equipo). */
  teamwork: boolean;
}

export interface CocinaSceneData {
  part: 1 | 2;
  done: (r: CocinaResult) => void;
}

type Stage = 'cebolla' | 'zanahoria' | 'sofrito' | 'fideos' | 'emplatar';
const PARTS: Record<1 | 2, Stage[]> = { 1: ['cebolla', 'zanahoria', 'sofrito'], 2: ['fideos', 'emplatar'] };
const TITLES: Record<Stage, string> = {
  cebolla: 'La cebolla',
  zanahoria: 'Zanahoria y tomate',
  sofrito: 'El sofrito',
  fideos: 'Los fideos al dente',
  emplatar: 'Emplatar',
};
const INTROS: Record<Stage, string> = {
  cebolla: 'Sira: «Tú pica la cebolla, chileno. Cuadraditos, no rodajas.»\nE corta en la marca · F te secas los ojos',
  zanahoria: 'Sira: «Yo pelo, tú picas. A ver quién termina primero.»\nA / D alternados: zanahoria · luego W / S: rallar el tomate',
  sofrito: 'Sira: «Fuego medio. Medio. MEDIO.»\nW / S: fuego · E: revolver cuando ella diga',
  fideos: 'Sira: «Al dente, ¿ah? Ni duros ni blanditos.»\nE: probar uno · W: tirar uno a la pared · F: colar',
  emplatar: 'Sira: «Ahora lo bonito. Que se vea de restaurante.»\nE: soltar (fideos, salsa, queso y albahaca)',
};
const HINTS: Record<Stage, string> = {
  cebolla: 'E: cortar en la marca · F: secarte las lágrimas · Esc: saltar',
  zanahoria: 'A y D alternados (zanahoria) · W y S alternados (tomate)',
  sofrito: 'W: más fuego · S: menos fuego · E: revolver cuando diga «¡revuelve!»',
  fideos: 'E: probar · W: tirarlo a la pared · F: colar',
  emplatar: 'E: soltar cuando el cucharón esté sobre el plato',
};

const COUNTER_Y = 118;
const BOARD_X = 112;
const BOARD_W = 96;
const ONION_X0 = 132;
const ONION_X1 = 188;
const CUTS = 6;
const SOFRITO_S = 15;
const STIR_EVERY = 2.3;
const STIR_WINDOW = 1.1;
const FIDEOS_MAX = 13;
const SEC_PER_MIN = 1.05;
const DENTE: [number, number] = [8, 9.6];
const PLATE_X = 160;

interface FloatText {
  t: Phaser.GameObjects.Text;
  life: number;
}

export class CocinaScene extends BaseScene {
  private done!: (r: CocinaResult) => void;
  private part: 1 | 2 = 1;
  private stages: Stage[] = [];
  private stageIdx = 0;
  private stage: Stage = 'cebolla';
  private phase: 'intro' | 'play' | 'outro' | 'end' = 'intro';
  private phaseMs = 0;
  private t = 0;
  private score = 0;
  private cried = false;
  private teamwork = false;
  /** Ya se apretó para salir: machacar E no reinicia el fundido. */
  private leaving = false;

  private g!: Phaser.GameObjects.Graphics;
  private figs!: Phaser.GameObjects.Graphics;
  /** El frente del mesón: va encima de los dos (les tapa las piernas). */
  private front!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private blur!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private sayText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerBg!: Phaser.GameObjects.Graphics;
  private floats: FloatText[] = [];
  private sayMs = 0;
  private meLook!: HumanLook;
  private siraLook!: HumanLook;

  // La cebolla.
  private knife = 0;
  private cutsDone: number[] = [];
  private goodCuts = 0;
  private tears = 0;
  private teary = 0;
  private wipeCd = 0;
  // Zanahoria y tomate.
  private veg: 'zanahoria' | 'tomate' = 'zanahoria';
  private vegProgress = 0;
  private vegTime = 0;
  private lastKey: 'a' | 'b' | null = null;
  private siraPeel = 0;
  private carrotOk = false;
  private tomatoOk = false;
  // Sofrito.
  private flame = 0.5;
  private temp = 0.4;
  private inZone = 0;
  private stirTimer = 0;
  private stirOpen = 0;
  private stirs = 0;
  private stirPrompts = 0;
  private stirAnim = 0;
  private handMs = 0;
  private handShown = false;
  private smoke: Array<{ x: number; y: number; life: number }> = [];
  // Fideos.
  private minutes = 0;
  private tastes = 0;
  private wallNoodles: Array<{ x: number; y: number; stuck: boolean; vy: number }> = [];
  private drained = false;
  // Emplatar.
  private ladle = 0;
  private drops: number[] = [];

  constructor() {
    super('Cocina');
    this.fixedCamera = true;
  }

  init(data: CocinaSceneData): void {
    this.done = data.done;
    this.part = data.part === 2 ? 2 : 1;
    this.stages = PARTS[this.part];
    this.stageIdx = 0;
    this.score = 0;
    this.cried = false;
    this.teamwork = false;
    this.floats = [];
    this.t = 0;
    this.leaving = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1c1820');
    this.g = this.add.graphics();
    this.figs = this.add.graphics().setDepth(2);
    this.front = this.add.graphics().setDepth(3);
    this.hud = this.add.graphics().setDepth(10);
    this.blur = this.add.graphics().setDepth(9);
    this.meLook = playerLook();
    this.siraLook = (characterLook(StoryState.hasFlag('m7_polera') ? 'sira_m7_polera' : 'sira_m7') as HumanLook | undefined) ?? this.meLook;
    this.titleText = this.addText(6, 4, '', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f8e070' }).setDepth(11);
    this.hintText = this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 11, '', { fontSize: '8px', color: '#dfe6f4' }).setOrigin(0.5, 0).setDepth(11);
    this.sayText = this.addText(0, 0, '', {
      fontSize: '8px',
      color: '#2a2433',
      backgroundColor: '#fbf6ee',
      padding: { x: 3, y: 2 },
      wordWrap: { width: 150 },
    })
      .setOrigin(0.5, 1)
      .setDepth(12)
      .setVisible(false);
    this.bannerBg = this.add.graphics().setDepth(13);
    this.bannerText = this.addText(BASE_WIDTH / 2, 84, '', { fontSize: '10px', fontStyle: '600', color: THEME.ink, align: 'center', wordWrap: { width: 270 } })
      .setOrigin(0.5)
      .setDepth(14);
    this.setupZoom();
    playMusic('cocina');
    setAmbient({ rain: 'none', indoor: true });
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.startStage(0);
  }

  // -------------------------------------------------------------------------
  // Pasos
  // -------------------------------------------------------------------------

  private startStage(i: number): void {
    this.stageIdx = i;
    this.stage = this.stages[i];
    this.phase = 'intro';
    this.phaseMs = 0;
    this.knife = 0;
    this.cutsDone = [];
    this.goodCuts = 0;
    this.tears = 0;
    this.teary = 0;
    this.veg = 'zanahoria';
    this.vegProgress = 0;
    this.vegTime = 0;
    this.lastKey = null;
    this.siraPeel = 0;
    this.carrotOk = false;
    this.tomatoOk = false;
    this.flame = 0.5;
    this.temp = 0.35;
    this.inZone = 0;
    this.stirTimer = STIR_EVERY;
    this.stirOpen = 0;
    this.stirs = 0;
    this.stirPrompts = 0;
    this.handMs = 0;
    this.handShown = false;
    this.smoke = [];
    this.minutes = 0;
    this.tastes = 0;
    this.wallNoodles = [];
    this.drained = false;
    this.ladle = 0;
    this.drops = [];
    this.titleText.setText(`${this.part === 1 ? 'Parte 1' : 'Parte 2'} · ${i + 1}/${this.stages.length} · ${TITLES[this.stage]}`);
    this.hintText.setText(HINTS[this.stage]);
    this.banner(INTROS[this.stage], 0);
  }

  private finishStage(ok: boolean, verdict: string): void {
    if (this.phase !== 'play') return;
    if (ok) this.score++;
    this.phase = 'outro';
    this.phaseMs = 0;
    this.banner(verdict, 0);
    playSfx(ok ? 'item' : 'error');
  }

  private nextStage(): void {
    this.hideBanner();
    if (this.stageIdx + 1 < this.stages.length) {
      this.startStage(this.stageIdx + 1);
      return;
    }
    this.phase = 'end';
    const total = this.stages.length;
    const verdict =
      this.part === 1
        ? this.score === total
          ? 'Sira: «Mira esa salsa. Ahora que se cocine solita, a fuego lento.»'
          : this.score >= 2
            ? 'Sira: «Bueno, bueno... se salvó. La salsa perdona.»'
            : 'Sira: «Tranquilo, la boloñesa es noble. Veinte minutos a fuego lento y nadie sabrá nada.»'
        : this.score === total
          ? 'Sira: «Esto parece de restaurante. Te contrato.»'
          : this.score === 1
            ? 'Sira: «Quedó rico. Feíto, pero rico.»'
            : 'Sira: «Bueno... lo importante es la compañía, ¿cierto?»';
    this.banner(`${verdict}\n(E para seguir)`, 0);
  }

  private finish(): void {
    if (this.leaving) return;
    this.leaving = true;
    const result: CocinaResult = {
      score: this.score,
      total: this.stages.length,
      perfect: this.score === this.stages.length,
      cried: this.cried,
      teamwork: this.teamwork,
    };
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.done(result));
  }

  // -------------------------------------------------------------------------
  // Bucle
  // -------------------------------------------------------------------------

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.t += dt;
    this.phaseMs += delta;
    if (this.sayMs > 0) {
      this.sayMs -= delta;
      if (this.sayMs <= 0) this.sayText.setVisible(false);
    }
    this.updateFloats(dt);
    if (this.phase === 'end') {
      if (this.phaseMs > 500 && Controls.consume('interact')) this.finish();
      this.render();
      return;
    }
    if (this.phase === 'intro') {
      if (this.phaseMs > 3800 || (this.phaseMs > 400 && Controls.consume('interact'))) {
        this.hideBanner();
        this.phase = 'play';
        this.phaseMs = 0;
      }
      this.render();
      return;
    }
    if (this.phase === 'outro') {
      if (this.phaseMs > 3000 || (this.phaseMs > 600 && Controls.consume('interact'))) this.nextStage();
      this.render();
      return;
    }
    if (Controls.consume('menu')) {
      this.finishStage(false, 'Sira: «¿Me lo dejas a mí? Bueno... pero me debes una.»');
      return;
    }
    if (this.stage === 'cebolla') this.updateOnion(dt);
    else if (this.stage === 'zanahoria') this.updateVeg(dt);
    else if (this.stage === 'sofrito') this.updateSofrito(dt);
    else if (this.stage === 'fideos') this.updateNoodles(dt);
    else this.updatePlating(dt);
    this.render();
  }

  private updateOnion(dt: number): void {
    // El cuchillo va y viene sobre la cebolla, cada vez un poquito más rápido.
    this.knife = (Math.sin(this.t * (2.2 + this.cutsDone.length * 0.18)) + 1) / 2;
    this.wipeCd = Math.max(0, this.wipeCd - dt);
    this.tears = Math.max(0, this.tears - dt * 0.03);
    if (this.teary > 0) this.teary = Math.max(0, this.teary - dt);
    if (Controls.consume('trick') && this.wipeCd <= 0) {
      this.tears = Math.max(0, this.tears - 0.4);
      this.teary = Math.min(this.teary, 0.4);
      this.wipeCd = 0.8;
      this.float('*se seca con la manga*', '#dfe6f4', 70, 60);
    }
    if (!Controls.consume('interact')) return;
    const x = ONION_X0 + this.knife * (ONION_X1 - ONION_X0);
    const target = this.markX(this.cutsDone.length);
    // Con los ojos llorosos cuesta más atinarle.
    const tol = this.teary > 0 ? 2 : 4;
    const good = Math.abs(x - target) <= tol;
    playSfx('cuchillo');
    this.cutsDone.push(x);
    if (good) {
      this.goodCuts++;
      this.float('¡tac!', '#a8f0a0', x, 92);
    } else this.float('chueco...', '#f8c070', x, 92);
    this.tears += 0.2;
    if (this.tears >= 1) {
      this.tears = 0.35;
      this.teary = 2.6;
      this.cried = true;
      this.say('Sira: «¿Estás llorando? ¿Por la cebolla o por mí?»', 2400);
    } else if (this.cutsDone.length === 3 && good) this.say('Sira: «Oye, ¡qué buen pulso!»', 1500);
    if (this.cutsDone.length >= CUTS) {
      const ok = this.goodCuts >= 4;
      this.finishStage(
        ok,
        ok
          ? `Cebolla en cuadraditos perfectos (${this.goodCuts}/${CUTS}).\nSira te pasa una servilleta, por si acaso.`
          : `Cebolla en... formas. (${this.goodCuts}/${CUTS})\nSira: «Bueno, en la salsa no se nota.»`,
      );
    }
  }

  private markX(i: number): number {
    return ONION_X0 + 6 + (i * (ONION_X1 - ONION_X0 - 12)) / (CUTS - 1);
  }

  private updateVeg(dt: number): void {
    this.vegTime += dt;
    this.siraPeel = Math.min(1, this.siraPeel + dt / 9);
    const [ka, kb] = this.veg === 'zanahoria' ? (['left', 'right'] as const) : (['up', 'down'] as const);
    const hit = Controls.consume(ka) ? 'a' : Controls.consume(kb) ? 'b' : null;
    if (hit) {
      if (hit !== this.lastKey) {
        this.vegProgress = Math.min(1, this.vegProgress + (this.veg === 'zanahoria' ? 1 / 16 : 1 / 14));
        playSfx(this.veg === 'zanahoria' ? 'cuchillo' : 'blip');
      } else {
        this.vegProgress = Math.max(0, this.vegProgress - 0.02);
      }
      this.lastKey = hit;
    }
    const limit = this.veg === 'zanahoria' ? 9 : 8;
    if (this.vegProgress >= 1 || this.vegTime >= limit) {
      const ok = this.vegProgress >= 1;
      if (this.veg === 'zanahoria') {
        this.carrotOk = ok;
        this.say(ok ? (this.siraPeel < 1 ? 'Sira: «¡Uy! El chef me ganó.»' : 'Sira: «Empate técnico.»') : 'Sira: «Yo termino la zanahoria. Tú, el tomate.»', 1800);
        this.veg = 'tomate';
        this.vegProgress = 0;
        this.vegTime = 0;
        this.lastKey = null;
        this.hintText.setText('W y S alternados: rallar el tomate (sin rallarte los dedos)');
        return;
      }
      this.tomatoOk = ok;
      const both = this.carrotOk && this.tomatoOk;
      this.finishStage(
        both,
        both
          ? 'Zanahoria en cubitos y tomate rallado sin piel.\nSira: «Hacemos buen equipo, ¿ah?»'
          : 'Algo quedó a medias, pero Sira lo emparejó.\nSira: «Equipo es equipo.»',
      );
    }
  }

  private updateSofrito(dt: number): void {
    // La mano de Sira sobre la tuya: a la mitad del sofrito, un ratito todo se queda quieto.
    if (this.handMs > 0) {
      this.handMs -= dt * 1000;
      this.stirAnim += dt * 3;
      return;
    }
    const elapsed = this.phaseMs / 1000;
    if (!this.handShown && elapsed > SOFRITO_S / 2) {
      this.handShown = true;
      this.handMs = 2600;
      this.say('Sira pone su mano sobre la tuya en la cuchara. «Así... despacito.»', 2600);
      playSfx('latido');
      for (let i = 0; i < 4; i++) this.time.delayedCall(i * 450, () => this.float('♥', '#ff8aa8', 150 + Math.random() * 20, 70));
      return;
    }
    if (Controls.isHeld('up')) this.flame = Math.min(1, this.flame + dt * 0.7);
    if (Controls.isHeld('down')) this.flame = Math.max(0, this.flame - dt * 0.7);
    // La sartén sigue al fuego con retraso, y a ratos se dispara sola.
    const noise = Math.sin(this.t * 1.7) * 0.12 + Math.sin(this.t * 4.3) * 0.05;
    this.temp += (this.flame + noise - this.temp) * dt * 0.9;
    const zone = this.temp >= 0.45 && this.temp <= 0.7;
    if (zone) this.inZone += dt;
    if (this.temp > 0.85 && Math.random() < dt * 6) this.smoke.push({ x: 150 + Math.random() * 20, y: 96, life: 1 });
    if (Math.random() < dt * (this.temp * 8)) playSfx('sarten');
    this.stirTimer -= dt;
    if (this.stirOpen > 0) {
      this.stirOpen -= dt;
      if (this.stirOpen <= 0) this.float('¡se pega!', '#f8c070', 160, 84);
    } else if (this.stirTimer <= 0) {
      this.stirOpen = STIR_WINDOW;
      this.stirTimer = STIR_EVERY;
      this.stirPrompts++;
      this.say('Sira: «¡Revuelve!»', 800);
    }
    if (Controls.consume('interact')) {
      this.stirAnim = 1;
      if (this.stirOpen > 0) {
        this.stirOpen = 0;
        this.stirs++;
        this.float('¡bien!', '#a8f0a0', 160, 84);
        playSfx('sarten');
      }
    }
    this.stirAnim = Math.max(0, this.stirAnim - dt * 2);
    for (const s of this.smoke) {
      s.y -= dt * 18;
      s.life -= dt * 0.7;
    }
    this.smoke = this.smoke.filter((s) => s.life > 0);
    if (elapsed >= SOFRITO_S + 2.6) {
      const zoneOk = this.inZone / SOFRITO_S >= 0.55;
      const stirOk = this.stirPrompts === 0 || this.stirs / this.stirPrompts >= 0.6;
      const ok = zoneOk && stirOk;
      this.teamwork = ok;
      this.finishStage(
        ok,
        ok
          ? 'El sofrito huele a domingo en casa de abuela.\nAhora la carne, el tomate, el laurel... y a fuego lento.'
          : !zoneOk
            ? 'Se quemó un poquito la cebolla. Sira raspa la sartén.\n«Le da carácter», dice. Mentira.'
            : 'Se pegó un poquito al fondo. Sira: «Eso es lo más rico, el pegado.»',
      );
    }
  }

  private updateNoodles(dt: number): void {
    if (!this.drained) this.minutes += dt / SEC_PER_MIN;
    for (const n of this.wallNoodles) {
      if (n.stuck) continue;
      n.vy += dt * 120;
      n.y += n.vy * dt;
    }
    this.wallNoodles = this.wallNoodles.filter((n) => n.stuck || n.y < COUNTER_Y);
    if (Controls.consume('interact') && this.tastes < 4) {
      this.tastes++;
      const m = this.minutes;
      const txt = m < 6 ? 'Duro, duro. Cruje.' : m < DENTE[0] ? 'Casi... todavía firme.' : m <= DENTE[1] ? '¡Al dente! Justo.' : m < 11 ? 'Blandito... ¡cuela ya!' : 'Puré de fideo.';
      this.say(`Pruebas uno: ${txt}`, 1500);
      playSfx('eat');
    }
    if (Controls.consume('up')) {
      const stuck = this.minutes >= DENTE[0] - 0.4 && this.minutes <= DENTE[1] + 1.5;
      this.wallNoodles.push({ x: 110 + Math.random() * 30, y: 36 + Math.random() * 20, stuck, vy: 0 });
      this.say(stuck ? 'Sira: «¡Se pegó! Mi abuela dice que así se sabe.»' : 'El fideo se resbala por la pared. Sira: «Todavía no.»', 1500);
      playSfx('golpe');
    }
    const drain = Controls.consume('trick');
    if (drain || this.minutes >= FIDEOS_MAX) {
      this.drained = true;
      const m = this.minutes;
      const ok = m >= DENTE[0] && m <= DENTE[1];
      playSfx('splash');
      this.finishStage(
        ok,
        ok
          ? `Colados a los ${m.toFixed(1)} minutos: al dente.\nSira: «Ahora sí: italiano honorario.»`
          : m < DENTE[0]
            ? `Colados a los ${m.toFixed(1)} minutos: un poco duros.\nSira: «Crujientes. Es tendencia.»`
            : `Colados a los ${m.toFixed(1)} minutos: blanditos.\nSira: «Como los de la cafetería de la U.»`,
      );
    }
  }

  private updatePlating(_dt: number): void {
    this.ladle = Math.sin(this.t * (2.4 + this.drops.length * 0.5));
    if (!Controls.consume('interact')) return;
    const x = PLATE_X + this.ladle * 44;
    this.drops.push(x);
    playSfx(this.drops.length === 2 ? 'splash' : 'blip');
    const err = Math.abs(x - PLATE_X);
    this.float(err < 6 ? '¡al centro!' : err < 14 ? 'casi' : '¡uy!', err < 6 ? '#a8f0a0' : err < 14 ? '#f8e070' : '#f8c070', x, 90);
    if (this.drops.length >= 3) {
      const avg = this.drops.reduce((a, d) => a + Math.abs(d - PLATE_X), 0) / 3;
      const ok = avg < 9;
      this.finishStage(
        ok,
        ok
          ? 'Un nido de fideos, la boloñesa encima, queso y una hojita de albahaca.\nSira le saca una foto antes de comer.'
          : 'Quedó... rústico. La salsa salpicó el borde del plato.\nSira lo limpia con el dedo y se lo come. «Listo, perfecto.»',
      );
    }
  }

  private updateFloats(dt: number): void {
    for (const f of this.floats) {
      f.life -= dt;
      f.t.setY(Math.round(f.t.y - dt * 14)).setAlpha(Math.min(1, f.life * 2));
    }
    for (const f of this.floats.filter((x) => x.life <= 0)) f.t.destroy();
    this.floats = this.floats.filter((x) => x.life > 0);
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private render(): void {
    const g = this.g;
    g.clear();
    this.hud.clear();
    this.drawKitchen(g);
    this.drawFigures();
    if (this.stage === 'cebolla') this.drawOnion(g);
    else if (this.stage === 'zanahoria') this.drawVeg(g);
    else if (this.stage === 'sofrito') this.drawSofrito(g);
    else if (this.stage === 'fideos') this.drawNoodles(g);
    else this.drawPlating(g);
    this.front.clear();
    this.drawCounterFront(this.front);
    this.drawHud();
    // Los ojos llorosos: todo se ve borroso y con brillos.
    this.blur.clear();
    if (this.stage === 'cebolla' && this.teary > 0) {
      const a = Math.min(0.55, this.teary * 0.3);
      this.blur.fillStyle(0xbcd8f0, a).fillRect(0, 16, BASE_WIDTH, BASE_HEIGHT - 30);
      for (let i = 0; i < 6; i++) this.blur.fillStyle(0xffffff, a * 0.8).fillCircle(60 + i * 40 + Math.sin(this.t * 2 + i) * 6, 70 + Math.cos(this.t + i) * 10, 10);
    }
  }

  private drawKitchen(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xf4f0ea, 1).fillRect(0, 0, BASE_WIDTH, COUNTER_Y);
    // Baldosas del salpicadero.
    g.fillStyle(0xe4ecf0, 1).fillRect(0, COUNTER_Y - 34, BASE_WIDTH, 34);
    for (let x = 0; x < BASE_WIDTH; x += 10) g.fillStyle(0xc8d4dc, 1).fillRect(x, COUNTER_Y - 34, 1, 34);
    for (let y = COUNTER_Y - 34; y < COUNTER_Y; y += 8) g.fillStyle(0xc8d4dc, 1).fillRect(0, y, BASE_WIDTH, 1);
    // La ventana del piso 8: los Farallones y Pance, de día.
    g.fillStyle(0x3a3c44, 1).fillRect(218, 10, 84, 60);
    g.fillStyle(0xa8d0ec, 1).fillRect(221, 13, 78, 54);
    g.fillStyle(0x5a8c78, 1).fillTriangle(221, 50, 250, 26, 280, 50).fillTriangle(255, 50, 285, 30, 299, 44).fillRect(221, 48, 78, 4);
    g.fillStyle(0x58a048, 1).fillRect(221, 52, 78, 15);
    g.fillStyle(0xe8e0d0, 1).fillRect(230, 56, 8, 5).fillRect(262, 58, 6, 4);
    g.fillStyle(0xd4703c, 1).fillRect(246, 55, 10, 7);
    g.fillStyle(0x3a3c44, 1).fillRect(259, 13, 2, 54);
    // Repisa con frascos y el póster de Valparaíso.
    g.fillStyle(0x8a5a3a, 1).fillRect(20, 34, 70, 3);
    for (const [x, c] of [[24, 0xe85a5a], [34, 0xf0c830], [44, 0x58b868], [56, 0xe8e8f0], [68, 0xc868c8]] as const) g.fillStyle(c, 1).fillRect(x, 24, 7, 10);
    const px = 22;
    const py = 44;
    g.fillStyle(0x2a2433, 1).fillRect(px, py, 40, 30);
    g.fillStyle(0x88c0e8, 1).fillRect(px + 2, py + 2, 36, 26);
    [0xe85a5a, 0xf0c830, 0x58b868, 0xc868c8, 0x5a8ce8].forEach((c, i) => g.fillStyle(c, 1).fillRect(px + 4 + i * 7, py + 12 - (i % 3), 5, 12 + (i % 3)));
    g.fillStyle(0x3c6ca8, 1).fillRect(px + 2, py + 24, 36, 4);
  }

  private drawFigures(): void {
    const f = this.figs;
    f.clear();
    const top = COUNTER_Y - 46;
    const me: SideFigureOpts = { dir: 1, scale: 1, eyes: this.teary > 0 ? 'closed' : 'open' };
    const her: SideFigureOpts = { dir: -1, scale: 0.94, eyes: 'open' };
    const bob = Math.round(Math.sin(this.t * 4) * 0.6);
    f.save();
    f.translateCanvas(54, top + bob);
    drawSideBody(f, this.meLook, me);
    drawSideArm(f, this.meLook, me, true);
    f.restore();
    f.save();
    f.translateCanvas(246, top + 3 - bob);
    drawSideBody(f, this.siraLook, her);
    drawSideArm(f, this.siraLook, her, this.stage === 'zanahoria' || this.handMs > 0);
    f.restore();
    // Lágrimas de cebolla.
    if (this.stage === 'cebolla' && this.tears > 0.4) {
      const k = Math.floor(this.t * 6) % 3;
      f.fillStyle(0xa8e0ff, 1).fillRect(69, top + 13 + k * 3, 1, 2);
    }
  }

  private drawCounterFront(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xe8e4dc, 1).fillRect(0, COUNTER_Y, BASE_WIDTH, 8);
    g.fillStyle(0xbcb6aa, 1).fillRect(0, COUNTER_Y + 8, BASE_WIDTH, 2);
    g.fillStyle(0x5a6c7c, 1).fillRect(0, COUNTER_Y + 10, BASE_WIDTH, BASE_HEIGHT - COUNTER_Y - 10);
    for (let x = 8; x < BASE_WIDTH; x += 52) {
      g.fillStyle(0x3c4c5a, 1).fillRect(x, COUNTER_Y + 14, 44, 34);
      g.fillStyle(0x6a7c8c, 1).fillRect(x + 2, COUNTER_Y + 16, 40, 30);
      g.fillStyle(0xc8ccd4, 1).fillRect(x + 20, COUNTER_Y + 20, 4, 2);
    }
  }

  private board(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x7a4c30, 1).fillRect(BOARD_X, COUNTER_Y - 6, BOARD_W, 6);
    g.fillStyle(0xc89c6c, 1).fillRect(BOARD_X, COUNTER_Y - 8, BOARD_W, 3);
  }

  private drawOnion(g: Phaser.GameObjects.Graphics): void {
    this.board(g);
    // La cebolla de lado: media esfera morada clara con capas.
    const cy = COUNTER_Y - 8;
    g.fillStyle(0x2a2433, 1).fillEllipse(160, cy - 10, 62, 26);
    g.fillStyle(0xe8d0e4, 1).fillEllipse(160, cy - 10, 58, 22);
    g.fillStyle(0xd0a8cc, 1).fillEllipse(160, cy - 12, 46, 14);
    g.fillStyle(0xf4e8f0, 1).fillEllipse(160, cy - 13, 30, 8);
    g.fillStyle(0xe8d0e4, 1).fillRect(129, cy - 10, 62, 10);
    // Las marcas (dónde cortar) y los cortes hechos.
    for (let i = 0; i < CUTS; i++) {
      const x = Math.round(this.markX(i));
      if (i === this.cutsDone.length) g.fillStyle(0x58c070, 1).fillRect(x, cy - 26, 1, 4).fillRect(x - 1, cy - 28, 3, 2);
      else if (i > this.cutsDone.length) g.fillStyle(0x9a8aa8, 1).fillRect(x, cy - 24, 1, 2);
    }
    for (const x of this.cutsDone) g.fillStyle(0x8a5a88, 1).fillRect(Math.round(x), cy - 21, 1, 21);
    // El cuchillo.
    if (this.phase === 'play') {
      const x = Math.round(ONION_X0 + this.knife * (ONION_X1 - ONION_X0));
      g.fillStyle(0x2a2433, 1).fillRect(x - 1, cy - 52, 3, 30);
      g.fillStyle(0xd0d6e0, 1).fillRect(x, cy - 50, 1, 26);
      g.fillStyle(0x3a2418, 1).fillRect(x - 2, cy - 62, 5, 11);
    }
  }

  private drawVeg(g: Phaser.GameObjects.Graphics): void {
    this.board(g);
    const cy = COUNTER_Y - 8;
    // La zanahoria se acorta y los cubitos se apilan.
    const carrotLeft = this.veg === 'zanahoria' ? 1 - this.vegProgress : this.carrotOk ? 0 : 0.3;
    const len = Math.round(56 * carrotLeft);
    if (len > 0) {
      g.fillStyle(0x2a2433, 1).fillRect(118, cy - 9, len + 2, 9);
      g.fillStyle(0xe88838, 1).fillRect(119, cy - 8, len, 7);
      g.fillStyle(0x58a048, 1).fillRect(116, cy - 10, 4, 3).fillRect(114, cy - 12, 3, 3);
    }
    const cubes = Math.round((1 - carrotLeft) * 14);
    for (let i = 0; i < cubes; i++) g.fillStyle(i % 2 ? 0xe88838 : 0xf0a050, 1).fillRect(180 + (i % 5) * 4, cy - 4 - Math.floor(i / 5) * 3, 3, 3);
    // El tomate en el rallador y la pulpa en el bol.
    g.fillStyle(0x2a2433, 1).fillRect(196, cy - 26, 14, 26);
    g.fillStyle(0xc8ccd4, 1).fillRect(197, cy - 25, 12, 24);
    for (let y = cy - 23; y < cy - 2; y += 3) g.fillStyle(0x8a909c, 1).fillRect(199, y, 8, 1);
    const tomato = this.veg === 'tomate' ? 1 - this.vegProgress : 1;
    if (tomato > 0.05) {
      const r = Math.max(2, Math.round(8 * tomato));
      const ty = this.veg === 'tomate' ? cy - 14 + (this.lastKey === 'a' ? -2 : 2) : cy - 34;
      g.fillStyle(0xd83c3c, 1).fillCircle(203, ty, r);
      g.fillStyle(0x58a048, 1).fillRect(202, ty - r - 1, 3, 2);
    }
    g.fillStyle(0x2a2433, 1).fillEllipse(222, cy - 3, 22, 9);
    g.fillStyle(0xf4f0e8, 1).fillEllipse(222, cy - 4, 20, 7);
    if (this.veg === 'tomate') g.fillStyle(0xc83030, 1).fillEllipse(222, cy - 5, Math.round(16 * this.vegProgress) + 1, 4);
    // Sira pela otra zanahoria a su lado.
    const peel = Math.round(20 * (1 - this.siraPeel));
    g.fillStyle(0xe88838, 1).fillRect(232, cy - 30, 4, 22);
    g.fillStyle(0xc87028, 1).fillRect(232, cy - 30, 4, peel);
    // Barra de progreso del paso.
    this.progressBar(g, 120, 24, 80, this.vegProgress, this.veg === 'zanahoria' ? 0xe88838 : 0xd83c3c);
    const time = (this.veg === 'zanahoria' ? 9 : 8) - this.vegTime;
    this.hud.fillStyle(0x2a2433, 0.8).fillRoundedRect(206, 20, 30, 12, 3);
    this.sayHud(`${Math.max(0, Math.ceil(time))} s`);
  }

  private drawSofrito(g: Phaser.GameObjects.Graphics): void {
    const cy = COUNTER_Y - 6;
    // La cocina: la perilla y la llama.
    g.fillStyle(0x2a2a30, 1).fillRect(118, cy - 2, 84, 8);
    const flameH = Math.round(3 + this.flame * 9);
    for (let i = 0; i < 7; i++) {
      const x = 134 + i * 8;
      const h = flameH + Math.round(Math.sin(this.t * 14 + i) * 2);
      g.fillStyle(0x3c78e8, 1).fillTriangle(x - 3, cy - 2, x + 3, cy - 2, x, cy - 2 - h);
      g.fillStyle(0xf8e070, 0.8).fillTriangle(x - 1, cy - 2, x + 1, cy - 2, x, cy - 2 - Math.round(h / 2));
    }
    // La sartén con el sofrito (cambia de color con la temperatura).
    g.fillStyle(0x2a2433, 1).fillRect(122, cy - 14, 76, 10);
    g.fillStyle(0x3a3a44, 1).fillRect(124, cy - 13, 72, 8);
    g.fillStyle(0x3a3a44, 1).fillRect(196, cy - 12, 34, 4);
    const burnt = this.temp > 0.85;
    const raw = this.temp < 0.35;
    const sauce = burnt ? 0x5a2a18 : raw ? 0xe8d8c0 : 0xc87838;
    g.fillStyle(sauce, 1).fillRect(126, cy - 17, 68, 5);
    for (let i = 0; i < 10; i++) {
      const bx = 128 + ((i * 37) % 64);
      const by = cy - 17 - Math.round(Math.abs(Math.sin(this.t * (3 + this.temp * 6) + i)) * this.temp * 4);
      g.fillStyle(i % 3 === 0 ? 0xe88838 : i % 3 === 1 ? 0xd83c3c : 0xf4e8d0, 1).fillRect(bx, by, 2, 2);
    }
    // La cuchara de palo (y las manos, cuando Sira ayuda).
    const sx = 160 + Math.round(Math.sin(this.stirAnim * 6) * 14);
    g.fillStyle(0x2a2433, 1).fillRect(sx - 1, cy - 52, 4, 38);
    g.fillStyle(0xc8945c, 1).fillRect(sx, cy - 51, 2, 36);
    if (this.handMs > 0 || this.stirAnim > 0) {
      g.fillStyle(0x2a2433, 1).fillRect(sx - 4, cy - 46, 9, 7);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(this.meLook.skin).color, 1).fillRect(sx - 3, cy - 45, 7, 5);
      if (this.handMs > 0) {
        g.fillStyle(0x2a2433, 1).fillRect(sx - 4, cy - 50, 9, 6);
        g.fillStyle(Phaser.Display.Color.HexStringToColor(this.siraLook.skin).color, 1).fillRect(sx - 3, cy - 49, 7, 4);
      }
    }
    for (const s of this.smoke) g.fillStyle(0x6a6a74, s.life * 0.6).fillCircle(s.x, s.y, 4 + (1 - s.life) * 6);
    // El termómetro de la sartén.
    const h = this.hud;
    h.fillStyle(0x2a3a58, 1).fillRoundedRect(110, 22, 100, 10, 4);
    h.fillStyle(0x58c070, 1).fillRect(110 + 45, 23, 25, 8);
    h.fillStyle(0xd85a3a, 1).fillRect(110 + 85, 23, 14, 8);
    h.fillStyle(0xf8e070, 1).fillRect(110 + Math.round(Phaser.Math.Clamp(this.temp, 0, 1) * 98), 19, 3, 16);
    if (this.stirOpen > 0) h.fillStyle(0xa8f0a0, 1).fillCircle(222, 27, 5);
    this.progressBar(g, 120, 38, 80, Math.min(1, this.phaseMs / 1000 / SOFRITO_S), 0x8ae08a);
  }

  private drawNoodles(g: Phaser.GameObjects.Graphics): void {
    const cy = COUNTER_Y - 6;
    g.fillStyle(0x2a2a30, 1).fillRect(130, cy - 2, 60, 8);
    // La olla con el agua hirviendo.
    g.fillStyle(0x2a2433, 1).fillRect(134, cy - 34, 52, 32);
    g.fillStyle(0x9ca4b0, 1).fillRect(136, cy - 33, 48, 30);
    g.fillStyle(0xc8d0dc, 1).fillRect(136, cy - 33, 48, 3);
    g.fillStyle(0x3a3a44, 1).fillRect(128, cy - 28, 6, 3).fillRect(186, cy - 28, 6, 3);
    if (!this.drained) {
      for (let i = 0; i < 6; i++) {
        const k = (this.t * 1.5 + i * 0.37) % 1;
        g.fillStyle(0xf4f8fc, 1 - k).fillCircle(140 + i * 8, cy - 38 - k * 20, 2 + k * 3);
      }
      for (let i = 0; i < 5; i++) g.fillStyle(0xf0dca0, 1).fillRect(142 + i * 8, cy - 36, 1, 6);
    }
    // Los fideos tirados a la pared (los que se pegaron se quedan).
    for (const n of this.wallNoodles) {
      g.fillStyle(0xf0dca0, 1).fillRect(Math.round(n.x), Math.round(n.y), 1, 9).fillRect(Math.round(n.x) + 1, Math.round(n.y) + 4, 1, 5);
    }
    // El reloj de la olla.
    const h = this.hud;
    const cx = 230;
    const cyc = 44;
    h.fillStyle(0x2a2433, 1).fillCircle(cx, cyc, 15);
    h.fillStyle(0xf8f8f0, 1).fillCircle(cx, cyc, 13);
    const a0 = -Math.PI / 2;
    const span = (2 * Math.PI) / FIDEOS_MAX;
    h.fillStyle(0x8ae08a, 1).slice(cx, cyc, 12, a0 + DENTE[0] * span, a0 + DENTE[1] * span, false).fillPath();
    const a = a0 + Math.min(this.minutes, FIDEOS_MAX) * span;
    h.lineStyle(2, 0xd83c3c, 1).lineBetween(cx, cyc, cx + Math.cos(a) * 11, cyc + Math.sin(a) * 11);
    this.sayHud(`${this.minutes.toFixed(1)} min · probaste ${this.tastes}`);
  }

  private drawPlating(g: Phaser.GameObjects.Graphics): void {
    const cy = COUNTER_Y - 2;
    // El plato blanco (de lado) y lo que ya cayó.
    g.fillStyle(0x2a2433, 1).fillEllipse(PLATE_X, cy - 3, 64, 12);
    g.fillStyle(0xf8f8f0, 1).fillEllipse(PLATE_X, cy - 4, 60, 9);
    const colors = [0xf0dca0, 0xb8482c, 0xf8f0c8];
    this.drops.forEach((x, i) => {
      if (i === 0) {
        g.fillStyle(colors[0], 1).fillEllipse(x, cy - 9, 30, 10);
        for (let k = 0; k < 5; k++) g.fillStyle(0xd8c080, 1).fillRect(x - 12 + k * 6, cy - 12, 4, 1);
      } else if (i === 1) {
        g.fillStyle(colors[1], 1).fillEllipse(x, cy - 13, 22, 7);
        g.fillStyle(0xd86040, 1).fillRect(x - 6, cy - 16, 4, 2);
      } else {
        g.fillStyle(colors[2], 1).fillRect(x - 6, cy - 17, 12, 2);
        g.fillStyle(0x3c9050, 1).fillEllipse(x + 2, cy - 19, 7, 4);
      }
    });
    if (this.phase === 'play' && this.drops.length < 3) {
      const x = Math.round(PLATE_X + this.ladle * 44);
      g.fillStyle(0x2a2433, 1).fillRect(x + 6, 40, 3, 30);
      g.fillStyle(0xc8ccd4, 1).fillRect(x + 7, 41, 1, 28);
      g.fillStyle(0x2a2433, 1).fillEllipse(x, 72, 18, 9);
      g.fillStyle(0xc8ccd4, 1).fillEllipse(x, 71, 16, 7);
      g.fillStyle(colors[this.drops.length], 1).fillEllipse(x, 70, 12, 4);
      g.fillStyle(0x58c070, 1).fillRect(PLATE_X - 1, 76, 2, 4);
    }
  }

  private progressBar(_g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, v: number, color: number): void {
    const h = this.hud;
    h.fillStyle(0x2a3a58, 1).fillRoundedRect(x, y, w, 5, 2);
    h.fillStyle(color, 1).fillRoundedRect(x, y, Math.max(2, w * Phaser.Math.Clamp(v, 0, 1)), 5, 2);
  }

  private hudCache = '';

  private sayHud(s: string): void {
    const text = `${this.part === 1 ? 'Parte 1' : 'Parte 2'} · ${this.stageIdx + 1}/${this.stages.length} · ${TITLES[this.stage]}   ${s}`;
    if (text === this.hudCache) return;
    this.hudCache = text;
    this.titleText.setText(text);
  }

  private drawHud(): void {
    const h = this.hud;
    h.fillStyle(0x0c1020, 0.75).fillRect(0, 0, BASE_WIDTH, 15);
    h.fillStyle(0x0c1020, 0.75).fillRect(0, BASE_HEIGHT - 13, BASE_WIDTH, 13);
    for (let i = 0; i < this.stages.length; i++) {
      const done = i < this.stageIdx || (i === this.stageIdx && this.phase !== 'play' && this.phase !== 'intro');
      const c = done ? 0xf8e070 : 0x3a4060;
      h.fillStyle(c, 1).fillCircle(BASE_WIDTH - 50 + i * 12, 7, 4);
    }
    if (this.stage === 'cebolla') {
      // Las lágrimas: una gota que se llena.
      h.fillStyle(0x2a3a58, 1).fillRoundedRect(110, 22, 100, 6, 3);
      h.fillStyle(this.tears > 0.75 ? 0x58c8f0 : 0xa8e0ff, 1).fillRoundedRect(110, 22, Math.max(2, 100 * Math.min(1, this.tears)), 6, 3);
      this.sayHud(`cortes ${this.cutsDone.length}/${CUTS} · lágrimas`);
    }
  }

  private say(text: string, ms: number): void {
    this.sayText.setText(text).setPosition(196, 66).setVisible(true);
    this.sayMs = ms;
  }

  private float(text: string, color: string, x: number, y: number): void {
    const t = this.addText(Math.round(x), y, text, { fontSize: '8px', fontStyle: '600', color, stroke: '#14182a', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(12);
    this.floats.push({ t, life: 1.1 });
  }

  private banner(text: string, ms: number): void {
    this.bannerText.setText(text).setVisible(true);
    const b = this.bannerText.getBounds();
    this.bannerBg.clear().fillStyle(0xfbf6ee, 0.96).fillRoundedRect(b.x - 8, b.y - 6, b.width + 16, b.height + 12, 6).setVisible(true);
    this.bannerBg.lineStyle(1, 0x2a2433, 1).strokeRoundedRect(b.x - 8, b.y - 6, b.width + 16, b.height + 12, 6);
    if (ms > 0) this.time.delayedCall(ms, () => this.hideBanner());
  }

  private hideBanner(): void {
    this.bannerText.setVisible(false);
    this.bannerBg.setVisible(false);
  }
}
