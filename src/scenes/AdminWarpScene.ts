import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio/sfx';
import type { MusicTrack, SfxName } from '../audio/sfx';
import { TRACKS } from '../audio/music';
import { SFX } from '../audio/sfxDefs';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD } from '../config/display';
import { Admin } from '../systems/Admin';
import { ADMIN_STAGES, type AdminStage } from '../systems/AdminStages';
import { BusRideManager } from '../systems/BusRideManager';
import { Controls } from '../systems/Controls';
import { Content } from '../systems/Content';
import { Dialogue } from '../systems/DialogueManager';
import { GameMap } from '../systems/GameMap';
import { currentMission, formatDayClock, missionFullLabel, MISSIONS, parseClock } from '../systems/Mission';
import { News } from '../systems/News';
import { Phone } from '../systems/Phone';
import { currentOutfit } from '../systems/PlayerLook';
import { SKILLS, type LevelUpInfo } from '../systems/SkillStats';
import { StoryState } from '../systems/StoryState';
import { TouchControls } from '../systems/TouchControls';
import { LevelUpScreen } from '../ui/LevelUpScreen';
import { drawPanel, drawTriangle, fitText, makeText, THEME } from '../ui/theme';
import { Vineta, vinetaIds } from '../ui/Vineta';
import type { MissionDef } from '../types/mission';
import { BaseScene } from './BaseScene';
import { resetForMission, startMission } from './TitleScene';

const PANEL = { x: 10, y: 5, w: BASE_WIDTH - 20, h: 160 };
const LIST_Y = PANEL.y + 24;
const ROW = 11;
const VISIBLE_ROWS = 11;
/** Páginas después de las misiones: todos los mapas y herramientas. */
const pageMaps = (): number => MISSIONS.length;
const pageTools = (): number => MISSIONS.length + 1;
const pageAnims = (): number => MISSIONS.length + 2;
const pageVinetas = (): number => MISSIONS.length + 3;
const pageSounds = (): number => MISSIONS.length + 4;
const pageCamera = (): number => MISSIONS.length + 5;
/** Páginas en total: misiones, mapas, herramientas, animaciones, viñetas, sonidos y cámara. */
const pageCount = (): number => MISSIONS.length + 6;
/** Nivel con que se prueban las pantallas de subida de nivel (2..10). */
let previewLevel = 3;
const SCENE_FOR_KIND = { overworld: 'Overworld', interior: 'Interior' } as const;

/** Una fila de la lista: qué dice, qué se ve abajo al marcarla y qué hace. */
interface Row {
  label: string;
  detail: string;
  go: () => void;
}

/**
 * Selector de pruebas del modo admin (F2 o "Ir a etapa" en la pausa): salta a cualquier etapa de
 * cualquier misión, o a cualquier mapa sin tocar la partida. Las páginas del final son herramientas
 * (controles táctiles, depuración con coordenadas), animaciones (subida de nivel de los minijuegos),
 * la galería de viñetas y un probador de sonidos y música. Pausa lo que esté corriendo, así que
 * se puede abrir en el título, en pleno diálogo o dentro de un minijuego.
 */
export class AdminWarpScene extends BaseScene {
  /** Página elegida: una por misión, luego todos los mapas y herramientas (se recuerda entre aperturas). */
  private page = -1;
  private cursor = 0;
  /** Mapa cuyos puntos de aparición se están listando (página de mapas). */
  private spawnsOf: string | null = null;
  private paused: Phaser.Scene[] = [];
  private content: Phaser.GameObjects.Container | null = null;
  private leaving = false;
  private levelUp!: LevelUpScreen;
  private vineta!: Vineta;

  constructor() {
    super('AdminWarp');
    this.fixedCamera = true;
  }

