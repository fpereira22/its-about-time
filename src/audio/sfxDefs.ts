import type { SfxName } from './sfx';
import { noise, noteFreq, tone } from './synth';

type SfxFn = (ctx: AudioContext, t: number, out: AudioNode) => void;

/** Secuencia rápida de notas (jingles). */
function notes(ctx: AudioContext, out: AudioNode, t: number, list: string[], step: number, type: OscillatorType, vol: number): void {
  list.forEach((n, i) => tone(ctx, { type, freq: noteFreq(n), start: t + i * step, dur: step * 1.6, vol, dest: out }));
}

/** Un sonido lejano: sin agudos y más bajo (`pan` lo corre un poco a un lado). */
function far(ctx: AudioContext, out: AudioNode, cutoff: number, pan: number): AudioNode {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cutoff;
  const side = (Math.random() < 0.5 ? -1 : 1) * pan;
  if (typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner();
    p.pan.value = side;
    lp.connect(p).connect(out);
  } else {
    lp.connect(out);
  }
  return lp;
}


/**
 * Una "voz" sintetizada (misión 5: «¡Marco!» / «¡Polo!»): diente de sierra por dos filtros de formantes,
 * una sílaba por entrada con su altura y sus formantes (F1, F2) de vocal.
 */
function voice(ctx: AudioContext, out: AudioNode, t: number, syllables: Array<{ f0: number; f0End?: number; f1: number; f2: number; dur: number }>, vol = 0.22): void {
  let at = t;
  for (const s of syllables) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(s.f0, at);
    osc.frequency.linearRampToValueAtTime(s.f0End ?? s.f0, at + s.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.02);
    g.gain.setValueAtTime(vol, at + s.dur - 0.05);
    g.gain.linearRampToValueAtTime(0, at + s.dur);
    for (const [f, q, v] of [[s.f1, 6, 1], [s.f2, 9, 0.6]] as const) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const gv = ctx.createGain();
      gv.gain.value = v;
      osc.connect(bp).connect(gv).connect(g);
    }
    g.connect(out);
    osc.start(at);
    osc.stop(at + s.dur + 0.02);
    at += s.dur + 0.03;
  }
}

