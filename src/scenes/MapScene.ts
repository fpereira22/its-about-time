import Phaser from 'phaser';
import { playMusic, playSfx, type MusicTrack } from '../audio/sfx';
import { SlidingDoor } from '../art/doors';
import { charKey, vehicleKey } from '../art/SpriteRegistry';
import { VEHICLE_ART } from '../art/vehicles';
import { BASE_HEIGHT, BASE_WIDTH, FONT_HUD, TILE } from '../config/display';
import npcData from '../data/npcs.json';
import { CAMPUS_NPCS } from '../data/campus';
import { PUCC_NPCS } from '../data/campus_cali';
import { DIR_VECTORS, OPPOSITE, type Direction, type MapFauna, type MapTrigger } from '../types/map';
import type { NpcDef } from '../types/story';
import { Actor } from '../systems/Actor';
import { check } from '../systems/Conditions';
import { Controls } from '../systems/Controls';
import { Dialogue } from '../systems/DialogueManager';
import { EventSystem } from '../systems/EventSystem';
import { GameMap } from '../systems/GameMap';
import { currentMission } from '../systems/Mission';
import { Npc } from '../systems/Npc';
import { Records } from '../systems/Records';
import { RIDES } from '../systems/RideController';
import { playerTexture } from '../systems/PlayerLook';
import { SCRIPTS, type DriveOptions, type ScriptHost } from '../systems/StoryScripts';
import { StoryState } from '../systems/StoryState';
import { CityLife } from '../systems/CityLife';
import { BusRideManager } from '../systems/BusRideManager';
import { Crowd } from '../systems/Crowd';
import { seatPoseAt } from '../systems/Seats';
import { SkylineView } from '../systems/Skyline';
import { WeatherView } from '../systems/Weather';
import { DarknessView } from '../systems/Darkness';
import { makeText } from '../ui/theme';
import { BaseScene } from './BaseScene';
import type { FutbolResult } from './FutbolScene';

/** NPCs de npcs.json, de src/data/npcs/*.json (uno por misión) y los generados del campus. */
const npcModules = import.meta.glob<NpcDef[]>('../data/npcs/*.json', { eager: true, import: 'default' });
const NPCS: NpcDef[] = [...(npcData as NpcDef[]), ...Object.values(npcModules).flat(), ...CAMPUS_NPCS, ...PUCC_NPCS];

/**
 * En desarrollo, avisa de NPCs o warps que apuntan a diálogos inexistentes. Corre al crear el primer
 * mapa (los diálogos llegan aparte, ver Content). Los tests revisan lo mismo en `npm test`.
 */
let contentChecked = false;
function checkContentOnce(): void {
  if (contentChecked || !import.meta.env.DEV) return;
  contentChecked = true;
  for (const npc of NPCS) {
    if (!Dialogue.exists(npc.dialogue)) console.error(`npcs.json: "${npc.id}" usa el diálogo inexistente "${npc.dialogue}"`);
  }
  for (const id of GameMap.ids()) {
    for (const w of GameMap.get(id).data.warps ?? []) {
      if (w.blockedDialogue && !Dialogue.exists(w.blockedDialogue)) {
        console.error(`Mapa "${id}": warp en (${w.x},${w.y}) usa el diálogo inexistente "${w.blockedDialogue}"`);
      }
    }
  }
}

/** Todos los NPCs (también los generados del campus), para validar datos en los tests. */
export function allNpcs(): readonly NpcDef[] {
  return NPCS;
}

export interface MapSceneData {
  mapId: string;
  spawn: string;
  /** Id de rides.json: la escena Interior corre ese viaje. */
  ride?: string;
  /** Viene de cambiar de vista en la micro: sigue el viaje en curso en vez de empezarlo. */
  resume?: boolean;
  /** Diálogo que se abre apenas aparece el jugador. */
  intro?: string;
  /** Espacio de guardado: aparece en este tile exacto (en vez del spawn, que sigue siendo la "ubicación" guardada). */
  pos?: { x: number; y: number; facing: Direction };
  /** Selector de etapas: script (o "dialogo:<id>") que parte apenas termina la llegada. */
  adminRun?: string;
}

/** Al mirar en otra dirección estando quieto, cuánto hay que mantener la tecla para empezar a caminar. */
const TURN_DELAY_MS = 90;
/** Lo que tarda el jugador en sentarse o pararse de un asiento. */
const SIT_MS = 160;
/** Mínimo entre dos sonidos de choque al empujar una pared. */
const BUMP_COOLDOWN_MS = 280;
const FADE_MS = 250;
/** Lluvia afuera con el paraguas de doña Mery: el jugador camina debajo de él. */
const UMBRELLA_ITEM = 'paraguas';
/** Mojado (o lloviendo sin paraguas): cada cuánto le cae una gota del pelo. */
const DRIP_MS = 260;
/** Animales del mapa (`fauna`): cada cuánto muestran la cola y cuánto rato. */
const DISPLAY_EVERY_MS: [number, number] = [6000, 14000];
const DISPLAY_MS = 2800;
/** Distancia (tiles) a la que se oye el grito del pavo real. */
const FAUNA_HEAR = 9;