  create(): void {
    this.leaving = false;
    this.content = null;
    this.spawnsOf = null;
    this.paused = this.game.scene.getScenes(true).filter((s) => s !== this);
    for (const s of this.paused) this.scene.pause(s.scene.key);
    Controls.reset();

    if (this.page < 0 || this.page < MISSIONS.length) {
      const here = MISSIONS.indexOf(currentMission());
      if (here !== this.page) this.cursor = 0;
      this.page = here;
    }

    this.add.rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0x0a0e18, 0.6).setOrigin(0, 0);
    drawPanel(this.add.graphics(), PANEL.x, PANEL.y, PANEL.w, PANEL.h, { radius: 8 });
    // Franja opaca: lo que hay detrás (etiqueta ADMIN, textos del minijuego) no se mezcla con la ayuda.
    this.add.rectangle(0, BASE_HEIGHT - 13, BASE_WIDTH, 13, 0x0a0e18, 1).setOrigin(0, 0);
    this.addText(BASE_WIDTH / 2, BASE_HEIGHT - 3, 'A/D: PÁGINA · W/S: ELEGIR · E: IR · ESC: CERRAR', {
      fontFamily: FONT_HUD,
      fontSize: '8px',
      color: '#c8d0e8',
    }).setOrigin(0.5, 1);

    // Las vistas previas viven en esta escena: así funcionan hasta en el título, sin mapa ni escena UI.
    this.levelUp = new LevelUpScreen(this);
    this.vineta = new Vineta(this, { standalone: true });
    if (!Content.ready) void Content.load().then(() => this.render());

