import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import ridesData from '../data/rides.json';
import type { MapRef, RideDef, RideProgress } from '../types/mission';
import { BusRideManager } from './BusRideManager';
import { Dialogue } from './DialogueManager';
import { EventSystem } from './EventSystem';
import { advanceClock, formatClock, parseClock } from './Mission';
import { StoryState } from './StoryState';

/** `endStop`: nombre de la estación/parada a la que llega el viaje si nadie se baja (pantalla de recorrido). */
type RideData = RideDef & { endStop?: string };

export const RIDES = ridesData as Record<string, RideData>;

/** Flags temporales (con "_" no se guardan) que leen los diálogos de puertas y timbre. */
export const FLAG_DOORS_OPEN = '_puertas_abiertas';
export const FLAG_STOP_REQUESTED = '_timbre';
/** Metro: las puertas están abiertas en una parada con `final: true` (la que sirve). */
export const FLAG_FINAL_STOP = '_parada_final';

/** La escena que corre el viaje (InteriorScene). */
type RideHost = Phaser.Scene & { goTo(map: string, spawn: string): void };

/**
 * Corre un viaje en metro o micro dentro de una escena Interior.
 * El tiempo del viaje se detiene mientras hay un diálogo abierto.
 * En metro, la pantalla LED del vagón (evento 'ride-progress') reemplaza a los carteles.
 */
export class RideController {
  private exited = false;
  private stopIndex = -1;
  private readonly progressStops: string[];

  constructor(
    private readonly host: RideHost,
    private readonly ride: RideData,
  ) {
    this.progressStops = [...ride.stops.map((s) => s.name), ...(ride.endStop ? [ride.endStop] : [])];
    StoryState.setFlag(FLAG_DOORS_OPEN, false);
    StoryState.setFlag(FLAG_STOP_REQUESTED, false);
    EventSystem.onScene(host, 'story', ({ name }) => {
      if (name === 'ride_exit') this.exitAtCurrentStop();
    });
  }

  async run(): Promise<void> {
    const { ride } = this;
    const metro = ride.type === 'metro';
    const startIdx = metro ? 0 : Math.min(BusRideManager.stopIndex, ride.stops.length - 1);
    // En micro, al volver de la vista exterior no se repiten la salida ni el diálogo de subida.
    const fresh = metro || !BusRideManager.departed;
    this.progress(startIdx, 'moving');

    // Subiste con las puertas abiertas: suena el aviso de cierre y se cierran.
    await this.activeWait(600);
    if (this.exited || BusRideManager.isChangingView) return;
    if (ride.departAt && fresh) {
      const at = parseClock(ride.departAt);
      if (StoryState.clock < at) {
        EventSystem.emit('banner', { title: `Sale a las ${formatClock(at)}`, subtitle: ride.line });
        await advanceClock(at, 2600, (ms) => this.activeWait(ms));
      }
    }
    await this.doors(false);
    if (ride.startDialogue && fresh) await Dialogue.run(ride.startDialogue);
    if (!metro) BusRideManager.departed = true;
    playSfx(metro ? 'train-depart' : 'bus-pass');

    for (let i = startIdx; i < ride.stops.length; i++) {
      if (this.exited || BusRideManager.isChangingView) return;
      const stop = ride.stops[i];
      this.stopIndex = i;
      if (!metro) BusRideManager.stopIndex = i;
      Dialogue.vars.set('estacion', stop.name);
      this.progress(i, 'moving');
      if (!metro) EventSystem.emit('banner', { title: `Próxima parada: ${stop.name}`, subtitle: ride.line });
      await this.travel(ride.travelMs, stop.clock ? parseClock(stop.clock) : stop.minutes !== undefined ? StoryState.clock + stop.minutes : undefined);
      if (this.exited || BusRideManager.isChangingView) return;

      if (metro) {
        this.progress(i, 'stopped');
        if (ride.announce) EventSystem.emit('banner', { title: `Estación ${stop.name}`, subtitle: ride.line });
        await this.doors(true);
        StoryState.setFlag(FLAG_DOORS_OPEN, true);
        StoryState.setFlag(FLAG_FINAL_STOP, Boolean(stop.final));
        if (stop.dialogue) {
          await Dialogue.run(stop.dialogue);
          if (this.exited) return;
        }
        await this.activeWait(stop.doorsMs ?? ride.doorsMs ?? 6000);
        if (this.exited) return;
        StoryState.setFlag(FLAG_DOORS_OPEN, false);
        StoryState.setFlag(FLAG_FINAL_STOP, false);
        await this.doors(false);
        if (this.exited) return;
        playSfx('train-depart');
      } else if (StoryState.hasFlag(FLAG_STOP_REQUESTED) || (i === ride.stops.length - 1 && stop.final)) {
        BusRideManager.exiting = true;
        this.progress(i, 'stopped');
        playSfx('bus-brake');
        EventSystem.emit('banner', { title: `Parada ${stop.name}`, subtitle: stop.final ? 'Terminal Costanera' : 'Te bajas de la micro' });
        await this.activeWait(1100);
        await this.doors(true);
        await this.activeWait(500);
        this.leave(stop.exit, !stop.final);
        return;
      }
    }

    if (this.exited || BusRideManager.isChangingView) return;
    this.progress(ride.stops.length, 'moving');
    if (!metro || !ride.endStop) EventSystem.emit('banner', { title: ride.end.banner, subtitle: ride.line });
    await this.travel(ride.travelMs);
    if (this.exited || BusRideManager.isChangingView) return;
    if (ride.endStop) this.progress(ride.stops.length, 'stopped');
    await Dialogue.run(ride.end.dialogue);
    this.leave(ride.end.exit, ride.end.walked ?? false);
  }

