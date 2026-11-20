import { Color3, type Mesh, Vector3 } from "@babylonjs/core";
import {
  createElf,
  createFouettard,
  createMutantSnowman,
  createNutcracker,
  createReindeer,
  createSnowball,
} from "../assets/characters";
import { sound } from "../audio/Sound";
import type { Game } from "../core/Game";
import { approach, flatDistance, pick } from "../core/math";
import { LINES } from "../i18n/fr-QC";
import { hud } from "../ui/store";
import { raySphere } from "../world/Physics";
import { type DamageKind, ELF_BASIC, Elf, type ElfTuning, SNOWBALL } from "./Elf";

const MAX_ATTACKERS = 3;
const GRAVITY = 24;

interface PendingSpawn {
  gift: Mesh;
  pos: Vector3;
  t: number;
  tuning: ElfTuning;
}

/** Longest an elf follows an obstacle sideways before trying straight at Santa again. */
const DETOUR_MAX = 3;

export class EnemyManager {
  readonly elves: Elf[] = [];
  private readonly pending: PendingSpawn[] = [];
  kills = 0;
  onKill: ((elf: Elf, kind: DamageKind) => void) | null = null;

  constructor(private readonly game: Game) {}

  get aliveCount() {
    return this.elves.filter((e) => e.alive).length + this.pending.length;
  }

  clear() {
    for (const e of this.elves) if (e.alive) e.rig.dispose();
    this.elves.length = 0;
    for (const p of this.pending) p.gift.dispose();
    this.pending.length = 0;
    this.kills = 0;
  }

  /**
   * Ledges: an elf won't step off a drop of more than 1.6 m if the fall would kill it
   * (slush, water, the grinder), nor at all unless Santa is down there. It slides along
   * the edge instead. (Being knocked off is another matter.)
   */
  private guardLedge(e: Elf, wish: Vector3, ppos: Vector3) {
    if (!e.body.grounded || e.perched) return;
    const g = this.game;
    const p = e.body.position;
    const safe = (dx: number, dz: number) => {
      const l = Math.hypot(dx, dz);
      if (l < 0.1) return true;
      const x = p.x + (dx / l) * (e.body.radius + 0.5);
      const z = p.z + (dz / l) * (e.body.radius + 0.5);
      const below = g.physics.groundHeightAt(x, z, p.y + 0.4);
      if (g.level.deadlyGround(x, z, below)) return false;
      if (p.y - below < 1.6) return true;
      return ppos.y < p.y - 1.5;
    };
    if (safe(wish.x, wish.z)) return;
    // A gap with a roof across it: melee elves leap it instead of stopping at the edge.
    if (e.state === "chase" && !e.tuning.ranged && !e.tuning.boss && !e.tuning.charge) {
      const d = this.leapAcross(e, wish.x, wish.z);
      if (d > 0) {
        // Up at 11 m/s, ~0.9 s in the air: enough to land 1.5 m past the far edge.
        const l = Math.hypot(wish.x, wish.z);
        const speed = (d + 1.5) / 0.85;
        e.body.velocity.set((wish.x / l) * speed, 11, (wish.z / l) * speed);
        e.leaping = true;
        e.body.grounded = false;
        e.anim.bounce(0.45);
        sound.elfSquawk();
        return;
      }
    }
    if (safe(wish.x, 0)) wish.z = 0;
    else if (safe(0, wish.z)) wish.x = 0;
    else wish.setAll(0);
  }

  /**
   * Distance to safe ground about level with the elf across a gap ahead, or 0. Only gaps
   * between roofs (a deep drop right ahead), not pits on the floor like the grinder.
   */
  private leapAcross(e: Elf, dx: number, dz: number) {
    const g = this.game;
    const p = e.body.position;
    const l = Math.hypot(dx, dz);
    if (l < 0.1) return 0;
    const edge = e.body.radius + 0.5;
    if (p.y - g.physics.groundHeightAt(p.x + (dx / l) * edge, p.z + (dz / l) * edge, p.y + 0.4) < 3)
      return 0;
    for (const d of [2.5, 3.5, 4.5, 5.5]) {
      const x = p.x + (dx / l) * d;
      const z = p.z + (dz / l) * d;
      const h = g.physics.groundHeightAt(x, z, p.y + 1.4);
      if (h > p.y - 1.6 && h < p.y + 1.3 && !g.level.deadlyGround(x, z, h)) return d;
    }
    return 0;
  }

