import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { objKey } from '../art/SpriteRegistry';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import type { MapScene } from '../scenes/MapScene';
import { Admin } from '../systems/Admin';
import { Controls } from '../systems/Controls';
import { canFullscreen } from '../systems/Fullscreen';
import { TouchControls } from '../systems/TouchControls';
import { EventSystem } from '../systems/EventSystem';
import { missionSummary } from '../systems/Mission';
import { SaveSlots, SLOT_COUNT } from '../systems/SaveSlots';
import { StoryState } from '../systems/StoryState';
import { InventoryScreen } from './InventoryScreen';
import { SettingsPanel } from './SettingsPanel';
import { drawPanel, drawTriangle, fitText, makeText, THEME } from './theme';

type View = 'main' | 'mission' | 'confirm' | 'slots' | 'settings';

const MAIN_OPTIONS = ['Misión actual', 'Inventario', 'Ropa', 'Guardar', 'Cargar', 'Ajustes', 'Volver', 'Salir'];
const OPT_ADMIN = 'Ir a etapa';
const OPT_SAVE = MAIN_OPTIONS.indexOf('Guardar');
const OPT_LOAD = MAIN_OPTIONS.indexOf('Cargar');
const OPT_QUIT = MAIN_OPTIONS.indexOf('Salir');
const OPT_SETTINGS = MAIN_OPTIONS.indexOf('Ajustes');

/** El modo admin se puede activar con el juego abierto: por eso no es una constante. */
function mainOptions(): string[] {
  return Admin.active ? [...MAIN_OPTIONS, OPT_ADMIN] : MAIN_OPTIONS;
}
/** Alto de cada espacio en la lista de guardar/cargar. */
const SLOT_ROW = 38;
const CONFIRM_OPTIONS = ['Sí', 'No'];
/** Panel grande de Misión e Inventario. */
const BIG = { x: 16, y: 20, w: 288, h: 148 };
const ROW = 15;
const FADE_MS = 120;

/** Pregunta de sí/no: qué hacer con cada respuesta. */
interface Confirm {
  question: string;
  yes: () => void;
  no: () => void;
}

/**
 * Menú de pausa (Esc): pausa la escena del mapa y muestra Misión actual, Inventario, Ropa,
 * Guardar / Cargar (espacios de guardado, ver SaveSlots) y Salir.
 * "Inventario" cierra el menú y abre el InventoryScreen (el mismo de Tab).
 * Vive en la escena UI; mientras está abierto se queda con toda la entrada.
 */
