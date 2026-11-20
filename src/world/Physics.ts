import { Vector3 } from "@babylonjs/core";

/**
 * Tiny kinematic physics for a platformer: static axis-aligned boxes and a flat ground.
 * Predictable and fast — exactly what jumping on gifts and roofs needs.
 */
export interface Collider {
  min: Vector3;
  max: Vector3;
  /** Upward speed given when landing on it (bounce gifts). */
  bounce?: number;
  /** Called when a character lands on top. */
  onLand?: () => void;
  /** Bullets pass through (e.g. decorative hedges). */
  shootThrough?: boolean;
  /** How far a moving platform moved this frame; whoever stands on it moves with it. */
  delta?: Vector3;
  /** Disabled colliders are ignored (e.g. a smashed snowman). */
  enabled?: boolean;
  tag?: string;
}

export interface Body {
  position: Vector3;
  velocity: Vector3;
  radius: number;
  height: number;
  grounded: boolean;
  /** The collider currently stood on, if any. */
  ground: Collider | null;
}

export interface MoveResult {
  landed: boolean;
  /** Vertical speed right before landing (negative = falling). */
  impactSpeed: number;
  hitWall: boolean;
  bounced: number;
}

export const STEP_HEIGHT = 0.35;
const SKIN = 0.001;

export class PhysicsWorld {
  readonly colliders: Collider[] = [];
  groundY = 0;
  /** Optional heightmap: ground height at (x, z). Replaces the flat `groundY`. */
  terrain: ((x: number, z: number) => number) | null = null;
  /** Playable area: characters can't leave this circle. */
  boundsRadius = 40;
  boundsCenter = new Vector3();

  add(collider: Collider) {
    collider.enabled ??= true;
    this.colliders.push(collider);
    return collider;
  }

  addBox(center: Vector3, size: Vector3, extra: Partial<Collider> = {}) {
    const half = size.scale(0.5);
    return this.add({ min: center.subtract(half), max: center.add(half), ...extra });
  }

  clear() {
    this.colliders.length = 0;
    this.terrain = null;
  }

  /** Height of the bare ground (no colliders). */
  floorAt(x: number, z: number) {
    return this.terrain ? this.terrain(x, z) : this.groundY;
  }

  private overlapsXZ(c: Collider, x: number, z: number, r: number) {
    return x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z;
  }

