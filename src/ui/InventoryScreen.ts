import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { objKey } from '../art/SpriteRegistry';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import type { MapScene } from '../scenes/MapScene';
import { Controls } from '../systems/Controls';
import { Dialogue } from '../systems/DialogueManager';
import { formatMoney, StoryState } from '../systems/StoryState';
import type { ItemDef } from '../types/story';
import { drawPanel, drawTriangle, makeText, THEME } from './theme';

const PANEL = { x: 16, y: 20, w: 288, h: 148 };
const LIST_W = 132;
const ROW = 17;
const VISIBLE = 5;
const ACTION_ROW = 13;
const FADE_MS = 120;

interface Entry {
  id: string;
  qty: number;
  def: ItemDef;
}

/** Un inventario por escena UI, para que el menú de pausa abra el mismo. */
const instances = new WeakMap<Phaser.Scene, InventoryScreen>();

/**
 * Inventario (Tab): pausa el mapa, muestra Bip!, efectivo e ítems, y permite usarlos.
 * Usar un ítem cierra el inventario y abre el diálogo `use` del ítem (items.json).
 */
export class InventoryScreen {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly root: Phaser.GameObjects.Container;
  private map: MapScene | null = null;
  private active = false;
  private selected = 0;
  private scroll = 0;
  /** Acciones del submenú del ítem seleccionado; null = submenú cerrado. */
  private actions: string[] | null = null;
  private actionIndex = 0;

  static for(scene: Phaser.Scene): InventoryScreen | undefined {
    return instances.get(scene);
  }

  constructor(private readonly scene: Phaser.Scene) {
    instances.set(scene, this);
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
    this.scroll = 0;
    this.actions = null;
    // Siempre pausar: si venimos del menú de pausa, su resume() puede estar en cola.
    this.scene.scene.pause(map.scene.key);
    playSfx('open');
    this.scene.tweens.killTweensOf(this.overlay);
    this.overlay.setVisible(true);
    this.scene.tweens.add({ targets: this.overlay, alpha: 0.45, duration: FADE_MS });
    this.render(true);
  }

