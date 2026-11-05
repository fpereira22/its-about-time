import Phaser from 'phaser';
import { playSfx, setAmbient } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH, TILE } from '../config/display';
import { EventSystem } from './EventSystem';
import type { GameMap } from './GameMap';
import { clockMinutes, hasStoryClock } from './Mission';
import { StoryState, type Weather } from './StoryState';

/**
 * Luz del día y clima de la escena de mapa (misiones con reloj de la historia).
 *
 * Exteriores: un velo que multiplica los colores según la hora (amanecer, día, atardecer, noche)
 * y el clima (nublado, lluvia, tormenta); gotas de lluvia, salpicaduras y relámpagos con trueno.
 * Interiores: gotas que corren por las ventanas y el trueno apagado. De noche, las luces de la
 * ciudad (tiles `vista_ciudad`) y las guirnaldas del mapa (`lights`) brillan por encima del velo.
 */

const NIGHT = 0x5a68a8;
const DAY = 0xffffff;
/** Color del velo a cada hora (horas con decimales); entre dos se interpola. */
const SKY: Array<[number, number]> = [
  [0, NIGHT],
  [5.3, NIGHT],
  [6.2, 0xe0aeb0],
  [7, DAY],
  [16.8, DAY],
  [17.6, 0xf8d4a4],
  [18.3, 0xeca484],
  [19, 0xa486b4],
  [19.6, NIGHT],
  [24, NIGHT],
];
const WEATHER_TINT: Record<Weather, number> = { despejado: DAY, nublado: 0xdcdfe6, lluvia: 0xb4bccb, tormenta: 0x949eb2 };
const RAIN_DROPS: Record<Weather, number> = { despejado: 0, nublado: 0, lluvia: 90, tormenta: 190 };
/** Velocidad de caída (px/s) y cuánto se inclina la lluvia con el viento. */
const RAIN_SPEED = 260;
const RAIN_SLANT = 0.28;
const LIGHTNING_MS: [number, number] = [5500, 13000];
const WINDOW_KEYS = /ventana/;
const DEPTH_TINT = 9000;
const DEPTH_GLOW = 9001;
const DEPTH_RAIN = 9002;
const DEPTH_FLASH = 9003;

interface Drop {
  u: number;
  v: number;
  len: number;
  rect: Phaser.GameObjects.Rectangle;
}

interface Glow {
  core: Phaser.GameObjects.Rectangle;
  halo: Phaser.GameObjects.Rectangle;
  base: number;
  flicker: boolean;
}

interface Garland {
  l: MapLights;
  wire: Phaser.GameObjects.Graphics;
  bulbs: Array<{ glow: Glow; i: number }>;
}

/** Guirnalda de ampolletas (campo `lights` del mapa): de (x, y) a lo ancho de `w` tiles. */
export interface MapLights {
  x: number;
  y: number;
  w: number;
}

function lerpColor(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToRGB(a);
  const cb = Phaser.Display.Color.IntegerToRGB(b);
  const mix = (x: number, y: number): number => Math.round(x + (y - x) * t);
  return Phaser.Display.Color.GetColor(mix(ca.r, cb.r), mix(ca.g, cb.g), mix(ca.b, cb.b));
}

function multiply(a: number, b: number): number {
  const ca = Phaser.Display.Color.IntegerToRGB(a);
  const cb = Phaser.Display.Color.IntegerToRGB(b);
  return Phaser.Display.Color.GetColor(Math.round((ca.r * cb.r) / 255), Math.round((ca.g * cb.g) / 255), Math.round((ca.b * cb.b) / 255));
}

/** Color del cielo a la hora `minutes` (minutos desde el domingo). */
export function skyColor(minutes: number): number {
  const h = (minutes / 60) % 24;
  for (let i = 1; i < SKY.length; i++) {
    const [h1, c1] = SKY[i];
    const [h0, c0] = SKY[i - 1];
    if (h <= h1) return lerpColor(c0, c1, (h - h0) / (h1 - h0));
  }
  return NIGHT;
}

