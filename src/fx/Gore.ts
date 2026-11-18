import {
  type AbstractMesh,
  Color3,
  Color4,
  DynamicTexture,
  type InstancedMesh,
  type Mesh,
  MeshBuilder,
  ParticleSystem,
  type Scene,
  Vector3,
  VertexBuffer,
} from "@babylonjs/core";
import type { Rig } from "../anim/Rig";
import type { Materials } from "../assets/Materials";
import { mulberry32, randRange } from "../core/math";
import type { PhysicsWorld } from "../world/Physics";

/** How messy a level is. Ramps up level after level. */
export interface GoreSettings {
  /** Blood particles per kill. */
  particles: number;
  /** Seconds a splat stays on the ground (Infinity = forever). */
  decalLife: number;
  /** Flying meat chunks per kill. */
  chunks: number;
  /** Max splats alive at once. */
  maxDecals: number;
  /** Splat size multiplier. */
  splatSize: number;
}

export const GORE_LEVELS: GoreSettings[] = [
  { particles: 40, decalLife: 20, chunks: 2, maxDecals: 80, splatSize: 0.8 },
  { particles: 60, decalLife: 25, chunks: 3, maxDecals: 120, splatSize: 0.9 },
  { particles: 90, decalLife: 9999, chunks: 5, maxDecals: 200, splatSize: 1 },
];

const CONFETTI = [
  new Color4(1, 0.42, 0.6, 1),
  new Color4(0.45, 0.85, 1, 1),
  new Color4(1, 0.85, 0.3, 1),
  new Color4(0.55, 0.95, 0.6, 1),
  new Color4(0.8, 0.6, 1, 1),
];

interface Gib {
  mesh: AbstractMesh;
  vel: Vector3;
  spin: Vector3;
  life: number;
  bounced: boolean;
  settled: boolean;
  radius: number;
}

interface Decal {
  inst: InstancedMesh;
  life: number;
  target: number;
}

/**
 * Cartoon gore: blood bursts, persistent splats, flying body parts.
 * Body parts are the rig's own meshes, detached from their joints.
 * "Mode confettis" swaps every red for party colors.
 */
export class Gore {
  settings: GoreSettings = GORE_LEVELS[0] as GoreSettings;
  confetti = false;
  private readonly bursts: ParticleSystem[] = [];
  private burstIndex = 0;
  private readonly gibs: Gib[] = [];
  private readonly decals: Decal[] = [];
  private readonly decalBase: Mesh;
  private readonly chunkBase: Mesh;
  private readonly rand = mulberry32(7);
  private readonly bloodTex: DynamicTexture;
  private readonly confettiTex: DynamicTexture;

  constructor(
    private readonly scene: Scene,
    mats: Materials,
    private readonly physics: PhysicsWorld,
  ) {
    this.bloodTex = makeBlobTexture(scene, "blood", false);
    this.confettiTex = makeBlobTexture(scene, "confetti", true);
    for (let i = 0; i < 6; i++) this.bursts.push(this.makeBurst(i));

    this.decalBase = MeshBuilder.CreateDisc("splat", { radius: 0.5, tessellation: 9 }, scene);
    this.decalBase.rotation.x = Math.PI / 2;
    this.decalBase.bakeCurrentTransformIntoVertices();
    this.decalBase.material = mats.toon;
    this.decalBase.isPickable = false;
    this.decalBase.registerInstancedBuffer(VertexBuffer.ColorKind, 4);
    this.decalBase.instancedBuffers.color = new Color4(0.6, 0, 0.08, 1);
    this.decalBase.isVisible = false;
    this.decalBase.receiveShadows = true;

    this.chunkBase = MeshBuilder.CreateIcoSphere(
      "chunk",
      { radius: 0.07, subdivisions: 0, flat: true },
      scene,
    );
    this.chunkBase.material = mats.toon;
    this.chunkBase.registerInstancedBuffer(VertexBuffer.ColorKind, 4);
    this.chunkBase.instancedBuffers.color = new Color4(0.5, 0.02, 0.08, 1);
    this.chunkBase.isVisible = false;
    this.chunkBase.isPickable = false;
  }

  /** One splat and one gib, so their (instanced) shaders compile during loading, not on the first kill. */
  warmupMeshes(pos: Vector3) {
    const splat = this.decalBase.createInstance("warmSplat");
    const chunk = this.chunkBase.createInstance("warmChunk");
    splat.position.copyFrom(pos);
    chunk.position.copyFrom(pos);
    return [splat, chunk];
  }