  /**
   * Abre o cierra las puertas con su sonido (metro: aire + campanita / pitidos de cierre;
   * micro: pssshh + pitidos). La escena anima las hojas con el evento 'vehicle-doors'.
   */
  private async doors(open: boolean): Promise<void> {
    const metro = this.ride.type === 'metro';
    if (open) {
      playSfx(metro ? 'metro-doors-open' : 'bus-doors-open');
      EventSystem.emit('vehicle-doors', { open: true });
      await this.activeWait(450);
    } else {
      playSfx(metro ? 'metro-doors-close' : 'bus-doors-close');
      await this.activeWait(metro ? 1250 : 650);
      EventSystem.emit('vehicle-doors', { open: false });
      await this.activeWait(600);
    }
  }

  private exitAtCurrentStop(): void {
    const stop = this.ride.stops[this.stopIndex];
    if (!stop || this.exited || !StoryState.hasFlag(FLAG_DOORS_OPEN)) return;
    this.leave(stop.exit, !stop.final);
  }

  private leave(exit: MapRef, walked: boolean): void {
    if (this.exited) return;
    this.exited = true;
    BusRideManager.finish();
    StoryState.setFlag(FLAG_DOORS_OPEN, false);
    StoryState.setFlag(FLAG_STOP_REQUESTED, false);
    StoryState.setFlag(FLAG_FINAL_STOP, false);
    if (walked) StoryState.setFlag('bajo_antes');
    this.progress(Math.max(0, this.stopIndex), 'end');
    this.host.goTo(exit.map, exit.spawn);
  }

  private progress(index: number, state: RideProgress['state']): void {
    EventSystem.emit('ride-progress', {
      type: this.ride.type,
      line: this.ride.line,
      stops: this.progressStops,
      origin: this.ride.origin,
      color: this.ride.color,
      index: Math.min(index, this.progressStops.length - 1),
      state,
    });
  }

  /** Viaje entre paradas: traqueteo suave de cámara. Con `clockTo`, el reloj avanza hasta esa hora. */
  private async travel(ms: number, clockTo?: number): Promise<void> {
    const step = 300;
    const from = StoryState.clock;
    let shake = 0;
    for (let t = 0; t < ms && !this.exited && !BusRideManager.isChangingView; t += step) {
      if (shake <= 0 && this.host.sys.isActive()) {
        this.host.cameras.main.shake(180, 0.0015);
        shake = 900;
      }
      shake -= step;
      await this.activeWait(Math.min(step, ms - t));
      if (clockTo !== undefined && from < clockTo) StoryState.setClock(from + ((clockTo - from) * Math.min(ms, t + step)) / ms, clockTo);
    }
  }

  /** Espera `ms` contando solo el tiempo sin diálogos abiertos. */
  private activeWait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      let left = ms;
      const timer = this.host.time.addEvent({
        delay: 50,
        loop: true,
        callback: () => {
          if (!Dialogue.active) left -= 50;
          if (left <= 0 || this.exited || BusRideManager.isChangingView) {
            timer.remove();
            resolve();
          }
        },
      });
    });
  }
}