/** Qué tan de noche está (0 = día, 1 = noche cerrada), según el velo. */
function darkness(color: number): number {
  const c = Phaser.Display.Color.IntegerToRGB(color);
  return Phaser.Math.Clamp(1 - (c.r + c.g + c.b) / 3 / 255, 0, 1) / 0.6;
}

export class WeatherView {
  private readonly outdoor: boolean;
  private tint: Phaser.GameObjects.Rectangle | null = null;
  private drops: Drop[] = [];
  private splashes: Phaser.GameObjects.Rectangle[] = [];
  private windowDrops: Array<{ rect: Phaser.GameObjects.Rectangle; top: number; bottom: number; speed: number }> = [];
  private glows: Glow[] = [];
  private flash: Phaser.GameObjects.Rectangle | null = null;
  private nextLightning = 0;
  private weather: Weather;
  private tintColor = DAY;
  /** 0 = día, 1 = noche cerrada (cuánto brillan las luces). */
  private dark = 0;
  /** Guirnaldas del mapa, para mecerlas con el viento (ver swayGarlands). */
  private garlands: Garland[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: GameMap,
    lights: MapLights[] = [],
  ) {
    this.outdoor = map.data.kind === 'overworld';
    this.weather = StoryState.weather;
    if (this.outdoor && hasStoryClock()) {
      const w = map.width * TILE;
      const h = map.height * TILE;
      // Con margen: la cámara puede mostrar más allá del mapa si este es más chico que la pantalla.
      this.tint = scene.add
        .rectangle(w / 2, h / 2, w + BASE_WIDTH * 2, h + BASE_HEIGHT * 2, DAY)
        .setBlendMode(Phaser.BlendModes.MULTIPLY)
        .setDepth(DEPTH_TINT);
      this.createCityGlows();
      this.createGarlands(lights);
    }
    this.applyWeather();
    EventSystem.onScene(scene, 'weather', () => {
      this.weather = StoryState.weather;
      this.applyWeather();
    });
    this.update(0);
  }

  update(delta: number): void {
    if (this.tint) {
      const color = multiply(skyColor(clockMinutes()), WEATHER_TINT[this.weather]);
      if (color !== this.tintColor) {
        this.tintColor = color;
        this.tint.setFillStyle(color).setVisible(color !== DAY);
        this.dark = darkness(color);
        for (const g of this.glows) this.lightUp(g);
      }
    }
    if (this.outdoor) this.updateRain(delta);
    else this.updateWindows(delta);
    this.updateLightning(delta);
    // Algunas luces de la ciudad titilan.
    if (this.glows.length > 0 && Math.random() < 0.08) {
      const g = this.glows[Math.floor(Math.random() * this.glows.length)];
      if (g.flicker) {
        g.base = g.base > 0.5 ? 0.3 : 1;
        this.lightUp(g);
      }
    }
  }

  /** Qué tan de noche está (0 = día, 1 = noche cerrada). */
  get darkness(): number {
    return this.tint ? this.dark : 1;
  }

  /**
   * El viento mece las guirnaldas: se comban más y se balancean como péndulo.
   * `wind` va de 0 a 1; `time` en ms (para la oscilación).
   */
  swayGarlands(wind: number, time: number): void {
    this.garlands.forEach((gl, n) => {
      const swing = Math.sin(time / 420 + n * 1.3) * (0.6 + wind * 2.2) - wind * 1.5;
      const sag = 6 + wind * 2.5 + Math.sin(time / 610 + n) * wind * 1.5;
      this.drawGarland(gl, sag, swing);
    });
  }

  private garlandPoint(l: MapLights, i: number, sag: number, swing: number): { x: number; y: number } {
    const shape = Math.sin((i / (l.w * TILE)) * Math.PI);
    return { x: l.x * TILE + i + shape * swing, y: l.y * TILE + shape * sag };
  }

