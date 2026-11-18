import { Vector3 } from "@babylonjs/core";
import { Animator } from "../anim/Animator";
import { CLIPS } from "../anim/clips";
import type { Rig } from "../anim/Rig";
import { angleDelta, clamp, dampAngle, flatDistance, yawTo } from "../core/math";
import type { Body } from "../world/Physics";

export type ElfState = "idle" | "chase" | "windup" | "attack" | "recover" | "hurt" | "dead";
export type AttackKind = "lunge" | "swipe";

export type DamageKind = "bullet" | "punch" | "bash" | "cane" | "slam" | "finisher" | "fire";

export type EnemyKind =
  | "elf"
  | "sprinter"
  | "snowman"
  | "snowball"
  | "thrower"
  | "bomber"
  | "skater"
  | "nutcracker"
  | "reindeer"
  | "fouettard";

export interface ElfTuning {
  kind: EnemyKind;
  hp: number;
  speed: number;
  /** Damage of the lunge / swipe. */
  lungeDamage: number;
  swipeDamage: number;
  sight: number;
  /** Collision radius and height. */
  radius: number;
  height: number;
  /** Seconds of crouch before a lunge (the telegraph). */
  windup: number;
  /** Lunge speed. */
  lunge: number;
  /** How far away it starts a lunge. */
  reach: number;
  /** Ranged attackers keep their distance and lob projectiles. */
  ranged?: {
    min: number;
    max: number;
    cooldown: number;
    windup: number;
    flight: number;
    damage: number;
    projectile: "coal" | "bomb" | "puck";
  };
  /** Ground acceleration (lower = slidier). Default 30. */
  accel?: number;
  /** Chargers: the lunge is a long straight charge; running into a wall leaves them dazed. */
  charge?: { time: number; dazed: number };
  /** Visual size (the rig is scaled; radius/height above are the real collision size). */
  scale?: number;
  /** Bosses: shown with a health bar, and a finisher only takes a chunk off. */
  boss?: boolean;
  /** Share of damage taken unless dazed (bosses you have to stun to really hurt). */
  armor?: number;
  /** A boss phase: it can't be killed — at 0 HP the phase is over and the level moves on. */
  holdsOn?: boolean;
}

/**
 * Performance budget: elves alive at once. Each costs ~50 draw calls; on an M2 at 1470×956,
 * 20 alive is ~8.4 ms a frame and 30 is ~13.4 ms (measured). Hordes stay under it.
 */
export const MAX_ALIVE = 20;

const BASE = { radius: 0.32, height: 1.0, windup: 0.42, lunge: 9.5, reach: 3.4 };

export const ELF_BASIC: ElfTuning = {
  ...BASE,
  kind: "elf",
  hp: 3,
  speed: 3.3,
  lungeDamage: 8,
  swipeDamage: 5,
  sight: 16,
};
/** Fast, fragile, hunts in packs. */
export const ELF_SPRINTER: ElfTuning = {
  ...BASE,
  kind: "sprinter",
  hp: 1,
  speed: 6.2,
  lungeDamage: 5,
  swipeDamage: 4,
  sight: 22,
  windup: 0.36,
  lunge: 11,
};
/** Casse-noisette (toy factory): a tall wooden soldier. Tough, slow, hits hard. */
export const NUTCRACKER: ElfTuning = {
  kind: "nutcracker",
  hp: 8,
  speed: 2.6,
  lungeDamage: 13,
  swipeDamage: 10,
  sight: 20,
  radius: 0.45,
  height: 1.9,
  windup: 0.55,
  lunge: 8,
  reach: 3.4,
};
/**
 * Renne possédé: lowers its head (the telegraph), then charges in a straight line.
 * Dodge it (Q); if it slams into a wall or a post it's dazed — finish it.
 */
