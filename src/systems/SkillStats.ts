import type { FutbolResult } from '../scenes/FutbolScene';
import type { NatacionResult } from '../scenes/NatacionScene';
import type { PinponResult } from '../scenes/PinponScene';
import type { SalsaResult } from '../scenes/SalsaScene';
import { STORAGE_KEYS } from './storageKeys';

const SKILLS_KEY = STORAGE_KEYS.skills;
/** Tope de cada stat. */
export const STAT_MAX = 100;

/** Lo que deja una partida de un minijuego: cuánto sube cada stat, los contadores y una línea para el historial. */
interface Play {
  stats: Record<string, number>;
  counters: Record<string, number>;
  /** Récords que se guardan como máximo (no se suman). */
  best?: Record<string, number>;
  /** Resumen corto de cómo te fue ("2-1 · 1 gol"). */
  line: string;
  /** Para quedarse con la mejor partida de cada misión. */
  score: number;
}

interface Labeled {
  id: string;
  name: string;
}

interface SkillDef {
  id: string;
  /** Escena del minijuego (la clave con que lo abre MapScene). */
  scene: string;
  name: string;
  /** Color de la barra. */
  color: number;
  stats: Labeled[];
  counters: Labeled[];
  best: Array<Labeled & { suffix?: string }>;
  /** Título de cada nivel (índice 0 = nivel 1), para la pantalla de subida de nivel. */
  ranks: string[];
  play(result: unknown): Play | null;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * Los minijuegos que vuelven en varias misiones. Cada partida sube sus stats según cómo te fue (con
 * rendimientos decrecientes: cuesta más subir cuando ya vas alto).
 */
export const SKILLS: SkillDef[] = [
  {
    id: 'futbol',
    scene: 'Futbol',
    name: 'Fútbol',
    color: 0x3c9c58,
    stats: [
      { id: 'definicion', name: 'Definición' },
      { id: 'vision', name: 'Visión de juego' },
      { id: 'garra', name: 'Garra' },
    ],
    counters: [
      { id: 'partidos', name: 'Partidos' },
      { id: 'ganados', name: 'Ganados' },
      { id: 'goles', name: 'Goles tuyos' },
    ],
    best: [{ id: 'goles', name: 'Récord de goles' }],
    ranks: ['Hincha de sofá', 'Potrero', 'Aficionado', 'Suplente', 'Titular', 'Crack del barrio', 'Goleador', 'Capitán', 'Estrella', 'Leyenda del fútbol'],
    play: (raw) => {
      const r = raw as FutbolResult;
      const won = r.us > r.them;
      const draw = r.us === r.them;
      const assisted = Math.max(0, r.us - r.myGoals);
      return {
        stats: {
          definicion: Math.min(30, r.myGoals * 10),
          vision: Math.min(24, 4 + assisted * 6),
          garra: won ? 20 : draw ? 12 : 5,
        },
        counters: { partidos: 1, ganados: won ? 1 : 0, goles: r.myGoals },
        best: { goles: r.myGoals },
        line: `${r.us}-${r.them} · ${plural(r.myGoals, 'gol tuyo', 'goles tuyos')}`,
        score: (r.us - r.them) * 10 + r.myGoals * 5 - r.ownGoals * 5,
      };
    },
  },
  {
    id: 'natacion',
    scene: 'Natacion',
    name: 'Natación',
    color: 0x2aa8bc,
    stats: [
      { id: 'tecnica', name: 'Técnica' },
      { id: 'flote', name: 'Flote' },
      { id: 'velocidad', name: 'Velocidad' },
    ],
    counters: [
      { id: 'clases', name: 'Clases' },
      { id: 'carreras', name: 'Carreras ganadas' },
      { id: 'perfectas', name: 'Clases perfectas' },
    ],
    best: [{ id: 'ejercicios', name: 'Mejor clase', suffix: '/5' }],
    ranks: ['Mojado de pies', 'Flotador', 'Chapoteador', 'Nadador', 'Crol decente', 'Delfín', 'Corriente a favor', 'Tritón', 'Campeón de la piscina', 'Marco Polo legendario'],
    play: (raw) => {
      const r = raw as NatacionResult;
      return {
        stats: {
          tecnica: r.lessons * 5 + (r.perfect ? 8 : 0),
          flote: r.held ? 20 : 6,
          velocidad: r.wonRace ? 22 : 8,
        },
        counters: { clases: 1, carreras: r.wonRace ? 1 : 0, perfectas: r.perfect ? 1 : 0 },
        best: { ejercicios: r.lessons },
        line: `${r.lessons}/5 ejercicios${r.wonRace ? ' · ganaste la carrera' : ''}${r.perfect ? ' · perfecta' : ''}`,
        score: r.lessons * 10 + (r.wonRace ? 20 : 0) + (r.held ? 10 : 0) + (r.perfect ? 15 : 0),
      };
    },
  },
  {
    id: 'salsa',
    scene: 'Salsa',
    name: 'Salsa',
    color: 0xe8607a,
    stats: [
      { id: 'ritmo', name: 'Ritmo' },
      { id: 'estilo', name: 'Estilo' },
      { id: 'soltura', name: 'Soltura' },
    ],
    counters: [
      { id: 'bailes', name: 'Bailes' },
      { id: 'pasos', name: 'Pasos acertados' },
      { id: 'perfectos', name: 'Bailes perfectos' },
    ],
    best: [{ id: 'precision', name: 'Mejor precisión', suffix: '%' }],
    ranks: ['Pie de palo', 'Cuenta hasta ocho', 'Pasito básico', 'Con el ritmo', 'Bailarín de barrio', 'Sabor caleño', 'Rumbero', 'Maestro de la pista', 'Rey del son', 'Leyenda de Cali'],
    play: (raw) => {
      const r = raw as SalsaResult;
      const acc = r.notes > 0 ? r.hits / r.notes : 0;
      const rounds = r.total > 0 ? r.score / r.total : 0;
      const pct = Math.round(acc * 100);
      return {
        stats: {
          ritmo: Math.round(25 * acc),
          estilo: r.perfect ? 25 : Math.round(18 * rounds),
          soltura: 10 + (rounds >= 0.5 ? 6 : 0),
        },
        counters: { bailes: 1, pasos: r.hits, perfectos: r.perfect ? 1 : 0 },
        best: { precision: pct },
        line: `${r.score}/${r.total} rondas · ${pct}% de pasos`,
        score: pct + (r.perfect ? 20 : 0),
      };
    },
  },
  {
    id: 'pinpon',
    scene: 'Pinpon',
    name: 'Pimpón',
    color: 0xf0a030,
    stats: [
      { id: 'remate', name: 'Remate' },
      { id: 'reflejos', name: 'Reflejos' },
      { id: 'temple', name: 'Temple' },
    ],
    counters: [
      { id: 'ganados', name: 'Partidos ganados' },
      { id: 'titulos', name: 'Títulos' },
      { id: 'remates', name: 'Remates que entraron' },
    ],
    best: [{ id: 'remates', name: 'Récord de remates' }],
    ranks: ['Novato de mesa', 'Paleta firme', 'Devuelve todas', 'Efecto y malicia', 'Remate seguro', 'Reflejos de gato', 'Terror de la mesa', 'Campeón de oficina', 'Maestro de la paleta', 'Leyenda del pimpón'],
    play: (raw) => {
      const r = raw as PinponResult;
      return {
        stats: {
          remate: Math.min(30, r.smashes * 5),
          reflejos: Math.min(30, 6 + r.wins * 8),
          temple: (r.champion ? 20 : 6) + (r.beatRichi ? 6 : 0),
        },
        counters: { ganados: r.wins, titulos: r.champion ? 1 : 0, remates: r.smashes },
        best: { remates: r.smashes },
        line: `${plural(r.wins, 'partido ganado', 'partidos ganados')}${r.champion ? ' · campeón' : ''} · ${plural(r.smashes, 'remate', 'remates')}`,
        score: r.wins * 20 + (r.champion ? 20 : 0) + r.smashes * 3,
      };
    },
  },
];

export interface SkillRecord {
  plays: number;
  stats: Record<string, number>;
  counters: Record<string, number>;
  best: Record<string, number>;
  /** La mejor partida de cada misión (id de misión → resumen). */
  missions: Record<string, { line: string; score: number }>;
}

/** Lo que subió en una partida (para avisarlo al volver al mapa). */
export interface SkillGain {
  skill: SkillDef;
  ups: Array<{ name: string; by: number }>;
  /** Todas las stats del minijuego antes y después (para las barras de la pantalla de nivel). */
  rows: Array<{ name: string; before: number; after: number }>;
  levelBefore: number;
  levelAfter: number;
}

/** Lo que necesita la pantalla de subida de nivel (viaja por el evento 'skill-gain'). */
export interface LevelUpInfo {
  skillId: string;
  name: string;
  color: number;
  level: number;
  rank: string;
  rows: SkillGain['rows'];
}

/** Arma lo de la pantalla de nivel a partir de una partida que subió de nivel. */
export function levelUpInfo(gain: SkillGain): LevelUpInfo {
  const { skill, levelAfter } = gain;
  return {
    skillId: skill.id,
    name: skill.name,
    color: skill.color,
    level: levelAfter,
    rank: skill.ranks[Math.min(levelAfter, skill.ranks.length) - 1] ?? '',
    rows: gain.rows,
  };
}

/** Cuánto sube de verdad un stat que está en `v` con una ganancia `gain`: menos mientras más alto vas. */
export function applyGain(v: number, gain: number): number {
  if (gain <= 0 || v >= STAT_MAX) return v;
  const eff = Math.max(1, Math.round(gain * (1 - v / (STAT_MAX * 1.4))));
  return Math.min(STAT_MAX, v + eff);
}

/** Nivel del minijuego (1..10) según el promedio de sus stats. */
export function skillLevel(def: SkillDef, rec: SkillRecord): number {
  const avg = def.stats.reduce((s, st) => s + (rec.stats[st.id] ?? 0), 0) / def.stats.length;
  return Math.min(10, 1 + Math.floor(avg / 10));
}

/**
 * Stats de los minijuegos que se repiten (pantalla "Estadísticas" del título). Como el registro de
 * Progreso, va en su propia clave de localStorage: una partida nueva no lo borra.
 */
class SkillStatsImpl {
  private data: Record<string, SkillRecord> | null = null;

