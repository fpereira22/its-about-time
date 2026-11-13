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
  // Antes de su primer evento un gain vale 1: sin esto, el golpe puede arrancar con un clic de una muestra.
  g.gain.value = 0;
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
  filter.frequency.value = o.freq;
  filter.frequency.setValueAtTime(o.freq, o.start);
  if (o.freqEnd !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), o.start + o.dur);
  filter.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  // Antes de su primer evento un gain vale 1: sin esto, el golpe puede arrancar con un clic de una muestra.
  g.gain.value = 0;
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

// --- Percusión latina (salsa) ---
// Todo sintetizado: parches con caída de tono + golpe de ruido, campanas con dos cuadradas desafinadas.

/** Un parche de cuero: tono que cae un poco al golpear + un parcial inarmónico, más el chasquido de la mano. */
function membrane(
  ctx: BaseAudioContext,
  t: number,
  dest: AudioNode,
  o: { freq: number; vol: number; dur: number; bend?: number; slap?: number; slapFreq?: number },
): void {
  const bend = o.bend ?? 1.25;
  tone(ctx, { type: 'sine', freq: o.freq * bend, freqEnd: o.freq, start: t, dur: o.dur, vol: o.vol, attack: 0.002, dest });
  tone(ctx, { type: 'sine', freq: o.freq * 1.59 * bend, freqEnd: o.freq * 1.59, start: t, dur: o.dur * 0.45, vol: o.vol * 0.35, attack: 0.002, dest });
  noise(ctx, { start: t, dur: 0.03, vol: o.vol * (o.slap ?? 0.25), filter: 'bandpass', freq: o.slapFreq ?? 1800, q: 1.2, dest });
}

/** Conga: golpe abierto que canta. */
export function congaOpen(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  membrane(ctx, t, dest, { freq: 262, vol, dur: 0.32 });
}

/** Tumbadora: el abierto grave (el "bum" del final del compás). */
export function tumba(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  membrane(ctx, t, dest, { freq: 196, vol, dur: 0.42, bend: 1.18 });
}

/** Slap (tapao): seco, alto y chasqueado. */
export function congaSlap(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  noise(ctx, { start: t, dur: 0.07, vol: vol * 0.9, filter: 'bandpass', freq: 2400, freqEnd: 1300, q: 1.6, dest });
  tone(ctx, { type: 'triangle', freq: 420, freqEnd: 330, start: t, dur: 0.06, vol: vol * 0.5, attack: 0.001, dest });
}

/** Talón (el "bajo" de la mano): golpe apagado que lleva el pulso. */
export function congaHeel(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  tone(ctx, { type: 'sine', freq: 150, freqEnd: 110, start: t, dur: 0.07, vol: vol * 0.55, attack: 0.002, dest });
  noise(ctx, { start: t, dur: 0.025, vol: vol * 0.12, filter: 'lowpass', freq: 900, dest });
}

/** Punta de los dedos: el "tic" suavecito entre talón y talón. */
export function congaTip(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  noise(ctx, { start: t, dur: 0.03, vol: vol * 0.3, filter: 'bandpass', freq: 1500, q: 1.5, dest });
  tone(ctx, { type: 'sine', freq: 300, start: t, dur: 0.04, vol: vol * 0.2, attack: 0.001, dest });
}

/** Bongó, macho (el agudo). */
export function bongoHigh(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  membrane(ctx, t, dest, { freq: 470, vol: vol * 0.8, dur: 0.12, bend: 1.12, slap: 0.4, slapFreq: 3200 });
}

/** Bongó, hembra (el grave). */
export function bongoLow(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  membrane(ctx, t, dest, { freq: 330, vol: vol * 0.85, dur: 0.16, bend: 1.12, slap: 0.35, slapFreq: 2600 });
}

