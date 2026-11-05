/** Utilidades de síntesis chiptune sobre Web Audio. */

export interface ToneOptions {
  type: OscillatorType;
  freq: number;
  /** Frecuencia final (glissando exponencial). */
  freqEnd?: number;
  start: number;
  dur: number;
  vol: number;
  attack?: number;
  /** true: mantiene el volumen y suelta al final (notas largas); false: decae (pluck). */
  sustain?: boolean;
  dest: AudioNode;
}

export interface NoiseOptions {
  start: number;
  dur: number;
  vol: number;
  filter: BiquadFilterType;
  freq: number;
  freqEnd?: number;
  q?: number;
  /** true: sube y baja (rumores); false: decae. */
  swell?: boolean;
  dest: AudioNode;
}

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#5" → 73 (número MIDI). */
export function noteMidi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Nota inválida: ${name}`);
  const semi = SEMITONES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 12 * (Number(m[3]) + 1) + semi;
}

/** "C#5" → 554.37 Hz. */
export function noteFreq(name: string): number {
  return midiFreq(noteMidi(name));
}

export function midiFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

let noiseBuffer: AudioBuffer | null = null;

function getNoise(ctx: BaseAudioContext): AudioBuffer {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** Ruido blanco en loop infinito (ambiente: lluvia). Hay que detenerlo con `stop()`. */
export function noiseLoop(ctx: BaseAudioContext): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  src.loop = true;
  return src;
}

export function tone(ctx: BaseAudioContext, o: ToneOptions): void {
  const osc = ctx.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.freq, o.start);
  if (o.freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), o.start + o.dur);
  const g = ctx.createGain();
  const attack = o.attack ?? 0.004;
  const end = o.start + o.dur;
  g.gain.setValueAtTime(0, o.start);
  g.gain.linearRampToValueAtTime(o.vol, o.start + attack);
  if (o.sustain) {
    g.gain.setValueAtTime(o.vol, Math.max(o.start + attack, end - 0.04));
    g.gain.linearRampToValueAtTime(0, end);
  } else {
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  }
  osc.connect(g).connect(o.dest);
  osc.start(o.start);
  osc.stop(end + 0.02);
}

export function noise(ctx: BaseAudioContext, o: NoiseOptions): void {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = o.filter;
  filter.frequency.setValueAtTime(o.freq, o.start);
  if (o.freqEnd !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), o.start + o.dur);
  filter.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  const end = o.start + o.dur;
  g.gain.setValueAtTime(0, o.start);
  if (o.swell) {
    g.gain.linearRampToValueAtTime(o.vol, o.start + o.dur * 0.45);
    g.gain.linearRampToValueAtTime(0, end);
  } else {
    g.gain.linearRampToValueAtTime(o.vol, o.start + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  }
  src.connect(filter).connect(g).connect(o.dest);
  src.start(o.start, Math.random() * 0.5);
  src.stop(end + 0.02);
}

// --- Percusión ---

export function kick(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  tone(ctx, { type: 'triangle', freq: 160, freqEnd: 42, start: t, dur: 0.16, vol, dest });
}

export function snare(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  noise(ctx, { start: t, dur: 0.12, vol: vol * 0.8, filter: 'bandpass', freq: 1900, q: 0.8, dest });
  tone(ctx, { type: 'triangle', freq: 190, freqEnd: 120, start: t, dur: 0.07, vol: vol * 0.5, dest });
}

export function hat(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  noise(ctx, { start: t, dur: 0.035, vol, filter: 'highpass', freq: 7000, dest });
}
