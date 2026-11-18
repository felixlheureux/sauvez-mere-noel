import { Color3, type Mesh, MeshBuilder, type TransformNode, Vector3 } from "@babylonjs/core";
import { Animator } from "../anim/Animator";
import { CLIPS } from "../anim/clips";
import type { JointName, Rig } from "../anim/Rig";
import { createSanta } from "../assets/characters";
import { color } from "../assets/Palette";
import { sound } from "../audio/Sound";
import type { Game } from "../core/Game";
import { approach, clamp, dampAngle, pick } from "../core/math";
import type { Elf } from "../enemies/Elf";
import { LINES } from "../i18n/fr-QC";
import { hud } from "../ui/store";
import type { Body } from "../world/Physics";

/** Movement tuning — see the design doc's Movement table. */
export const MOVE = {
  walk: 4,
  run: 7,
  accelTime: 0.12,
  stopTime: 0.08,
  airControl: 0.7,
  /** On ice (m/s²): pushing builds speed and turns slowly; letting go glides ~8 m from a run. */
  iceAccel: 6,
  iceFriction: 3,
  gravity: 26,
  fallMultiplier: 1.6,
  jumpCutMultiplier: 2.4,
  jumpVelocity: 9.1,
  doubleJumpVelocity: 9.6,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  dashSpeed: 33,
  dashTime: 0.18,
  dashCooldown: 1.5,
  maxFall: 30,
} as const;

/** A downhill track for the snow tube (it runs toward -z). */
export interface RideTrack {
  centerX(z: number): number;
  /** dx/dz of the centerline. */
  slopeX(z: number): number;
  halfWidth: number;
  /** z of each ramp lip: crossing one at speed launches you. */
  lips: number[];
  endZ: number;
  onEnd: () => void;
}

export type WeaponId =
  | "fists"
  | "capgun"
  | "shotgun"
  | "smg"
  | "flamer"
  | "launcher"
  | "icicle"
  | "garland"
  | "crossbow"
  | "gatling"
  | "star";
export type GunId = Exclude<WeaponId, "fists">;

interface GunDef {
  cooldown: number;
  rageCooldown: number;
  pellets: number;
  spread: number;
  damage: number;
  knockback: number;
  shake: number;
  muzzleZ: number;
  range: number;
  /** Short-range cone instead of hitscan (flamethrower). */
  flame?: boolean;
  /** Lobs an exploding ornament instead of hitscan (Lance-Boules). */
  lob?: boolean;
  /** How many elves one shot goes through (Fusil à Glaçons). */
  pierce?: number;
  /** The shot jumps from elf to elf (Guirlande Électrique): extra targets, jump range, damage kept per jump. */
  chain?: { jumps: number; range: number; falloff: number };
  /** The bolt sticks where it hits and explodes after `delay` (Arbalète à Cannes). */
  sticky?: { delay: number; radius: number; damage: number };
  /** Seconds of holding fire before it shoots (the barrels spin up) (Gatling à Jujubes). */
  spinUp?: number;
  /** Move-speed factor while the barrels spin. */
  fireSlow?: number;
}

/** Every gun, in unlock order (one new gun per level). */
export const GUNS: Record<GunId, GunDef> = {
  // Damage per second against a basic elf (3 HP), each gun better than the last:
  // cap gun 6 (2 shots), shotgun 10 (1 blast up close), SMG 10 (long range),
  // flamethrower 6.5 + burning (crowds), Lance-Boules 13 (area).
  capgun: {
    cooldown: 0.25,
    rageCooldown: 0.16,
    pellets: 1,
    spread: 0.015,
    damage: 1.5,
    knockback: 2.5,
    shake: 0.04,
    muzzleZ: 0.45,
    range: 60,
  },
  shotgun: {
    cooldown: 0.8,
    rageCooldown: 0.5,
    pellets: 8,
    spread: 0.13,
    damage: 1,
    knockback: 1.4,
    shake: 0.2,
    muzzleZ: 0.95,
    range: 26,
  },
  smg: {
    cooldown: 0.075,
    rageCooldown: 0.055,
    pellets: 1,
    spread: 0.04,
    damage: 0.75,
    knockback: 1.2,
    shake: 0.025,
    muzzleZ: 0.68,
    range: 45,
  },
  flamer: {
    cooldown: 0.07,
    rageCooldown: 0.05,
    pellets: 1,
    spread: 0.38,
    damage: 0.45,
    knockback: 0.4,
    shake: 0.03,
    muzzleZ: 0.72,
    range: 8,
    flame: true,
  },
  launcher: {
    cooldown: 0.75,
    rageCooldown: 0.45,
    pellets: 1,
    spread: 0,
    damage: 10,
    knockback: 10,
    shake: 0.18,
    muzzleZ: 0.9,
    range: 60,
    lob: true,
  },
  // Slow and precise: one icicle kills a basic elf and goes through up to three in a row.
  icicle: {
    cooldown: 0.6,
    rageCooldown: 0.4,
    pellets: 1,
    spread: 0.004,
    damage: 6,
    knockback: 7,
    shake: 0.1,
    muzzleZ: 1.05,
    range: 90,
    pierce: 3,
  },
  // Crowd control: the bolt hits one elf, then jumps to up to four more nearby (stunning them).
  garland: {
    cooldown: 0.4,
    rageCooldown: 0.26,
    pellets: 1,
    spread: 0.01,
    damage: 3,
    knockback: 2,
    shake: 0.06,
    muzzleZ: 0.75,
    range: 40,
    chain: { jumps: 4, range: 6, falloff: 0.8 },
  },
  // Tag and dodge: the candy-cane bolt sticks in (2 damage), then blows up a moment later.
  crossbow: {
    cooldown: 0.7,
    rageCooldown: 0.45,
    pellets: 1,
    spread: 0.006,
    damage: 2,
    knockback: 2,
    shake: 0.12,
    muzzleZ: 0.8,
    range: 70,
    sticky: { delay: 0.9, radius: 3.4, damage: 14 },
  },
  // Raw power: spin up for half a second, then the fastest fire of all — at half speed.
  gatling: {
    cooldown: 0.045,
    rageCooldown: 0.03,
    pellets: 1,
    spread: 0.05,
    damage: 0.8,
    knockback: 0.9,
    shake: 0.02,
    muzzleZ: 0.85,
    range: 50,
    spinUp: 0.5,
    fireSlow: 0.5,
  },
  // The star from the giant tree: a continuous golden beam through everything in a line.
  star: {
    cooldown: 0.05,
    rageCooldown: 0.035,
    pellets: 1,
    spread: 0,
    damage: 0.9,
    knockback: 0.6,
    shake: 0.01,
    muzzleZ: 0.6,
    range: 35,
    pierce: 12,
  },
};
export const GUN_ORDER: GunId[] = [
  "capgun",
  "shotgun",
  "smg",
  "flamer",
  "launcher",
  "icicle",
  "garland",
  "crossbow",
  "gatling",
  "star",
];
export type BuffId = "rage" | "speed" | "shield";

