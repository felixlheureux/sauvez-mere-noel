import {
  Color3,
  Matrix,
  type Mesh,
  MeshBuilder,
  type PointLight,
  Quaternion,
  type TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { Rig } from "../anim/Rig";
import { sound, type Theme } from "../audio/Sound";
import type { Game } from "../core/Game";
import { clamp, flatDistance, mulberry32, randRange } from "../core/math";
import { type ElfTuning, MAX_ALIVE } from "../enemies/Elf";
import type { TwinkleKind } from "../fx/Effects";
import type { GunId } from "../player/Player";
import type { Mood } from "./Environment";
import { Npc } from "./Npc";
import type { Collider } from "./Physics";
import { raySphere } from "./Physics";

export interface Pickup {
  mesh: TransformNode;
  pos: Vector3;
  radius: number;
  spin: number;
  bob: number;
  onCollect: () => void;
  collected: boolean;
  aura?: Aura | null;
}

/**
 * The visual language for "you can interact with this": rising twinkles in a
 * color that says what it is, plus a soft glowing ring on the floor underneath.
 */
export interface Aura {
  node: TransformNode | null;
  pos: Vector3;
  kind: TwinkleKind;
  ring: Mesh | null;
  ringSize: number;
  height: number;
  spread: number;
  timer: number;
  dead: boolean;
}

const AURA_HEX: Record<TwinkleKind, string> = {
  gold: "#ffc94a",
  heal: "#ff8fa8",
  rage: "#ff4a3a",
  speed: "#ff8fd0",
  shield: "#8fd4ff",
  ice: "#c4f1ff",
  warm: "#ffb060",
};

export interface Trigger {
  pos: Vector3;
  radius: number;
  once: boolean;
  fired: boolean;
  enabled: boolean;
  onEnter: () => void;
}

export interface Breakable {
  mesh: Mesh;
  collider: Collider;
  pos: Vector3;
  hp: number;
  /** Size used for bullet hits. */
  radius: number;
  height: number;
  onBreak: () => void;
  /** Loot gifts wiggle every few seconds (seconds until the next one). */
  wiggle?: number;
}

/** Anything big that bullets, punches and explosions can damage (bosses). */
export interface BossTarget {
  readonly alive: boolean;
  readonly center: Vector3;
  readonly radius: number;
  /** Distance along the ray to the boss, or null. */
  raycast(origin: Vector3, dir: Vector3, maxDist: number): number | null;
  damage(amount: number, kind: import("../enemies/Elf").DamageKind, from: Vector3): void;
}

/**
 * A light the level wants. The game has a fixed pool of real point lights that
 * is assigned to the closest few each frame: creating or switching lights on and
 * off would make every material recompile its shader (a visible freeze).
 */
export interface LocalLight {
  position: Vector3;
  diffuse: Color3;
  intensity: number;
  range: number;
}

export interface Cauldron {
  pos: Vector3;
  radius: number;
  top: number;
}

export interface SyrupPatch {
  pos: Vector3;
  radius: number;
  /** Seconds left burning (0 = just sticky). */
  burning: number;
  mesh: Mesh;
}

export interface Lantern {
  mesh: Mesh;
  /** Where the glass is (hit target). */
  lamp: Vector3;
  lit: boolean;
  light: LocalLight | null;
  aura?: Aura | null;
  onLit: () => void;
}

export interface PlaceOptions {
  y?: number;
  rot?: number;
  scale?: number;
  shadow?: boolean;
}

/**
 * Base class for a level: layout helpers (props + colliders), pickups,
 * triggers, NPCs, breakables and the exit chimney. Subclasses implement
 * `build()` (geometry) and `run()` (the async script).
 */
export abstract class Level {
  abstract readonly id: number;
  /** The gun found in this level, if any (given right away when resuming past the start). */
  newGun: GunId | null = null;
  abstract readonly name: string;
  abstract readonly mood: Mood;
  /** Which carol the music box plays. */
  theme: Theme = "jingle";
  /** 0–10: picks the gore settings and music distortion. */
  darkness = 0;
  damageScale = 1;
  /** Below this height you've fallen into water or off the world. */
  killY = -50;
  /** The boss currently fighting, if any. */
  boss: BossTarget | null = null;
  icy = false;
  bellsTotal = 3;
  bellsFound = 0;
  candiesTotal = 0;
  candiesFound = 0;
  spawnPos = new Vector3(0, 0, 0);
  spawnYaw = 0;
  arenaRadius = 38;
  readonly pickups: Pickup[] = [];
  readonly triggers: Trigger[] = [];
  readonly npcs: Npc[] = [];
  readonly breakables: Breakable[] = [];
  readonly spinners: { node: TransformNode; speed: number }[] = [];
  exit: { mesh: Mesh; pos: Vector3; open: boolean; onEnter: () => void } | null = null;
  startTime = 0;
  readonly lanterns: Lantern[] = [];
  readonly cauldrons: Cauldron[] = [];
  readonly syrup: SyrupPatch[] = [];
  /** Point lights placed by the level; only the closest few are switched on. */
  /** Warm lights placed by the level (lanterns, fires). Shown through the game's fixed light pool. */
  readonly localLights: LocalLight[] = [];
  private readonly auras: Aura[] = [];
  private hazardTick = 0;
  /** Respawn points; index 0 is the level start. */
  readonly checkpoints: { pos: Vector3; yaw: number }[] = [];
  /** Checkpoint the current attempt started from (set by the game before `run`). */
  startCheckpoint = 0;
  /** Furthest checkpoint reached this attempt. */
  checkpoint = 0;

  constructor(protected readonly game: Game) {}

  abstract build(): void;
  abstract run(): Promise<void>;

  /** Extra per-frame logic. */
  tick(_dt: number) {}

  // ---------- Layout helpers ----------

  protected place<T extends TransformNode>(node: T, x: number, z: number, o: PlaceOptions = {}): T {
    node.parent = this.game.levelRoot;
    node.position.set(x, o.y ?? 0, z);
    if (o.rot !== undefined) node.rotation.y = o.rot;
    if (o.scale !== undefined) node.scaling.setAll(o.scale);
    if (o.shadow !== false)
      this.game.env.castShadows(
        ...(node.getChildMeshes(false) as Mesh[]),
        ...(isMesh(node) ? [node] : []),
      );
    for (const m of [node, ...node.getChildMeshes(false)]) if (isMesh(m)) m.receiveShadows = true;
    return node;
  }

  /** Box collider: centered on x/z, bottom at y. */
  protected solid(
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    y = 0,
    extra: Partial<Collider> = {},
  ) {
    return this.game.physics.addBox(new Vector3(x, y + h / 2, z), new Vector3(w, h, d), extra);
  }

  /**
   * A solid box turned by `rot` (radians, like the mesh). Physics only has
   * axis-aligned boxes, so a turned box becomes a grid of small boxes that all
   * fit *inside* its outline: you can never stand on thin air past its edge.
   * (lx, lz) is an offset in the box's own frame.
   */
  protected solidRotated(
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    y = 0,
    rot = 0,
    lx = 0,
    lz = 0,
  ) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const ac = Math.abs(c);
    const as = Math.abs(s);
    const cx = x + lx * c + lz * s;
    const cz = z - lx * s + lz * c;
    if (as < 0.03) return [this.solid(cx, cz, w, h, d, y)];
    if (ac < 0.03) return [this.solid(cx, cz, d, h, w, y)];
    const cell = clamp(Math.min(w, d) / 3, 0.45, 1);
    const nx = Math.max(1, Math.round(w / cell));
    const nz = Math.max(1, Math.round(d / cell));
    const cw = w / nx;
    const cd = d / nz;
    const side = Math.min(cw, cd) / (ac + as);
    const out = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const ox = -w / 2 + (i + 0.5) * cw;
        const oz = -d / 2 + (j + 0.5) * cd;
        out.push(this.solid(cx + ox * c + oz * s, cz - ox * s + oz * c, side, h, side, y));
      }
    }
    return out;
  }

  /**
   * Colliders for a house with a gable roof (as built by the props' gable()):
   * the walls, then the roof as stacked slabs that stay under the sloped surface,
   * so walking off the roof edge drops you instead of leaving you floating.
   */
  protected houseSolid(
    x: number,
    z: number,
    w: number,
    d: number,
    wallH: number,
    rot = 0,
    y = 0,
    over = 1.12,
    roofExtra = 0.5,
  ) {
    this.solidRotated(x, z, w, wallH, d, y, rot);
    const span = w * over + 0.3;
    const height = span * 0.5;
    const eave = y + wallH - 0.05;
    const steps = 4;
    for (let k = 1; k < steps; k++) {
      this.solidRotated(
        x,
        z,
        span * (1 - k / steps),
        height / steps,
        d + roofExtra,
        eave + (height * (k - 1)) / steps,
        rot,
      );
    }
  }

  protected gift(
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    colorway: number,
    y = 0,
    rot = 0,
  ) {
    const key = `gift_${w}_${h}_${d}_${colorway}`;
    const mesh = this.game.protoClone(key, () => this.game.props.gift(w, h, d, colorway));
    this.place(mesh, x, z, { y, rot });
    this.solidRotated(x, z, w, h, d, y, rot);
    return mesh;
  }

  /** Is there room for a prop of half-size `r` at (x, z)? (No collider within r + margin.) */
  protected freeAt(x: number, z: number, r: number, margin = 0.4) {
    for (const c of this.game.physics.colliders) {
      if (!c.enabled) continue;
      if (
        x + r + margin > c.min.x &&
        x - r - margin < c.max.x &&
        z + r + margin > c.min.z &&
        z - r - margin < c.max.z
      ) {
        return false;
      }
    }
    if (this.exit && Math.hypot(this.exit.pos.x - x, this.exit.pos.z - z) < 3 + r) return false;
    return true;
  }

  /** A decorative rock you can stand on (skipped if something is already there). */
  protected rock(x: number, z: number, size: number, seed: number) {
    if (!this.freeAt(x, z, size * 0.8)) return;
    const y = this.floor(x, z);
    this.place(this.game.props.rock(size, seed), x, z, { y });
    this.solid(x, z, size * 1.5, size, size * 1.5, y);
  }

  protected bounceGift(x: number, z: number, power = 15, y = 0) {
    y += this.floor(x, z);
    const mesh = this.game.protoClone("bounceGift", () => this.game.props.bounceGift(1.6));
    this.place(mesh, x, z, { y });
    this.solid(x, z, 1.6, 0.8, 1.6, y, { bounce: power });
    return mesh;
  }

  protected npc(rig: Rig, x: number, z: number, yaw = 0) {
    rig.root.parent = this.game.levelRoot;
    this.game.env.castShadows(...(rig.allMeshes() as Mesh[]));
    const n = new Npc(rig, new Vector3(x, this.game.physics.groundHeightAt(x, z), z), yaw);
    this.npcs.push(n);
    return n;
  }

  /**
   * Resolves once Santa is within `radius` of (x, z), or already past it going toward +z
   * (the way every route runs): running ahead never means walking back to a marker.
   */
  protected async reachOrPass(x: number, z: number, radius: number) {
    const g = this.game;
    for (;;) {
      const p = g.player.body.position;
      if (Math.hypot(p.x - x, p.z - z) < radius || p.z > z) return;
      await g.wait(0.1);
    }
  }

  protected trigger(x: number, z: number, radius: number, onEnter: () => void, once = true) {
    const t: Trigger = {
      pos: new Vector3(x, 0, z),
      radius,
      once,
      fired: false,
      enabled: true,
      onEnter,
    };
    this.triggers.push(t);
    return t;
  }

  protected pickup(
    mesh: TransformNode,
    pos: Vector3,
    onCollect: () => void,
    radius = 0.9,
    aura: TwinkleKind | null = "gold",
  ) {
    pos = this.settle(pos, radius > 0.6);
    this.place(mesh, pos.x, pos.z, { y: pos.y, shadow: false });
    const p: Pickup = {
      mesh,
      pos: pos.clone(),
      radius,
      spin: 1.5,
      bob: Math.random() * 6,
      onCollect,
      collected: false,
      aura: aura ? this.aura(pos, aura, { node: mesh }) : null,
    };
    this.pickups.push(p);
    return p;
  }

  /**
   * Keep a pickup somewhere sensible: inside the level's bounds, not buried in a
   * wall or prop, and not stacked on another pickup (loot drops especially).
   * Nudges are logged so level layouts can be fixed at the source.
   */
  private settle(pos: Vector3, spaced: boolean) {
    const ph = this.game.physics;
    const out = pos.clone();
    const c = ph.boundsCenter;
    const maxR = ph.boundsRadius - 1.2;
    const dx = out.x - c.x;
    const dz = out.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d > maxR) {
      out.x = c.x + (dx / d) * maxR;
      out.z = c.z + (dz / d) * maxR;
    }
    const blocked = (x: number, z: number) => {
      for (const col of ph.colliders) {
        if (!col.enabled) continue;
        if (
          x > col.min.x - 0.25 &&
          x < col.max.x + 0.25 &&
          z > col.min.z - 0.25 &&
          z < col.max.z + 0.25
        ) {
          if (out.y + 0.3 > col.min.y && out.y < col.max.y - 0.05) return true;
        }
      }
      if (spaced) {
        for (const p of this.pickups) {
          if (
            !p.collected &&
            p.radius > 0.6 &&
            Math.hypot(p.pos.x - x, p.pos.z - z) < 1.1 &&
            Math.abs(p.pos.y - out.y) < 1.5
          )
            return true;
        }
      }
      return false;
    };
    if (blocked(out.x, out.z)) {
      search: for (let r = 0.6; r <= 4.2; r += 0.6) {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const x = out.x + Math.cos(a) * r;
          const z = out.z + Math.sin(a) * r;
          if (Math.hypot(x - c.x, z - c.z) > maxR || blocked(x, z)) continue;
          out.x = x;
          out.z = z;
          break search;
        }
      }
    }
    if (Vector3.Distance(out, pos) > 0.05 && this.built) {
      // Only drops at runtime move silently; layout problems are reported.
    } else if (Vector3.Distance(out, pos) > 0.05) {
      console.warn(
        `[layout] pickup moved from ${pos.x.toFixed(1)},${pos.z.toFixed(1)} to ${out.x.toFixed(1)},${out.z.toFixed(1)}`,
      );
    }
    return out;
  }

  /** Where the exit chimney was when Santa jumped in. */
  protected exitUsed: Vector3 | null = null;

  /**
   * The same exit in every level: Santa hops onto the chimney's rim, shrinks in a
   * puff of sparkles and drops down it.
   */
  protected async diveIntoChimney() {
    const g = this.game;
    const p = g.player;
    p.frozen = true;
    // Scripted path into the chimney: the chimney's collider must not push him out sideways.
    p.kinematic = true;
    p.body.velocity.setAll(0);
    const top = this.exitUsed ?? p.body.position.clone();
    const from = p.body.position.clone();
    sound.whoosh();
    await g.tween(0.25, (k) => {
      p.body.position.copyFrom(Vector3.Lerp(from, top, k));
      p.body.position.y += Math.sin(k * Math.PI) * 0.6;
    });
    g.fx.sparkle(top.add(new Vector3(0, 1, 0)), 40);
    sound.bell();
    await g.tween(0.6, (k) => {
      p.rig.root.scaling.setAll(Math.max(0.01, 1 - k));
      p.body.position.y = top.y - k * 1.2;
    });
    p.rig.setEnabled(false);
    p.rig.root.scaling.setAll(1);
    g.fx.puff(top.add(new Vector3(0, 0.4, 0)), "snow", 20, 1.2);
  }

  /** True once build() has finished (runtime spawns vs. level layout). */
  built = false;

  /**
   * Layout checks for tests: props overlapping each other, solid-looking props
   * with nothing to stand on or bump into, and pickups outside the bounds.
   */
  audit() {
    const g = this.game;
    const issues: string[] = [];
    const roots = g.levelRoot.getChildren((n) => isMesh(n as TransformNode), true) as Mesh[];
    const boxes = roots
      .filter((m) => m.isEnabled() && m.isVisible !== false)
      .map((m) => {
        const { min, max } = m.getHierarchyBoundingVectors(true);
        return { name: m.name, min, max, mesh: m };
      })
      .filter((b) => b.max.y - b.min.y < 40 && b.max.x - b.min.x < 40 && b.max.z - b.min.z < 40);
    const solidish =
      /gift|loot|crate|ginger|cottage|workshop|stall|church|chalet|shed|hut|cabane|house|car|woodpile|trough|tank|evap|table|bleachers|scoreboard|snowman|rock|lamp|tree|exit|lantern|net|chimney/i;
    const building =
      /ginger|cottage|workshop|stall|church|chalet|shed|hut|cabane|car|tank|evap|bleachers|scoreboard|exit|tree_/i;
    const small = /gift|loot|crate|woodpile|trough|rock|snowman|exit|lantern/i;
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i] as (typeof boxes)[number];
      if (!small.test(a.name)) continue;
      for (let j = 0; j < boxes.length; j++) {
        const b = boxes[j] as (typeof boxes)[number];
        if (i === j || !building.test(b.name) || a.name === b.name) continue;
        const ox = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
        const oy = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
        const oz = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
        if (ox > 0.25 && oy > 0.25 && oz > 0.25) {
          issues.push(`overlap ${a.name} @${a.min.add(a.max).scale(0.5).toString()} in ${b.name}`);
        }
      }
    }
    for (const b of boxes) {
      if (!solidish.test(b.name) || b.max.y - b.min.y < 0.5) continue;
      const cx = (b.min.x + b.max.x) / 2;
      const cz = (b.min.z + b.max.z) / 2;
      if (
        Math.hypot(cx - g.physics.boundsCenter.x, cz - g.physics.boundsCenter.z) >
        g.physics.boundsRadius
      )
        continue;
      const hasCol = g.physics.colliders.some(
        (c) =>
          c.enabled &&
          cx > c.min.x - 0.2 &&
          cx < c.max.x + 0.2 &&
          cz > c.min.z - 0.2 &&
          cz < c.max.z + 0.2,
      );
      const isPickup =
        this.pickups.some((p) => p.mesh === b.mesh) ||
        this.breakables.some((x) => x.mesh === b.mesh);
      if (!hasCol && !isPickup)
        issues.push(`no collider ${b.name} @${cx.toFixed(1)},${cz.toFixed(1)}`);
    }
    // Walls and buildings must be solid wherever they're drawn: a wall mesh reaching
    // past its collider is a wall you walk through. Sample its footprint at mid-height.
    const structure = /wall|plex/i;
    for (const m of roots) {
      if (!m.isEnabled() || !structure.test(m.name)) continue;
      // Sample in the mesh's own frame (its local box, turned into the world), so a
      // diagonal wall isn't judged by the empty corners of its world bounding box.
      m.computeWorldMatrix(true);
      const bb = m.getBoundingInfo().boundingBox;
      const lo = bb.minimum;
      const hi = bb.maximum;
      const world = m.getWorldMatrix();
      const tol = 0.15;
      let bare = 0;
      for (let i = 0; i <= 4; i++) {
        for (let k = 0; k <= 4; k++) {
          const local = new Vector3(
            lo.x + 0.1 + (hi.x - lo.x - 0.2) * (i / 4),
            (lo.y + hi.y) / 2,
            lo.z + 0.1 + (hi.z - lo.z - 0.2) * (k / 4),
          );
          const { x, y, z } = Vector3.TransformCoordinates(local, world);
          const solid = g.physics.colliders.some(
            (c) =>
              c.enabled &&
              x >= c.min.x - tol &&
              x <= c.max.x + tol &&
              z >= c.min.z - tol &&
              z <= c.max.z + tol &&
              y >= c.min.y - tol &&
              y <= c.max.y + tol,
          );
          if (!solid) bare++;
        }
      }
      if (bare > 0) {
        const c = Vector3.TransformCoordinates(lo.add(hi).scale(0.5), world);
        issues.push(
          `walk-through ${m.name} @${c.x.toFixed(1)},${c.z.toFixed(1)} (${bare}/25 spots without collider)`,
        );
      }
    }
    // Health, power-ups and weapons sit on something. (Candies and bells may float on
    // purpose: arcs over gaps, jump challenges.) Probe a body-sized footprint, as the
    // physics does, so the small cells of a rotated collider count as ground.
    for (const p of this.pickups) {
      if (p.collected || /^(candy|bell)/.test(p.mesh.name)) continue;
      const below = g.physics.groundHeightAt(p.pos.x, p.pos.z, p.pos.y + 0.2, 0.45);
      if (p.pos.y - below > 1.3) {
        issues.push(
          `floating ${p.mesh.name} @${p.pos.x.toFixed(1)},${p.pos.y.toFixed(1)},${p.pos.z.toFixed(1)} (${(p.pos.y - below).toFixed(1)} m up)`,
        );
      }
    }
    for (const p of this.pickups) {
      if (p.collected) continue;
      const d = Math.hypot(p.pos.x - g.physics.boundsCenter.x, p.pos.z - g.physics.boundsCenter.z);
      if (d > g.physics.boundsRadius - 0.5)
        issues.push(`pickup outside bounds @${p.pos.toString()}`);
    }
    return issues;
  }

  /**
   * A horde: `total` enemies from `roster` (cycled), dropped in evil gifts in small
   * clusters at `spots`, never more than `maxAlive` alive at once — fresh ones arrive as
   * others fall, so a fight stays busy without overloading the frame. Resolves when the
   * whole horde is dead.
   */
  protected async horde(
    spots: Vector3[],
    roster: ElfTuning[],
    o: {
      total: number;
      maxAlive?: number;
      every?: number;
      cluster?: number;
      /** Stop sending more (and return at once) when this turns true. */
      until?: () => boolean;
    },
  ) {
    const g = this.game;
    const maxAlive = Math.min(o.maxAlive ?? 18, MAX_ALIVE);
    const cluster = o.cluster ?? 3;
    let spawned = 0;
    let wave = 0;
    while (spawned < o.total) {
      if (o.until?.()) return;
      const room = maxAlive - g.enemies.aliveCount;
      if (room >= Math.min(cluster, o.total - spawned)) {
        const spot = spots[wave++ % spots.length] as Vector3;
        const n = Math.min(cluster, o.total - spawned, room);
        for (let i = 0; i < n; i++, spawned++) {
          const a = (i / n) * Math.PI * 2;
          const tuning = roster[spawned % roster.length] as ElfTuning;
          const at = spot.add(new Vector3(Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3));
          if (tuning.charge) {
            const e = g.enemies.spawn(at, {
              tuning,
              yaw: Math.atan2(g.player.body.position.x - at.x, g.player.body.position.z - at.z),
            });
            e.aggro = true;
            e.setState("chase");
          } else g.enemies.spawnFromGift(at, tuning);
        }
        sound.growl();
      }
      await g.wait(o.every ?? 1.2);
    }
    // Gifts still landing, then everyone down.
    while (g.enemies.aliveCount > 0 && g.enemies.elves.some((e) => e.alive && !e.perched)) {
      if (o.until?.()) return;
      await g.wait(0.3);
    }
  }

  /** Mark something as interactable (see Aura). Returns a handle; call removeAura when done. */
  aura(
    pos: Vector3,
    kind: TwinkleKind,
    o: {
      node?: TransformNode;
      ring?: boolean;
      ringSize?: number;
      height?: number;
      spread?: number;
    } = {},
  ) {
    const g = this.game;
    let ring: Mesh | null = null;
    if (o.ring !== false) {
      const floor = g.physics.groundHeightAt(pos.x, pos.z, pos.y + 0.3);
      ring = g.protoClone(`auraRing_${kind}`, () => {
        const m = MeshBuilder.CreateTorus(
          "auraRing",
          { diameter: 1.3, thickness: 0.07, tessellation: 28 },
          g.scene,
        );
        m.material = g.mats.glow(Color3.FromHexString(AURA_HEX[kind]), 0.9);
        m.isPickable = false;
        return m;
      });
      ring.parent = g.levelRoot;
      ring.position.set(pos.x, floor + 0.04, pos.z);
      ring.scaling.setAll(o.ringSize ?? 1);
    }
    const a: Aura = {
      node: o.node ?? null,
      pos: pos.clone(),
      kind,
      ring,
      ringSize: o.ringSize ?? 1,
      height: o.height ?? 0.2,
      spread: o.spread ?? 0.6,
      timer: Math.random() * 0.5,
      dead: false,
    };
    this.auras.push(a);
    return a;
  }

  removeAura(a: Aura | null | undefined) {
    if (!a || a.dead) return;
    a.dead = true;
    a.ring?.dispose();
    const i = this.auras.indexOf(a);
    if (i >= 0) this.auras.splice(i, 1);
  }

  private updateAuras(dt: number, ppos: Vector3) {
    const g = this.game;
    const pulse = 1 + Math.sin(g.time * 3) * 0.08;
    for (const a of this.auras) {
      const at = a.node ? a.node.position : a.pos;
      if (a.ring) {
        a.ring.rotation.y += dt * 0.8;
        a.ring.scaling.setAll(a.ringSize * pulse);
      }
      a.timer -= dt;
      if (a.timer > 0) continue;
      a.timer = 0.25 + Math.random() * 0.3;
      if (flatDistance(at, ppos) > 45) continue;
      g.fx.twinkle(new Vector3(at.x, at.y + a.height, at.z), a.kind, 1, a.spread);
    }
  }

  protected bell(x: number, y: number, z: number) {
    const mesh = this.game.protoClone("bell", () => this.game.props.bell());
    return this.pickup(mesh, new Vector3(x, y, z), () => {
      this.bellsFound++;
      sound.bell();
      this.game.fx.sparkle(new Vector3(x, y + 0.3, z), 30);
      this.game.updateBells();
    });
  }

  /** Candy collectible: the breadcrumb trail that pulls you around the level. */
  protected candy(x: number, y: number, z: number) {
    const i = this.candiesTotal++;
    const mesh = this.game.protoClone(`candy${i % 5}`, () => this.game.props.candy(i % 5));
    const p = this.pickup(
      mesh,
      new Vector3(x, y, z),
      () => {
        this.candiesFound++;
        sound.candy(this.candiesFound);
        this.game.fx.sparkle(new Vector3(x, y, z), 6);
        this.game.updateCandies();
      },
      0.55,
      null,
    );
    p.spin = 3;
    return p;
  }

  /** A line of `n` candies from a to b (y = height above whatever is underneath, unless absolute). */
  protected candyLine(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    n: number,
    y = 0.7,
    absolute = false,
  ) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const base = absolute ? 0 : this.game.physics.groundHeightAt(x, z, 50);
      this.candy(x, base + y, z);
    }
  }

  protected candyRing(cx: number, cz: number, r: number, n: number, y = 0.7) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      this.candy(x, this.game.physics.groundHeightAt(x, z, 50) + y, z);
    }
  }

  /** Health pickup. `big` = tourtière (+50), otherwise sucre à la crème (+15). */
  health(x: number, z: number, big = false, y?: number) {
    const g = this.game;
    const mesh = big
      ? g.protoClone("tourtiere", () => g.props.tourtiere())
      : g.protoClone("sucre", () => g.props.sucreCreme());
    const base = y ?? g.physics.groundHeightAt(x, z, 50);
    return this.pickup(
      mesh,
      new Vector3(x, base + 0.5, z),
      () => {
        g.player.heal(big ? 50 : 15);
        sound.heal();
        g.fx.sparkle(new Vector3(x, base + 0.8, z), 16);
      },
      0.9,
      "heal",
    );
  }

  /** Timed power-up: twinkles and a ring in its color so you can spot it. */
  buff(kind: "rage" | "speed" | "shield", x: number, z: number, y?: number) {
    const g = this.game;
    const mesh =
      kind === "rage"
        ? g.props.tire()
        : kind === "speed"
          ? g.props.hotChocolate()
          : g.props.tuque();
    const base = y ?? g.physics.groundHeightAt(x, z, 50);
    const p = this.pickup(
      mesh,
      new Vector3(x, base + 0.5, z),
      () => {
        g.player.giveBuff(kind);
        g.onBuff(kind);
        g.fx.sparkle(new Vector3(x, base + 1, z), 30);
      },
      1,
      kind,
    );
    if (p.aura) p.aura.spread = 0.9;
    return p;
  }

  protected breakable(
    mesh: Mesh,
    x: number,
    z: number,
    w: number,
    h: number,
    hp: number,
    onBreak: () => void,
  ) {
    this.place(mesh, x, z);
    const collider = this.solid(x, z, w, h, w);
    this.breakables.push({
      mesh,
      collider,
      pos: new Vector3(x, 0, z),
      hp,
      radius: w / 2,
      height: h,
      onBreak,
    });
  }

  protected exitChimney(x: number, z: number, onEnter: () => void) {
    const y = this.floor(x, z);
    const mesh = this.game.props.exitChimney();
    this.place(mesh, x, z, { y });
    this.solid(x, z, 1.8, 2.3, 1.8, y);
    this.solid(x, z + 1.4, 1.3, 0.95, 1.0, y);
    this.exit = { mesh, pos: new Vector3(x, y + 2.4, z), open: false, onEnter };
  }

  openExit() {
    if (!this.exit || this.exit.open) return;
    this.exit.open = true;
    const glow = this.game.mats.glow(this.game.colorOf("warmLight"), 1.4);
    const top = this.game.props.starPickup();
    top.scaling.setAll(1.6);
    this.place(top, this.exit.pos.x, this.exit.pos.z, { y: this.exit.pos.y + 1, shadow: false });
    top.getChildMeshes().forEach((m) => {
      m.material = glow;
    });
    this.spinners.push({ node: top, speed: 1.5 });
    this.aura(this.exit.pos.add(new Vector3(0, 0.6, 0)), "gold", { ring: false, spread: 1.6 });
    sound.open();
  }

  /** A warm point light (fire, lamp) that counts toward the light budget. */
  protected pointLight(pos: Vector3, hex = "#ffb060", intensity = 1.5, range = 14) {
    const light: LocalLight = {
      position: pos.clone(),
      diffuse: Color3.FromHexString(hex),
      intensity,
      range,
    };
    this.localLights.push(light);
    return light;
  }

  /** A boiling cauldron: hot to touch, deadly for elves knocked into it. */
  protected cauldron(x: number, z: number) {
    const g = this.game;
    const y = this.floor(x, z);
    const mesh = g.protoClone("cauldron", () => g.props.cauldron());
    this.place(mesh, x, z, { y });
    this.solid(x, z, 2.2, 1.6, 2.2, y);
    this.cauldrons.push({ pos: new Vector3(x, y, z), radius: 1.2, top: y + 1.6 });
    this.pointLight(new Vector3(x, y + 1.2, z), "#ff8a3a", 1.3, 10);
  }

  /** A sticky syrup spill: slows everyone; the flamethrower sets it on fire. */
  protected syrupPatch(x: number, z: number, radius: number) {
    const g = this.game;
    const y = this.floor(x, z);
    const mesh = g.props.syrupPuddle(radius);
    this.place(mesh, x, z, { y: y + 0.02, shadow: false });
    this.syrup.push({ pos: new Vector3(x, y, z), radius, burning: 0, mesh });
  }

  /** Can an elf walk here? (Levels with water say no; knockback can still push them in.) */
  walkable(_x: number, _z: number) {
    return true;
  }

  /** How much the ground slows you down here (1 = normal). */
  speedFactor(pos: Vector3) {
    for (const s of this.syrup) {
      if (flatDistance(pos, s.pos) < s.radius && pos.y < s.pos.y + 0.5) return 0.5;
    }
    return 1;
  }

  /** Set syrup on fire inside a cone (flamethrower). */
  ignite(origin: Vector3, yaw: number, range: number, halfAngle: number) {
    for (const s of this.syrup) {
      const dx = s.pos.x - origin.x;
      const dz = s.pos.z - origin.z;
      const d = Math.hypot(dx, dz) - s.radius;
      if (d > range) continue;
      let a = Math.atan2(dx, dz) - yaw;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) > halfAngle + 0.4 && d > 0.5) continue;
      if (s.burning <= 0) {
        sound.flame();
        s.mesh
          .getChildMeshes(false)
          .concat(s.mesh)
          .forEach((m) => {
            m.material = this.game.mats.glow(Color3.FromHexString("#ff7a1a"), 1.1);
          });
      }
      s.burning = 6;
    }
  }

  /** An elf knocked hard into a hazard. Returns true if it died. */
  /** Would landing on the ground at (x, z), height y, kill an elf? (They won't walk off into it.) */
  deadlyGround(_x: number, _z: number, y: number) {
    return y < this.killY + 0.5;
  }

  elfIntoHazard(e: import("../enemies/Elf").Elf) {
    for (const c of this.cauldrons) {
      if (flatDistance(e.body.position, c.pos) < c.radius + 0.9) {
        const g = this.game;
        g.fx.puff(c.pos.add(new Vector3(0, 1.8, 0)), "orange", 30, 1.4);
        g.fx.puff(c.pos.add(new Vector3(0, 2.2, 0)), "white", 20, 1.6);
        sound.scream();
        g.enemies.hit(e, 999, c.pos, "slam", 1);
        this.onCauldronKill();
        return true;
      }
    }
    return false;
  }

  /** Hook for levels (e.g. a tip the first time). */
  protected onCauldronKill() {}

  /** Is the ground slippery here? Levels with ice patches override this. */
  isIcy(_pos: Vector3) {
    return this.icy;
  }

  /** Ground height (terrain or flat) at x, z. */
  protected floor(x: number, z: number) {
    return this.game.physics.floorAt(x, z);
  }

  protected addCheckpoint(x: number, z: number, yaw: number) {
    this.checkpoints.push({ pos: new Vector3(x, this.floor(x, z), z), yaw });
    return this.checkpoints.length - 1;
  }

  /** Save progress at checkpoint `i` (only moves forward). */
  protected reachCheckpoint(i: number) {
    if (i <= this.checkpoint) return;
    this.checkpoint = i;
    this.game.saveResume(this.id, i);
    this.game.toast("Point de sauvegarde", "La lanterne veille sur toi");
  }

  /** A gift you can unwrap (punch or shoot) for loot. */
  protected lootGift(x: number, z: number, colorway: number, size = 0.9) {
    const g = this.game;
    const y = this.floor(x, z);
    const mesh = g.protoClone(`loot_${colorway}_${size}`, () =>
      g.props.gift(size, size * 0.8, size, colorway),
    );
    mesh.position.y = y;
    this.place(mesh, x, z, { y });
    const collider = this.solid(x, z, size, size * 0.8, size, y);
    // Loot gifts wear a glowing bow, twinkle and wiggle now and then: "hit me".
    const bow = g.protoClone("lootBow", () => g.props.lootBow());
    bow.parent = mesh;
    bow.position.set(0, size * 0.8, 0);
    bow.scaling.setAll(size / 0.9);
    const aura = this.aura(new Vector3(x, y + size * 0.4, z), "gold", {
      ringSize: size * 1.3,
      spread: size,
    });
    this.breakables.push({
      mesh,
      collider,
      pos: new Vector3(x, y, z),
      hp: 1,
      radius: size * 0.7,
      height: size * 0.8,
      wiggle: 1 + Math.random() * 2,
      onBreak: () => {
        this.removeAura(aura);
        this.dropUnwrapLoot(new Vector3(x, y, z));
      },
    });
  }

  private dropUnwrapLoot(pos: Vector3) {
    const g = this.game;
    sound.confettiPop();
    g.fx.puff(pos.add(new Vector3(0, 0.6, 0)), "candyPink", 20);
    g.fx.sparkle(pos.add(new Vector3(0, 0.6, 0)), 20);
    const r = Math.random();
    if (r < 0.2) this.buff(Math.random() < 0.5 ? "speed" : "rage", pos.x, pos.z, pos.y);
    else if (r < 0.35) this.health(pos.x, pos.z, true, pos.y);
    else this.health(pos.x, pos.z, false, pos.y);
  }

  /** A lantern on a post. Punch or shoot it to light it up. */
  protected lantern(x: number, z: number, onLit: () => void = () => {}) {
    const g = this.game;
    const y = this.floor(x, z);
    const mesh = g.protoClone("lanternOff", () => g.props.lantern(false));
    this.place(mesh, x, z, { y });
    this.solid(x, z, 0.4, 2.3, 0.4, y);
    const l: Lantern = {
      mesh,
      lamp: new Vector3(x + 0.6, y + 1.72, z),
      lit: false,
      light: null,
      onLit,
      aura: null,
    };
    l.aura = this.aura(l.lamp, "warm", { ring: false, height: 0, spread: 0.35 });
    this.lanterns.push(l);
    return l;
  }

  protected lightLantern(l: Lantern, silent = false) {
    if (l.lit) return;
    const g = this.game;
    l.lit = true;
    this.removeAura(l.aura);
    const pos = l.mesh.position.clone();
    l.mesh.dispose();
    l.mesh = g.protoClone("lanternOn", () => g.props.lantern(true));
    this.place(l.mesh, pos.x, pos.z, { y: pos.y, shadow: false });
    const light: LocalLight = {
      position: l.lamp.clone(),
      diffuse: new Color3(1, 0.78, 0.45),
      intensity: 1.6,
      range: 16,
    };
    l.light = light;
    this.localLights.push(light);
    if (!silent) {
      sound.open();
      g.fx.sparkle(l.lamp, 30);
    }
    l.onLit();
  }

  /**
   * A thin-instanced forest: one draw call for hundreds of trees.
   * Each tree also gets a trunk collider.
   */
  protected forest(
    points: ReadonlyArray<readonly [number, number, number]>,
    seed = 1,
    kind: "pine" | "maple" = "pine",
    shadows = true,
  ) {
    const g = this.game;
    const rand = mulberry32(seed);
    const variants =
      kind === "maple"
        ? [g.props.maple(seed), g.props.maple(seed + 1), g.props.maple(seed + 2)]
        : [g.props.pine(6, seed), g.props.pine(7.5, seed + 1), g.props.pine(5, seed + 2)];
    variants.forEach((v, i) => {
      v.parent = g.levelRoot;
      v.position.setAll(0);
      v.receiveShadows = true;
      if (shadows) g.env.castShadows(v);
      const mats: Matrix[] = [];
      points.forEach(([x, z, s], k) => {
        if (k % variants.length !== i) return;
        const y = this.floor(x, z) - 0.2;
        const q = Quaternion.RotationAxis(Vector3.Up(), rand() * Math.PI * 2);
        mats.push(
          Matrix.Compose(
            new Vector3(s, s * randRange(rand, 0.9, 1.15), s),
            q,
            new Vector3(x, y, z),
          ),
        );
        // Tall enough that the camera pulls in instead of clipping into the branches.
        this.solid(x, z, 0.7 * s, 7, 0.7 * s, y);
      });
      for (const m of mats) v.thinInstanceAdd(m, false);
      v.thinInstanceRefreshBoundingInfo();
      v.thinInstanceBufferUpdated("matrix");
    });
  }

  private updateHazards(dt: number, ppos: Vector3) {
    const g = this.game;
    this.hazardTick -= dt;
    const tick = this.hazardTick <= 0;
    if (tick) this.hazardTick = 0.5;
    for (const c of this.cauldrons) {
      if (Math.random() < dt * 2) sound.boil();
      if (Math.random() < dt * 1.5) g.fx.puff(c.pos.add(new Vector3(0, 1.9, 0)), "white", 3, 1.2);
      if (tick && flatDistance(ppos, c.pos) < c.radius + 0.7 && ppos.y < c.top + 0.6) {
        g.player.hurt(10, c.pos);
        g.player.burn(1);
      }
    }
    for (const s of this.syrup) {
      if (s.burning <= 0) continue;
      s.burning -= dt;
      if (Math.random() < dt * 14) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * s.radius;
        g.fx.puff(s.pos.add(new Vector3(Math.cos(a) * r, 0.3, Math.sin(a) * r)), "orange", 2, 0.9);
      }
      if (flatDistance(ppos, s.pos) < s.radius && ppos.y < s.pos.y + 0.8) g.player.burn(1);
      for (const e of g.enemies.elves) {
        if (e.alive && flatDistance(e.body.position, s.pos) < s.radius)
          e.burnTime = Math.max(e.burnTime, 2);
      }
      if (s.burning <= 0) {
        const mat = g.mats.toon;
        s.mesh
          .getChildMeshes(false)
          .concat(s.mesh)
          .forEach((m) => {
            m.material = mat;
          });
      }
    }
  }

  // ---------- Runtime ----------

  /** A snow globe: freezes every elf (and stuns the boss) around Santa. */
  protected snowGlobe(x: number, z: number, y?: number) {
    const g = this.game;
    const base = y ?? g.physics.groundHeightAt(x, z, 50);
    return this.pickup(
      g.props.snowGlobe(),
      new Vector3(x, base + 0.5, z),
      () => {
        const ppos = g.player.body.position;
        g.enemies.freeze(ppos, 18, 4);
        this.onSnowGlobe();
        sound.freeze();
        g.fx.ring(ppos.add(new Vector3(0, 0.5, 0)), 18);
        g.fx.puff(ppos.add(new Vector3(0, 1.2, 0)), "ice", 40, 2);
        g.toast("Boule à neige!", "Tout le monde gèle 4 secondes");
      },
      1,
      "ice",
    );
  }

  /** Hook: a snow globe went off (bosses get stunned). */
  protected onSnowGlobe() {}

  /** Melee against props (snowmen…). Returns true if something was hit. */
  punchProps(pos: Vector3, yaw: number, range: number, radial = false) {
    let hit = false;
    const boss = this.boss;
    if (boss?.alive) {
      const dx = boss.center.x - pos.x;
      const dz = boss.center.z - pos.z;
      const d = Math.hypot(dx, dz) - boss.radius;
      let a = Math.atan2(dx, dz) - yaw;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      if (d < range + 0.4 && (radial || Math.abs(a) < 1.2)) {
        boss.damage(radial ? 4 : 2, radial ? "slam" : "punch", pos);
        hit = true;
      }
    }
    for (let i = this.breakables.length - 1; i >= 0; i--) {
      const b = this.breakables[i] as Breakable;
      const dx = b.pos.x - pos.x;
      const dz = b.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range + 0.6) continue;
      if (!radial) {
        let a = Math.atan2(dx, dz) - yaw;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(a) > 1.1 && d > 0.8) continue;
      }
      hit = true;
      this.hitBreakable(b, yaw);
    }
    for (const l of this.lanterns) {
      if (!l.lit && flatDistance(l.lamp, pos) < range + 0.9) {
        this.lightLantern(l);
        hit = true;
      }
    }
    return hit;
  }

  /** `damage`: the weapon's damage, so a heavy shot breaks things faster than a light one. */
  private hitBreakable(b: Breakable, yaw: number, damage = 1) {
    b.hp -= damage;
    b.mesh.scaling.set(1.15, 0.85, 1.15);
    this.game.fx.puff(b.pos.add(new Vector3(0, b.height * 0.5, 0)), "snow", 12);
    if (b.hp > 0) return;
    const i = this.breakables.indexOf(b);
    if (i >= 0) this.breakables.splice(i, 1);
    b.collider.enabled = false;
    b.mesh.setParent(null);
    this.game.fx.puff(b.pos.add(new Vector3(0, b.height * 0.5, 0)), "snow", 40, 1.6);
    sound.smash();
    this.game.gore.toss(b.mesh, new Vector3(Math.sin(yaw) * 6, 5, Math.cos(yaw) * 6), 2.5);
    b.onBreak();
  }

  /**
   * Bullets against props: lanterns light up, breakables take a hit.
   * Returns the hit distance, or null if nothing was hit before `maxDist`.
   */
  shootProps(origin: Vector3, dir: Vector3, maxDist: number, damage = 1): number | null {
    let best: { d: number; apply: () => void } | null = null;
    for (const l of this.lanterns) {
      if (l.lit) continue;
      const t = raySphere(origin, dir, l.lamp, 0.45);
      if (t !== null && t < maxDist && (!best || t < best.d))
        best = { d: t, apply: () => this.lightLantern(l) };
    }
    for (const b of this.breakables) {
      const t = raySphere(
        origin,
        dir,
        b.pos.add(new Vector3(0, b.height * 0.5, 0)),
        b.radius + 0.1,
      );
      if (t !== null && t < maxDist && (!best || t < best.d)) {
        best = { d: t, apply: () => this.hitBreakable(b, Math.atan2(dir.x, dir.z), damage) };
      }
    }
    if (!best) return null;
    best.apply();
    return best.d;
  }

  /** An explosion hurts every breakable within `radius` (by its full damage). */
  blastProps(center: Vector3, radius: number, damage: number) {
    for (const b of [...this.breakables]) {
      const mid = b.pos.add(new Vector3(0, b.height * 0.5, 0));
      if (Vector3.Distance(mid, center) < radius + b.radius) {
        this.hitBreakable(b, Math.atan2(b.pos.x - center.x, b.pos.z - center.z), damage);
      }
    }
  }

  update(dt: number) {
    const g = this.game;
    const ppos = g.player.body.position;
    const t = g.time;
    this.updateAuras(dt, ppos);
    for (const p of this.pickups) {
      if (p.collected) continue;
      p.mesh.rotation.y += p.spin * dt;
      p.mesh.position.y = p.pos.y + Math.sin(t * 2.5 + p.bob) * 0.15;
      const center = ppos.add(new Vector3(0, 0.8, 0));
      if (Vector3.Distance(center, p.mesh.position) < p.radius + 0.6) {
        p.collected = true;
        p.mesh.dispose();
        this.removeAura(p.aura);
        p.onCollect();
      }
    }
    for (const tr of this.triggers) {
      if (!tr.enabled || (tr.once && tr.fired)) continue;
      const inside = flatDistance(ppos, tr.pos) < tr.radius;
      if (inside && !tr.fired) {
        tr.fired = true;
        tr.onEnter();
      } else if (!inside && !tr.once) {
        tr.fired = false;
      }
    }
    for (const b of this.breakables) {
      if (b.wiggle !== undefined) {
        b.wiggle -= dt;
        if (b.wiggle <= 0) {
          b.wiggle = 2.5 + Math.random() * 2;
          b.mesh.scaling.set(1.12, 0.88, 1.12);
        }
      }
      b.mesh.scaling.x += (1 - b.mesh.scaling.x) * Math.min(1, dt * 12);
      b.mesh.scaling.y += (1 - b.mesh.scaling.y) * Math.min(1, dt * 12);
      b.mesh.scaling.z = b.mesh.scaling.x;
    }
    for (const s of this.spinners) s.node.rotation.y += s.speed * dt;
    // Feed the closest local lights to the game's fixed pool of point lights.
    const pool = g.lightPool;
    const sorted =
      this.localLights.length > pool.length
        ? [...this.localLights].sort(
            (a, b) => flatDistance(a.position, ppos) - flatDistance(b.position, ppos),
          )
        : this.localLights;
    for (let i = 0; i < pool.length; i++) {
      const real = pool[i] as PointLight;
      const want = sorted[i];
      if (want) {
        real.position.copyFrom(want.position);
        real.diffuse.copyFrom(want.diffuse);
        real.intensity = want.intensity;
        real.range = want.range;
      } else {
        real.intensity = 0;
      }
    }
    this.updateHazards(dt, ppos);
    if (this.lanterns.length) {
      // Lit lanterns push the fog back around them.
      let near = Number.POSITIVE_INFINITY;
      for (const l of this.lanterns) if (l.lit) near = Math.min(near, flatDistance(l.lamp, ppos));

      const target = 1 - 0.55 * clamp(1 - near / 18, 0, 1);
      g.env.fogScale += (target - g.env.fogScale) * Math.min(1, dt * 2);
    }
    for (const n of this.npcs) n.update(dt, g.player.frozen ? null : ppos);
    if (
      this.exit?.open &&
      flatDistance(ppos, this.exit.pos) < 1.5 &&
      ppos.y > this.exit.pos.y - 0.9
    ) {
      const e = this.exit;
      this.exit = null;
      this.exitUsed = e.pos.clone();
      e.onEnter();
    }
    this.tick(dt);
  }
}

function isMesh(n: TransformNode): n is Mesh {
  return "getTotalVertices" in n;
}
