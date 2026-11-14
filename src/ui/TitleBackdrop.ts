import Phaser from 'phaser';
import { playSfx, setAmbient } from '../audio/sfx';
import { vehicleKey } from '../art/SpriteRegistry';
import { BASE_HEIGHT, BASE_WIDTH, TILE } from '../config/display';
import { TITLE_BACKDROPS, type BackdropLane, type TitleBackdropDef } from '../data/titleBackdrops';
import { GameMap } from '../systems/GameMap';
import { MISSIONS } from '../systems/Mission';
import { Records } from '../systems/Records';
import type { Weather } from '../systems/StoryState';
import { darkness, multiply, skyColor, WEATHER_TINT } from '../systems/Weather';

/**
 * Fondo del menú principal: un lugar del juego que se desliza despacio, con tráfico, y que cada
 * cierto rato cambia por otro (ver data/titleBackdrops.ts).
 *
 * - Lugares: solo de misiones desbloqueadas; los de la misión en curso salen más seguido, y si la
 *   partida quedó en un mapa con fondo, se parte ahí.
 * - Hora: parte a la hora de la partida guardada (o la hora real si no hay) y avanza mientras se
 *   espera, así que el atardecer y la noche llegan solos; de noche salen más los miradores.
 * - Clima: mientras más se espera, más probable que llueva (y después, tormenta con truenos).
 */

/** Cuánto se queda cada lugar antes de cambiar (ms). */
const DISPLAY_MS = 24000;
const FADE_MS = 650;
const PAN_SPEED = 14;
/** Minutos del reloj del título por cada ms real: una hora cada 12 s, un día en ~5 min. */
const CLOCK_RATE = 60 / 12000;
const VIEW_ROWS = Math.ceil(BASE_HEIGHT / TILE);
const VIEW_COLS = Math.ceil(BASE_WIDTH / TILE);
const RAIN_DROPS: Record<Weather, number> = { despejado: 0, nublado: 0, lluvia: 70, tormenta: 150 };
const RAIN_SPEED = 260;
const RAIN_SLANT = 0.28;

const DEPTH_MAP = 0;
const DEPTH_VEHICLES = 1;
const DEPTH_TINT = 1.4;
const DEPTH_GLOW = 1.5;
const DEPTH_RAIN = 1.6;
/** El velo del título va en 2; el fundido entre lugares, encima del velo y debajo del logo. */
const DEPTH_FADE = 3;

export interface TitleBackdropOptions {
  /** Hora inicial (minutos desde el domingo). */
  startMinutes: number;
  /** Misión en curso: sus lugares salen más. */
  missionId: string;
  /** Mapa donde quedó la partida (si tiene fondo, se parte ahí). */
  savedMap?: string;
  /** Clima de la partida guardada (para el primer lugar, si es el de la partida). */
  savedWeather?: Weather;
  /** Avisa cada vez que aparece un lugar (para mostrar el nombre en el pie). */
  onPlace?: (def: TitleBackdropDef, clockMinutes: number) => void;
}

interface Drop {
  u: number;
  v: number;
  len: number;
  rect: Phaser.GameObjects.Rectangle;
}