export const REINDEER: ElfTuning = {
  kind: "reindeer",
  hp: 10,
  speed: 4.2,
  lungeDamage: 22,
  swipeDamage: 12,
  sight: 28,
  radius: 0.7,
  height: 1.8,
  windup: 0.85,
  lunge: 15,
  reach: 12,
  accel: 18,
  charge: { time: 0.75, dazed: 2.2 },
};
/** Comète Démoniaque: the stables' possessed lead reindeer (mini-boss). */
export const COMETE: ElfTuning = {
  ...REINDEER,
  // Tough while it moves (30% damage), fully exposed while dazed: bait it into the posts.
  hp: 260,
  armor: 0.3,
  speed: 5,
  lungeDamage: 30,
  swipeDamage: 18,
  sight: 60,
  radius: 1.05,
  height: 2.7,
  windup: 1.0,
  lunge: 19,
  reach: 18,
  charge: { time: 0.95, dazed: 2.8 },
  scale: 1.5,
  boss: true,
};
// Père Fouettard, the final boss: one character, four phases (the level retunes him).
const FOUETTARD_BASE = {
  kind: "fouettard" as const,
  speed: 4,
  lungeDamage: 18,
  swipeDamage: 14,
  sight: 70,
  radius: 0.6,
  height: 2.6,
  windup: 0.6,
  lunge: 10,
  reach: 4,
  scale: 1.3,
  boss: true,
};
/** Phase 1 — the whip: keeps his distance and hurls burning coal. */
export const FOUETTARD: ElfTuning = {
  ...FOUETTARD_BASE,
  hp: 220,
  holdsOn: true,
  ranged: {
    min: 6,
    max: 22,
    cooldown: 1.1,
    windup: 0.5,
    flight: 0.9,
    damage: 14,
    projectile: "coal",
  },
};
/** Phase 2 — the charge: like Comète, armoured unless dazed against a pillar. */
export const FOUETTARD_RAGE: ElfTuning = {
  ...FOUETTARD_BASE,
  hp: 240,
  holdsOn: true,
  armor: 0.45,
  speed: 5.5,
  windup: 0.8,
  lunge: 20,
  reach: 18,
  lungeDamage: 28,
  accel: 18,
  charge: { time: 0.9, dazed: 2.6 },
  scale: 1.38,
};
/** Phase 3 — the sky: perched in the tree, raining bombs; can't be hurt up there. */
export const FOUETTARD_SKY: ElfTuning = {
  ...FOUETTARD_BASE,
  hp: 1,
  holdsOn: true,
  armor: 0,
  ranged: {
    min: 0,
    max: 40,
    cooldown: 1.3,
    windup: 0.6,
    flight: 1.1,
    damage: 16,
    projectile: "bomb",
  },
};
/** The last stand: on foot, faster, everything he has (the level plays his defeat at 0 HP). */
export const FOUETTARD_LAST: ElfTuning = {
  ...FOUETTARD_BASE,
  hp: 260,
  holdsOn: true,
  speed: 5,
  ranged: {
    min: 4,
    max: 20,
    cooldown: 0.8,
    windup: 0.4,
    flight: 0.8,
    damage: 14,
    projectile: "coal",
  },
};
/** Slow tank; splits into three snowballs. */
export const SNOWMAN: ElfTuning = {
  kind: "snowman",
  hp: 12,
  speed: 1.9,
  lungeDamage: 14,
  swipeDamage: 12,
  sight: 18,
  radius: 0.75,
  height: 2.4,
  windup: 0.6,
  lunge: 7,
  reach: 3.6,
};
/** Lutin lanceur: keeps its distance and lobs burning coal. */
export const ELF_THROWER: ElfTuning = {
  ...BASE,
  kind: "thrower",
  hp: 2,
  speed: 2.6,
  lungeDamage: 6,
  swipeDamage: 5,
  sight: 32,
  ranged: {
    min: 7,
    max: 26,
    cooldown: 2.6,
    windup: 0.75,
    flight: 1.15,
    damage: 12,
    projectile: "coal",
  },
};

/** Lutin patineur: glides fast on the ice and slapshots pucks along the ground. */
export const ELF_SKATER: ElfTuning = {
  ...BASE,
  kind: "skater",
  hp: 2,
  speed: 7,
  lungeDamage: 7,
  swipeDamage: 5,
  sight: 28,
  lunge: 13,
  accel: 7,
  ranged: {
    min: 6,
    max: 20,
    cooldown: 2.6,
    windup: 0.55,
    flight: 0,
    damage: 12,
    projectile: "puck",
  },
};

