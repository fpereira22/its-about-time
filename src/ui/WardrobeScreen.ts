import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { frameIndex } from '../art/characters';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import type { MapScene } from '../scenes/MapScene';
import { Controls } from '../systems/Controls';
import { availableHats, availableShirts, currentOutfit, DEFAULT_OUTFIT, HATS, lookTexture, PANTS, playerLook, SHIRTS, SHOES, type ColorOption } from '../systems/PlayerLook';
import { StoryState } from '../systems/StoryState';
import type { Direction } from '../types/map';
import type { Outfit } from '../types/story';
import { drawPanel, drawTriangle, makeText, THEME } from './theme';

const PANEL = { x: 16, y: 20, w: 288, h: 148 };
const PREVIEW = { x: 80, y: 120, scale: 4 };
const ROW = 15;
const LIST_X = 150;
const FADE_MS = 120;
const TURN_MS = 900;
const TURN_ORDER: Direction[] = ['down', 'left', 'up', 'right'];

type RowId = 'hat' | 'shirt' | 'pants' | 'shoes' | 'glasses' | 'reset' | 'done';

const ROWS: Array<{ id: RowId; label: string }> = [
  { id: 'hat', label: 'Cabeza' },
  { id: 'shirt', label: 'Polera' },
  { id: 'pants', label: 'Pantalón' },
  { id: 'shoes', label: 'Zapatillas' },
  { id: 'glasses', label: 'Lentes' },
  { id: 'reset', label: 'Ropa de siempre' },
  { id: 'done', label: 'Listo' },
];

/**
 * Ropero: elige gorro o peinado, polera, pantalón, zapatillas y lentes, con vista previa que gira.
 * W/S elige la prenda, A/D cambia el color. Se abre con el evento 'open-wardrobe' (ropero de la casa)
 * o desde el menú de pausa ("Ropa"). Cada partida nueva parte con la ropa por defecto.
 */
