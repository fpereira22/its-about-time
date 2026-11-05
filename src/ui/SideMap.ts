import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BASE_WIDTH, FONT_HUD, TILE } from '../config/display';
import type { MapScene } from '../scenes/MapScene';
import { BusRideManager, BUS_411_ROUTE, BUS_LANE_Y } from '../systems/BusRideManager';
import { Dialogue } from '../systems/DialogueManager';
import { EventSystem } from '../systems/EventSystem';
import { GameMap } from '../systems/GameMap';
import { currentDestination } from '../systems/Mission';
import { RIDES } from '../systems/RideController';
import { playerLook } from '../systems/PlayerLook';
import { DIR_VECTORS, type Direction } from '../types/map';
import type { RideProgress } from '../types/mission';
import { fitText, makeText } from './theme';

/** Celular en la mano, pegado al borde derecho (bajo el HUD y sobre el letrero LED del vagón). */
const FRAME = { x: BASE_WIDTH - 72, y: 35, w: 66, h: 98 };
const SCREEN = { x: FRAME.x + 4, y: FRAME.y + 10, w: FRAME.w - 8, h: FRAME.h - 20 };
const HEADER_H = 9;
/** Ventana del mapa (px de pantalla); el mapa se dibuja a PX px por tile. */
const VIEW = { x: SCREEN.x, y: SCREEN.y + HEADER_H, w: SCREEN.w, h: 44 };
const PX = 2;
/** Escala aproximada del mapa comprimido: Baquedano–Costanera son ~3,3 km en ~180 tiles. */
const METERS_PER_TILE = 18;
const WALK_M_PER_MIN = 80;
/** Fila del mapa por la que se dibuja la Línea 1 (va bajo Av. Providencia). */
const METRO_ROW = 16;
const SLIDE_MS = 220;
const HIDDEN_DX = 84;
const DEPTH = 50;

const ROUTE = 0x2f6fd0;
const METRO_RED = 0xd8232a;
const MICRO_ORANGE = 0xe8a030;
const PIN = 0xe03838;

type Mode = 'walk' | 'inside' | 'metro' | 'micro' | 'none';

interface NavState {
  mode: Mode;
  /** Mapa exterior que se dibuja. */
  street: GameMap | null;
  x: number;
  y: number;
  facing: Direction;
  /** Nombre del interior en que estás (estación, mall). */
  place?: string;
  /** En metro o micro: paradas que faltan hasta la que sirve (0 = bájate aquí, negativo = te pasaste, null = no va). */
  stopsLeft?: number | null;
  /** En metro o micro: x de cada parada del recorrido y la fila por la que va. */
  track?: { xs: number[]; y: number };
}

interface Look {
  skin?: string;
  shirt?: string;
}

const hex = (c: string): number => Phaser.Display.Color.HexStringToColor(c).color;

/**
 * Mapa 2D en el celular, sostenido al costado mientras caminas: muestra dónde estás, la ruta a pie
 * hasta el destino de la misión, cuánto falta y, en metro o micro, cuántas paradas quedan.
 * Solo se saca desde la app Mapa del celular y se guarda con Q. No pausa el juego.
 */
export class SideMap {
  private readonly root: Phaser.GameObjects.Container;
  private readonly hand: Phaser.GameObjects.Graphics;
  private readonly fingers: Phaser.GameObjects.Graphics;
  private readonly rt: Phaser.GameObjects.RenderTexture;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly header: Phaser.GameObjects.Text;
  private readonly distance: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private mapImage: Phaser.GameObjects.Image | null = null;
  private enabled = false;
  private shown = false;
  private handFor = '';
  private headerValue = '';
  private detailValue = '';
  private progress: RideProgress | null = null;
  private rideMs = 0;
  /** Último punto en la calle antes de entrar a una estación o subir a un viaje. */
  private lastStreet: { x: number; y: number } | null = null;
  private lastPos = { x: 0, y: 0 };
  private bob = 0;
  private pulse = 0;
  private readonly routers = new Map<string, Router>();
  private readonly maps = new Map<string, GameMap>();

