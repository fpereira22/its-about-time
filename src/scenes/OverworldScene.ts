import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { SlidingDoor } from '../art/doors';
import { vehicleKey } from '../art/SpriteRegistry';
import { VEHICLE_ART } from '../art/vehicles';
import { FONT_HUD, TILE } from '../config/display';
import { Controls } from '../systems/Controls';
import { Dialogue } from '../systems/DialogueManager';
import { EventSystem } from '../systems/EventSystem';
import { BusRideManager, BUS_411_ROUTE, BUS_PIXEL_Y } from '../systems/BusRideManager';
import { StoryState } from '../systems/StoryState';
import { makeText } from '../ui/theme';
import { MapScene } from './MapScene';

/**
 * Escena de mapas exteriores (calles de Santiago).
 * Controla la exploración normal a pie y el modo de viaje exterior en micro por Av. Providencia.
 */
export class OverworldScene extends MapScene {
  private activeBusContainer: Phaser.GameObjects.Container | null = null;
  private smokeTimer = 0;

  constructor() {
    super('Overworld');
  }

  override create(): void {
    super.create();

    const isRide = this.sceneData.ride && this.sceneData.ride.startsWith('micro_');
    const isExteriorRide = isRide || (BusRideManager.active && BusRideManager.mode === 'exterior');

    if (isExteriorRide) {
      this.startExteriorBusRide();
    }
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);

