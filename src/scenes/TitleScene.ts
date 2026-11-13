import Phaser from 'phaser';
import { playMusic } from '../audio/sfx';
import { vehicleKey } from '../art/SpriteRegistry';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD, TILE } from '../config/display';
import { Controls } from '../systems/Controls';
import { GameMap } from '../systems/GameMap';
import { GAME_TITLE } from '../config/game';
import { Admin } from '../systems/Admin';
import { Content } from '../systems/Content';
import { canFullscreen, isFullscreen, toggleFullscreen } from '../systems/Fullscreen';
import { TouchControls } from '../systems/TouchControls';
import { currentMission, missionFullLabel, missionLabel, MISSIONS, parseClock } from '../systems/Mission';
import type { MissionDef } from '../types/mission';
import { Ranking } from '../systems/Ranking';
import { Records } from '../systems/Records';
import { RIDES } from '../systems/RideController';
import { SaveSlots, SLOT_COUNT } from '../systems/SaveSlots';
import { Secrets } from '../systems/Secrets';
import { StoryState } from '../systems/StoryState';
import { drawPanel, makeText, THEME } from '../ui/theme';
import { BaseScene } from './BaseScene';
import { MenuList } from '../ui/MenuList';
import { SettingsPanel } from '../ui/SettingsPanel';
import { TitleReviews } from '../ui/TitleReviews';
import { autoPromptsAllowed, openNameForm } from '../ui/VoteForm';

/** Mapa que se ve de fondo en el título, y desde qué fila. */
const BACKDROP_MAP = 'providencia';
const BACKDROP_TOP_ROW = 8;
/** Fila de la pista por donde pasa la micro del fondo. */
const BUS_LANE = 17;
const PAN_SPEED = 14;
const MENU_Y = 98;
/** Lo más arriba que puede empezar el menú sin tapar el logo (ahí empiezan también las reseñas). */
const MENU_MIN_Y = 78;
const MENU_ROW = 13;

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
  /** Reseñas que aparecen y desaparecen a los lados del menú. */
  private reviews: TitleReviews | null = null;
  /** Formulario HTML abierto encima (el saludo): cierra lo que haya. */
  private closeForm: (() => void) | null = null;

  constructor() {
    super('Title');
    this.fixedCamera = true;
  }

  create(): void {
    this.leaving = false;
    this.menu = null;
    this.confirm = null;
    this.settings = null;
    this.reviews = null;
    this.closeForm = null;
    if (this.scene.isActive('UI')) this.scene.stop('UI');
    this.cameras.main.setBackgroundColor('#1c2a48');

    this.createBackdrop();
    this.createLogo();

    this.canContinue = this.checkContinue();
    this.buildMenu();
    this.buildReviews();
    this.greetFirstTime();

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

    this.setupFullscreenHint();
    this.setupZoom();
    this.cameras.main.fadeIn(350, 0, 0, 0);
    playMusic('title');
  }

  override update(_time: number, delta: number): void {
    this.panX += (PAN_SPEED * delta) / 1000;
    if (this.panX > this.panMax) this.panX = 0;
    this.backdrop.x = -Math.round(this.panX);

    if (this.leaving || this.closeForm) return;
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

  /**
   * Aviso "P: pantalla completa" para el PC (la tecla es global, ver Fullscreen.ts). Con controles
   * táctiles no sale: ahí está el botón "pantalla" del panel.
   */
  private setupFullscreenHint(): void {
    if (!canFullscreen() || TouchControls.enabled) return;
    const label = (): string => (isFullscreen() ? 'P: SALIR DE PANTALLA COMPLETA' : 'P: PANTALLA COMPLETA');
    const hint = this.addText(4, 4, label(), { fontFamily: FONT_HUD, fontSize: '8px', color: '#c8d0e0' })
      .setDepth(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => toggleFullscreen());
    const onChange = (): void => void hint.setText(label());
    document.addEventListener('fullscreenchange', onChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => document.removeEventListener('fullscreenchange', onChange));
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
      { label: 'Top 10', badge: '★', action: () => this.openRanking(0) },
      { label: 'Ajustes', action: () => this.openSettings() },
      { label: 'Créditos', action: () => this.go(() => this.scene.start('Credits')) },
    ];
    // Bajo el logo; con muchas opciones sube lo justo para no tapar el pie, y si ni así cabe sin
    // tapar el logo, junta las filas.
    const rowHeight = Math.min(MENU_ROW, Math.floor((BASE_HEIGHT - 15 - 9 - MENU_MIN_Y) / items.length));
    const y = Math.min(MENU_Y, BASE_HEIGHT - 15 - (items.length * rowHeight + 9));
    this.menu = new MenuList(this, items, { x: BASE_WIDTH / 2, y, minWidth: 108, rowHeight });
  }

  /** Reseñas a los lados del menú: lo guardado al tiro y la planilla cuando llegue. */
  private buildReviews(): void {
    if (!this.menu) return;
    const reviews = new TitleReviews(this, { x: this.menu.container.x, width: this.menu.width }, () => {
      if (!this.leaving && !this.confirm && !this.settings && !this.closeForm) this.openRanking(1);
    });
    this.reviews = reviews;
    const cached = Ranking.cached;
    reviews.show(cached.fetchedAt > 0 || cached.comments.length > 0 ? cached : null);
    // De paso publica el puntaje si subió (secretos encontrados a mitad de misión, por ejemplo).
    Ranking.syncScore();
    void Ranking.load().then((s) => {
      if (this.sys.isActive() && this.reviews === reviews) reviews.show(s);
    });
  }

  /** La primera vez que se abre el juego, un saludo que pide el nombre (para votar más adelante). */
  private greetFirstTime(): void {
    if (!Ranking.needsName || !autoPromptsAllowed()) return;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.closeForm?.());
    this.time.delayedCall(900, () => {
      if (this.leaving || this.confirm || this.settings || !Ranking.needsName) return;
      this.closeForm = openNameForm(() => {
        this.closeForm = null;
      });
    });
  }

  private openRanking(page: number): void {
    this.go(() => this.scene.start('Ranking', { page }), false);
  }

  private openSettings(): void {
    this.hideMainMenu();
    this.settings = new SettingsPanel(this, {
      depth: 31,
      onClose: () => {
        this.settings = null;
        this.showMainMenu();
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
    this.reviews?.setVisible(false);
  }

  private showMainMenu(): void {
    if (this.menu) {
      this.menu.enabled = true;
      this.menu.container.setVisible(true);
    }
    this.reviews?.setVisible(true);
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
    this.showMainMenu();
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
   * Con `needsContent` false (pantallas que no usan la historia) no espera nada.
   */
  private go(action: () => void, needsContent = true): void {
    if (this.leaving) return;
    this.leaving = true;
    if (!needsContent) {
      this.cameras.main.fadeOut(280, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', action);
      return;
    }
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
    this.addText(cx, 56, 'Entre micros, metro, taxi, tren, aviones... y a pie', {
      fontSize: '10px',
      color: '#d8e0f0',
    })
      .setOrigin(0.5)
      .setDepth(10);
    this.addText(cx, 72, 'UNA AVENTURA POR SUDAMÉRICA', { fontFamily: FONT_HUD, fontSize: '8px', color: '#f0d048' })
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