  /** El registro de un minijuego (vacío si nunca se jugó). */
  get(id: string): SkillRecord {
    const all = this.load();
    all[id] ??= emptyRecord();
    return all[id];
  }

  /** Anota una partida del minijuego de la escena `scene` en la misión `missionId`. Null si no lleva stats. */
  record(scene: string, missionId: string, result: unknown): SkillGain | null {
    const def = SKILLS.find((s) => s.scene === scene);
    if (!def || !result) return null;
    const play = def.play(result);
    if (!play) return null;
    const rec = this.get(def.id);
    const levelBefore = skillLevel(def, rec);
    const ups: SkillGain['ups'] = [];
    const rows: SkillGain['rows'] = [];
    for (const st of def.stats) {
      const before = rec.stats[st.id] ?? 0;
      const after = applyGain(before, play.stats[st.id] ?? 0);
      rec.stats[st.id] = after;
      rows.push({ name: st.name, before, after });
      if (after > before) ups.push({ name: st.name, by: after - before });
    }
    for (const [k, n] of Object.entries(play.counters)) rec.counters[k] = (rec.counters[k] ?? 0) + n;
    for (const [k, n] of Object.entries(play.best ?? {})) rec.best[k] = Math.max(rec.best[k] ?? 0, n);
    rec.plays += 1;
    const prev = rec.missions[missionId];
    if (!prev || play.score >= prev.score) rec.missions[missionId] = { line: play.line, score: play.score };
    this.save();
    return { skill: def, ups, rows, levelBefore, levelAfter: skillLevel(def, rec) };
  }

  private load(): Record<string, SkillRecord> {
    this.data ??= readSkills();
    return this.data;
  }

  private save(): void {
    try {
      window.localStorage.setItem(SKILLS_KEY, JSON.stringify(this.data));
    } catch {
      // Sin almacenamiento: las stats duran esta sesión.
    }
  }
}

function emptyRecord(): SkillRecord {
  return { plays: 0, stats: {}, counters: {}, best: {}, missions: {} };
}

function readSkills(): Record<string, SkillRecord> {
  try {
    const raw = window.localStorage.getItem(SKILLS_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, Partial<SkillRecord>>;
    return Object.fromEntries(Object.entries(data).map(([id, r]) => [id, { ...emptyRecord(), ...r }]));
  } catch {
    return {};
  }
}

export const SkillStats = new SkillStatsImpl();