  constructor(private readonly scene: Phaser.Scene) {
    this.hand = scene.add.graphics();
    const phone = scene.add.graphics();
    drawPhone(phone);
    this.rt = scene.add.renderTexture(VIEW.x, VIEW.y, VIEW.w, VIEW.h).setOrigin(0, 0);
    this.overlay = scene.make.graphics({}, false);
    this.header = makeText(scene, SCREEN.x + 9, SCREEN.y + 1, '', { fontSize: '7px', color: '#e0e6f8' });
    this.distance = makeText(scene, SCREEN.x + 3, VIEW.y + VIEW.h + 2, '', { fontFamily: FONT_HUD, fontSize: '8px' });
    this.detail = makeText(scene, SCREEN.x + 3, VIEW.y + VIEW.h + 13, '', { fontSize: '7px', color: '#a8b4d0' });
    const pin = scene.add.graphics();
    pin.fillStyle(PIN, 1).fillCircle(SCREEN.x + 5, SCREEN.y + 3.5, 2.5).fillTriangle(SCREEN.x + 3, SCREEN.y + 4.5, SCREEN.x + 7, SCREEN.y + 4.5, SCREEN.x + 5, SCREEN.y + 8);
    pin.fillStyle(0xffffff, 1).fillCircle(SCREEN.x + 5, SCREEN.y + 3.5, 0.8);
    // Tecla para guardarlo, en la esquina del encabezado.
    pin.fillStyle(0xffffff, 0.18).fillRoundedRect(SCREEN.x + SCREEN.w - 9, SCREEN.y + 1, 8, 7, 2);
    const qKey = makeText(scene, SCREEN.x + SCREEN.w - 5, SCREEN.y + 1, 'Q', { fontFamily: FONT_HUD, fontSize: '6px', color: '#c8d0e8' }).setOrigin(0.5, 0);
    this.fingers = scene.add.graphics();

    this.root = scene.add
      .container(HIDDEN_DX, 0, [this.hand, phone, this.rt, pin, this.header, qKey, this.distance, this.detail, this.fingers])
      .setDepth(DEPTH)
      .setVisible(false);

    EventSystem.onScene(scene, 'ride-progress', (p) => {
      this.progress = p.state === 'end' ? null : p;
      this.rideMs = 0;
    });
    EventSystem.onScene(scene, 'side-map', ({ show }) => this.setEnabled(show));
  }

  get isOpen(): boolean {
    return this.enabled;
  }

  /** Guarda el celular (tecla Q). */
  close(): void {
    this.setEnabled(false);
  }

  /** Llamar cada frame. `map` = escena de mapa en curso (undefined si hay un panel abierto o no hay mapa). */
  update(delta: number, map: MapScene | undefined): void {
    this.setShown(this.enabled && map !== undefined);
    if (!this.shown || !map) return;

    const nav = this.locate(map);
    if (nav.mode === 'metro' || nav.mode === 'micro') {
      if (!Dialogue.active && this.progress?.state === 'moving') this.rideMs += delta;
    } else if (nav.mode !== 'none') {
      this.lastStreet = { x: nav.x, y: nav.y };
    }

    // Se mece un poquito en la mano mientras caminas.
    const walking = nav.mode === 'walk' && (nav.x !== this.lastPos.x || nav.y !== this.lastPos.y);
    this.lastPos = { x: nav.x, y: nav.y };
    if (walking) this.bob += delta;
    this.root.y = walking ? Math.round(Math.sin(this.bob / 110)) : 0;
    this.pulse += delta;
    // Si el personaje queda detrás del celular (mapas chicos como la micro), se vuelve transparente.
    const view = map.cameras.main.worldView;
    const sx = (map.navInfo.x + 0.5) * TILE - view.x;
    const sy = (map.navInfo.y + 1) * TILE - view.y;
    const behind = sx + TILE / 2 > FRAME.x - 4 && sy > FRAME.y && sy - TILE < FRAME.y + FRAME.h;
    this.root.alpha = Phaser.Math.Linear(this.root.alpha, behind ? 0.35 : 1, 0.2);

    this.drawMap(nav);
    this.drawInfo(nav);
  }