  close(): void {
    if (!this.active) return;
    this.active = false;
    this.actions = null;
    this.root.removeAll(true);
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

  update(_delta: number): void {
    if (!this.active) return;
    const up = Controls.consume('up');
    const down = Controls.consume('down');
    const ok = Controls.consume('interact');
    const back = Controls.consume('menu') || Controls.consume('inventory');

    if (this.actions) {
      const n = this.actions.length;
      if (up || down) {
        this.actionIndex = (this.actionIndex + (down ? 1 : -1) + n) % n;
        playSfx('cursor');
        this.render(false);
      }
      if (back) {
        playSfx('cancel');
        this.actions = null;
        this.render(false);
      } else if (ok) {
        this.runAction(this.actions[this.actionIndex]);
      }
      return;
    }

    if (back) {
      playSfx('close');
      this.close();
      return;
    }
    const items = this.entries();
    if (items.length > 0 && (up || down)) {
      const next = Phaser.Math.Clamp(this.selected + (down ? 1 : -1), 0, items.length - 1);
      if (next !== this.selected) {
        this.selected = next;
        if (this.selected < this.scroll) this.scroll = this.selected;
        if (this.selected >= this.scroll + VISIBLE) this.scroll = this.selected - VISIBLE + 1;
        playSfx('cursor');
        this.render(false);
      }
    }
    if (ok && items.length > 0) {
      const def = items[this.selected].def;
      if (!def.use) {
        playSfx('error');
        return;
      }
      playSfx('select');
      this.actions = [def.useLabel ?? 'Usar', 'Cancelar'];
      this.actionIndex = 0;
      this.render(false);
    }
  }

  private runAction(action: string): void {
    const entry = this.entries()[this.selected];
    if (action === 'Cancelar' || !entry?.def.use) {
      playSfx('cancel');
      this.actions = null;
      this.render(false);
      return;
    }
    playSfx('select');
    const { id, def } = entry;
    const before = StoryState.itemCount(id);
    this.close();
    void Dialogue.run(def.use!).then(() => {
      if (def.useSfx && StoryState.itemCount(id) < before) playSfx(def.useSfx);
    });
  }

  private entries(): Entry[] {
    return StoryState.inventory();
  }

  // ---------------------------------------------------------------------------

  private render(animate: boolean): void {
    this.root.removeAll(true);
    const { x, y, w, h } = PANEL;
    const left = x + 12;
    const g = this.scene.add.graphics();
    drawPanel(g, x, y, w, h, { radius: 7 });
    this.add(g);
    this.add(makeText(this.scene, left, y + 9, 'INVENTARIO', { fontFamily: FONT_HUD, fontSize: '8px', color: THEME.accentCss }));

    const cards: Array<[string, string, string]> = [
      ['bip', 'Tarjeta Bip!', formatMoney(StoryState.bip)],
      ['plata', 'Efectivo', formatMoney(StoryState.money)],
    ];
    cards.forEach(([icon, label, value], i) => {
      const cx = left + i * 136;
      const card = this.scene.add.graphics();
      drawPanel(card, cx, y + 21, 128, 22, { radius: 4, fill: THEME.panelInner, edge: 0xd2c9b4, shadow: false });
      this.add(card);
      this.add(this.scene.add.image(cx + 12, y + 32, objKey(icon)));
      this.add(makeText(this.scene, cx + 24, y + 26, label, { fontSize: '9px', color: THEME.inkMuted }));
      this.add(makeText(this.scene, cx + 122, y + 25, value, { fontStyle: '600', color: THEME.ink }).setOrigin(1, 0));
    });

    const items = this.entries();
    const listY = y + 50;
    if (items.length === 0) {
      this.add(makeText(this.scene, left, listY + 6, 'No tienes nada... ni pa\' la micro.', { color: THEME.inkMuted }));
      this.hint('Tab / Esc: cerrar');
      this.animate(animate);
      return;
    }

    this.buildList(items, left, listY);
    this.buildDetail(items[this.selected], left + LIST_W + 10, listY, x + w - 12);
    if (this.actions) this.buildActions(left + LIST_W + 10, listY + 58);

    this.hint(this.actions ? 'W/S: elegir · E: confirmar · Esc: volver' : 'W/S: mover · E: usar · Tab / Esc: cerrar');
    this.animate(animate);
  }

  private buildList(items: Entry[], left: number, listY: number): void {
    items.slice(this.scroll, this.scroll + VISIBLE).forEach((item, i) => {
      const index = this.scroll + i;
      const ry = listY + i * ROW;
      const active = index === this.selected;
      if (active) {
        this.add(this.scene.add.graphics().fillStyle(THEME.accent, 0.12).fillRoundedRect(left - 2, ry, LIST_W, ROW - 1, 3));
        const c = this.scene.add.graphics();
        drawTriangle(c, 'right', THEME.accent, 3);
        c.setPosition(left + 3, ry + 8);
        this.add(c);
      }
      this.add(this.scene.add.image(left + 16, ry + 8, objKey(item.def.icon)));
      const label = (item.def.collectible ? '★ ' : '') + item.def.name;
      this.add(makeText(this.scene, left + 28, ry + 3, label, { color: active ? THEME.accentCss : THEME.ink, fontSize: '9px' }));
      if (item.qty > 1) {
        this.add(makeText(this.scene, left + LIST_W - 6, ry + 3, `x${item.qty}`, { color: THEME.inkMuted, fontSize: '9px' }).setOrigin(1, 0));
      }
    });
    const n = items.length;
    if (this.scroll > 0) this.arrow(left + LIST_W / 2, listY - 3, true);
    if (this.scroll + VISIBLE < n) this.arrow(left + LIST_W / 2, listY + VISIBLE * ROW + 1, false);
  }

  private buildDetail(item: Entry, dx: number, listY: number, right: number): void {
    const width = right - dx;
    this.add(this.scene.add.image(dx + 16, listY + 16, objKey(item.def.icon)).setScale(2));
    this.add(
      makeText(this.scene, dx + 38, listY + 3, item.def.name, {
        fontStyle: '600',
        color: THEME.ink,
        wordWrap: { width: width - 38, useAdvancedWrap: true },
      }),
    );
    if (item.def.collectible) {
      this.add(makeText(this.scene, dx + 38, listY + 25, '★ Coleccionable', { fontSize: '9px', color: THEME.accentCss }));
    }
    if (!this.actions) {
      this.add(
        makeText(this.scene, dx, listY + 38, item.def.description, {
          fontSize: '9px',
          color: THEME.inkMuted,
          wordWrap: { width, useAdvancedWrap: true },
        }),
      );
      if (item.def.use) {
        this.add(
          makeText(this.scene, dx, listY + 74, `E: ${item.def.useLabel ?? 'Usar'}`, { fontSize: '9px', color: THEME.accentCss }),
        );
      }
    }
  }

  private buildActions(x: number, y: number): void {
    const actions = this.actions ?? [];
    const texts = actions.map((label, i) =>
      makeText(this.scene, x + 18, y + 5 + i * ACTION_ROW, label, {
        color: i === this.actionIndex ? THEME.accentCss : THEME.ink,
      }),
    );
    const w = Math.ceil(Math.max(...texts.map((t) => t.width))) + 28;
    const bg = this.scene.add.graphics();
    drawPanel(bg, x, y, w, actions.length * ACTION_ROW + 9, { radius: 5, fill: THEME.panel, shadow: true });
    this.add(bg);
    texts.forEach((t) => this.add(t));
    const c = this.scene.add.graphics();
    drawTriangle(c, 'right', THEME.accent, 3);
    c.setPosition(x + 10, y + 5 + this.actionIndex * ACTION_ROW + 6.5);
    this.add(c);
  }

  private animate(animate: boolean): void {
    if (!animate) return;
    this.scene.tweens.killTweensOf(this.root);
    this.root.setAlpha(0).setY(4);
    this.scene.tweens.add({ targets: this.root, alpha: 1, y: 0, duration: FADE_MS, ease: 'Cubic.Out' });
  }

  private hint(text: string): void {
    this.add(
      makeText(this.scene, BASE_WIDTH / 2, BASE_HEIGHT - 3, text, { fontFamily: FONT_HUD, fontSize: '8px', color: '#c8d0e8' }).setOrigin(0.5, 1),
    );
  }

  private arrow(x: number, y: number, up: boolean): void {
    const g = this.scene.add.graphics().fillStyle(THEME.accent, 1);
    if (up) g.fillTriangle(x - 3, y + 2, x + 3, y + 2, x, y - 1);
    else g.fillTriangle(x - 3, y - 1, x + 3, y - 1, x, y + 2);
    this.add(g);
  }

  private add(obj: Phaser.GameObjects.GameObject): void {
    this.root.add(obj);
  }
}