  private makeBurst(i: number) {
    const ps = new ParticleSystem(`blood${i}`, 220, this.scene);
    ps.particleTexture = this.bloodTex;
    ps.emitter = new Vector3();
    ps.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
    ps.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
    ps.minSize = 0.08;
    ps.maxSize = 0.28;
    ps.minLifeTime = 0.4;
    ps.maxLifeTime = 1.1;
    ps.minEmitPower = 2;
    ps.maxEmitPower = 7;
    ps.gravity = new Vector3(0, -14, 0);
    ps.direction1 = new Vector3(-1, 1.6, -1);
    ps.direction2 = new Vector3(1, 3.2, 1);
    ps.emitRate = 0;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.updateSpeed = 1 / 60;
    ps.start();
    return ps;
  }

  reset() {
    for (const g of this.gibs) g.mesh.dispose();
    this.gibs.length = 0;
    for (const d of this.decals) d.inst.dispose();
    this.decals.length = 0;
  }

  /** A spray of blood (or confetti) at `pos`, pushed along `dir`. */
  burst(pos: Vector3, dir: Vector3 | null, amount: number) {
    const ps = this.bursts[this.burstIndex] as ParticleSystem;
    this.burstIndex = (this.burstIndex + 1) % this.bursts.length;
    (ps.emitter as Vector3).copyFrom(pos);
    const d = dir ? dir.normalizeToNew() : Vector3.Zero();
    ps.direction1 = new Vector3(-1 + d.x * 2, 1.2, -1 + d.z * 2);
    ps.direction2 = new Vector3(1 + d.x * 2, 3, 1 + d.z * 2);
    if (this.confetti) {
      ps.particleTexture = this.confettiTex;
      const c = CONFETTI[Math.floor(this.rand() * CONFETTI.length)] as Color4;
      ps.color1 = c;
      ps.color2 = CONFETTI[Math.floor(this.rand() * CONFETTI.length)] as Color4;
      ps.colorDead = new Color4(c.r, c.g, c.b, 0);
      ps.gravity = new Vector3(0, -5, 0);
    } else {
      ps.particleTexture = this.bloodTex;
      ps.color1 = new Color4(0.75, 0.02, 0.08, 1);
      ps.color2 = new Color4(0.45, 0, 0.05, 1);
      ps.colorDead = new Color4(0.3, 0, 0.03, 0);
      ps.gravity = new Vector3(0, -14, 0);
    }
    ps.manualEmitCount = Math.round(amount);
  }

  /** Paint a splat on whatever surface is under (x, z). */
  splat(pos: Vector3, size = 1) {
    if (this.decals.length >= this.settings.maxDecals) {
      const old = this.decals.shift();
      old?.inst.dispose();
    }
    const y = this.physics.groundHeightAt(pos.x, pos.z, pos.y + 0.3) + 0.015 + this.rand() * 0.01;
    const inst = this.decalBase.createInstance("splat");
    inst.position.set(pos.x, y, pos.z);
    inst.rotation.y = this.rand() * Math.PI * 2;
    const s = size * this.settings.splatSize * randRange(this.rand, 0.7, 1.4);
    inst.scaling.set(0.01, 1, 0.01);
    inst.instancedBuffers.color = this.confetti
      ? (CONFETTI[Math.floor(this.rand() * CONFETTI.length)] as Color4)
      : new Color4(randRange(this.rand, 0.45, 0.62), 0, randRange(this.rand, 0.04, 0.09), 1);
    this.decals.push({ inst, life: this.settings.decalLife, target: s });
  }