    this.render();
    this.setupZoom();
    playSfx('open');
  }

  override update(_time: number, delta: number): void {
    if (this.leaving) return;
    if (this.levelUp.isOpen) return this.levelUp.update(delta);
    if (this.vineta.isOpen) {
      if (Controls.consume('menu') || Controls.consume('interact')) this.vineta.hide();
      return;
    }
    if (Controls.consume('menu')) return this.back();

    const pages = pageCount();
    const step = Controls.consume('left') ? -1 : Controls.consume('right') ? 1 : 0;
    if (step !== 0 && this.spawnsOf === null) {
      playSfx('cursor');
      this.page = (this.page + step + pages) % pages;
      this.cursor = 0;
      this.render();
      return;
    }

    const rows = this.rows();
    const move = Controls.consume('up') ? -1 : Controls.consume('down') ? 1 : 0;
    if (move !== 0 && rows.length > 0) {
      playSfx('cursor');
      this.cursor = (this.cursor + move + rows.length) % rows.length;
      this.render();
      return;
    }
    if (Controls.consume('interact')) rows[this.cursor]?.go();
  }

  /** Cierra sin saltar: lo que estaba corriendo sigue donde iba. */
  close(): void {
    if (this.leaving) return;
    this.leaving = true;
    playSfx('close');
    for (const s of this.paused) this.scene.resume(s.scene.key);
    this.scene.stop();
  }

  private back(): void {
    if (this.spawnsOf === null) return this.close();
    playSfx('cancel');
    this.cursor = 0;
    this.spawnsOf = null;
    this.render();
  }

  private rows(): Row[] {
    if (this.spawnsOf !== null) return this.spawnRows(this.spawnsOf);
    if (this.page === pageTools()) return this.toolRows();
    if (this.page === pageAnims()) return this.animRows();
    if (this.page === pageVinetas()) return this.vinetaRows();
    if (this.page === pageSounds()) return this.soundRows();
    if (this.page === pageCamera()) return this.cameraRows();
    const m = MISSIONS[this.page];
    return m ? this.stageRows(m) : mapRows((id) => this.openMap(id));
  }

  /** Ajustes de prueba: cambian algo y se quedan en el selector. */
  private toolRows(): Row[] {
    return [
      {
        label: 'Novedades: ver la tarjeta del título',
        detail: 'E: vuelve al título y muestra la última entrada de changelog.ts (no la marca como vista · dura unos segundos)',
        go: () =>
          this.leave(() => {
            News.preview();
            this.scene.start('Title');
          }),
      },
      {
        label: `Controles táctiles: ${TouchControls.modeLabel()}`,
        detail: 'E cambia: AUTO (solo celulares) · SIEMPRE (también PC) · NUNCA · atajo F3',
        go: () => {
          playSfx('select');
          TouchControls.cycleMode();
          this.render();
        },
      },
      {
        label: `Depuración (F4): ${DEBUG_LABELS[Admin.debugMode]}`,
        detail: 'E cambia: APAGADA · PANEL (coordenadas del jugador y del cursor, clic copia) · PANEL + CUADRÍCULA (sólidos, warps, spawns)',
        go: () => {
          playSfx(Admin.cycleDebug() ? 'select' : 'cancel');
          this.render();
        },
      },
    ];
  }

  /** Vista previa de la pantalla de subida de nivel de cada minijuego. */
  private animRows(): Row[] {
    return [
      {
        label: `Nivel de prueba: ${previewLevel}`,
        detail: 'E cambia entre 2 y 10 (cambia el número, el título del nivel y qué tan llenas van las barras)',
        go: () => {
          playSfx('cursor');
          previewLevel = previewLevel >= 10 ? 2 : previewLevel + 1;
          this.render();
        },
      },
      ...SKILLS.map(
        (def): Row => ({
          label: `Subida de nivel · ${def.name}`,
          detail: `E: ver con sonido · ${def.ranks[previewLevel - 1]} · Enter apura las barras, otra vez cierra`,
          go: () => this.levelUp.open(null, previewInfo(def, previewLevel)),
        }),
      ),
    ];
  }

  /** Todas las viñetas del juego, para verlas con sus sonidos sin llegar al diálogo que las abre. */
  private vinetaRows(): Row[] {
    if (!Content.ready) return [{ label: 'Cargando viñetas...', detail: 'Un momento', go: () => undefined }];
    return vinetaIds()
      .sort()
      .map(
        (id): Row => ({
          label: id,
          detail: 'E: ver (con sus sonidos) · E o ESC la cierra',
          go: () => this.vineta.show(id),
        }),
      );
  }

  /** Probador de sonidos y música: todo lo que el juego puede reproducir. */
  private soundRows(): Row[] {
    return [
      { label: 'Silencio (parar la música)', detail: 'Corta la pista que esté sonando', go: () => playMusic(null) },
      ...Object.keys(TRACKS).map(
        (track): Row => ({
          label: `música · ${track}`,
          detail: 'E: reproducir la pista (se queda sonando)',
          go: () => playMusic(track as MusicTrack),
        }),
      ),
      ...Object.keys(SFX).map(
        (name): Row => ({
          label: `sonido · ${name}`,
          detail: 'E: reproducir el efecto',
          go: () => playSfx(name as SfxName),
        }),
      ),
    ];
  }

  /** Pruebas con la cámara (MediaPipe en el navegador; el video no sale del equipo). */
  private cameraRows(): Row[] {
    const run = (mode: 'game' | 'lab'): void => this.leave(() => this.scene.start('Caras', { mode }));
    return [
      {
        label: 'Concurso de caras (minijuego)',
        detail: 'E: pide permiso de cámara · 7 caras que imitar (sonrisa, cejas, guiño...) · Esc sale · vuelve al título',
        go: () => run('game'),
      },
      {
        label: 'Pimpón con la cabeza (juego que ya existe)',
        detail: 'E: un partido a 7 contra Laura · cabeza mueve la paleta · boca abierta = remate · F centra · Esc sale',
        go: () => {
          const game = this.game;
          this.leave(() =>
            this.scene.start('Pinpon', {
              rival: 'laura',
              camera: true,
              done: () => {
                game.scene.stop('Pinpon');
                game.scene.start('Title');
              },
            }),
          );
        },
      },
      {
        label: 'Probador de gestos (sin juego)',
        detail: 'E: ve en vivo el puntaje de cada gesto y los números de MediaPipe, para ajustar umbrales',
        go: () => run('lab'),
      },
    ];
  }

  private stageRows(m: MissionDef): Row[] {
    const stages = ADMIN_STAGES[m.id] ?? [];
    const first: Row = {
      label: 'Comienzo de la misión',
      detail: `${m.clock?.toUpperCase() ?? 'SIN RELOJ'} · ${m.start.map}/${m.start.spawn}`,
      go: () => this.leave(() => startMission(this, m)),
    };
    return [first, ...stages.map((stage, i) => this.stageRow(m, stages, stage, i))];
  }

  private stageRow(m: MissionDef, stages: AdminStage[], stage: AdminStage, i: number): Row {
    const clock = stages.slice(0, i + 1).reverse().find((s) => s.clock)?.clock;
    const when = clock ? formatDayClock(parseClock(clock, 0)) : 'SIN RELOJ';
    return {
      label: stage.label,
      detail: `${when} · ${stage.map}/${stage.spawn}${stage.run ? ` · parte solo: ${stage.run}` : ''}`,
      go: () =>
        this.leave(() => {
          applyStages(m, stages.slice(0, i + 1));
          this.startMap(stage.map, stage.spawn, stage.run);
        }),
    };
  }

  private openMap(id: string): void {
    const spawns = Object.keys(GameMap.get(id).data.spawns);
    if (spawns.length === 1) return this.teleport(id, spawns[0]);
    playSfx('select');
    this.spawnsOf = id;
    this.cursor = 0;
    this.render();
  }

  private spawnRows(id: string): Row[] {
    return Object.keys(GameMap.get(id).data.spawns).map((spawn) => ({
      label: spawn,
      detail: `${id}/${spawn} · sin cambiar la partida`,
      go: () => this.teleport(id, spawn),
    }));
  }

  private teleport(map: string, spawn: string): void {
    this.leave(() => {
      StoryState.clockPaused = false;
      this.startMap(map, spawn);
    });
  }

  private startMap(mapId: string, spawn: string, run?: string): void {
    const key = SCENE_FOR_KIND[GameMap.get(mapId).data.kind];
    this.scene.start(key, { mapId, spawn, adminRun: run });
  }

  /** Corta todo lo que esté en curso (diálogo, viaje, minijuego, escenas) y ejecuta el salto. */
  private leave(jump: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    playSfx('select');
    Dialogue.abort();
    if (BusRideManager.active) BusRideManager.finish();
    for (const s of this.game.scene.getScenes(false)) {
      if (s !== this && (s.sys.isActive() || s.sys.isPaused() || s.sys.isSleeping())) this.scene.stop(s.scene.key);
    }
    // Desde el título puede ser antes de que lleguen los diálogos y viñetas (ver Content).
    if (Content.ready) jump();
    else void Content.load().then(jump, () => (this.leaving = false));
  }

  private render(): void {
    this.content?.destroy();
    const objs: Phaser.GameObjects.GameObject[] = [];
    const text = (x: number, y: number, value: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text => {
      const t = makeText(this, x, y, value, style);
      objs.push(t);
      return t;
    };
    const cx = BASE_WIDTH / 2;
    const m = MISSIONS[this.page];
    const heading =
      this.spawnsOf ?? (m ? missionFullLabel(m) : this.page === pageMaps() ? 'Todos los mapas (sin cambiar la partida)' : (PAGE_TITLES[this.page - pageTools()] ?? 'Herramientas'));
    const title = text(cx, PANEL.y + 5, heading, { fontSize: '11px', fontStyle: '600', color: THEME.ink }).setOrigin(0.5, 0);
    if (this.spawnsOf === null) {
      const ay = title.y + title.height / 2;
      const right = this.add.graphics({ x: cx + title.width / 2 + 9, y: ay });
      drawTriangle(right, 'right', THEME.accent, 3);
      const left = this.add.graphics({ x: cx - title.width / 2 - 9, y: ay }).setScale(-1, 1);
      drawTriangle(left, 'right', THEME.accent, 3);
      objs.push(left, right);
    }
    const line = this.add.graphics();
    line.fillStyle(THEME.panelInner, 1).fillRect(PANEL.x + 10, PANEL.y + 20, PANEL.w - 20, 1);
    objs.push(line);

    const rows = this.rows();
    const top = Phaser.Math.Clamp(this.cursor - Math.floor(VISIBLE_ROWS / 2), 0, Math.max(0, rows.length - VISIBLE_ROWS));
    rows.slice(top, top + VISIBLE_ROWS).forEach((row, offset) => {
      const index = top + offset;
      const y = LIST_Y + offset * ROW;
      const selected = index === this.cursor;
      const t = text(PANEL.x + 20, y, '', { fontSize: '9px', color: selected ? THEME.accentCss : THEME.ink });
      fitText(t, `${String(index).padStart(2, '0')}  ${row.label}`, PANEL.w - 34);
      if (selected) {
        const arrow = this.add.graphics({ x: PANEL.x + 13, y: y + t.height / 2 });
        drawTriangle(arrow, 'right', THEME.accent, 3);
        objs.push(arrow);
      }
    });
    if (rows.length > VISIBLE_ROWS) {
      text(PANEL.x + PANEL.w - 8, PANEL.y + 5, `${this.cursor + 1}/${rows.length}`, { fontSize: '8px', color: THEME.inkMuted }).setOrigin(1, 0);
    }
    const detail = text(PANEL.x + 12, PANEL.y + PANEL.h - 13, '', { fontSize: '8px', color: THEME.inkMuted });
    fitText(detail, rows[this.cursor]?.detail ?? '', PANEL.w - 24);

    this.content = this.add.container(0, 0, objs);
    this.applyZoom(this.cameras.main.zoom);
  }
}

