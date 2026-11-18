import { clamp, damp, smoothstep } from "../core/math";
import type { JointName, Rig } from "./Rig";

/** A keyframe: time (s) and joint rotation in radians. */
export type Key = readonly [t: number, rx: number, ry: number, rz: number];

export interface Clip {
  duration: number;
  tracks: Partial<Record<JointName, readonly Key[]>>;
  /** Vertical offset of the body over time (crouches, hops). */
  lift?: ReadonlyArray<readonly [t: number, y: number]>;
  /** Blend-in / blend-out time in seconds. */
  fade?: number;
  loop?: boolean;
}

/** What the hands carry: each style has a ready pose so the weapon is held, not dangled. */
export type Hold = "none" | "cane" | "pistol" | "rifle";

/** Ready poses [rx, ry, rz] of the weapon arm: the cane up like a sword, guns forward and low.
 *  Only the right hand holds anything, so the left arm keeps swinging naturally. */
const READY: Record<Exclude<Hold, "none">, V3> = {
  cane: [-1.0, -0.15, 0.2],
  pistol: [-1.2, -0.15, 0.1],
  rifle: [-1.2, -0.25, 0.05],
};
type V3 = [number, number, number];

export interface Locomotion {
  /** Horizontal speed in m/s. */
  speed: number;
  /** Speed at which the run cycle is at full amplitude. */
  runSpeed: number;
  grounded: boolean;
  vy: number;
  /** 0–1: how much the right arm points forward (aiming a gun). */
  aim: number;
  /** Camera pitch in radians, applied to the aiming arm. */
  aimPitch: number;
  /** Extra creepy jitter for possessed characters (0–1). */
  twitch: number;
  hold: Hold;
}

interface Playing {
  clip: Clip;
  time: number;
  weight: number;
}

const ARM_JOINTS: JointName[] = ["armL", "armR"];

/**
 * Procedural locomotion (sine-wave walk/run, air pose, breathing) layered under
 * short keyframe clips (punches, swings, wind-ups). Clips blend in and out so
 * nothing snaps.
 */
export class Animator {
  private phase = Math.random() * 10;
  private squash = 1;
  private squashVel = 0;
  private hatSwing = 0;
  private hatVel = 0;
  private playing: Playing | null = null;
  private time = 0;
  readonly loco: Locomotion = {
    speed: 0,
    runSpeed: 7,
    grounded: true,
    vy: 0,
    aim: 0,
    aimPitch: 0,
    twitch: 0,
    hold: "none",
  };

  constructor(private readonly rig: Rig) {}

  /** Squash (negative) or stretch (positive) impulse. */
  bounce(amount: number) {
    this.squashVel += amount * 12;
  }

  play(clip: Clip) {
    this.playing = { clip, time: 0, weight: this.playing ? this.playing.weight : 0 };
  }

  stop() {
    this.playing = null;
  }

  get busy() {
    return this.playing !== null && !this.playing.clip.loop;
  }

  get clipTime() {
    return this.playing?.time ?? 0;
  }

