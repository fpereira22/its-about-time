import type { MapSceneData } from '../scenes/MapScene';
import type { Direction } from '../types/map';
import { BusRideManager } from './BusRideManager';
import { GameMap } from './GameMap';
import { formatDayClock, getMission, hasStoryClock, missionLabel, MISSIONS } from './Mission';
import { Phone } from './Phone';
import { Secrets } from './Secrets';
import { formatTime, StoryState, type SaveData } from './StoryState';

const SLOTS_KEY = 'santiago-laberinto:slots';
export const SLOT_COUNT = 3;

const SCENE_FOR_KIND = { overworld: 'Overworld', interior: 'Interior' } as const;

interface SlotData {
  state: SaveData;
  pos: { x: number; y: number; facing: Direction };
  /** Zona o mapa donde se guardó (solo para mostrar). */
  place: string;
  /** Fecha real (ms). */
  savedAt: number;
}

/** Lo que se muestra de un espacio ocupado. */
export interface SlotSummary {
  mission: string;
  place: string;
  /** "mar 18:57" en misiones con reloj; si no, vacío. */
  clock: string;
  playTime: string;
  savedAt: string;
}

/**
 * Espacios de guardado manuales, como los "save states" de un emulador: guardan la partida
 * entera más el tile exacto y hacia dónde mira el jugador. Aparte de la partida automática
 * (Continuar), que sigue guardándose sola. Solo se guarda con el jugador libre en un mapa
 * (no en diálogos, viajes ni minijuegos): ver MapScene.saveBlockedReason.
 */
class SaveSlotsImpl {
  private slots: Array<SlotData | null> = readSlots();

  get any(): boolean {
    return this.slots.some((s) => s !== null);
  }

  summary(i: number): SlotSummary | null {
    const s = this.slots[i];
    if (!s) return null;
    const m = MISSIONS.find((x) => x.id === s.state.mission) ?? MISSIONS[0];
    return {
      mission: `${missionLabel(m)}: ${m.title}`,
      place: s.place,
      clock: hasStoryClock(m) && s.state.clock ? formatDayClock(s.state.clock) : '',
      playTime: formatTime(s.state.playTimeMs),
      savedAt: new Date(s.savedAt).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    };
  }

  save(i: number, spot: { map: string; spawn: string; place: string; pos: SlotData['pos'] }): boolean {
    const state = StoryState.snapshot();
    state.location = { map: spot.map, spawn: spot.spawn };
    this.slots[i] = { state, pos: spot.pos, place: spot.place, savedAt: Date.now() };
    return this.write();
  }

  /**
   * Carga el espacio `i` en StoryState y devuelve a qué escena ir. Null si está vacío o no sirve
   * (el mapa ya no existe, versión de guardado vieja).
   */
  load(i: number): { scene: string; data: Partial<MapSceneData> } | null {
    const s = this.slots[i];
    const loc = s?.state.location;
    if (!s || !loc) return null;
    let scene: string;
    try {
      const map = GameMap.get(loc.map);
      getMission(s.state.mission ?? 'mission01');
      scene = SCENE_FOR_KIND[map.data.kind];
    } catch {
      return null;
    }
    // Copia: jugar después de cargar no debe tocar el espacio guardado.
    if (!StoryState.restore(structuredClone(s.state))) return null;
    // Lo que vive fuera de StoryState y no debe pasar de la partida anterior.
    if (BusRideManager.active) BusRideManager.finish();
    Phone.reset();
    Secrets.syncNewGame();
    return { scene, data: { mapId: loc.map, spawn: loc.spawn, pos: s.pos } };
  }

  private write(): boolean {
    try {
      window.localStorage.setItem(SLOTS_KEY, JSON.stringify(this.slots));
      return true;
    } catch {
      return false;
    }
  }
}

function readSlots(): Array<SlotData | null> {
  const empty = Array.from({ length: SLOT_COUNT }, () => null);
  try {
    const raw = window.localStorage.getItem(SLOTS_KEY);
    if (!raw) return empty;
    const data = JSON.parse(raw) as Array<SlotData | null>;
    return empty.map((_, i) => data[i] ?? null);
  } catch {
    return empty;
  }
}

export const SaveSlots = new SaveSlotsImpl();