/** Cencerro: dos cuadradas desafinadas por un pasabanda, con caída en dos tiempos. */
function bell(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode, f1: number, f2: number, dur: number): void {
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = (f1 + f2) * 1.6;
  bp.Q.value = 1.1;
  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.001);
  g.gain.exponentialRampToValueAtTime(vol * 0.25, t + 0.025);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  bp.connect(g).connect(dest);
  for (const f of [f1, f2]) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f;
    osc.connect(bp);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

/** Campana de bongó, golpe en la boca (abierto, grave). */
export function bellMouth(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  bell(ctx, t, vol, dest, 540, 800, 0.32);
}

/** Campana de bongó, golpe en el cuello (corto, más agudo). */
export function bellNeck(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  bell(ctx, t, vol * 0.7, dest, 600, 890, 0.09);
}

/** La campanita del timbal (mambo): más chica y brillante. */
export function timbalBell(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  bell(ctx, t, vol * 0.75, dest, 830, 1250, 0.16);
}

/** Clave: dos palos de madera, un "tok" seco y agudo. */
export function clave(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  tone(ctx, { type: 'sine', freq: 2500, start: t, dur: 0.06, vol, attack: 0.001, dest });
  tone(ctx, { type: 'sine', freq: 2500 * 2.76, start: t, dur: 0.02, vol: vol * 0.25, attack: 0.001, dest });
}

/** Cáscara: palitos en el costado del timbal. */
export function cascara(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  noise(ctx, { start: t, dur: 0.035, vol: vol * 0.7, filter: 'bandpass', freq: 3800, q: 2.5, dest });
  tone(ctx, { type: 'triangle', freq: 1150, start: t, dur: 0.035, vol: vol * 0.35, attack: 0.001, dest });
}

/** Timbal (paila): parche metálico con anillo. */
export function timbal(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode, low = false): void {
  const f = low ? 280 : 380;
  tone(ctx, { type: 'sine', freq: f * 1.1, freqEnd: f, start: t, dur: 0.35, vol: vol * 0.7, attack: 0.001, dest });
  tone(ctx, { type: 'triangle', freq: f * 2.31, start: t, dur: 0.2, vol: vol * 0.2, attack: 0.001, dest });
  noise(ctx, { start: t, dur: 0.18, vol: vol * 0.5, filter: 'bandpass', freq: 5200, freqEnd: 3000, q: 1.2, dest });
}

/** Güiro: raspado largo (varias rayitas que crecen) o corto (una pasada rápida). */
export function guiro(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode, long: boolean): void {
  const ticks = long ? 9 : 3;
  const span = long ? 0.13 : 0.035;
  for (let i = 0; i < ticks; i++) {
    const v = long ? 0.35 + (0.65 * i) / ticks : 0.8;
    noise(ctx, { start: t + (span * i) / ticks, dur: 0.012, vol: vol * v, filter: 'bandpass', freq: 3600, q: 3, dest });
  }
}

/** Maracas: un "chk" de semillas. */
export function maraca(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  noise(ctx, { start: t, dur: 0.05, vol: vol * 0.45, filter: 'highpass', freq: 6000, dest });
}

/** Palmas: tres golpecitos de ruido casi juntos, el último con cola. */
export function palmas(ctx: BaseAudioContext, t: number, vol: number, dest: AudioNode): void {
  noise(ctx, { start: t, dur: 0.012, vol: vol * 0.6, filter: 'bandpass', freq: 1300, q: 1.4, dest });
  noise(ctx, { start: t + 0.009, dur: 0.012, vol: vol * 0.7, filter: 'bandpass', freq: 1300, q: 1.4, dest });
  noise(ctx, { start: t + 0.019, dur: 0.11, vol, filter: 'bandpass', freq: 1300, q: 1.4, dest });
}

// --- Voces "de orquesta" ---
// Cada una se escala por dentro para que su `vol` suene parecido al de una onda simple con el mismo número.

