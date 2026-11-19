/**
 * Retos del «Concurso de caras» (prueba de admin con la cámara). Es lógica pura, sin cámara ni Phaser:
 * recibe los blendshapes de MediaPipe (nombre → 0..1) y devuelve qué tan bien está hecha la cara pedida.
 *
 * Cada reto devuelve un puntaje normalizado 0..1 (1 = cara bien hecha). Se «pasa» al mantener
 * `PASS_SCORE` durante `holdMs`. Los valores de referencia (`ref`) son lo que da una cara exagerada
 * pero normal: se ajustan a ojo en el probador de la escena (muestra los números en vivo).
 */

/** Blendshapes de una cara: nombre de MediaPipe → intensidad 0..1. */
export type Shapes = Readonly<Record<string, number>>;

export type FaceId = 'sonrisa' | 'boca' | 'cejas' | 'guino' | 'besito' | 'mejillas' | 'poker';

export interface FaceChallenge {
  id: FaceId;
  /** Lo que se lee en grande. */
  title: string;
  /** La broma de abajo: cómo hacer la cara. */
  hint: string;
  /** Los blendshapes que mira (para mostrarlos en el probador). */
  keys: readonly string[];
  /** Cuánto hay que sostenerla (ms): la de póker pide más. */
  holdMs: number;
  score: (s: Shapes) => number;
}

/** Puntaje mínimo para dar por buena una cara. */
export const PASS_SCORE = 0.85;
/** Tiempo sostenida por defecto (ms). */
export const HOLD_MS = 600;
/** Tiempo para hacer cada cara (ms). */
export const ROUND_MS = 6000;

const v = (s: Shapes, key: string): number => s[key] ?? 0;
const avg = (...n: number[]): number => n.reduce((a, b) => a + b, 0) / n.length;
export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
/** Lleva `value` a 0..1 tomando `ref` como «al máximo». */
const norm = (value: number, ref: number): number => clamp01(value / ref);

export const FACE_CHALLENGES: readonly FaceChallenge[] = [
  {
    id: 'sonrisa',
    title: '¡SONRISA!',
    hint: 'Como en la foto del carné... pero de verdad.',
    keys: ['mouthSmileLeft', 'mouthSmileRight'],
    holdMs: HOLD_MS,
    score: (s) => norm(avg(v(s, 'mouthSmileLeft'), v(s, 'mouthSmileRight')), 0.55),
  },
  {
    id: 'boca',
    title: '¡BOCA ABIERTA!',
    hint: 'La cara de ver el precio de la matrícula.',
    keys: ['jawOpen'],
    holdMs: HOLD_MS,
    score: (s) => norm(v(s, 'jawOpen'), 0.45),
  },
  {
    id: 'cejas',
    title: '¡CEJAS ARRIBA!',
    hint: '«¿Es para mañana? ¿En serio, parce?»',
    keys: ['browInnerUp', 'browOuterUpLeft', 'browOuterUpRight'],
    holdMs: HOLD_MS,
    score: (s) => norm(avg(v(s, 'browInnerUp'), v(s, 'browOuterUpLeft'), v(s, 'browOuterUpRight')), 0.6),
  },
  {
    id: 'guino',
    title: '¡UN GUIÑO!',
    hint: 'Un ojo cerrado y el otro bien abierto.',
    keys: ['eyeBlinkLeft', 'eyeBlinkRight'],
    holdMs: HOLD_MS,
    // Da igual cuál ojo (el espejo confunde): uno tiene que cerrarse y el otro quedarse abierto.
    score: (s) => {
      const a = v(s, 'eyeBlinkLeft');
      const b = v(s, 'eyeBlinkRight');
      return norm(Math.max(a, b) - Math.min(a, b) * 1.5, 0.6);
    },
  },
  {
    id: 'besito',
    title: '¡UN BESITO!',
    hint: 'Boca de piquito, como despedida de tía.',
    keys: ['mouthPucker', 'mouthFunnel'],
    holdMs: HOLD_MS,
    score: (s) => norm(v(s, 'mouthPucker') - avg(v(s, 'mouthSmileLeft'), v(s, 'mouthSmileRight')) * 0.5, 0.55),
  },
  {
    id: 'mejillas',
    title: '¡MEJILLAS INFLADAS!',
    hint: 'Como si guardaras un pandebono entero.',
    keys: ['cheekPuff'],
    holdMs: HOLD_MS,
    score: (s) => norm(v(s, 'cheekPuff'), 0.4),
  },
  {
    id: 'poker',
    title: '¡CARA DE PÓKER!',
    hint: 'Cero gestos. Te están hablando de impuestos.',
    keys: ['mouthSmileLeft', 'mouthSmileRight', 'jawOpen', 'browInnerUp', 'mouthPucker'],
    holdMs: 1400,
    // Cualquier gesto la arruina: el puntaje es lo que le falta al más marcado.
    score: (s) => {
      const smile = avg(v(s, 'mouthSmileLeft'), v(s, 'mouthSmileRight')) / 0.35;
      const jaw = v(s, 'jawOpen') / 0.25;
      const brow = v(s, 'browInnerUp') / 0.4;
      const pucker = v(s, 'mouthPucker') / 0.4;
      return clamp01(1 - Math.max(smile, jaw, brow, pucker));
    },
  },
];

