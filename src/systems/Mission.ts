import type { MissionDef, MissionDestination } from '../types/mission';
import { check } from './Conditions';
import { formatTime, ITEMS, StoryState } from './StoryState';

const missionModules = import.meta.glob<MissionDef>('../data/missions/*.json', { eager: true, import: 'default' });

/** Todas las misiones (src/data/missions/*.json), ordenadas por número. */
export const MISSIONS: MissionDef[] = Object.values(missionModules).sort((a, b) => a.number - b.number);

const byId = new Map(MISSIONS.map((m) => [m.id, m]));

export function getMission(id: string): MissionDef {
  const m = byId.get(id);
  if (!m) throw new Error(`Misión "${id}" no existe. Disponibles: ${[...byId.keys()].join(', ')}`);
  return m;
}

/** La misión de la partida en curso (o la 1 si la partida guardada apunta a una que ya no existe). */
export function currentMission(): MissionDef {
  return byId.get(StoryState.missionId) ?? MISSIONS[0];
}

/**
 * Cómo se llama la misión en pantalla. La 1 es el prólogo (el tutorial), así que las demás se
 * muestran corridas en uno: mission02 es "Misión 1". Los ids y `number` internos no cambian.
 */
export function missionLabel(m: MissionDef): string {
  return m.number === 1 ? 'Prólogo' : `Misión ${m.number - 1}`;
}

/** "Prólogo: De Baquedano al Costanera", "Misión 1: La prueba de Optimización"... */
export function missionFullLabel(m: MissionDef): string {
  return `${missionLabel(m)}: ${m.title}`;
}

/** Destino del mapa del celular para la etapa actual de la misión. */
export function currentDestination(m: MissionDef = currentMission()): MissionDestination | undefined {
  return m.destinations?.find((d) => check(d.if)) ?? m.destination;
}

// ---------------------------------------------------------------------------
// Reloj de la historia
// ---------------------------------------------------------------------------

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
/** Misiones sin reloj propio: el celular marca 17:32 al empezar (la mamá cita a las 6). */
const DEFAULT_START_MINUTES = 17 * 60 + 32;

/**
 * "lun 07:15" → minutos desde el domingo 00:00. Sin día ("07:15"), usa el día de `relativeTo`.
 * Con "+" después del día ("dom+ 20:00"), es ese día de la semana siguiente (viajes que cruzan el domingo).
 */
export function parseClock(text: string, relativeTo = StoryState.clock): number {
  const m = /^\s*(?:([a-záéíóú]{3})(\+?)\s+)?(\d{1,2}):(\d{2})\s*$/i.exec(text);
  if (!m) {
    console.error(`Hora inválida "${text}" (usa "lun 07:15" o "07:15")`);
    return relativeTo;
  }
  const idx = m[1] ? DAYS.indexOf(m[1].toLowerCase()) : 0;
  if (idx < 0) console.error(`Día inválido en "${text}" (usa ${DAYS.join(', ')})`);
  const day = m[1] ? Math.max(0, idx) + (m[2] ? 7 : 0) : Math.floor(relativeTo / 1440);
  return Math.max(0, day) * 1440 + Number(m[3]) * 60 + Number(m[4]);
}

/** ¿La misión usa la hora del día en vez del cronómetro? */
export function hasStoryClock(m: MissionDef = currentMission()): boolean {
  return m.clock !== undefined;
}

/** Hora del celular en minutos (reloj de la historia, o 17:32 + tiempo de partida). */
export function clockMinutes(playMs = StoryState.playTimeMs): number {
  if (hasStoryClock()) return StoryState.clock;
  return DEFAULT_START_MINUTES + playMs / 60000;
}

/**
 * Adelanta el reloj de la historia hasta `to` en `ms` reales: la "simulación" de una espera
 * (ej. el tren que llega a las 7:20). `wait` es el temporizador de la escena.
 */
export async function advanceClock(to: number, ms: number, wait: (ms: number) => Promise<void>): Promise<void> {
  const from = StoryState.clock;
  if (from >= to) return;
  const steps = Math.max(1, Math.round(ms / 80));
  for (let i = 1; i <= steps; i++) {
    StoryState.setClock(from + ((to - from) * i) / steps, to);
    await wait(ms / steps);
  }
}

/** "07:15" */
export function formatClock(minutes: number): string {
  const m = Math.floor(minutes);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "LUN 07:15" (reloj del HUD en misiones con hora del día). */
export function formatDayClock(minutes: number): string {
  return `${DAYS[Math.floor(minutes / 1440) % 7].toUpperCase()} ${formatClock(minutes)}`;
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

export interface MissionSummary {
  title: string;
  time: string;
  route: string;
  collectibles: Array<{ id: string; name: string; icon: string; found: boolean }>;
  bonuses: string[];
  secrets: { found: number; total: number };
}

export function routeName(m: MissionDef = currentMission()): string {
  const used = m.routes.filter((r) => check(r.if)).map((r) => r.name);
  if (used.length === 0) return m.defaultRoute;
  const suffix = check(m.walkedSuffix.if) ? m.walkedSuffix.text : '';
  return used.join(' + ') + suffix;
}

export function missionSummary(m: MissionDef = currentMission()): MissionSummary {
  return {
    title: m.title,
    time: formatTime(StoryState.playTimeMs),
    route: routeName(m),
    collectibles: m.collectibles.map((id) => ({
      id,
      name: ITEMS[id]?.name ?? id,
      icon: ITEMS[id]?.icon ?? id,
      found: StoryState.hasItem(id),
    })),
    bonuses: m.bonuses.filter((b) => check(b.if)).map((b) => b.text),
    secrets: { found: m.secrets.filter((s) => StoryState.hasFlag(s.flag)).length, total: m.secrets.length },
  };
}