function osc(ctx: BaseAudioContext, type: OscillatorType, freq: number, gain: number, start: number, end: number, dest: AudioNode): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = gain;
  o.connect(g).connect(dest);
  o.start(start);
  o.stop(end + 0.05);
  return o;
}

/** Piano: ataque duro y caída larga, con un filtro que se va cerrando (no suena a 8 bits). */
export function piano(ctx: BaseAudioContext, freq: number, start: number, dur: number, volume: number, dest: AudioNode): void {
  const vol = volume * 0.4;
  const end = start + Math.min(dur + 0.12, 1.4);
  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.003);
  g.gain.exponentialRampToValueAtTime(vol * 0.35, start + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(9000, freq * 9), start);
  lp.frequency.exponentialRampToValueAtTime(Math.min(4000, freq * 3), start + 0.25);
  lp.connect(g).connect(dest);
  osc(ctx, 'triangle', freq, 1, start, end, lp);
  osc(ctx, 'sawtooth', freq * 1.002, 0.18, start, end, lp);
  osc(ctx, 'sine', freq * 2, 0.25, start, end, lp);
}

/**
 * Metales (trompeta/trombón): dos sierras desafinadas con un filtro que se abre al soplar
 * (el brillo del ataque), el labio buscando la nota y un vibrato tardío en las notas largas.
 */
export function brass(ctx: BaseAudioContext, freq: number, start: number, dur: number, volume: number, dest: AudioNode): void {
  const vol = volume * 0.6;
  const end = start + dur;
  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.025);
  g.gain.setValueAtTime(vol * 0.85, Math.max(start + 0.03, end - 0.05));
  g.gain.linearRampToValueAtTime(0, end + 0.03);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2;
  lp.frequency.setValueAtTime(freq * 1.5, start);
  lp.frequency.linearRampToValueAtTime(Math.min(7000, freq * 7), start + 0.04);
  lp.frequency.exponentialRampToValueAtTime(Math.min(4500, freq * 4), start + 0.18);
  lp.connect(g).connect(dest);
  let depth: GainNode | null = null;
  if (dur > 0.35) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    depth = ctx.createGain();
    depth.gain.value = 0;
    depth.gain.setValueAtTime(0, start + 0.2);
    depth.gain.linearRampToValueAtTime(freq * 0.012, end);
    lfo.connect(depth);
    lfo.start(start);
    lfo.stop(end + 0.05);
  }
  for (const d of [0.996, 1.004]) {
    const o = osc(ctx, 'sawtooth', freq * d, 1, start, end + 0.03, lp);
    o.frequency.setValueAtTime(freq * d * 0.97, start);
    o.frequency.exponentialRampToValueAtTime(freq * d, start + 0.03);
    if (depth) depth.connect(o.frequency);
  }
}

/** Baby bass (el bajo vertical eléctrico de la salsa): redondo, con golpe de dedo y mucha cola. */
export function babyBass(ctx: BaseAudioContext, freq: number, start: number, dur: number, volume: number, dest: AudioNode): void {
  const vol = volume * 0.16;
  const end = start + dur;
  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.006);
  const knee = Math.min(start + 0.15, end - 0.01);
  g.gain.exponentialRampToValueAtTime(vol * 0.6, knee);
  g.gain.setValueAtTime(vol * 0.6, Math.max(knee, end - 0.05));
  g.gain.linearRampToValueAtTime(0, end + 0.02);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(freq * 6, start);
  lp.frequency.exponentialRampToValueAtTime(freq * 2.5, start + 0.12);
  lp.connect(g).connect(dest);
  const parts: Array<[OscillatorType, number, number]> = [['sine', 1, 1], ['triangle', 1, 0.5], ['sine', 2, 0.15]];
  for (const [type, mul, v] of parts) {
    const o = osc(ctx, type, freq * mul, v, start, end + 0.02, lp);
    o.frequency.setValueAtTime(freq * mul * 1.02, start);
    o.frequency.exponentialRampToValueAtTime(freq * mul, start + 0.04);
  }
}