export function challengeById(id: FaceId): FaceChallenge {
  const c = FACE_CHALLENGES.find((f) => f.id === id);
  if (!c) throw new Error(`Reto de cara desconocido: ${id}`);
  return c;
}

/**
 * Cuánto lleva sostenida la cara: suma mientras el puntaje alcanza y, si se pierde, baja al doble de rápido
 * (un parpadeo del detector no te borra todo el progreso).
 */
export function advanceHold(heldMs: number, score: number, dtMs: number, holdMs: number): number {
  return Math.min(holdMs, score >= PASS_SCORE ? heldMs + dtMs : Math.max(0, heldMs - dtMs * 2));
}

/** Puntos de una cara lograda: 100 por hacerla + hasta 100 por la rapidez (lo que sobró del tiempo). */
export function roundPoints(remainingMs: number, limitMs: number = ROUND_MS): number {
  return 100 + Math.round(100 * clamp01(remainingMs / limitMs));
}

/** `count` retos distintos al azar (`rng` se puede fijar para probar). */
export function pickChallenges(count: number, rng: () => number = Math.random): FaceChallenge[] {
  const pool = [...FACE_CHALLENGES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

/** El veredicto final según los puntos (de un máximo de `rounds` × 200). */
export function verdict(points: number, rounds: number): string {
  const ratio = points / Math.max(1, rounds * 200);
  if (ratio >= 0.8) return '¡Rostro de telenovela! El jurado llora.';
  if (ratio >= 0.55) return 'Buen rostro. Con un poco más de teatro, a la tele.';
  if (ratio >= 0.25) return 'Cara de ensayo. El jurado levanta una ceja.';
  return 'Cara de póker... sin querer. El jurado bosteza.';
}

// ─── Controles con la cabeza (Pimpón con cámara) ────────────────────────────────────────────────────

/** Cuánto hay que mover la cabeza (fracción del ancho del cuadro) desde el centro para llegar a cada extremo de la mesa. */
export const HEAD_RANGE = 0.16;
/** Boca abierta (jawOpen) que dispara el remate, y lo que hay que cerrar para poder volver a dispararlo. */
export const SMASH_OPEN = 0.5;
export const SMASH_CLOSE = 0.25;

/** Dónde queda la paleta (entre `min` y `max`) según la cabeza: en `center` va al medio. */
export function headToPaddle(headX: number, center: number, min: number, max: number): number {
  const t = clamp01((headX - center) / (HEAD_RANGE * 2) + 0.5);
  return min + t * (max - min);
}

/**
 * Remate con la boca: dispara una vez al abrirla (`fired`) y no vuelve a disparar hasta que la cierres.
 * `open` es el estado que se pasa de vuelta en la siguiente lectura.
 */
export function smashEdge(jawOpen: number, wasOpen: boolean): { open: boolean; fired: boolean } {
  if (!wasOpen && jawOpen >= SMASH_OPEN) return { open: true, fired: true };
  if (wasOpen && jawOpen <= SMASH_CLOSE) return { open: false, fired: false };
  return { open: wasOpen, fired: false };
}

/**
 * El centro de la cabeza que hace que, con la cabeza en `headX`, la paleta quede justo en `paddleX`: se usa cuando
 * el jugador mueve la paleta con el teclado, para que al soltarlo la cámara siga desde ahí sin pegar un salto.
 */
export function rebaseCenter(headX: number, paddleX: number, min: number, max: number): number {
  const t = max > min ? clamp01((paddleX - min) / (max - min)) : 0.5;
  return headX - (t - 0.5) * 2 * HEAD_RANGE;
}