/** Seconds each buff lasts (shield = number of hits it blocks, for up to 20 s). */
export const BUFFS = { rage: 10, speed: 9, shield: 20 } as const;

interface Hitbox {
  at: number;
  done: boolean;
  run: () => void;
}

export class Player {
  readonly rig: Rig;
  readonly anim: Animator;
  readonly body: Body;
  yaw = 0;
  hp = 100;
  readonly maxHp = 100;
  dead = false;
  weapon: WeaponId = "fists";
  /** Guns collected so far, in unlock order. */
  owned: GunId[] = [];
  hasCane = false;
  /** Disable all player input (cutscenes). */
  frozen = false;
  /** Moved by a script (the chimney dive): no gravity, no collisions pushing him out. */
  kinematic = false;
  private invuln = 0;
  /** Hit-stun: for a moment after a hit, steering doesn't cancel the knockback. */
  private knockTime = 0;
  /** How far the barrels have spun up (spin-up guns). */
  private spin = 0;
  private whirTime = 0;
  private coyote = 0;
  private jumpsUsed = 0;
  private dashTime = 0;
  private dashCd = 0;
  private airDashUsed = false;
  private readonly dashDir = new Vector3();
  private slamming = false;
  private meleeTime = 0;
  private comboIndex = 0;
  private comboWindow = 0;
  private fireCd = 0;
  private aimHold = 0;
  private recoil = 0;
  private hitbox: Hitbox | null = null;
  private readonly guns: Record<GunId, Mesh>;
  private readonly cane: Mesh;
  private readonly muzzle: Mesh;
  private muzzleTime = 0;
  private caneTime = 0;
  private lowHpBarked = false;
  /** Seconds left on each buff. */
  readonly buffs = { rage: 0, speed: 0, shield: 0 };
  shieldHits = 0;
  private buffSync = 0;
  private burnTime = 0;
  /** Snow-tube ride in progress. */
  ride: { track: RideTrack; tube: Mesh; speed: number; lateral: number; prevZ: number } | null =
    null;
  private burnTick = 0;
  /** Launched by a bounce gift: no short-hop gravity until we start falling. */
  private launched = false;

  constructor(private readonly game: Game) {
    this.rig = createSanta(game.scene, game.mats);
    this.anim = new Animator(this.rig);
    this.anim.loco.runSpeed = MOVE.run;
    this.body = {
      position: new Vector3(),
      velocity: new Vector3(),
      radius: 0.38,
      height: 1.7,
      grounded: true,
      ground: null,
    };
    game.env.castShadows(...(this.rig.allMeshes() as Mesh[]));

    this.guns = {
      capgun: game.props.capGun(),
      shotgun: game.props.shotgun(),
      smg: game.props.candySmg(),
      flamer: game.props.syrupFlamer(),
      launcher: game.props.ornamentLauncher(),
      icicle: game.props.icicleRifle(),
      garland: game.props.garlandGun(),
      crossbow: game.props.crossbow(),
      gatling: game.props.gatling(),
      star: game.props.starGun(),
    };
    for (const gun of Object.values(this.guns)) {
      gun.parent = this.rig.joints.hand;
      gun.rotation.x = Math.PI / 2;
      gun.position.set(0, -0.05, 0.02);
      gun.setEnabled(false);
    }

    this.cane = game.props.bladeCane();
    this.cane.parent = this.rig.joints.hand;
    // Gripped in the fist like a sword: the shaft leaves the hand forward (hand +z), not down the arm.
    this.cane.rotation.x = -Math.PI / 2;
    this.cane.setEnabled(false);

    this.muzzle = MeshBuilder.CreateSphere("muzzle", { diameter: 0.35, segments: 2 }, game.scene);
    this.muzzle.material = game.mats.glow(color("warmLight"), 2);
    this.muzzle.parent = this.guns.capgun;
    this.muzzle.position.set(0, 0.03, GUNS.capgun.muzzleZ);
    this.muzzle.isVisible = false;
  }

  get position() {
    return this.body.position;
  }

  reset(pos: Vector3, yaw: number) {
    this.body.position.copyFrom(pos);
    this.body.velocity.setAll(0);
    this.yaw = yaw;
    this.hp = this.maxHp;
    this.dead = false;
    this.invuln = 0;
    this.slamming = false;
    this.hitbox = null;
    this.anim.stop();
    this.rig.root.position.copyFrom(pos);
    this.rig.root.rotation.y = yaw;
    this.rig.setEnabled(true);
    this.lowHpBarked = false;
    this.buffs.rage = this.buffs.speed = this.buffs.shield = 0;
    this.burnTime = 0;
    this.ride = null;
    this.kinematic = false;
    this.shieldHits = 0;
    hud.set({
      hp: this.hp,
      maxHp: this.maxHp,
      buffs: { rage: 0, speed: 0, shield: 0 },
      riding: false,
    });
  }