  // ---------------------------------------------------------------------------
  // Dónde estás
  // ---------------------------------------------------------------------------

  private locate(map: MapScene): NavState {
    const info = map.navInfo;
    const here = this.gameMap(info.mapId);
    const base = { x: 0, y: 0, facing: info.facing, street: null as GameMap | null };

    if (here.data.kind === 'overworld') {
      if (BusRideManager.active && BusRideManager.mode === 'exterior') {
        const final = BUS_411_ROUTE.length - 1;
        return {
          ...base,
          mode: 'micro',
          street: here,
          x: BusRideManager.pixelX / TILE - 0.5,
          y: BUS_LANE_Y,
          facing: 'right',
          stopsLeft: BusRideManager.is411 ? final - BusRideManager.stopIndex : null,
          track: BusRideManager.is411 ? { xs: BUS_411_ROUTE.map((s) => s.tileX), y: BUS_LANE_Y } : undefined,
        };
      }
      return { ...base, mode: 'walk', street: here, x: info.x, y: info.y };
    }

    const ride = info.ride ? RIDES[info.ride] : undefined;
    if (ride) return this.locateRide(ride, base);

    const spot = this.streetSpot(info.mapId);
    if (!spot) return { ...base, mode: 'none' };
    return { ...base, mode: 'inside', street: this.gameMap(spot.map), x: spot.x, y: spot.y, place: here.data.name };
  }

  /** En metro o micro: avanza entre paradas según el tiempo de viaje (las salidas dicen dónde queda cada una). */
  private locateRide(ride: (typeof RIDES)[string], base: Omit<NavState, 'mode'>): NavState {
    const streetId = ride.stops[0]?.exit.map ?? ride.end.exit.map;
    const street = this.gameMap(currentDestination()?.map ?? streetId);
    const metro = ride.type === 'metro';
    const y = metro ? METRO_ROW : BUS_LANE_Y;
    const origin = this.lastStreet?.x ?? 0;
    const xs = ride.stops.map((s) => (s.exit.map === street.id ? street.spawn(s.exit.spawn).x : origin));
    // La estación final que no está en el mapa (te pasaste o vas al revés) queda fuera, hacia donde va el tren.
    const way = xs.length > 0 ? Math.sign(xs[xs.length - 1] - origin) || 1 : -1;
    const allXs = ride.endStop ? [...xs, Phaser.Math.Clamp((xs[xs.length - 1] ?? origin) + way * 25, 0, street.width - 1)] : xs;

    let x = origin;
    const p = this.progress;
    if (p && p.index >= 0 && allXs.length > 0) {
      const i = Math.min(p.index, allXs.length - 1);
      const from = i > 0 ? allXs[i - 1] : origin;
      const t = p.state === 'moving' ? Math.min(1, this.rideMs / ride.travelMs) : 1;
      x = from + (allXs[i] - from) * t;
    }

    const finalIdx = ride.stops.findIndex((s) => s.final);
    let stopsLeft: number | null = null;
    if (finalIdx >= 0) {
      const idx = Math.max(0, p?.index ?? 0);
      stopsLeft = idx > finalIdx ? -1 : finalIdx - idx + (p?.state === 'stopped' ? 0 : 1);
    }
    return { ...base, mode: metro ? 'metro' : 'micro', street, x, y, facing: way > 0 ? 'right' : 'left', stopsLeft, track: { xs: [origin, ...allXs], y } };
  }

