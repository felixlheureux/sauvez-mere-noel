import { Vector3 } from "@babylonjs/core";

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Frame-rate independent exponential smoothing. `rate` ≈ how many times per second it closes the gap. */
export const damp = (current: number, target: number, rate: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

/** Moves `current` toward `target` by at most `maxDelta`. */
export const approach = (current: number, target: number, maxDelta: number) =>
  current < target ? Math.min(current + maxDelta, target) : Math.max(current - maxDelta, target);

/** Shortest signed difference between two angles (radians). */
export const angleDelta = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export const dampAngle = (current: number, target: number, rate: number, dt: number) =>
  current + angleDelta(current, target) * (1 - Math.exp(-rate * dt));

/** Small deterministic PRNG so procedural models look the same every time. */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const randRange = (rand: () => number, min: number, max: number) =>
  min + rand() * (max - min);

export const pick = <T>(rand: () => number, items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)] as T;

export const flatDistance = (a: Vector3, b: Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

export const yawTo = (from: Vector3, to: Vector3) => Math.atan2(to.x - from.x, to.z - from.z);

export const forwardFromYaw = (yaw: number, out = new Vector3()) =>
  out.set(Math.sin(yaw), 0, Math.cos(yaw));
