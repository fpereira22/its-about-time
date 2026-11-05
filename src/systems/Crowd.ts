import Phaser from 'phaser';
import { charKey, hasCharacter } from '../art/SpriteRegistry';
import crowdData from '../data/crowd.json';
import { DIR_VECTORS, DIRECTIONS, OPPOSITE, type CrowdArea, type Direction, type MapCrowd } from '../types/map';
import { Actor } from './Actor';
import { Dialogue } from './DialogueManager';
import type { GameMap } from './GameMap';
import { SEAT_POSES } from './Seats';

interface CrowdData {
  /** Personaje de sprites.json → nombre que aparece al hablarle. */
  people: Record<string, string>;
  lines: Record<string, string[]>;
}

const DATA = crowdData as CrowdData;

/** Asientos que siempre quedan libres (para que el jugador pueda sentarse). */
const MIN_FREE_SEATS = 3;
/** Cada cuánto mira para otro lado alguien de pie (rango en ms). */
const GLANCE_MS: [number, number] = [2500, 7000];
const FADE_MS = 350;

interface Person {
  actor: Actor;
  name: string;
  line: string;
  /** Hacia dónde mira casi siempre (null = a cualquier lado). Los sentados no miran a los lados. */
  dir: Direction | null;
  seated: boolean;
  /** Área donde está de pie (null si va sentado). */
  area: CrowdArea | null;
  glance: number;
}

const key = (x: number, y: number): string => `${x},${y}`;

/**
 * Gente de relleno del campo `crowd` de un mapa: pasajeros sentados en los asientos y de pie en las áreas.
 * No caminan (solo miran a los lados), bloquean el paso y dicen una frase al azar si les hablas.
 * Nunca tapan un pasillo: un lugar de pie solo se ocupa si se puede seguir pasando alrededor.
 */
export class Crowd {
  private readonly people: Person[] = [];
  private readonly seats: Array<{ x: number; y: number }> = [];
  /** Frases por repartir: cada persona recibe una distinta hasta que se acaban (así no se repiten). */
  private deck: string[] = [];

  /**
   * @param blocked tiles que nunca se ocupan (NPCs, spawns, warps, triggers).
   * @param keepClear tiles de pie que se dejan libres (al lado de cada NPC u objeto, para poder hablarle).
   * @param occupied ¿hay ahora mismo un NPC o el jugador en el tile?
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: GameMap,
    private readonly def: MapCrowd,
    private readonly blocked: Set<string>,
    private readonly keepClear: Set<string>,
    private readonly occupied: (x: number, y: number) => boolean,
  ) {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (SEAT_POSES[map.tileKeyAt(x, y) ?? ''] && !blocked.has(key(x, y))) this.seats.push({ x, y });
      }
    }
    const seated = Math.min(Math.round(this.seats.length * (def.seats ?? 0)), this.seats.length - MIN_FREE_SEATS);
    for (let i = 0; i < seated; i++) this.addSeated();
    for (const area of def.areas ?? []) {
      for (let i = 0; i < area.count; i++) this.addStanding(area);
    }
  }

  occupies(x: number, y: number): boolean {
    return this.people.some((p) => p.actor.occupies(x, y));
  }

  /** El jugador le habla a quien está en (x, y). Devuelve false si no hay nadie. */
  talkAt(x: number, y: number, playerFacing: Direction): boolean {
    const p = this.people.find((q) => q.actor.occupies(x, y));
    if (!p) return false;
    if (!p.seated) p.actor.face(OPPOSITE[playerFacing]);
    p.glance = 5000;
    void Dialogue.sayText(p.line, p.name);
    return true;
  }

  /**
   * Quien esté de pie en (x, y) se corre a otro lugar de su área para dejar pasar
   * (o se baja, si ya no cabe en ninguna parte). Devuelve false si ahí no había nadie de pie.
   */
  makeRoom(x: number, y: number): boolean {
    const p = this.people.find((q) => !q.seated && q.actor.occupies(x, y));
    if (!p) return false;
    const spot = p.area ? this.findStandingSpot(p.area) : undefined;
    if (spot) {
      p.actor.setTile(spot.x, spot.y);
      p.actor.sprite.setAlpha(0);
      this.scene.tweens.add({ targets: p.actor.sprite, alpha: 1, duration: FADE_MS });
    } else {
      this.people.splice(this.people.indexOf(p), 1);
      this.scene.tweens.add({ targets: p.actor.sprite, alpha: 0, duration: FADE_MS, onComplete: () => p.actor.destroy() });
    }
    return true;
  }

  update(delta: number, paused: boolean): void {
    if (paused) return;
    for (const p of this.people) {
      if (p.seated) continue;
      p.glance -= delta;
      if (p.glance > 0) continue;
      p.glance = Phaser.Math.Between(...GLANCE_MS);
      const look = p.dir && Math.random() < 0.6 ? p.dir : Phaser.Utils.Array.GetRandom(DIRECTIONS as Direction[]);
      p.actor.face(look);
    }
  }