  update(dt: number) {
    const j = this.rig.joints;
    const l = this.loco;
    this.time += dt;
    const moveAmt = clamp(l.speed / l.runSpeed, 0, 1);
    const stepFreq = 1.6 + l.speed * 0.55;
    this.phase += dt * stepFreq * Math.PI * (l.grounded ? 1 : 0.3);
    const s = Math.sin(this.phase);
    const swing = l.grounded ? moveAmt : 0;
    const idle = 1 - moveAmt;
    const breathe = Math.sin(this.time * 2.2) * 0.02 * idle;

    // Legs
    if (l.grounded) {
      j.legL.rotation.x = s * 0.85 * swing;
      j.legR.rotation.x = -s * 0.85 * swing;
    } else {
      j.legL.rotation.x = damp(j.legL.rotation.x, -0.6, 12, dt);
      j.legR.rotation.x = damp(j.legR.rotation.x, 0.35, 12, dt);
    }
    j.legL.rotation.z = 0;
    j.legR.rotation.z = 0;

    // Arms
    if (l.grounded) {
      j.armL.rotation.x = -s * 0.8 * swing;
      j.armR.rotation.x = s * 0.8 * swing;
      j.armL.rotation.z = -0.12 - breathe * 2;
      j.armR.rotation.z = 0.12 + breathe * 2;
    } else {
      const up = l.vy > 0 ? 1 : 0.6;
      j.armL.rotation.x = damp(j.armL.rotation.x, -0.4, 10, dt);
      j.armR.rotation.x = damp(j.armR.rotation.x, -0.4, 10, dt);
      j.armL.rotation.z = damp(j.armL.rotation.z, -1.1 * up, 10, dt);
      j.armR.rotation.z = damp(j.armR.rotation.z, 1.1 * up, 10, dt);
    }
    j.armL.rotation.y = 0;
    j.armR.rotation.y = 0;
    // The wrist only turns during clips (a cane slash rolls the blade).
    j.hand.rotation.setAll(0);

    // A weapon in hand keeps its arm in the ready pose, with only a little sway.
    if (l.hold !== "none") {
      const [rx, ry, rz] = READY[l.hold];
      j.armR.rotation.set(rx + s * 0.08 * swing, ry, rz);
    }

    // Aiming raises the gun arm to the camera's pitch.
    // The arm follows the camera only so far down, so long guns don't dig into the floor
    // (shots are aimed from the camera anyway).
    if (l.aim > 0) {
      const ax = -Math.PI / 2 + clamp(l.aimPitch, -0.9, 0.55);
      blendRotation(j.armR.rotation, ax, -0.12, 0, l.aim);
    }

    // Torso: lean into speed, bob with steps, breathe when idle.
    j.chest.rotation.x = moveAmt * 0.16 + (l.grounded ? 0 : -0.1);
    j.chest.rotation.y = s * 0.12 * swing;
    j.chest.rotation.z = 0;
    j.head.rotation.x = -moveAmt * 0.1;
    j.head.rotation.y = 0;
    j.head.rotation.z = Math.sin(this.time * 1.3) * 0.04 * idle;
    j.body.position.y = Math.abs(s) * 0.06 * swing;
    j.chest.scaling.y = 1 + breathe;

    // Possessed twitching.
    if (l.twitch > 0) {
      const t = this.time * 23;
      j.head.rotation.z += (Math.sin(t) * Math.sin(t * 0.37) > 0.6 ? 0.35 : 0) * l.twitch;
      j.head.rotation.x += Math.sin(t * 1.7) * 0.05 * l.twitch;
    }

    // Squash & stretch spring.
    this.squashVel += (1 - this.squash) * 160 * dt;
    this.squashVel *= Math.exp(-11 * dt);
    this.squash += this.squashVel * dt;
    const sq = clamp(this.squash, 0.6, 1.4);
    const wide = 1 + (1 - sq) * 0.6;
    j.body.scaling.set(wide, sq, wide);

    // Floppy hat tip follows the motion with a spring.
    const target = -moveAmt * 0.5 + (l.grounded ? 0 : l.vy * 0.04) + s * 0.12 * swing;
    this.hatVel += (target - this.hatSwing) * 90 * dt;
    this.hatVel *= Math.exp(-6 * dt);
    this.hatSwing += this.hatVel * dt;
    j.hatTip.rotation.x = this.hatSwing;

    this.applyClip(dt);
  }

  private applyClip(dt: number) {
    const p = this.playing;
    if (!p) return;
    const { clip } = p;
    p.time += dt;
    const fade = clip.fade ?? 0.06;
    const ending = !clip.loop && p.time > clip.duration - fade;
    p.weight = ending ? Math.max(0, p.weight - dt / fade) : Math.min(1, p.weight + dt / fade);
    if (!clip.loop && p.time >= clip.duration) {
      this.playing = null;
      return;
    }
    const t = clip.loop ? p.time % clip.duration : p.time;
    const w = smoothstep(clamp(p.weight, 0, 1));
    const j = this.rig.joints;
    for (const [name, keys] of Object.entries(clip.tracks) as [JointName, readonly Key[]][]) {
      const node = j[name];
      if (!node) continue;
      const [rx, ry, rz] = sample(keys, t);
      node.rotation.x += (rx - node.rotation.x) * w;
      node.rotation.y += (ry - node.rotation.y) * w;
      node.rotation.z += (rz - node.rotation.z) * w;
    }
    if (clip.lift) {
      const y = sample1(clip.lift, t);
      j.body.position.y += y * w;
    }
    for (const arm of ARM_JOINTS) j[arm].computeWorldMatrix(true);
  }
}

function blendRotation(
  r: { x: number; y: number; z: number },
  x: number,
  y: number,
  z: number,
  k: number,
) {
  r.x += (x - r.x) * k;
  r.y += (y - r.y) * k;
  r.z += (z - r.z) * k;
}

function sample(keys: readonly Key[], t: number): [number, number, number] {
  const first = keys[0] as Key;
  if (t <= first[0]) return [first[1], first[2], first[3]];
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i] as Key;
    if (t <= b[0]) {
      const a = keys[i - 1] as Key;
      const k = smoothstep((t - a[0]) / (b[0] - a[0] || 1));
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
    }
  }
  const last = keys[keys.length - 1] as Key;
  return [last[1], last[2], last[3]];
}

function sample1(keys: ReadonlyArray<readonly [number, number]>, t: number) {
  const first = keys[0] as readonly [number, number];
  if (t <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i] as readonly [number, number];
    if (t <= b[0]) {
      const a = keys[i - 1] as readonly [number, number];
      const k = smoothstep((t - a[0]) / (b[0] - a[0] || 1));
      return a[1] + (b[1] - a[1]) * k;
    }
  }
  return (keys[keys.length - 1] as readonly [number, number])[1];
}
