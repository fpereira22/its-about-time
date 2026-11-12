import type { MusicTrack } from './sfx';
import { hat, kick, noteFreq, noteMidi, snare, tone } from './synth';

/**
 * Música chiptune original, escrita como patrones de 16 pasos (semicorcheas) por compás.
 *
 * Tokens de canal melódico: "C5", "F#4", "Bb3" = nota; "-" = sostener la nota anterior; "." = silencio.
 * Tokens de batería: "k" bombo, "s" caja, "h" hi-hat, "x" bombo+hat, "o" caja+hat, "." silencio.
 */

const STEPS_PER_BAR = 16;

type Wave = OscillatorType | 'drums';

interface ChannelDef {
  wave: Wave;
  vol: number;
  tokens: string[];
  /** Notas largas sostenidas (pads) en vez de "pluck". */
  sustain?: boolean;
}

export interface TrackDef {
  bpm: number;
  loop: boolean;
  /** Eco (0 = sin eco). */
  echo?: number;
  channels: ChannelDef[];
}

// ---------------------------------------------------------------------------
// Helpers de composición
// ---------------------------------------------------------------------------

function bars(...list: string[]): string[] {
  return list.flatMap((bar, i) => {
    const t = bar.trim().split(/\s+/);
    if (t.length !== STEPS_PER_BAR) throw new Error(`Compás ${i + 1} tiene ${t.length} pasos: "${bar}"`);
    return t;
  });
}

