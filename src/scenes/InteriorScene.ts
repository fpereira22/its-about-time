import { SlidingDoor, type DoorStyleId } from '../art/doors';
import { TILE } from '../config/display';
import { Controls } from '../systems/Controls';
import { EventSystem } from '../systems/EventSystem';
import { BusRideManager } from '../systems/BusRideManager';
import { RideController, RIDES } from '../systems/RideController';
import { MapScene } from './MapScene';

/** Tiles de puerta de vehículo que llevan hojas animadas encima. */
const VEHICLE_DOOR_TILES: Record<string, DoorStyleId> = { vagon_puerta: 'vagon', micro_puerta: 'micro', efe_puerta: 'tren_efe_in', art_puerta: 'vagon' };

/** Mapas interiores: estación de metro, vagón, micro, Costanera. Si viene `ride`, corre el viaje. */
export class InteriorScene extends MapScene {
  constructor() {
    super('Interior');
  }

  override create(): void {
    super.create();
    const rideId = this.sceneData.ride;
    // En un viaje subiste con las puertas abiertas; el RideController las cierra al partir.
    const doors = this.createVehicleDoors(Boolean(rideId));
    EventSystem.onScene(this, 'vehicle-doors', ({ open }) => {
      doors.forEach((d) => void d.set(open));
      // En cada estación se baja gente y sube otra.
      if (open && rideId) this.crowd?.turnover();
    });

    if (rideId?.startsWith('micro_')) {
      if (this.sceneData.resume && BusRideManager.active) BusRideManager.resume('interior');
      else BusRideManager.start(rideId, 'interior');
      EventSystem.onScene(this, 'toggle-ride-view', () => {
        BusRideManager.toggleView(this);
      });
    }

    if (!rideId) return;
    const ride = RIDES[rideId];
    if (!ride) {
      console.error(`Viaje "${rideId}" no existe en rides.json`);
      return;
    }
    void new RideController(this, ride).run();
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    if (BusRideManager.active && BusRideManager.mode === 'interior' && Controls.consume('toggleView')) {
      BusRideManager.toggleView(this);
    }
  }

  private createVehicleDoors(open: boolean): SlidingDoor[] {
    const doors: SlidingDoor[] = [];
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const style = VEHICLE_DOOR_TILES[this.map.tileKeyAt(x, y) ?? ''];
        if (!style) continue;
        const door = new SlidingDoor(this, x * TILE + 1, y * TILE, TILE - 2, TILE, style, open);
        doors.push(door.setDepth(-999));
      }
    }
    return doors;
  }
}

