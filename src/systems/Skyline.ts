import Phaser from 'phaser';
import { playSfx, setSkylineAmbient, type SfxName } from '../audio/sfx';
import { PAL } from '../art/palette';
import { TILE } from '../config/display';
import type { GameMap } from './GameMap';
import { StoryState } from './StoryState';
import type { WeatherView } from './Weather';

/**
 * La ciudad vista desde un piso alto (mapas con `skyline: true`, el rooftop de Cali).
 *
 * Sobre los tiles `vista_ciudad` corre una ciudad chiquita: autos que son puntitos de luz
 * (focos blancos de ida, luces rojas de vuelta) y frenan en los semáforos, gente que camina
 * por las veredas, ventanas que se prenden y se apagan, televisores parpadeando, balizas rojas
 * en los techos y de vez en cuando un avión que cruza. Todo se mueve lento: está lejos, abajo.
 *
 * Arriba sopla el viento: ráfagas que mueven las guirnaldas y las plantas, líneas de aire y
 * alguna hoja o servilleta que se vuela. El viento y el murmullo de la ciudad suenan en loop
 * (más fuerte junto a la baranda), y a lo lejos se oyen bocinas, motos y alguna sirena.
 */

// Geometría del tile `vista_ciudad` (ver cityBelow en src/art/tiles.ts).
const ROAD_H = [9, 10]; // filas de la calle horizontal: carril al este y carril al oeste
const ROAD_V = [5, 6]; // columnas de la calle vertical: carril al sur y carril al norte
const SIDEWALK_H = [8, 11];
/** Ventanas posibles dentro de un tile (en los tres edificios dibujados). */
const WINDOWS: Array<[number, number]> = [
  [1, 2], [3, 3], [1, 5], [3, 6],
  [10, 3], [12, 3], [11, 5], [13, 5], [12, 6],
  [10, 13], [12, 13], [14, 14],
];
/** Esquina del edificio alto de cada tile, donde va la baliza roja. */
const BEACON: [number, number] = [2, 1];

const HEADLIGHT = 0xfff0c8;
const TAILLIGHT = 0xff3a28;
const WINDOW_COLORS = [0xf8d890, 0xf0c060, 0xf8e8b8, 0xf0a850, 0xc8e0f8];
const TV_COLORS = [0x88b8ff, 0xa8d0ff, 0x6890e8, 0xd8e8ff];
const PEOPLE_COLORS = [0x9aa0b8, 0xb8a890, 0x8890a8, 0xc8b8a8];

/** Semáforos: verde para las calles horizontales, amarillo, verde para las verticales, amarillo. */
const SIGNAL_PERIOD = 9000;
const SIGNAL_H_GREEN = 3800;
const SIGNAL_AMBER = 700;
/** Cada cuántos tiles hay una esquina con semáforo. */
const SIGNAL_EVERY = 4;

const DEPTH_WINDOWS = 9001;
const DEPTH_LIGHTS = 9001.5;
/** Debajo del velo de la noche: el viento y las hojas se oscurecen con la hora. */
const DEPTH_WIND = 8999;
const DEPTH_PLANTS = -999;

interface Car {
  s: number;
  speed: number;
}

interface Lane {
  axis: 'h' | 'v';
  /** Coordenada fija (y para calles horizontales, x para verticales), en px. */
  at: number;
  from: number;
  len: number;
  dir: 1 | -1;
  /** Distancias (desde la entrada del carril) donde hay que parar con luz roja. */
  stops: number[];
  cars: Car[];
}

interface Walker {
  axis: 'h' | 'v';
  at: number;
  from: number;
  len: number;
  s: number;
  speed: number;
  pause: number;
  color: number;
}

interface Window {
  x: number;
  y: number;
  on: boolean;
  tv: boolean;
  color: number;
}

interface Streak {
  u: number;
  v: number;
  len: number;
  speed: number;
}

interface Debris {
  x: number;
  y: number;
  vx: number;
  phase: number;
  color: number;
}

interface Plane {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
}

const rand = Phaser.Math.FloatBetween;

