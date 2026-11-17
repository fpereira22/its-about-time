import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { Controls } from '../systems/Controls';
import { GameMap } from '../systems/GameMap';
import { GAME_TITLE } from '../config/game';
import { Admin } from '../systems/Admin';
import { Content } from '../systems/Content';
import { canFullscreen, isFullscreen, toggleFullscreen } from '../systems/Fullscreen';
import { TouchControls } from '../systems/TouchControls';
import { clockMinutes, currentMission, missionFullLabel, missionLabel, MISSIONS, parseClock } from '../systems/Mission';
import type { MissionDef } from '../types/mission';
import { Ranking } from '../systems/Ranking';
import { Records } from '../systems/Records';
import { RIDES } from '../systems/RideController';
import { SaveSlots, SLOT_COUNT } from '../systems/SaveSlots';
import { Secrets } from '../systems/Secrets';
import { StoryState } from '../systems/StoryState';
import { drawPanel, makeText, THEME } from '../ui/theme';
import { BaseScene } from './BaseScene';
import { MenuList, type MenuItem } from '../ui/MenuList';
import { SettingsPanel } from '../ui/SettingsPanel';
import { TitleBackdrop } from '../ui/TitleBackdrop';
import { TitleReviews } from '../ui/TitleReviews';
import { autoPromptsAllowed, openCodeForm, openNameForm } from '../ui/VoteForm';

