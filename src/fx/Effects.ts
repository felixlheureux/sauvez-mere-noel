import {
  Color4,
  DynamicTexture,
  type Mesh,
  MeshBuilder,
  ParticleSystem,
  type Scene,
  Vector3,
} from "@babylonjs/core";
import type { Materials } from "../assets/Materials";
import { type ColorName, color } from "../assets/Palette";

/** Colors of the ambient twinkles that mark things you can interact with. */
export type TwinkleKind = "gold" | "heal" | "rage" | "speed" | "shield" | "ice" | "warm";

const TWINKLE_COLORS: Record<TwinkleKind, [number, number, number]> = {
  gold: [1, 0.86, 0.35],
  heal: [1, 0.55, 0.62],
  rage: [1, 0.3, 0.25],
  speed: [1, 0.55, 0.85],
  shield: [0.55, 0.85, 1],
  ice: [0.75, 0.95, 1],
  warm: [1, 0.75, 0.4],
};

interface Timed {
  mesh: Mesh;
  t: number;
  life: number;
  kind: "tracer" | "ring" | "bolt";
  radius?: number;
}

/** Small non-gore effects: dust/snow puffs, bullet tracers, shockwave rings, sparkles. */
export class Effects {
  private readonly puffs: ParticleSystem[] = [];
  private puffIndex = 0;
  private readonly active: Timed[] = [];
  private readonly tracerPool: Mesh[] = [];
  private readonly boltPool: Mesh[] = [];
  private readonly ringPool: Mesh[] = [];
  private readonly twinkles = new Map<TwinkleKind, { ps: ParticleSystem; queue: Vector3[] }>();
  private readonly tex: DynamicTexture;
  private readonly flameJet: ParticleSystem;
  private flameOn = 0;

  constructor(
    private readonly scene: Scene,
    private readonly mats: Materials,
  ) {
    const tex = new DynamicTexture("puffTex", { width: 32, height: 32 }, scene, false);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.6, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    tex.update();
    tex.hasAlpha = true;
    this.tex = tex;
    // A big enough pool that many puffs in the same frame don't steal each other's system.
    for (let i = 0; i < 14; i++) {
      const ps = new ParticleSystem(`puff${i}`, 120, scene);
      ps.particleTexture = tex;
      ps.emitter = new Vector3();
      ps.minEmitBox = new Vector3(-0.3, 0, -0.3);
      ps.maxEmitBox = new Vector3(0.3, 0.2, 0.3);
      ps.minSize = 0.2;
      ps.maxSize = 0.5;
      ps.minLifeTime = 0.3;
      ps.maxLifeTime = 0.7;
      ps.minEmitPower = 1;
      ps.maxEmitPower = 3;
      ps.direction1 = new Vector3(-1, 0.4, -1);
      ps.direction2 = new Vector3(1, 1.2, 1);
      ps.gravity = new Vector3(0, -2, 0);
      ps.emitRate = 0;
      ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      ps.start();
      this.puffs.push(ps);
    }
    this.flameJet = this.makeFlamethrower(tex);
  }

  /**
   * Flamethrower: a continuous jet from the nozzle, white-hot at first, then yellow,
   * orange and red as it slows and billows out (additive). Created once, so firing
   * never compiles anything.
   */
  private makeFlamethrower(tex: DynamicTexture): ParticleSystem {
    const jet = new ParticleSystem("flameJet", 900, this.scene);
    jet.particleTexture = tex;
    jet.emitter = new Vector3();
    jet.minLifeTime = 0.3;
    jet.maxLifeTime = 0.42;
    jet.minEmitPower = 17;
    jet.maxEmitPower = 24;
    jet.gravity = new Vector3(0, 4, 0);
    jet.addDragGradient(0, 0);
    jet.addDragGradient(1, 0.75);
    jet.addSizeGradient(0, 0.12);
    jet.addSizeGradient(0.3, 0.6);
    jet.addSizeGradient(1, 1.9);
    jet.addColorGradient(0, new Color4(1, 1, 0.85, 1));
    jet.addColorGradient(0.15, new Color4(1, 0.85, 0.3, 1));
    jet.addColorGradient(0.5, new Color4(1, 0.4, 0.06, 0.9));
    jet.addColorGradient(0.8, new Color4(0.6, 0.12, 0.03, 0.5));
    jet.addColorGradient(1, new Color4(0.2, 0.04, 0.02, 0));
    jet.minInitialRotation = 0;
    jet.maxInitialRotation = Math.PI;
    jet.minAngularSpeed = -4;
    jet.maxAngularSpeed = 4;
    jet.blendMode = ParticleSystem.BLENDMODE_ADD;
    jet.emitRate = 0;
    jet.start();

    return jet;
  }

