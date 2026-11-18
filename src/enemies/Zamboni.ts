import { Color3, type Mesh, TransformNode, Vector3 } from "@babylonjs/core";
import type { Rig } from "../anim/Rig";
import { createElf } from "../assets/characters";
import { sound } from "../audio/Sound";
import type { Game } from "../core/Game";
import { dampAngle, flatDistance } from "../core/math";
import { hud } from "../ui/store";
import type { BossTarget } from "../world/Level";
import { raySphere } from "../world/Physics";
import type { DamageKind } from "./Elf";

type State =
  | "idle"
  | "lap"
  | "aim"
  | "charge"
  | "recover"
  | "toCenter"
  | "smash"
  | "hold"
  | "spray"
  | "bridgeAim"
  | "bridge"
  | "return"
  | "stunned"
  | "dead";

interface Spike {
  mesh: Mesh;
  pos: Vector3;
  t: number;
}

interface Shard {
  mesh: Mesh;
  pos: Vector3;
  vel: Vector3;
  life: number;
}

export interface ZamboniHooks {
  /** The rink is smashed: the level swaps the ice for floating islands. */
  onPhase2: () => void;
  /** Phase 2: the machine lays a disc of fresh ice under itself (its bridge over the water). */
  layIce: (x: number, z: number) => void;
  onLowHp: () => void;
  onDefeat: () => void;
}

/** The rink the boss drives around: ellipse centre and radii. */
export interface RinkShape {
  cx: number;
  cz: number;
  rx: number;
  rz: number;
}

const NAME = "La Surfaceuse Infernale";

/**
 * Boss 1 — La Surfaceuse Infernale, a possessed ice resurfacer driven by Ti-Guy.
 * Phase 1: laps the rink leaving ice spikes, and charges (headlights + horn first).
 * After a charge it's dazed and takes double damage.
 * Phase 2 (half health): it drives to centre ice and smashes the rink; the slab
 * breaks into floes over the lake water and it's stranded on the big centre floe.
 * From there it turns its back to spray ice shards, and — being a resurfacer —
 * it can lay fresh ice: it charges across the water on a bridge it freezes as it
 * goes, gets stuck at the end (dazed), then drives back. The bridge melts after a
 * few seconds; Santa can use it too.
 */
export class Zamboni implements BossTarget {
  readonly maxHp = 260;
  hp = this.maxHp;
  phase = 1;
  private state: State = "idle";
  private stateTime = 0;
  private readonly root: TransformNode;
  private readonly lights: Mesh[] = [];
  private readonly beacon: Mesh;
  private readonly auger: Mesh;
  private readonly jaw: Mesh;
  private readonly driver: Rig;
  readonly pos = new Vector3();
  private yaw = 0;
  private speed = 0;
  private lapA = 0;
  private nextCharge = 4;
  private nextSpray = 3;
  private nextBridge = 6;
  private iceTimer = 0;
  private readonly bridgeTarget = new Vector3();
  private spikeTimer = 0;
  private engineTimer = 0;
  private contactCd = 0;
  private lowSaid = false;
  private hitFlash = 0;
  private readonly spikes: Spike[] = [];
  private readonly shards: Shard[] = [];
  private bright = false;

  constructor(
    private readonly game: Game,
    private readonly rink: RinkShape,
    private readonly hooks: ZamboniHooks,
  ) {
    const g = game;
    this.root = new TransformNode("zamboni", g.scene);
    this.root.parent = g.levelRoot;
    const parts = g.props.zamboni();
    for (const [name, mesh] of parts) {
      mesh.parent = this.root;
      if (name === "lights") this.lights.push(...(mesh.getChildMeshes(false) as Mesh[]), mesh);
    }
    this.beacon = parts.get("beacon") as Mesh;
    this.beacon.position.set(0, 2.95, -0.9);
    this.auger = parts.get("auger") as Mesh;
    this.auger.position.set(0, 0.45, -2.5);
    this.jaw = parts.get("jaw") as Mesh;
    g.env.castShadows(...(this.root.getChildMeshes(false) as Mesh[]));
    // Ti-Guy at the wheel.
    this.driver = createElf(g.scene, g.mats, "skater", 7);
    this.driver.root.parent = this.root;
    this.driver.root.position.set(-0.4, 1.75, 1.05);
    this.driver.root.scaling.setAll(1.15);
    g.env.castShadows(...(this.driver.allMeshes() as Mesh[]));
    this.place(rink.cx + rink.rx * 0.8, rink.cz, 0);
  }

