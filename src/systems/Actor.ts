import Phaser from 'phaser';
import { frameIndex } from '../art/characters';
import { TILE } from '../config/display';
import { DIR_VECTORS, type Direction } from '../types/map';
import type { SeatPose } from './Seats';

export const WALK_MS = 210;

export type BlockedFn = (x: number, y: number, self: Actor) => boolean;

/**
 * Personaje que se mueve de a un tile (16 px) con animación de 4 direcciones.
 * El tile de destino se reserva al comenzar el paso, así dos actores no pueden chocar a mitad de camino.
 */
export class Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  tileX: number;
  tileY: number;
  facing: Direction;
  moving = false;
  private stepParity: 1 | 2 = 1;
  private pose: SeatPose | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly id: string,
    textureKey: string,
    x: number,
    y: number,
    facing: Direction,
    private readonly isBlocked: BlockedFn,
    private readonly animated = true,
  ) {
    this.tileX = x;
    this.tileY = y;
    this.facing = facing;
    this.sprite = scene.add.sprite(0, 0, textureKey, animated ? frameIndex(facing, 0) : undefined);
    this.sprite.setOrigin(0.5, 1);
    this.placeSprite();
  }

  get seated(): boolean {
    return this.pose !== null;
  }

  face(dir: Direction): void {
    this.facing = dir;
    if (this.animated && !this.moving) this.sprite.setFrame(frameIndex(dir, 0));
  }

  /** Tile que está justo enfrente del actor. */
  facingTile(): { x: number; y: number } {
    const v = DIR_VECTORS[this.facing];
    return { x: this.tileX + v.x, y: this.tileY + v.y };
  }

  occupies(x: number, y: number): boolean {
    return this.tileX === x && this.tileY === y;
  }

  /** Intenta avanzar un tile. Devuelve false si está ocupado o bloqueado. */
  tryStep(dir: Direction, onArrive?: () => void, durationMs = WALK_MS): boolean {
    if (this.moving) return false;
    this.face(dir);
    const v = DIR_VECTORS[dir];
    const nx = this.tileX + v.x;
    const ny = this.tileY + v.y;
    if (this.isBlocked(nx, ny, this)) return false;

    const fromX = this.sprite.x;
    const fromY = this.sprite.y;
    this.tileX = nx;
    this.tileY = ny;
    this.moving = true;
    const step = this.stepParity;
    this.stepParity = step === 1 ? 2 : 1;
    if (this.animated) this.sprite.setFrame(frameIndex(dir, step));

    const progress = { t: 0 };
    this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: durationMs,
      onUpdate: () => {
        // Posiciones enteras: evita costuras en el tilemap y mantiene el look pixel-perfect.
        this.sprite.x = Math.round(fromX + v.x * TILE * progress.t);
        this.sprite.y = Math.round(fromY + v.y * TILE * progress.t);
        this.sprite.setDepth(this.sprite.y);
        if (this.animated && progress.t >= 0.5) this.sprite.setFrame(frameIndex(dir, 0));
      },
      onComplete: () => {
        this.placeSprite();
        this.moving = false;
        onArrive?.();
      },
    });
    return true;
  }

  /** Teletransporta sin animación. */
  setTile(x: number, y: number, facing?: Direction): void {
    this.tileX = x;
    this.tileY = y;
    if (facing) this.face(facing);
    this.placeSprite();
  }

  /** Se sienta en el asiento (x, y): baja hasta el cojín y se le esconden las piernas. */
  sitAt(x: number, y: number, pose: SeatPose, ms = 0): void {
    this.pose = pose;
    this.slideTo(x, y, pose.dir, ms, () => this.sprite.setCrop(0, 0, TILE, pose.rows));
  }

  /** Se pone de pie en el tile (x, y). */
  standAt(x: number, y: number, facing: Direction, ms = 0): void {
    this.pose = null;
    this.sprite.setCrop();
    this.slideTo(x, y, facing, ms);
  }

  destroy(): void {
    this.sprite.destroy();
  }

  /** Mueve al tile (x, y) sin revisar colisiones (sentarse y pararse). */
  private slideTo(x: number, y: number, facing: Direction, ms: number, onDone?: () => void): void {
    this.tileX = x;
    this.tileY = y;
    this.face(facing);
    if (ms <= 0) {
      this.placeSprite();
      onDone?.();
      return;
    }
    const fromX = this.sprite.x;
    const fromY = this.sprite.y;
    const to = this.spritePosition();
    this.moving = true;
    const progress = { t: 0 };
    this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: ms,
      ease: 'Quad.Out',
      onUpdate: () => {
        this.sprite.x = Math.round(fromX + (to.x - fromX) * progress.t);
        this.sprite.y = Math.round(fromY + (to.y - fromY) * progress.t);
        this.sprite.setDepth(Math.max(this.sprite.y, to.y));
      },
      onComplete: () => {
        this.placeSprite();
        this.moving = false;
        onDone?.();
      },
    });
  }

  private spritePosition(): { x: number; y: number } {
    return { x: this.tileX * TILE + TILE / 2, y: this.tileY * TILE + TILE + (this.pose?.dy ?? 0) };
  }

  private placeSprite(): void {
    const { x, y } = this.spritePosition();
    this.sprite.setPosition(x, y);
    this.sprite.setDepth(this.sprite.y);
  }
}