  equip(w: WeaponId) {
    this.weapon = w;
    for (const [id, gun] of Object.entries(this.guns)) gun.setEnabled(id === w);
    if (w !== "fists") {
      this.muzzle.parent = this.guns[w];
      this.muzzle.position.set(0, 0.03, GUNS[w].muzzleZ);
    }
    // Bare hands become the candy cane once Gérard has given it to you.
    this.cane.setEnabled(w === "fists" && this.hasCane);
    hud.set({
      weapon: w === "fists" && this.hasCane ? "cane" : w,
      crosshair: w !== "fists",
      weapons: [...this.owned],
    });
  }

  /** Add a gun to the arsenal (and switch to it). */
  giveGun(id: GunId, switchTo = true) {
    if (!this.owned.includes(id)) {
      this.owned.push(id);
      this.owned.sort((a, b) => GUN_ORDER.indexOf(a) - GUN_ORDER.indexOf(b));
    }
    if (switchTo) this.equip(id);
    else hud.set({ weapons: [...this.owned] });
  }

  /** Arsenal for a level: every gun from the levels before it. */
  setArsenal(guns: GunId[]) {
    this.owned = [...guns];
    const best = this.owned.at(-1);
    this.equip(best ?? "fists");
  }

  private switchWeapon() {
    const input = this.game.input;
    if (this.owned.length < 2 || this.weapon === "fists") return;
    let i = this.owned.indexOf(this.weapon as GunId);
    if (input.weaponSlot > 0 && input.weaponSlot <= this.owned.length) i = input.weaponSlot - 1;
    else if (input.consume("nextWeapon", 0.1)) i = (i + 1) % this.owned.length;
    else if (input.consume("prevWeapon", 0.1)) i = (i - 1 + this.owned.length) % this.owned.length;
    const next = this.owned[i];
    if (next && next !== this.weapon) {
      this.equip(next);
      sound.ui();
    }
  }

  update(dt: number) {
    const g = this.game;
    const input = g.input;
    const b = this.body;
    const v = b.velocity;
    const canAct = !this.frozen && !this.dead;

    this.invuln = Math.max(0, this.invuln - dt);
    this.knockTime = Math.max(0, this.knockTime - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    this.aimHold = Math.max(0, this.aimHold - dt);
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.tickBuffs(dt);
    if (this.burnTime > 0 && !this.dead) {
      this.burnTime -= dt;
      this.burnTick -= dt;
      if (Math.random() < 0.5)
        this.game.fx.puff(this.body.position.add(new Vector3(0, 1, 0)), "orange", 1, 0.6);
      if (this.burnTick <= 0) {
        this.burnTick = 0.5;
        this.hp = Math.max(0, this.hp - 1.5);
        sound.burn();
        hud.set({ hp: this.hp });
        if (this.hp <= 0) {
          this.dead = true;
          this.burstApart(null);
          this.game.onPlayerDeath();
        }
      }
    }

    // ---- Horizontal movement (camera-relative) ----
    const axis = canAct ? input.moveAxis() : { x: 0, y: 0 };
    const camYaw = g.camRig.yaw;
    const fwd = new Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const right = new Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const wishDir = fwd.scale(axis.y).addInPlace(right.scale(axis.x));
    const moving = wishDir.lengthSquared() > 0.01;
    const running = moving && canAct && input.running;
    const sticky = b.grounded ? g.level.speedFactor(b.position) : 1;
    const slowed = this.spin > 0 && this.weapon !== "fists" ? (GUNS[this.weapon].fireSlow ?? 1) : 1;
    const speed =
      (running ? MOVE.run : MOVE.walk) * (this.buffs.speed > 0 ? 1.35 : 1) * sticky * slowed;
    const onIce = b.ground?.tag === "ice" || (b.grounded && g.level.isIcy(b.position));

    if (this.seat) {
      // Riding a chairlift: you're carried; look around and shoot.
      b.position.copyFrom(this.seat());
      v.setAll(0);
      b.grounded = true;
    } else if (this.ride) {
      this.rideMove(dt, axis);
    } else {
      if (this.dashTime > 0) {
        this.dashTime -= dt;
        v.x = this.dashDir.x * MOVE.dashSpeed;
        v.z = this.dashDir.z * MOVE.dashSpeed;
        v.y = 0;
        if (this.dashTime <= 0) {
          v.x *= 0.25;
          v.z *= 0.25;
        }
      } else if (!this.slamming) {
        const target = wishDir.scale(speed);
        if (this.meleeTime > 0 && b.grounded) target.scaleInPlace(0.35);
        if (this.knockTime > 0) {
          // Knocked back: keep the push (a little drag), no steering.
          v.x *= Math.exp(-2 * dt);
          v.z *= Math.exp(-2 * dt);
        } else if (onIce) {
          // Little grip: velocity drifts toward where you push (turns curve), and keeps going.
          const grip = (moving ? MOVE.iceAccel : MOVE.iceFriction) * dt;
          const dx = target.x - v.x;
          const dz = target.z - v.z;
          const d = Math.hypot(dx, dz);
          const k = d > grip ? grip / d : 1;
          v.x += dx * k;
          v.z += dz * k;
        } else {
          let accel = ((MOVE.run * 1.35) / (moving ? MOVE.accelTime : MOVE.stopTime)) * dt;
          if (!b.grounded) accel *= MOVE.airControl;
          v.x = approach(v.x, target.x, accel);
          v.z = approach(v.z, target.z, accel);
        }
      } else {
        v.x = approach(v.x, 0, 20 * dt);
        v.z = approach(v.z, 0, 20 * dt);
      }

      // ---- Jump (coyote time + input buffer + variable height) ----
      if (b.grounded) {
        this.coyote = MOVE.coyoteTime;
        this.jumpsUsed = 0;
        this.airDashUsed = false;
      } else {
        this.coyote -= dt;
      }
      if (canAct && input.peek("jump", MOVE.jumpBuffer) && this.dashTime <= 0 && !this.slamming) {
        if (this.coyote > 0) {
          input.clear("jump");
          v.y = MOVE.jumpVelocity * (this.buffs.speed > 0 ? 1.1 : 1);
          this.coyote = 0;
          this.jumpsUsed = 1;
          b.grounded = false;
          this.anim.bounce(0.35);
          sound.jump();
        } else if (this.jumpsUsed < 2 && !b.grounded) {
          input.clear("jump");
          // Always a real boost: never slower than what you already had going up,
          // and not cut short when you let go of Space.
          v.y = Math.max(v.y + 2, MOVE.doubleJumpVelocity * (this.buffs.speed > 0 ? 1.1 : 1));
          this.launched = true;
          this.jumpsUsed = 2;
          this.anim.bounce(0.3);
          g.fx.puff(b.position, "white", 14);
          g.fx.ring(b.position, 1.2);
          sound.doubleJump();
        }
      }

      // ---- Dash ----
      if (
        canAct &&
        input.consume("dash", 0.1) &&
        this.dashCd <= 0 &&
        (b.grounded || !this.airDashUsed)
      ) {
        this.dashDir.copyFrom(
          moving ? wishDir.normalize() : new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)),
        );
        this.dashTime = MOVE.dashTime;
        this.dashCd = MOVE.dashCooldown;
        this.invuln = Math.max(this.invuln, MOVE.dashTime + 0.05);
        if (!b.grounded) this.airDashUsed = true;
        g.camRig.kickFov(0.12);
        g.fx.puff(b.position, "white", 12);
        sound.dash();
      }
    }