  /** Keep the flamethrower jet burning from `origin` along `dir` (call on every shot). */
  flame(origin: Vector3, dir: Vector3) {
    const ps = this.flameJet;
    (ps.emitter as Vector3).copyFrom(origin);
    const spread = 0.09;
    ps.direction1 = new Vector3(dir.x - spread, dir.y - spread * 0.5, dir.z - spread);
    ps.direction2 = new Vector3(dir.x + spread, dir.y + spread * 0.5, dir.z + spread);
    this.flameOn = 0.12;
  }

  puff(pos: Vector3, c: ColorName, count: number, size = 1) {
    const ps = this.puffs[this.puffIndex] as ParticleSystem;
    this.puffIndex = (this.puffIndex + 1) % this.puffs.length;
    (ps.emitter as Vector3).copyFrom(pos);
    const col = color(c);
    ps.color1 = new Color4(col.r, col.g, col.b, 0.95);
    ps.color2 = new Color4(col.r * 0.9, col.g * 0.95, col.b, 0.8);
    ps.colorDead = new Color4(col.r, col.g, col.b, 0);
    ps.minSize = 0.2 * size;
    ps.maxSize = 0.5 * size;
    ps.manualEmitCount = count;
  }

  /** Golden sparkles that float up (pickups, chimney). */
  sparkle(pos: Vector3, count = 16) {
    const ps = this.puffs[this.puffIndex] as ParticleSystem;
    this.puffIndex = (this.puffIndex + 1) % this.puffs.length;
    (ps.emitter as Vector3).copyFrom(pos);
    ps.color1 = new Color4(1, 0.9, 0.4, 1);
    ps.color2 = new Color4(1, 1, 0.8, 1);
    ps.colorDead = new Color4(1, 0.8, 0.3, 0);
    ps.minSize = 0.08;
    ps.maxSize = 0.2;
    ps.manualEmitCount = count;
  }

  /**
   * A few tiny sparkles rising from `pos`, from one shared system per color.
   * Positions are queued, so many twinkles in the same frame all show up.
   */
  twinkle(pos: Vector3, kind: TwinkleKind, count = 1, spread = 0.5) {
    let t = this.twinkles.get(kind);
    if (!t) {
      const ps = new ParticleSystem(`twinkle_${kind}`, 300, this.scene);
      const queue: Vector3[] = [];
      ps.particleTexture = this.tex;
      ps.emitter = Vector3.Zero();
      const [r, g, b] = TWINKLE_COLORS[kind];
      ps.color1 = new Color4(r, g, b, 1);
      ps.color2 = new Color4(Math.min(1, r + 0.2), Math.min(1, g + 0.2), Math.min(1, b + 0.2), 1);
      ps.colorDead = new Color4(r, g, b, 0);
      ps.minSize = 0.06;
      ps.maxSize = 0.16;
      ps.minLifeTime = 0.6;
      ps.maxLifeTime = 1.2;
      ps.minEmitPower = 0.4;
      ps.maxEmitPower = 0.9;
      ps.direction1 = new Vector3(-0.2, 1, -0.2);
      ps.direction2 = new Vector3(0.2, 1.4, 0.2);
      ps.gravity = new Vector3(0, 0.3, 0);
      ps.emitRate = 0;
      ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      ps.startPositionFunction = (_m, out) => {
        const q = queue.shift();
        if (q) out.copyFrom(q);
      };
      ps.start();
      t = { ps, queue };
      this.twinkles.set(kind, t);
    }
    for (let i = 0; i < count; i++) {
      t.queue.push(
        new Vector3(
          pos.x + (Math.random() - 0.5) * spread,
          pos.y + (Math.random() - 0.5) * spread * 0.6,
          pos.z + (Math.random() - 0.5) * spread,
        ),
      );
    }
    if (t.queue.length > 200) t.queue.splice(0, t.queue.length - 200);
    t.ps.manualEmitCount = t.queue.length;
  }