export class TitleBackdrop {
  private def!: TitleBackdropDef;
  private layer: Phaser.Tilemaps.TilemapLayer | null = null;
  private glowBox: Phaser.GameObjects.Container | null = null;
  private glows: Phaser.GameObjects.Rectangle[] = [];
  private vehicles: Phaser.GameObjects.Image[] = [];
  private laneTimers: Phaser.Time.TimerEvent[] = [];
  private drops: Drop[] = [];
  private readonly tint: Phaser.GameObjects.Rectangle;
  private readonly fade: Phaser.GameObjects.Rectangle;
  private flash: Phaser.GameObjects.Rectangle | null = null;
  private weather: Weather = 'despejado';
  private nextLightning = 0;
  private clock: number;
  private waitedMs = 0;
  private shownMs = 0;
  private changing = false;
  /** Inicio y tope del deslizamiento, en pixeles del mapa. */
  private origin = { x: 0, y: 0 };
  private maxPan = 0;
  private dark = 0;
  private tintColor = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: TitleBackdropOptions,
  ) {
    this.clock = opts.startMinutes;
    this.tint = scene.add
      .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH + 8, BASE_HEIGHT + 8, 0xffffff)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(DEPTH_TINT);
    this.fade = scene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH + 8, BASE_HEIGHT + 8, 0x0d1424).setAlpha(0).setDepth(DEPTH_FADE);

    const first = this.firstBackdrop();
    const weather = first.weather ?? (first.map === opts.savedMap ? opts.savedWeather : undefined) ?? 'despejado';
    this.show(first, weather);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setAmbient({ rain: 'none', indoor: false }));
  }

  /** Hora actual del reloj del título (minutos desde el domingo). */
  get minutes(): number {
    return this.clock;
  }

  /** Lugar que se está mostrando. */
  get current(): TitleBackdropDef {
    return this.def;
  }

  update(delta: number): void {
    this.waitedMs += delta;
    this.shownMs += delta;
    this.clock += delta * CLOCK_RATE;

    this.applyPan();
    this.applyTint();
    this.updateRain(delta);
    this.updateLightning(delta);

    if (!this.changing && this.shownMs >= DISPLAY_MS) this.next();
  }

  // -------------------------------------------------------------------------
  // Qué lugar mostrar

  /** Lugares disponibles: de misiones desbloqueadas (los finales, solo si ya se jugaron). */
  private pool(): TitleBackdropDef[] {
    const pool = TITLE_BACKDROPS.filter((b) => {
      const m = MISSIONS.find((x) => x.id === b.mission);
      if (!m || !Records.isUnlocked(m)) return false;
      return !b.afterComplete || Records.isCompleted(m.id);
    });
    return pool.length > 0 ? pool : [TITLE_BACKDROPS[0]];
  }

  private firstBackdrop(): TitleBackdropDef {
    const pool = this.pool();
    const saved = this.opts.savedMap && pool.find((b) => b.map === this.opts.savedMap);
    if (saved) return saved;
    const ofMission = pool.filter((b) => b.mission === this.opts.missionId);
    return Phaser.Utils.Array.GetRandom(ofMission.length > 0 ? ofMission : pool);
  }

  /** Sorteo con peso: la misión en curso pesa más, y los miradores pesan más de noche. */
  private pickNext(): TitleBackdropDef {
    const pool = this.pool().filter((b) => b.id !== this.def.id);
    if (pool.length === 0) return this.def;
    const night = darkness(skyColor(this.clock + FADE_MS * CLOCK_RATE)) > 0.5;
    const weights = pool.map((b) => {
      let w = b.mission === this.opts.missionId ? 3 : 1;
      if (b.night) w *= night ? 4 : 0.3;
      return w;
    });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  /** Clima según cuánto lleva esperando: al principio despejado; después, cada vez más lluvia. */
  private pickWeather(def: TitleBackdropDef): Weather {
    if (def.weather) return def.weather;
    const min = this.waitedMs / 60000;
    const r = Math.random();
    if (min > 2 && r < Math.min(0.25, (min - 2) * 0.08)) return 'tormenta';
    if (r < Math.min(0.45, 0.08 + min * 0.12)) return 'lluvia';
    if (r < 0.6) return 'nublado';
    return 'despejado';
  }

  private next(): void {
    this.changing = true;
    const def = this.pickNext();
    this.scene.tweens.add({
      targets: this.fade,
      alpha: 1,
      duration: FADE_MS,
      onComplete: () => {
        this.show(def, this.pickWeather(def));
        this.scene.tweens.add({ targets: this.fade, alpha: 0, duration: FADE_MS + 200, onComplete: () => (this.changing = false) });
      },
    });
  }

  // -------------------------------------------------------------------------
  // Armar el lugar

  private show(def: TitleBackdropDef, weather: Weather): void {
    this.clear();
    this.def = def;
    this.shownMs = 0;
    const map = GameMap.get(def.map);
    const layer = map.createLayer(this.scene).setDepth(DEPTH_MAP);
    // Con la cámara fija (origen 0,0 + zoom) Phaser calcula mal qué tiles están a la vista.
    layer.skipCull = true;
    this.layer = layer;

    const maxX = Math.max(0, map.width * TILE - BASE_WIDTH);
    const maxY = Math.max(0, map.height * TILE - BASE_HEIGHT);
    this.origin = { x: Phaser.Math.Clamp(def.col * TILE, 0, maxX), y: Phaser.Math.Clamp(def.row * TILE, 0, maxY) };
    const room: Record<TitleBackdropDef['pan'], number> = {
      right: maxX - this.origin.x,
      left: this.origin.x,
      down: maxY - this.origin.y,
      up: this.origin.y,
    };
    this.maxPan = room[def.pan];

    this.glowBox = this.scene.add.container(0, 0).setDepth(DEPTH_GLOW);
    this.createGlows(map, def);
    for (const lane of def.lanes ?? []) this.startLane(lane);
    this.setWeather(weather);
    this.tintColor = -1;
    this.applyPan();
    this.applyTint();
    this.opts.onPlace?.(def, this.clock);
  }

  private clear(): void {
    for (const t of this.laneTimers) t.remove(false);
    for (const v of this.vehicles) {
      this.scene.tweens.killTweensOf(v);
      v.destroy();
    }
    this.laneTimers = [];
    this.vehicles = [];
    this.glows = [];
    this.glowBox?.destroy();
    this.glowBox = null;
    if (this.layer) {
      const tilemap = this.layer.tilemap;
      this.layer.destroy();
      tilemap.destroy();
      this.layer = null;
    }
  }

  private applyPan(): void {
    if (!this.layer) return;
    const d = Math.min(this.maxPan, (this.shownMs * PAN_SPEED) / 1000);
    const dx = this.def.pan === 'right' ? d : this.def.pan === 'left' ? -d : 0;
    const dy = this.def.pan === 'down' ? d : this.def.pan === 'up' ? -d : 0;
    const x = -Math.round(this.origin.x + dx);
    const y = -Math.round(this.origin.y + dy);
    this.layer.setPosition(x, y);
    this.glowBox?.setPosition(x, y);
  }

  /** Luz del día y del clima, y las luces de la ciudad que se prenden al oscurecer. */
  private applyTint(): void {
    const color = multiply(skyColor(this.clock), WEATHER_TINT[this.weather]);
    if (color === this.tintColor) return;
    this.tintColor = color;
    this.tint.setFillStyle(color).setVisible(color !== 0xffffff);
    this.dark = darkness(color);
    const a = Math.min(1, this.dark * 1.2);
    this.glows.forEach((g, i) => g.setAlpha(i % 2 === 0 ? a : Math.min(0.3, this.dark * 0.3)));
  }

  /** Ventanas encendidas de la ciudad (`vista_ciudad`) y faroles coloniales, solo en la franja visible. */
  private createGlows(map: GameMap, def: TitleBackdropDef): void {
    const box = this.glowBox;
    if (!box) return;
    const colors = [0xf0c060, 0xf8e0a0, 0xf0a040, 0xa8c8f0, 0xf8f0d0];
    const horizontal = def.pan === 'right' || def.pan === 'left';
    const x0 = horizontal ? 0 : Math.floor(this.origin.x / TILE);
    const x1 = horizontal ? map.width : x0 + VIEW_COLS + 1;
    const y0 = horizontal ? Math.floor(this.origin.y / TILE) : 0;
    const y1 = horizontal ? y0 + VIEW_ROWS + 1 : map.height;
    let k = 0;
    const add = (x: number, y: number, color: number, size: number): void => {
      const core = this.scene.add.rectangle(x, y, size, size, color).setAlpha(0);
      const halo = this.scene.add.rectangle(x, y, size + 2, size + 2, color).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      box.add([core, halo]);
      this.glows.push(core, halo);
    };
    for (let y = y0; y < Math.min(y1, map.height); y++) {
      for (let x = x0; x < Math.min(x1, map.width); x++) {
        const key = map.tileKeyAt(x, y);
        if (key === 'farol_colonial') add(x * TILE + 8, y * TILE + 4, 0xfff0b0, 3);
        else if (key === 'vista_ciudad') {
          k++;
          add(x * TILE + ((k * 37) % 14) + 1, y * TILE + ((k * 53) % 14) + 1, colors[k % colors.length], 1);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Tráfico

  private startLane(lane: BackdropLane): void {
    const every = lane.every ?? [1800, 5200];
    const schedule = (delay: number): void => {
      this.laneTimers.push(
        this.scene.time.delayedCall(delay, () => {
          this.spawnVehicle(lane);
          schedule(Phaser.Math.Between(...every));
        }),
      );
    };
    schedule(Phaser.Math.Between(200, 2500));
  }

  private spawnVehicle(lane: BackdropLane): void {
    const id = Phaser.Utils.Array.GetRandom(lane.vehicles) as string;
    const key = vehicleKey(id);
    if (!this.scene.textures.exists(key)) return;
    // Apoyado en la fila de la pista (las micros sobresalen hacia arriba, como en los mapas).
    const y = (lane.row + 1) * TILE - this.origin.y - 1;
    const img = this.scene.add.image(0, y, key).setOrigin(0.5, 1).setDepth(DEPTH_VEHICLES);
    // Los que tienen versión "_izq" ya miran a la izquierda; al resto se le da vuelta.
    if (lane.dir < 0 && !id.endsWith('_izq')) img.setFlipX(true);
    const margin = img.width / 2 + 4;
    const from = lane.dir > 0 ? -margin : BASE_WIDTH + margin;
    const to = lane.dir > 0 ? BASE_WIDTH + margin : -margin;
    img.setX(from);
    const big = img.width > 40;
    const speed = big ? Phaser.Math.Between(48, 62) : Phaser.Math.Between(62, 92);
    this.vehicles.push(img);
    this.scene.tweens.add({
      targets: img,
      x: to,
      duration: (Math.abs(to - from) / speed) * 1000,
      onUpdate: () => img.setX(Math.round(img.x)),
      onComplete: () => {
        this.vehicles = this.vehicles.filter((v) => v !== img);
        img.destroy();
      },
    });
  }

  // -------------------------------------------------------------------------
  // Lluvia y truenos

  private setWeather(weather: Weather): void {
    this.weather = weather;
    for (const d of this.drops) d.rect.destroy();
    this.drops = [];
    const rain = weather === 'lluvia' || weather === 'tormenta' ? weather : 'none';
    setAmbient({ rain, indoor: false });
    this.nextLightning = weather === 'tormenta' ? Phaser.Math.Between(1500, 4000) : 0;
    const color = weather === 'tormenta' ? 0xc8d8f0 : 0xb8c8e8;
    for (let i = 0; i < RAIN_DROPS[weather]; i++) {
      const len = Phaser.Math.Between(4, 7);
      const rect = this.scene.add
        .rectangle(0, 0, 1, len, color, 0.55)
        .setOrigin(0, 0)
        .setDepth(DEPTH_RAIN)
        .setAngle(-RAIN_SLANT * 57);
      this.drops.push({ u: Math.random() * (BASE_WIDTH + 40) - 20, v: Math.random() * BASE_HEIGHT, len, rect });
    }
  }

  private updateRain(delta: number): void {
    const dt = delta / 1000;
    for (const d of this.drops) {
      d.v += RAIN_SPEED * dt * (0.8 + d.len / 20);
      d.u -= RAIN_SPEED * RAIN_SLANT * dt;
      if (d.v > BASE_HEIGHT + 8 || d.u < -20) {
        d.v = -8 - Math.random() * 20;
        d.u = Math.random() * (BASE_WIDTH + 60);
      }
      d.rect.setPosition(Math.round(d.u), Math.round(d.v));
    }
  }

  private updateLightning(delta: number): void {
    if (this.weather !== 'tormenta' || this.nextLightning <= 0) return;
    this.nextLightning -= delta;
    if (this.nextLightning > 0) return;
    this.nextLightning = Phaser.Math.Between(5500, 13000);
    this.flash?.destroy();
    const flash = this.scene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH + 8, BASE_HEIGHT + 8, 0xf0f4ff, 0.6).setDepth(DEPTH_RAIN);
    this.flash = flash;
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
}