    if (BusRideManager.active && BusRideManager.mode === 'exterior') {
      if (Controls.consume('toggleView')) {
        BusRideManager.toggleView(this);
        return;
      }
      if (Controls.consume('interact')) {
        BusRideManager.requestStop();
        return;
      }

      // Humo sutil del escape mientras la micro avanza
      if (this.activeBusContainer) {
        this.smokeTimer += delta;
        if (this.smokeTimer > 180) {
          this.smokeTimer = 0;
          this.puffSmoke(this.activeBusContainer.x - 22, this.activeBusContainer.y - 4);
        }
      }
    }
  }

  private puffSmoke(x: number, y: number): void {
    const puff = this.add.circle(x, y, Phaser.Math.Between(1, 2), 0x94a3b8, 0.45);
    puff.setDepth(BUS_PIXEL_Y);
    this.tweens.add({
      targets: puff,
      y: y - 5,
      x: x - 4,
      alpha: 0,
      scale: 2.2,
      duration: 380,
      onComplete: () => puff.destroy(),
    });
  }

  private startExteriorBusRide(): void {
    this.player.sprite.setVisible(false);
    this.locked = true;

    const rideId = this.sceneData.ride ?? BusRideManager.rideId;
    if (this.sceneData.resume && BusRideManager.active) BusRideManager.resume('exterior');
    else BusRideManager.start(rideId, 'exterior');
    BusRideManager.departed = true;

    EventSystem.onScene(this, 'toggle-ride-view', () => {
      BusRideManager.toggleView(this);
    });

    if (rideId === 'micro_210') {
      void this.run210Exterior();
    } else {
      void this.run411Exterior();
    }
  }

  private createBusContainer(label: string, initialX: number): Phaser.GameObjects.Container {
    const img = this.add.image(0, 0, vehicleKey('micro')).setOrigin(0.5, 1);
    const parts: Phaser.GameObjects.GameObject[] = [img];

    // Letrero LED amarillo con el número de recorrido
    parts.push(
      makeText(this, img.width / 2 - 8, -img.height + 1, label, {
        fontFamily: FONT_HUD,
        fontSize: '8px',
        color: '#f0d048',
        backgroundColor: '#181820',
        padding: { x: 2, y: 0 },
      }).setOrigin(1, 0),
    );

    // Puerta corrediza animada
    const doorSpec = VEHICLE_ART['micro']?.doors;
    const doors = (doorSpec?.rects ?? []).map(
      (r) => new SlidingDoor(this, r.x - img.width / 2, r.y - img.height, r.w, r.h, doorSpec!.style),
    );
    for (const d of doors) parts.push(...d.parts);

    const bus = this.add.container(initialX, BUS_PIXEL_Y, parts);
    bus.setDepth(BUS_PIXEL_Y + 1);
    bus.setData('doors', doors);
    return bus;
  }

  private async run411Exterior(): Promise<void> {
    const startIdx = Math.min(BusRideManager.stopIndex, BUS_411_ROUTE.length - 2);
    const initialX = Math.max(BUS_411_ROUTE[startIdx].pixelX, BusRideManager.pixelX);

    const bus = this.createBusContainer('411', initialX);
    this.activeBusContainer = bus;
    this.cameras.main.startFollow(bus, true, 0.08, 0.08);

    for (let i = startIdx; i < BUS_411_ROUTE.length - 1; i++) {
      if (BusRideManager.isChangingView) return;

      const toStop = BUS_411_ROUTE[i + 1];
      BusRideManager.stopIndex = i;

      Dialogue.vars.set('estacion', toStop.name);
      EventSystem.emit('banner', {
        title: `Próxima parada: ${toStop.name}`,
        subtitle: 'Recorrido 411 · Av. Providencia',
      });
      EventSystem.emit('ride-progress', {
        type: 'micro',
        line: 'Recorrido 411 · Av. Providencia',
        stops: BUS_411_ROUTE.map((s) => s.name),
        index: i + 1,
        state: 'moving',
      });

      playSfx('bus-pass');

      const dist = toStop.pixelX - bus.x;
      const duration = Math.max(1200, Math.round((dist / 130) * 1000));

      await new Promise<void>((resolve) => {
        const tween = this.tweens.add({
          targets: bus,
          x: toStop.pixelX,
          duration,
          ease: 'Linear',
          onUpdate: () => {
            if (BusRideManager.isChangingView) {
              tween.stop();
              resolve();
            }
            BusRideManager.pixelX = bus.x;
          },
          onComplete: () => resolve(),
        });
      });

      if (BusRideManager.isChangingView) return;

      // Llegada a la parada
      BusRideManager.stopIndex = i + 1;
      playSfx('bus-brake');
      EventSystem.emit('banner', {
        title: `Parada ${toStop.name}`,
        subtitle: toStop.final ? 'Terminal · Costanera Center' : 'Recorrido 411',
      });
      EventSystem.emit('ride-progress', {
        type: 'micro',
        line: 'Recorrido 411 · Av. Providencia',
        stops: BUS_411_ROUTE.map((s) => s.name),
        index: i + 1,
        state: 'stopped',
      });

      const wantsToExit = StoryState.hasFlag('_timbre') || Boolean(toStop.final);

      if (wantsToExit) {
        BusRideManager.exiting = true;
        await this.wait(400);
        playSfx('bus-doors-open');
        await this.vehicleDoors(bus, true);
        await this.wait(500);

        // El jugador desciende a la vereda. setTile mueve también el tile lógico:
        // si solo se mueve el sprite, al caminar vuelve al spawn de la escena (Baquedano).
        const spawn = this.map.spawn(toStop.spawn);
        this.player.setTile(spawn.x, spawn.y, 'down');
        this.player.sprite.setVisible(true);
        StoryState.location = { map: this.map.id, spawn: toStop.spawn };
        StoryState.save();
        this.cameras.main.startFollow(this.player.sprite, true);
        this.locked = false;

        await this.wait(800);
        playSfx('bus-doors-close');
        await this.vehicleDoors(bus, false);
        await this.wait(350);

        playSfx('bus-pass');
        this.tweens.add({
          targets: bus,
          x: toStop.pixelX + 320,
          duration: 1600,
          ease: 'Cubic.In',
          onComplete: () => bus.destroy(),
        });

        BusRideManager.finish();
        // Ya a pie: la escena deja de contar como viaje (HUD "En micro", música).
        this.sceneData.ride = undefined;

        if (toStop.final) {
          StoryState.setFlag('ruta_micro');
          void Dialogue.sayText('¡Llegaste a Tobalaba! El Costanera Center está justo al lado.', 'Chofer');
        } else {
          StoryState.setFlag('bajo_antes');
        }
        return;
      }

      // Si nadie pidió parada y no es terminal, espera brevemente y sigue
      await this.wait(1200);
    }
  }

  private async run210Exterior(): Promise<void> {
    const bus = this.createBusContainer('210', 26 * TILE);
    this.activeBusContainer = bus;
    this.cameras.main.startFollow(bus, true, 0.08, 0.08);

    EventSystem.emit('banner', {
      title: 'En marcha por Av. Providencia',
      subtitle: 'Recorrido 210 · Vicuña Mackenna',
    });
    playSfx('bus-pass');

    // Avanza hasta Vicuña Mackenna
    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: bus,
        x: 31 * TILE,
        duration: 2000,
        ease: 'Linear',
        onComplete: () => resolve(),
      });
    });

    if (BusRideManager.isChangingView) return;

    // Dobla al sur por Vicuña Mackenna
    EventSystem.emit('banner', {
      title: 'La micro pone el intermitente...',
      subtitle: '¡Dobla al sur por Vicuña Mackenna!',
    });

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: bus,
        y: BUS_PIXEL_Y + 48,
        duration: 1200,
        ease: 'Cubic.Out',
        onComplete: () => resolve(),
      });
    });

    playSfx('bus-brake');
    await this.wait(500);
    playSfx('bus-doors-open');
    await this.vehicleDoors(bus, true);

    await Dialogue.run('micro_210_dobla');

    // El jugador vuelve a Plaza Baquedano
    const spawn = this.map.spawn('paradero_baquedano');
    this.player.setTile(spawn.x, spawn.y);
    this.player.sprite.setVisible(true);
    this.cameras.main.startFollow(this.player.sprite, true);
    this.locked = false;

    bus.destroy();
    BusRideManager.finish();
    this.sceneData.ride = undefined;
  }
}