/** Flag del desfase horario (misión 4): la cámara se mece como si el jugador estuviera mareado. */
const FLAG_DIZZY = 'desorientado';
const DIZZY_ANGLE = 0.014;
const DIZZY_MS = 1100;
/** Lágrimas: cada cuánto cae una gota y cuánto tarda en caer. */
const TEAR_EVERY_MS = 240;
const TEAR_FALL_MS = 650;
/** Prefijo de evento que abre un diálogo: "dialogo:sag_control". */
const DIALOGUE_EVENT = 'dialogo:';
/** Flag que hace que el quiltro siga al jugador por las calles. */
const FLAG_DOG_FOLLOWS = 'quiltro_sigue';
/** Misión 6: Sira camina contigo (por la feria, a la heladería, la colina). Tiene prioridad sobre el quiltro. */
const FLAG_SIRA_FOLLOWS = 'm6_sira_sigue';
const SIRA_FOLLOWER_SPRITE = 'sira_feria';
/** Misión 7: Sira camina contigo por la U, la cuadra, el lobby, la farmacia y el pasillo (también en interiores). */
const FLAG_SIRA_FOLLOWS_M7 = 'm7_sira_sigue';
const SIRA_FOLLOWER_SPRITE_M7 = 'sira_m7';
/** Misión 7: con tu polera de la PUCC puesta (la que le prestas al volver mojados). */
const SIRA_FOLLOWER_SPRITE_M7_POLERA = 'sira_m7_polera';
const FLAG_SIRA_POLERA = 'm7_polera';

/** Escena del tipo de mapa (overworld/interior) que corresponde a cada `kind`. */
const SCENE_FOR_KIND = { overworld: 'Overworld', interior: 'Interior' } as const;

/** Escena base de cualquier mapa caminable (Overworld e Interior). */
export abstract class MapScene extends BaseScene implements ScriptHost {
  protected map!: GameMap;
  protected player!: Actor;
  protected npcs: Npc[] = [];
  protected sceneData!: MapSceneData;
  /** Bloquea el control del jugador (escenas cortas, menús). */
  protected locked = false;
  protected cityLife?: CityLife;
  protected crowd?: Crowd;
  protected weatherView?: WeatherView;
  protected skyline?: SkylineView;
  protected darkness?: DarknessView;
  private umbrella: Phaser.GameObjects.Graphics | null = null;
  private dripTimer = 0;
  /** Sira debajo del mismo paraguas: dónde va, relativo al jugador. */
  private umbrellaOffset = { x: 0, y: 0 };
  private umbrellaShared = false;
  /** Animales del mapa y cuándo vuelven a mostrar la cola. */
  private fauna: Array<{ npc: Npc; def: MapFauna; timer: number; showing: number }> = [];
  private follower: Actor | null = null;
  /** Personaje del que sigue al jugador (quiltro o Sira), para cambiarlo si cambia la flag. */
  private followerSprite = '';
  private transitioning = false;
  private turnTimer = 0;
  private walking = false;
  private zoneName: string | undefined;
  private lastBump = 0;
  private dizzy = false;
  /** Tile desde el que el jugador se sentó (ahí vuelve al pararse). */
  private seatReturn: { x: number; y: number } | null = null;

  init(data: Partial<MapSceneData>): void {
    this.sceneData = {
      mapId: data.mapId ?? 'test',
      spawn: data.spawn ?? 'inicio',
      ride: data.ride,
      resume: data.resume,
      intro: data.intro,
      pos: data.pos,
      adminRun: data.adminRun,
    };
    this.turnTimer = 0;
    this.walking = false;
    this.locked = false;
    this.transitioning = false;
    this.follower = null;
    this.followerSprite = '';
    this.zoneName = undefined;
    this.seatReturn = null;
    this.dizzy = false;
    this.umbrella = null;
    this.dripTimer = 0;
    this.umbrellaOffset = { x: 0, y: 0 };
    this.umbrellaShared = false;
    this.fauna = [];
  }

  create(): void {
    checkContentOnce();
    const { mapId, spawn: spawnId } = this.sceneData;
    this.map = GameMap.get(mapId);
    this.cameras.main.setBackgroundColor(this.map.data.background ?? '#101018');
    this.map.createLayer(this).setDepth(-1000);
    this.createLabels();

    const saved = this.sceneData.pos;
    const spawn =
      saved && !this.map.isSolid(saved.x, saved.y)
        ? { x: saved.x, y: saved.y, dir: saved.facing }
        : this.map.spawn(spawnId);
    const blocked = (x: number, y: number, self: Actor): boolean => this.isBlocked(x, y, self);
    this.player = new Actor(this, 'player', playerTexture(this), spawn.x, spawn.y, spawn.dir, blocked);
    // Aparecer sobre un asiento (ej. la silla del comedor) es aparecer sentado.
    const spawnSeat = seatPoseAt(this.map, spawn.x, spawn.y);
    if (spawnSeat) this.player.sitAt(spawn.x, spawn.y, spawnSeat);
    this.npcs = NPCS.filter((n) => n.map === mapId).map(
      (def) => new Npc(this, def, blocked, def.sprite ? seatPoseAt(this.map, def.x, def.y) : undefined),
    );
    this.spawnFauna(blocked);
    this.syncFollower();
    this.createCrowd();
    this.weatherView = new WeatherView(this, this.map, this.map.data.lights);
    this.skyline = this.map.data.skyline
      ? new SkylineView(this, this.map, this.weatherView, () => ({ x: this.player.tileX, y: this.player.tileY }))
      : undefined;
    this.darkness = new DarknessView(
      this,
      () => ({ x: this.player.sprite.x, y: this.player.sprite.y, facing: this.player.facing }),
      () => (this.follower ? { x: this.follower.sprite.x, y: this.follower.sprite.y } : null),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.darkness?.destroy());

    if (this.map.data.kind === 'overworld') {
      this.cityLife = new CityLife(this, this.map, () => ({
        tileX: this.player.tileX,
        tileY: this.player.tileY,
        pixelX: this.player.sprite.x,
        pixelY: this.player.sprite.y,
      }));
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cityLife?.destroy());
    }