/** Definición sintetizada de cada efecto de sonido. Para agregar uno: suma el nombre en sfx.ts y su función aquí. */
export const SFX: Record<SfxName, SfxFn> = {
  blip: (ctx, t, out) =>
    tone(ctx, { type: 'square', freq: 720 + Math.random() * 120, start: t, dur: 0.028, vol: 0.035, dest: out }),

  page: (ctx, t, out) => tone(ctx, { type: 'triangle', freq: 880, freqEnd: 1175, start: t, dur: 0.05, vol: 0.12, dest: out }),

  cursor: (ctx, t, out) => tone(ctx, { type: 'square', freq: 990, start: t, dur: 0.035, vol: 0.06, dest: out }),

  select: (ctx, t, out) => notes(ctx, out, t, ['G5', 'D6'], 0.045, 'square', 0.07),

  cancel: (ctx, t, out) => notes(ctx, out, t, ['E5', 'A4'], 0.05, 'square', 0.06),

  open: (ctx, t, out) => {
    tone(ctx, { type: 'triangle', freq: 420, freqEnd: 900, start: t, dur: 0.09, vol: 0.18, dest: out });
    tone(ctx, { type: 'square', freq: 1320, start: t + 0.06, dur: 0.05, vol: 0.04, dest: out });
  },

  close: (ctx, t, out) => tone(ctx, { type: 'triangle', freq: 900, freqEnd: 380, start: t, dur: 0.09, vol: 0.16, dest: out }),

  bump: (ctx, t, out) => {
    tone(ctx, { type: 'triangle', freq: 120, freqEnd: 60, start: t, dur: 0.09, vol: 0.3, dest: out });
    noise(ctx, { start: t, dur: 0.05, vol: 0.06, filter: 'lowpass', freq: 600, dest: out });
  },

  item: (ctx, t, out) => {
    notes(ctx, out, t, ['C6', 'E6', 'G6', 'C7'], 0.07, 'square', 0.07);
    tone(ctx, { type: 'triangle', freq: noteFreq('C5'), start: t, dur: 0.35, vol: 0.15, dest: out });
  },

  coin: (ctx, t, out) => {
    tone(ctx, { type: 'square', freq: noteFreq('B5'), start: t, dur: 0.06, vol: 0.06, dest: out });
    tone(ctx, { type: 'square', freq: noteFreq('E6'), start: t + 0.06, dur: 0.22, vol: 0.06, dest: out });
  },

  bip: (ctx, t, out) => tone(ctx, { type: 'sine', freq: 1560, start: t, dur: 0.13, vol: 0.14, sustain: true, dest: out }),

  error: (ctx, t, out) => {
    for (let i = 0; i < 3; i++) {
      tone(ctx, { type: 'square', freq: 230, start: t + i * 0.11, dur: 0.07, vol: 0.07, sustain: true, dest: out });
    }
  },

  door: (ctx, t, out) => {
    noise(ctx, { start: t, dur: 0.28, vol: 0.12, filter: 'lowpass', freq: 1800, freqEnd: 300, swell: true, dest: out });
    tone(ctx, { type: 'triangle', freq: 330, freqEnd: 165, start: t, dur: 0.2, vol: 0.12, dest: out });
  },

  chime: (ctx, t, out) => {
    for (let i = 0; i < 3; i++) {
      tone(ctx, { type: 'square', freq: 1046, start: t + i * 0.2, dur: 0.12, vol: 0.05, sustain: true, dest: out });
    }
  },

  'train-arrive': (ctx, t, out) => {
    noise(ctx, { start: t, dur: 1.7, vol: 0.22, filter: 'lowpass', freq: 1400, freqEnd: 220, swell: true, dest: out });
    tone(ctx, { type: 'sawtooth', freq: 260, freqEnd: 120, start: t, dur: 1.5, vol: 0.03, sustain: true, dest: out });
    tone(ctx, { type: 'sine', freq: 2600, freqEnd: 2350, start: t + 1.2, dur: 0.45, vol: 0.025, sustain: true, dest: out });
  },

  'train-depart': (ctx, t, out) => {
    noise(ctx, { start: t, dur: 1.5, vol: 0.2, filter: 'lowpass', freq: 250, freqEnd: 1500, swell: true, dest: out });
    tone(ctx, { type: 'sawtooth', freq: 140, freqEnd: 420, start: t, dur: 1.4, vol: 0.03, sustain: true, dest: out });
  },

  'bus-pass': (ctx, t, out) => {
    noise(ctx, { start: t, dur: 1.6, vol: 0.2, filter: 'bandpass', freq: 400, freqEnd: 260, q: 0.7, swell: true, dest: out });
    tone(ctx, { type: 'sawtooth', freq: 95, freqEnd: 70, start: t, dur: 1.5, vol: 0.04, sustain: true, dest: out });
  },

  'bus-brake': (ctx, t, out) => {
    tone(ctx, { type: 'sawtooth', freq: 110, freqEnd: 60, start: t, dur: 1.1, vol: 0.04, sustain: true, dest: out });
    noise(ctx, { start: t + 1.0, dur: 0.6, vol: 0.12, filter: 'highpass', freq: 3500, dest: out });
  },

  bell: (ctx, t, out) => {
    for (let i = 0; i < 12; i++) {
      tone(ctx, { type: 'square', freq: i % 2 ? 1250 : 1180, start: t + i * 0.035, dur: 0.035, vol: 0.05, sustain: true, dest: out });
    }
  },

  dog: (ctx, t, out) => {
    for (const dt of [0, 0.22]) {
      tone(ctx, { type: 'sawtooth', freq: 620, freqEnd: 300, start: t + dt, dur: 0.12, vol: 0.08, dest: out });
      noise(ctx, { start: t + dt, dur: 0.08, vol: 0.05, filter: 'bandpass', freq: 900, dest: out });
    }
  },

  phone: (ctx, t, out) => {
    for (const dt of [0, 0.28]) {
      tone(ctx, { type: 'square', freq: 85, start: t + dt, dur: 0.2, vol: 0.09, sustain: true, dest: out });
    }
  },

  banner: (ctx, t, out) => {
    noise(ctx, { start: t, dur: 0.22, vol: 0.04, filter: 'bandpass', freq: 700, freqEnd: 2400, swell: true, dest: out });
    tone(ctx, { type: 'triangle', freq: noteFreq('E6'), start: t + 0.08, dur: 0.18, vol: 0.06, dest: out });
  },

  click: (ctx, t, out) => tone(ctx, { type: 'square', freq: 1400, start: t, dur: 0.02, vol: 0.05, dest: out }),

  eat: (ctx, t, out) => {
    for (let i = 0; i < 3; i++) {
      noise(ctx, { start: t + i * 0.12, dur: 0.07, vol: 0.12, filter: 'lowpass', freq: 900, dest: out });
    }
    tone(ctx, { type: 'triangle', freq: noteFreq('C6'), start: t + 0.4, dur: 0.1, vol: 0.08, dest: out });
  },

  'metro-doors-open': (ctx, t, out) => {
    noise(ctx, { start: t, dur: 0.45, vol: 0.16, filter: 'highpass', freq: 2200, freqEnd: 900, dest: out });
    notes(ctx, out, t + 0.35, ['E5', 'C5'], 0.22, 'sine', 0.12);
  },

  'metro-doors-close': (ctx, t, out) => {
    // El clásico aviso de cierre: pitidos rápidos y luego el golpe de las puertas.
    for (let i = 0; i < 8; i++) {
      tone(ctx, { type: 'square', freq: 1175, start: t + i * 0.16, dur: 0.08, vol: 0.05, sustain: true, dest: out });
    }
    noise(ctx, { start: t + 1.35, dur: 0.35, vol: 0.14, filter: 'highpass', freq: 1800, freqEnd: 700, dest: out });
    tone(ctx, { type: 'triangle', freq: 110, freqEnd: 55, start: t + 1.6, dur: 0.14, vol: 0.3, dest: out });
  },

  'bus-doors-open': (ctx, t, out) => {
    noise(ctx, { start: t, dur: 0.6, vol: 0.2, filter: 'highpass', freq: 3000, freqEnd: 1200, dest: out });
    for (let i = 0; i < 3; i++) {
      tone(ctx, { type: 'square', freq: 2100, start: t + 0.15 + i * 0.32, dur: 0.16, vol: 0.04, sustain: true, dest: out });
    }
  },

  'bus-doors-close': (ctx, t, out) => {
    for (let i = 0; i < 4; i++) {
      tone(ctx, { type: 'square', freq: 2100, start: t + i * 0.18, dur: 0.09, vol: 0.04, sustain: true, dest: out });
    }
    noise(ctx, { start: t + 0.7, dur: 0.45, vol: 0.18, filter: 'highpass', freq: 2600, freqEnd: 1000, dest: out });
    tone(ctx, { type: 'triangle', freq: 130, freqEnd: 60, start: t + 1.05, dur: 0.12, vol: 0.25, dest: out });
  },

  ring: (ctx, t, out) => notes(ctx, out, t, ['E6', 'D6', 'F#5', 'G#5', 'C#6', 'B5', 'D5', 'E5'], 0.11, 'square', 0.05),

  notify: (ctx, t, out) => notes(ctx, out, t, ['A5', 'E6'], 0.08, 'triangle', 0.14),

  camera: (ctx, t, out) => {
    noise(ctx, { start: t, dur: 0.05, vol: 0.18, filter: 'highpass', freq: 2500, dest: out });
    noise(ctx, { start: t + 0.09, dur: 0.06, vol: 0.14, filter: 'bandpass', freq: 1800, dest: out });
  },

  elevator: (ctx, t, out) => tone(ctx, { type: 'sine', freq: noteFreq('A5'), start: t, dur: 0.9, vol: 0.14, dest: out }),

  'snake-eat': (ctx, t, out) => tone(ctx, { type: 'square', freq: 660, freqEnd: 990, start: t, dur: 0.05, vol: 0.07, dest: out }),

  'snake-die': (ctx, t, out) => notes(ctx, out, t, ['C5', 'G4', 'E4', 'C4'], 0.09, 'square', 0.07),

  secret: (ctx, t, out) => notes(ctx, out, t, ['G5', 'F#5', 'D#5', 'A4', 'G#4', 'E5', 'G#5', 'C6'], 0.08, 'square', 0.06),

  sit: (ctx, t, out) => {
    tone(ctx, { type: 'triangle', freq: 170, freqEnd: 80, start: t, dur: 0.08, vol: 0.2, dest: out });
    noise(ctx, { start: t, dur: 0.07, vol: 0.05, filter: 'lowpass', freq: 450, dest: out });
  },

  avion: (ctx, t, out) => {
    noise(ctx, { start: t, dur: 3.2, vol: 0.24, filter: 'lowpass', freq: 300, freqEnd: 2200, swell: true, dest: out });
    tone(ctx, { type: 'sawtooth', freq: 70, freqEnd: 240, start: t, dur: 3, vol: 0.035, sustain: true, dest: out });
    tone(ctx, { type: 'sine', freq: 1800, freqEnd: 2600, start: t + 0.4, dur: 2.4, vol: 0.02, sustain: true, dest: out });
  },

  anuncio: (ctx, t, out) => {
    ['G5', 'E5', 'C5'].forEach((n, i) =>
      tone(ctx, { type: 'sine', freq: noteFreq(n), start: t + i * 0.32, dur: 0.7, vol: 0.13, dest: out }),
    );
  },

  sello: (ctx, t, out) => {
    tone(ctx, { type: 'triangle', freq: 150, freqEnd: 60, start: t, dur: 0.12, vol: 0.35, dest: out });
    noise(ctx, { start: t, dur: 0.06, vol: 0.12, filter: 'lowpass', freq: 900, dest: out });
  },

  // --- Misión 4 ---

  trueno: (ctx, t, out) => {
    // El crujido del rayo y el retumbo largo que se va apagando.
    noise(ctx, { start: t, dur: 0.35, vol: 0.4, filter: 'highpass', freq: 1800, freqEnd: 400, dest: out });
    noise(ctx, { start: t + 0.1, dur: 2.8, vol: 0.5, filter: 'lowpass', freq: 420, freqEnd: 60, swell: true, dest: out });
    tone(ctx, { type: 'triangle', freq: 55, freqEnd: 32, start: t + 0.15, dur: 2.2, vol: 0.25, dest: out });
  },

  silbato: (ctx, t, out) => {
    for (const [s, d] of [[0, 0.16], [0.22, 0.5]] as const) {
      tone(ctx, { type: 'square', freq: 2900, freqEnd: 3050, start: t + s, dur: d, vol: 0.05, sustain: true, dest: out });
      noise(ctx, { start: t + s, dur: d, vol: 0.05, filter: 'bandpass', freq: 3000, q: 4, dest: out });
    }
  },

  patada: (ctx, t, out) => {
    tone(ctx, { type: 'triangle', freq: 220, freqEnd: 70, start: t, dur: 0.08, vol: 0.3, dest: out });
    noise(ctx, { start: t, dur: 0.04, vol: 0.12, filter: 'lowpass', freq: 1400, dest: out });
  },

  gol: (ctx, t, out) => {
    // La hinchada (ruido que crece) y una fanfarria corta.
    noise(ctx, { start: t, dur: 2.2, vol: 0.22, filter: 'bandpass', freq: 900, q: 0.6, swell: true, dest: out });
    notes(ctx, out, t + 0.1, ['G5', 'C6', 'E6', 'G6', 'E6', 'G6'], 0.1, 'square', 0.06);
  },

  poste: (ctx, t, out) => {
    tone(ctx, { type: 'square', freq: 1760, start: t, dur: 0.3, vol: 0.05, dest: out });
    tone(ctx, { type: 'triangle', freq: 880, start: t, dur: 0.5, vol: 0.12, dest: out });
  },

  hervir: (ctx, t, out) => {
    for (let i = 0; i < 9; i++) {
      tone(ctx, { type: 'sine', freq: 300 + Math.random() * 500, freqEnd: 900, start: t + i * 0.09 + Math.random() * 0.04, dur: 0.05, vol: 0.06, dest: out });
    }
    noise(ctx, { start: t, dur: 0.9, vol: 0.05, filter: 'bandpass', freq: 2500, swell: true, dest: out });
  },

  brindis: (ctx, t, out) => {
    tone(ctx, { type: 'sine', freq: 2637, start: t, dur: 0.5, vol: 0.08, dest: out });
    tone(ctx, { type: 'sine', freq: 3520, start: t + 0.04, dur: 0.4, vol: 0.05, dest: out });
  },

  pavo: (ctx, t, out) => {
    // «¡Mi-áaau!»: dos gritos nasales que suben y caen.
    for (const [s, f0, f1] of [[0, 520, 980], [0.32, 640, 1240]] as const) {
      tone(ctx, { type: 'sawtooth', freq: f0, freqEnd: f1, start: t + s, dur: 0.14, vol: 0.05, sustain: true, dest: out });
      tone(ctx, { type: 'square', freq: f1, freqEnd: f0 * 0.8, start: t + s + 0.14, dur: 0.18, vol: 0.04, dest: out });
    }
  },

  // --- Abajo, en la calle (se oyen desde el rooftop: suaves y sin agudos) ---

  pito_lejos: (ctx, t, out) => {
    // «¡Pi-piii!»: la bocina de dos notas de un carro, apagada por la distancia.
    const d = far(ctx, out, 1100, 0.5);
    const long = Math.random() < 0.5;
    for (const [s, dur] of long ? [[0, 0.12], [0.18, 0.45]] : [[0, 0.1], [0.15, 0.1], [0.3, 0.1]]) {
      tone(ctx, { type: 'square', freq: 392, start: t + s, dur, vol: 0.05, sustain: true, dest: d });
      tone(ctx, { type: 'square', freq: 494, start: t + s, dur, vol: 0.04, sustain: true, dest: d });
    }
  },

  moto_lejos: (ctx, t, out) => {
    // Una moto que acelera y se aleja por la avenida.
    const d = far(ctx, out, 700, 0.35);
    tone(ctx, { type: 'sawtooth', freq: 70, freqEnd: 150, start: t, dur: 1.1, vol: 0.12, sustain: true, attack: 0.3, dest: d });
    tone(ctx, { type: 'sawtooth', freq: 120, freqEnd: 60, start: t + 1.1, dur: 1.6, vol: 0.08, dest: d });
  },

  sirena_lejos: (ctx, t, out) => {
    // Ambulancia a varias cuadras: el lamento sube y baja, entra y se va.
    const d = far(ctx, out, 1600, 0.0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 2.5);
    g.gain.linearRampToValueAtTime(0.25, t + 4.5);
    g.gain.linearRampToValueAtTime(0, t + 7.5);
    g.connect(d);
    for (let i = 0; i < 5; i++) {
      const s = t + i * 1.5;
      tone(ctx, { type: 'triangle', freq: 640, freqEnd: 940, start: s, dur: 0.75, vol: 0.12, sustain: true, attack: 0.05, dest: g });
      tone(ctx, { type: 'triangle', freq: 940, freqEnd: 640, start: s + 0.75, dur: 0.75, vol: 0.12, sustain: true, attack: 0.05, dest: g });
    }
  },

  avion_lejos: (ctx, t, out) => {
    // El rumor largo de un avión que pasa alto.
    noise(ctx, { start: t, dur: 9, vol: 0.12, filter: 'lowpass', freq: 380, freqEnd: 240, swell: true, dest: out });
    tone(ctx, { type: 'triangle', freq: 62, freqEnd: 54, start: t + 1, dur: 7, vol: 0.05, sustain: true, attack: 3, dest: out });
  },


  // --- Misión 5 ---

  maquina: (ctx, t, out) => {
    // La máquina de Fredy: zumbido grave con su vibración y el filo que corta.
    for (let i = 0; i < 6; i++) {
      tone(ctx, { type: 'sawtooth', freq: 118 + (i % 2) * 6, start: t + i * 0.18, dur: 0.2, vol: 0.05, sustain: true, attack: 0.01, dest: out });
    }
    noise(ctx, { start: t, dur: 1.1, vol: 0.05, filter: 'bandpass', freq: 3400, q: 3, swell: true, dest: out });
  },

  tijera: (ctx, t, out) => {
    for (const s of [0, 0.16]) {
      noise(ctx, { start: t + s, dur: 0.05, vol: 0.18, filter: 'highpass', freq: 4500, dest: out });
      tone(ctx, { type: 'square', freq: 2600, freqEnd: 1800, start: t + s, dur: 0.03, vol: 0.03, dest: out });
    }
  },

  splash: (ctx, t, out) => {
    noise(ctx, { start: t, dur: 0.45, vol: 0.2, filter: 'bandpass', freq: 2400, freqEnd: 700, q: 1.2, dest: out });
    noise(ctx, { start: t + 0.05, dur: 0.3, vol: 0.08, filter: 'highpass', freq: 5000, dest: out });
  },

  chapuzon: (ctx, t, out) => {
    // ¡PLAF! El golpe seco de la panza y después el agua que sube y cae.
    tone(ctx, { type: 'sine', freq: 120, freqEnd: 40, start: t, dur: 0.25, vol: 0.4, dest: out });
    noise(ctx, { start: t, dur: 0.06, vol: 0.35, filter: 'lowpass', freq: 1800, dest: out });
    noise(ctx, { start: t + 0.04, dur: 1.0, vol: 0.22, filter: 'bandpass', freq: 1800, freqEnd: 500, q: 0.9, dest: out });
  },

  marco: (ctx, t, out) =>
    voice(ctx, out, t, [
      { f0: 230, f0End: 250, f1: 750, f2: 1250, dur: 0.24 },
      { f0: 210, f0End: 170, f1: 500, f2: 900, dur: 0.3 },
    ]),

  polo: (ctx, t, out) =>
    voice(ctx, out, t, [
      { f0: 260, f0End: 280, f1: 500, f2: 880, dur: 0.22 },
      { f0: 240, f0End: 200, f1: 480, f2: 850, dur: 0.3 },
    ]),

  carta: (ctx, t, out) => {
    noise(ctx, { start: t, dur: 0.06, vol: 0.2, filter: 'highpass', freq: 2500, dest: out });
    tone(ctx, { type: 'triangle', freq: 220, freqEnd: 120, start: t + 0.02, dur: 0.06, vol: 0.12, dest: out });
  },

  barajar: (ctx, t, out) => {
    for (let i = 0; i < 12; i++) noise(ctx, { start: t + i * 0.045, dur: 0.03, vol: 0.1, filter: 'highpass', freq: 3000 + (i % 3) * 600, dest: out });
  },

  mesa: (ctx, t, out) => {
    tone(ctx, { type: 'triangle', freq: 140, freqEnd: 55, start: t, dur: 0.18, vol: 0.45, dest: out });
    noise(ctx, { start: t, dur: 0.08, vol: 0.25, filter: 'lowpass', freq: 900, dest: out });
  },

  bocina_grover: (ctx, t, out) => {
    // «La Cucaracha» en bocina de minibús paceño: cinco notas cortas, dos veces.
    const seq = ['C5', 'C5', 'C5', 'F5', 'A5'];
    seq.forEach((n, i) => {
      const s = t + (i < 3 ? i * 0.11 : 0.33 + (i - 3) * 0.22);
      const len = i < 3 ? 0.08 : 0.2;
      tone(ctx, { type: 'square', freq: noteFreq(n), start: s, dur: len, vol: 0.05, sustain: true, dest: out });
      tone(ctx, { type: 'sawtooth', freq: noteFreq(n) * 1.01, start: s, dur: len, vol: 0.025, sustain: true, dest: out });
    });
  },

  loro: (ctx, t, out) => {
    for (const s of [0, 0.32]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 2;
      bp.connect(out);
      tone(ctx, { type: 'sawtooth', freq: 900, freqEnd: 1500, start: t + s, dur: 0.12, vol: 0.25, sustain: true, dest: bp });
      tone(ctx, { type: 'sawtooth', freq: 1500, freqEnd: 700, start: t + s + 0.12, dur: 0.14, vol: 0.2, dest: bp });
    }
  },

  ducha: (ctx, t, out) => {
    noise(ctx, { start: t, dur: 1.6, vol: 0.18, filter: 'highpass', freq: 2200, swell: true, dest: out });
  },
  complete: (ctx, t, out) => {
    notes(ctx, out, t, ['C5', 'E5', 'G5', 'C6'], 0.11, 'square', 0.07);
    for (const n of ['C5', 'E5', 'G5', 'C6']) {
      tone(ctx, { type: 'square', freq: noteFreq(n), start: t + 0.5, dur: 0.9, vol: 0.035, sustain: true, dest: out });
    }
    tone(ctx, { type: 'triangle', freq: noteFreq('C3'), start: t + 0.5, dur: 0.9, vol: 0.2, sustain: true, dest: out });
  },

  // --- Misión 6 ---
  enviado: (ctx, t, out) => tone(ctx, { type: 'sine', freq: 600, freqEnd: 1400, start: t, dur: 0.14, vol: 0.12, dest: out }),

  latido: (ctx, t, out) => {
    for (const s of [0, 0.22]) {
      tone(ctx, { type: 'sine', freq: 70, freqEnd: 45, start: t + s, dur: 0.16, vol: s ? 0.32 : 0.42, dest: out });
    }
  },

  gato: (ctx, t, out) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 3;
    bp.connect(out);
    tone(ctx, { type: 'sawtooth', freq: 520, freqEnd: 880, start: t, dur: 0.22, vol: 0.2, sustain: true, dest: bp });
    tone(ctx, { type: 'sawtooth', freq: 880, freqEnd: 430, start: t + 0.22, dur: 0.38, vol: 0.18, dest: bp });
  },

  fuegos: (ctx, t, out) => {
    // Silbido que sube y el ¡pum! con chispitas, lejos.
    const dest = far(ctx, out, 2600, 0.4);
    tone(ctx, { type: 'sine', freq: 500, freqEnd: 1800, start: t, dur: 0.6, vol: 0.05, dest });
    noise(ctx, { start: t + 0.62, dur: 0.5, vol: 0.4, filter: 'lowpass', freq: 600, dest });
    for (let i = 0; i < 8; i++) noise(ctx, { start: t + 0.7 + i * 0.06, dur: 0.04, vol: 0.06, filter: 'highpass', freq: 4000, dest });
  },

  burbujas: (ctx, t, out) => {
    for (let i = 0; i < 6; i++) {
      const f = 300 + Math.random() * 500;
      tone(ctx, { type: 'sine', freq: f, freqEnd: f * 2.2, start: t + i * 0.07, dur: 0.06, vol: 0.12, dest: out });
    }
  },

  raponazo: (ctx, t, out) => {
    noise(ctx, { start: t, dur: 0.25, vol: 0.3, filter: 'bandpass', freq: 900, freqEnd: 3500, q: 1.5, dest: out });
    tone(ctx, { type: 'square', freq: 330, freqEnd: 220, start: t + 0.05, dur: 0.12, vol: 0.06, dest: out });
  },

  apagon: (ctx, t, out) => {
    tone(ctx, { type: 'sawtooth', freq: 120, freqEnd: 30, start: t, dur: 0.9, vol: 0.12, dest: out });
    noise(ctx, { start: t + 0.05, dur: 0.06, vol: 0.2, filter: 'highpass', freq: 3000, dest: out });
  },

  linterna: (ctx, t, out) => {
    noise(ctx, { start: t, dur: 0.03, vol: 0.25, filter: 'highpass', freq: 3500, dest: out });
    tone(ctx, { type: 'square', freq: 1800, start: t, dur: 0.02, vol: 0.05, dest: out });
  },

  teclas: (ctx, t, out) => {
    for (let i = 0; i < 7; i++) {
      noise(ctx, { start: t + i * 0.09 + Math.random() * 0.03, dur: 0.025, vol: 0.22, filter: 'bandpass', freq: 2200, dest: out });
    }
    tone(ctx, { type: 'sine', freq: noteFreq('A6'), start: t + 0.72, dur: 0.25, vol: 0.08, dest: out });
  },

  salto: (ctx, t, out) => tone(ctx, { type: 'square', freq: 300, freqEnd: 700, start: t, dur: 0.12, vol: 0.06, dest: out }),

  golpe: (ctx, t, out) => {
    tone(ctx, { type: 'triangle', freq: 160, freqEnd: 60, start: t, dur: 0.15, vol: 0.4, dest: out });
    noise(ctx, { start: t, dur: 0.08, vol: 0.2, filter: 'lowpass', freq: 1200, dest: out });
  },
};