export class PauseMenu {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly root: Phaser.GameObjects.Container;
  private view: View | null = null;
  private selected = 0;
  private map: MapScene | null = null;
  private cursor: Phaser.GameObjects.Graphics | null = null;
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private leaving = false;
  private slotMode: 'save' | 'load' = 'save';
  private confirmData: Confirm | null = null;
  /** Aviso corto bajo las opciones (ej. por qué no se puede guardar). */
  private note = '';
  private settings: SettingsPanel | null = null;

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
    return this.view !== null;
  }

  open(map: MapScene): void {
    this.map = map;
    this.leaving = false;
    this.scene.scene.pause(map.scene.key);
    this.scene.tweens.killTweensOf(this.overlay);
    this.overlay.setVisible(true);
    this.scene.tweens.add({ targets: this.overlay, alpha: 0.45, duration: FADE_MS });
    playSfx('open');
    this.note = '';
    this.show('main', 0);
  }

  close(): void {
    this.view = null;
    this.settings?.destroy();
    this.settings = null;
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

  update(): void {
    if (!this.view || this.leaving) return;
    if (this.view === 'settings') {
      // El panel consume su propia entrada (incluido Esc, que vuelve aquí).
      this.settings?.update();
      return;
    }
    const up = Controls.consume('up');
    const down = Controls.consume('down');
    const ok = Controls.consume('interact');
    const back = Controls.consume('menu');

    switch (this.view) {
      case 'main':
        if (up || down) this.move(down, mainOptions().length);
        if (back) {
          playSfx('close');
          return this.close();
        }
        if (ok) this.chooseMain(mainOptions()[this.selected]);
        return;
      case 'mission':
        if (ok || back) this.back(0);
        return;
      case 'slots':
        if (up || down) this.move(down, SLOT_COUNT);
        if (back) return this.back(this.slotMode === 'save' ? OPT_SAVE : OPT_LOAD);
        if (ok) this.chooseSlot(this.selected);
        return;
      case 'confirm': {
        const c = this.confirmData;
        if (!c) return this.back(0);
        if (up || down) this.move(down, CONFIRM_OPTIONS.length);
        if (back) {
          playSfx('cancel');
          return c.no();
        }
        if (ok) {
          playSfx(this.selected === 0 ? 'select' : 'cancel');
          if (this.selected === 0) c.yes();
          else c.no();
        }
        return;
      }
    }
  }

  private chooseMain(option: string): void {
    this.note = '';
    switch (option) {
      case 'Misión actual':
        return this.enter('mission', 0);
      case 'Inventario':
        return this.openInventory();
      case 'Ropa':
        playSfx('select');
        EventSystem.emit('open-wardrobe');
        return;
      case 'Guardar': {
        const reason = this.map?.saveBlockedReason;
        if (reason) {
          playSfx('error');
          this.note = reason;
          return this.render(false);
        }
        this.slotMode = 'save';
        return this.enter('slots', 0);
      }
      case 'Cargar':
        if (!SaveSlots.any) {
          playSfx('error');
          this.note = 'No hay partidas guardadas';
          return this.render(false);
        }
        this.slotMode = 'load';
        return this.enter('slots', 0);
      case 'Ajustes':
        return this.openSettings();
      case 'Volver':
        playSfx('close');
        return this.close();
      case OPT_ADMIN:
        return Admin.toggleWarp(this.scene.game);
      case 'Salir':
        return this.ask(
          '¿Volver al título? Tu partida queda guardada.',
          () => this.quitToTitle(),
          () => this.show('main', OPT_QUIT),
        );
    }
  }

  private openSettings(): void {
    playSfx('select');
    this.view = 'settings';
    this.root.removeAll(true);
    this.settings = new SettingsPanel(this.scene, {
      depth: 202,
      onClose: () => {
        this.settings = null;
        this.show('main', OPT_SETTINGS);
      },
    });
  }

  private chooseSlot(i: number): void {
    const back = (): void => this.show('slots', i);
    const filled = SaveSlots.summary(i) !== null;
    if (this.slotMode === 'save') {
      if (filled) this.ask(`¿Sobrescribir el espacio ${i + 1}?`, () => this.saveTo(i), back);
      else {
        playSfx('select');
        this.saveTo(i);
      }
      return;
    }
    if (!filled) {
      playSfx('error');
      return;
    }
    this.ask(`¿Cargar el espacio ${i + 1}? Lo que jugaste desde ahí se pierde.`, () => this.loadFrom(i), back);
  }

  private ask(question: string, yes: () => void, no: () => void): void {
    this.confirmData = { question, yes, no };
    this.enter('confirm', 1);
  }

  private saveTo(i: number): void {
    const map = this.map;
    if (!map) return;
    this.note = SaveSlots.save(i, map.saveSpot)
      ? `Guardado en el espacio ${i + 1}`
      : 'No se pudo guardar (almacenamiento lleno o bloqueado)';
    this.show('slots', i);
  }

  /** Carga un espacio: funde a negro, reemplaza la partida y arranca el mapa guardado. */
  private loadFrom(i: number): void {
    const map = this.map;
    if (!map) return;
    this.leaving = true;
    this.root.removeAll(true);
    this.scene.tweens.killTweensOf(this.overlay);
    this.overlay.setFillStyle(0x000000, 1).setVisible(true);
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 1,
      duration: 250,
      onComplete: () => {
        const target = SaveSlots.load(i);
        this.view = null;
        this.map = null;
        this.leaving = false;
        if (target) map.scene.start(target.scene, target.data);
        else {
          playSfx('error');
          this.scene.scene.resume(map.scene.key);
        }
        // El mapa nuevo parte en negro y se aclara solo; el velo se quita un poco después para no ver el viejo.
        this.scene.time.delayedCall(80, () => {
          this.overlay.setVisible(false).setAlpha(0).setFillStyle(0x0a0e18, 1);
        });
      },
    });
  }

  private move(down: boolean, n: number): void {
    playSfx('cursor');
    this.select(this.wrap(this.selected + (down ? 1 : -1), n));
  }

  private enter(view: View, selected: number): void {
    playSfx('select');
    this.show(view, selected);
  }

  private back(selected: number): void {
    playSfx('cancel');
    this.show('main', selected);
  }

  /** Cierra la pausa y abre el inventario compartido (el mismo de Tab). */
  private openInventory(): void {
    const map = this.map;
    const inventory = InventoryScreen.for(this.scene);
    if (!map || !inventory) return;
    this.close();
    inventory.open(map);
  }

  private show(view: View, selected: number): void {
    this.view = view;
    this.selected = selected;
    this.render(true);
  }

  private render(animate: boolean): void {
    this.root.removeAll(true);
    this.cursor = null;
    this.optionTexts = [];
    if (this.view === 'main') this.buildMain();
    else if (this.view === 'mission') this.buildMission();
    else if (this.view === 'confirm') this.buildConfirm();
    else if (this.view === 'slots') this.buildSlots();
    if (!animate) return;
    this.scene.tweens.killTweensOf(this.root);
    this.root.setAlpha(0).setY(4);
    this.scene.tweens.add({ targets: this.root, alpha: 1, y: 0, duration: FADE_MS, ease: 'Cubic.Out' });
  }

  // ---------------------------------------------------------------------------

  private buildMain(): void {
    const w = 104;
    const options = mainOptions();
    const h = options.length * ROW + 24;
    const x = BASE_WIDTH - w - 8;
    // Bajo el HUD si cabe; con la opción extra del modo admin sube para no tapar la ayuda de abajo.
    const y = Math.min(22, BASE_HEIGHT - h - 14);
    this.panel(x, y, w, h);
    this.add(makeText(this.scene, x + 10, y + 7, 'PAUSA', { fontFamily: FONT_HUD, fontSize: '8px', color: THEME.accentCss }));
    this.options(options, x + 18, y + 20);
    // El aviso (ej. por qué no se puede guardar) va en la línea de ayuda de abajo.
    this.hint(this.note || `W/S: mover · E: elegir · Esc: cerrar${canFullscreen() && !TouchControls.enabled ? ' · P: pantalla' : ''}`);
  }

  private buildSlots(): void {
    const { x, y, w } = BIG;
    const h = 30 + SLOT_COUNT * SLOT_ROW;
    this.panel(x, y, w, h);
    const left = x + 22;
    const right = x + w - 12;
    const title = this.slotMode === 'save' ? 'GUARDAR PARTIDA' : 'CARGAR PARTIDA';
    this.add(makeText(this.scene, x + 12, y + 9, title, { fontFamily: FONT_HUD, fontSize: '8px', color: THEME.accentCss }));
    this.optionTexts = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const ry = y + 24 + i * SLOT_ROW;
      if (i > 0) {
        const line = this.scene.add.graphics();
        line.fillStyle(0x2a2433, 0.12).fillRect(x + 10, ry - 4, w - 20, 1);
        this.add(line);
      }
      const label = makeText(this.scene, left, ry, `Espacio ${i + 1}`, { fontSize: '9px', color: THEME.ink });
      this.add(label);
      this.optionTexts.push(label);
      const s = SaveSlots.summary(i);
      if (!s) {
        this.add(makeText(this.scene, left, ry + 12, '— vacío —', { color: THEME.inkMuted }));
        continue;
      }
      this.add(makeText(this.scene, right, ry, s.savedAt, { fontSize: '9px', color: THEME.inkMuted }).setOrigin(1, 0));
      const mission = makeText(this.scene, left, ry + 11, '', { fontStyle: '600', color: THEME.ink });
      fitText(mission, s.mission, right - left);
      this.add(mission);
      const detail = makeText(this.scene, left, ry + 23, '', { fontSize: '9px', color: THEME.inkMuted });
      fitText(detail, [s.place, s.clock, `jugado ${s.playTime}`].filter(Boolean).join(' · '), right - left);
      this.add(detail);
    }
    this.cursor = this.scene.add.graphics();
    drawTriangle(this.cursor, 'right', THEME.accent, 3);
    this.add(this.cursor);
    this.select(this.selected);
    const verb = this.slotMode === 'save' ? 'guardar' : 'cargar';
    this.hint(this.note || `W/S: espacio · E: ${verb} · Esc: volver`);
    this.note = '';
  }

  private buildMission(): void {
    const s = missionSummary();
    const { x, y, w } = BIG;
    this.panel(x, y, w, BIG.h);
    const left = x + 12;
    const right = x + w - 12;
    this.add(makeText(this.scene, left, y + 9, 'MISIÓN ACTUAL', { fontFamily: FONT_HUD, fontSize: '8px', color: THEME.accentCss }));
    this.add(makeText(this.scene, left, y + 20, s.title, { fontSize: '12px', fontStyle: '600', color: THEME.ink }));
    this.add(makeText(this.scene, left, y + 40, 'Objetivo', { fontSize: '9px', color: THEME.inkMuted }));
    this.add(
      makeText(this.scene, left, y + 51, StoryState.objective || '—', {
        color: THEME.ink,
        wordWrap: { width: w - 24, useAdvancedWrap: true },
      }),
    );
    const rows: Array<[string, string]> = [
      ['Tiempo', s.time],
      ['Ruta hasta ahora', s.route],
    ];
    rows.forEach(([label, value], i) => {
      const ry = y + 78 + i * 13;
      this.add(makeText(this.scene, left, ry, label, { color: THEME.inkMuted }));
      this.add(makeText(this.scene, right, ry, value, { color: THEME.ink, fontStyle: '600' }).setOrigin(1, 0));
    });
    const found = s.collectibles.filter((c) => c.found).length;
    this.add(makeText(this.scene, left, y + 106, `Coleccionables ${found}/${s.collectibles.length}`, { color: THEME.inkMuted }));
    s.collectibles.forEach((c, i) => {
      const icon = this.scene.add.image(left + 8 + i * 22, y + 132, objKey(c.icon));
      if (!c.found) icon.setTint(0x2a2433).setAlpha(0.2);
      this.add(icon);
    });
    this.hint('E / Esc: volver');
  }

  private buildConfirm(): void {
    const w = 216;
    const h = 72;
    const x = (BASE_WIDTH - w) / 2;
    const y = 52;
    this.panel(x, y, w, h);
    this.add(
      makeText(this.scene, x + 12, y + 9, this.confirmData?.question ?? '', {
        color: THEME.ink,
        wordWrap: { width: w - 24, useAdvancedWrap: true },
      }),
    );
    this.options(CONFIRM_OPTIONS, x + 22, y + 38);
  }

  // ---------------------------------------------------------------------------

  private panel(x: number, y: number, w: number, h: number): void {
    const g = this.scene.add.graphics();
    drawPanel(g, x, y, w, h, { radius: 7 });
    this.add(g);
  }

  private options(labels: string[], x: number, y: number): void {
    this.optionTexts = labels.map((label, i) => {
      const t = makeText(this.scene, x, y + i * ROW, label, { color: THEME.ink });
      this.add(t);
      return t;
    });
    this.cursor = this.scene.add.graphics();
    drawTriangle(this.cursor, 'right', THEME.accent, 3);
    this.add(this.cursor);
    this.select(this.selected);
  }

  private select(i: number): void {
    this.selected = i;
    this.optionTexts.forEach((t, idx) => t.setColor(idx === i ? THEME.accentCss : THEME.ink));
    const t = this.optionTexts[i];
    if (t && this.cursor) this.cursor.setPosition(t.x - 8, t.y + t.height / 2);
  }

  private hint(text: string): void {
    this.add(
      makeText(this.scene, BASE_WIDTH / 2, BASE_HEIGHT - 3, text, { fontFamily: FONT_HUD, fontSize: '8px', color: '#c8d0e8' }).setOrigin(
        0.5,
        1,
      ),
    );
  }

  private add(obj: Phaser.GameObjects.GameObject): void {
    this.root.add(obj);
  }

  private wrap(i: number, n: number): number {
    return (i + n) % n;
  }

  private quitToTitle(): void {
    const map = this.map;
    if (!map) return;
    this.leaving = true;
    StoryState.save();
    this.scene.tweens.killTweensOf(this.overlay);
    this.overlay.setFillStyle(0x000000, 1).setVisible(true);
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 1,
      duration: 250,
      onComplete: () => {
        this.scene.scene.stop(map.scene.key);
        this.scene.scene.start('Title');
      },
    });
  }
}