  /** Nothing in the way for the next few metres toward Santa? */
  private wayClear(e: Elf, ppos: Vector3) {
    const from = e.body.position.add(new Vector3(0, 0.5, 0));
    const to = ppos.subtract(e.body.position);
    to.y = 0;
    const d = Math.min(3, to.length());
    if (d < 0.5) return true;
    return this.game.physics.raycast(from, to.normalize(), d) >= d - 0.1;
  }

  /**
   * Stuck against something: follow it sideways (toward the more open side, or the same
   * side as last time) until the way to Santa is clear.
   */
  private startDetour(e: Elf, ppos: Vector3) {
    const g = this.game;
    const eyes = e.body.position.add(new Vector3(0, 0.6, 0));
    const to = ppos.subtract(e.body.position);
    to.y = 0;
    if (to.lengthSquared() < 0.01) return;
    to.normalize();
    const left = new Vector3(-to.z, 0, to.x);
    const right = left.scale(-1);
    const l = g.physics.raycast(eyes, left, 5);
    const r = g.physics.raycast(eyes, right, 5);
    if (Math.max(l, r) < 1) {
      e.detourDir.copyFrom(to.scale(-1));
    } else {
      if (e.detourMemory <= 0) e.detourSide = l >= r ? 1 : -1;
      e.detourDir.copyFrom(e.detourSide > 0 ? left : right);
    }
    e.detourTime = DETOUR_MAX;
    e.detourMemory = 4;
    e.stuckTime = 0;
  }

  /** Cancel the evil gifts still on their way down (nothing comes out of them). */
  dropPending() {
    for (const p of this.pending) p.gift.dispose();
    this.pending.length = 0;
  }

  /** Spawn an elf immediately. */
  spawn(
    pos: Vector3,
    opts: { dormant?: boolean; tuning?: ElfTuning; yaw?: number; perched?: boolean } = {},
  ) {
    const g = this.game;
    const tuning = opts.tuning ?? ELF_BASIC;
    const rig =
      tuning.kind === "snowman"
        ? createMutantSnowman(g.scene, g.mats)
        : tuning.kind === "nutcracker"
          ? createNutcracker(g.scene, g.mats)
          : tuning.kind === "reindeer"
            ? createReindeer(g.scene, g.mats, true)
            : tuning.kind === "fouettard"
              ? createFouettard(g.scene, g.mats)
              : tuning.kind === "snowball"
                ? createSnowball(g.scene, g.mats)
                : createElf(
                    g.scene,
                    g.mats,
                    tuning.kind === "sprinter" ||
                      tuning.kind === "thrower" ||
                      tuning.kind === "bomber" ||
                      tuning.kind === "skater"
                      ? tuning.kind
                      : "possessed",
                    this.elves.length,
                  );
    if (tuning.kind === "sprinter") rig.root.scaling.setAll(0.85);
    if (tuning.scale) rig.root.scaling.setAll(tuning.scale);
    rig.root.parent = g.levelRoot;
    g.env.castShadows(...(rig.allMeshes() as Mesh[]));
    const elf = new Elf(rig, pos, tuning);
    if (tuning.kind === "snowman" || tuning.kind === "snowball") elf.anim.loco.twitch = 0.3;
    elf.dormant = opts.dormant ?? false;
    elf.perched = opts.perched ?? false;
    elf.yaw = opts.yaw ?? 0;
    elf.body.position.y = g.physics.groundHeightAt(pos.x, pos.z, pos.y + 1);
    this.elves.push(elf);
    return elf;
  }