const PAGE_TITLES = ['Herramientas', 'Animaciones', 'Viñetas', 'Sonidos y música', 'Cámara (experimental)'];
const DEBUG_LABELS = ['APAGADA', 'PANEL', 'PANEL + CUADRÍCULA'];

/** Datos inventados para ver la pantalla de nivel `level` de un minijuego (no toca las stats guardadas). */
function previewInfo(def: (typeof SKILLS)[number], level: number): LevelUpInfo {
  return {
    skillId: def.id,
    name: def.name,
    color: def.color,
    level,
    rank: def.ranks[level - 1] ?? '',
    rows: def.stats.map((st, i) => {
      const before = Math.min(95, (level - 2) * 10 + 6 + i * 3);
      return { name: st.name, before, after: Math.min(100, before + 11 + i * 4) };
    }),
  };
}

/** Una fila por mapa, ordenados por id (se calcula una vez: hay decenas). */
let mapCache: Array<{ id: string; name: string; spawns: number }> | null = null;

function mapRows(open: (id: string) => void): Row[] {
  mapCache ??= GameMap.ids()
    .sort()
    .map((id) => {
      const { name, spawns } = GameMap.get(id).data;
      return { id, name, spawns: Object.keys(spawns).length };
    });
  return mapCache.map((m) => ({
    label: `${m.id} · ${m.name}`,
    detail: `${m.spawns} ${m.spawns === 1 ? 'punto' : 'puntos'} de aparición`,
    go: () => open(m.id),
  }));
}

/** Partida nueva de la misión con los cambios acumulados de `stages`, en orden. */
function applyStages(m: MissionDef, stages: AdminStage[]): void {
  resetForMission(m);
  for (const s of stages) {
    for (const f of s.flags ?? []) StoryState.setFlag(f);
    for (const f of s.clear ?? []) StoryState.setFlag(f, false);
    for (const item of s.items ?? []) if (!StoryState.hasItem(item)) StoryState.addItem(item);
    for (const item of s.take ?? []) StoryState.removeItem(item, StoryState.itemCount(item));
    if (s.outfit) StoryState.setOutfit({ ...currentOutfit(), ...s.outfit });
    if (s.bip) StoryState.chargeBip(s.bip);
    if (s.weather) StoryState.setWeather(s.weather);
    if (s.objective) StoryState.setObjective(s.objective);
    if (s.clock) StoryState.setClock(parseClock(s.clock, 0), s.max ? parseClock(s.max, 0) : undefined);
  }
  const target = stages[stages.length - 1];
  StoryState.location = { map: target.map, spawn: target.spawn };
  Phone.silencePast();
  StoryState.save();
}