  /** Para un interior (estación, mall): la entrada desde la calle, siguiendo los warps hacia atrás. */
  private streetSpot(mapId: string, seen = new Set<string>()): { map: string; x: number; y: number } | null {
    seen.add(mapId);
    const sources = GameMap.ids().map((id) => this.gameMap(id));
    for (const m of sources) {
      const w = (m.data.warps ?? []).find((wp) => wp.to === mapId && m.id !== mapId);
      if (w && m.data.kind === 'overworld') return { map: m.id, x: w.x, y: w.y };
    }
    for (const m of sources) {
      if (seen.has(m.id) || !(m.data.warps ?? []).some((wp) => wp.to === mapId)) continue;
      const spot = this.streetSpot(m.id, seen);
      if (spot) return spot;
    }
    return null;
  }

  private gameMap(id: string): GameMap {
    let m = this.maps.get(id);
    if (!m) {
      m = GameMap.get(id);
      this.maps.set(id, m);
    }
    return m;
  }

  private router(street: GameMap): Router | null {
    const dest = currentDestination();
    if (!dest || dest.map !== street.id) return null;
    // El destino cambia por etapa en algunas misiones: un router por mapa y destino.
    const key = `${street.id}:${dest.x},${dest.y}`;
    let r = this.routers.get(key);
    if (!r) {
      r = new Router(street, dest.x, dest.y);
      this.routers.set(key, r);
    }
    return r;
  }

  // ---------------------------------------------------------------------------
  // Dibujo
  // ---------------------------------------------------------------------------

  private drawMap(nav: NavState): void {
    const rt = this.rt;
    rt.clear();
    rt.fill(0x1c2a48);
    const street = nav.street;
    if (!street || nav.mode === 'none') return;

    const key = minimapTexture(this.scene, street);
    if (this.mapImage?.texture.key !== key) {
      this.mapImage?.destroy();
      this.mapImage = this.scene.make.image({ key }, false).setOrigin(0, 0);
    }
    const mapW = street.width * PX;
    const mapH = street.height * PX;
    const cx = nav.x * PX + PX / 2;
    const cy = nav.y * PX + PX / 2;
    const ox = Math.round(Phaser.Math.Clamp(cx - VIEW.w / 2, 0, Math.max(0, mapW - VIEW.w)));
    const oy = Math.round(Phaser.Math.Clamp(cy - VIEW.h / 2, 0, Math.max(0, mapH - VIEW.h)));
    rt.draw(this.mapImage, -ox, -oy);

    const g = this.overlay.clear();
    const at = (tx: number, ty: number): { x: number; y: number } => ({ x: tx * PX + PX / 2 - ox, y: ty * PX + PX / 2 - oy });

    if (nav.track) {
      const color = nav.mode === 'metro' ? METRO_RED : MICRO_ORANGE;
      const xs = nav.track.xs;
      const a = at(Math.min(...xs), nav.track.y);
      const b = at(Math.max(...xs), nav.track.y);
      g.lineStyle(2, color, 1).lineBetween(a.x, a.y, b.x, b.y);
      g.fillStyle(0xffffff, 1);
      for (const sx of xs.slice(1)) {
        const s = at(sx, nav.track.y);
        g.fillRect(s.x - 1, s.y - 1, 2, 2);
      }
    }

    const router = this.router(street);
    const dest = currentDestination();
    if (router && dest) {
      if (nav.mode === 'walk' || nav.mode === 'inside') {
        const path = router.path(Math.round(nav.x), Math.round(nav.y));
        if (path && path.length > 1) {
          g.lineStyle(2, ROUTE, 1).beginPath();
          path.forEach((t, i) => {
            const p = at(t.x, t.y);
            if (i === 0) g.moveTo(p.x, p.y);
            else g.lineTo(p.x, p.y);
          });
          g.strokePath();
        }
      }
      // El pin del destino; si queda fuera de la ventana, se pega al borde apuntando hacia él.
      const d = at(dest.x, dest.y);
      const px = Phaser.Math.Clamp(d.x, 3, VIEW.w - 3);
      const py = Phaser.Math.Clamp(d.y, 5, VIEW.h - 2);
      g.fillStyle(0x000000, 0.3).fillEllipse(px, py + 1, 4, 2);
      g.fillStyle(PIN, 1).fillCircle(px, py - 3, 2.5).fillTriangle(px - 2, py - 2, px + 2, py - 2, px, py + 1);
      g.fillStyle(0xffffff, 1).fillRect(px - 0.5, py - 3.5, 1, 1);
    }

    // Tú: flecha (a pie) o el vehículo en que vas, con un halo que late.
    const me = at(nav.x, nav.y);
    const halo = 3 + (Math.sin(this.pulse / 220) + 1) * 1.5;
    const color = nav.mode === 'metro' ? METRO_RED : nav.mode === 'micro' ? MICRO_ORANGE : ROUTE;
    g.fillStyle(color, 0.25).fillCircle(me.x, me.y, halo);
    if (nav.mode === 'walk') {
      const v = DIR_VECTORS[nav.facing];
      const tip = { x: me.x + v.x * 3.5, y: me.y + v.y * 3.5 };
      const side = { x: -v.y * 2.5, y: v.x * 2.5 };
      const back = { x: me.x - v.x * 2, y: me.y - v.y * 2 };
      g.fillStyle(0xffffff, 1).fillCircle(me.x, me.y, 3);
      g.fillStyle(color, 1).fillTriangle(tip.x, tip.y, back.x + side.x, back.y + side.y, back.x - side.x, back.y - side.y);
    } else {
      g.fillStyle(0xffffff, 1).fillCircle(me.x, me.y, 2.5);
      g.fillStyle(color, 1).fillCircle(me.x, me.y, 1.5);
    }
    rt.draw(g, 0, 0);
  }