export class SkylineView {
  private readonly city: boolean[][];
  private readonly lanes: Lane[] = [];
  private readonly walkers: Walker[] = [];
  private readonly windows: Window[] = [];
  private readonly beacons: Array<{ x: number; y: number; phase: number }> = [];
  private readonly signals: Array<{ x: number; y: number; axis: 'h' | 'v' }> = [];
  private readonly plants: Array<{ x: number; y: number; phase: number }> = [];
  private readonly streaks: Streak[] = [];
  private debris: Debris[] = [];
  private plane: Plane | null = null;

  private readonly gWindows: Phaser.GameObjects.Graphics;
  private readonly gLights: Phaser.GameObjects.Graphics;
  private readonly gHalo: Phaser.GameObjects.Graphics;
  private readonly gWind: Phaser.GameObjects.Graphics;
  private readonly gPlants: Phaser.GameObjects.Graphics;

  private time = 0;
  private windowTimer = 0;
  private windowsDirty = true;
  private lastDark = -1;
  /** Viento: base + ráfaga (0..1). */
  private wind = 0.3;
  private gust = { t: 0, rise: 1, hold: 1, fall: 1, peak: 0 };
  private nextGust = 2500;
  private nextPlane = rand(8000, 20000);
  private nextSounds: Array<{ sfx: SfxName; at: number; range: [number, number] }> = [
    { sfx: 'pito_lejos', at: rand(3000, 9000), range: [7000, 18000] },
    { sfx: 'moto_lejos', at: rand(6000, 14000), range: [12000, 26000] },
    { sfx: 'sirena_lejos', at: rand(25000, 45000), range: [50000, 90000] },
  ];
  private audioTimer = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: GameMap,
    private readonly weather: WeatherView | undefined,
    private readonly playerTile: () => { x: number; y: number },
  ) {
    this.city = [];
    for (let y = 0; y < map.height; y++) {
      this.city.push([]);
      for (let x = 0; x < map.width; x++) this.city[y].push(map.tileKeyAt(x, y) === 'vista_ciudad');
    }
    this.buildLanes();
    this.buildWalkers();
    this.buildWindows();
    this.buildPlants();
    for (let i = 0; i < 28; i++) this.streaks.push({ u: rand(0, 400), v: rand(0, 200), len: Phaser.Math.Between(3, 9), speed: rand(110, 210) });

    this.gWindows = scene.add.graphics().setDepth(DEPTH_WINDOWS);
    this.gHalo = scene.add.graphics().setDepth(DEPTH_LIGHTS).setBlendMode(Phaser.BlendModes.ADD);
    this.gLights = scene.add.graphics().setDepth(DEPTH_LIGHTS);
    this.gWind = scene.add.graphics().setDepth(DEPTH_WIND);
    this.gPlants = scene.add.graphics().setDepth(DEPTH_PLANTS);

    // Los autos ya vienen andando cuando uno llega.
    for (let i = 0; i < 40; i++) this.updateTraffic(250);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setSkylineAmbient({ wind: 0, hum: 0 }));
    this.update(0);
  }

  // -------------------------------------------------------------------------
  // Construcción
  // -------------------------------------------------------------------------

  /** Tramos seguidos de tiles de ciudad: por cada fila (calles horizontales) y columna (verticales). */
  private runs(axis: 'h' | 'v'): Array<{ line: number; start: number; end: number }> {
    const out: Array<{ line: number; start: number; end: number }> = [];
    const lines = axis === 'h' ? this.map.height : this.map.width;
    const cells = axis === 'h' ? this.map.width : this.map.height;
    for (let line = 0; line < lines; line++) {
      let start = -1;
      for (let c = 0; c <= cells; c++) {
        const isCity = c < cells && (axis === 'h' ? this.city[line][c] : this.city[c][line]);
        if (isCity && start < 0) start = c;
        if (!isCity && start >= 0) {
          if (c - start >= 2) out.push({ line, start, end: c });
          start = -1;
        }
      }
    }
    return out;
  }

  private buildLanes(): void {
    for (const axis of ['h', 'v'] as const) {
      const offsets = axis === 'h' ? ROAD_H : ROAD_V;
      for (const run of this.runs(axis)) {
        const from = run.start * TILE;
        const len = (run.end - run.start) * TILE;
        offsets.forEach((off, i) => {
          const dir: 1 | -1 = i === 0 ? 1 : -1;
          // Línea de detención antes de cada esquina con semáforo (la calle cruzada está en off 5-6 o 9-10).
          const cross = axis === 'h' ? ROAD_V : ROAD_H;
          const stops: number[] = [];
          for (let c = run.start; c < run.end; c++) {
            if ((c + run.line) % SIGNAL_EVERY !== 0) continue;
            const edge = dir > 0 ? c * TILE + cross[0] - 2 : c * TILE + cross[1] + 2;
            stops.push(dir > 0 ? edge - from : from + len - edge);
            if (i === 0) this.signals.push(axis === 'h' ? { axis, x: c * TILE + cross[0] - 1, y: run.line * TILE + ROAD_H[0] - 1 } : { axis, x: run.line * TILE + ROAD_V[1] + 1, y: c * TILE + cross[0] - 1 });
          }
          const cars: Car[] = [];
          const n = Math.max(1, Math.round(len / 40));
          for (let k = 0; k < n; k++) cars.push({ s: (len * k) / n + rand(0, 10), speed: rand(9, 17) });
          cars.sort((a, b) => b.s - a.s);
          this.lanes.push({ axis, at: run.line * TILE + off, from, len, dir, stops: stops.sort((a, b) => a - b), cars });
        });
      }
    }
  }

  private buildWalkers(): void {
    for (const axis of ['h', 'v'] as const) {
      const offsets = axis === 'h' ? SIDEWALK_H : [ROAD_V[0] - 1, ROAD_V[1] + 1];
      for (const run of this.runs(axis)) {
        const len = (run.end - run.start) * TILE;
        for (const off of offsets) {
          const n = Math.max(1, Math.round(len / 70));
          for (let k = 0; k < n; k++) {
            this.walkers.push({
              axis,
              at: run.line * TILE + off,
              from: run.start * TILE,
              len,
              s: rand(0, len),
              speed: rand(1.2, 3.2) * (Math.random() < 0.5 ? 1 : -1),
              pause: 0,
              color: PEOPLE_COLORS[k % PEOPLE_COLORS.length],
            });
          }
        }
      }
    }
  }

  private buildWindows(): void {
    let k = 0;
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (!this.city[y][x]) continue;
        for (const [wx, wy] of WINDOWS) {
          k++;
          // Mitad de las ventanas, elegidas sin patrón visible.
          if ((k * 7919) % 4 !== 0) continue;
          const tv = (k * 31) % 17 === 0;
          this.windows.push({ x: x * TILE + wx, y: y * TILE + wy, on: Math.random() < 0.55, tv, color: WINDOW_COLORS[k % WINDOW_COLORS.length] });
        }
        if ((x * 7 + y * 3) % 13 === 0) this.beacons.push({ x: x * TILE + BEACON[0], y: y * TILE + BEACON[1], phase: (x + y) % 3 === 0 ? 0 : rand(0, 1) });
      }
    }
  }

  private buildPlants(): void {
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (this.map.tileKeyAt(x, y) === 'planta_terraza') this.plants.push({ x: x * TILE, y: y * TILE, phase: rand(0, Math.PI * 2) });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Cada frame
  // -------------------------------------------------------------------------

  update(delta: number): void {
    this.time += delta;
    const dark = this.weather?.darkness ?? 1;
    if (Math.abs(dark - this.lastDark) > 0.02) {
      this.lastDark = dark;
      this.windowsDirty = true;
    }

    this.updateWind(delta);
    this.updateTraffic(delta);
    this.updateWalkers(delta);
    this.updateWindows(delta);
    this.updatePlane(delta);

    this.drawLights(dark);
    if (this.windowsDirty) this.drawWindows(dark);
    this.drawWind(delta);
    this.drawPlants();
    this.weather?.swayGarlands(this.wind, this.time);
    this.updateAudio(delta);
  }

  /** Luz del semáforo para un eje: 'g', 'a' o 'r'. */
  private signal(axis: 'h' | 'v'): 'g' | 'a' | 'r' {
    const t = this.time % SIGNAL_PERIOD;
    const half = SIGNAL_PERIOD / 2;
    const own = axis === 'h' ? t : (t + half) % SIGNAL_PERIOD;
    if (own < SIGNAL_H_GREEN) return 'g';
    if (own < SIGNAL_H_GREEN + SIGNAL_AMBER) return 'a';
    return 'r';
  }

  private updateTraffic(delta: number): void {
    const dt = delta / 1000;
    for (const lane of this.lanes) {
      const go = this.signal(lane.axis) === 'g';
      // De adelante hacia atrás: cada auto respeta la luz roja y al que va delante.
      for (let i = 0; i < lane.cars.length; i++) {
        const car = lane.cars[i];
        let next = car.s + car.speed * dt;
        if (!go) {
          for (const stop of lane.stops) {
            if (car.s <= stop && next > stop) next = stop;
          }
        }
        if (i > 0) next = Math.min(next, lane.cars[i - 1].s - 4);
        car.s = Math.max(car.s, next);
      }
      // El que sale del tramo vuelve a entrar por atrás (otro auto, otra velocidad).
      const front = lane.cars[0];
      if (front && front.s > lane.len + 2) {
        lane.cars.shift();
        const last = lane.cars[lane.cars.length - 1];
        lane.cars.push({ s: Math.min(-rand(2, 30), (last?.s ?? 0) - 6), speed: rand(9, 17) });
      }
    }
  }

  private updateWalkers(delta: number): void {
    const dt = delta / 1000;
    for (const w of this.walkers) {
      if (w.pause > 0) {
        w.pause -= delta;
        continue;
      }
      w.s += w.speed * dt;
      if (w.s < 0 || w.s > w.len) {
        w.speed = -w.speed;
        w.s = Phaser.Math.Clamp(w.s, 0, w.len);
      }
      if (Math.random() < 0.002) w.pause = rand(800, 4000);
      if (Math.random() < 0.0008) w.speed = -w.speed;
    }
  }

  private updateWindows(delta: number): void {
    this.windowTimer += delta;
    if (this.windowTimer > 220) {
      this.windowTimer = 0;
      // Alguien prende o apaga la luz en algún depto.
      const w = this.windows[Math.floor(Math.random() * this.windows.length)];
      if (w && !w.tv) {
        w.on = !w.on;
        this.windowsDirty = true;
      }
    }
    // Los televisores cambian de color seguido.
    if (Math.random() < 0.25) this.windowsDirty = true;
  }

  private updatePlane(delta: number): void {
    if (!this.plane) {
      this.nextPlane -= delta;
      if (this.nextPlane > 0) return;
      this.nextPlane = rand(35000, 70000);
      const view = this.scene.cameras.main.worldView;
      const ltr = Math.random() < 0.5;
      this.plane = {
        x: ltr ? view.x - 10 : view.right + 10,
        y: view.y + rand(10, view.height * 0.45),
        vx: (ltr ? 1 : -1) * rand(14, 20),
        vy: rand(-2, 2),
        t: 0,
      };
      playSfx('avion_lejos');
      return;
    }
    const p = this.plane;
    p.t += delta;
    p.x += (p.vx * delta) / 1000;
    p.y += (p.vy * delta) / 1000;
    const view = this.scene.cameras.main.worldView;
    if (p.x < view.x - 30 || p.x > view.right + 30) this.plane = null;
  }

  private updateWind(delta: number): void {
    // Ráfagas: suben, se sostienen y se van; entre medio, una brisa que no para.
    this.nextGust -= delta;
    if (this.nextGust <= 0) {
      this.gust = { t: 0, rise: rand(900, 1800), hold: rand(600, 2200), fall: rand(1800, 3200), peak: rand(0.35, 0.7) };
      this.nextGust = rand(6000, 14000);
    }
    const g = this.gust;
    g.t += delta;
    let env = 0;
    if (g.t < g.rise) env = g.t / g.rise;
    else if (g.t < g.rise + g.hold) env = 1;
    else if (g.t < g.rise + g.hold + g.fall) env = 1 - (g.t - g.rise - g.hold) / g.fall;
    const raining = StoryState.weather === 'lluvia' || StoryState.weather === 'tormenta';
    const base = (raining ? 0.42 : 0.24) + Math.sin(this.time / 2300) * 0.05;
    this.wind = Phaser.Math.Clamp(base + env * env * (3 - 2 * env) * g.peak, 0, 1);

    // Con la ráfaga se vuela alguna hoja o servilleta.
    if (this.wind > 0.45 && Math.random() < delta / 2500 && this.debris.length < 4) {
      const view = this.scene.cameras.main.worldView;
      this.debris.push({
        x: view.right + 6,
        y: view.y + rand(10, view.height - 20),
        vx: -rand(55, 95),
        phase: rand(0, Math.PI * 2),
        color: Math.random() < 0.5 ? 0xe8e4dc : Phaser.Display.Color.HexStringToColor(PAL.leaf).color,
      });
    }
  }

  private updateAudio(delta: number): void {
    for (const s of this.nextSounds) {
      s.at -= delta;
      if (s.at <= 0) {
        s.at = rand(...s.range);
        playSfx(s.sfx);
      }
    }
    this.audioTimer -= delta;
    if (this.audioTimer > 0) return;
    this.audioTimer = 200;
    // Junto a la baranda el viento se siente más (y silba).
    const p = this.playerTile();
    let edge = 6;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const key = this.map.tileKeyAt(p.x + dx, p.y + dy) ?? '';
        if (key === 'vista_ciudad' || key.startsWith('baranda')) edge = Math.min(edge, Math.max(Math.abs(dx), Math.abs(dy)));
      }
    }
    const near = edge <= 1 ? 1 : edge === 2 ? 0.5 : 0;
    setSkylineAmbient({ wind: Phaser.Math.Clamp(this.wind * (0.75 + near * 0.45), 0, 1), hum: 0.6 + near * 0.4 });
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private drawLights(dark: number): void {
    const g = this.gLights;
    const h = this.gHalo;
    g.clear();
    h.clear();
    const core = 0.55 + 0.45 * Math.min(1, dark);
    const halo = 0.13 * Math.min(1, dark);

    for (const lane of this.lanes) {
      const color = lane.dir > 0 ? HEADLIGHT : TAILLIGHT;
      for (const car of lane.cars) {
        if (car.s < 0 || car.s > lane.len) continue;
        const along = lane.from + (lane.dir > 0 ? car.s : lane.len - car.s);
        const [x, y, w, hh] = lane.axis === 'h' ? [Math.round(along), lane.at, 2, 1] : [lane.at, Math.round(along), 1, 2];
        g.fillStyle(color, core).fillRect(x, y, w, hh);
        if (halo > 0 && lane.dir > 0) h.fillStyle(color, halo).fillRect(x - 1, y - 1, w + 2, hh + 2);
      }
    }

    for (const w of this.walkers) {
      const along = Math.round(w.from + w.s);
      const [x, y] = w.axis === 'h' ? [along, w.at] : [w.at, along];
      g.fillStyle(w.color, 0.75).fillRect(x, y, 1, 1);
    }

    const colors = { h: this.signal('h'), v: this.signal('v') };
    const SIGNAL_COLOR = { g: 0x40e070, a: 0xf0b020, r: 0xf03030 };
    this.signals.forEach((s) => {
      const c = SIGNAL_COLOR[colors[s.axis]];
      g.fillStyle(c, core).fillRect(s.x, s.y, 1, 1);
    });

    for (const b of this.beacons) {
      const t = (this.time / 1600 + b.phase) % 1;
      if (t > 0.22) continue;
      g.fillStyle(0xff2a20, 1).fillRect(b.x, b.y, 1, 1);
      h.fillStyle(0xff2a20, 0.2 + halo).fillRect(b.x - 1, b.y - 1, 3, 3);
    }

    const p = this.plane;
    if (p) {
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      g.fillStyle(0x3a3e50, 0.9).fillRect(x - 2, y, 5, 1);
      // Rojo a la izquierda, verde a la derecha (según hacia dónde va) y el destello blanco doble.
      g.fillStyle(p.vx > 0 ? 0x30e060 : 0xff3030, 1).fillRect(x, y - 2, 1, 1);
      g.fillStyle(p.vx > 0 ? 0xff3030 : 0x30e060, 1).fillRect(x, y + 2, 1, 1);
      const strobe = p.t % 1300;
      if (strobe < 70 || (strobe > 180 && strobe < 250)) {
        g.fillStyle(0xffffff, 1).fillRect(x + (p.vx > 0 ? -2 : 2), y, 1, 1);
        h.fillStyle(0xffffff, 0.5).fillRect(x + (p.vx > 0 ? -3 : 1), y - 1, 3, 3);
      }
    }
  }

  private drawWindows(dark: number): void {
    this.windowsDirty = false;
    const g = this.gWindows;
    g.clear();
    const alpha = Math.min(1, 0.25 + dark * 1.1);
    for (const w of this.windows) {
      if (w.tv) {
        g.fillStyle(TV_COLORS[Math.floor(Math.random() * TV_COLORS.length)], alpha * rand(0.5, 1)).fillRect(w.x, w.y, 1, 1);
      } else if (w.on) {
        g.fillStyle(w.color, alpha * 0.9).fillRect(w.x, w.y, 1, 1);
      }
    }
  }

  private drawWind(delta: number): void {
    const g = this.gWind;
    g.clear();
    const view = this.scene.cameras.main.worldView;
    const dt = delta / 1000;
    const active = Math.round(this.streaks.length * Phaser.Math.Clamp((this.wind - 0.15) * 1.4, 0, 1));
    for (let i = 0; i < this.streaks.length; i++) {
      const s = this.streaks[i];
      s.u -= s.speed * (0.5 + this.wind) * dt;
      s.v += s.speed * 0.06 * dt;
      if (s.u < -s.len * 2 || s.v > view.height + 4) {
        s.u = view.width + rand(0, 80);
        s.v = rand(-10, view.height);
      }
      if (i >= active) continue;
      const x = Math.round(view.x + s.u);
      const y = Math.round(view.y + s.v);
      // Una línea de aire con la cola más tenue.
      g.fillStyle(0xe8f0ff, 0.3).fillRect(x, y, s.len, 1);
      g.fillStyle(0xe8f0ff, 0.15).fillRect(x + s.len, y, Math.ceil(s.len / 2), 1);
    }

    this.debris = this.debris.filter((d) => d.x > view.x - 10);
    for (const d of this.debris) {
      d.phase += dt * 9;
      d.x += d.vx * (0.6 + this.wind) * dt;
      d.y += Math.sin(d.phase * 0.7) * 18 * dt + 4 * dt;
      // Da vueltas: se ve ancho, de canto, alto.
      const flip = Math.floor(d.phase) % 3;
      const [w, h] = flip === 0 ? [2, 1] : flip === 1 ? [1, 1] : [1, 2];
      g.fillStyle(d.color, 0.95).fillRect(Math.round(d.x), Math.round(d.y), w, h);
    }
  }

  private drawPlants(): void {
    const g = this.gPlants;
    g.clear();
    const light = Phaser.Display.Color.HexStringToColor(PAL.leafLight).color;
    const mid = Phaser.Display.Color.HexStringToColor(PAL.leaf).color;
    for (const p of this.plants) {
      // Las puntas de las hojas se doblan hacia donde sopla.
      const sway = Math.sin(this.time / 260 + p.phase) * (0.4 + this.wind) - this.wind * 1.4;
      const dx = Math.round(sway);
      const dx2 = Math.round(sway * 0.5);
      g.fillStyle(light, 1).fillRect(p.x + 6 + dx, p.y, 3, 1).fillRect(p.x + 5 + dx2, p.y + 1, 2, 1);
      g.fillStyle(mid, 1).fillRect(p.x + 1 + dx, p.y + 5, 2, 1).fillRect(p.x + 13 + dx, p.y + 4, 2, 1);
    }
  }
}