const CONTROLS_HINT = 'WASD/Flechas: mover  ·  E: interactuar  ·  Esc: menú';
/** Cuánto se ve el nombre del lugar en el pie antes de volver a los controles (ms). */
const PLACE_HINT_MS = 4500;
const MENU_Y = 98;
/** Lo más arriba que puede empezar el menú sin tapar el logo (ahí empiezan también las reseñas). */
const MENU_MIN_Y = 78;
const MENU_ROW = 13;
/** Misiones por página en el submenú de "Nueva partida". */
const MISSIONS_PER_PAGE = 5;
/** Alto de fila del submenú de misiones (un poco más junto, para que no tape el logo). */
const PAGER_ROW = 12;
/** Espacio bajo el panel para los puntitos de página. */
const PAGER_DOTS_H = 6;
/** Cuánto se corre la página al cambiar (px). */
const PAGE_SLIDE = 48;

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
  /** El submenú de misiones por páginas, mientras está abierto. */
  private missionPager: {
    page: number;
    pages: number;
    make: (page: number) => MenuList;
    prev: Phaser.GameObjects.Graphics;
    next: Phaser.GameObjects.Graphics;
    dots: Phaser.GameObjects.Graphics;
  } | null = null;
  private backdrop: TitleBackdrop | null = null;
  /** Texto del pie: los controles, o el nombre del lugar del fondo cuando cambia. */
  private footerText: Phaser.GameObjects.Text | null = null;
  private footerTimer: Phaser.Time.TimerEvent | null = null;
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
    this.backdrop = null;
    this.confirm = null;
    this.settings = null;
    this.reviews = null;
    this.closeForm = null;
    if (this.scene.isActive('UI')) this.scene.stop('UI');
    this.cameras.main.setBackgroundColor('#1c2a48');
    this.footerText = null;
    this.footerTimer = null;

    this.canContinue = this.checkContinue();
    this.createBackdrop();
    this.createLogo();

    this.buildMenu();
    this.buildReviews();
    this.greetFirstTime();

    const footer = this.add.graphics().setDepth(5);
    footer.fillStyle(0x0d1424, 0.75).fillRect(0, BASE_HEIGHT - 13, BASE_WIDTH, 13);
    this.footerText = this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 6.5, CONTROLS_HINT, {
      fontSize: '8px',
      color: '#c8d0e0',
    })
      .setOrigin(0.5)
      .setDepth(6);
    // (createBackdrop ya lo armó; TS no lo ve porque arriba quedó en null.)
    const backdrop = this.backdrop as TitleBackdrop | null;
    if (backdrop) this.showPlace(backdrop.current.place, backdrop.minutes);

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
    this.backdrop?.update(delta);

    if (this.leaving || this.closeForm) return;
    if (this.settings) {
      this.settings.update();
      return;
    }
    if (this.confirm) {
      if (Controls.consume('menu')) this.closeConfirm();
      else if (this.missionPager && Controls.consume('left')) this.flipMissionPage(-1);
      else if (this.missionPager && Controls.consume('right')) this.flipMissionPage(1);
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
      // En un dispositivo sin partidas (recién llegado) lo primero que puede buscar es traer su
      // progreso de otro lado. Con partidas el código sigue en Ajustes (el menú no tiene más espacio).
      ...(!this.canContinue && !SaveSlots.any ? [{ label: 'Tengo un código', action: () => this.openPlayerCode() }] : []),
      { label: 'Progreso', action: () => this.go(() => this.scene.start('Progress')) },
      { label: 'Estadísticas', action: () => this.go(() => this.scene.start('Stats')) },
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

  /** Código de jugador: ver el de acá o traer el progreso de otro dispositivo. */
  private openPlayerCode(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.closeForm?.());
    this.closeForm = openCodeForm(() => {
      this.closeForm = null;
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

  /**
   * Submenú: qué misión empezar, de a 5 por página; A/D (o las flechas de los lados) corre a la página
   * siguiente o anterior. Se desbloquean en orden (todas en modo admin).
   */
  private chooseMission(): void {
    this.hideMainMenu();
    const pages = Math.ceil(MISSIONS.length / MISSIONS_PER_PAGE);
    const items = (p: number): MenuItem[] => [
      ...MISSIONS.slice(p * MISSIONS_PER_PAGE, (p + 1) * MISSIONS_PER_PAGE).map((m) =>
        Records.isUnlocked(m)
          ? { label: missionFullLabel(m), action: () => this.requestNewGame(m) }
          : { label: `${missionLabel(m)}: ???  (bloqueada)`, action: () => undefined, disabled: true },
      ),
      { label: 'Volver', action: () => this.closeConfirm() },
    ];
    // Todas las páginas del mismo ancho y a la misma altura, para que al correrlas no salte el panel.
    const minWidth = Math.max(
      ...Array.from({ length: pages }, (_, p) => {
        const probe = new MenuList(this, items(p), { x: 0, y: 0, rowHeight: PAGER_ROW });
        probe.destroy();
        return probe.width;
      }),
    );
    const fullHeight = (MISSIONS_PER_PAGE + 1) * PAGER_ROW + 9;
    const y = Math.min(MENU_Y - 6, BASE_HEIGHT - 15 - (fullHeight + PAGER_DOTS_H));
    const make = (p: number): MenuList =>
      new MenuList(this, items(p), { x: BASE_WIDTH / 2, y, depth: 31, minWidth, rowHeight: PAGER_ROW });

    // Abre en la página de la última misión desbloqueada: la que toca jugar.
    const last = MISSIONS.reduce((acc, m, i) => (Records.isUnlocked(m) ? i : acc), 0);
    const page = Math.floor(last / MISSIONS_PER_PAGE);

    // Flechas a los lados del panel (también se tocan) y puntitos de página abajo.
    const box = this.add.container(BASE_WIDTH / 2, y).setDepth(31);
    const arrow = (dir: -1 | 1): Phaser.GameObjects.Graphics => {
      const g = this.add.graphics({ x: dir * (minWidth / 2 + 11), y: fullHeight / 2 });
      drawPanel(g, -7, -7, 14, 14, { radius: 4 });
      g.fillStyle(THEME.accent, 1).fillTriangle(-dir * 2, -4, -dir * 2, 4, dir * 3, 0);
      g.setInteractive(new Phaser.Geom.Rectangle(-9, -9, 18, 18), Phaser.Geom.Rectangle.Contains);
      g.on('pointerdown', () => this.flipMissionPage(dir));
      box.add(g);
      return g;
    };
    const prev = arrow(-1);
    const next = arrow(1);
    const dots = this.add.graphics({ y: fullHeight + 3 });
    box.add(dots);
    box.setVisible(pages > 1);

    this.missionPager = { page, pages, make, prev, next, dots };
    this.confirm = { menu: make(page), box };
    this.refreshMissionPager();
  }

  /** Corre el submenú de misiones a la página de al lado (`dir` = -1 izquierda, 1 derecha). */
  private flipMissionPage(dir: -1 | 1): void {
    const pager = this.missionPager;
    const confirm = this.confirm;
    if (!pager || !confirm) return;
    const to = pager.page + dir;
    if (to < 0 || to >= pager.pages) {
      playSfx('error');
      return;
    }
    playSfx('cursor');
    const old = confirm.menu;
    old.enabled = false;
    const menu = pager.make(to);
    const x = menu.container.x;
    menu.container.setX(x + dir * PAGE_SLIDE).setAlpha(0);
    this.tweens.add({ targets: menu.container, x, alpha: 1, duration: 200, ease: 'Cubic.Out' });
    this.tweens.add({
      targets: old.container,
      x: old.container.x - dir * PAGE_SLIDE,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.Out',
      onComplete: () => old.destroy(),
    });
    confirm.menu = menu;
    pager.page = to;
    this.refreshMissionPager();
  }

  /** Flechas apagadas en los bordes y el puntito de la página actual. */
  private refreshMissionPager(): void {
    const pager = this.missionPager;
    if (!pager) return;
    pager.prev.setAlpha(pager.page > 0 ? 1 : 0.3);
    pager.next.setAlpha(pager.page < pager.pages - 1 ? 1 : 0.3);
    const gap = 8;
    const x0 = -((pager.pages - 1) * gap) / 2;
    pager.dots.clear();
    for (let i = 0; i < pager.pages; i++) {
      pager.dots.fillStyle(i === pager.page ? THEME.accent : 0xc8d0e0, i === pager.page ? 1 : 0.7);
      pager.dots.fillCircle(x0 + i * gap, 0, i === pager.page ? 2.5 : 1.8);
    }
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
    this.missionPager = null;
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

  /**
   * Fondo que va cambiando de lugar (ver TitleBackdrop): parte donde quedó la partida, a su hora,
   * y mientras más se espera, más avanza el día y más probable es que llueva.
   */
  private createBackdrop(): void {
    const saved = StoryState.hasSave();
    const now = new Date();
    this.backdrop = new TitleBackdrop(this, {
      startMinutes: saved ? clockMinutes() : now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes(),
      missionId: currentMission().id,
      savedMap: this.canContinue ? StoryState.location?.map : undefined,
      savedWeather: saved ? StoryState.weather : undefined,
      onPlace: (def, minutes) => this.showPlace(def.place, minutes),
    });

    // Velo oscuro con degradado arriba para que el logo se lea sobre el mapa.
    const veil = this.add.graphics().setDepth(2);
    veil.fillStyle(0x0d1424, 0.3).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    for (let i = 0; i < 10; i++) {
      veil.fillStyle(0x0d1424, 0.55 * (1 - i / 10)).fillRect(0, i * 8, BASE_WIDTH, 8);
    }
  }

  /** El pie muestra un rato el lugar del fondo y la hora, y vuelve a los controles. */
  private showPlace(place: string, minutes: number): void {
    const text = this.footerText;
    if (!text) return;
    const m = Math.floor(minutes) % 1440;
    const hhmm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    this.footerTimer?.remove(false);
    this.tweens.killTweensOf(text);
    text.setText(`${place}  ·  ${hhmm}`).setColor('#f0d048').setAlpha(0);
    this.tweens.add({ targets: text, alpha: 1, duration: 400 });
    this.footerTimer = this.time.delayedCall(PLACE_HINT_MS, () => {
      this.tweens.add({
        targets: text,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          text.setText(CONTROLS_HINT).setColor('#c8d0e0');
          this.tweens.add({ targets: text, alpha: 1, duration: 300 });
        },
      });
    });
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