    StoryState.location = { map: mapId, spawn: spawnId };
    StoryState.save();

    EventSystem.onScene(this, 'state-changed', () => {
      this.npcs.forEach((n) => n.refresh());
      this.syncFollower();
      const skin = playerTexture(this);
      if (this.player.sprite.texture.key !== skin) this.player.sprite.setTexture(skin, this.player.sprite.frame.name);
    });
    EventSystem.onScene(this, 'warp', ({ map, spawn }) => this.goTo(map, spawn));
    EventSystem.onScene(this, 'start-scene', ({ scene, data }) =>
      this.transition(() => this.scene.start(scene, data)),
    );
    EventSystem.onScene(this, 'story', ({ name, data }) => this.runScript(name, data));
    // El partido (misión 4) corre en su propia escena; el mapa y la interfaz duermen mientras tanto.
    EventSystem.onScene(this, 'open-futbol', ({ done, tutorial }) => {
      this.launchMinigame('Futbol', { tutorial }, (result: FutbolResult) => done(result));
    });
    // Misión 5: el Marco Polo en la piscina y el Cinco en Pance Burger, igual que el partido.
    EventSystem.onScene(this, 'open-piscina', ({ done }) => this.launchMinigame('Piscina', {}, done));
    EventSystem.onScene(this, 'open-cinco', ({ done }) => this.launchMinigame('Cinco', {}, done));
    // Misión 6: la clase de natación con Sira y la persecución del ladrón en el Bulevar.
    EventSystem.onScene(this, 'open-natacion', ({ done }) => this.launchMinigame('Natacion', {}, done));
    EventSystem.onScene(this, 'open-persecucion', ({ done }) => this.launchMinigame('Persecucion', {}, done));
    // Misión 7: la boloñesa en el depa.
    EventSystem.onScene(this, 'open-cocina', ({ part, done }) => this.launchMinigame('Cocina', { part }, done));
    EventSystem.onScene(this, 'open-salsa', ({ done }) => this.launchMinigame('Salsa', {}, done));

    if (!this.scene.isActive('UI')) this.scene.launch('UI');
    this.scene.bringToTop('UI');

    this.setupCamera();
    this.setupZoom();
    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
    playMusic(this.musicTrack());