function repeat(bar: string, n: number): string[] {
  return bars(...Array<string>(n).fill(bar));
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiName(m: number): string {
  return `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
}

/** "Am" en octava 2 → [A2, C3, E3] como números MIDI. */
function chordMidi(chord: string, octave: number): [number, number, number] {
  const minor = chord.endsWith('m');
  const root = noteMidi(`${minor ? chord.slice(0, -1) : chord}${octave}`);
  return [root, root + (minor ? 3 : 4), root + 7];
}

type BassStyle = 'walk' | 'drone' | 'pulse' | 'octave' | 'twostep';

function bass(chords: string[], style: BassStyle, octave = 2): string[] {
  return chords.flatMap((c) => {
    const [r, third, fifth] = chordMidi(c, octave).map(midiName);
    const r8 = midiName(chordMidi(c, octave)[0] + 12);
    const bar = {
      walk: `${r} - . . ${r8} . ${fifth} - . . ${r} - ${third} . ${fifth} .`,
      drone: `${r} - - - - - - - ${fifth} - - - - - - -`,
      pulse: `${r} . ${r} . ${r} . ${r} . ${r} . ${r} . ${fifth} . ${r8} .`,
      octave: `${r} . ${r8} . ${r} . ${r8} . ${r} . ${r8} . ${r} . ${r8} .`,
      twostep: `${r} - - . ${fifth} - - . ${r} - - . ${fifth} - ${third} .`,
    }[style];
    return bars(bar);
  });
}

function arp(chords: string[], every: 1 | 2, octave = 4): string[] {
  return chords.flatMap((c) => {
    const [a, b, d] = chordMidi(c, octave);
    const tones = [a, b, d, a + 12].map(midiName);
    const out: string[] = [];
    for (let i = 0; i < STEPS_PER_BAR; i++) out.push(i % every === 0 ? tones[(i / every) % 4] : '.');
    return out;
  });
}

// ---------------------------------------------------------------------------
// Pistas
// ---------------------------------------------------------------------------

const TITLE_CHORDS = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'];
const STREET_CHORDS = ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'D'];
const STATION_CHORDS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'E', 'E'];
const TRAIN_CHORDS = ['Dm', 'Dm', 'A#', 'C', 'Dm', 'Dm', 'Gm', 'A'];
const BUS_CHORDS = ['F', 'C', 'Dm', 'A#', 'F', 'C', 'A#', 'C'];
const COMPLETE_CHORDS = ['C', 'F', 'G', 'C'];
const CREDITS_CHORDS = ['F', 'Am', 'A#', 'C', 'F', 'Dm', 'A#', 'C'];
const FAREWELL_CHORDS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E', 'F', 'G', 'Em', 'Am', 'Dm', 'Am', 'F', 'E'];
const AIRPORT_CHORDS = ['F', 'Em', 'Dm', 'C', 'F', 'Em', 'Dm', 'G'];
const SALSA_CHORDS = ['C', 'F', 'G', 'C', 'C', 'F', 'G', 'C'];
const CAMPUS_CHORDS = ['G', 'D', 'Em', 'C', 'G', 'D', 'Em', 'D'];
const FUTBOL_CHORDS = ['D', 'G', 'A', 'D', 'D', 'G', 'A', 'A'];
const ROOFTOP_CHORDS = ['Am', 'Dm', 'G', 'C', 'F', 'Dm', 'E', 'E'];
const BARBER_CHORDS = ['Am', 'Dm', 'E', 'Am', 'Am', 'Dm', 'E', 'E'];
const MORENADA_CHORDS = ['Dm', 'A', 'Dm', 'Gm', 'Dm', 'Gm', 'A', 'Dm'];
const PISCINA_CHORDS = ['Am', 'G', 'F', 'C', 'Am', 'G', 'F', 'G'];
const SIRA_CHORDS = ['C', 'Am', 'Dm', 'G', 'C', 'Am', 'F', 'G'];
const BURGER_CHORDS = ['G', 'C', 'G', 'D', 'G', 'C', 'G', 'D'];
const FERIA_CHORDS = ['D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'D'];
const COLINA_CHORDS = ['Em', 'C', 'Am', 'B', 'Em', 'C', 'D', 'B'];
const PERSE_CHORDS = ['Am', 'Am', 'F', 'E', 'Am', 'Am', 'F', 'E'];
const NADO_CHORDS = ['F', 'C', 'Dm', 'A#', 'F', 'C', 'A#', 'C'];
const DEPA_CHORDS = ['F', 'Dm', 'A#', 'C', 'F', 'Dm', 'Gm', 'C'];
const ASCENSOR_CHORDS = ['C', 'Am', 'Dm', 'G', 'C', 'Am', 'Dm', 'G'];
const COCINA_CHORDS = ['G', 'C', 'D', 'G', 'Em', 'C', 'D', 'G'];
const SALENTO_CHORDS = ['D', 'A', 'Bm', 'G', 'D', 'A', 'Em', 'A'];
const PARQUE_CHORDS = ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'C'];
const CHIVA_CHORDS = ['A', 'D', 'E', 'A', 'A', 'D', 'E', 'A'];
const DISCO_CHORDS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'];
const MARIACHI_CHORDS = ['D', 'A', 'A', 'D', 'D', 'G', 'A', 'D'];
const RECUERDO_CHORDS = ['F', 'Dm', 'A#', 'C', 'F', 'Am', 'A#', 'C'];

/** Bajo de cumbia: la fundamental en el 1 y la quinta en el 3, con un repique al final. */
function cumbiaBass(chords: string[]): string[] {
  return chords.flatMap((c) => {
    const [r, third, fifth] = chordMidi(c, 2).map(midiName);
    return bars(`${r} - . . ${r} . . . ${fifth} - . . ${fifth} . ${third} .`);
  });
}

/** Montuno de piano (salsa): el acorde picado a contratiempo. */
function montuno(chords: string[]): string[] {
  return chords.flatMap((c) => {
    const [a, b, d] = chordMidi(c, 4).map(midiName);
    return bars(`${a} . ${b} ${d} . ${a} . ${b} ${d} . ${a} . ${b} ${d} . ${b}`);
  });
}

/** Tumbao del bajo: anticipa el acorde en el "y" del 2 y en el 4. */
function tumbao(chords: string[]): string[] {
  return chords.flatMap((c) => {
    const [r, , fifth] = chordMidi(c, 2).map(midiName);
    return bars(`. . . . . . ${fifth} - . . . . ${r} - - -`);
  });
}

export const TRACKS: Record<MusicTrack, TrackDef> = {
  /** Misión 7, el depa del piso 8: bossa tranquila, el bajo caminando despacito y una melodía cálida. */
  depa: {
    bpm: 84,
    loop: true,
    echo: 0.2,
    channels: [
      {
        wave: 'triangle',
        vol: 0.12,
        tokens: bars(
          'A5 - - - C6 - A5 - G5 - - - F5 - - -',
          'F5 - - - A5 - - - D5 - - - . . . .',
          'D6 - - - C6 - A#5 - A5 - - - G5 - - -',
          'G5 - - - - - - - E5 - - - . . . .',
          'A5 - - - C6 - A5 - G5 - - - F5 - A5 -',
          'D6 - - - C6 - - - A5 - - - . . . .',
          'A#5 - - - A5 - G5 - F5 - - - G5 - - -',
          'E5 - - - - - - - C5 - - - . . . .',
        ),
      },
      { wave: 'square', vol: 0.014, tokens: arp(DEPA_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.15, tokens: bass(DEPA_CHORDS, 'twostep') },
      { wave: 'drums', vol: 0.04, tokens: repeat('k . h . . h k . h . k h . . h .', 8) },
    ],
  },

  /** Misión 7, esperando el ascensor (y adentro): la bossa de ascensor de toda la vida. */
  ascensor: {
    bpm: 96,
    loop: true,
    echo: 0.15,
    channels: [
      {
        wave: 'sine',
        vol: 0.14,
        tokens: bars(
          'E5 - G5 - C6 - - - B5 - A5 - G5 - - -',
          'A5 - - - E5 - - - . . . . . . . .',
          'F5 - A5 - D6 - - - C6 - B5 - A5 - - -',
          'B5 - - - G5 - - - . . . . . . . .',
          'E5 - G5 - C6 - - - E6 - D6 - C6 - - -',
          'A5 - - - C6 - - - . . . . . . . .',
          'D6 - C6 - B5 - A5 - G5 - - - F5 - - -',
          'G5 - - - - - - - . . . . . . . .',
        ),
      },
      { wave: 'square', vol: 0.012, tokens: arp(ASCENSOR_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.13, tokens: bass(ASCENSOR_CHORDS, 'twostep') },
      { wave: 'drums', vol: 0.035, tokens: repeat('k . h . h k h . k . h . h k h .', 8) },
    ],
  },

  /** Misión 7, la boloñesa con Sira: cumbia juguetona, con el bajo saltarín y palmas. */
  cocina: {
    bpm: 112,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.045,
        tokens: bars(
          'B5 . D6 . G6 - - . F#6 . E6 . D6 - - .',
          'E6 . G6 . C7 - - . B6 . A6 . G6 - - .',
          'A6 . F#6 . D6 - - . E6 . F#6 . A6 - - .',
          'G6 - - . D6 - - . B5 - - . . . . .',
          'B5 . D6 . G6 - - . A6 . B6 . G6 - - .',
          'C7 . B6 . A6 . G6 . E6 - - . . . . .',
          'D6 . E6 . F#6 . A6 . G6 . F#6 . E6 . D6 .',
          'G6 - - . . . B6 . G6 - - . . . . .',
        ),
      },
      { wave: 'triangle', vol: 0.18, tokens: cumbiaBass(COCINA_CHORDS) },
      { wave: 'square', vol: 0.014, tokens: arp(COCINA_CHORDS, 2, 4) },
      { wave: 'drums', vol: 0.07, tokens: repeat('k . h s k . h s k . h s k h s h', 8) },
    ],
  },


  /** Misión 8, Salento: pasillo con tiple, tranquilo y de montaña. */
  salento: {
    bpm: 100,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.045,
        tokens: bars(
          'F#5 - A5 - D6 - - - C#6 - B5 - A5 - - -',
          'E5 - A5 - C#6 - - - B5 - A5 - G5 - - -',
          'F#5 - B5 - D6 - - - C#6 - B5 - F#5 - - -',
          'G5 - B5 - D6 - E6 - D6 - B5 - G5 - - -',
          'A5 - F#5 - D5 - F#5 - A5 - D6 - F#6 - - -',
          'E6 - C#6 - A5 - C#6 - E6 - D6 - C#6 - - -',
          'B5 - G5 - E5 - G5 - B5 - A5 - G5 - E5 -',
          'A5 - - - C#6 - - - D6 - - - . . . .',
        ),
      },
      { wave: 'triangle', vol: 0.16, tokens: bass(SALENTO_CHORDS, 'twostep') },
      { wave: 'square', vol: 0.016, tokens: arp(SALENTO_CHORDS, 2, 4) },
      { wave: 'drums', vol: 0.04, tokens: repeat('k . . h . . s . k . . h . . s .', 8) },
    ],
  },

  /** El Parque del Café: organito de feria, brillante. */
  parque: {
    bpm: 132,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.05,
        tokens: bars(
          'E6 . G6 . C7 - - . G6 . E6 . C6 - - .',
          'F6 . A6 . C7 - - . A6 . F6 . C6 - - .',
          'G6 . B6 . D7 - - . B6 . G6 . D6 - - .',
          'E6 - G6 - C7 - - - . . . . . . . .',
          'A5 . C6 . E6 - - . C6 . A5 . E5 - - .',
          'F5 . A5 . C6 - - . D6 . E6 . F6 - - .',
          'G6 - F6 - E6 - D6 - B5 - D6 - G6 - - -',
          'C6 - - - E6 - - - C7 - - - . . . .',
        ),
      },
      { wave: 'triangle', vol: 0.16, tokens: bass(PARQUE_CHORDS, 'octave') },
      { wave: 'square', vol: 0.014, tokens: arp(PARQUE_CHORDS, 2, 4) },
      { wave: 'drums', vol: 0.05, tokens: repeat('k . h . s . h . k . h . s . h .', 8) },
    ],
  },

  /** La casita de los camarotes: guitarra suave, de noche. */
  casita: {
    bpm: 84,
    loop: true,
    echo: 0.2,
    channels: [
      {
        wave: 'triangle',
        vol: 0.11,
        tokens: bars(
          'B5 - - - D6 - - - B5 - A5 - G5 - - -',
          'G5 - - - B5 - - - E6 - D6 - B5 - - -',
          'C6 - - - E6 - - - D6 - C6 - B5 - - -',
          'A5 - - - - - - - . . . . . . . .',
          'B5 - - - D6 - - - G6 - F#6 - E6 - - -',
          'E6 - - - D6 - - - B5 - - - G5 - - -',
          'A5 - - - C6 - - - B5 - A5 - G5 - - -',
          'F#5 - - - A5 - - - . . . . . . . .',
        ),
      },
      { wave: 'square', vol: 0.014, tokens: arp(STREET_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.12, tokens: bass(STREET_CHORDS, 'drone') },
    ],
  },

  /** La chiva: carranga a mil por las curvas del Quindío. */
  chiva: {
    bpm: 140,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.045,
        tokens: bars(
          'A5 . C#6 . E6 . C#6 . A5 . C#6 . E6 . A6 .',
          'F#6 . A6 . F#6 . D6 . A5 . D6 . F#6 . D6 .',
          'E6 . G#6 . B6 . G#6 . E6 . G#6 . B6 . G#6 .',
          'A6 - - . E6 - - . C#6 - - . A5 - - .',
          'A5 . B5 . C#6 . D6 . E6 . F#6 . E6 . C#6 .',
          'D6 . F#6 . A6 . F#6 . D6 . C#6 . B5 . A5 .',
          'B5 . E6 . G#6 . E6 . B5 . D6 . C#6 . B5 .',
          'A5 - - - E5 - - - A5 - - - . . . .',
        ),
      },
      { wave: 'triangle', vol: 0.18, tokens: cumbiaBass(CHIVA_CHORDS) },
      { wave: 'drums', vol: 0.07, tokens: repeat('k . h s k . h s k . h s k h s h', 8) },
    ],
  },

  /** Billares El Arriero: despecho de rocola (guitarra y llanto). */
  billar: {
    bpm: 96,
    loop: true,
    echo: 0.15,
    channels: [
      {
        wave: 'square',
        vol: 0.045,
        tokens: bars(
          'E5 - A5 - C6 - - - B5 - A5 - G#5 - - -',
          'F5 - A5 - D6 - - - C6 - B5 - A5 - - -',
          'G#5 - B5 - E6 - - - D6 - C6 - B5 - - -',
          'A5 - - - C6 - - - E6 - - - . . . .',
          'A5 - C6 - E6 - - - D6 - C6 - B5 - - -',
          'D6 - F6 - A6 - - - G6 - F6 - E6 - - -',
          'E6 - D6 - C6 - B5 - G#5 - B5 - E6 - - -',
          'A5 - - - - - - - . . . . . . . .',
        ),
      },
      { wave: 'triangle', vol: 0.15, tokens: bass(BARBER_CHORDS, 'twostep') },
      { wave: 'square', vol: 0.014, tokens: arp(BARBER_CHORDS, 2, 4) },
      { wave: 'drums', vol: 0.045, tokens: repeat('k . . h . . s . . h k . s . h .', 8) },
    ],
  },

  /** La disco chiquita: el mismo dembow toda la noche. */
  disco: {
    bpm: 96,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.04,
        tokens: bars(
          'A5 . . A5 . . C6 . . . E6 . D6 . C6 .',
          'C6 . . C6 . . A5 . . . F5 . G5 . A5 .',
          'G5 . . G5 . . E5 . . . G5 . C6 . B5 .',
          'B5 . . B5 . . D6 . . . G5 . . . . .',
          'A5 . . A5 . . C6 . . . E6 . D6 . C6 .',
          'C6 . . C6 . . A5 . . . F5 . G5 . A5 .',
          'G5 . . G5 . . E5 . . . G5 . C6 . B5 .',
          'B5 . . B5 . . D6 . . . G5 . . . . .',
        ),
      },
      { wave: 'triangle', vol: 0.2, tokens: bass(DISCO_CHORDS, 'pulse', 1) },
      { wave: 'drums', vol: 0.09, tokens: repeat('k . . s . . s . k . . s . . s .', 8) },
    ],
  },

  /** Los mexicanos en la plaza: trompetas de mariachi (inventado). */
  mariachi: {
    bpm: 150,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.05,
        tokens: bars(
          'A5 - - . A5 . F#5 - - . A5 . D6 - - .',
          'C#6 - - . B5 . A5 - - . G5 . E5 - - .',
          'E5 - - . G5 . C#6 - - . B5 . A5 - - .',
          'F#5 - - . A5 . D6 - - - . . . . . .',
          'F#6 - - . E6 . D6 - - . F#6 . A6 - - .',
          'G6 - - . F#6 . E6 - - . D6 . B5 - - .',
          'A5 - - . C#6 . E6 - - . G6 . F#6 - E6 -',
          'D6 - - - A5 - - - D6 - - - . . . .',
        ),
      },
      { wave: 'triangle', vol: 0.17, tokens: bass(MARIACHI_CHORDS, 'twostep') },
      { wave: 'square', vol: 0.016, tokens: arp(MARIACHI_CHORDS, 2, 4) },
      { wave: 'drums', vol: 0.05, tokens: repeat('k . h . s . h . k . h . s . h .', 8) },
    ],
  },

  /** El recuerdo: cajita de música, con eco. */
  recuerdo: {
    bpm: 76,
    loop: true,
    echo: 0.35,
    channels: [
      {
        wave: 'triangle',
        vol: 0.11,
        tokens: bars(
          'A6 - - - C7 - - - F6 - - - E6 - - -',
          'D6 - - - F6 - - - A6 - - - . . . .',
          'A#6 - - - A6 - - - G6 - - - F6 - - -',
          'G6 - - - - - - - . . . . . . . .',
          'A6 - - - C7 - - - F7 - - - E7 - - -',
          'C7 - - - A6 - - - E6 - - - . . . .',
          'D6 - - - F6 - - - A#6 - - - A6 - G6 -',
          'F6 - - - - - - - . . . . . . . .',
        ),
      },
      { wave: 'sine', vol: 0.02, tokens: arp(RECUERDO_CHORDS, 2, 5) },
      { wave: 'triangle', vol: 0.1, tokens: bass(RECUERDO_CHORDS, 'drone') },
    ],
  },

  title: {
    bpm: 132,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.07,
        tokens: bars(
          'E5 - G5 - C6 - - - B5 - G5 - E5 - - -',
          'D5 - G5 - B5 - - - A5 - G5 - D5 - - -',
          'C5 - E5 - A5 - - - G5 - E5 - C5 - D5 -',
          'E5 - F5 - A5 - C6 - B5 - A5 - G5 - - -',
          'E5 - G5 - C6 - E6 - D6 - C6 - G5 - - -',
          'B5 - D6 - G6 - - - F6 - D6 - B5 - - -',
          'A5 - C6 - F6 - E6 - D6 - C6 - A5 - C6 -',
          'B5 - - - D6 - - - G5 - - - . . . .',
        ),
      },
      { wave: 'square', vol: 0.025, tokens: arp(TITLE_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.2, tokens: bass(TITLE_CHORDS, 'walk') },
      { wave: 'drums', vol: 0.18, tokens: repeat('k . h . s . h . k . k h s . h .', 8) },
    ],
  },

  street: {
    bpm: 108,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.06,
        tokens: bars(
          'B4 - - - D5 - G5 - - - F#5 - E5 - D5 -',
          'E5 - - - . . G4 - B4 - E5 - - - . .',
          'C5 - E5 - G5 - - - A5 - G5 - E5 - C5 -',
          'D5 - - - F#5 - A5 - - - . . F#5 - . .',
          'G5 - - - B5 - A5 - G5 - D5 - - - B4 -',
          'E5 - G5 - B5 - - - A5 - G5 - E5 - - -',
          'C5 - - - E5 - A5 - G5 - E5 - C5 - A4 -',
          'D5 - - - - - - - F#5 - - - . . . .',
        ),
      },
      { wave: 'triangle', vol: 0.05, tokens: arp(STREET_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.18, tokens: bass(STREET_CHORDS, 'walk') },
      { wave: 'drums', vol: 0.13, tokens: repeat('k . h . . . h . s . h . . . h .', 8) },
    ],
  },

  station: {
    bpm: 84,
    loop: true,
    echo: 0.35,
    channels: [
      {
        wave: 'triangle',
        vol: 0.12,
        sustain: true,
        tokens: bars(
          'E5 - - - - - - - C5 - - - - - - -',
          'A4 - - - - - - - C5 - - - F5 - - -',
          'E5 - - - - - - - G5 - - - - - - -',
          'D5 - - - - - - - B4 - - - - - - -',
          'C5 - - - E5 - - - A5 - - - - - - -',
          'G5 - - - F5 - - - C5 - - - - - - -',
          'B4 - - - - - - - G#4 - - - - - - -',
          'E5 - - - - - - - . . . . . . . .',
        ),
      },
      { wave: 'square', vol: 0.018, tokens: arp(STATION_CHORDS, 1, 4) },
      { wave: 'triangle', vol: 0.15, sustain: true, tokens: bass(STATION_CHORDS, 'drone') },
      { wave: 'drums', vol: 0.06, tokens: repeat('h . . . h . . . h . . . h . . .', 8) },
    ],
  },

  train: {
    bpm: 140,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.055,
        tokens: bars(
          'D5 - F5 - A5 - - - G5 - F5 - E5 - D5 -',
          'F5 - - - E5 - D5 - C5 - D5 - - - . .',
          'D5 - F5 - Bb5 - - - A5 - G5 - F5 - - -',
          'E5 - G5 - C6 - - - Bb5 - A5 - G5 - - -',
          'A5 - - - A5 - G5 - F5 - - - D5 - - -',
          'F5 - E5 - D5 - E5 - F5 - - - . . . .',
          'G5 - - - Bb5 - A5 - G5 - F5 - D5 - - -',
          'C#5 - - - E5 - - - A5 - - - . . . .',
        ),
      },
      { wave: 'triangle', vol: 0.2, tokens: bass(TRAIN_CHORDS, 'octave') },
      { wave: 'drums', vol: 0.15, tokens: repeat('k . h h s . h h k . h h s . h h', 8) },
    ],
  },

  bus: {
    bpm: 120,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.055,
        tokens: bars(
          'A5 - C6 - A5 - F5 - G5 - A5 - - - . .',
          'G5 - E5 - C5 - E5 - G5 - - - . . . .',
          'F5 - A5 - D6 - - - C6 - A5 - F5 - - -',
          'D5 - F5 - Bb5 - A5 - G5 - F5 - D5 - - -',
          'C6 - - - A5 - C6 - F6 - - - C6 - - -',
          'E5 - G5 - C6 - - - Bb5 - G5 - E5 - - -',
          'D6 - - - C6 - Bb5 - A5 - G5 - F5 - - -',
          'E5 - - - G5 - - - C6 - - - . . . .',
        ),
      },
      { wave: 'triangle', vol: 0.04, tokens: arp(BUS_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.19, tokens: bass(BUS_CHORDS, 'twostep') },
      { wave: 'drums', vol: 0.14, tokens: repeat('k . h s k . h s k . h s k h h s', 8) },
    ],
  },

  complete: {
    bpm: 120,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.06,
        tokens: bars(
          'C6 - - - G5 - C6 - E6 - - - D6 - C6 -',
          'A5 - - - C6 - F6 - E6 - D6 - C6 - - -',
          'B5 - - - D6 - G6 - F6 - - - D6 - B5 -',
          'C6 - - - - - - - G5 - - - C6 - - -',
        ),
      },
      { wave: 'square', vol: 0.025, tokens: arp(COMPLETE_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.19, tokens: bass(COMPLETE_CHORDS, 'pulse') },
      { wave: 'drums', vol: 0.14, tokens: repeat('x . h . o . h . x . x . o . h h', 4) },
    ],
  },

  credits: {
    bpm: 92,
    loop: true,
    echo: 0.25,
    channels: [
      {
        wave: 'triangle',
        vol: 0.13,
        tokens: bars(
          'C5 - - - F5 - - - A5 - - - G5 - F5 -',
          'E5 - - - - - - - C5 - - - - - - -',
          'D5 - - - F5 - - - Bb5 - - - A5 - G5 -',
          'G5 - - - - - - - E5 - - - - - - -',
          'F5 - - - A5 - - - C6 - - - Bb5 - A5 -',
          'A5 - - - - - - - F5 - - - D5 - - -',
          'D5 - - - F5 - - - G5 - - - F5 - E5 -',
          'F5 - - - - - - - - - - - . . . .',
        ),
      },
      { wave: 'square', vol: 0.02, tokens: arp(CREDITS_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.15, sustain: true, tokens: bass(CREDITS_CHORDS, 'drone') },
      { wave: 'drums', vol: 0.07, tokens: repeat('k . . . h . . . k . . . h . . .', 8) },
    ],
  },

  /** Despedida en el aeropuerto: lenta, en menor, con mucho eco. */
  despedida: {
    bpm: 72,
    loop: true,
    echo: 0.4,
    channels: [
      {
        wave: 'triangle',
        vol: 0.14,
        sustain: true,
        tokens: bars(
          'E5 - - - - - D5 - C5 - - - B4 - C5 -',
          'A4 - - - - - - - . . . . C5 - D5 -',
          'E5 - - - G5 - - - E5 - D5 - C5 - - -',
          'D5 - - - - - - - B4 - - - . . . .',
          'C5 - - - E5 - - - A5 - - - G5 - E5 -',
          'F5 - - - E5 - - - C5 - - - A4 - - -',
          'B4 - - - D5 - - - G5 - - - F5 - D5 -',
          'E5 - - - - - - - G#4 - - - B4 - - -',
          'A5 - - - - - G5 - F5 - - - E5 - - -',
          'D5 - - - - - E5 - F5 - - - G5 - - -',
          'G5 - - - - - - - E5 - - - B4 - - -',
          'C5 - - - - - - - . . . . E5 - - -',
          'F5 - - - E5 - D5 - A4 - - - D5 - - -',
          'E5 - - - - - - - C5 - - - A4 - - -',
          'A4 - - - C5 - F5 - E5 - - - D5 - C5 -',
          'B4 - - - - - - - G#4 - - - . . . .',
        ),
      },
      { wave: 'square', vol: 0.016, tokens: arp(FAREWELL_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.14, sustain: true, tokens: bass(FAREWELL_CHORDS, 'drone') },
      { wave: 'drums', vol: 0.035, tokens: repeat('k . . . . . . . h . . . . . . .', 16) },
    ],
  },

  /** Terminal del aeropuerto: tranquila, tipo lounge. */
  aeropuerto: {
    bpm: 96,
    loop: true,
    echo: 0.2,
    channels: [
      {
        wave: 'triangle',
        vol: 0.11,
        tokens: bars(
          'A5 - - - G5 - E5 - - - C5 - D5 - - -',
          'G5 - - - E5 - B4 - - - . . . . . .',
          'F5 - - - D5 - A4 - - - F5 - E5 - D5 -',
          'E5 - - - - - - - C5 - - - . . . .',
          'A5 - C6 - A5 - F5 - - - G5 - A5 - - -',
          'B5 - - - G5 - E5 - - - . . E5 - G5 -',
          'F5 - - - A5 - D6 - C6 - A5 - F5 - - -',
          'G5 - - - - - - - D5 - - - . . . .',
        ),
      },
      { wave: 'square', vol: 0.018, tokens: arp(AIRPORT_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.16, tokens: bass(AIRPORT_CHORDS, 'twostep') },
      { wave: 'drums', vol: 0.07, tokens: repeat('k . h . . h k . h . k . . h . .', 8) },
    ],
  },

  /** Misión 4, el campus de la PUCC: cumbia alegre, con güira y guitarra a contratiempo. */
  campus: {
    bpm: 100,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.05,
        tokens: bars(
          'B5 - . G5 . B5 . D6 - - . B5 . . . .',
          'A5 - . F#5 . A5 . D6 - - . A5 . . . .',
          'G5 - . E5 . G5 . B5 - - . G5 . E5 . .',
          'E5 - - - . . . . G5 - A5 - B5 - . .',
          'D6 - . B5 . G5 . B5 - - . D6 . . . .',
          'C6 - . A5 . F#5 . A5 - - . C6 . . . .',
          'B5 - . G5 . E5 . G5 - - . B5 . A5 . .',
          'A5 - - - . . . . F#5 - - - D5 - . .',
        ),
      },
      { wave: 'square', vol: 0.022, tokens: arp(CAMPUS_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.2, tokens: cumbiaBass(CAMPUS_CHORDS) },
      { wave: 'drums', vol: 0.1, tokens: repeat('x . h . o . h . x . h . o . h h', 8) },
    ],
  },

  /** Misión 4, el partido: un canto de hinchada rápido, con bombo en cada tiempo. */
  futbol: {
    bpm: 138,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.05,
        tokens: bars(
          'D5 - F#5 - A5 - - - F#5 - A5 - D6 - - -',
          'B5 - - - G5 - - - B5 - D6 - B5 - G5 -',
          'A5 - - - C#6 - - - E6 - - - C#6 - A5 -',
          'D6 - - - - - - - A5 - F#5 - D5 - . .',
          'F#5 . F#5 . A5 - F#5 - D5 - F#5 - A5 - . .',
          'G5 . G5 . B5 - G5 - D6 - - - B5 - . .',
          'A5 . A5 . C#6 - A5 - E6 - - - C#6 - . .',
          'E6 - - - D6 - - - C#6 - - - A5 - - -',
        ),
      },
      { wave: 'square', vol: 0.018, tokens: arp(FUTBOL_CHORDS, 1, 4) },
      { wave: 'triangle', vol: 0.2, tokens: bass(FUTBOL_CHORDS, 'octave') },
      { wave: 'drums', vol: 0.13, tokens: repeat('x . h . o . h . x . x . o . h h', 8) },
    ],
  },

  /** Misión 4, el rooftop de noche: bolero-salsa lento, con eco, mirando las luces de Cali. */
  rooftop: {
    bpm: 84,
    loop: true,
    echo: 0.28,
    channels: [
      {
        wave: 'triangle',
        vol: 0.12,
        tokens: bars(
          'E5 - - - A5 - - - C6 - B5 - A5 - - -',
          'F5 - - - A5 - - - D6 - C6 - A5 - - -',
          'D5 - - - G5 - - - B5 - A5 - G5 - - -',
          'E5 - - - - - - - G5 - - - . . . .',
          'A5 - - - C6 - - - F6 - E6 - C6 - - -',
          'D6 - - - A5 - - - F5 - - - A5 - - -',
          'G#5 - - - B5 - - - E6 - D6 - B5 - - -',
          'E5 - - - - - - - . . . . . . . .',
        ),
      },
      { wave: 'square', vol: 0.018, tokens: montuno(ROOFTOP_CHORDS) },
      { wave: 'triangle', vol: 0.17, tokens: tumbao(ROOFTOP_CHORDS) },
      { wave: 'drums', vol: 0.06, tokens: repeat('k . . h . . k . . h . . k . h .', 8) },
    ],
  },

  /** Cali: salsa con montuno, tumbao y clave. */
  salsa: {
    bpm: 104,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.05,
        tokens: bars(
          'G5 - . E5 . G5 . C6 - - . . . . . .',
          'A5 - . F5 . A5 . C6 - - . A5 . . . .',
          'B5 - . G5 . D6 . B5 - - . G5 . . . .',
          'C6 - - - . . . . E5 - G5 - C6 - . .',
          'E6 - . D6 . C6 . G5 - - . . . . . .',
          'F6 - . E6 . D6 . C6 - - . A5 . . . .',
          'D6 - . C6 . B5 . G5 - - . D6 . . . .',
          'C6 - - - . . . . . . . . . . . .',
        ),
      },
      { wave: 'square', vol: 0.03, tokens: montuno(SALSA_CHORDS) },
      { wave: 'triangle', vol: 0.2, tokens: tumbao(SALSA_CHORDS) },
      { wave: 'drums', vol: 0.12, tokens: repeat('x . h o . h k . h . o . k h o .', 8) },
    ],
  },
  /** Misión 5, la Barbería 360: salsa brava en menor, con trompetas, montuno y la campana del timbal. */
  barberia: {
    bpm: 112,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.055,
        tokens: bars(
          'A5 . A5 . C6 . A5 - E5 - . . A5 . C6 .',
          'D6 - - . C6 . A5 . F5 - . . D6 . . .',
          'B5 . G#5 . E5 . B5 - D6 - C6 - B5 . . .',
          'A5 - - - . . E5 . A5 . C6 . E6 - . .',
          'E6 . D6 . C6 . A5 . E6 . D6 . C6 . A5 .',
          'F6 - - . D6 . A5 . F6 - E6 - D6 . . .',
          'E6 - . D6 . B5 . G#5 - . B5 . E6 . . .',
          'E6 - - - . . . . B5 - G#5 - E5 - . .',
        ),
      },
      { wave: 'square', vol: 0.03, tokens: montuno(BARBER_CHORDS) },
      { wave: 'triangle', vol: 0.2, tokens: tumbao(BARBER_CHORDS) },
      { wave: 'drums', vol: 0.12, tokens: repeat('x . h o . h k . h h o . k h o h', 8) },
    ],
  },

  /** Misión 5, el cacharro de Grover: morenada boliviana, pesada y en dos, con la matraca (hi-hat) sin parar. */
  morenada: {
    bpm: 92,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.06,
        tokens: bars(
          'D5 - - F5 A5 - - - A5 - G5 - F5 - E5 -',
          'E5 - - G5 C#6 - - - C#6 - A5 - G5 - E5 -',
          'F5 - - A5 D6 - - - D6 - C6 - A#5 - A5 -',
          'G5 - - - A#5 - - - A5 - G5 - F5 - E5 -',
          'D5 - - F5 A5 - - - D6 - - - A5 - F5 -',
          'G5 - - A#5 D6 - - - C6 - A#5 - A5 - G5 -',
          'A5 - - - E5 - - - C#6 - - - A5 - - -',
          'D6 - - - - - - - D5 - - - . . . .',
        ),
      },
      { wave: 'square', vol: 0.025, tokens: arp(MORENADA_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.22, tokens: bass(MORENADA_CHORDS, 'octave') },
      { wave: 'drums', vol: 0.13, tokens: repeat('k h h h s h h h k h h h s h h h', 8) },
    ],
  },

  /** Misión 5, las piscinas de noche: tranquila, con eco, como el agua bajo los reflectores. */
  piscina: {
    bpm: 88,
    loop: true,
    echo: 0.32,
    channels: [
      {
        wave: 'triangle',
        vol: 0.12,
        tokens: bars(
          'A5 - - - C6 - - - E6 - - - C6 - - -',
          'G5 - - - B5 - - - D6 - - - B5 - - -',
          'F5 - - - A5 - - - C6 - - - A5 - G5 -',
          'E5 - - - - - - - G5 - - - . . . .',
          'A5 - C6 - E6 - - - F6 - E6 - C6 - - -',
          'B5 - D6 - G6 - - - F6 - D6 - B5 - - -',
          'A5 - - - F5 - - - C6 - - - A5 - - -',
          'G5 - - - - - - - . . . . . . . .',
        ),
      },
      { wave: 'square', vol: 0.018, tokens: arp(PISCINA_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.15, tokens: bass(PISCINA_CHORDS, 'drone') },
      { wave: 'drums', vol: 0.05, tokens: repeat('k . . . h . . . k . h . . . h .', 8) },
    ],
  },

  /** Misión 5, Sira: un bolero suave, lento y con eco. */
  sira: {
    bpm: 76,
    loop: true,
    echo: 0.26,
    channels: [
      {
        wave: 'triangle',
        vol: 0.13,
        tokens: bars(
          'E5 - - - G5 - - - C6 - - - B5 - A5 -',
          'A5 - - - - - - - E5 - - - . . . .',
          'F5 - - - A5 - - - D6 - - - C6 - B5 -',
          'B5 - - - - - - - G5 - - - . . . .',
          'E5 - - - G5 - - - C6 - - - E6 - D6 -',
          'C6 - - - A5 - - - E5 - - - . . . .',
          'F5 - - - A5 - - - C6 - - - B5 - A5 -',
          'G5 - - - - - - - . . . . . . . .',
        ),
      },
      { wave: 'square', vol: 0.016, tokens: montuno(SIRA_CHORDS) },
      { wave: 'triangle', vol: 0.15, tokens: tumbao(SIRA_CHORDS) },
      { wave: 'drums', vol: 0.05, tokens: repeat('k . . h . . k . . h . . k . h .', 8) },
    ],
  },

  /** Misión 5, Pance Burger y el Cinco: boogaloo juguetón, con palmas. */
  hamburguesas: {
    bpm: 116,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.05,
        tokens: bars(
          'G5 . B5 . D6 . B5 . G5 - . . E5 . G5 .',
          'C6 . E6 . G6 . E6 . C6 - . . A5 . C6 .',
          'B5 . D6 . G6 - . . F#6 . E6 . D6 . B5 .',
          'A5 - - - F#5 . A5 . D6 - - - . . . .',
          'G5 . G5 . B5 . D6 . G6 . F#6 . E6 . D6 .',
          'E6 . E6 . C6 . G5 . E6 - D6 - C6 . . .',
          'B5 . D6 . B5 . G5 . A5 - . . D5 . F#5 .',
          'G5 - - - . . . . D6 - B5 - G5 - . .',
        ),
      },
      { wave: 'square', vol: 0.022, tokens: arp(BURGER_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.2, tokens: bass(BURGER_CHORDS, 'walk') },
      { wave: 'drums', vol: 0.11, tokens: repeat('x . h . o . h h x . h . o . h o', 8) },
    ],
  },

  /** Misión 6, la feria del libro en el Bulevar: cumbia alegre con flauta de millo. */
  feria: {
    bpm: 104,
    loop: true,
    channels: [
      {
        wave: 'triangle',
        vol: 0.12,
        tokens: bars(
          'F#5 . A5 . D6 - A5 . B5 . A5 . F#5 - . .',
          'G5 . B5 . D6 - B5 . A5 . G5 . E5 - . .',
          'A5 . C#6 . E6 - C#6 . D6 . C#6 . A5 - . .',
          'F#5 - - . D5 . F#5 . A5 - - - . . . .',
          'B5 . D6 . F#6 - D6 . E6 . D6 . B5 - . .',
          'G5 . B5 . D6 - B5 . C#6 . B5 . G5 - . .',
          'A5 . A5 . C#6 . E6 . G6 - F#6 - E6 . C#6 .',
          'D6 - - - A5 - F#5 - D5 - - - . . . .',
        ),
      },
      { wave: 'square', vol: 0.02, tokens: arp(FERIA_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.18, tokens: cumbiaBass(FERIA_CHORDS) },
      { wave: 'drums', vol: 0.09, tokens: repeat('k . h h s . h h k . h h s . h k', 8) },
    ],
  },

  /** Misión 6, la colina de noche: guitarra lenta en menor, misteriosa y después tierna. */
  colina: {
    bpm: 70,
    loop: true,
    echo: 0.32,
    channels: [
      {
        wave: 'triangle',
        vol: 0.12,
        tokens: bars(
          'B5 - - - G5 - - - E5 - - - F#5 - G5 -',
          'G5 - - - E5 - - - C5 - - - . . . .',
          'A5 - - - C6 - - - E6 - - - D6 - C6 -',
          'B5 - - - - - - - D#5 - - - . . . .',
          'E5 - - - G5 - - - B5 - - - E6 - D6 -',
          'C6 - - - B5 - - - G5 - - - . . . .',
          'A5 - - - B5 - - - C6 - - - D6 - E6 -',
          'D#6 - - - - - - - B5 - - - . . . .',
        ),
      },
      { wave: 'square', vol: 0.014, tokens: arp(COLINA_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.14, tokens: tumbao(COLINA_CHORDS) },
    ],
  },

  /** Misión 6, ¡al ladrón!: rápida y tensa, el bajo corriendo. */
  persecucion: {
    bpm: 150,
    loop: true,
    channels: [
      {
        wave: 'square',
        vol: 0.05,
        tokens: bars(
          'A5 . A5 . C6 . A5 . E6 . D6 . C6 . B5 .',
          'A5 . A5 . C6 . E6 . A6 - G6 . E6 . C6 .',
          'F5 . A5 . C6 . F6 . E6 . C6 . A5 . F5 .',
          'E5 . G#5 . B5 . E6 . D6 . B5 . G#5 . E5 .',
          'A5 . C6 . E6 . A6 . G6 . E6 . C6 . A5 .',
          'A5 . B5 . C6 . D6 . E6 - - . . . E6 .',
          'F6 . E6 . D6 . C6 . A5 . C6 . F6 . A6 .',
          'G#6 - - . E6 - - . B5 - - . G#5 . E5 .',
        ),
      },
      { wave: 'triangle', vol: 0.2, tokens: bass(PERSE_CHORDS, 'walk') },
      { wave: 'drums', vol: 0.12, tokens: repeat('x h o h x x o h x h o h x x o o', 8) },
    ],
  },

  /** Misión 6, la clase de natación con Sira: juguetona, con eco de piscina. */
  natacion: {
    bpm: 96,
    loop: true,
    echo: 0.22,
    channels: [
      {
        wave: 'triangle',
        vol: 0.12,
        tokens: bars(
          'A5 . C6 . F6 - . . E6 . C6 . A5 - . .',
          'G5 . C6 . E6 - . . D6 . C6 . G5 - . .',
          'F5 . A5 . D6 - . . C6 . A5 . F5 - . .',
          'D5 - F5 - A#5 - - - . . . . . . . .',
          'A5 . C6 . F6 - . . G6 . F6 . C6 - . .',
          'G5 . C6 . E6 - . . F6 . E6 . C6 - . .',
          'D6 . C6 . A#5 . A5 . G5 . F5 . D5 . F5 .',
          'E5 - G5 - C6 - - - . . . . . . . .',
        ),
      },
      { wave: 'square', vol: 0.018, tokens: arp(NADO_CHORDS, 2, 4) },
      { wave: 'triangle', vol: 0.16, tokens: bass(NADO_CHORDS, 'walk') },
      { wave: 'drums', vol: 0.06, tokens: repeat('k . h . o . h . k . h . o . h h', 8) },
    ],
  },
};

// ---------------------------------------------------------------------------
// Reproductor con agenda anticipada (lookahead)
// ---------------------------------------------------------------------------

interface NoteEvent {
  freq: number;
  steps: number;
}

interface ParsedChannel {
  def: ChannelDef;
  notes: Array<NoteEvent | null>;
}

function parseChannel(def: ChannelDef): ParsedChannel {
  if (def.wave === 'drums') return { def, notes: [] };
  const notes: Array<NoteEvent | null> = def.tokens.map(() => null);
  def.tokens.forEach((tok, i) => {
    if (tok === '.' || tok === '-') return;
    let steps = 1;
    while (def.tokens[i + steps] === '-') steps++;
    notes[i] = { freq: noteFreq(tok), steps };
  });
  return { def, notes };
}

const FADE_S = 0.4;

/** Una pista sonando: agenda sus notas un poco por delante del reloj de audio. */
export class TrackPlayer {
  readonly output: GainNode;
  private readonly channels: ParsedChannel[];
  private readonly length: number;
  private readonly stepDur: number;
  private step = 0;
  private nextTime: number;
  finished = false;

  constructor(
    private readonly ctx: AudioContext,
    private readonly def: TrackDef,
    dest: AudioNode,
  ) {
    this.channels = def.channels.map(parseChannel);
    this.length = Math.max(...def.channels.map((c) => c.tokens.length));
    this.stepDur = 60 / def.bpm / 4;
    this.output = ctx.createGain();
    const now = ctx.currentTime;
    this.output.gain.setValueAtTime(0, now);
    this.output.gain.linearRampToValueAtTime(1, now + FADE_S);
    this.output.connect(dest);
    if (def.echo) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = this.stepDur * 3;
      const feedback = ctx.createGain();
      feedback.gain.value = def.echo;
      const wet = ctx.createGain();
      wet.gain.value = def.echo;
      this.output.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(wet).connect(dest);
    }
    this.nextTime = now + 0.06;
  }

  /** Agenda todo lo que cae antes de `until` (segundos del AudioContext). */
  schedule(until: number): void {
    if (this.finished) return;
    // Si la pestaña estuvo en segundo plano, saltamos en vez de tocar todo de golpe.
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < until) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += this.stepDur;
      this.step++;
      if (this.step >= this.length) {
        if (!this.def.loop) {
          this.finished = true;
          return;
        }
        this.step = 0;
      }
    }
  }

  fadeOut(): void {
    this.finished = true;
    const now = this.ctx.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueAtTime(this.output.gain.value, now);
    this.output.gain.linearRampToValueAtTime(0, now + FADE_S);
    window.setTimeout(() => this.output.disconnect(), (FADE_S + 1.5) * 1000);
  }

  private playStep(step: number, t: number): void {
    for (const ch of this.channels) {
      const { def } = ch;
      if (def.wave === 'drums') {
        const tok = def.tokens[step % def.tokens.length];
        if (tok === 'k' || tok === 'x') kick(this.ctx, t, def.vol * 1.6, this.output);
        if (tok === 's' || tok === 'o') snare(this.ctx, t, def.vol, this.output);
        if (tok === 'h' || tok === 'x' || tok === 'o') hat(this.ctx, t, def.vol * 0.35, this.output);
        continue;
      }
      const note = ch.notes[step % ch.notes.length];
      if (!note) continue;
      tone(this.ctx, {
        type: def.wave,
        freq: note.freq,
        start: t,
        dur: note.steps * this.stepDur * (def.sustain ? 1 : 0.92),
        vol: def.vol,
        sustain: def.sustain,
        attack: def.sustain ? 0.03 : 0.004,
        dest: this.output,
      });
    }
  }
}