/** Lutin bombardier: lobs ornament bombs, then charges and explodes when hurt. */
export const ELF_BOMBER: ElfTuning = {
  ...BASE,
  kind: "bomber",
  hp: 2,
  speed: 3,
  lungeDamage: 6,
  swipeDamage: 5,
  sight: 26,
  ranged: {
    min: 6,
    max: 18,
    cooldown: 3.4,
    windup: 0.6,
    flight: 1.0,
    damage: 20,
    projectile: "bomb",
  },
};

export const SNOWBALL: ElfTuning = {
  ...BASE,
  kind: "snowball",
  hp: 1,
  speed: 4.6,
  lungeDamage: 4,
  swipeDamage: 3,
  sight: 20,
  radius: 0.35,
  height: 0.7,
  windup: 0.3,
  lunge: 9,
};

/**
 * Lutin possédé. State machine: idle → chase → wind-up → attack → recover.
 * Every attack telegraphs (crouch + eye flash) so hits feel fair.
 */
export class Elf {
  readonly anim: Animator;
  readonly body: Body;
  state: ElfState = "idle";
  stateTime = 0;
  hp: number;
  yaw = 0;
  stun = 0;
  cooldown = 0.5;
  hasToken = false;
  attackKind: AttackKind = "lunge";
  hitLanded = false;
  /** Set when the player is first spotted. */
  aggro = false;
  /** Frozen in place (cutscenes, before the twist ends). */
  dormant = false;
  /** Stays on its spot (ledges): turns and throws but never walks. */
  perched = false;
  /** Line of sight is re-checked a few times per second, not every frame. */
  losTimer = Math.random() * 0.2;
  canSee = false;
  /** Seconds spent far away and out of sight (stuck elves get cleaned up). */
  lostTime = 0;
  /** Set for one frame when a ranged attack is released. */
  throwNow = false;
  /** Bombardier charging to blow itself up. */
  kamikaze = false;
  kamikazeTime = 0;
  /** Seconds left on fire (flamethrower, burning syrup). */
  burnTime = 0;
  burnTick = 0;
  readonly knock = new Vector3();
  barkCooldown = 3 + Math.random() * 5;

  constructor(
    readonly rig: Rig,
    position: Vector3,
    public tuning: ElfTuning = ELF_BASIC,
  ) {
    this.hp = tuning.hp;
    this.anim = new Animator(rig);
    this.anim.loco.runSpeed = 5;
    this.anim.loco.twitch = 1;
    this.body = {
      position: position.clone(),
      velocity: new Vector3(),
      radius: tuning.radius,
      height: tuning.height,
      grounded: true,
      ground: null,
    };
    rig.root.position.copyFrom(position);
  }

  get alive() {
    return this.state !== "dead";
  }

  /** A boss phase reached 0 HP (see `holdsOn`). */
  phaseOver = false;
  /** Can't be hurt (a boss during its phase cutscene). */
  shielded = false;

  /** Switch to a new set of behaviour (a boss's next phase): full health, a clean slate. */
  retune(t: ElfTuning) {
    this.tuning = t;
    this.hp = t.hp;
    this.phaseOver = false;
    this.stun = 0;
    this.cooldown = 1;
    this.knock.setAll(0);
    this.hasToken = false;
    this.rig.root.scaling.setAll(t.scale ?? 1);
    this.setState("chase");
  }

  /** Direction locked in at the start of a charge. */
  readonly chargeDir = new Vector3();

  /** A charge that hit a wall: stop dead, dazed. */
  daze() {
    const c = this.tuning.charge;
    if (!c) return;
    this.knock.setAll(0);
    this.stun = Math.max(this.stun, c.dazed);
    this.hasToken = false;
    this.cooldown = 1;
    this.setState("recover");
    this.anim.stop();
  }

  get center() {
    return this.body.position.add(new Vector3(0, this.tuning.height * 0.62, 0));
  }

  get hitRadius() {
    return Math.max(0.5, this.tuning.radius * 1.3);
  }

  get stunned() {
    return this.stun > 0 && this.alive;
  }

