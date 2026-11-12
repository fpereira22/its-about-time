import Phaser from 'phaser';
import { BASE_WIDTH, FONT_HUD } from '../config/display';
import { EventSystem } from '../systems/EventSystem';
import { currentMission, formatClock, formatDayClock, hasStoryClock } from '../systems/Mission';
import { formatMoney, formatTime, StoryState, type Weather } from '../systems/StoryState';
import { drawPanel, fitText, makeText, THEME } from './theme';

const MARGIN = 4;
const LEFT_MAX_TEXT = 146;
const PANEL_ALPHA = 0.92;
/** Opacidad del panel cuando el jugador camina por debajo (para ver lo que tapa, ej. la cocina). */
const FADED_ALPHA = 0.22;
/** Holgura (px) alrededor del jugador para empezar a desvanecer el panel. */
const FADE_MARGIN = 10;
const FADE_SPEED = 0.008;
/** Flag del desfase (misión 4): el reloj muestra también la hora de Chile, 2 horas más. */
const FLAG_CHILE_CLOCK = 'reloj_chile';
const CHILE_OFFSET_MIN = 120;
/** Objetivo largo: se desplaza (marquesina) en vez de cortarse con «...». */
const OBJ_X = MARGIN + 7;
const SCROLL_SPEED = 22; // px/s hacia el final
const SCROLL_BACK_SPEED = 70; // px/s de vuelta al principio
const SCROLL_HOLD_MS = 1600; // pausa en cada extremo

type WeatherIcon = 'sol' | 'luna' | 'nube' | 'lluvia' | 'tormenta';

/** Temperatura de Cali según la hora (máxima ~30° a las 15:00) y el clima. */
function temperature(weather: Weather, minutes: number): number {
  const h = (minutes / 60) % 24;
  const base = 25 + 5 * Math.sin(((h - 9) / 24) * Math.PI * 2);
  const drop: Record<Weather, number> = { despejado: 0, nublado: 2, lluvia: 5, tormenta: 7 };
  // Misión 8: en Salento (y el Eje Cafetero) hace frío de montaña, unos 9 grados menos que en Cali.
  const frio = StoryState.hasFlag('m8_frio') ? 9 : 0;
  return Math.round(base - drop[weather] - frio);
}

