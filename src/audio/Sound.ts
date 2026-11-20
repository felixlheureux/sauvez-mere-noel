/**
 * All sound is synthesized with the Web Audio API — no audio files to load.
 * Music: a music-box "Vive le vent" (Jingle Bells, public domain) that gets
 * more distorted as the levels get darker.
 */

type Note = readonly [semitone: number | null, beats: number];

// "Vive le vent" / Jingle Bells chorus. Semitones relative to C5 (null = rest).
const E = 4;
const G = 7;
const C = 0;
const D = 2;
const F = 5;
const MELODY: Note[] = [
  [E, 1],
  [E, 1],
  [E, 2],
  [E, 1],
  [E, 1],
  [E, 2],
  [E, 1],
  [G, 1],
  [C, 1.5],
  [D, 0.5],
  [E, 4],
  [F, 1],
  [F, 1],
  [F, 1.5],
  [F, 0.5],
  [F, 1],
  [E, 1],
  [E, 1],
  [E, 0.5],
  [E, 0.5],
  [E, 1],
  [D, 1],
  [D, 1],
  [E, 1],
  [D, 2],
  [G, 2],
  [E, 1],
  [E, 1],
  [E, 2],
  [E, 1],
  [E, 1],
  [E, 2],
  [E, 1],
  [G, 1],
  [C, 1.5],
  [D, 0.5],
  [E, 4],
  [F, 1],
  [F, 1],
  [F, 1.5],
  [F, 0.5],
  [F, 1],
  [E, 1],
  [E, 1],
  [E, 0.5],
  [E, 0.5],
  [G, 1],
  [G, 1],
  [F, 1],
  [D, 1],
  [C, 4],
];
const BASS: Note[] = [
  [-12, 4],
  [-12, 4],
  [-12, 4],
  [-17, 4],
  [-7, 4],
  [-12, 4],
  [-10, 4],
  [-17, 4],
  [-12, 4],
  [-12, 4],
  [-12, 4],
  [-17, 4],
  [-7, 4],
  [-12, 4],
  [-17, 4],
  [-12, 4],
];

// "Douce nuit" / Silent Night (Gruber, 1818), in 3/4.
const SILENT: Note[] = [
  [-5, 1.5],
  [-3, 0.5],
  [-5, 1],
  [-8, 3],
  [-5, 1.5],
  [-3, 0.5],
  [-5, 1],
  [-8, 3],
  [2, 2],
  [2, 1],
  [-1, 3],
  [0, 2],
  [0, 1],
  [-5, 3],
  [-3, 2],
  [-3, 1],
  [0, 1.5],
  [-1, 0.5],
  [-3, 1],
  [-5, 1.5],
  [-3, 0.5],
  [-5, 1],
  [-8, 3],
  [-3, 2],
  [-3, 1],
  [0, 1.5],
  [-1, 0.5],
  [-3, 1],
  [-5, 1.5],
  [-3, 0.5],
  [-5, 1],
  [-8, 3],
  [2, 2],
  [2, 1],
  [5, 1.5],
  [2, 0.5],
  [-1, 1],
  [0, 3],
  [4, 3],
  [0, 1],
  [-5, 1],
  [-8, 1],
  [-5, 1.5],
  [-7, 0.5],
  [-10, 1],
  [-12, 6],
];
const SILENT_BASS: Note[] = [
  [-12, 3],
  [-12, 3],
  [-17, 3],
  [-12, 3],
];

// "We Wish You a Merry Christmas" (traditional), in 3/4.
const WEWISH: Note[] = [
  [-5, 1],
  [0, 1],
  [0, 0.5],
  [2, 0.5],
  [0, 0.5],
  [-1, 0.5],
  [-3, 1],
  [-3, 1],
  [-3, 1],
  [2, 1],
  [2, 0.5],
  [4, 0.5],
  [2, 0.5],
  [0, 0.5],
  [-1, 1],
  [-5, 1],
  [-5, 1],
  [4, 1],
  [4, 0.5],
  [5, 0.5],
  [4, 0.5],
  [2, 0.5],
  [0, 1],
  [-3, 1],
  [-5, 0.5],
  [-5, 0.5],
  [-3, 1],
  [2, 1],
  [-1, 1],
  [0, 3],
];
const WEWISH_BASS: Note[] = [
  [null, 1],
  [-12, 3],
  [-15, 3],
  [-10, 3],
  [-17, 3],
  [-8, 3],
  [-7, 3],
  [-15, 3],
  [-17, 3],
  [-12, 3],
];