  get alive() {
    return this.state !== "dead";
  }

  get center() {
    return this.pos.add(new Vector3(0, 1.3, 0));
  }

  readonly radius = 1.9;

  /** Put the machine somewhere, facing `yaw`. */
  place(x: number, z: number, yaw: number) {
    this.pos.set(x, this.floorY(), z);
    this.yaw = yaw;
    this.sync();
  }

  /** Start the fight. */
  start() {
    this.setState("lap");
    this.lapA = Math.atan2(
      (this.pos.z - this.rink.cz) / this.rink.rz,
      (this.pos.x - this.rink.cx) / this.rink.rx,
    );
    this.syncHud();
  }

  private setState(s: State) {
    this.state = s;
    this.stateTime = 0;
  }

  private floorY() {
    return 0;
  }

  private get fwd() {
    return new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  // ---------- BossTarget ----------

  raycast(origin: Vector3, dir: Vector3, maxDist: number): number | null {
    if (!this.alive) return null;
    const f = this.fwd;
    let best: number | null = null;
    for (const k of [-1.1, 1.1]) {
      const c = this.pos.add(f.scale(k)).addInPlace(new Vector3(0, 1.3, 0));
      const t = raySphere(origin, dir, c, 1.45);
      if (t !== null && t < maxDist && (best === null || t < best)) best = t;
    }
    return best;
  }

  damage(amount: number, _kind: DamageKind, _from: Vector3) {
    if (!this.alive || this.state === "idle" || this.state === "smash" || this.state === "toCenter")
      return;
    const dazed = this.state === "recover" || this.state === "stunned";
    this.hp = Math.max(0, this.hp - amount * (dazed ? 2 : 1));
    if (this.hitFlash <= 0) {
      this.flash(dazed ? new Color3(1, 0.85, 0.3) : new Color3(1, 1, 1));
      sound.hit();
    }
    this.syncHud();
    if (this.phase === 1 && this.hp <= this.maxHp / 2) {
      this.hp = this.maxHp / 2;
      this.phase = 2;
      this.setState("toCenter");
      this.syncHud();
    } else if (!this.lowSaid && this.hp <= this.maxHp * 0.2) {
      this.lowSaid = true;
      this.hooks.onLowHp();
    }
    if (this.hp <= 0) this.die();
  }

  /** Snow globe: the engine freezes up for a moment. */
  stun(seconds: number) {
    if (!this.alive || this.state === "smash" || this.state === "toCenter" || this.state === "idle")
      return;
    this.setState("stunned");
    this.stateTime = -seconds + 2.5;
    this.flash(new Color3(0.6, 0.85, 1), seconds);
  }

  private flash(c: Color3, seconds = 0.08) {
    this.hitFlash = seconds;
    for (const m of this.root.getChildMeshes(false)) {
      m.overlayColor = c;
      m.overlayAlpha = 0.7;
      m.renderOverlay = true;
    }
  }

  private syncHud() {
    hud.set({
      boss:
        this.alive || this.hp > 0
          ? { name: NAME, hp: this.hp, max: this.maxHp, phase: this.phase }
          : null,
    });
  }

  // ---------- Update ----------

  update(dt: number) {
    const g = this.game;
    this.driver.update(dt);
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      if (this.hitFlash <= 0)
        for (const m of this.root.getChildMeshes(false)) m.renderOverlay = false;
    }
    this.updateSpikes(dt);
    this.updateShards(dt);
    if (this.state === "dead" || this.state === "idle") {
      this.sync();
      return;
    }
    this.stateTime += dt;
    this.contactCd -= dt;
    const ppos = g.player.body.position;
    const r = this.rink;

    switch (this.state) {
      case "lap": {
        const rx = this.phase === 2 ? r.rx * 0.85 : r.rx * 0.72;
        const rz = this.phase === 2 ? r.rz * 0.8 : r.rz * 0.62;
        this.speed = this.approach(this.speed, this.phase === 2 ? 7 : 9, 6 * dt);
        // Steer toward a point a bit ahead on the lap ellipse.
        this.lapA += (this.speed / Math.max(rx, rz)) * dt * 1.05;
        const target = new Vector3(
          r.cx + Math.cos(this.lapA) * rx,
          0,
          r.cz + Math.sin(this.lapA) * rz,
        );
        const want = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
        this.yaw = dampAngle(this.yaw, want, 3, dt);
        this.drive(dt);
        if (this.phase === 1) {
          this.nextCharge -= dt;
          const inRink = this.insideRink(ppos, 0.95);
          if (this.nextCharge <= 0 && inRink && !g.player.dead) this.setState("aim");
        } else {
          this.nextSpray -= dt;
          if (this.nextSpray <= 0 && !g.player.dead) this.setState("spray");
        }
        break;
      }
      case "aim": {
        // Slow down, swing round toward Santa, flash the headlights, honk.
        this.speed = this.approach(this.speed, 1.5, 12 * dt);
        const want = Math.atan2(ppos.x - this.pos.x, ppos.z - this.pos.z);
        this.yaw = dampAngle(this.yaw, want, 4, dt);
        this.drive(dt);
        const blink = Math.floor(this.stateTime * 8) % 2 === 0;
        this.setLights(blink);
        if (this.stateTime < dt * 1.5) sound.horn();
        if (this.stateTime > 0.5 && this.stateTime - dt <= 0.5) sound.horn();
        if (this.stateTime > 1.1) {
          this.setLights(true);
          this.setState("charge");
          this.speed = 10;
          g.camRig.shake(0.15);
        }
        break;
      }
      case "charge": {
        this.speed = this.approach(this.speed, 23, 30 * dt);
        this.drive(dt);
        // Crash into the boards → dazed.
        if (!this.insideRink(this.pos.add(this.fwd.scale(2.4)), 0.97) || this.stateTime > 2.4) {
          sound.smash();
          sound.explosion();
          g.camRig.shake(0.5);
          g.fx.puff(
            this.pos.add(this.fwd.scale(2.6)).addInPlace(new Vector3(0, 1, 0)),
            "snow",
            40,
            2,
          );
          this.speed = 0;
          this.setLights(false);
          this.setState("recover");
          g.bark("Ayoye, mon bazou!");
        }
        break;
      }
      case "recover": {
        this.speed = 0;
        if (Math.random() < dt * 8)
          g.fx.puff(this.center.add(new Vector3(0, 1.4, 0)), "gold", 2, 0.6);
        this.root.rotation.z = Math.sin(this.stateTime * 18) * 0.03;
        if (this.stateTime > 2.4) {
          this.root.rotation.z = 0;
          this.nextCharge = 4 + Math.random() * 2.5;
          this.lapA = Math.atan2((this.pos.z - r.cz) / r.rz, (this.pos.x - r.cx) / r.rx);
          this.setState(this.phase === 2 ? "return" : "lap");
        }
        break;
      }
      case "stunned": {
        this.speed = this.approach(this.speed, 0, 20 * dt);
        this.drive(dt);
        if (this.stateTime > 2.5) {
          this.nextCharge = 3;
          this.setState(this.phase === 2 ? "return" : "lap");
        }
        break;
      }
      case "toCenter": {
        // Drive to centre ice before smashing it, so it ends up on the big floe.
        const c = new Vector3(r.cx, 0, r.cz);
        const want = Math.atan2(c.x - this.pos.x, c.z - this.pos.z);
        this.yaw = dampAngle(this.yaw, want, 5, dt);
        this.speed = this.approach(this.speed, flatDistance(this.pos, c) > 3 ? 12 : 2, 20 * dt);
        this.drive(dt);
        if (flatDistance(this.pos, c) < 1 || this.stateTime > 4) {
          this.pos.x = c.x;
          this.pos.z = c.z;
          this.setState("smash");
        }
        break;
      }
      case "smash": {
        // Rear up, then slam the rink to bits.
        this.speed = 0;
        const t = this.stateTime;
        this.root.rotation.x = t < 1.2 ? -Math.sin((t / 1.2) * Math.PI * 0.5) * 0.5 : 0;
        if (t < dt * 1.5) {
          sound.horn();
          this.setLights(true);
        }
        if (t >= 1.2 && t - dt < 1.2) {
          sound.explosion();
          sound.iceCrack();
          g.camRig.shake(0.9);
          g.fx.ring(this.pos, 14);
          g.fx.puff(this.pos.add(new Vector3(0, 0.5, 0)), "ice", 60, 2.5);
          this.hooks.onPhase2();
        }
        if (t > 2.6) {
          this.setLights(false);
          this.nextSpray = 2;
          this.nextBridge = 6;
          this.setState("hold");
        }
        break;
      }
      case "hold": {
        // Stranded on the centre floe: face Santa, idle the engine.
        this.speed = this.approach(this.speed, 0, 10 * dt);
        this.drive(dt);
        const want = Math.atan2(ppos.x - this.pos.x, ppos.z - this.pos.z);
        this.yaw = dampAngle(this.yaw, want, 2, dt);
        this.nextSpray -= dt;
        this.nextBridge -= dt;
        if (g.player.dead) break;
        if (this.nextBridge <= 0 && flatDistance(this.pos, ppos) > 6) this.setState("bridgeAim");
        else if (this.nextSpray <= 0) this.setState("spray");
        break;
      }
      case "bridgeAim": {
        // Lights and horn, like in phase 1: it's about to come across.
        const want = Math.atan2(ppos.x - this.pos.x, ppos.z - this.pos.z);
        this.yaw = dampAngle(this.yaw, want, 5, dt);
        this.setLights(Math.floor(this.stateTime * 8) % 2 === 0);
        if (this.stateTime < dt * 1.5 || (this.stateTime > 0.5 && this.stateTime - dt <= 0.5))
          sound.horn();
        if (this.stateTime > 1.1) {
          this.setLights(true);
          // Aim a little past where Santa stands.
          const d = new Vector3(ppos.x - this.pos.x, 0, ppos.z - this.pos.z);
          const len = Math.min(26, d.length() + 3);
          d.normalize();
          this.yaw = Math.atan2(d.x, d.z);
          this.bridgeTarget.copyFrom(this.pos.add(d.scale(len)));
          this.iceTimer = 0;
          this.speed = 6;
          this.setState("bridge");
        }
        break;
      }
      case "bridge": {
        // Freezes the water ahead of its front wheels as it drives.
        this.speed = this.approach(this.speed, 13, 25 * dt);
        this.iceTimer -= dt;
        if (this.iceTimer <= 0) {
          this.iceTimer = 1.2 / this.speed;
          const front = this.pos.add(this.fwd.scale(2.2));
          this.hooks.layIce(front.x, front.z);
          g.fx.puff(front.add(new Vector3(0, 0.3, 0)), "ice", 6, 1);
        }
        this.drive(dt);
        const done = flatDistance(this.pos, this.bridgeTarget) < 1 || this.stateTime > 3;
        const boards = !this.insideRink(this.pos.add(this.fwd.scale(2.4)), 0.97);
        if (done || boards) {
          if (boards) {
            sound.smash();
            g.camRig.shake(0.4);
          }
          this.hooks.layIce(this.pos.x, this.pos.z);
          this.speed = 0;
          this.setLights(false);
          this.setState("recover");
          g.bark("Ayoye, mon bazou!");
        }
        break;
      }
      case "return": {
        // Back to the centre floe along its own (still frozen) bridge.
        const c = new Vector3(r.cx, 0, r.cz);
        const want = Math.atan2(c.x - this.pos.x, c.z - this.pos.z);
        this.yaw = dampAngle(this.yaw, want, 6, dt);
        this.speed = this.approach(this.speed, 9, 15 * dt);
        this.iceTimer -= dt;
        if (this.iceTimer <= 0) {
          this.iceTimer = 0.15;
          this.hooks.layIce(this.pos.x, this.pos.z);
        }
        this.drive(dt);
        if (flatDistance(this.pos, c) < 1.2 || this.stateTime > 5) {
          this.nextSpray = 1.5;
          this.nextBridge = 6 + Math.random() * 2;
          this.setState("hold");
        }
        break;
      }
      case "spray": {
        // Turns its back to Santa, the hopper lifts (telegraph), then a fan of shards.
        this.speed = 0;
        const away = Math.atan2(this.pos.x - ppos.x, this.pos.z - ppos.z);
        this.yaw = dampAngle(this.yaw, away, 5, dt);
        this.auger.position.y = 0.45 + Math.min(1, this.stateTime) * 0.5;
        if (Math.random() < dt * 10) sound.beep();
        if (this.stateTime >= 1 && this.stateTime - dt < 1) this.sprayShards(ppos);
        if (this.stateTime > 1.4) {
          this.auger.position.y = 0.45;
          this.nextSpray = 3.5;
          this.setState("hold");
        }
        break;
      }
    }

    // Engine rumble.
    this.engineTimer -= dt;
    if (this.engineTimer <= 0) {
      this.engineTimer = 0.24;
      sound.engine(Math.min(1, this.speed / 20));
    }

    // Spike trail while moving.
    this.spikeTimer -= dt;
    if (this.speed > 4 && this.spikeTimer <= 0 && this.phase === 1 && this.state !== "toCenter") {
      this.spikeTimer = 0.32;
      this.spawnSpike(this.pos.subtract(this.fwd.scale(2.9)));
    }

    // Running over Santa (and elves).
    const flat = flatDistance(this.pos, ppos);
    const f = this.fwd;
    const along = (ppos.x - this.pos.x) * f.x + (ppos.z - this.pos.z) * f.z;
    const side = Math.abs((ppos.x - this.pos.x) * f.z - (ppos.z - this.pos.z) * f.x);
    const touching = Math.abs(along) < 2.6 && side < 1.5 && ppos.y < this.pos.y + 2.9;
    if (touching && this.contactCd <= 0 && !g.player.dead && flat < 3.2) {
      const charging = this.state === "charge" || this.state === "bridge";
      if (charging || this.speed > 3) {
        this.contactCd = 1;
        g.player.hurt(charging ? 30 : 12, this.pos);
        const away = f.scale(charging ? 14 : 6);
        g.player.body.velocity.x += away.x;
        g.player.body.velocity.z += away.z;
        g.player.body.velocity.y = charging ? 9 : 5;
        if (charging) g.gore.burst(g.player.body.position.add(new Vector3(0, 1, 0)), f, 20);
      }
    }
    if (this.speed > 8) {
      for (const e of g.enemies.inRadius(this.pos.add(f.scale(1.2)), 2.2)) {
        g.enemies.hit(e, 999, this.pos, "finisher", 8);
      }
    }
    this.sync();
  }

