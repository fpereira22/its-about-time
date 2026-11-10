import Phaser from 'phaser';
import { playMusic } from '../audio/sfx';
import { vehicleKey } from '../art/SpriteRegistry';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD, TILE } from '../config/display';
import { Controls } from '../systems/Controls';
import { GameMap } from '../systems/GameMap';
import { GAME_TITLE } from '../config/game';
import { Admin } from '../systems/Admin';
import { Content } from '../systems/Content';
import { currentMission, missionFullLabel, missionLabel, MISSIONS, parseClock } from '../systems/Mission';
import type { MissionDef } from '../types/mission';
import { Records } from '../systems/Records';
import { RIDES } from '../systems/RideController';
import { SaveSlots, SLOT_COUNT } from '../systems/SaveSlots';
import { Secrets } from '../systems/Secrets';
import { StoryState } from '../systems/StoryState';
import { drawPanel, makeText, THEME } from '../ui/theme';
import { BaseScene } from './BaseScene';
import { MenuList } from '../ui/MenuList';
import { SettingsPanel } from '../ui/SettingsPanel';

/** Mapa que se ve de fondo en el título, y desde qué fila. */
const BACKDROP_MAP = 'providencia';
const BACKDROP_TOP_ROW = 8;
/** Fila de la pista por donde pasa la micro del fondo. */
const BUS_LANE = 17;
const PAN_SPEED = 14;
const MENU_Y = 98;

const SCENE_FOR_KIND = { overworld: 'Overworld', interior: 'Interior' } as const;

/** Borde superior de un submenú de `rows` opciones: bajo el logo si cabe, si no, subido para no tapar el pie. */
function submenuY(rows: number): number {
  return Math.min(MENU_Y - 6, BASE_HEIGHT - 15 - (rows * 13 + 9));
}

/** Deja la partida como al comienzo de la misión `m`, sin cambiar de escena. */
export function resetForMission(m: MissionDef): void {
  StoryState.newGame(m.id, {
    money: m.startMoney,
    flags: m.startFlags,
    clock: m.clock ? parseClock(m.clock, 0) : undefined,
    weather: m.weather,
  });
  Secrets.syncNewGame();
  StoryState.setObjective(m.objective);
}

/** Partida nueva desde el comienzo de la misión `m` (título o "Siguiente misión"). */
export function startMission(scene: Phaser.Scene, m: MissionDef): void {
  resetForMission(m);
  const key = SCENE_FOR_KIND[GameMap.get(m.start.map).data.kind];
  scene.scene.start(key, { mapId: m.start.map, spawn: m.start.spawn, intro: m.introDialogue });
}

export class TitleScene extends BaseScene {
  private menu: MenuList | null = null;
  /** Submenú abierto (elegir misión o confirmar): Esc lo cierra y vuelve al menú principal. */
  private confirm: { menu: MenuList; box: Phaser.GameObjects.Container | null } | null = null;
  private backdrop!: Phaser.Tilemaps.TilemapLayer;
  private panX = 0;
  private panMax = 0;
  private leaving = false;
  private canContinue = false;
  private settings: SettingsPanel | null = null;

  constructor() {
    super('Title');
    this.fixedCamera = true;
  }

  create(): void {
    this.leaving = false;
    this.menu = null;
    this.confirm = null;
    this.settings = null;
    if (this.scene.isActive('UI')) this.scene.stop('UI');
    this.cameras.main.setBackgroundColor('#1c2a48');

    this.createBackdrop();
    this.createLogo();

    this.canContinue = this.checkContinue();
    this.buildMenu();

    const footer = this.add.graphics().setDepth(5);
    footer.fillStyle(0x0d1424, 0.75).fillRect(0, BASE_HEIGHT - 13, BASE_WIDTH, 13);
    this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 6.5, 'WASD/Flechas: mover  ·  E: interactuar  ·  Esc: menú', {
      fontSize: '8px',
      color: '#c8d0e0',
    })
      .setOrigin(0.5)
      .setDepth(6);

