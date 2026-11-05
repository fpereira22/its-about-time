import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH } from '../config/display';
import type { Direction } from '../types/map';
import { EventSystem } from './EventSystem';
import { StoryState } from './StoryState';

/**
 * Apagón (misión 6, la Colina de San Antonio de noche): todo queda a oscuras menos un círculo alrededor
 * del jugador. Con la linterna del celular (F) el círculo crece y se corre hacia donde mira; la batería
 * se gasta y, cuando queda poca, la luz titila. Lo prende la flag `m6_apagon`; la linterna es `_linterna`.
 */

export const FLAG_BLACKOUT = 'm6_apagon';
export const FLAG_TORCH = '_linterna';
/** Con la batería en cero, Sira prende la suya (flag de la historia). */
export const FLAG_SIRA_TORCH = 'm6_linterna_sira';

const DEPTH = 9500;
const MARGIN = 24;
const SMALL_R = 22;
const TORCH_R = 62;
/** Segundos de linterna con la batería llena. */
const BATTERY_S = 75;

let battery = 1;

/** Batería de la linterna (0..1), para el HUD y los diálogos. */
export function torchBattery(): number {
  return battery;
}

function radialTexture(scene: Phaser.Scene, key: string, r: number): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, r * 2, r * 2);
  if (!tex) return;
  const ctx = tex.getContext();
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, r * 2, r * 2);
  tex.refresh();
}

export class DarknessView {
  private readonly rt: Phaser.GameObjects.RenderTexture;
  private readonly small: Phaser.GameObjects.Image;
  private readonly torch: Phaser.GameObjects.Image;
  private readonly glowSmall: Phaser.GameObjects.Image;
  private flicker = 0;
  private warned = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly target: () => { x: number; y: number; facing: Direction },
    private readonly companion: () => { x: number; y: number } | null,
  ) {
    radialTexture(scene, 'luz_chica', SMALL_R);
    radialTexture(scene, 'luz_linterna', TORCH_R);
    this.rt = scene.add.renderTexture(0, 0, BASE_WIDTH + MARGIN * 2, BASE_HEIGHT + MARGIN * 2).setOrigin(0, 0).setDepth(DEPTH);
    this.small = scene.make.image({ key: 'luz_chica', add: false });
    this.torch = scene.make.image({ key: 'luz_linterna', add: false });
    this.glowSmall = scene.make.image({ key: 'luz_chica', add: false }).setScale(0.8);
    this.rt.setVisible(false);
    EventSystem.onScene(scene, 'state-changed', () => {
      if (!StoryState.hasFlag(FLAG_BLACKOUT)) battery = 1;
    });
  }

  /** ¿Está oscuro (apagón)? */
  get active(): boolean {
    return StoryState.hasFlag(FLAG_BLACKOUT);
  }

  /** F: prender o apagar la linterna del celular. */
  toggleTorch(): void {
    if (!this.active) return;
    if (battery <= 0) {
      playSfx('error');
      EventSystem.emit('banner', { title: 'Sin batería', subtitle: 'La linterna no prende' });
      return;
    }
    StoryState.setFlag(FLAG_TORCH, !StoryState.hasFlag(FLAG_TORCH));
    playSfx('linterna');
  }

  update(delta: number): void {
    const on = this.active;
    this.rt.setVisible(on);
    if (!on) return;
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const ox = Math.floor(view.x) - MARGIN;
    const oy = Math.floor(view.y) - MARGIN;
    this.rt.setPosition(ox, oy);
    const torchOn = StoryState.hasFlag(FLAG_TORCH);
    if (torchOn) {
      battery = Math.max(0, battery - delta / 1000 / BATTERY_S);
      if (battery <= 0) {
        StoryState.setFlag(FLAG_TORCH, false);
        playSfx('apagon');
        // Sira prende la de su celular (con la suya alumbran los dos).
        StoryState.setFlag(FLAG_SIRA_TORCH);
        EventSystem.emit('banner', { title: 'Se acabó tu batería', subtitle: 'Sira prende la linterna de su celular' });
      } else if (battery < 0.2 && !this.warned) {
        this.warned = true;
        EventSystem.emit('banner', { title: 'Batería baja', subtitle: `${Math.round(battery * 100)} %` });
      }
    }
    this.flicker -= delta;
    const lowFlicker = torchOn && battery < 0.2 && Math.random() < 0.08;
    if (lowFlicker) this.flicker = 90;

    this.rt.clear();
    this.rt.fill(0x04050c, 0.94);
    const p = this.target();
    const px = p.x - ox;
    const py = p.y - oy - 8;
    this.rt.erase(this.small, px, py);
    const sira = StoryState.hasFlag(FLAG_SIRA_TORCH);
    if ((torchOn && this.flicker <= 0) || sira) {
      // La linterna alumbra hacia adelante (un poco más allá de los pies).
      const d = { up: [0, -30], down: [0, 30], left: [-30, 0], right: [30, 0] }[p.facing];
      this.rt.erase(this.torch, px + d[0], py + d[1]);
    }
    const c = this.companion();
    if (c) this.rt.erase(this.glowSmall, c.x - ox, c.y - oy - 8);
  }

  destroy(): void {
    this.rt.destroy();
    this.small.destroy();
    this.torch.destroy();
    this.glowSmall.destroy();
  }
}