function weatherIcon(weather: Weather, minutes: number): WeatherIcon {
  if (weather === 'lluvia' || weather === 'tormenta') return weather;
  if (weather === 'nublado') return 'nube';
  const h = (minutes / 60) % 24;
  return h >= 6 && h < 18.5 ? 'sol' : 'luna';
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * HUD mínimo: lugar actual y objetivo (arriba a la izquierda); efectivo, saldo Bip! y reloj (arriba a la derecha).
 * El reloj es el cronómetro de la misión, o la hora del día si la misión tiene reloj de la historia.
 * Paneles: izquierda x=4..≤162, derecha pegada al borde derecho; ambos de y=4 a y≤32.
 * Panel derecho en dos columnas: [moneda efectivo] [tarjeta saldo Bip!] arriba y [reloj] abajo.
 * Cada panel se vuelve casi transparente mientras el jugador está debajo de él.
 */
export class Hud {
  private readonly leftBg: Phaser.GameObjects.Graphics;
  private readonly place: Phaser.GameObjects.Text;
  private readonly objective: Phaser.GameObjects.Text;
  private readonly rightBg: Phaser.GameObjects.Graphics;
  private readonly rightIcons: Phaser.GameObjects.Graphics;
  private readonly cash: Phaser.GameObjects.Text;
  private readonly bip: Phaser.GameObjects.Text;
  private readonly clock: Phaser.GameObjects.Text;
  private readonly leftParts: Array<Phaser.GameObjects.Components.AlphaSingle>;
  private readonly rightParts: Array<Phaser.GameObjects.Components.AlphaSingle>;
  private leftRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private rightRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private leftAlpha = 1;
  private rightAlpha = 1;
  private placeName = '';
  private rightLayout = '';
  /** Ícono del clima en vez de la tarjeta Bip! (null: misiones sin clima). */
  private icon: WeatherIcon | null = null;
  private lastIcon = '';
  /** Marquesina del objetivo: cuánto sobra, cuánto va desplazado, hacia dónde y cuánto falta de pausa. */
  private objValue = '';
  private objOverflow = 0;
  private objOffset = 0;
  private objDir: 1 | -1 = 1;
  private objHold = SCROLL_HOLD_MS;

  constructor(scene: Phaser.Scene) {
    this.leftBg = scene.add.graphics();
    this.place = makeText(scene, MARGIN + 7, MARGIN + 4, '', { fontFamily: FONT_HUD, fontSize: '8px' });
    this.objective = makeText(scene, OBJ_X, MARGIN + 14, '', { fontSize: '9px', color: '#b8c4e0' });
    // Recorte: el objetivo solo se ve dentro del panel (lo que sobra entra desplazándose).
    const objMask = scene.make.graphics({}, false);
    objMask.fillRect(OBJ_X, MARGIN + 11, LEFT_MAX_TEXT, 16);
    this.objective.setMask(objMask.createGeometryMask());

    this.rightBg = scene.add.graphics();
    this.rightIcons = scene.add.graphics();
    this.cash = makeText(scene, 0, MARGIN + 4, '', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f8e070' });
    this.bip = makeText(scene, 0, MARGIN + 4, '', { fontFamily: FONT_HUD, fontSize: '8px' });
    this.clock = makeText(scene, 0, MARGIN + 15, '', { fontFamily: FONT_HUD, fontSize: '8px' });

    scene.add
      .container(0, 0, [this.leftBg, this.place, this.objective, this.rightBg, this.rightIcons, this.cash, this.bip, this.clock])
      .setDepth(40);
    this.leftParts = [this.leftBg, this.place, this.objective];
    this.rightParts = [this.rightBg, this.rightIcons, this.cash, this.bip, this.clock];

    EventSystem.onScene(scene, 'location-changed', ({ name }) => {
      this.placeName = name;
      this.layoutLeft();
    });
    EventSystem.onScene(scene, 'objective-changed', () => this.layoutLeft());
    EventSystem.onScene(scene, 'state-changed', () => this.update());
    this.layoutLeft();
    this.update();
  }

  /**
   * Llamar cada frame: desvanece los paneles que tapan al jugador (`player`: sus pies en px de pantalla)
   * y refresca efectivo, saldo y reloj solo si cambiaron.
   */
  update(delta = 0, player?: { x: number; y: number }): void {
    const near = (r: Rect): boolean =>
      player !== undefined &&
      player.x + 8 + FADE_MARGIN > r.x &&
      player.x - 8 - FADE_MARGIN < r.x + r.w &&
      player.y + FADE_MARGIN > r.y &&
      player.y - 16 - FADE_MARGIN < r.y + r.h;
    this.leftAlpha = this.fade(this.leftParts, this.leftAlpha, near(this.leftRect) ? FADED_ALPHA : 1, delta);
    this.rightAlpha = this.fade(this.rightParts, this.rightAlpha, near(this.rightRect) ? FADED_ALPHA : 1, delta);
    this.scrollObjective(delta);

    const cash = formatMoney(StoryState.money);
    // Con clima (misión 4, en Cali) se muestra el tiempo en vez del saldo de la Bip!.
    const weather = currentMission().weather !== undefined;
    const bip = weather ? `${temperature(StoryState.weather, StoryState.clock)}°` : formatMoney(StoryState.bip);
    this.icon = weather ? weatherIcon(StoryState.weather, StoryState.clock) : null;
    // Misiones con hora del día (ej. la 2) muestran la hora; las demás, el cronómetro.
    let clock = hasStoryClock() ? formatDayClock(StoryState.clock) : formatTime(StoryState.playTimeMs);
    if (StoryState.hasFlag(FLAG_CHILE_CLOCK)) clock += ` · CL ${formatClock(StoryState.clock + CHILE_OFFSET_MIN)}`;
    if (cash === this.cash.text && bip === this.bip.text && clock === this.clock.text && `${this.icon}` === this.lastIcon) return;
    this.lastIcon = `${this.icon}`;
    this.cash.setText(cash);
    this.bip.setText(bip);
    this.clock.setText(clock);
    this.layoutRight();
  }

  private fade(parts: Array<Phaser.GameObjects.Components.AlphaSingle>, current: number, target: number, delta: number): number {
    if (current === target) return current;
    const step = FADE_SPEED * delta;
    const next = current < target ? Math.min(target, current + step) : Math.max(target, current - step);
    for (const p of parts) p.setAlpha(next);
    return next;
  }

  private layoutLeft(): void {
    fitText(this.place, this.placeName.toUpperCase(), LEFT_MAX_TEXT);
    const objective = StoryState.objective;
    if (objective !== this.objValue) {
      this.objValue = objective;
      this.objective.setText(objective);
      this.objOverflow = Math.max(0, Math.ceil(this.objective.width - LEFT_MAX_TEXT));
      this.objOffset = 0;
      this.objDir = 1;
      this.objHold = SCROLL_HOLD_MS;
      this.objective.setX(OBJ_X);
    }
    this.objective.setVisible(objective !== '');
    const contentW = Math.max(this.place.width, objective ? Math.min(this.objective.width, LEFT_MAX_TEXT) : 0);
    const w = Math.ceil(contentW) + 14;
    const h = objective ? 28 : 16;
    this.leftBg.clear();
    this.leftRect = { x: MARGIN, y: MARGIN, w, h };
    if (this.placeName === '' && objective === '') return;
    drawPanel(this.leftBg, MARGIN, MARGIN, w, h, { radius: 5, fill: THEME.dark, edge: 0x5a6a90, alpha: PANEL_ALPHA, shadow: false });
  }

  /** Objetivo que no cabe: pausa, se desplaza hasta el final, pausa y vuelve al principio. */
  private scrollObjective(delta: number): void {
    if (this.objOverflow <= 0 || delta <= 0) return;
    if (this.objHold > 0) {
      this.objHold -= delta;
      return;
    }
    const speed = this.objDir === 1 ? SCROLL_SPEED : SCROLL_BACK_SPEED;
    this.objOffset += (this.objDir * speed * delta) / 1000;
    if (this.objOffset >= this.objOverflow || this.objOffset <= 0) {
      this.objOffset = Phaser.Math.Clamp(this.objOffset, 0, this.objOverflow);
      this.objDir = this.objDir === 1 ? -1 : 1;
      this.objHold = SCROLL_HOLD_MS;
    }
    this.objective.setX(Math.round(OBJ_X - this.objOffset));
  }

  private layoutRight(): void {
    // Columna A: efectivo (arriba) y reloj (abajo). Columna B: saldo Bip!.
    const icon = 12;
    const colA = icon + Math.ceil(Math.max(this.cash.width, this.clock.width));
    const colB = icon + Math.ceil(this.bip.width);
    const w = 7 + colA + 10 + colB + 7;
    const right = BASE_WIDTH - MARGIN;
    const x = right - w;
    const ax = x + 7;
    const bx = ax + colA + 10;
    this.cash.setX(ax + icon);
    this.clock.setX(ax + icon);
    this.bip.setX(bx + icon);

    this.rightRect = { x, y: MARGIN, w, h: 28 };
    const layout = `${x}:${bx}:${this.icon}`;
    if (layout === this.rightLayout) return;
    this.rightLayout = layout;

    this.rightBg.clear();
    drawPanel(this.rightBg, x, MARGIN, w, 28, { radius: 5, fill: THEME.dark, edge: 0x5a6a90, alpha: PANEL_ALPHA, shadow: false });

    // Íconos vectoriales: moneda, tarjeta Bip! y reloj.
    const g = this.rightIcons.clear();
    const top = MARGIN + 7.5;
    g.fillStyle(0xc89820, 1).fillCircle(ax + 4, top, 4);
    g.fillStyle(0xf0c030, 1).fillCircle(ax + 4, top, 3);
    g.fillStyle(0xc89820, 1).fillRect(ax + 3.5, top - 2, 1, 4);
    if (this.icon) drawWeatherIcon(g, bx + 4, top, this.icon);
    else {
      g.fillStyle(0x3cb4c8, 1).fillRoundedRect(bx - 1, MARGIN + 4, 10, 7, 1.5);
      g.fillStyle(0x2a8c9c, 1).fillRect(bx - 1, MARGIN + 5, 10, 1.5);
      g.fillStyle(0xf0c030, 1).fillRect(bx + 1, MARGIN + 7.5, 3, 2);
    }
    const cy = MARGIN + 19.5;
    g.lineStyle(1, 0xffffff, 1).strokeCircle(ax + 4, cy, 3.5);
    g.lineBetween(ax + 4, cy, ax + 4, cy - 2.5).lineBetween(ax + 4, cy, ax + 6, cy);
  }
}

/** Ícono del clima (centro en cx, cy; ~10 px): sol, luna, nube, lluvia o tormenta. */
function drawWeatherIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, icon: WeatherIcon): void {
  if (icon === 'sol') {
    g.fillStyle(0xf0c030, 1).fillCircle(cx, cy, 2.5);
    g.lineStyle(1, 0xf0c030, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.lineBetween(cx + Math.cos(a) * 3.5, cy + Math.sin(a) * 3.5, cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
    }
    return;
  }
  if (icon === 'luna') {
    g.fillStyle(0xe8e4c8, 1).fillCircle(cx, cy, 3.5);
    g.fillStyle(THEME.dark, 1).fillCircle(cx + 1.8, cy - 1.2, 3);
    return;
  }
  // Nube (y debajo, gotas o un rayo).
  const dy = icon === 'nube' ? 0 : -1.5;
  const cloud = icon === 'tormenta' ? 0x9aa4b8 : icon === 'lluvia' ? 0xc0c8d8 : 0xe8ecf4;
  g.fillStyle(cloud, 1).fillCircle(cx - 2, cy + dy + 0.5, 2.2).fillCircle(cx + 0.5, cy + dy - 0.8, 2.8).fillCircle(cx + 3, cy + dy + 0.8, 2);
  g.fillRect(cx - 2, cy + dy + 0.5, 5, 2.4);
  if (icon === 'lluvia') {
    g.fillStyle(0x7cacec, 1).fillRect(cx - 2, cy + 3, 1, 2).fillRect(cx + 0.5, cy + 4, 1, 2).fillRect(cx + 3, cy + 3, 1, 2);
  } else if (icon === 'tormenta') {
    g.fillStyle(0xf8e070, 1).fillTriangle(cx + 0.5, cy + 1.5, cx - 1.5, cy + 4.5, cx + 0.5, cy + 4.5).fillTriangle(cx + 0.5, cy + 3.5, cx + 2, cy + 3.5, cx - 0.5, cy + 6.5);
  }
}