  /** Height of the highest surface under (x, z) at or below `maxY`. */
  groundHeightAt(x: number, z: number, maxY = Number.POSITIVE_INFINITY, r = 0) {
    let best = this.floorAt(x, z);
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      if (c.max.y <= maxY && c.max.y > best && this.overlapsXZ(c, x, z, r)) best = c.max.y;
    }
    return best;
  }

  move(body: Body, dt: number): MoveResult {
    const p = body.position;
    const v = body.velocity;
    const r = body.radius;
    const result: MoveResult = { landed: false, impactSpeed: 0, hitWall: false, bounced: 0 };
    const wasGrounded = body.grounded;
    // Ride along with a moving platform.
    if (body.grounded && body.ground?.delta && body.ground.enabled) p.addInPlace(body.ground.delta);

    // Horizontal: move, then push out of any box along the shortest way out.
    // (Resolving per movement axis used to shove you sideways across a whole box
    // when you dropped off its edge: your circle still grazed the box while your
    // feet were just below its top, and the sideways axis got "resolved" first.)
    // Fast movers (dashes, knockbacks) advance in small slices so they can't
    // pop through a thin wall.
    const slices = Math.max(1, Math.ceil((Math.hypot(v.x, v.z) * dt) / 0.25));
    for (let pass = 0; pass < slices + 1; pass++) {
      if (pass < slices) {
        p.x += (v.x * dt) / slices;
        p.z += (v.z * dt) / slices;
      }
      for (const c of this.colliders) {
        if (!c.enabled) continue;
        if (!this.overlapsXZ(c, p.x, p.z, r)) continue;
        const feet = p.y;
        const head = p.y + body.height;
        if (c.max.y <= feet + SKIN || c.min.y >= head) continue;
        // Small ledge: step up instead of stopping.
        if (
          wasGrounded &&
          c.max.y - feet <= STEP_HEIGHT &&
          this.headroomAt(p.x, p.z, r, c.max.y, body.height)
        ) {
          // Stand on it only once the inner circle is over it, as the ground check below
          // does: stepped up on a mere graze, you'd find no ground under you, drop, and
          // the step would then stop you like a wall.
          if (this.overlapsXZ(c, p.x, p.z, r * 0.9)) p.y = c.max.y;
          continue;
        }
        const left = p.x + r - c.min.x;
        const right = c.max.x + r - p.x;
        const back = p.z + r - c.min.z;
        const front = c.max.z + r - p.z;
        const m = Math.min(left, right, back, front);
        if (m === left) {
          p.x -= left + SKIN;
          if (v.x > 0) v.x = 0;
        } else if (m === right) {
          p.x += right + SKIN;
          if (v.x < 0) v.x = 0;
        } else if (m === back) {
          p.z -= back + SKIN;
          if (v.z > 0) v.z = 0;
        } else {
          p.z += front + SKIN;
          if (v.z < 0) v.z = 0;
        }
        result.hitWall = true;
      }
    }

    // Keep inside the level.
    const dx = p.x - this.boundsCenter.x;
    const dz = p.z - this.boundsCenter.z;
    const dist = Math.hypot(dx, dz);
    if (dist > this.boundsRadius) {
      p.x = this.boundsCenter.x + (dx / dist) * this.boundsRadius;
      p.z = this.boundsCenter.z + (dz / dist) * this.boundsRadius;
      result.hitWall = true;
    }

    // Vertical.
    const prevY = p.y;
    p.y += v.y * dt;
    body.grounded = false;
    body.ground = null;
    if (v.y <= 0) {
      let floor = this.floorAt(p.x, p.z);
      let floorCollider: Collider | null = null;
      for (const c of this.colliders) {
        if (!c.enabled || !this.overlapsXZ(c, p.x, p.z, r * 0.9)) continue;
        if (c.max.y <= prevY + SKIN * 10 && c.max.y > floor) {
          floor = c.max.y;
          floorCollider = c;
        }
      }
      // Stick to the ground when walking down a slope instead of hopping off it.
      if (wasGrounded && floorCollider === null && p.y > floor && p.y - floor < 0.45) p.y = floor;
      if (p.y <= floor) {
        result.impactSpeed = v.y;
        p.y = floor;
        body.grounded = true;
        body.ground = floorCollider;
        if (!wasGrounded) result.landed = true;
        if (floorCollider?.bounce && v.y < -0.5) {
          v.y = floorCollider.bounce;
          result.bounced = floorCollider.bounce;
          body.grounded = false;
        } else {
          v.y = 0;
        }
        if (result.landed) floorCollider?.onLand?.();
      }
    } else {
      // Bonk head on ceilings.
      for (const c of this.colliders) {
        if (!c.enabled || !this.overlapsXZ(c, p.x, p.z, r * 0.9)) continue;
        if (c.min.y >= prevY + body.height - SKIN && p.y + body.height > c.min.y) {
          p.y = c.min.y - body.height;
          v.y = 0;
        }
      }
    }
    return result;
  }

  private headroomAt(x: number, z: number, r: number, y: number, height: number) {
    for (const c of this.colliders) {
      if (!c.enabled || !this.overlapsXZ(c, x, z, r)) continue;
      // Something no higher than a step up from there is the next step (a staircase,
      // a stepped roof), not a ceiling: it gets climbed in turn.
      if (c.min.y < y + height && c.max.y > y + STEP_HEIGHT) return false;
    }
    return true;
  }

  /**
   * Ray vs. all solid boxes. Returns distance to the first hit, or `maxDist`.
   */
  raycast(origin: Vector3, dir: Vector3, maxDist: number, forBullets = false) {
    let best = maxDist;
    if (this.terrain) {
      // March along the ray against the heightmap.
      const step = 0.5;
      for (let t = step; t < best; t += step) {
        const x = origin.x + dir.x * t;
        const z = origin.z + dir.z * t;
        if (origin.y + dir.y * t < this.terrain(x, z)) {
          best = t - step * 0.5;
          break;
        }
      }
    } else if (dir.y < 0) {
      const t = (this.groundY - origin.y) / dir.y;
      if (t > 0 && t < best) best = t;
    }
    for (const c of this.colliders) {
      if (!c.enabled || (forBullets && c.shootThrough)) continue;
      const t = rayAabb(origin, dir, c.min, c.max);
      if (t !== null && t < best) best = t;
    }
    return best;
  }
}

/** Slab test. Returns entry distance or null. */
export function rayAabb(o: Vector3, d: Vector3, min: Vector3, max: Vector3): number | null {
  let tmin = 0;
  let tmax = Number.POSITIVE_INFINITY;
  for (const axis of ["x", "y", "z"] as const) {
    const inv = 1 / d[axis];
    let t1 = (min[axis] - o[axis]) * inv;
    let t2 = (max[axis] - o[axis]) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmax < tmin) return null;
  }
  return tmin;
}

/** Ray vs. sphere. Returns entry distance or null. */
export function raySphere(o: Vector3, d: Vector3, center: Vector3, radius: number): number | null {
  const ox = o.x - center.x;
  const oy = o.y - center.y;
  const oz = o.z - center.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const h = b * b - c;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : null;
}