    this.time.delayedCall(FADE_MS, () => {
      this.checkZone(true);
      void this.runArrival();
    });
  }

  /** Abre un minijuego en su propia escena; el mapa y la interfaz duermen hasta que llama a `done`. */
  private launchMinigame<R>(key: string, data: Record<string, unknown>, done: (result: R) => void): void {
    this.scene.sleep('UI');
    this.scene.launch(key, {
      ...data,
      done: (result: R) => {
        this.scene.stop(key);
        this.scene.wake('UI');
        this.scene.wake();
        this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
        done(result);
      },
    });
    this.scene.sleep();
  }

  override update(_time: number, delta: number): void {
    StoryState.tick(delta);
    this.weatherView?.update(delta);
    this.skyline?.update(delta);
    this.darkness?.update(delta);
    this.updateDizzy();
    this.updateRainGear(delta);
    this.updateFauna(delta);
    this.cityLife?.update(delta);
    this.crowd?.update(delta, Dialogue.active || this.locked);
    for (const npc of this.npcs) npc.update(delta, Dialogue.active || this.locked);
    if (Dialogue.active || this.transitioning || this.locked) return;

    if (!this.player.moving && Controls.consume('interact')) {
      this.interact();
      return;
    }
    // En el apagón, F prende o apaga la linterna del celular.
    if (this.darkness?.active && Controls.consume('trick')) this.darkness.toggleTorch();
    this.handleMovement(delta);
  }

  // -------------------------------------------------------------------------
  // API para scripts (ScriptHost)
  // -------------------------------------------------------------------------

  /** El menú de pausa solo se abre con el jugador libre (sin diálogo, transición ni escena corta). */
  get canOpenMenu(): boolean {
    return !Dialogue.active && !this.transitioning && !this.locked;
  }

  /** Por qué no se puede guardar aquí (en un viaje en metro o micro), o null si se puede. */
  get saveBlockedReason(): string | null {
    if (!this.canOpenMenu) return 'Termina lo que estás haciendo';
    const rideMaps = new Set(Object.values(RIDES).map((r) => r.map));
    if (this.sceneData.ride || BusRideManager.active || rideMaps.has(this.map.id)) return 'No se puede guardar en pleno viaje';
    return null;
  }

  /** Dónde está el jugador, para un espacio de guardado. */
  get saveSpot(): { map: string; spawn: string; place: string; pos: { x: number; y: number; facing: Direction } } {
    return {
      map: this.map.id,
      spawn: this.sceneData.spawn,
      place: this.zoneName ?? this.map.data.name,
      pos: { x: this.player.tileX, y: this.player.tileY, facing: this.player.facing },
    };
  }

  /** Pies del jugador en px de pantalla (para que el HUD se desvanezca si lo tapa). */
  get playerScreen(): { x: number; y: number } {
    const view = this.cameras.main.worldView;
    return { x: this.player.sprite.x - view.x, y: this.player.sprite.y - view.y };
  }

  /** Para el mapa del celular: dónde está el jugador (en tiles, con fracción mientras camina). */
  get navInfo(): { mapId: string; x: number; y: number; facing: Direction; ride?: string } {
    return {
      mapId: this.map.id,
      x: this.player.sprite.x / TILE - 0.5,
      y: this.player.sprite.y / TILE - 1,
      facing: this.player.facing,
      ride: this.sceneData.ride,
    };
  }

  get mapWidthPx(): number {
    return this.map.width * TILE;
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
  }

  /** Funde a negro (out) o vuelve desde negro. */
  fade(out: boolean, ms = 600): Promise<void> {
    const cam = this.cameras.main;
    return new Promise((resolve) => {
      if (out) {
        cam.fadeOut(ms, 0, 0, 0);
        cam.once('camerafadeoutcomplete', () => resolve());
      } else {
        cam.fadeIn(ms, 0, 0, 0);
        cam.once('camerafadeincomplete', () => resolve());
      }
    });
  }

  /** Mira hacia `dir` (el jugador). */
  facePlayer(dir: Direction): void {
    this.player.face(dir);
  }

  /** Pone al jugador en un spawn del mapa actual (sentado o acostado si es un asiento o la cama). */
  placePlayer(spawnId: string): void {
    const s = this.map.spawn(spawnId);
    const pose = seatPoseAt(this.map, s.x, s.y);
    this.seatReturn = null;
    if (pose) this.player.sitAt(s.x, s.y, pose);
    else this.player.standAt(s.x, s.y, s.dir);
  }

  /** Sacude la cámara (despegue, turbulencia, baches del camino). */
  shake(ms: number, intensity = 0.002): void {
    this.cameras.main.shake(ms, intensity);
  }

  /** Lágrimas que caen de la cara del jugador ("player") o de un NPC (por su id) durante `ms`. */
  cry(who: string, ms: number): void {
    const actor = who === 'player' ? this.player : this.npcs.find((n) => n.def.id === who)?.actor;
    if (!actor) return;
    const sprite = actor.sprite;
    this.time.addEvent({
      delay: TEAR_EVERY_MS,
      repeat: Math.floor(ms / TEAR_EVERY_MS),
      callback: () => {
        if (!sprite.active) return;
        // Bajo los ojos: el sprite está anclado a los pies (16 px de alto).
        const x = sprite.x + (Math.random() < 0.5 ? -2 : 1);
        const drop = this.add.rectangle(x, sprite.y - 9, 1, 3, 0xa8e0ff).setDepth(sprite.depth + 1);
        this.tweens.add({ targets: drop, y: drop.y + 6, alpha: 0, duration: TEAR_FALL_MS, onComplete: () => drop.destroy() });
      },
    });
  }

  wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  say(dialogueId: string): Promise<void> {
    return Dialogue.run(dialogueId);
  }

  /** Viaja a otro mapa con fade. Elige Overworld o Interior según el `kind` del mapa destino. */
  goTo(mapId: string, spawn: string): void {
    const sceneKey = SCENE_FOR_KIND[GameMap.get(mapId).data.kind];
    if (!this.transitioning) playSfx('door');
    this.transition(() => this.scene.start(sceneKey, { mapId, spawn }));
  }

  startRide(rideId: string): void {
    const ride = RIDES[rideId];
    if (!ride) {
      console.error(`Viaje "${rideId}" no existe en rides.json`);
      return;
    }
    if (!this.transitioning) playSfx('door');
    const wantExterior = StoryState.hasFlag('_ver_exterior');
    StoryState.setFlag('_ver_exterior', false);
    if (ride.type === 'micro' && wantExterior) {
      BusRideManager.start(rideId, 'exterior');
      this.transition(() =>
        this.scene.start('Overworld', { mapId: 'providencia', spawn: 'paradero_baquedano', ride: rideId }),
      );
    } else {
      if (ride.type === 'micro') BusRideManager.start(rideId, 'interior');
      this.transition(() => this.scene.start('Interior', { mapId: ride.map, spawn: ride.spawn, ride: rideId }));
    }
  }

  completeMission(): void {
    StoryState.setFlag(`${currentMission().id}_completa`);
    Records.recordCompletion();
    StoryState.clockPaused = true;
    playMusic(null);
    this.transition(() => {
      this.scene.stop('UI');
      this.scene.start('MissionComplete');
    }, 600);
  }

  /** Abre o cierra las puertas animadas de un vehículo creado con drive(). */
  async vehicleDoors(vehicle: Phaser.GameObjects.Container, open: boolean): Promise<void> {
    const doors = (vehicle.getData('doors') as SlidingDoor[] | undefined) ?? [];
    await Promise.all(doors.map((d) => d.set(open)));
  }

  drive(opts: DriveOptions): Promise<Phaser.GameObjects.Container> {
    let vehicle = opts.existing;
    if (!vehicle) {
      const img = this.add.image(0, 0, vehicleKey(opts.texture)).setOrigin(0.5, 1);
      const parts: Phaser.GameObjects.GameObject[] = [img];
      if (opts.label) {
        // El letrero va arriba, sobre el frente (a la izquierda si el vehículo va hacia el poniente).
        const left = VEHICLE_ART[opts.texture]?.mirror === true;
        parts.push(
          makeText(this, left ? -img.width / 2 + 8 : img.width / 2 - 8, -img.height + 1, opts.label, {
            fontFamily: FONT_HUD,
            fontSize: '8px',
            color: '#f0d048',
            backgroundColor: '#181820',
            padding: { x: 2, y: 0 },
          }).setOrigin(left ? 0 : 1, 0),
        );
      }
      const doorSpec = VEHICLE_ART[opts.texture]?.doors;
      const doors = (doorSpec?.rects ?? []).map(
        (r) => new SlidingDoor(this, r.x - img.width / 2, r.y - img.height, r.w, r.h, doorSpec!.style),
      );
      for (const d of doors) parts.push(...d.parts);
      vehicle =
        opts.laneX !== undefined
          ? this.add.container(opts.laneX, opts.xFrom, parts)
          : this.add.container(opts.xFrom, (opts.bottomTileY + 1) * TILE, parts);
      vehicle.setDepth(opts.laneX !== undefined ? opts.xFrom + 1 : (opts.bottomTileY + 1) * TILE + 1);
      vehicle.setData('doors', doors);
    }
    const target = vehicle;
    // En una calle norte-sur (`laneX`), el vehículo se mueve en y y su profundidad lo sigue.
    const vertical = opts.laneX !== undefined;
    return new Promise((resolve) => {
      this.tweens.add({
        targets: target,
        ...(vertical ? { y: opts.xTo } : { x: opts.xTo }),
        duration: opts.ms,
        ease: opts.ease ?? 'Linear',
        onUpdate: () => {
          if (vertical) {
            target.y = Math.round(target.y);
            target.setDepth(target.y + 1);
          } else target.x = Math.round(target.x);
        },
        onComplete: () => {
          if (opts.destroyAtEnd) target.destroy();
          resolve(target);
        },
      });
    });
  }

  // -------------------------------------------------------------------------

  /** ¿Puede un actor entrar al tile (x, y)? */
  protected isBlocked(x: number, y: number, self: Actor): boolean {
    if (this.map.isSolid(x, y)) return true;
    if (self !== this.player && this.player.occupies(x, y)) return true;
    if (this.crowd?.occupies(x, y)) return true;
    return this.npcs.some((n) => n.blocks && n.actor !== self && n.occupies(x, y));
  }

  /** Se llama cada vez que el jugador termina un paso. */
  protected onPlayerArrive(): void {
    const { tileX: x, tileY: y } = this.player;
    this.checkZone(false);

    this.fireTriggers(this.map.triggersAt(x, y));

    const warp = this.map.warpAt(x, y);
    if (!warp) return;
    if (check(warp.if)) {
      this.goTo(warp.to, warp.spawn);
    } else if (warp.blockedDialogue) {
      const back = OPPOSITE[this.player.facing];
      void Dialogue.run(warp.blockedDialogue).then(() => this.player.tryStep(back));
    }
  }

  private fireTriggers(triggers: MapTrigger[]): void {
    for (const t of triggers) {
      const onceFlag = `trigger_${this.map.id}_${t.id}`;
      if (t.once && StoryState.hasFlag(onceFlag)) continue;
      if (!check(t.if)) continue;
      if (t.once) StoryState.setFlag(onceFlag);
      EventSystem.emit('story', { name: t.event });
    }
  }

  protected transition(action: () => void, fadeMs = FADE_MS): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(fadeMs, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', action);
  }

  private runScript(name: string, data: unknown): void {
    if (name === currentMission().victoryEvent) {
      this.completeMission();
      return;
    }
    // "dialogo:<id>": abre ese diálogo (un trigger de mapa no puede pasar datos a un script).
    if (name.startsWith(DIALOGUE_EVENT)) {
      void Dialogue.run(name.slice(DIALOGUE_EVENT.length));
      return;
    }
    const script = SCRIPTS[name];
    if (script) void script(this, (data ?? {}) as Record<string, unknown>);
    else if (!name.startsWith('ride_')) console.warn(`Evento "${name}" sin script`);
  }

  /** Música según el lugar: calle, estación o el vehículo del viaje. */
  private musicTrack(): MusicTrack {
    const ride = this.sceneData.ride ? RIDES[this.sceneData.ride] : undefined;
    if (ride) return ride.type === 'metro' ? 'train' : 'bus';
    if (this.map.data.music) return this.map.data.music;
    if (this.map.id.startsWith('costanera_')) return 'credits';
    return this.map.data.kind === 'overworld' ? 'street' : 'station';
  }

  /** Al aparecer: el diálogo de entrada (llamado del celular al empezar) y luego los `enter` del mapa. */
  private async runArrival(): Promise<void> {
    if (this.sceneData.intro) {
      playSfx('phone');
      await Dialogue.run(this.sceneData.intro);
    }
    for (const e of this.map.data.enter ?? []) {
      const onceFlag = `enter_${this.map.id}_${e.id}`;
      if (e.once && StoryState.hasFlag(onceFlag)) continue;
      if (!check(e.if)) continue;
      if (e.once) StoryState.setFlag(onceFlag);
      await Dialogue.run(e.dialogue);
      // Si el diálogo cambió de mapa, esta escena ya no sigue.
      if (this.transitioning) return;
    }
    if (this.sceneData.adminRun) this.runScript(this.sceneData.adminRun, undefined);
  }

  private checkZone(force: boolean): void {
    const zone = this.map.zoneAt(this.player.tileX, this.player.tileY);
    const name = zone?.name ?? (this.map.data.kind === 'interior' ? this.map.data.name : undefined);
    if (name === this.zoneName && !force) return;
    this.zoneName = name;
    const ride = this.sceneData.ride ? RIDES[this.sceneData.ride] : undefined;
    EventSystem.emit(
      'location-changed',
      ride
        ? { name: ride.place ?? (ride.type === 'metro' ? 'En metro' : 'En micro'), subtitle: ride.line }
        : { name: name ?? this.map.data.name, subtitle: zone?.subtitle },
    );
    if (!name || (force && this.sceneData.ride)) return;
    if (zone) EventSystem.emit('zone-entered', zone);
    EventSystem.emit('banner', { title: name, subtitle: zone?.subtitle });
  }

  private interact(): void {
    const t = this.player.facingTile();
    const npc = this.npcs.find((n) => n.occupies(t.x, t.y));
    if (npc) {
      npc.faceToward(this.player.facing);
      if (npc.def.sprite === 'quiltro') playSfx('dog');
      void Dialogue.run(npc.def.dialogue);
      return;
    }
    if (this.crowd?.talkAt(t.x, t.y, this.player.facing)) return;
    if (this.cityLife?.interactAt(t.x, t.y, this.player.facing)) {
      return;
    }
    this.trySit(t.x, t.y);
  }

  /** Se sienta en el asiento libre que tiene enfrente. */
  private trySit(x: number, y: number): void {
    const pose = seatPoseAt(this.map, x, y);
    if (!pose || this.player.seated) return;
    this.seatReturn = { x: this.player.tileX, y: this.player.tileY };
    this.player.sitAt(x, y, pose, SIT_MS);
    playSfx('sit');
    // Los asientos son sólidos (nunca se pisan): un trigger sobre un asiento se dispara al sentarse en él.
    this.fireTriggers(this.map.triggersAt(x, y));
  }

  /** Se para del asiento hacia donde volvió a caminar (o por donde llegó). */
  private standUp(dir: Direction): void {
    const { tileX: x, tileY: y } = this.player;
    const v = DIR_VECTORS[dir];
    const options = [
      this.seatReturn,
      { x: x + v.x, y: y + v.y },
      ...Object.values(DIR_VECTORS).map((d) => ({ x: x + d.x, y: y + d.y })),
    ];
    const free = (o: { x: number; y: number } | null): boolean => !!o && !this.isBlocked(o.x, o.y, this.player);
    // Si un pasajero de pie tapa la salida del asiento, se corre para dejar pasar.
    const spot = options.find(free) ?? options.find((o) => o && this.crowd?.makeRoom(o.x, o.y) && free(o));
    if (!spot) return;
    this.seatReturn = null;
    this.player.standAt(spot.x, spot.y, dir, SIT_MS);
    this.turnTimer = TURN_DELAY_MS;
  }

  /** Pasajeros y gente de relleno (campo `crowd` del mapa). */
  private createCrowd(): void {
    const def = this.map.data.crowd;
    if (!def) return;
    const tile = (x: number, y: number): string => `${x},${y}`;
    const blocked = new Set<string>();
    const keepClear = new Set<string>();
    for (const s of Object.values(this.map.data.spawns)) blocked.add(tile(s.x, s.y));
    for (const w of this.map.data.warps ?? []) blocked.add(tile(w.x, w.y));
    for (const t of this.map.data.triggers ?? []) {
      for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) blocked.add(tile(x, y));
    }
    for (const n of this.npcs) {
      blocked.add(tile(n.def.x, n.def.y));
      for (const v of Object.values(DIR_VECTORS)) keepClear.add(tile(n.def.x + v.x, n.def.y + v.y));
    }
    const occupied = (x: number, y: number): boolean =>
      this.player.occupies(x, y) || this.npcs.some((n) => n.blocks && n.occupies(x, y));
    this.crowd = new Crowd(this, this.map, def, blocked, keepClear, occupied);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.crowd?.destroy();
      this.crowd = undefined;
    });
  }

  private handleMovement(delta: number): void {
    if (this.player.moving) return;
    const dir = Controls.direction();
    if (!dir) {
      this.walking = false;
      this.turnTimer = 0;
      return;
    }
    if (this.player.seated) {
      this.standUp(dir);
      return;
    }
    if (!this.walking && dir !== this.player.facing) {
      this.player.face(dir);
      this.turnTimer = TURN_DELAY_MS;
      return;
    }
    if (this.turnTimer > 0) {
      this.turnTimer -= delta;
      return;
    }
    const prevX = this.player.tileX;
    const prevY = this.player.tileY;
    this.walking = this.player.tryStep(dir, () => this.onPlayerArrive());
    if (!this.walking && this.time.now - this.lastBump > BUMP_COOLDOWN_MS) {
      this.lastBump = this.time.now;
      playSfx('bump');
    }
    if (this.walking) this.followTo(prevX, prevY);
  }

  /** Crea o quita al que sigue al jugador (el quiltro, o Sira en la misión 6), solo en la calle. */
  private syncFollower(): void {
    const m7 = StoryState.hasFlag(FLAG_SIRA_FOLLOWS_M7);
    const sprite = m7
      ? StoryState.hasFlag(FLAG_SIRA_POLERA)
        ? SIRA_FOLLOWER_SPRITE_M7_POLERA
        : SIRA_FOLLOWER_SPRITE_M7
      : StoryState.hasFlag(FLAG_SIRA_FOLLOWS)
        ? SIRA_FOLLOWER_SPRITE
        : StoryState.hasFlag(FLAG_DOG_FOLLOWS)
          ? 'quiltro'
          : '';
    const want = sprite !== '' && (this.map.data.kind === 'overworld' || m7);
    if (this.follower && sprite !== this.followerSprite) {
      this.follower.destroy();
      this.follower = null;
    }
    this.followerSprite = sprite;
    if (want && !this.follower) {
      const back = DIR_VECTORS[OPPOSITE[this.player.facing]];
      const bx = this.player.tileX + back.x;
      const by = this.player.tileY + back.y;
      const free = !this.map.isSolid(bx, by);
      this.follower = new Actor(
        this,
        `${sprite}_seguidor`,
        charKey(sprite),
        free ? bx : this.player.tileX,
        free ? by : this.player.tileY,
        this.player.facing,
        () => false,
      );
    } else if (!want && this.follower) {
      this.follower.destroy();
      this.follower = null;
    }
  }

  private followTo(x: number, y: number): void {
    const f = this.follower;
    if (!f || (f.tileX === x && f.tileY === y)) return;
    const dx = x - f.tileX;
    const dy = y - f.tileY;
    if (Math.abs(dx) + Math.abs(dy) !== 1 || f.moving) {
      f.setTile(x, y);
      return;
    }
    const dir: Direction = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
    f.tryStep(dir);
  }

  /**
   * Animales que aparecen en un lugar al azar cada vez que se entra al mapa (campo `fauna`): se agregan
   * como NPCs que deambulan, para poder hablarles.
   */
  private spawnFauna(blocked: (x: number, y: number, self: Actor) => boolean): void {
    const taken = new Set<string>();
    for (const s of Object.values(this.map.data.spawns)) taken.add(`${s.x},${s.y}`);
    for (const w of this.map.data.warps ?? []) taken.add(`${w.x},${w.y}`);
    for (const n of this.npcs) taken.add(`${n.def.x},${n.def.y}`);
    for (const def of this.map.data.fauna ?? []) {
      for (let i = 0; i < def.count; i++) {
        for (let tries = 0; tries < 60; tries++) {
          const x = def.area.x + Math.floor(Math.random() * def.area.w);
          const y = def.area.y + Math.floor(Math.random() * def.area.h);
          if (taken.has(`${x},${y}`) || this.map.isSolid(x, y) || !def.tiles.includes(this.map.tileKeyAt(x, y) ?? '')) continue;
          taken.add(`${x},${y}`);
          const npc = new Npc(
            this,
            { id: `fauna_${def.sprite}_${i}`, map: this.map.id, x, y, sprite: def.sprite, dialogue: def.dialogue, wander: def.wander ?? 5, dir: 'down' },
            blocked,
          );
          this.npcs.push(npc);
          this.fauna.push({ npc, def, timer: Phaser.Math.Between(...DISPLAY_EVERY_MS), showing: 0 });
          break;
        }
      }
    }
  }

  /** El pavo real se detiene y abre la cola un rato; si estás cerca, grita. */
  private updateFauna(delta: number): void {
    for (const f of this.fauna) {
      const actor = f.npc.actor;
      if (!actor || !f.def.display) continue;
      if (f.showing > 0) {
        f.showing -= delta;
        if (f.showing <= 0) actor.sprite.setTexture(charKey(f.def.sprite), actor.sprite.frame.name);
        continue;
      }
      f.timer -= delta;
      if (f.timer > 0 || actor.moving || Dialogue.active) continue;
      f.timer = Phaser.Math.Between(...DISPLAY_EVERY_MS);
      f.showing = DISPLAY_MS;
      f.npc.hold(DISPLAY_MS + 400);
      actor.face('down');
      actor.sprite.setTexture(charKey(f.def.display), actor.sprite.frame.name);
      const near = Math.abs(actor.tileX - this.player.tileX) + Math.abs(actor.tileY - this.player.tileY) <= FAUNA_HEAR;
      if (near && f.def.sfx) playSfx(f.def.sfx);
    }
  }

  /**
   * Afuera con lluvia: el paraguas se abre solo si lo tienes (si no, o si llegaste mojado, gotitas que caen del pelo).
   * Sira, si te acompaña, se mete debajo: camina pegada a ti y el paraguas se agranda y queda entre los dos.
   */
  private updateRainGear(delta: number): void {
    const raining = this.map.data.kind === 'overworld' && (StoryState.weather === 'lluvia' || StoryState.weather === 'tormenta');
    const sprite = this.player.sprite;
    const show = raining && StoryState.hasItem(UMBRELLA_ITEM) && sprite.visible && !this.player.seated;
    if (show && !this.umbrella) {
      this.umbrella = this.createUmbrella();
      playSfx('paraguas');
    }
    const buddy = show && StoryState.hasFlag(FLAG_SIRA_FOLLOWS_M7) && this.follower?.sprite.visible ? this.follower : null;
    if (buddy) this.tuckUnderUmbrella(buddy, delta);
    else if (this.umbrellaShared) this.releaseFromUmbrella();
    if (this.umbrella) {
      this.umbrella.setVisible(show);
      if (show) {
        const o = this.umbrellaOffset;
        this.umbrella
          .setScale(buddy ? 1.7 : 1, buddy ? 1.1 : 1)
          .setPosition(Math.round(sprite.x + o.x / 2), Math.round(sprite.y - (buddy ? 23 : 13) + o.y / 2))
          .setDepth(Math.max(sprite.depth, buddy?.sprite.depth ?? 0) + 0.5);
      }
    }
    const dripping = (raining && !show) || StoryState.hasFlag('mojado');
    if (!dripping || !sprite.visible) return;
    this.dripTimer -= delta;
    if (this.dripTimer > 0) return;
    this.dripTimer = DRIP_MS;
    const x = sprite.x + Phaser.Math.Between(-5, 4);
    const drop = this.add.rectangle(x, sprite.y - 14, 1, 2, 0xa8d8ff).setDepth(sprite.depth + 1);
    this.tweens.add({ targets: drop, y: drop.y + 10, alpha: 0, duration: 420, onComplete: () => drop.destroy() });
  }

  /** Pone a Sira al lado del jugador (hombro con hombro), aunque en los tiles venga un paso atrás. */
  private tuckUnderUmbrella(buddy: Actor, delta: number): void {
    const sprite = this.player.sprite;
    const f = this.player.facing;
    const target = f === 'left' ? { x: 11, y: 2 } : f === 'right' ? { x: -11, y: 2 } : { x: 11, y: 0 };
    const o = this.umbrellaOffset;
    if (!this.umbrellaShared) {
      // Parte desde donde venía caminando, para que se acerque en vez de teletransportarse.
      o.x = buddy.sprite.x - sprite.x;
      o.y = buddy.sprite.y - sprite.y;
      this.umbrellaShared = true;
    }
    const a = Math.min(1, delta / 110);
    o.x += (target.x - o.x) * a;
    o.y += (target.y - o.y) * a;
    buddy.sprite.setPosition(Math.round(sprite.x + o.x), Math.round(sprite.y + o.y));
    buddy.sprite.setDepth(buddy.sprite.y);
    if (!buddy.moving) buddy.face(f);
  }

  private releaseFromUmbrella(): void {
    this.umbrellaShared = false;
    this.umbrellaOffset = { x: 0, y: 0 };
    if (this.follower) this.follower.setTile(this.follower.tileX, this.follower.tileY);
  }

  /** Paraguas negro visto desde arriba (la copa con sus varillas y el mango hacia la mano). */
  private createUmbrella(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(0x2a2433, 1).fillEllipse(0, 0, 22, 11);
    g.fillStyle(0x3a3c48, 1).fillEllipse(0, -1, 20, 9);
    g.lineStyle(1, 0x2a2433, 1);
    for (const a of [-0.9, -0.3, 0.3, 0.9]) g.lineBetween(0, -1, Math.sin(a) * 10, Math.cos(a) * 4 - 1);
    g.fillStyle(0x5a5c68, 1).fillRect(-6, -4, 4, 1);
    g.fillStyle(0x8a6a40, 1).fillRect(0, 4, 1, 5);
    return g;
  }

  /** Desfase horario: mientras dure la flag, el mundo se mece un poquito (se pasa con el desayuno). */
  private updateDizzy(): void {
    const dizzy = StoryState.hasFlag(FLAG_DIZZY);
    if (dizzy) this.cameras.main.setRotation(Math.sin(this.time.now / DIZZY_MS) * DIZZY_ANGLE);
    else if (this.dizzy) this.cameras.main.setRotation(0);
    this.dizzy = dizzy;
  }

  private createLabels(): void {
    for (const label of this.map.data.labels ?? []) {
      this.addText(label.x * TILE, label.y * TILE, label.text, {
        fontFamily: FONT_HUD,
        fontSize: '8px',
        color: label.color ?? '#ffffff',
        backgroundColor: '#1a2a4acc',
        padding: { x: 2, y: 1 },
      })
        .setOrigin(0.5, 0.5)
        .setDepth(10000);
    }
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    const w = this.map.width * TILE;
    const h = this.map.height * TILE;
    // Los mapas más chicos que la pantalla quedan centrados en X y arriba en Y,
    // para que la caja de diálogo no tape el piso del vagón o la micro.
    const bx = w < BASE_WIDTH ? (w - BASE_WIDTH) / 2 : 0;
    const by = h < BASE_HEIGHT ? -Math.min(14, (BASE_HEIGHT - h) / 2) : 0;
    cam.setBounds(Math.floor(bx), Math.floor(by), Math.max(w, BASE_WIDTH), Math.max(h, BASE_HEIGHT));
    cam.startFollow(this.player.sprite, true);
    cam.setFollowOffset(0, TILE / 2);
  }
}