  private drawGarland(gl: Garland, sag: number, swing: number): void {
    const span = gl.l.w * TILE;
    gl.wire.clear();
    gl.wire.lineStyle(1, 0x2a2433, 0.8);
    gl.wire.beginPath();
    for (let i = 0; i <= span; i += 2) {
      const p = this.garlandPoint(gl.l, i, sag, swing);
      if (i === 0) gl.wire.moveTo(p.x, p.y);
      else gl.wire.lineTo(p.x, p.y);
    }
    gl.wire.strokePath();
    for (const b of gl.bulbs) {
      const p = this.garlandPoint(gl.l, b.i, sag, swing);
      const x = Math.round(p.x);
      const y = Math.round(p.y + 1);
      b.glow.core.setPosition(x, y);
      b.glow.halo.setPosition(x, y);
    }
  }

  private lightUp(g: Glow): void {
    g.core.setAlpha(Math.min(1, this.dark * 1.2) * g.base);
    g.halo.setAlpha(Math.min(0.3, this.dark * 0.3) * g.base);
  }

  // -------------------------------------------------------------------------

  private applyWeather(): void {
    const rain = this.weather === 'lluvia' || this.weather === 'tormenta' ? this.weather : 'none';
    setAmbient({ rain, indoor: !this.outdoor });
    for (const d of this.drops) d.rect.destroy();
    for (const s of this.splashes) s.destroy();
    for (const w of this.windowDrops) w.rect.destroy();
    this.drops = [];
    this.splashes = [];
    this.windowDrops = [];
    this.nextLightning = this.weather === 'tormenta' ? Phaser.Math.Between(1500, 4000) : 0;
    this.tintColor = -1;
    if (rain === 'none') return;
    if (this.outdoor) this.createRain(RAIN_DROPS[this.weather]);
    else this.createWindowDrops(this.weather === 'tormenta' ? 3 : 2);
  }

  private createRain(count: number): void {
    const color = this.weather === 'tormenta' ? 0xc8d8f0 : 0xb8c8e8;
    for (let i = 0; i < count; i++) {
      const len = Phaser.Math.Between(4, 7);
      const rect = this.scene.add.rectangle(0, 0, 1, len, color, 0.55).setOrigin(0, 0).setDepth(DEPTH_RAIN).setAngle(-RAIN_SLANT * 57);
      this.drops.push({ u: Math.random() * (BASE_WIDTH + 40) - 20, v: Math.random() * BASE_HEIGHT, len, rect });
    }
    for (let i = 0; i < Math.round(count / 6); i++) {
      this.splashes.push(this.scene.add.rectangle(0, 0, 3, 1, 0xd8e4f4).setAlpha(0).setOrigin(0.5).setDepth(DEPTH_RAIN));
    }
  }

  private updateRain(delta: number): void {
    if (this.drops.length === 0) return;
    const view = this.scene.cameras.main.worldView;
    const dt = delta / 1000;
    for (const d of this.drops) {
      d.v += RAIN_SPEED * dt * (0.8 + d.len / 20);
      d.u -= RAIN_SPEED * RAIN_SLANT * dt;
      if (d.v > view.height + 8 || d.u < -20) {
        d.v = -8 - Math.random() * 20;
        d.u = Math.random() * (view.width + 60);
      }
      d.rect.setPosition(Math.round(view.x + d.u), Math.round(view.y + d.v));
    }
    // Salpicaduras: un guioncito que aparece y se apaga en el suelo.
    for (const s of this.splashes) {
      if (s.alpha <= 0.02 && Math.random() < 0.05) s.setPosition(Math.round(view.x + Math.random() * view.width), Math.round(view.y + Math.random() * view.height)).setAlpha(0.8);
      else s.setAlpha(Math.max(0, s.alpha - dt * 3));
    }
  }