  /** An evil gift drops, shakes, then bursts open with an elf inside. */
  spawnFromGift(pos: Vector3, tuning: ElfTuning = ELF_BASIC) {
    const gift = this.game.protoClone("evilGift", () => this.game.props.evilGift());
    gift.position.copyFrom(pos);
    gift.position.y = this.game.physics.groundHeightAt(pos.x, pos.z) + 6;
    this.pending.push({ gift, pos: pos.clone(), t: 0, tuning });
  }

  /** Snow globe: every elf near `pos` freezes solid for a few seconds. */
  freeze(pos: Vector3, radius: number, seconds: number) {
    let n = 0;
    for (const e of this.elves) {
      if (!e.alive || flatDistance(e.body.position, pos) > radius) continue;
      e.dormant = false;
      e.aggro = true;
      e.stun = Math.max(e.stun, seconds);
      e.kamikaze = false;
      e.body.velocity.x = 0;
      e.body.velocity.z = 0;
      e.rig.flash(seconds, new Color3(0.6, 0.85, 1));
      this.game.fx.puff(e.center, "ice", 10, 1);
      n++;
    }
    return n;
  }

  wakeAll() {
    for (const e of this.elves) {
      e.dormant = false;
      e.aggro = true;
      if (e.state === "idle") e.setState("chase");
    }
  }

  private attackers() {
    let n = 0;
    for (const e of this.elves) if (e.alive && e.hasToken) n++;
    return n;
  }

  private hudTimer = 0;
  private lastLeft = -1;

  update(dt: number) {
    const g = this.game;
    const player = g.player;
    const ppos = player.body.position;
    const head = ppos.add(new Vector3(0, 1.3, 0));

    // How many hostile elves are still up (shown under the objective).
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.25;
      const left =
        this.elves.filter((e) => e.alive && e.aggro && !e.dormant).length + this.pending.length;
      if (left !== this.lastLeft) {
        this.lastLeft = left;
        hud.set({ enemiesLeft: left });
      }
    }

