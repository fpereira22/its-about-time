import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { EventSystem } from './EventSystem';
import { StoryState } from './StoryState';

export interface BusStopSpec {
  name: string;
  tileX: number;
  pixelX: number;
  spawn: string;
  final?: boolean;
}

export const BUS_411_ROUTE: BusStopSpec[] = [
  { name: 'Baquedano', tileX: 26, pixelX: 26 * 16, spawn: 'paradero_baquedano' },
  { name: 'Salvador', tileX: 40, pixelX: 40 * 16, spawn: 'paradero_salvador' },
  { name: 'Manuel Montt', tileX: 74, pixelX: 74 * 16, spawn: 'paradero_manuelmontt' },
  { name: 'Pedro de Valdivia', tileX: 108, pixelX: 108 * 16, spawn: 'paradero_pedrodevaldivia' },
  { name: 'Los Leones', tileX: 142, pixelX: 142 * 16, spawn: 'paradero_losleones' },
  { name: 'Tobalaba', tileX: 207, pixelX: 207 * 16, spawn: 'paradero_tobalaba', final: true },
];

export const BUS_LANE_Y = 17; // Fila de Av. Providencia
export const BUS_PIXEL_Y = (BUS_LANE_Y + 1) * 16; // 288px

class BusRideManagerImpl {
  active = false;
  rideId = 'micro_411';
  mode: 'interior' | 'exterior' = 'interior';
  stopIndex = 0;
  pixelX = 26 * 16;
  isChangingView = false;
  /** Ya partió (pasó el diálogo de subida): al cambiar de vista no se repite. */
  departed = false;
  /** Se está bajando en una parada: ya no se puede cambiar de vista. */
  exiting = false;

  get is411(): boolean {
    return this.rideId === 'micro_411';
  }

  start(rideId: string, initialMode: 'interior' | 'exterior' = 'interior'): void {
    this.active = true;
    this.rideId = rideId;
    this.mode = initialMode;
    this.stopIndex = 0;
    this.pixelX = 26 * 16;
    this.isChangingView = false;
    this.departed = false;
    this.exiting = false;
    StoryState.setFlag('_timbre', false);
    this.emitStatus();
  }

  /** La escena nueva tras cambiar de vista: sigue el mismo viaje donde iba. */
  resume(mode: 'interior' | 'exterior'): void {
    this.mode = mode;
    this.isChangingView = false;
    this.emitStatus();
  }

  emitStatus(): void {
    EventSystem.emit('bus-ride-status', {
      active: this.active,
      mode: this.mode,
      rideId: this.rideId,
      line: this.is411 ? 'Recorrido 411 · Av. Providencia' : 'Recorrido 210 · Vicuña Mackenna',
    });
  }

  requestStop(): void {
    if (!this.active || StoryState.hasFlag('_timbre')) return;
    StoryState.setFlag('_timbre', true);
    playSfx('bell');
    EventSystem.emit('banner', {
      title: '¡Timbre tocado!',
      subtitle: 'La micro se detendrá en la próxima parada',
    });
  }

  toggleView(host: { scene: Phaser.Scenes.ScenePlugin; cameras: Phaser.Cameras.Scene2D.CameraManager }): void {
    if (!this.active || this.isChangingView || this.exiting) return;
    this.isChangingView = true;

    playSfx('door');
    const newMode: 'interior' | 'exterior' = this.mode === 'interior' ? 'exterior' : 'interior';
    this.mode = newMode;
    this.emitStatus();

    host.cameras.main.fadeOut(200, 0, 0, 0);
    host.cameras.main.once('camerafadeoutcomplete', () => {
      this.isChangingView = false;
      if (newMode === 'exterior') {
        host.scene.start('Overworld', {
          mapId: 'providencia',
          spawn: 'paradero_baquedano',
          ride: this.rideId,
          resume: true,
        });
      } else {
        host.scene.start('Interior', {
          mapId: 'micro',
          spawn: 'inicio',
          ride: this.rideId,
          resume: true,
        });
      }
    });
  }

  finish(): void {
    this.active = false;
    this.isChangingView = false;
    this.exiting = false;
    this.emitStatus();
  }
}

export const BusRideManager = new BusRideManagerImpl();