/** An original fiddle-style reel for the sugar shack (Level 4). */
const REEL: Note[] = [
  [2, 0.5],
  [6, 0.5],
  [9, 0.5],
  [6, 0.5],
  [14, 0.5],
  [9, 0.5],
  [6, 0.5],
  [9, 0.5],
  [7, 0.5],
  [11, 0.5],
  [14, 0.5],
  [11, 0.5],
  [9, 0.5],
  [6, 0.5],
  [4, 0.5],
  [2, 0.5],
  [2, 0.5],
  [6, 0.5],
  [9, 0.5],
  [6, 0.5],
  [14, 0.5],
  [9, 0.5],
  [6, 0.5],
  [9, 0.5],
  [7, 0.5],
  [6, 0.5],
  [4, 0.5],
  [2, 0.5],
  [-3, 0.5],
  [-1, 0.5],
  [2, 0.5],
  [null, 0.5],
  [14, 0.5],
  [16, 0.5],
  [18, 0.5],
  [16, 0.5],
  [14, 0.5],
  [11, 0.5],
  [9, 0.5],
  [11, 0.5],
  [7, 0.5],
  [9, 0.5],
  [11, 0.5],
  [14, 0.5],
  [9, 0.5],
  [6, 0.5],
  [2, 0.5],
  [6, 0.5],
  [14, 0.5],
  [16, 0.5],
  [18, 0.5],
  [16, 0.5],
  [14, 0.5],
  [11, 0.5],
  [9, 0.5],
  [6, 0.5],
  [7, 0.5],
  [4, 0.5],
  [6, 0.5],
  [4, 0.5],
  [2, 0.5],
  [null, 0.5],
  [2, 0.5],
  [null, 0.5],
];
const REEL_BASS: Note[] = [
  [-10, 2],
  [-17, 2],
  [-15, 2],
  [-10, 2],
  [-10, 2],
  [-17, 2],
  [-15, 2],
  [-10, 2],
  [-10, 2],
  [-17, 2],
  [-12, 2],
  [-15, 2],
  [-10, 2],
  [-17, 2],
  [-15, 2],
  [-10, 2],
];

/** "Les anges dans nos campagnes" (traditional French carol, public domain). */
const ANGES: Note[] = [
  [-3, 1],
  [-3, 1],
  [-3, 1],
  [0, 1],
  [0, 1.5],
  [-2, 0.5],
  [-3, 2],
  [-3, 1],
  [-5, 1],
  [-3, 1],
  [0, 1],
  [-3, 1.5],
  [-5, 0.5],
  [-7, 2],
  [-3, 1],
  [-3, 1],
  [-3, 1],
  [0, 1],
  [0, 1.5],
  [-2, 0.5],
  [-3, 2],
  [-3, 1],
  [-5, 1],
  [-3, 1],
  [0, 1],
  [-3, 1.5],
  [-5, 0.5],
  [-7, 2],
  [0, 1.5],
  [2, 0.5],
  [0, 0.5],
  [-2, 0.5],
  [0, 1.5],
  [-2, 0.5],
  [-3, 0.5],
  [-5, 0.5],
  [-3, 1.5],
  [-5, 0.5],
  [-7, 0.5],
  [-5, 0.5],
  [-3, 1],
  [-7, 1],
  [-5, 2],
  [-3, 1],
  [0, 1],
  [-2, 1],
  [-3, 1],
  [-5, 2],
  [-7, 2],
  [0, 1.5],
  [2, 0.5],
  [0, 0.5],
  [-2, 0.5],
  [0, 1.5],
  [-2, 0.5],
  [-3, 0.5],
  [-5, 0.5],
  [-3, 1.5],
  [-5, 0.5],
  [-7, 0.5],
  [-5, 0.5],
  [-3, 1],
  [-7, 1],
  [-5, 2],
  [-3, 1],
  [0, 1],
  [-2, 1],
  [-3, 1],
  [-5, 2],
  [-7, 2],
];
const ANGES_BASS: Note[] = [
  [-19, 4],
  [-12, 4],
  [-19, 4],
  [-12, 2],
  [-19, 4],
  [-12, 4],
  [-19, 4],
  [-12, 2],
  [-12, 4],
  [-17, 4],
  [-14, 4],
  [-12, 4],
  [-19, 4],
  [-19, 3],
  [-12, 4],
  [-17, 4],
  [-14, 4],
  [-12, 4],
  [-19, 4],
  [-19, 3],
];