    // ---- Gravity ----
    if (this.dashTime <= 0 && !this.seat) {
      let grav = MOVE.gravity;
      if (v.y < 0) {
        grav *= MOVE.fallMultiplier;
        this.launched = false;
      } else if (!input.isHeld("jump") && !this.launched) grav *= MOVE.jumpCutMultiplier;
      v.y = Math.max(v.y - grav * dt, -MOVE.maxFall);
    }

    // ---- Combat ----
    if (canAct) this.combat(dt);
    this.updateHitbox();

    // ---- Physics ----
    if (this.kinematic) v.setAll(0);
    const res =
      this.seat || this.kinematic
        ? { landed: false, impactSpeed: 0, hitWall: false, bounced: 0 }
        : g.physics.move(b, dt);
    if (res.bounced) {
      this.launched = true;
      this.jumpsUsed = 1;
      this.anim.bounce(0.5);
      sound.bounce();
    }
    if (res.landed) {
      const impact = -res.impactSpeed;
      if (this.slamming) this.landSlam();
      else if (impact > 14) {
        g.camRig.shake(0.2);
        sound.land(true);
        this.anim.bounce(-0.45);
        g.fx.puff(b.position, "white", 14);
      } else if (impact > 4) {
        sound.land(false);
        this.anim.bounce(-0.25);
      }
    }
    if (b.position.y < -20) this.hurt(999, b.position);

    // ---- Facing ----
    const aiming = this.weapon !== "fists" && this.aimHold > 0;
    if (this.ride) {
      // Facing is set by the ride.
    } else if (this.seat && !aiming) {
      this.yaw = dampAngle(this.yaw, this.seatYaw, 8, dt);
    } else if (aiming || (this.meleeTime > 0 && this.weapon !== "fists")) {
      this.yaw = dampAngle(this.yaw, camYaw, 20, dt);
    } else if (moving && this.dashTime <= 0) {
      this.yaw = dampAngle(this.yaw, Math.atan2(wishDir.x, wishDir.z), 14, dt);
    }

    // ---- Animation ----
    const l = this.anim.loco;
    l.speed = Math.hypot(v.x, v.z);
    l.grounded = b.grounded;
    l.vy = v.y;
    l.aim = clamp(l.aim + (aiming ? dt * 12 : -dt * 6), 0, 1);
    // Camera pitch > 0 looks down, so the arm lowers with it; recoil kicks it up.
    l.aimPitch = g.camRig.pitch * 0.9 - this.recoil * 0.5;
    l.hold =
      this.weapon === "capgun"
        ? "pistol"
        : this.weapon !== "fists"
          ? "rifle"
          : this.hasCane
            ? "cane"
            : "none";
    this.rig.root.position.copyFrom(b.position);
    this.rig.root.rotation.y = this.yaw;
    this.anim.update(dt);
    this.rig.update(dt);

    // Blink while invulnerable after a hit.
    const blink = this.invuln > 0 && this.dashTime <= 0 && Math.floor(this.invuln * 20) % 2 === 0;
    this.rig.joints.body.setEnabled(!blink);

