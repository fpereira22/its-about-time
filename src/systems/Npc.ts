import Phaser from 'phaser';
import { charKey, hasCharacter, hasObject, objKey } from '../art/SpriteRegistry';
import { DIR_VECTORS, DIRECTIONS, OPPOSITE, type Direction } from '../types/map';
import type { NpcDef } from '../types/story';
import { Actor, type BlockedFn } from './Actor';
import { check } from './Conditions';
import type { SeatPose } from './Seats';

/**
 * NPC u objeto interactuable definido en npcs.json.
 * Sin `sprite` ni `object` es invisible (sirve para puertas, timbres, etc.).
 */
export class Npc {
  readonly actor: Actor | null;
  private readonly homeX: number;
  private readonly homeY: number;
  private present = true;
  private wanderTimer: number;

  constructor(
    scene: Phaser.Scene,
    readonly def: NpcDef,
    isBlocked: BlockedFn,
    seat?: SeatPose,
  ) {
    this.homeX = def.x;
    this.homeY = def.y;
    this.wanderTimer = Phaser.Math.Between(1200, 3500);
    const dir = def.dir ?? 'down';
    if (def.sprite) {
      if (!hasCharacter(def.sprite)) throw new Error(`NPC "${def.id}": personaje "${def.sprite}" no existe`);
      this.actor = new Actor(scene, def.id, charKey(def.sprite), def.x, def.y, dir, isBlocked);
      // Un personaje puesto sobre un asiento aparece sentado.
      if (seat) this.actor.sitAt(def.x, def.y, seat);
    } else if (def.object) {
      if (!hasObject(def.object)) throw new Error(`NPC "${def.id}": objeto "${def.object}" no existe`);
      this.actor = new Actor(scene, def.id, objKey(def.object), def.x, def.y, dir, isBlocked, false);
    } else {
      this.actor = null;
    }
    this.refresh();
  }

  get tileX(): number {
    return this.actor?.tileX ?? this.def.x;
  }

  get tileY(): number {
    return this.actor?.tileY ?? this.def.y;
  }

  get isPresent(): boolean {
    return this.present;
  }

  get blocks(): boolean {
    return this.present && this.def.solid !== false;
  }

  occupies(x: number, y: number): boolean {
    return this.present && this.tileX === x && this.tileY === y;
  }

  /** Reevalúa la condición `if` (llamar cuando cambia el estado). */
  refresh(): void {
    this.present = check(this.def.if);
    this.actor?.sprite.setVisible(this.present);
  }

  /** No deambula por `ms` (ej. el pavo real mientras muestra la cola). */
  hold(ms: number): void {
    this.wanderTimer = Math.max(this.wanderTimer, ms);
  }

  /** Gira hacia quien le habla (solo personajes). */
  faceToward(fromDir: Direction): void {
    if (this.def.sprite && this.actor && !this.actor.moving) this.actor.face(OPPOSITE[fromDir]);
  }

  update(delta: number, paused: boolean): void {
    const wander = this.def.wander ?? 0;
    if (!this.present || paused || !this.actor || !this.def.sprite || wander <= 0 || this.actor.moving || this.actor.seated) return;
    this.wanderTimer -= delta;
    if (this.wanderTimer > 0) return;
    this.wanderTimer = Phaser.Math.Between(1500, 4000);

    const dir = Phaser.Utils.Array.GetRandom(DIRECTIONS as Direction[]);
    if (Math.random() < 0.4) {
      this.actor.face(dir);
      return;
    }
    const nx = this.actor.tileX + DIR_VECTORS[dir].x;
    const ny = this.actor.tileY + DIR_VECTORS[dir].y;
    if (Math.abs(nx - this.homeX) > wander || Math.abs(ny - this.homeY) > wander) {
      this.actor.face(dir);
      return;
    }
    this.actor.tryStep(dir, undefined, 260);
  }
}