export type Theme = "jingle" | "silent" | "wewish" | "reel" | "anges";

const THEMES: Record<Theme, { melody: Note[]; bass: Note[]; beat: number }> = {
  jingle: { melody: MELODY, bass: BASS, beat: 0.24 },
  silent: { melody: SILENT, bass: SILENT_BASS, beat: 0.34 },
  wewish: { melody: WEWISH, bass: WEWISH_BASS, beat: 0.2 },
  reel: { melody: REEL, bass: REEL_BASS, beat: 0.27 },
  anges: { melody: ANGES, bass: ANGES_BASS, beat: 0.3 },
};

const freq = (semi: number, base = 523.25) => base * 2 ** (semi / 12);
/** The volume slider's 100% maps to this gain (about -15 dB): a fight measured -11.5 dBFS RMS
 *  and clipped at full gain (tests/e2e/loudness.py). */
const HEADROOM = 0.18;
/** Music at full music volume, applied after the distortion (so the drive never makes it louder). */
const MUSIC_GAIN = 0.13;
/** Carols in the order they rotate in after each rest. */
const ROTATION: Theme[] = ["jingle", "wewish", "reel", "anges", "silent"];

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  /** Hard-clipped path into the SFX bus: gunshots, gore and blasts go through it for grit. */
  private grit!: WaveShaperNode;
  private shaper!: WaveShaperNode;
  private musicFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private melodyIndex = 0;
  private bassIndex = 0;
  private bassTime = 0;
  private darkness = 0;
  /** The carol playing now: starts on the level's, then rotates through the others. */
  private playing: Theme = "jingle";
  /** Passes through the carol so far (see scheduleMusic). */
  private pass = 0;
  private restUntil = 0;
  private volume = 0.75;
  private musicVolume = 0.75;
  private musicLevel!: GainNode;
  musicOn = true;

  /** Audio is running (unlock() was called from a user gesture). */
  get ready() {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume * HEADROOM;
    // Limiter: a pile-up of shots and explosions gets squashed instead of clipping.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.2;
    this.master.connect(limiter);
    limiter.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.7;
    this.sfxBus.connect(this.master);
    this.grit = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / 1023) * 2 - 1) * 6);
    this.grit.curve = curve;
    this.grit.oversample = "2x";
    const gritLevel = ctx.createGain();
    gritLevel.gain.value = 0.35;
    this.grit.connect(gritLevel).connect(this.sfxBus);
    // musicBus (fades) -> distortion -> filter -> music level -> master.
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 1;
    this.musicLevel = ctx.createGain();
    this.musicLevel.gain.value = MUSIC_GAIN * this.musicVolume;
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 9000;
    this.shaper = ctx.createWaveShaper();
    this.setDistortion(0);
    this.musicBus.connect(this.shaper);
    this.shaper.connect(this.musicFilter);
    this.musicFilter.connect(this.musicLevel).connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /** Master volume, 0–1. */
  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v * HEADROOM, this.ctx.currentTime, 0.05);
  }

  /** Music volume, 0–1 (on top of the master volume). */
  setMusicVolume(v: number) {
    this.musicVolume = v;
    if (this.ctx) this.musicLevel.gain.setTargetAtTime(MUSIC_GAIN * v, this.ctx.currentTime, 0.05);
  }

  /** Which carol the music box plays (one per level). */
  setTheme(theme: Theme) {
    this.playing = theme;
    this.pass = 0;
    this.restUntil = 0;
    this.melodyIndex = 0;
    this.bassIndex = 0;
  }

  /** 0 = cute music box, 1 = full horror. */
  setDarkness(d: number) {
    this.darkness = d;
    if (!this.ctx) return;
    this.setDistortion(d);
    this.musicFilter.frequency.setTargetAtTime(9000 - d * 6500, this.ctx.currentTime, 0.3);
  }

  private setDistortion(amount: number) {
    const k = amount * 60;
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      // Divided back down so the darker music is grittier, not louder.
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x)) / (1 + k * 0.03);
    }
    this.shaper.curve = curve;
  }

  // ---------- Music ----------

  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(1, this.ctx.currentTime, 0.2);
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.bassTime = this.nextNoteTime;
    this.melodyIndex = 0;
    this.bassIndex = 0;
    this.restUntil = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 50);
  }

  /** Stop the music. `cut` = abrupt (for the twist). */
  stopMusic(cut = false) {
    if (!this.ctx || this.musicTimer === null) return;
    window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(0, t, cut ? 0.01 : 0.4);
  }

  /**
   * The music comes in waves so it doesn't loop forever: the carol, then a softer
   * variation an octave down (no drums), then a few seconds of silence, then the next carol.
   */
  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn) return;
    if (ctx.currentTime + 0.3 < this.restUntil) return;
    const theme = THEMES[this.playing];
    const beat = theme.beat - this.darkness * 0.03;
    const variation = this.pass % 2 === 1;
    while (this.nextNoteTime < ctx.currentTime + 0.3) {
      const [semi, beats] = (theme.melody[this.melodyIndex] ?? [null, 1]) as Note;
      if (semi !== null) {
        const note = semi + (this.darkness > 0.5 ? -1 : 0) - (variation ? 12 : 0);
        this.musicBoxNote(freq(note), this.nextNoteTime, variation ? 0.6 : 1);
      }
      this.nextNoteTime += beats * beat;
      // The bass keeps pace with the melody, so a pass ends on both together.
      while (this.bassTime < this.nextNoteTime) {
        const [b, len] = (theme.bass[this.bassIndex % theme.bass.length] ?? [null, 1]) as Note;
        if (b !== null) {
          this.bassNote(freq(b, 261.6), this.bassTime, len * beat);
          if (this.darkness > 0.2 && !variation) {
            for (let k = 0; k < len; k++) this.kick(this.bassTime + k * beat, this.darkness);
          }
        }
        this.bassTime += len * beat;
        this.bassIndex++;
      }
      this.melodyIndex++;
      if (this.melodyIndex >= theme.melody.length) {
        this.endPass(this.nextNoteTime);
        return;
      }
    }
  }

  /** A pass through the carol ended at `t`: next pass, or a rest and a new carol. */
  private endPass(t: number) {
    this.pass++;
    let start = t;
    if (this.pass % 2 === 0) {
      start = t + 4 + Math.random() * 4;
      this.restUntil = start;
      const i = ROTATION.indexOf(this.playing);
      this.playing = ROTATION[(i + 1) % ROTATION.length] as Theme;
    }
    this.melodyIndex = 0;
    this.bassIndex = 0;
    this.nextNoteTime = start;
    this.bassTime = start;
  }

  private musicBoxNote(f: number, t: number, level = 1) {
    const ctx = this.ctx as AudioContext;
    for (const [mult, gain] of [
      [1, 0.25],
      [2, 0.08],
      [3.01, 0.04],
    ] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = this.darkness > 0.5 ? "sawtooth" : "sine";
      o.frequency.value = f * mult;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain * level, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(this.musicBus);
      o.start(t);
      o.stop(t + 1);
    }
  }

  private bassNote(f: number, t: number, dur: number) {
    const ctx = this.ctx as AudioContext;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = f / 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number, amt: number) {
    const ctx = this.ctx as AudioContext;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.3 * amt, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.25);
  }

  // ---------- SFX ----------

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    gain = 0.3,
    when = 0,
    out: AudioNode = this.sfxBus,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(
    dur: number,
    freqHz: number,
    q = 1,
    gain = 0.4,
    type: BiquadFilterType = "bandpass",
    when = 0,
    out: AudioNode = this.sfxBus,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freqHz;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  jump() {
    this.tone("sine", 320, 720, 0.14, 0.18);
  }
  doubleJump() {
    this.tone("sine", 520, 1100, 0.16, 0.16);
    this.tone("triangle", 1300, 1800, 0.1, 0.06, 0.04);
  }
  land(hard = false) {
    this.burst(hard ? 0.2 : 0.1, hard ? 300 : 500, 0.8, hard ? 0.4 : 0.15, "lowpass");
  }
  dash() {
    this.burst(0.22, 1800, 0.6, 0.25, "bandpass");
  }
  /** Wet noise with a falling filter: the squelch under every gore sound. */
  private squelch(gain: number, when = 0, from = 1400, to = 180, dur = 0.18) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 5;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.grit);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** The body of a gunshot: a clipped crack and a low boom. Bigger `size`, bigger gun. */
  private blast(size: number) {
    this.burst(0.03 + size * 0.03, 3500, 0.6, 0.9, "highpass", 0, this.grit);
    this.burst(0.08 + size * 0.15, 700, 0.6, 0.5 + size * 0.3, "lowpass", 0, this.grit);
    this.tone("sine", 150 + size * 20, 38, 0.1 + size * 0.2, 0.6 + size * 0.4, 0, this.grit);
  }

  punch() {
    this.burst(0.06, 900, 1, 0.3);
    this.tone("sine", 160, 60, 0.12, 0.35);
  }
  whoosh() {
    this.burst(0.18, 1200, 2, 0.15);
  }
  bounce() {
    this.tone("sine", 200, 900, 0.25, 0.25);
  }
  capGun() {
    this.blast(0.4);
    this.tone("square", 900, 200, 0.05, 0.08);
  }
  shotgun() {
    this.blast(1);
    this.burst(0.15, 3000, 0.7, 0.4, "highpass");
    this.burst(0.7, 400, 0.5, 0.3, "lowpass", 0.06);
  }
  pump() {
    this.burst(0.05, 1800, 2, 0.25, "bandpass", 0.25);
    this.burst(0.05, 1400, 2, 0.25, "bandpass", 0.38);
  }
  /** A bullet going into flesh (`gory` off: confetti mode, just a thwack). */
  hit(gory = true) {
    this.burst(0.08, 600, 1.2, 0.35);
    if (!gory) return;
    this.tone("sine", 190, 55, 0.1, 0.5, 0, this.grit);
    this.squelch(0.7, 0, 1600 + Math.random() * 600, 250, 0.12);
  }
  /** A body bursting: a wet boom, bones cracking, a death squeal and the splatter landing. */
  splat() {
    this.burst(0.35, 380, 0.9, 0.8, "lowpass", 0, this.grit);
    this.tone("sine", 140, 30, 0.4, 0.9, 0, this.grit);
    for (let i = 0; i < 3; i++)
      this.squelch(0.9, i * 0.06 + Math.random() * 0.03, 2200 - i * 400, 160, 0.22);
    for (let i = 0; i < 4; i++)
      this.burst(
        0.025,
        2500 + Math.random() * 2000,
        3,
        0.5,
        "bandpass",
        0.02 + Math.random() * 0.12,
        this.grit,
      );
    const f = 800 + Math.random() * 400;
    this.tone("sawtooth", f, f * 0.25, 0.35, 0.12, 0.03);
    for (let i = 0; i < 5; i++) this.squelch(0.35, 0.3 + Math.random() * 0.5, 900, 300, 0.08);
  }
  confettiPop() {
    this.tone("sine", 600, 1400, 0.1, 0.2);
    this.burst(0.15, 4000, 1, 0.15, "highpass");
  }
  slam() {
    this.tone("sine", 120, 30, 0.45, 0.6);
    this.burst(0.4, 250, 0.7, 0.5, "lowpass");
  }
  hurt() {
    this.tone("sawtooth", 200, 90, 0.25, 0.3, 0, this.grit);
    this.tone("sine", 130, 45, 0.18, 0.5);
    this.squelch(0.5, 0, 900, 200, 0.12);
  }
  bell() {
    for (const [f, d] of [
      [1318, 0],
      [1760, 0.08],
      [2637, 0.16],
    ] as const) {
      this.tone("sine", f, f * 0.99, 0.6, 0.15, d);
    }
  }
  pickup() {
    this.tone("sine", 660, 990, 0.12, 0.2);
    this.tone("sine", 990, 1320, 0.12, 0.15, 0.08);
  }
  /** Rising pitch as you chain candies along a trail. */
  candy(n = 0) {
    const f = 880 * 2 ** (((n % 12) * 2) / 12);
    this.tone("sine", f, f * 1.01, 0.12, 0.12);
    this.tone("triangle", f * 1.5, f * 1.5, 0.08, 0.05, 0.03);
  }
  powerUp() {
    for (let i = 0; i < 5; i++)
      this.tone("square", 440 * 2 ** (i / 4), 440 * 2 ** ((i + 1) / 4), 0.09, 0.07, i * 0.06);
  }
  heal() {
    this.tone("triangle", 440, 880, 0.3, 0.2);
  }
  smash() {
    this.burst(0.3, 1200, 0.5, 0.35, "lowpass");
    this.tone("sine", 300, 80, 0.2, 0.2);
  }
  giggle() {
    for (let i = 0; i < 4; i++) this.tone("sine", 1400 + i * 80, 1800, 0.06, 0.07, i * 0.07);
  }
  growl() {
    this.tone("sawtooth", 90, 60, 0.5, 0.12);
    this.burst(0.4, 200, 3, 0.1);
  }
  elfSquawk() {
    this.tone("square", 900 + Math.random() * 300, 400, 0.12, 0.06);
  }
  flicker() {
    this.burst(0.05, 5000, 1, 0.12, "highpass");
  }
  thunder() {
    this.burst(1.6, 120, 0.5, 0.7, "lowpass");
    this.tone("sine", 60, 30, 1.4, 0.4);
  }
  scream() {
    this.tone("sawtooth", 880, 1320, 0.5, 0.08);
    this.tone("sine", 1200, 900, 0.6, 0.06, 0.1);
  }
  open() {
    this.tone("triangle", 330, 660, 0.3, 0.2);
    this.tone("triangle", 495, 990, 0.3, 0.15, 0.1);
    this.tone("triangle", 660, 1320, 0.4, 0.15, 0.2);
  }
  owl() {
    this.tone("sine", 420, 390, 0.35, 0.06);
    this.tone("sine", 400, 360, 0.5, 0.06, 0.45);
  }
  creak() {
    this.tone("sawtooth", 90, 70, 0.6, 0.03);
  }
  explosion() {
    this.burst(1.1, 300, 0.6, 0.9, "lowpass", 0, this.grit);
    this.burst(0.3, 2500, 0.6, 0.35, "highpass");
    this.tone("sine", 90, 25, 0.9, 0.9, 0, this.grit);
    this.burst(1.4, 180, 0.6, 0.35, "lowpass", 0.1);
  }
  freeze() {
    for (let i = 0; i < 6; i++)
      this.tone("triangle", 2400 - i * 250, 1800 - i * 200, 0.25, 0.08, i * 0.05);
    this.burst(0.5, 6000, 0.8, 0.15, "highpass");
  }
  launcher() {
    this.blast(0.6);
    this.burst(0.25, 1200, 0.7, 0.3);
  }
  slapshot() {
    this.burst(0.06, 2500, 1.2, 0.45);
    this.tone("square", 900, 400, 0.05, 0.08);
  }
  horn() {
    this.tone("sawtooth", 233, 228, 0.55, 0.22);
    this.tone("sawtooth", 294, 290, 0.55, 0.16);
  }
  engine(load = 0.5) {
    this.tone("sawtooth", 55 + load * 30, 50 + load * 25, 0.22, 0.05 + load * 0.05);
  }
  iceCrack() {
    this.burst(0.08, 3500, 2, 0.35, "bandpass");
    this.burst(0.25, 900, 1, 0.25, "bandpass", 0.05);
    this.tone("sine", 1200, 300, 0.2, 0.08);
  }
  splash() {
    this.burst(0.5, 700, 0.6, 0.45, "lowpass");
    this.burst(0.35, 2500, 0.8, 0.2, "highpass", 0.05);
  }
  shards() {
    for (let i = 0; i < 5; i++) this.burst(0.06, 4000 + i * 400, 2, 0.12, "bandpass", i * 0.04);
  }
  beep() {
    this.tone("square", 1800, 1800, 0.05, 0.06);
  }
  flame() {
    this.burst(0.15, 900, 0.5, 0.16, "bandpass");
    this.burst(0.2, 250, 0.6, 0.22, "lowpass");
  }
  boil() {
    this.tone("sine", 200 + Math.random() * 300, 600, 0.06, 0.03);
  }
  coalThrow() {
    this.burst(0.2, 700, 1.5, 0.15);
  }
  coalHit() {
    this.burst(0.3, 500, 0.8, 0.35, "lowpass");
    this.burst(0.4, 3000, 0.6, 0.12, "highpass", 0.05);
  }
  burn() {
    this.burst(0.12, 2500, 0.7, 0.08, "highpass");
  }
  /** Le Rayon de l'Étoile: a soft, bright hum (fires 20 times a second, so it's quiet). */
  beam() {
    this.tone("sine", 1320, 1360, 0.07, 0.04);
    this.tone("triangle", 660, 680, 0.07, 0.03);
  }

  /** Gatling barrels spinning (`k` 0–1: how spun up). */
  whir(k: number) {
    this.tone("sawtooth", 120 + k * 260, 120 + k * 280, 0.13, 0.05 + k * 0.05);
  }
  /** A giant ornament rumbling as it rolls. */
  rumble() {
    this.burst(0.4, 220, 0.6, 0.4, "lowpass");
  }

  /** Arbalète à Cannes: a taut string twang and a whoosh. */
  twang() {
    this.tone("triangle", 220, 140, 0.18, 0.3);
    this.tone("sine", 140, 45, 0.15, 0.45, 0, this.grit);
    this.burst(0.1, 1800, 1, 0.3);
  }
  /** A possessed reindeer snorting before it charges. */
  snort() {
    this.burst(0.35, 500, 0.8, 0.45, "lowpass");
    this.tone("sawtooth", 80, 50, 0.4, 0.25);
  }

  /** Guirlande Électrique: a buzzing electric snap. */
  zap() {
    this.tone("sawtooth", 1800, 120, 0.16, 0.3, 0, this.grit);
    this.tone("square", 90, 60, 0.15, 0.3, 0, this.grit);
    this.burst(0.08, 4000, 1.4, 0.35, "highpass");
    this.tone("sine", 130, 40, 0.15, 0.4);
  }
  /** A stamping press slamming down. */
  press() {
    this.tone("sine", 90, 35, 0.35, 0.6);
    this.burst(0.18, 700, 0.6, 0.5, "lowpass");
  }
  /** The grinder chewing on something. */
  grind() {
    this.burst(0.3, 1600, 2, 0.35, "bandpass");
  }

  /** Fusil à Glaçons: a crisp crack and a ringing, crystalline tail. */
  icicle() {
    this.blast(0.6);
    this.tone("sine", 2600, 1400, 0.3, 0.14);
  }
  smg() {
    this.blast(0.2);
  }
  whooshLong() {
    this.burst(0.6, 900, 0.7, 0.18);
  }
  ui() {
    this.tone("sine", 880, 1100, 0.07, 0.12);
  }
  /** Gibberish voice for dialogue. */
  bip(pitch = 1) {
    const f = (380 + Math.random() * 120) * pitch;
    this.tone(pitch < 0.7 ? "sawtooth" : "square", f, f * 1.05, 0.05, 0.035);
  }
}

export const sound = new Sound();