  setState(s: ElfState) {
    this.state = s;
    this.stateTime = 0;
  }

  /** Decide what to do this frame. Movement itself is applied by the manager. */
  think(dt: number, playerPos: Vector3, canSee: boolean, wantToken: () => boolean): Vector3 {
    this.stateTime += dt;
    this.cooldown -= dt;
    this.stun = Math.max(0, this.stun - dt);
    const dist = flatDistance(this.body.position, playerPos);
    const toPlayer = yawTo(this.body.position, playerPos);
    const wish = new Vector3();

    if (this.dormant) {
      this.anim.loco.speed = 0;
      return wish;
    }

    if (this.kamikaze && this.alive) {
      this.kamikazeTime += dt;
      this.yaw = dampAngle(this.yaw, toPlayer, 12, dt);
      wish.set(
        Math.sin(toPlayer) * this.tuning.speed * 2.3,
        0,
        Math.cos(toPlayer) * this.tuning.speed * 2.3,
      );
      this.anim.loco.speed = this.tuning.speed * 2.3;
      return wish;
    }

    if (this.stun > 0 && this.state !== "dead") {
      this.anim.loco.speed = 0;
      return wish;
    }

    switch (this.state) {
      case "idle":
        if (canSee && dist < this.tuning.sight) {
          this.aggro = true;
          this.setState("chase");
        }
        break;
      case "chase": {
        this.yaw = dampAngle(this.yaw, toPlayer, 10, dt);
        const r = this.tuning.ranged;
        if (r && dist > 1.8) {
          // Ranged: hold the distance band, throw when ready.
          if (this.cooldown <= 0 && dist <= r.max && canSee) {
            this.attackKind = "lunge";
            this.setState("windup");
            this.anim.play(CLIPS.elfSwipe);
            break;
          }
          if (this.perched) break;
          const dir = new Vector3(Math.sin(toPlayer), 0, Math.cos(toPlayer));
          if (dist > r.max * 0.8) wish.copyFrom(dir.scale(this.tuning.speed));
          else if (dist < r.min) wish.copyFrom(dir.scale(-this.tuning.speed));
          else wish.copyFrom(new Vector3(dir.z, 0, -dir.x).scale(this.tuning.speed * 0.4));
          break;
        }
        const close = dist < 1.0 + this.tuning.radius;
        if (this.cooldown <= 0 && dist < this.tuning.reach && wantToken()) {
          this.hasToken = true;
          this.attackKind = close ? "swipe" : "lunge";
          this.setState("windup");
          this.anim.play(this.attackKind === "lunge" ? CLIPS.elfWindup : CLIPS.elfSwipe);
          break;
        }
        // Keep a little distance when no attack slot is free: circle instead.
        const orbit = !this.hasToken && dist < 3.2;
        const dir = new Vector3(Math.sin(toPlayer), 0, Math.cos(toPlayer));
        if (orbit) {
          const side = new Vector3(dir.z, 0, -dir.x);
          wish.copyFrom(side.scale(this.tuning.speed * 0.5)).addInPlace(dir.scale(-0.6));
        } else if (dist > 0.9) {
          wish.copyFrom(dir.scale(this.tuning.speed));
        }
        break;
      }
      case "windup": {
        this.yaw = dampAngle(this.yaw, toPlayer, 6, dt);
        const rw = this.tuning.ranged;
        if (rw && dist > 1.8) {
          if (this.stateTime >= rw.windup) {
            this.throwNow = true;
            this.cooldown = rw.cooldown + Math.random() * 0.8;
            this.setState("recover");
          }
          break;
        }
        const windTime =
          this.attackKind === "lunge" ? this.tuning.windup : this.tuning.windup * 0.75;
        if (this.stateTime >= windTime) {
          this.hitLanded = false;
          this.setState("attack");
          if (this.attackKind === "lunge") {
            this.anim.play(CLIPS.elfLunge);
            const d = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
            this.knock.copyFrom(d.scale(this.tuning.lunge));
            // A charge stays on the ground and holds its line; a lunge is a hop.
            if (this.tuning.charge) this.chargeDir.copyFrom(d);
            else this.body.velocity.y = 3.5;
          }
        }
        break;
      }
      case "attack": {
        const charge = this.attackKind === "lunge" ? this.tuning.charge : undefined;
        if (charge) this.knock.copyFrom(this.chargeDir.scale(this.tuning.lunge));
        const dur = this.attackKind === "lunge" ? (charge?.time ?? 0.32) : 0.16;
        if (this.stateTime >= dur) {
          this.setState("recover");
          this.cooldown = 1.4 + Math.random() * 0.4;
        }
        break;
      }
      case "recover":
        if (this.stateTime >= 0.6) {
          this.hasToken = false;
          this.setState("chase");
        }
        break;
      case "hurt":
        if (this.stateTime >= 0.18) this.setState(this.aggro ? "chase" : "idle");
        break;
      case "dead":
        break;
    }
    this.anim.loco.speed = Math.hypot(wish.x, wish.z);
    return wish;
  }