  /** En una estación: se baja gente y sube otra (con un fundido). */
  turnover(): void {
    const leaving = Phaser.Utils.Array.Shuffle([...this.people]).slice(0, Phaser.Math.Between(1, 3));
    for (const p of leaving) {
      this.people.splice(this.people.indexOf(p), 1);
      this.scene.tweens.add({ targets: p.actor.sprite, alpha: 0, duration: FADE_MS, onComplete: () => p.actor.destroy() });
    }
    const arriving = Phaser.Math.Between(1, 3);
    this.scene.time.delayedCall(FADE_MS + 250, () => {
      const areas = this.def.areas ?? [];
      for (let i = 0; i < arriving; i++) {
        const sit = areas.length === 0 || Math.random() < 0.5;
        const p = sit ? this.addSeated() : this.addStanding(Phaser.Utils.Array.GetRandom(areas));
        if (!p) continue;
        p.actor.sprite.setAlpha(0);
        this.scene.tweens.add({ targets: p.actor.sprite, alpha: 1, duration: FADE_MS });
      }
    });
  }

  destroy(): void {
    for (const p of this.people) p.actor.destroy();
    this.people.length = 0;
  }

  // ---------------------------------------------------------------------------

  private addSeated(): Person | null {
    const free = this.seats.filter((s) => this.isFree(s.x, s.y));
    if (free.length <= MIN_FREE_SEATS) return null;
    const seat = Phaser.Utils.Array.GetRandom(free);
    const pose = SEAT_POSES[this.map.tileKeyAt(seat.x, seat.y) ?? ''];
    const p = this.spawn(seat.x, seat.y, pose.dir, null, null);
    p.actor.sitAt(seat.x, seat.y, pose);
    return p;
  }

  private addStanding(area: CrowdArea): Person | null {
    const spot = this.findStandingSpot(area);
    if (!spot) return null;
    const dir = area.dir ?? Phaser.Utils.Array.GetRandom(DIRECTIONS as Direction[]);
    return this.spawn(spot.x, spot.y, dir, area.dir ?? null, area);
  }

  /** Un lugar libre del área donde pararse sin tapar el paso. */
  private findStandingSpot(area: CrowdArea): { x: number; y: number } | undefined {
    const spots: Array<{ x: number; y: number }> = [];
    for (let y = area.y; y < area.y + area.h; y++) {
      for (let x = area.x; x < area.x + area.w; x++) spots.push({ x, y });
    }
    Phaser.Utils.Array.Shuffle(spots);
    return spots.find(
      (s) => !this.map.isSolid(s.x, s.y) && !this.keepClear.has(key(s.x, s.y)) && this.isFree(s.x, s.y) && this.keepsPassage(s.x, s.y),
    );
  }

  /** `area` null = sentado. */
  private spawn(x: number, y: number, facing: Direction, dir: Direction | null, area: CrowdArea | null): Person {
    const sprites = Object.keys(DATA.people).filter(hasCharacter);
    const sprite = Phaser.Utils.Array.GetRandom(sprites);
    const actor = new Actor(this.scene, `crowd_${sprite}`, charKey(sprite), x, y, facing, () => true);
    const p: Person = {
      actor,
      name: DATA.people[sprite],
      line: this.nextLine(),
      dir,
      seated: area === null,
      area,
      glance: Phaser.Math.Between(...GLANCE_MS),
    };
    this.people.push(p);
    return p;
  }

  private nextLine(): string {
    if (this.deck.length === 0) this.deck = Phaser.Utils.Array.Shuffle([...(DATA.lines[this.def.lines] ?? [])]);
    return this.deck.pop() ?? '...';
  }

  private isFree(x: number, y: number): boolean {
    return !this.blocked.has(key(x, y)) && !this.occupied(x, y) && !this.occupies(x, y);
  }

  private walkable(x: number, y: number): boolean {
    return !this.map.isSolid(x, y) && !this.occupies(x, y) && !this.occupied(x, y);
  }

  /**
   * ¿Se puede seguir pasando si alguien se para en (x, y)? Los tiles libres de alrededor (3×3)
   * tienen que quedar conectados entre sí sin pasar por el centro; si no, la persona taparía el paso.
   */
  private keepsPassage(x: number, y: number): boolean {
    const ring: Array<{ x: number; y: number }> = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((dx !== 0 || dy !== 0) && this.walkable(x + dx, y + dy)) ring.push({ x: x + dx, y: y + dy });
      }
    }
    if (ring.length <= 1) return true;
    const seen = new Set([key(ring[0].x, ring[0].y)]);
    const queue = [ring[0]];
    while (queue.length > 0) {
      const c = queue.pop()!;
      for (const v of Object.values(DIR_VECTORS)) {
        const n = ring.find((r) => r.x === c.x + v.x && r.y === c.y + v.y);
        if (n && !seen.has(key(n.x, n.y))) {
          seen.add(key(n.x, n.y));
          queue.push(n);
        }
      }
    }
    return seen.size === ring.length;
  }
}