  private drawInfo(nav: NavState): void {
    const dest = currentDestination();
    const title = dest?.name ?? 'Mapa';
    if (title !== this.headerValue) {
      this.headerValue = title;
      fitText(this.header, title, SCREEN.w - 19);
    }

    let big = '';
    let small = '';
    const router = nav.street ? this.router(nav.street) : null;
    if (nav.mode === 'none') {
      big = 'SIN SEÑAL';
    } else if (!router) {
      big = nav.street?.data.name ?? '';
    } else {
      const steps = router.stepsFrom(Math.round(nav.x), Math.round(nav.y));
      const arrived = steps !== null && steps <= 1 && (nav.mode === 'walk' || nav.mode === 'inside');
      big = arrived ? '¡LLEGASTE!' : steps === null ? '...' : formatDistance(steps);
      if (nav.mode === 'walk') {
        small = arrived ? (dest?.name ?? '') : steps === null ? '' : `${Math.max(1, Math.round((steps * METERS_PER_TILE) / WALK_M_PER_MIN))} min a pie`;
      } else if (nav.mode === 'inside') {
        small = nav.place ?? '';
      } else {
        small = stopsText(nav.mode, nav.stopsLeft ?? null);
      }
    }
    this.distance.setText(big);
    if (small !== this.detailValue) {
      this.detailValue = small;
      fitText(this.detail, small, SCREEN.w - 5);
    }
  }

  /** La mano que sostiene el celular (piel y manga del personaje actual). */
  private drawHand(): void {
    const look: Look = playerLook();
    const sprite = `${look.skin}${look.shirt}`;
    if (sprite === this.handFor) return;
    this.handFor = sprite;
    const skinC = hex(look.skin ?? '#f0c8a0');
    const skinDark = Phaser.Display.Color.IntegerToColor(skinC).darken(18).color;
    const g = this.hand.clear();
    const wx = FRAME.x + 34;
    const wy = FRAME.y + FRAME.h - 12;
    // Muñeca y manga, saliendo por la esquina de abajo.
    g.fillStyle(skinDark, 1).fillRoundedRect(wx - 1, wy - 1, 34, 72, 7);
    g.fillStyle(skinC, 1).fillRoundedRect(wx, wy, 32, 70, 6);
    g.fillStyle(hex(look.shirt ?? '#e05050'), 1).fillRect(wx - 2, wy + 26, 40, 40);
    // Pulgar a la izquierda y dedos a la derecha, por encima del celular.
    const f = this.fingers.clear();
    const finger = (x: number, y: number, w: number, h: number): void => {
      f.fillStyle(skinDark, 1).fillRoundedRect(x - 0.5, y - 0.5, w + 1, h + 1, 2.5);
      f.fillStyle(skinC, 1).fillRoundedRect(x, y, w, h, 2);
    };
    finger(FRAME.x - 3, FRAME.y + FRAME.h - 36, 6, 13);
    for (let i = 0; i < 3; i++) finger(FRAME.x + FRAME.w - 2, FRAME.y + 44 + i * 10, 5, 8);
  }