  /** Blow a rig apart. `cut` = sliced in half (top flies, legs drop). */
  explode(rig: Rig, hitDir: Vector3, force = 1, cut = false) {
    const center = rig.joints.chest.getAbsolutePosition().clone();
    this.burst(center, hitDir, this.settings.particles * force);
    this.burst(center.add(new Vector3(0, 0.3, 0)), null, this.settings.particles * 0.5 * force);
    for (let i = 0; i < 3; i++) {
      this.splat(
        center.add(
          new Vector3(
            randRange(this.rand, -1, 1) + hitDir.x * 1.2,
            0,
            randRange(this.rand, -1, 1) + hitDir.z * 1.2,
          ),
        ),
        1.2,
      );
    }
    const upper = new Set(["head", "hatTip", "chest", "armL", "armR"]);
    for (const [joint, mesh] of rig.parts) {
      mesh.computeWorldMatrix(true);
      mesh.setParent(null);
      // Clear any hit flash so the pieces keep their colors.
      for (const m of [mesh, ...mesh.getChildMeshes()]) m.renderOverlay = false;
      const isUpper = upper.has(joint);
      const up = cut ? (isUpper ? 7 : 1.5) : randRange(this.rand, 3, 7);
      const side = cut ? (isUpper ? 2 : 0.3) : 3.5;
      const vel = new Vector3(
        hitDir.x * side * force + randRange(this.rand, -2, 2),
        up * (0.7 + force * 0.3),
        hitDir.z * side * force + randRange(this.rand, -2, 2),
      );
      this.gibs.push({
        mesh,
        vel,
        spin: new Vector3(
          randRange(this.rand, -12, 12),
          randRange(this.rand, -12, 12),
          randRange(this.rand, -12, 12),
        ),
        life: 14,
        bounced: false,
        settled: false,
        radius: 0.12,
      });
    }
    if (!this.confetti) {
      for (let i = 0; i < this.settings.chunks; i++) {
        const c = this.chunkBase.createInstance("chunk");
        c.position.copyFrom(center);
        c.scaling.setAll(randRange(this.rand, 0.7, 1.6));
        c.instancedBuffers.color = new Color4(randRange(this.rand, 0.4, 0.7), 0.02, 0.08, 1);
        this.gibs.push({
          mesh: c,
          vel: new Vector3(
            randRange(this.rand, -4, 4) + hitDir.x * 3,
            randRange(this.rand, 3, 8),
            randRange(this.rand, -4, 4) + hitDir.z * 3,
          ),
          spin: new Vector3(this.rand() * 10, this.rand() * 10, this.rand() * 10),
          life: 10,
          bounced: false,
          settled: false,
          radius: 0.05,
        });
      }
    }
    rig.root.dispose(true, false);
  }

  /** Throw a single mesh (e.g. a smashed snowman piece) with simple physics. */
  toss(mesh: AbstractMesh, vel: Vector3, life = 6) {
    this.gibs.push({
      mesh,
      vel,
      spin: new Vector3(this.rand() * 6, this.rand() * 6, this.rand() * 6),
      life,
      bounced: true,
      settled: false,
      radius: 0.2,
    });
  }

  update(dt: number) {
    for (let i = this.gibs.length - 1; i >= 0; i--) {
      const g = this.gibs[i] as Gib;
      g.life -= dt;
      if (g.life <= 0) {
        g.mesh.dispose();
        this.gibs.splice(i, 1);
        continue;
      }
      const p = g.mesh.position;
      if (!g.settled) {
        g.vel.y -= 20 * dt;
        p.addInPlace(g.vel.scale(dt));
        g.mesh.rotation.addInPlace(g.spin.scale(dt));
        const floor = this.physics.groundHeightAt(p.x, p.z, p.y + 0.3) + g.radius;
        if (p.y < floor) {
          p.y = floor;
          if (!g.bounced) {
            g.bounced = true;
            if (g.radius > 0.1) this.splat(p, 0.8);
          }
          if (Math.abs(g.vel.y) < 1.5) {
            g.settled = true;
          } else {
            g.vel.y *= -0.35;
            g.vel.x *= 0.6;
            g.vel.z *= 0.6;
            g.spin.scaleInPlace(0.5);
          }
        }
      }
      if (g.life < 1.5) {
        p.y -= dt * 0.25;
        g.mesh.scaling.scaleInPlace(1 - dt * 0.8);
      }
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i] as Decal;
      d.life -= dt;
      const s = d.inst.scaling;
      if (d.life < 1) {
        s.x = Math.max(0.001, s.x - dt * d.target);
        s.z = s.x;
        if (d.life <= 0) {
          d.inst.dispose();
          this.decals.splice(i, 1);
        }
      } else if (s.x < d.target) {
        s.x = Math.min(d.target, s.x + dt * d.target * 8);
        s.z = s.x;
      }
    }
  }
}

function makeBlobTexture(scene: Scene, name: string, square: boolean) {
  const tex = new DynamicTexture(name, { width: 32, height: 32 }, scene, false);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = "white";
  if (square) {
    ctx.fillRect(6, 10, 20, 12);
  } else {
    ctx.beginPath();
    ctx.arc(16, 16, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

export const BLOOD_RED = new Color3(0.6, 0, 0.08);