  private approach(v: number, target: number, step: number) {
    return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
  }

  private drive(dt: number) {
    const f = this.fwd;
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    // Keep it inside the boards.
    const r = this.rink;
    const nx = (this.pos.x - r.cx) / (r.rx - 2.2);
    const nz = (this.pos.z - r.cz) / (r.rz - 2.2);
    const d = Math.hypot(nx, nz);
    if (d > 1) {
      this.pos.x = r.cx + (nx / d) * (r.rx - 2.2);
      this.pos.z = r.cz + (nz / d) * (r.rz - 2.2);
    }
    this.pos.y = this.floorY();
    this.auger.rotation.x += this.speed * dt * 2;
  }

  private insideRink(p: Vector3, k: number) {
    const r = this.rink;
    return Math.hypot((p.x - r.cx) / r.rx, (p.z - r.cz) / r.rz) < k;
  }

  private setLights(on: boolean) {
    if (on === this.bright) return;
    this.bright = on;
    for (const m of this.lights) m.scaling.setAll(on ? 1.6 : 1);
    this.beacon.scaling.setAll(on ? 1.4 : 1);
  }

  private sync() {
    this.root.position.copyFrom(this.pos);
    this.root.rotation.y = this.yaw;
    if (this.alive) this.beacon.rotation.y += 0.2;
    // The toothy scraper chomps while charging.
    this.jaw.position.y =
      this.state === "charge" ? Math.abs(Math.sin(this.game.time * 25)) * 0.15 : 0;
  }