  tracer(from: Vector3, to: Vector3) {
    const mesh = this.tracerPool.pop() ?? this.makeTracer();
    const d = to.subtract(from);
    const len = d.length();
    mesh.position.copyFrom(from.add(d.scale(0.5)));
    mesh.scaling.set(1, 1, len);
    mesh.lookAt(to);
    mesh.setEnabled(true);
    this.active.push({ mesh, t: 0, life: 0.06, kind: "tracer" });
  }

  /** An electric bolt: a jagged, flickering line (Guirlande Électrique). */
  bolt(from: Vector3, to: Vector3) {
    const segments = 4;
    const d = to.subtract(from);
    const jitter = Math.min(0.35, d.length() * 0.08);
    let a = from;
    for (let i = 1; i <= segments; i++) {
      const b =
        i === segments
          ? to
          : from
              .add(d.scale(i / segments))
              .addInPlace(
                new Vector3(
                  (Math.random() - 0.5) * jitter * 2,
                  (Math.random() - 0.5) * jitter * 2,
                  (Math.random() - 0.5) * jitter * 2,
                ),
              );
      const mesh = this.boltPool.pop() ?? this.makeBolt();
      const seg = b.subtract(a);
      mesh.position.copyFrom(a.add(seg.scale(0.5)));
      mesh.scaling.set(1, 1, seg.length());
      mesh.lookAt(b);
      mesh.setEnabled(true);
      this.active.push({ mesh, t: 0, life: 0.12, kind: "bolt" });
      a = b;
    }
  }

  ring(pos: Vector3, radius: number) {
    const mesh = this.ringPool.pop() ?? this.makeRing();
    mesh.position.copyFrom(pos);
    mesh.position.y += 0.1;
    mesh.scaling.setAll(0.1);
    mesh.setEnabled(true);
    this.active.push({ mesh, t: 0, life: 0.35, kind: "ring", radius });
  }

  private makeTracer() {
    const m = MeshBuilder.CreateBox("tracer", { width: 0.04, height: 0.04, depth: 1 }, this.scene);
    m.material = this.mats.glow(color("warmLight"), 1.5);
    m.isPickable = false;
    return m;
  }

  private makeBolt() {
    const m = MeshBuilder.CreateBox("bolt", { width: 0.07, height: 0.07, depth: 1 }, this.scene);
    m.material = this.mats.glow(color("sky"), 2.2);
    m.isPickable = false;
    return m;
  }

  private makeRing() {
    const m = MeshBuilder.CreateTorus(
      "ring",
      { diameter: 2, thickness: 0.15, tessellation: 20 },
      this.scene,
    );
    m.material = this.mats.glow(color("snow"), 0.8);
    m.isPickable = false;
    return m;
  }

  update(dt: number) {
    this.flameOn -= dt;
    this.flameJet.emitRate = this.flameOn > 0 ? 450 : 0;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i] as Timed;
      a.t += dt;
      const k = a.t / a.life;
      if (a.kind === "ring") a.mesh.scaling.setAll((a.radius ?? 1) * Math.min(1, k * 1.3));
      if (a.kind === "tracer" || a.kind === "bolt") a.mesh.scaling.x = a.mesh.scaling.y = 1 - k;
      if (k >= 1) {
        a.mesh.setEnabled(false);
        const pool =
          a.kind === "tracer" ? this.tracerPool : a.kind === "bolt" ? this.boltPool : this.ringPool;
        pool.push(a.mesh);
        this.active.splice(i, 1);
      }
    }
  }
}