  /** Is the attack hitbox touching the player right now? */
  attackReaches(playerPos: Vector3) {
    if (this.state !== "attack" || this.hitLanded) return false;
    const d = flatDistance(this.body.position, playerPos);
    const facing = Math.abs(angleDelta(this.yaw, yawTo(this.body.position, playerPos)));
    const r = this.tuning.radius;
    return this.attackKind === "lunge" ? d < 0.8 + r : d < 1.2 + r && facing < 1.1;
  }

  /** Apply damage. Returns true if this killed it. */
  damage(amount: number, from: Vector3, kind: DamageKind, knockback = 4, stun = 0) {
    if (!this.alive) return false;
    if (this.phaseOver || this.shielded) return false;
    this.hp -=
      this.tuning.armor !== undefined && this.stun <= 0 ? amount * this.tuning.armor : amount;
    if (this.tuning.holdsOn && this.hp <= 0) {
      this.hp = 0;
      this.phaseOver = true;
      return false;
    }
    this.rig.flash(0.09);
    this.aggro = true;
    if (this.tuning.boss) {
      // Poise: a boss isn't interrupted, staggered, shoved or woken by hits (or a fast gun
      // would stun-lock it; the level decides when it holds still). Only a daze opens it up.
      if (this.hp <= 0 && !this.tuning.holdsOn) {
        this.setState("dead");
        return true;
      }
      return false;
    }
    this.dormant = false;
    const away = this.body.position.subtract(from);
    away.y = 0;
    if (away.lengthSquared() > 0.0001) away.normalize();
    this.knock.copyFrom(away.scale(knockback));
    this.body.velocity.y = Math.max(this.body.velocity.y, knockback * 0.35);
    if (stun > 0) this.stun = Math.max(this.stun, stun);
    if (this.hp <= 0) {
      this.setState("dead");
      return true;
    }
    if (this.tuning.kind === "bomber" && !this.kamikaze) {
      // Hurt bombardiers light their own fuse and charge.
      this.kamikaze = true;
      this.state = "chase";
      return false;
    }
    // Melee hits interrupt wind-ups.
    if (kind !== "bullet" && this.state === "windup") {
      this.hasToken = false;
      this.cooldown = 0.8;
      this.anim.stop();
    }
    if (this.state !== "attack") {
      this.setState("hurt");
      this.anim.play(CLIPS.hurt);
    }
    return false;
  }

  syncVisual(dt: number) {
    const r = this.rig.root;
    r.position.copyFrom(this.body.position);
    r.rotation.y = this.yaw;
    this.anim.loco.grounded = this.body.grounded;
    this.anim.loco.vy = this.body.velocity.y;
    // Eyes flare during wind-up (telegraph).
    const head = this.rig.parts.get("head");
    if (head) {
      const windup = this.state === "windup";
      for (const eyes of head.getChildMeshes()) {
        eyes.renderOverlay = windup;
        if (windup) {
          eyes.overlayColor.set(1, 1, 0.85);
          eyes.overlayAlpha = clamp(0.5 + Math.sin(this.stateTime * 50) * 0.5, 0, 1);
        }
      }
    }
    this.anim.update(dt);
    this.rig.update(dt);
  }
}