  // ---------------------------------------------------------------------------

  private setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    playSfx(on ? 'open' : 'close');
  }

  private setShown(show: boolean): void {
    if (show === this.shown) return;
    this.shown = show;
    this.scene.tweens.killTweensOf(this.root);
    if (show) {
      this.drawHand();
      this.root.setVisible(true);
      this.scene.tweens.add({ targets: this.root, x: 0, duration: SLIDE_MS, ease: 'Back.Out' });
    } else {
      this.scene.tweens.add({
        targets: this.root,
        x: HIDDEN_DX,
        duration: SLIDE_MS,
        ease: 'Cubic.In',
        onComplete: () => this.root.setVisible(false),
      });
    }
  }
}

/**
 * Caminos a pie hacia un destino fijo (Dijkstra desde el destino). Caminar por la calzada cuesta más
 * que por la vereda o el paso de cebra, así la ruta sugerida cruza por las esquinas.
 */
class Router {
  private readonly next: Int32Array;
  private readonly steps: Int32Array;

  constructor(
    private readonly map: GameMap,
    destX: number,
    destY: number,
  ) {
    const n = map.width * map.height;
    this.next = new Int32Array(n).fill(-1);
    this.steps = new Int32Array(n).fill(-1);
    const cost = new Float64Array(n).fill(Infinity);
    const start = destY * map.width + destX;
    cost[start] = 0;
    this.steps[start] = 0;
    const heap = new MinHeap();
    heap.push(start, 0);
    while (heap.size > 0) {
      const [u, c] = heap.pop();
      if (c > cost[u]) continue;
      const ux = u % map.width;
      const uy = Math.floor(u / map.width);
      const enter = tileCost(map, ux, uy);
      for (const v of Object.values(DIR_VECTORS)) {
        const nx = ux + v.x;
        const ny = uy + v.y;
        if (map.isSolid(nx, ny)) continue;
        const ni = ny * map.width + nx;
        const nc = c + enter;
        if (nc >= cost[ni]) continue;
        cost[ni] = nc;
        this.next[ni] = u;
        this.steps[ni] = this.steps[u] + 1;
        heap.push(ni, nc);
      }
    }
  }

  /** Pasos (tiles) hasta el destino, o null si no se puede llegar caminando. */
  stepsFrom(x: number, y: number): number | null {
    const i = this.snap(x, y);
    return i < 0 ? null : this.steps[i];
  }

  /** Esquinas del camino desde (x, y) hasta el destino. */
  path(x: number, y: number): Array<{ x: number; y: number }> | null {
    let i = this.snap(x, y);
    if (i < 0) return null;
    const w = this.map.width;
    const at = (k: number): { x: number; y: number } => ({ x: k % w, y: Math.floor(k / w) });
    const points = [at(i)];
    let dir = 0;
    while (this.next[i] >= 0) {
      const j = this.next[i];
      if (dir !== 0 && j - i !== dir) points.push(at(i));
      dir = j - i;
      i = j;
    }
    points.push(at(i));
    return points;
  }

  /** El tile alcanzable más cercano a (x, y) (para cuando estás sobre algo sólido, como la boca del metro). */
  private snap(x: number, y: number): number {
    const w = this.map.width;
    for (let r = 0; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = x + dx;
          const ty = y + dy;
          if (!this.map.inBounds(tx, ty)) continue;
          const i = ty * w + tx;
          if (this.steps[i] >= 0) return i;
        }
      }
    }
    return -1;
  }
}