    if (this.caneTime > 0) {
      this.caneTime -= dt;
      if (this.caneTime <= 0) {
        this.cane.setEnabled(this.weapon === "fists" && this.hasCane);
        if (this.weapon !== "fists") this.guns[this.weapon].setEnabled(true);
      }
    }
    this.muzzleTime -= dt;
    this.muzzle.isVisible = this.muzzleTime > 0;
  }

  private combat(dt: number) {
    const g = this.game;
    const input = g.input;
    this.meleeTime = Math.max(0, this.meleeTime - dt);

    // Shooting.
    this.switchWeapon();
    // Hold to keep firing; a quick tap (a trackpad tap sends press and release in
    // the same instant, before any frame sees the button "held") still fires once.
    const tapped = input.peek("shoot", 0.25);
    // Spin-up guns: holding fire spins the barrels; they shoot once spun up.
    const spinUp = this.weapon !== "fists" ? GUNS[this.weapon].spinUp : undefined;
    const holding = this.weapon !== "fists" && input.isHeld("shoot");
    if (spinUp) {
      this.spin = holding ? Math.min(spinUp, this.spin + dt) : Math.max(0, this.spin - dt * 2);
      if (this.spin > 0) {
        const gun = this.guns[this.weapon as GunId];
        gun.rotation.z += dt * (this.spin / spinUp) * 30;
        this.whirTime -= dt;
        if (this.whirTime <= 0) {
          sound.whir(this.spin / spinUp);
          this.whirTime = 0.12;
        }
      }
    } else this.spin = 0;
    if (this.weapon !== "fists" && (holding || tapped)) {
      this.aimHold = 0.9;
      const ready = !spinUp || this.spin >= spinUp;
      if (this.fireCd <= 0 && this.meleeTime <= 0 && ready) {
        input.clear("shoot");
        this.fire(this.weapon);
      }
    }

    // Melee.
    // Right click (or E) punches; with bare fists, left click punches too.
    // With the candy cane in hand (no gun yet), left click swings it.
    if (
      !this.ride &&
      this.weapon === "fists" &&
      this.hasCane &&
      this.meleeTime <= 0 &&
      !this.slamming &&
      input.consume("shoot", 0.15)
    ) {
      this.caneSwing();
    }
    const meleePressed =
      input.consume("melee", 0.15) || (this.weapon === "fists" && input.consume("shoot", 0.15));
    if (!this.ride && meleePressed && this.meleeTime <= 0) {
      if (
        !this.body.grounded &&
        !this.slamming &&
        this.dashTime <= 0 &&
        this.body.position.y -
          g.physics.groundHeightAt(
            this.body.position.x,
            this.body.position.z,
            this.body.position.y,
          ) >
          0.6
      ) {
        this.startSlam();
      } else if (this.body.grounded) {
        this.melee();
      }
    }

    // Candy cane.
    if (
      !this.ride &&
      this.hasCane &&
      input.consume("cane", 0.15) &&
      this.meleeTime <= 0 &&
      !this.slamming
    ) {
      this.caneSwing();
    }
  }

  private melee() {
    const g = this.game;
    // Finisher on a stunned elf in front of us.
    const front = g.enemies.inArc(this.body.position, this.yaw, 1.8, 0.9).find((e) => e.stunned);
    if (front) {
      this.anim.play(CLIPS.bellyBump);
      this.meleeTime = 0.4;
      this.queueHit(0.12, () => {
        if (!front.alive) return;
        g.hitstop(0.09);
        g.camRig.shake(0.3);
        // Bosses take a big chunk, not an instant kill.
        g.enemies.hit(front, front.tuning.boss ? 15 : 999, this.body.position, "finisher", 8);
        g.spawnHealPickup(front.body.position);
      });
      return;
    }
    if (this.weapon === "fists") {
      const clip = this.comboWindow > 0 ? this.comboIndex : 0;
      const isBelly = clip === 2;
      this.anim.play(clip === 0 ? CLIPS.jabR : clip === 1 ? CLIPS.jabL : CLIPS.bellyBump);
      this.meleeTime = isBelly ? 0.34 : 0.22;
      this.comboIndex = (clip + 1) % 3;
      this.comboWindow = this.meleeTime + 0.4;
      sound.whoosh();
      this.queueHit(isBelly ? 0.14 : 0.07, () =>
        this.meleeHit(1.5, isBelly ? 2 : 1, isBelly ? 7 : 3, "punch", 0),
      );
    } else {
      this.anim.play(CLIPS.gunBash);
      this.meleeTime = 0.4;
      sound.whoosh();
      this.queueHit(0.14, () => this.meleeHit(1.8, 2, 6, "bash", 0.6));
    }
  }

  private meleeHit(
    range: number,
    dmg: number,
    knock: number,
    kind: "punch" | "bash",
    stun: number,
  ) {
    const g = this.game;
    const targets = g.enemies.inArc(this.body.position, this.yaw, range, 0.95);
    let hitSomething = false;
    for (const e of targets) {
      g.enemies.hit(e, dmg * this.damageMult, this.body.position, kind, knock, stun);
      hitSomething = true;
    }
    if (g.level.punchProps(this.body.position, this.yaw, range)) hitSomething = true;
    if (hitSomething) {
      g.hitstop(0.06);
      g.camRig.shake(0.12);
      sound.punch();
    }
  }

  private caneSwing() {
    const g = this.game;
    this.anim.play(CLIPS.caneSwing);
    this.meleeTime = 0.55;
    this.cane.setEnabled(true);
    for (const gun of Object.values(this.guns)) gun.setEnabled(false);
    sound.whoosh();
    this.queueHit(0.26, () => {
      const targets = g.enemies.inArc(this.body.position, this.yaw, 2.6, 1.25);
      for (const e of targets)
        g.enemies.hit(e, 3 * this.damageMult, this.body.position, "cane", 6, 0.3);
      if (g.level.punchProps(this.body.position, this.yaw, 2.6)) g.camRig.shake(0.1);
      if (targets.length) {
        g.hitstop(0.07);
        g.camRig.shake(0.2);
        sound.punch();
      }
    });
    this.caneTime = 0.56;
  }

  private startSlam() {
    this.slamming = true;
    this.body.velocity.y = -22;
    this.anim.play(CLIPS.slamFall);
    sound.whoosh();
  }

  private landSlam() {
    const g = this.game;
    this.slamming = false;
    this.anim.stop();
    this.anim.bounce(-0.6);
    g.camRig.shake(0.45);
    g.hitstop(0.05);
    sound.slam();
    g.fx.ring(this.body.position, 3);
    g.fx.puff(this.body.position, "white", 24);
    for (const e of g.enemies.inRadius(this.body.position, 3)) {
      g.enemies.hit(e, 4 * this.damageMult, this.body.position, "slam", 9, 0.4);
    }
    g.level.punchProps(this.body.position, this.yaw, 3, true);
  }

  private queueHit(at: number, run: () => void) {
    this.hitbox = { at, done: false, run };
  }

  private updateHitbox() {
    const h = this.hitbox;
    if (!h || h.done) return;
    if (this.anim.clipTime >= h.at || !this.anim.busy) {
      h.done = true;
      h.run();
    }
  }

  private flameSound = 0;

  /** Flamethrower: a short cone that sets elves and syrup on fire. */
  private fireFlame(def: GunDef) {
    const g = this.game;
    this.fireCd = this.buffs.rage > 0 ? def.rageCooldown : def.cooldown;
    this.recoil = 0.3;
    this.muzzleTime = 0.06;
    this.flameSound -= def.cooldown;
    if (this.flameSound <= 0) {
      sound.flame();
      this.flameSound = 0.14;
    }
    g.camRig.shake(def.shake);
    g.camRig.kickFov(0.012);
    const dir = g.camRig.forward;
    dir.y = Math.max(-0.3, Math.min(0.3, dir.y));
    dir.normalize();
    // Hits are measured from in front of Santa's chest; the jet itself leaves the nozzle.
    const muzzlePos = this.body.position.add(new Vector3(dir.x * 0.7, 1.15, dir.z * 0.7));
    const yaw = Math.atan2(dir.x, dir.z);
    g.fx.flame(this.muzzle.getAbsolutePosition(), dir);
    const wallDist = g.physics.raycast(muzzlePos, dir, def.range, true);
    const range = Math.min(def.range, wallDist + 0.5);
    // Fire splashes where the jet hits a wall.
    if (wallDist < def.range && Math.random() < 0.5)
      g.fx.puff(muzzlePos.add(dir.scale(wallDist)), "orange", 3, 1.4);
    for (const e of g.enemies.elves) {
      if (!e.alive) continue;
      const to = e.center.subtract(muzzlePos);
      const d = to.length();
      if (d > range + e.tuning.radius) continue;
      to.normalize();
      if (Vector3.Dot(to, dir) < Math.cos(def.spread) && d > 1.2) continue;
      e.burnTime = Math.max(e.burnTime, 3);
      g.enemies.hit(e, def.damage * this.damageMult, this.body.position, "fire", def.knockback);
      if (Math.random() < 0.35) g.fx.puff(e.center, "orange", 2, 1.2);
    }
    const boss = g.level.boss;
    if (boss?.alive) {
      const to = boss.center.subtract(muzzlePos);
      const d = to.length() - boss.radius;
      to.normalize();
      if (d < range && Vector3.Dot(to, dir) > Math.cos(def.spread + 0.3)) {
        boss.damage(def.damage * this.damageMult, "fire", this.body.position);
      }
    }
    g.projectiles.shoot(muzzlePos, dir, range);
    g.level.ignite(muzzlePos, yaw, range, def.spread);
    g.level.shootProps(muzzlePos, dir, range, def.damage * this.damageMult);
  }

  /**
   * Guirlande Électrique: a bolt to the elf under the crosshair, then from elf to elf
   * (nearest first, never twice), each jump a little weaker. Every elf hit is stunned.
   */
  private fireChain(def: GunDef, chain: NonNullable<GunDef["chain"]>) {
    const g = this.game;
    this.fireCd = this.buffs.rage > 0 ? def.rageCooldown : def.cooldown;
    this.recoil = 0.8;
    this.muzzleTime = 0.06;
    sound.zap();
    g.camRig.shake(def.shake);
    const origin = g.camRig.camera.position.clone();
    const dir = g.camRig.forward;
    const muzzlePos = this.muzzle.getAbsolutePosition().clone();
    const wallDist = g.physics.raycast(origin, dir, def.range, true);
    const first = g.enemies.raycast(origin, dir, wallDist);
    if (!first) {
      g.fx.bolt(muzzlePos, origin.add(dir.scale(Math.min(wallDist, def.range))));
      g.level.shootProps(origin, dir, wallDist, def.damage * this.damageMult);
      return;
    }
    const struck = new Set<Elf>();
    let target: Elf | null = first.elf;
    let from = muzzlePos;
    let damage = def.damage * this.damageMult;
    for (let i = 0; i <= chain.jumps && target; i++) {
      struck.add(target);
      g.fx.bolt(from, target.center);
      g.enemies.hit(target, damage, from, "bullet", def.knockback, 0.6);
      from = target.center.clone();
      damage *= chain.falloff;
      target = g.enemies.nearestTo(from, chain.range, struck);
    }
  }

  /** Arbalète à Cannes: the bolt sticks in the elf (or the wall) it hit, then explodes. */
  private stickBolt(elf: Elf | null, at: Vector3, dir: Vector3, s: NonNullable<GunDef["sticky"]>) {
    const g = this.game;
    const bolt = g.protoClone("caneBolt", () => g.props.caneBolt());
    if (elf) {
      bolt.parent = elf.rig.joints.chest;
      bolt.position.set(0, 0, 0);
    } else {
      bolt.parent = g.levelRoot;
      bolt.position.copyFrom(at.subtract(dir.scale(0.2)));
    }
    bolt.lookAt(bolt.getAbsolutePosition().add(dir));
    const damage = s.damage * this.damageMult;
    g.after(s.delay, () => {
      const pos = elf
        ? elf.alive
          ? elf.center
          : elf.body.position.add(new Vector3(0, 0.6, 0))
        : at;
      bolt.dispose();
      g.projectiles.explode(pos, s.radius, damage, 0, true);
    });
  }

  /** Lance-Boules: an ornament that flies in an arc and explodes on contact. */
  private fireLob(def: GunDef) {
    const g = this.game;
    this.fireCd = this.buffs.rage > 0 ? def.rageCooldown : def.cooldown;
    this.recoil = 1.6;
    this.muzzleTime = 0.08;
    sound.launcher();
    g.camRig.shake(def.shake);
    g.camRig.kickFov(0.03);
    const dir = g.camRig.forward;
    const origin = this.body.position.add(new Vector3(dir.x * 0.8, 1.4, dir.z * 0.8));
    const vel = dir.scale(26);
    vel.y += 3.5;
    g.projectiles.launchOrnament(origin, vel, def.damage * this.damageMult);
  }

  private fire(id: GunId) {
    const g = this.game;
    const def = GUNS[id];
    if (def.flame) {
      this.fireFlame(def);
      return;
    }
    if (def.lob) {
      this.fireLob(def);
      return;
    }
    if (def.chain) {
      this.fireChain(def, def.chain);
      return;
    }
    this.fireCd = this.buffs.rage > 0 ? def.rageCooldown : def.cooldown;
    this.recoil = def.pellets > 1 ? 1.8 : 1;
    this.muzzleTime = def.pellets > 1 ? 0.08 : 0.05;
    if (id === "shotgun") sound.shotgun();
    else if (id === "smg") sound.smg();
    else if (id === "icicle") sound.icicle();
    else if (id === "crossbow") sound.twang();
    else if (id === "gatling") sound.smg();
    else if (id === "star") sound.beam();
    else sound.capGun();
    g.camRig.shake(def.shake);
    if (def.pellets > 1) g.camRig.kickFov(0.05);

    const cam = g.camRig.camera;
    const moving = Math.hypot(this.body.velocity.x, this.body.velocity.z) > MOVE.walk + 0.5;
    const spread = def.spread + (this.body.grounded ? (moving ? 0.035 : 0) : 0.025);
    const origin = cam.position.clone();
    const muzzlePos = this.muzzle.getAbsolutePosition().clone();
    // Damage is summed per elf so a point-blank shotgun blast is one big hit.
    const hits = new Map<Elf, number>();
    let bossDmg = 0;
    for (let p = 0; p < def.pellets; p++) {
      const dir = g.camRig.forward;
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread;
      dir.z += (Math.random() - 0.5) * spread;
      dir.normalize();
      const wallDist = g.physics.raycast(origin, dir, def.range, true);
      const elfHit = g.enemies.raycast(origin, dir, wallDist);
      const coalDist = g.projectiles.shoot(origin, dir, elfHit ? elfHit.dist : wallDist);
      if (coalDist !== null) {
        if (p < 4) g.fx.tracer(muzzlePos, origin.add(dir.scale(coalDist)));
        continue;
      }
      const bossDist = g.level.boss?.alive
        ? g.level.boss.raycast(origin, dir, elfHit ? elfHit.dist : wallDist)
        : null;
      if (bossDist !== null) {
        bossDmg += def.damage * this.damageMult;
        if (p < 4) g.fx.tracer(muzzlePos, origin.add(dir.scale(bossDist)));
        if (p % 2 === 0) g.fx.puff(origin.add(dir.scale(bossDist - 0.2)), "ice", 3, 0.5);
        continue;
      }
      const propDist = g.level.shootProps(
        origin,
        dir,
        elfHit ? elfHit.dist : wallDist,
        def.damage * this.damageMult,
      );
      const dist = Math.min(
        propDist ?? Number.POSITIVE_INFINITY,
        elfHit?.dist ?? Number.POSITIVE_INFINITY,
        wallDist,
      );
      const end = origin.add(dir.scale(dist));
      if (p < 4) g.fx.tracer(muzzlePos, end);
      if (elfHit && elfHit.dist <= dist + 0.001) {
        // A piercing shot goes on through the elves lined up behind the first one.
        const struck = def.pierce
          ? g.enemies.raycastAll(origin, dir, wallDist).slice(0, def.pierce)
          : [elfHit];
        for (const e of struck)
          hits.set(e.elf, (hits.get(e.elf) ?? 0) + def.damage * this.damageMult);
        if (def.sticky) this.stickBolt(elfHit.elf, end, dir, def.sticky);
      } else if (def.sticky) {
        this.stickBolt(null, end, dir, def.sticky);
      } else if (wallDist < def.range && propDist === null && p % 2 === 0) {
        g.fx.puff(end, "snow", 4, 0.4);
      }
    }
    for (const [elf, dmg] of hits) {
      const blast = def.pellets > 1 ? Math.min(12, def.knockback * dmg) : def.knockback;
      g.enemies.hit(elf, dmg, this.body.position, "bullet", blast);
    }
    if (bossDmg > 0) g.level.boss?.damage(bossDmg, "bullet", this.body.position);
  }

  /** `knock`: how hard the hit throws Santa away from `from` (m/s); `stun`: seconds without steering. */
  hurt(amount: number, from: Vector3, knock = 7, stun = 0.3) {
    if (this.dead || this.invuln > 0 || this.frozen) return;
    const g = this.game;
    if (this.shieldHits > 0) {
      // The tuque soaks up the hit.
      this.shieldHits--;
      if (this.shieldHits === 0) this.buffs.shield = 0;
      this.invuln = 0.4;
      this.rig.flash(0.12, new Color3(0.5, 0.8, 1));
      g.fx.puff(this.body.position.add(new Vector3(0, 1.4, 0)), "sky", 14);
      sound.bounce();
      this.syncBuffs();
      return;
    }
    this.hp = Math.max(0, this.hp - Math.round(amount));
    this.invuln = 0.5;
    this.rig.flash(0.12, new Color3(1, 0.2, 0.2));
    this.anim.play(CLIPS.hurt);
    sound.hurt();
    g.camRig.shake(0.25);
    const away = this.body.position.subtract(from);
    away.y = 0;
    if (away.lengthSquared() > 0.001) {
      away.normalize();
      this.body.velocity.x += away.x * knock;
      this.body.velocity.z += away.z * knock;
      this.body.velocity.y = Math.max(this.body.velocity.y, 4);
      this.knockTime = stun;
    }
    // Direction indicator relative to the camera.
    const ang =
      Math.atan2(from.x - this.body.position.x, from.z - this.body.position.z) - g.camRig.yaw;
    hud.set({ hp: this.hp, hurtAt: performance.now(), hurtDir: ang });
    if (this.hp <= 30 && !this.lowHpBarked) {
      this.lowHpBarked = true;
      g.bark(pick(Math.random, LINES.barksLow));
    }
    if (this.hp <= 0) {
      this.dead = true;
      this.burstApart(from);
      g.onPlayerDeath();
    }
  }

  /**
   * Death: Santa bursts apart like the elves. A copy in the same pose explodes, because
   * Gore.explode() consumes the rig and Santa's own rig comes back on respawn (reset()).
   */
  private burstApart(from: Vector3 | null) {
    const g = this.game;
    const copy = createSanta(g.scene, g.mats);
    copy.root.parent = g.levelRoot;
    for (const [name, joint] of Object.entries(this.rig.joints) as [JointName, TransformNode][]) {
      const c = copy.joints[name];
      c.position.copyFrom(joint.position);
      c.rotation.copyFrom(joint.rotation);
      c.scaling.copyFrom(joint.scaling);
    }
    copy.root.computeWorldMatrix(true);
    for (const n of copy.root.getDescendants(false)) n.computeWorldMatrix(true);
    this.rig.setEnabled(false);
    const dir = from
      ? this.body.position.subtract(from)
      : new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    dir.y = 0;
    g.gore.explode(copy, dir.normalize(), 2.2);
    if (g.gore.confetti) sound.confettiPop();
    else sound.splat();
    g.camRig.shake(0.6);
  }

  private seat: (() => Vector3) | null = null;

  get seated() {
    return this.seat !== null;
  }

  private seatYaw = 0;

  /** Sit on something that carries you (a chairlift): `at` gives the seat position. */
  mount(at: () => Vector3, yaw = 0) {
    this.seat = at;
    this.seatYaw = yaw;
    this.anim.play(CLIPS.sitTube);
  }

  dismount() {
    if (!this.seat) return;
    this.seat = null;
    this.anim.stop();
    this.body.velocity.set(0, 4, 0);
    this.anim.bounce(0.3);
  }

  /** Sit in the tube and slide down `track`. */
  startRide(track: RideTrack, tube: Mesh) {
    this.ride = { track, tube, speed: 8, lateral: 0, prevZ: this.body.position.z };
    this.anim.play(CLIPS.sitTube);
    hud.set({ riding: true });
    sound.whooshLong();
  }

  endRide() {
    const r = this.ride;
    if (!r) return;
    this.ride = null;
    this.anim.stop();
    this.anim.bounce(-0.4);
    hud.set({ riding: false });
    this.body.velocity.scaleInPlace(0.3);
    r.track.onEnd();
  }

  private rideMove(dt: number, axis: { x: number; y: number }) {
    const r = this.ride as NonNullable<typeof this.ride>;
    const g = this.game;
    const b = this.body;
    const v = b.velocity;
    const t = r.track;
    // Gentle gravity pull; W to go faster, S to brake. Cruising ~9 m/s, max 12.
    const accel = 3 + (axis.y > 0 ? 4 : 0) - (axis.y < 0 ? 9 : 0);
    r.speed = clamp(r.speed + accel * dt, 4, axis.y > 0 ? 12 : 9.5);
    const z = b.position.z;
    // A/D steer left/right *as seen from the tube* (it slides toward -z, so
    // Santa's right is world -x). Quick response, so you can line up candies and ramps.
    r.lateral += (-axis.x * 7 - r.lateral) * Math.min(1, dt * 8);
    v.z = -r.speed;
    v.x = t.slopeX(z) * -r.speed + r.lateral;
    // Snowbanks keep you on the track.
    const off = b.position.x - t.centerX(z);
    if (Math.abs(off) > t.halfWidth) {
      b.position.x = t.centerX(z) + Math.sign(off) * t.halfWidth;
      r.lateral *= -0.3;
      g.camRig.shake(0.06);
    }
    // Ramp lips launch you.
    for (const lip of t.lips) {
      if (r.prevZ > lip && z <= lip && b.grounded) {
        v.y = 6.5 + r.speed * 0.32;
        b.grounded = false;
        this.launched = true;
        this.anim.bounce(0.4);
        sound.whooshLong();
        g.camRig.kickFov(0.12);
      }
    }
    r.prevZ = z;
    if (this.game.input.consume("jump", 0.12) && b.grounded) {
      v.y = 6;
      sound.jump();
    }
    if (b.grounded && Math.random() < 0.7)
      g.fx.puff(b.position.add(new Vector3(0, 0.25, 1.1)), "white", 2, 0.8);
    const travel = Math.atan2(v.x, v.z);
    this.yaw = dampAngle(this.yaw, travel, 10, dt);
    g.camRig.yaw = dampAngle(g.camRig.yaw, travel, 2.2, dt);
    g.camRig.kickFov(0.06 + (r.speed - 7) * 0.01);
    r.tube.position.copyFrom(b.position);
    r.tube.position.y += 0.28;
    r.tube.rotation.y = this.yaw;
    r.tube.rotation.z = -r.lateral * 0.03;
    if (z <= t.endZ) this.endRide();
  }

  /** Set on fire (burning coal): small damage over time. */
  burn(seconds: number) {
    this.burnTime = Math.max(this.burnTime, seconds);
  }

  get damageMult() {
    return this.buffs.rage > 0 ? 2 : 1;
  }

  giveBuff(kind: BuffId) {
    this.buffs[kind] = BUFFS[kind];
    if (kind === "shield") this.shieldHits = 3;
    this.syncBuffs();
  }

  private tickBuffs(dt: number) {
    let changed = false;
    for (const k of ["rage", "speed", "shield"] as const) {
      if (this.buffs[k] > 0) {
        this.buffs[k] = Math.max(0, this.buffs[k] - dt);
        if (this.buffs[k] === 0) {
          changed = true;
          if (k === "shield") this.shieldHits = 0;
        }
      }
    }
    // Speed trail.
    if (
      this.buffs.speed > 0 &&
      this.body.grounded &&
      Math.hypot(this.body.velocity.x, this.body.velocity.z) > 5 &&
      Math.random() < 0.3
    ) {
      this.game.fx.puff(this.body.position, "candyPink", 2, 0.6);
    }
    this.buffSync -= dt;
    if (changed || this.buffSync <= 0) {
      this.buffSync = 0.25;
      this.syncBuffs();
    }
  }

  private syncBuffs() {
    const b = hud.get().buffs;
    const next = {
      rage: Math.ceil(this.buffs.rage),
      speed: Math.ceil(this.buffs.speed),
      shield: this.buffs.shield > 0 ? this.shieldHits : 0,
    };
    if (b.rage !== next.rage || b.speed !== next.speed || b.shield !== next.shield)
      hud.set({ buffs: next });
  }

  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    if (this.hp > 30) this.lowHpBarked = false;
    hud.set({ hp: this.hp });
  }
}
