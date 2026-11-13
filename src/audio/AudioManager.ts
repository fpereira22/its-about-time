import Phaser from 'phaser';
import { Controls } from '../systems/Controls';
import { EventSystem } from '../systems/EventSystem';
import { Settings } from '../systems/Settings';
import { StoryState } from '../systems/StoryState';
import { TRACKS, TrackPlayer } from './music';
import type { AmbientState, MusicTrack, SfxName, SkylineAmbient } from './sfx';
import { noiseLoop } from './synth';
import { SFX } from './sfxDefs';

/** Volúmenes al máximo de los ajustes (Settings escala música y efectos de 0 a 1). */
const MASTER_VOLUME = 0.8;
const MUSIC_VOLUME = 0.35;
const SFX_VOLUME = 0.6;
const GAIN_RAMP_S = 0.15;
/** Música más baja mientras un menú tiene el juego en pausa. */
const DUCKED = 0.5;
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
/** Mismo sfx repetido dentro de este intervalo se ignora (evita saturar). */
const SFX_MIN_GAP_S = 0.03;
/** Flags temporales que suenan cuando se activan. */
const FLAG_SFX: Record<string, SfxName> = { _timbre: 'bell' };
const MAP_SCENES = ['Overworld', 'Interior'];
/** Volumen y brillo de la lluvia: afuera, o adentro (como detrás de una ventana). */
const RAIN = {
  lluvia: { vol: 0.11, freq: 2400, indoorVol: 0.045, indoorFreq: 650 },
  tormenta: { vol: 0.2, freq: 3200, indoorVol: 0.08, indoorFreq: 800 },
} as const;
const AMBIENT_RAMP_S = 1.2;
/** Viento en lo alto: soplido (banda ancha), silbido (banda angosta, solo en ráfagas) y el murmullo de la ciudad. */
const WIND = { vol: 0.2, freqMin: 260, freqMax: 980, whistleVol: 0.05, whistleMin: 820, whistleMax: 1500, humVol: 0.06, ramp: 0.35 };

/**
 * Música y efectos sintetizados con Web Audio (sin archivos).
 * Escucha los eventos 'sfx' y 'music' de EventSystem; las escenas usan playSfx()/playMusic().
 * El AudioContext se crea con el primer gesto del usuario (política de autoplay).
 */