class MinHeap {
  private readonly items: Array<[number, number]> = [];

  get size(): number {
    return this.items.length;
  }

  push(id: number, cost: number): void {
    const a = this.items;
    a.push([id, cost]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][1] <= a[i][1]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop(): [number, number] {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][1] < a[m][1]) m = l;
        if (r < a.length && a[r][1] < a[m][1]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Clave de leyenda (sin resolver el autotile) del tile (x, y). */
function rawKey(map: GameMap, x: number, y: number): string {
  return map.data.legend[map.data.rows[y]?.[x] ?? ''] ?? '';
}

function tileCost(map: GameMap, x: number, y: number): number {
  return rawKey(map, x, y).startsWith('calle') ? 4 : 1;
}

function tileColor(key: string): string {
  if (key.startsWith('edificio')) return key.includes('vidrio') ? '#7fa6c8' : '#cdbb98';
  switch (key) {
    case 'calle':
    case 'calle_linea_h':
    case 'calle_linea_v':
      return '#565866';
    case 'cebra_h':
    case 'cebra_v':
      return '#a4a6b4';
    case 'pasto':
    case 'pasto_flor':
      return '#79b05a';
    case 'arbol':
    case 'arbol_plaza':
      return '#4f8c3f';
    case 'agua':
      return '#4f8fd6';
    case 'baranda':
      return '#8a909c';
    case 'metro':
    case 'metro_cerrado':
      return '#d8232a';
    case 'puerta':
      return '#f0c040';
    case 'adoquin':
      return '#c9b48e';
    default:
      return '#dcd6c8';
  }
}

/** Versión simplificada del mapa (PX px por tile), generada una vez por mapa. */
function minimapTexture(scene: Phaser.Scene, map: GameMap): string {
  const key = `minimap:${map.id}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, map.width * PX, map.height * PX);
  if (!tex) throw new Error(`No se pudo crear la textura ${key}`);
  const ctx = tex.getContext();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      ctx.fillStyle = tileColor(rawKey(map, x, y));
      ctx.fillRect(x * PX, y * PX, PX, PX);
    }
  }
  tex.refresh();
  return key;
}

function drawPhone(g: Phaser.GameObjects.Graphics): void {
  const { x, y, w, h } = FRAME;
  g.fillStyle(0x000000, 0.25).fillRoundedRect(x + 2, y + 3, w, h, 9);
  g.fillStyle(0x3a3f4f, 1).fillRoundedRect(x, y, w, h, 9);
  g.fillStyle(0x15171f, 1).fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 7);
  g.fillStyle(0x3a3f4f, 1).fillRoundedRect(x + w / 2 - 8, y + 5, 16, 2, 1);
  g.lineStyle(1, 0x3a3f4f, 1).strokeCircle(x + w / 2, y + h - 5, 2.5);
  g.fillStyle(0x1c2a48, 1).fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
  g.fillStyle(0x000000, 0.35).fillRect(SCREEN.x, SCREEN.y, SCREEN.w, HEADER_H);
  g.fillStyle(0x000000, 0.2).fillRect(SCREEN.x, VIEW.y + VIEW.h, SCREEN.w, SCREEN.h - HEADER_H - VIEW.h);
}

function formatDistance(tiles: number): string {
  const m = tiles * METERS_PER_TILE;
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} M`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} KM`;
}

function stopsText(mode: 'metro' | 'micro', left: number | null): string {
  if (left === null) return 'No va para allá';
  if (left === 0) return '¡Bájate aquí!';
  if (left < 0) return 'Te pasaste';
  const unit = mode === 'metro' ? 'estaci' : 'parada';
  if (mode === 'metro') return `${left} ${left === 1 ? `${unit}ón` : `${unit}ones`}`;
  return `${left} ${left === 1 ? unit : `${unit}s`}`;
}