    if (Admin.active) {
      // Tocarla abre el selector de etapas (en el celular no hay F2).
      this.addText(BASE_WIDTH - 4, 4, 'ADMIN · F2: ETAPAS · F3: TÁCTIL', { fontFamily: FONT_HUD, fontSize: '8px', color: '#ff8a5c' })
        .setOrigin(1, 0)
        .setDepth(10)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => !this.leaving && Admin.toggleWarp(this.game));
    }

    this.setupZoom();
    this.cameras.main.fadeIn(350, 0, 0, 0);
    playMusic('title');
  }

  override update(_time: number, delta: number): void {
    this.panX += (PAN_SPEED * delta) / 1000;
    if (this.panX > this.panMax) this.panX = 0;
    this.backdrop.x = -Math.round(this.panX);

    if (this.leaving) return;
    if (this.settings) {
      this.settings.update();
      return;
    }
    if (this.confirm) {
      if (Controls.consume('menu')) this.closeConfirm();
      else this.confirm.menu.update();
      return;
    }
    this.menu?.update();
  }

  /** Revisa (cargando la partida) si hay algo que continuar. */
  private checkContinue(): boolean {
    if (!StoryState.hasSave() || !StoryState.load()) return false;
    return StoryState.location !== null && !StoryState.hasFlag(`${currentMission().id}_completa`);
  }

  private buildMenu(): void {
    const items = [
      ...(this.canContinue ? [{ label: `Continuar (${missionLabel(currentMission())})`, action: () => this.continueGame() }] : []),
      { label: 'Nueva partida', action: () => this.chooseMission() },
      ...(SaveSlots.any ? [{ label: 'Cargar partida', action: () => this.chooseSlot() }] : []),
      { label: 'Progreso', action: () => this.go(() => this.scene.start('Progress')) },
      { label: 'Ajustes', action: () => this.openSettings() },
      { label: 'Créditos', action: () => this.go(() => this.scene.start('Credits')) },
    ];
    // Bajo el logo; con todas las opciones (Continuar y Cargar) sube lo justo para no tapar el pie.
    const y = Math.min(MENU_Y, BASE_HEIGHT - 15 - (items.length * 13 + 9));
    this.menu = new MenuList(this, items, { x: BASE_WIDTH / 2, y, minWidth: 108 });
  }

  private openSettings(): void {
    this.hideMainMenu();
    this.settings = new SettingsPanel(this, {
      depth: 31,
      onClose: () => {
        this.settings = null;
        if (this.menu) {
          this.menu.enabled = true;
          this.menu.container.setVisible(true);
        }
      },
    });
  }

  /** Submenú: qué misión empezar. Se desbloquean en orden (todas en modo admin). */
  private chooseMission(): void {
    this.hideMainMenu();
    const menu = new MenuList(
      this,
      [
        ...MISSIONS.map((m) =>
          Records.isUnlocked(m)
            ? { label: missionFullLabel(m), action: () => this.requestNewGame(m) }
            : { label: `${missionLabel(m)}: ???  (bloqueada)`, action: () => undefined, disabled: true },
        ),
        { label: 'Volver', action: () => this.closeConfirm() },
      ],
      { x: BASE_WIDTH / 2, y: submenuY(MISSIONS.length + 1), depth: 31 },
    );
    this.confirm = { menu, box: null };
  }

  /** Submenú: qué espacio de guardado cargar. */
  private chooseSlot(): void {
    this.hideMainMenu();
    const items = Array.from({ length: SLOT_COUNT }, (_, i) => {
      const s = SaveSlots.summary(i);
      return s
        ? { label: `${i + 1}. ${s.mission.split(':')[0]} · ${s.place} · ${s.playTime}`, action: () => this.requestLoad(i) }
        : { label: `${i + 1}. — vacío —`, action: () => undefined, disabled: true };
    });
    const menu = new MenuList(this, [...items, { label: 'Volver', action: () => this.closeConfirm() }], {
      x: BASE_WIDTH / 2,
      y: submenuY(SLOT_COUNT + 1),
      depth: 31,
    });
    this.confirm = { menu, box: null };
  }

  private requestLoad(i: number): void {
    if (!this.canContinue) return this.loadSlot(i);
    this.ask('¿Cargar? Reemplaza la partida de Continuar.', 'Sí, cargar', () => this.loadSlot(i));
  }

  private loadSlot(i: number): void {
    this.go(() => {
      const target = SaveSlots.load(i);
      if (target) this.scene.start(target.scene, target.data);
      else this.scene.restart();
    });
  }

  private hideMainMenu(): void {
    if (this.menu) {
      this.menu.enabled = false;
      this.menu.container.setVisible(false);
    }
  }

  private requestNewGame(mission: MissionDef): void {
    if (!this.canContinue) {
      this.startNewGame(mission);
      return;
    }
    this.ask('¿Empezar? Se borra la partida de Continuar.', 'Sí, empezar', () => this.startNewGame(mission));
  }

  /** Pregunta de confirmación (No / `yesLabel`) en lugar del menú. */
  private ask(question: string, yesLabel: string, yes: () => void): void {
    this.closeConfirm();
    this.hideMainMenu();
    const w = 220;
    const h = 30;
    const x = (BASE_WIDTH - w) / 2;
    const y = MENU_Y - 4;
    const bg = this.add.graphics();
    drawPanel(bg, 0, 0, w, h, { radius: 6 });
    const q = makeText(this, w / 2, 7, question, { color: THEME.ink, fontSize: '9px' }).setOrigin(0.5, 0);
    const box = this.add.container(x, y, [bg, q]).setDepth(30);
    const menu = new MenuList(
      this,
      [
        { label: 'No', action: () => this.closeConfirm() },
        { label: yesLabel, action: yes },
      ],
      { x: BASE_WIDTH / 2, y: y + h + 3, horizontal: true, depth: 31 },
    );
    this.confirm = { menu, box };
  }

  private closeConfirm(): void {
    if (!this.confirm) return;
    this.confirm.menu.destroy();
    this.confirm.box?.destroy();
    this.confirm = null;
    if (this.menu) {
      this.menu.enabled = true;
      this.menu.container.setVisible(true);
    }
  }

  private startNewGame(m: MissionDef): void {
    this.go(() => startMission(this, m));
  }

  private continueGame(): void {
    const target = resolveContinueTarget();
    Secrets.syncNewGame();
    this.go(() => this.scene.start(target.scene, { mapId: target.map, spawn: target.spawn }));
  }

  /**
   * Funde a negro y ejecuta `action`. Antes espera el contenido de la historia (diálogos y viñetas,
   * ver Content): normalmente ya llegó mientras se veía el título; si no, avisa que está cargando.
   */
  private go(action: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    const status = Content.ready
      ? null
      : this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 20, 'Cargando la historia...', { fontSize: '9px', color: '#f0d048' })
          .setOrigin(0.5)
          .setDepth(40);
    Content.load().then(
      () => {
        status?.destroy();
        this.cameras.main.fadeOut(280, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', action);
      },
      () => {
        status?.setText('No se pudo cargar. Revisa tu conexión y vuelve a intentar.').setColor('#ff8a5c');
        this.time.delayedCall(2500, () => status?.destroy());
        this.leaving = false;
      },
    );
  }

  private createBackdrop(): void {
    const map = GameMap.get(BACKDROP_MAP);
    this.backdrop = map.createLayer(this).setPosition(0, -BACKDROP_TOP_ROW * TILE).setDepth(0);
    // Con la cámara fija (origen 0,0 + zoom) Phaser calcula mal qué tiles están a la vista.
    this.backdrop.skipCull = true;
    this.panMax = map.width * TILE - BASE_WIDTH;
    this.panX = 0;

    const busY = (BUS_LANE + 1 - BACKDROP_TOP_ROW) * TILE;
    const bus = this.add.image(-60, busY, vehicleKey('micro')).setOrigin(0.5, 1).setDepth(1);
    this.tweens.add({
      targets: bus,
      x: BASE_WIDTH + 60,
      duration: 6500,
      delay: 900,
      repeat: -1,
      repeatDelay: 2500,
      onUpdate: () => bus.setX(Math.round(bus.x)),
    });

    // Velo oscuro con degradado arriba para que el logo se lea sobre el mapa.
    const veil = this.add.graphics().setDepth(2);
    veil.fillStyle(0x0d1424, 0.3).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    for (let i = 0; i < 10; i++) {
      veil.fillStyle(0x0d1424, 0.55 * (1 - i / 10)).fillRect(0, i * 8, BASE_WIDTH, 8);
    }
  }

  private createLogo(): void {
    const cx = BASE_WIDTH / 2;
    const title = this.addText(cx, 30, GAME_TITLE, {
      fontSize: '24px',
      fontStyle: '600',
      color: '#ffffff',
    })
      .setOrigin(0.5)
      .setShadow(0, 2, '#0a0e18', 0, false, true)
      .setDepth(10);
    // Secreto: tocarlo 7 veces seguidas activa o desactiva el modo admin (para el celular, sin teclado).
    title.setInteractive().on('pointerdown', () => !this.leaving && Admin.tapLogo(this.game));
    const plate = this.add.graphics().setDepth(9);
    const pw = Math.ceil(title.width) + 28;
    plate.fillStyle(THEME.accent, 1).fillRect(cx - pw / 2 + 14, 45, pw - 28, 2);
    this.addText(cx, 56, 'Micro, metro, tren... y a pie', {
      fontSize: '10px',
      color: '#d8e0f0',
    })
      .setOrigin(0.5)
      .setDepth(10);
    this.addText(cx, 72, 'UNA AVENTURA EN SANTIAGO', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f0d048' })
      .setOrigin(0.5)
      .setDepth(10);
    this.tweens.add({ targets: title, y: 28, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }
}

/**
 * Dónde retomar una partida. Si quedó a mitad de un viaje (vagón, micro) o el mapa/spawn
 * guardado ya no existe, vuelve al inicio de la misión.
 */
function resolveContinueTarget(): { scene: string; map: string; spawn: string } {
  const start = currentMission().start;
  const fallback = { scene: SCENE_FOR_KIND[GameMap.get(start.map).data.kind], map: start.map, spawn: start.spawn };
  const loc = StoryState.location;
  if (!loc) return fallback;
  const rideMaps = new Set(Object.values(RIDES).map((r) => r.map));
  if (rideMaps.has(loc.map)) return fallback;
  try {
    const map = GameMap.get(loc.map);
    map.spawn(loc.spawn);
    return { scene: SCENE_FOR_KIND[map.data.kind], map: loc.map, spawn: loc.spawn };
  } catch {
    return fallback;
  }
}