class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  /** Lluvia y viento: siguen el volumen de los efectos. */
  private ambientBus: GainNode | null = null;
  private player: TrackPlayer | null = null;
  private track: MusicTrack | null = null;
  /** Tempo forzado por la escena (undefined = el de la pista). */
  private bpm: number | undefined;
  private ducked = false;
  private sfxCount = 0;
  private readonly lastSfx = new Map<SfxName, number>();
  private flagState = new Map<string, boolean>();
  private game: Phaser.Game | null = null;
  private ambient: AmbientState = { rain: 'none', indoor: false };
  private ambientGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private skyline: SkylineAmbient = { wind: 0, hum: 0 };
  private windGain: GainNode | null = null;
  private windBand: BiquadFilterNode | null = null;
  private whistleGain: GainNode | null = null;
  private whistleBand: BiquadFilterNode | null = null;
  private humGain: GainNode | null = null;

  attach(game: Phaser.Game): void {
    this.game = game;
    EventSystem.on('sfx', (name) => this.play(name));
    EventSystem.on('music', (track, bpm) => this.setMusic(track, bpm));
    EventSystem.on('ambient', (state) => this.setAmbient(state));
    EventSystem.on('skyline-ambient', (state) => this.setSkyline(state));
    EventSystem.on('state-changed', () => this.watchFlags());
    EventSystem.on('settings-changed', () => this.applyVolumes());

    const unlock = (): void => this.unlock();
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('pointerdown', unlock, true);

    game.events.on(Phaser.Core.Events.STEP, () => {
      if (Controls.consume('mute')) this.toggleMute();
      this.updateDuck();
    });
    window.setInterval(() => this.tick(), TICK_MS);

    if (import.meta.env.DEV) {
      Object.assign(window, {
        __audio: {
          info: () => ({
            state: this.ctx?.state ?? 'none',
            track: this.track,
            playing: Boolean(this.player && !this.player.finished),
            muted: Settings.get('muted'),
            ducked: this.ducked,
            sfxCount: this.sfxCount,
          }),
        },
      });
    }
  }

  private unlock(): void {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.connect(this.master);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.connect(this.master);
        this.ambientBus = this.ctx.createGain();
        this.ambientBus.connect(this.master);
        this.applyVolumes(0);
        this.startTrack(this.track);
        this.startAmbient();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    } catch {
      // Navegador sin Web Audio: el juego sigue en silencio.
      this.ctx = null;
    }
  }

  private play(name: SfxName): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - (this.lastSfx.get(name) ?? -1) < SFX_MIN_GAP_S) return;
    this.lastSfx.set(name, now);
    this.sfxCount++;
    SFX[name](ctx, now + 0.005, this.sfxBus);
  }

  private setMusic(track: MusicTrack | null, bpm?: number): void {
    if (track === this.track && bpm === undefined && this.bpm === undefined && (track === null || this.player)) return;
    this.track = track;
    this.bpm = bpm;
    if (this.ctx) this.startTrack(track);
  }

  private startTrack(track: MusicTrack | null): void {
    if (!this.ctx || !this.musicBus) return;
    this.player?.fadeOut();
    this.player = track ? new TrackPlayer(this.ctx, TRACKS[track], this.musicBus, this.bpm) : null;
  }

  /** La lluvia suena siempre (en silencio si no llueve): así solo se ajusta su volumen. */
  private startAmbient(): void {
    if (!this.ctx || !this.ambientBus) return;
    const out = this.ambientBus;
    const src = noiseLoop(this.ctx);
    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0;
    src.connect(this.ambientFilter).connect(this.ambientGain).connect(out);
    src.start();
    this.applyAmbient(0.05);

    // Viento y ciudad: otra fuente de ruido (desfasada de la lluvia), en silencio hasta subir a un rooftop.
    const ctx = this.ctx;
    const band = (type: BiquadFilterType, freq: number, q: number): BiquadFilterNode => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    };
    const gain = (): GainNode => {
      const g = ctx.createGain();
      g.gain.value = 0;
      return g;
    };
    const wind = noiseLoop(ctx);
    this.windBand = band('bandpass', WIND.freqMin, 0.7);
    this.windGain = gain();
    this.whistleBand = band('bandpass', WIND.whistleMin, 22);
    this.whistleGain = gain();
    const humFilter = band('lowpass', 170, 0.5);
    this.humGain = gain();
    wind.connect(this.windBand).connect(this.windGain).connect(out);
    wind.connect(this.whistleBand).connect(this.whistleGain).connect(out);
    wind.connect(humFilter).connect(this.humGain).connect(out);
    wind.start(0, 0.37);
    this.applySkyline(0.05);
  }

  private setSkyline(state: SkylineAmbient): void {
    this.skyline = state;
    this.applySkyline(WIND.ramp);
  }

  private applySkyline(ramp: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.windGain || !this.windBand || !this.whistleGain || !this.whistleBand || !this.humGain) return;
    const w = Math.max(0, Math.min(1, this.skyline.wind));
    const gust = Math.max(0, (w - 0.45) / 0.55);
    const targets: Array<[AudioParam, number]> = [
      [this.windGain.gain, w * w * WIND.vol],
      [this.windBand.frequency, WIND.freqMin + (WIND.freqMax - WIND.freqMin) * w],
      [this.whistleGain.gain, gust * gust * WIND.whistleVol],
      [this.whistleBand.frequency, WIND.whistleMin + (WIND.whistleMax - WIND.whistleMin) * gust],
      [this.humGain.gain, Math.max(0, Math.min(1, this.skyline.hum)) * WIND.humVol],
    ];
    const now = ctx.currentTime;
    for (const [param, value] of targets) {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(value, now + ramp);
    }
  }

  private setAmbient(state: AmbientState): void {
    if (state.rain === this.ambient.rain && state.indoor === this.ambient.indoor) return;
    this.ambient = state;
    this.applyAmbient(AMBIENT_RAMP_S);
  }

  private applyAmbient(ramp: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.ambientGain || !this.ambientFilter) return;
    const def = this.ambient.rain === 'none' ? null : RAIN[this.ambient.rain];
    const vol = def ? (this.ambient.indoor ? def.indoorVol : def.vol) : 0;
    const freq = def ? (this.ambient.indoor ? def.indoorFreq : def.freq) : 1000;
    const now = ctx.currentTime;
    for (const [param, value] of [[this.ambientGain.gain, vol], [this.ambientFilter.frequency, freq]] as const) {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(value, now + ramp);
    }
  }

  private tick(): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.player) return;
    this.player.schedule(this.ctx.currentTime + LOOKAHEAD_S);
  }

  /** La tecla M: el silencio queda en los ajustes (y applyVolumes lo aplica). */
  private toggleMute(): void {
    const muted = !Settings.get('muted');
    Settings.set('muted', muted);
    EventSystem.emit('banner', { title: muted ? 'Sonido: silenciado' : 'Sonido: activado', subtitle: 'Tecla M' });
  }

  private updateDuck(): void {
    const game = this.game;
    if (!game || !this.ctx || !this.musicBus) return;
    const ducked = MAP_SCENES.some((key) => game.scene.isPaused(key));
    if (ducked === this.ducked) return;
    this.ducked = ducked;
    this.applyVolumes(0.2);
  }

  /** Lleva los buses al volumen de los ajustes (silencio, música con su "duck" en pausa, efectos). */
  private applyVolumes(ramp = GAIN_RAMP_S): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.musicBus || !this.sfxBus || !this.ambientBus) return;
    const targets: Array<[AudioParam, number]> = [
      [this.master.gain, Settings.get('muted') ? 0 : MASTER_VOLUME],
      [this.musicBus.gain, MUSIC_VOLUME * Settings.musicGain() * (this.ducked ? DUCKED : 1)],
      [this.sfxBus.gain, SFX_VOLUME * Settings.sfxGain()],
      [this.ambientBus.gain, Settings.sfxGain()],
    ];
    const now = ctx.currentTime;
    for (const [param, value] of targets) {
      param.cancelScheduledValues(now);
      if (ramp <= 0) {
        param.setValueAtTime(value, now);
        continue;
      }
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(value, now + ramp);
    }
  }

  private watchFlags(): void {
    for (const [flag, sfx] of Object.entries(FLAG_SFX)) {
      const on = StoryState.hasFlag(flag);
      if (on && !this.flagState.get(flag)) this.play(sfx);
      this.flagState.set(flag, on);
    }
  }
}

export const AudioManager = new AudioManagerImpl();