    // Spawner gifts.
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i] as (typeof this.pending)[number];
      p.t += dt;
      const floor = g.physics.groundHeightAt(p.pos.x, p.pos.z);
      if (p.t < 0.5) {
        p.gift.position.y = floor + 6 * (1 - p.t / 0.5) ** 2;
      } else if (p.t < 1.3) {
        p.gift.position.y = floor;
        const k = (p.t - 0.5) / 0.8;
        p.gift.rotation.z = Math.sin(p.t * 40) * 0.12 * k;
        p.gift.scaling.set(1 + k * 0.15, 1 - k * 0.1, 1 + k * 0.15);
        if (p.t - dt < 0.5) {
          g.camRig.shake(0.08);
          sound.land(true);
        }
      } else {
        sound.smash();
        g.gore.burst(p.pos.add(new Vector3(0, 0.6, 0)), null, 30);
        p.gift.dispose();
        this.pending.splice(i, 1);
        const elf = this.spawn(p.pos, {
          tuning: p.tuning,
          yaw: Math.atan2(ppos.x - p.pos.x, ppos.z - p.pos.z),
        });
        elf.aggro = true;
        elf.setState("chase");
        elf.body.velocity.y = 6;
        elf.anim.bounce(0.4);
      }
    }

    for (const e of this.elves) {
      if (!e.alive) continue;
      const eyes = e.body.position.add(new Vector3(0, 0.8, 0));
      const toHead = head.subtract(eyes);
      const dist = toHead.length();
      e.losTimer -= dt;
      if (e.losTimer <= 0) {
        e.losTimer = dist < 8 ? 0.1 : 0.25;
        e.canSee =
          !player.dead && g.physics.raycast(eyes, toHead.scale(1 / dist), dist) >= dist - 0.2;
      }
      const canSee = e.canSee;
      // Anti-softlock: an aggro elf stuck far away out of sight for a long time
      // (wedged behind scenery) is released from the possession and vanishes.
      if (e.aggro && !e.perched && !e.dormant && !canSee && dist > 30) e.lostTime += dt;
      else e.lostTime = 0;
      if (e.lostTime > 15) {
        g.fx.puff(e.center, "plum", 20, 1.2);
        this.hit(e, 999, e.body.position, "finisher", 0);
        continue;
      }
      const wish = e.think(dt, ppos, canSee, () => this.attackers() < MAX_ATTACKERS);
      if (e.throwNow && e.tuning.ranged) {
        // Aim where Santa will be, not where he is.
        e.throwNow = false;
        const r = e.tuning.ranged;
        const lead = player.body.velocity.scale(r.flight * 0.7);
        const target = ppos.add(new Vector3(lead.x, 0, lead.z));
        const from = e.center.add(new Vector3(0, 0.5, 0));
        if (r.projectile === "puck") g.projectiles.slapPuck(e.body.position, ppos, r.damage);
        else if (r.projectile === "bomb") g.projectiles.throwBomb(from, target, r.flight, r.damage);
        else g.projectiles.throwCoal(from, target, r.flight, r.damage);
      }

      // Separation so they don't stack.
      for (const o of this.elves) {
        if (o === e || !o.alive) continue;
        const dx = e.body.position.x - o.body.position.x;
        const dz = e.body.position.z - o.body.position.z;
        const d2 = dx * dx + dz * dz;
        const minD = e.body.radius + o.body.radius + 0.15;
        if (d2 < minD * minD && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          wish.x += (dx / d) * (minD - d) * 8;
          wish.z += (dz / d) * (minD - d) * 8;
        }
      }

      // Sticky syrup slows everyone down.
      const slow = g.level.speedFactor(e.body.position);
      if (slow < 1) {
        wish.x *= slow;
        wish.z *= slow;
      }
      // Going round an obstacle: follow it until the way to Santa is open again.
      e.detourMemory = Math.max(0, e.detourMemory - dt);
      if (e.detourTime > 0) {
        e.detourTime -= dt;
        if (e.detourTime < DETOUR_MAX - 0.4 && this.wayClear(e, ppos)) e.detourTime = 0;
        const sp = Math.hypot(wish.x, wish.z);
        if (sp > 0.1) {
          wish.x = e.detourDir.x * sp;
          wish.z = e.detourDir.z * sp;
        }
      }
      this.guardLedge(e, wish, ppos);
      // Don't walk into the water.
      const wl = Math.hypot(wish.x, wish.z);
      if (wl > 0.1) {
        const ax = e.body.position.x + (wish.x / wl) * 0.9;
        const az = e.body.position.z + (wish.z / wl) * 0.9;
        if (e.body.grounded && !g.level.walkable(ax, az)) {
          // Water ahead. Melee elves leap across short gaps; otherwise they wait at the edge.
          let landing = 0;
          if (!e.tuning.ranged && !e.perched && e.state === "chase") {
            for (const d of [2.5, 3.5, 4.5]) {
              if (
                g.level.walkable(
                  e.body.position.x + (wish.x / wl) * d,
                  e.body.position.z + (wish.z / wl) * d,
                )
              ) {
                landing = d;
                break;
              }
            }
          }
          if (landing > 0) {
            e.body.velocity.y = 10;
            e.body.velocity.x = (wish.x / wl) * (landing + 1.5) * 1.2;
            e.body.velocity.z = (wish.z / wl) * (landing + 1.5) * 1.2;
            e.anim.bounce(0.45);
            sound.elfSquawk();
          } else {
            wish.x = 0;
            wish.z = 0;
          }
        }
      }
      const v = e.body.velocity;
      // Pounce up onto ledges when Santa is above them.
      if (
        e.state === "chase" &&
        !e.tuning.ranged &&
        // Bosses and chargers stay on the ground (no leaping onto walls).
        !e.tuning.boss &&
        !e.tuning.charge &&
        e.body.grounded &&
        ppos.y - e.body.position.y > 0.7 &&
        flatDistance(e.body.position, ppos) < 3.2
      ) {
        v.y = 12.5;
        e.anim.bounce(0.45);
        sound.elfSquawk();
      }
      // Plain elves slip on ice; skaters glide on purpose.
      if (e.body.grounded) e.leaping = false;
      let accel = e.body.grounded ? (e.tuning.accel ?? 30) : e.leaping ? 0 : 8;
      if (!e.tuning.accel && e.body.grounded && g.level.isIcy(e.body.position)) accel *= 0.3;
      v.x = approach(v.x, wish.x + e.knock.x, accel * dt + Math.abs(e.knock.x));
      v.z = approach(v.z, wish.z + e.knock.z, accel * dt + Math.abs(e.knock.z));
      // Knocked hard into a hazard (a boiling cauldron)?
      if (e.knock.length() > 4 && g.level.elfIntoHazard(e)) continue;
      e.knock.scaleInPlace(Math.exp(-8 * dt));
      v.y -= GRAVITY * dt;
      const bx = e.body.position.x;
      const bz = e.body.position.z;
      const moved = g.physics.move(e.body, dt);
      // Pushing into something without getting anywhere: go round it.
      const want = Math.hypot(wish.x, wish.z);
      if (
        e.state === "chase" &&
        e.body.grounded &&
        want > 1 &&
        e.detourTime <= 0 &&
        e.knock.length() < 1
      ) {
        const got = Math.hypot(e.body.position.x - bx, e.body.position.z - bz) / dt;
        e.stuckTime = got < want * 0.3 ? e.stuckTime + dt : 0;
        if (e.stuckTime > 0.4) this.startDetour(e, ppos);
      }
      // A charging reindeer that hits a wall or a post is left dazed.
      if (moved.hitWall && e.state === "attack" && e.attackKind === "lunge" && e.tuning.charge) {
        e.daze();
        g.fx.puff(e.center, "snow", 24, 1.4);
        if (flatDistance(e.body.position, ppos) < 20) {
          sound.press();
          g.camRig.shake(0.25);
        }
      }
      // Fell into the water (or off the world).
      if (e.body.position.y < g.level.killY) {
        g.fx.puff(e.body.position.add(new Vector3(0, 0.6, 0)), "sky", 18, 1.2);
        this.hit(e, 999, e.body.position, "slam", 0);
        continue;
      }

      // Kamikaze bombardiers blow up when they reach Santa (or after a few seconds).
      if (e.kamikaze) {
        if (Math.random() < dt * 12) sound.beep();
        e.rig.flash(0.05, new Color3(1, 0.2, 0.1));
        if (flatDistance(e.body.position, ppos) < 1.5 || e.kamikazeTime > 3.2) {
          this.hit(e, 999, e.body.position, "finisher", 2);
          continue;
        }
      }
      // Burning: damage over time.
      if (e.burnTime > 0) {
        e.burnTime -= dt;
        e.burnTick -= dt;
        if (Math.random() < 0.4) g.fx.puff(e.center, "orange", 1, 0.7);
        if (e.burnTick <= 0) {
          e.burnTick = 0.4;
          if (e.hp <= 0.6) {
            this.hit(e, 1, e.body.position, "bullet", 1);
            continue;
          }
          e.hp -= 0.6;
        }
      }
      // Attacks landing on the player.
      if (e.attackReaches(ppos)) {
        e.hitLanded = true;
        const dmg = e.attackKind === "lunge" ? e.tuning.lungeDamage : e.tuning.swipeDamage;
        player.hurt(dmg * g.level.damageScale, e.body.position);
      }

      // Creepy one-liners now and then.
      e.barkCooldown -= dt;
      if (e.barkCooldown <= 0 && e.aggro && flatDistance(e.body.position, ppos) < 10) {
        e.barkCooldown = 6 + Math.random() * 8;
        if (Math.random() < 0.35) g.bark(pick(Math.random, LINES.barksElf));
        if (Math.random() < 0.5) sound.giggle();
      }
      e.syncVisual(dt);
    }
  }

  /** Closest elf hit by a ray, if any. */
  raycast(origin: Vector3, dir: Vector3, maxDist: number): { elf: Elf; dist: number } | null {
    let best: { elf: Elf; dist: number } | null = null;
    for (const e of this.elves) {
      if (!e.alive) continue;
      // A little aim assist: shots that graze an elf count (more so far away).
      const toE = e.center.subtract(origin).length();
      const t = raySphere(origin, dir, e.center, e.hitRadius + 0.12 + toE * 0.012);
      if (t !== null && t < maxDist && (!best || t < best.dist)) best = { elf: e, dist: t };
    }
    return best;
  }

  /** The closest living elf within `range` of `pos`, skipping `exclude`. */
  nearestTo(pos: Vector3, range: number, exclude: Set<Elf>): Elf | null {
    let best: Elf | null = null;
    let bestD = range;
    for (const e of this.elves) {
      if (!e.alive || exclude.has(e)) continue;
      const d = Vector3.Distance(e.center, pos);
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  /** Every living elf along the ray, nearest first (piercing shots). */
  raycastAll(origin: Vector3, dir: Vector3, maxDist: number): { elf: Elf; dist: number }[] {
    const out: { elf: Elf; dist: number }[] = [];
    for (const e of this.elves) {
      if (!e.alive) continue;
      const toE = e.center.subtract(origin).length();
      const t = raySphere(origin, dir, e.center, e.hitRadius + 0.12 + toE * 0.012);
      if (t !== null && t < maxDist) out.push({ elf: e, dist: t });
    }
    return out.sort((a, b) => a.dist - b.dist);
  }

  /** Living elves inside a cone in front of `origin` (melee). */
  inArc(origin: Vector3, yaw: number, range: number, halfAngle: number) {
    const out: Elf[] = [];
    for (const e of this.elves) {
      if (!e.alive) continue;
      const dx = e.body.position.x - origin.x;
      const dz = e.body.position.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > range + e.body.radius) continue;
      if (Math.abs(e.body.position.y - origin.y) > 1.6) continue;
      let a = Math.atan2(dx, dz) - yaw;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      if (d < 0.6 || Math.abs(a) <= halfAngle) out.push(e);
    }
    return out;
  }

  inRadius(center: Vector3, radius: number) {
    return this.elves.filter(
      (e) => e.alive && Vector3.Distance(e.body.position, center) <= radius + e.body.radius,
    );
  }

  /** Damage an elf; handles death, gore and scoring. */
  hit(e: Elf, amount: number, from: Vector3, kind: DamageKind, knockback = 4, stun = 0) {
    const killed = e.damage(amount, from, kind, knockback, stun);
    const g = this.game;
    const dir = e.body.position.subtract(from);
    dir.y = 0;
    if (dir.lengthSquared() > 0) dir.normalize();
    if (!killed) {
      g.gore.burst(e.center, dir, g.gore.settings.particles * 0.25);
      sound.hit(!g.gore.confetti);
      return false;
    }
    this.kills++;
    e.hasToken = false;
    const force =
      kind === "slam" || kind === "finisher"
        ? 1.5
        : kind === "bullet" || kind === "fire"
          ? 0.9
          : 1.2;
    if (kind === "fire") g.fx.puff(e.center, "coal", 14, 1.2);
    g.gore.explode(e.rig, dir, force, kind === "cane");
    if (g.gore.confetti) sound.confettiPop();
    else sound.splat();
    this.onKill?.(e, kind);
    if (kind !== "finisher" && e.tuning.kind !== "snowball") g.dropLoot(e.body.position);
    // Bombardiers always go off when they die, hurting whoever is close (elves too).
    if (e.tuning.kind === "bomber") g.projectiles.explode(e.center, 3, 22, 0.08);
    // The mutant snowman splits into three angry snowballs.
    if (e.tuning.kind === "snowman") {
      g.fx.puff(e.center, "snow", 50, 2);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const pos = e.body.position.add(new Vector3(Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2));
        const ball = this.spawn(pos, { tuning: SNOWBALL, yaw: a });
        ball.aggro = true;
        ball.setState("chase");
        ball.body.velocity.set(Math.cos(a) * 5, 7, Math.sin(a) * 5);
      }
    }
    return true;
  }
}