  // ---------- Attacks ----------

  private spawnSpike(at: Vector3) {
    const g = this.game;
    if (this.spikes.length > 40) {
      const old = this.spikes.shift();
      old?.mesh.dispose();
    }
    const mesh = g.protoClone("iceSpike", () => g.props.iceSpike());
    mesh.parent = g.levelRoot;
    mesh.position.set(at.x, 0, at.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.scaling.setAll(0.01);
    this.spikes.push({ mesh, pos: new Vector3(at.x, 0, at.z), t: 0 });
  }

  private updateSpikes(dt: number) {
    const g = this.game;
    const ppos = g.player.body.position;
    for (let i = this.spikes.length - 1; i >= 0; i--) {
      const s = this.spikes[i] as Spike;
      s.t += dt;
      const grow = Math.min(1, s.t / 0.35);
      const shrink = s.t > 3 ? Math.max(0, 1 - (s.t - 3) / 0.4) : 1;
      s.mesh.scaling.setAll(Math.max(0.01, grow * shrink));
      if (grow > 0.6 && shrink > 0.5 && flatDistance(s.pos, ppos) < 0.75 && ppos.y < s.pos.y + 1) {
        g.player.hurt(10, s.pos);
      }
      if (s.t > 3.4) {
        s.mesh.dispose();
        this.spikes.splice(i, 1);
      }
    }
  }

  private sprayShards(target: Vector3) {
    const g = this.game;
    sound.shards();
    const from = this.pos.subtract(this.fwd.scale(2.6)).addInPlace(new Vector3(0, 1.4, 0));
    const to = target.add(new Vector3(0, 0.9, 0)).subtract(from);
    const base = Math.atan2(to.x, to.z);
    const dist = Math.hypot(to.x, to.z);
    const speed = 20;
    const flight = dist / speed;
    for (let i = -3; i <= 3; i++) {
      const a = base + i * 0.12;
      const vel = new Vector3(
        Math.sin(a) * speed,
        to.y / Math.max(0.2, flight) + 3 * flight,
        Math.cos(a) * speed,
      );
      const mesh = g.protoClone("iceShard", () => g.props.iceShard());
      mesh.parent = g.levelRoot;
      mesh.position.copyFrom(from);
      this.shards.push({ mesh, pos: from.clone(), vel, life: 2.5 });
    }
  }

  private updateShards(dt: number) {
    const g = this.game;
    const center = g.player.body.position.add(new Vector3(0, 0.9, 0));
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i] as Shard;
      s.life -= dt;
      s.vel.y -= 6 * dt;
      s.pos.addInPlace(s.vel.scale(dt));
      s.mesh.position.copyFrom(s.pos);
      s.mesh.lookAt(s.pos.add(s.vel));
      const hit = Vector3.Distance(s.pos, center) < 0.8;
      if (hit) g.player.hurt(8, s.pos);
      if (hit || s.life <= 0 || s.pos.y < -0.8) {
        g.fx.puff(s.pos, "ice", 6, 0.6);
        s.mesh.dispose();
        this.shards.splice(i, 1);
      }
    }
  }

  // ---------- Death ----------

  private die() {
    const g = this.game;
    this.setState("dead");
    this.speed = 0;
    hud.set({ boss: { name: NAME, hp: 0, max: this.maxHp, phase: this.phase } });
    for (let i = 0; i < 5; i++) {
      const off = new Vector3(
        (Math.random() - 0.5) * 3,
        1 + Math.random(),
        (Math.random() - 0.5) * 4,
      );
      g.projectiles.explode(this.pos.add(off), 2.5, 0, 0.15 + i * 0.2, true);
    }
    g.after(1.2, () => {
      // Pieces fly everywhere; Ti-Guy is launched into the night.
      for (const m of [...this.root.getChildMeshes(true)] as Mesh[]) {
        m.setParent(null);
        const v = new Vector3(
          (Math.random() - 0.5) * 14,
          8 + Math.random() * 8,
          (Math.random() - 0.5) * 14,
        );
        g.gore.toss(m, v, 3);
      }
      this.driver.root.setParent(null);
      for (const m of this.driver.allMeshes() as Mesh[]) {
        m.setParent(null);
        g.gore.toss(m, new Vector3((Math.random() - 0.5) * 6, 14, (Math.random() - 0.5) * 6), 2);
      }
      g.gore.burst(this.center, new Vector3(0, 1, 0), 60);
      g.camRig.shake(1);
      for (const s of this.spikes) s.mesh.dispose();
      this.spikes.length = 0;
      hud.set({ boss: null });
      this.hooks.onDefeat();
    });
  }

  dispose() {
    for (const s of this.spikes) s.mesh.dispose();
    for (const s of this.shards) s.mesh.dispose();
    this.spikes.length = 0;
    this.shards.length = 0;
    this.root.dispose();
  }
}