export class WardrobeScreen {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly root: Phaser.GameObjects.Container;
  private map: MapScene | null = null;
  private active = false;
  private selected = 0;
  private outfit: Outfit = { ...DEFAULT_OUTFIT };
  private preview: Phaser.GameObjects.Image | null = null;
  private turn = 0;
  private turnTimer = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.overlay = scene.add
      .rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0x0a0e18, 1)
      .setOrigin(0, 0)
      .setAlpha(0)
      .setVisible(false)
      .setDepth(200);
    this.root = scene.add.container(0, 0).setDepth(201);
  }

  get isOpen(): boolean {
    return this.active;
  }

  open(map: MapScene): void {
    this.map = map;
    this.active = true;
    this.selected = 0;
    this.outfit = currentOutfit();
    this.turn = 0;
    this.turnTimer = 0;
    this.scene.scene.pause(map.scene.key);
    playSfx('open');
    this.scene.tweens.killTweensOf(this.overlay);
    this.overlay.setVisible(true);
    this.scene.tweens.add({ targets: this.overlay, alpha: 0.45, duration: FADE_MS });
    this.render();
    this.root.setAlpha(0).setY(4);
    this.scene.tweens.add({ targets: this.root, alpha: 1, y: 0, duration: FADE_MS, ease: 'Cubic.Out' });
  }

  close(): void {
    if (!this.active) return;
    this.active = false;
    StoryState.setOutfit(sameOutfit(this.outfit, DEFAULT_OUTFIT) ? null : { ...this.outfit });
    this.root.removeAll(true);
    this.preview = null;
    this.scene.tweens.killTweensOf(this.overlay);
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => this.overlay.setVisible(false),
    });
    if (this.map) this.scene.scene.resume(this.map.scene.key);
    this.map = null;
  }

  update(delta: number): void {
    if (!this.active) return;
    this.turnTimer += delta;
    if (this.turnTimer >= TURN_MS) {
      this.turnTimer = 0;
      this.turn = (this.turn + 1) % TURN_ORDER.length;
      this.preview?.setFrame(frameIndex(TURN_ORDER[this.turn], 0));
    }

    const up = Controls.consume('up');
    const down = Controls.consume('down');
    const left = Controls.consume('left');
    const right = Controls.consume('right');
    const ok = Controls.consume('interact');
    const back = Controls.consume('menu') || Controls.consume('inventory');

    if (back) {
      playSfx('close');
      return this.close();
    }
    if (up || down) {
      playSfx('cursor');
      this.selected = (this.selected + (down ? 1 : -1) + ROWS.length) % ROWS.length;
      this.render();
    }
    const row = ROWS[this.selected].id;
    if (left || right) this.change(row, right ? 1 : -1);
    if (ok) {
      if (row === 'done') {
        playSfx('select');
        return this.close();
      }
      if (row === 'reset') {
        playSfx('select');
        this.outfit = { ...DEFAULT_OUTFIT };
        this.render();
        return;
      }
      this.change(row, 1);
    }
  }

  private change(row: RowId, step: number): void {
    const o = this.outfit;
    if (row === 'hat') o.hat = cycle(availableHats().map((h) => h.id), o.hat, step);
    else if (row === 'shirt') o.shirt = cycleColor(availableShirts(), o.shirt, step);
    else if (row === 'pants') o.pants = cycleColor(PANTS, o.pants, step);
    else if (row === 'shoes') o.shoes = cycleColor(SHOES, o.shoes, step);
    else if (row === 'glasses') o.glasses = !o.glasses;
    else return;
    playSfx('cursor');
    this.render();
  }

  private valueLabel(row: RowId): string {
    const o = this.outfit;
    switch (row) {
      case 'hat':
        return HATS.find((h) => h.id === o.hat)?.label ?? '';
      case 'shirt':
        return SHIRTS.find((c) => c.hex === o.shirt)?.label ?? '';
      case 'pants':
        return PANTS.find((c) => c.hex === o.pants)?.label ?? '';
      case 'shoes':
        return SHOES.find((c) => c.hex === o.shoes)?.label ?? '';
      case 'glasses':
        return o.glasses ? 'Sí' : 'No';
      default:
        return '';
    }
  }

  private render(): void {
    this.root.removeAll(true);
    const { x, y, w, h } = PANEL;
    const g = this.scene.add.graphics();
    drawPanel(g, x, y, w, h, { radius: 7 });
    // Fondo de la vista previa: una "pieza" con piso.
    g.fillStyle(0xdcd3c0, 1).fillRoundedRect(x + 10, y + 22, 108, 116, 5);
    g.fillStyle(0xb89870, 1).fillRect(x + 10, PREVIEW.y - 6, 108, 30);
    g.fillStyle(0x000000, 0.15).fillEllipse(PREVIEW.x, PREVIEW.y, 36, 8);
    this.root.add(g);
    this.root.add(makeText(this.scene, x + 12, y + 8, 'ROPERO', { fontFamily: FONT_HUD, fontSize: '8px', color: THEME.accentCss }));

    // La vista previa muestra la ropa elegida (aunque andes en pijama).
    const key = lookTexture(this.scene, playerLook(this.outfit, false));
    this.preview = this.scene.add.image(PREVIEW.x, PREVIEW.y, key, frameIndex(TURN_ORDER[this.turn], 0)).setOrigin(0.5, 1).setScale(PREVIEW.scale);
    this.root.add(this.preview);

    ROWS.forEach((row, i) => {
      const ry = y + 14 + i * ROW;
      const sel = i === this.selected;
      const color = sel ? THEME.accentCss : THEME.ink;
      this.root.add(makeText(this.scene, LIST_X, ry, row.label, { color, fontStyle: sel ? '600' : undefined }));
      const value = this.valueLabel(row.id);
      if (value) {
        this.root.add(makeText(this.scene, x + w - 16, ry, `< ${value} >`, { color: sel ? THEME.accentCss : THEME.inkMuted }).setOrigin(1, 0));
      }
      const swatch = rowColor(row.id, this.outfit);
      if (swatch) {
        const sw = this.scene.add.graphics();
        sw.fillStyle(THEME.panelEdge, 1).fillRect(LIST_X - 13, ry + 3, 8, 8);
        sw.fillStyle(Phaser.Display.Color.HexStringToColor(swatch).color, 1).fillRect(LIST_X - 12, ry + 4, 6, 6);
        this.root.add(sw);
      }
      if (sel && !swatch) {
        const c = this.scene.add.graphics();
        drawTriangle(c, 'right', THEME.accent, 3);
        c.setPosition(LIST_X - 8, ry + 7);
        this.root.add(c);
      }
    });
    this.root.add(
      makeText(this.scene, BASE_WIDTH / 2, BASE_HEIGHT - 3, 'W/S: prenda · A/D: cambiar · E: elegir · Esc: listo', {
        fontFamily: FONT_HUD,
        fontSize: '8px',
        color: '#c8d0e8',
      }).setOrigin(0.5, 1),
    );
  }
}

function rowColor(row: RowId, o: Outfit): string | null {
  if (row === 'shirt') return o.shirt;
  if (row === 'pants') return o.pants;
  if (row === 'shoes') return o.shoes;
  return null;
}

function cycle(values: string[], current: string, step: number): string {
  const i = values.indexOf(current);
  return values[(Math.max(0, i) + step + values.length) % values.length];
}

function cycleColor(options: ColorOption[], current: string, step: number): string {
  return cycle(
    options.map((o) => o.hex),
    current,
    step,
  );
}

function sameOutfit(a: Outfit, b: Outfit): boolean {
  return a.hat === b.hat && a.shirt === b.shirt && a.pants === b.pants && a.shoes === b.shoes && a.glasses === b.glasses;
}