  private createWindowDrops(perWindow: number): void {
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (!WINDOW_KEYS.test(this.map.tileKeyAt(x, y) ?? '')) continue;
        for (let i = 0; i < perWindow; i++) {
          const top = y * TILE + 3;
          const rect = this.scene.add
            .rectangle(x * TILE + 3 + Math.floor(Math.random() * 10), top + Math.random() * 8, 1, 2, 0xe8f4ff, 0.8)
            .setOrigin(0)
            .setDepth(-998);
          this.windowDrops.push({ rect, top, bottom: top + 8, speed: 6 + Math.random() * 10 });
        }
      }
    }
  }

  private updateWindows(delta: number): void {
    for (const w of this.windowDrops) {
      w.rect.y += (w.speed * delta) / 1000;
      if (w.rect.y > w.bottom) w.rect.y = w.top;
    }
  }

  private updateLightning(delta: number): void {
    if (this.weather !== 'tormenta' || this.nextLightning <= 0) return;
    this.nextLightning -= delta;
    if (this.nextLightning > 0) return;
    this.nextLightning = Phaser.Math.Between(...LIGHTNING_MS);
    const view = this.scene.cameras.main.worldView;
    this.flash?.destroy();
    const flash = this.scene.add
      .rectangle(view.centerX, view.centerY, view.width + 40, view.height + 40, 0xf0f4ff, this.outdoor ? 0.75 : 0.25)
      .setDepth(DEPTH_FLASH);
    this.flash = flash;
    // Dos destellos y se apaga.
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 90,
      yoyo: true,
      repeat: 1,
      onComplete: () => this.scene.tweens.add({ targets: flash, alpha: 0, duration: 350, onComplete: () => flash.destroy() }),
    });
    this.scene.time.delayedCall(Phaser.Math.Between(250, 900), () => playSfx('trueno'));
  }

  /** Ventanas encendidas y faroles de la ciudad (tiles `vista_ciudad`), por encima del velo. */
  private createCityGlows(): void {
    const colors = [0xf0c060, 0xf8e0a0, 0xf0a040, 0xa8c8f0, 0xf8f0d0];
    let k = 0;
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        // Faroles coloniales (misión 6, San Antonio): una luz cálida en la lámpara.
        if (this.map.tileKeyAt(x, y) === 'farol_colonial') {
          this.addGlow(x * TILE + 8, y * TILE + 4, 0xfff0b0, false, 3);
          continue;
        }
        if (this.map.tileKeyAt(x, y) !== 'vista_ciudad') continue;
        for (let i = 0; i < 2; i++) {
          k++;
          const px = x * TILE + ((k * 37) % 14) + 1;
          const py = y * TILE + ((k * 53) % 14) + 1;
          this.addGlow(px, py, colors[k % colors.length], k % 4 === 0);
        }
      }
    }
  }

  /** Guirnaldas: ampolletas cálidas colgando en curva. */
  private createGarlands(lights: MapLights[]): void {
    const colors = [0xf8d070, 0xf0a050, 0xf8f0c0, 0xe87860];
    for (const l of lights) {
      const span = l.w * TILE;
      const wire = this.scene.add.graphics().setDepth(DEPTH_GLOW);
      const bulbs: Garland['bulbs'] = [];
      for (let i = 3, n = 0; i < span; i += 7, n++) {
        bulbs.push({ glow: this.addGlow(0, 0, colors[n % colors.length], false, 1.5), i });
      }
      const gl = { l, wire, bulbs };
      this.garlands.push(gl);
      this.drawGarland(gl, 6, 0);
    }
  }

  private addGlow(x: number, y: number, color: number, flicker: boolean, size = 1): Glow {
    const halo = this.scene.add.rectangle(x, y, size + 2, size + 2, color).setAlpha(0).setDepth(DEPTH_GLOW).setBlendMode(Phaser.BlendModes.ADD);
    const core = this.scene.add.rectangle(x, y, Math.ceil(size), Math.ceil(size), color).setAlpha(0).setDepth(DEPTH_GLOW);
    const glow = { core, halo, base: 1, flicker };
    this.glows.push(glow);
    return glow;
  }
}
