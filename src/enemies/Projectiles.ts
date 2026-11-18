import { type Mesh, MeshBuilder, Vector3 } from "@babylonjs/core";
import { color } from "../assets/Palette";
import { sound } from "../audio/Sound";
import type { Game } from "../core/Game";
import { raySphere } from "../world/Physics";

type Kind = "coal" | "bomb";

interface Projectile {
  kind: Kind;
  mesh: Mesh;
  marker: Mesh;
  from: Vector3;
  to: Vector3;
  t: number;
  duration: number;
  arc: number;
  damage: number;
  radius: number;
  ember: number;
  /** Bombs: seconds left on the fuse once landed (-1 while flying). */
  fuse: number;
}

interface Blast {
  pos: Vector3;
  radius: number;
  damage: number;
  delay: number;
  /** Santa's own blasts don't hurt Santa, and do hurt bosses. */
  friendly: boolean;
}

/** A puck sliding flat along the ice: jump over it. */
interface Puck {
  mesh: Mesh;
  pos: Vector3;
  vel: Vector3;
  life: number;
  damage: number;
}

/** Santa's Lance-Boules ornament, flying in an arc. */
interface Ornament {
  mesh: Mesh;
  pos: Vector3;
  vel: Vector3;
  life: number;
  damage: number;
}

/**
 * Lobbed attacks: burning coal and ornament bombs. Each one shows a red circle
 * where it will land, so the player always gets a fair warning. Both can be
 * shot out of the air; a landed bomb can be shot to set it off early.
 * Explosions hurt everyone nearby, elves included, and can chain.
 */
export class Projectiles {
  private readonly list: Projectile[] = [];
  private readonly blasts: Blast[] = [];
  private readonly pucks: Puck[] = [];
  private readonly ornaments: Ornament[] = [];
  private readonly protos = new Map<string, Mesh>();

  constructor(private readonly game: Game) {}

  private proto(key: string, make: () => Mesh) {
    let m = this.protos.get(key);
    if (!m) {
      m = make();
      m.setEnabled(false);
      this.protos.set(key, m);
    }
    const c = m.clone(key, this.game.levelRoot) as Mesh;
    c.setEnabled(true);
    return c;
  }

  private marker() {
    return this.proto("marker", () => {
      const m = MeshBuilder.CreateTorus(
        "marker",
        { diameter: 2, thickness: 0.12, tessellation: 24 },
        this.game.scene,
      );
      m.material = this.game.mats.glow(color("eyeRed"), 1.2);
      m.isPickable = false;
      return m;
    });
  }

  clear() {
    for (const p of this.list) {
      p.mesh.dispose();
      p.marker.dispose();
    }
    this.list.length = 0;
    this.blasts.length = 0;
    for (const p of this.pucks) p.mesh.dispose();
    for (const o of this.ornaments) o.mesh.dispose();
    this.pucks.length = 0;
    this.ornaments.length = 0;
  }

  /** Slapshot: a puck that slides straight along the ground toward `target`. */
  slapPuck(from: Vector3, target: Vector3, damage = 12) {
    const g = this.game;
    const dir = target.subtract(from);
    dir.y = 0;
    if (dir.lengthSquared() < 0.01) return;
    dir.normalize();
    const mesh = this.proto("puck", () => g.props.puck());
    const pos = from.add(dir.scale(0.8));
    this.pucks.push({ mesh, pos, vel: dir.scale(17), life: 2.2, damage });
    sound.slapshot();
  }

  /** Santa's exploding ornament (Lance-Boules). */
  launchOrnament(from: Vector3, vel: Vector3, damage: number) {
    const g = this.game;
    const mesh = this.proto("santaBomb", () => g.props.ornamentShell());
    this.ornaments.push({ mesh, pos: from.clone(), vel: vel.clone(), life: 3, damage });
  }

  private launch(
    kind: Kind,
    from: Vector3,
    to: Vector3,
    duration: number,
    damage: number,
    radius: number,
  ) {
    const g = this.game;
    const mesh =
      kind === "coal"
        ? this.proto("coal", () => g.props.coalLump())
        : this.proto("bomb", () => g.props.ornamentBomb());
    const ring = this.marker();
    const ground = g.physics.groundHeightAt(to.x, to.z, to.y + 1.5);
    const target = new Vector3(to.x, ground, to.z);
    ring.position.set(target.x, ground + 0.08, target.z);
    ring.scaling.set(radius, 1, radius);
    const dist = Vector3.Distance(from, target);
    this.list.push({
      kind,
      mesh,
      marker: ring,
      from: from.clone(),
      to: target,
      t: 0,
      duration,
      arc: 2 + dist * 0.18,
      damage,
      radius,
      ember: 0,
      fuse: -1,
    });
    sound.coalThrow();
  }

  /** Lob burning coal from `from` to land on `to` after `duration` seconds. */
  throwCoal(from: Vector3, to: Vector3, duration = 1.1, damage = 12) {
    this.launch("coal", from, to, duration, damage, 1.6);
  }

  /** Lob an ornament bomb: it lands, blinks for 1.5 s, then explodes. */
  throwBomb(from: Vector3, to: Vector3, duration = 1.1, damage = 20) {
    this.launch("bomb", from, to, duration, damage, 3);
  }

  /** Queue an explosion (used by bombs, kamikaze elves and chain reactions). */
  explode(pos: Vector3, radius = 3, damage = 20, delay = 0.05, friendly = false) {
    this.blasts.push({ pos: pos.clone(), radius, damage, delay, friendly });
  }

  /** Bullets hit coal and bombs. Returns the hit distance if something was hit. */
  shoot(origin: Vector3, dir: Vector3, maxDist: number): number | null {
    let best = -1;
    let bestD = maxDist;
    this.list.forEach((p, i) => {
      const t = raySphere(origin, dir, p.mesh.position, p.kind === "bomb" ? 0.6 : 0.5);
      if (t !== null && t < bestD) {
        best = i;
        bestD = t;
      }
    });
    if (best < 0) return null;
    const p = this.list[best] as Projectile;
    if (p.kind === "bomb") {
      this.explode(p.mesh.position, p.radius, p.damage, 0);
    } else {
      this.game.fx.puff(p.mesh.position, "orange", 14);
      sound.confettiPop();
    }
    this.remove(best);
    return bestD;
  }

  private remove(i: number) {
    const p = this.list[i] as Projectile;
    p.mesh.dispose();
    p.marker.dispose();
    this.list.splice(i, 1);
  }

  update(dt: number) {
    const g = this.game;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i] as Projectile;
      if (p.fuse >= 0) {
        // A landed bomb: blink faster and faster, then boom.
        p.fuse -= dt;
        const rate = 6 + (1.5 - p.fuse) * 14;
        const on = Math.sin(g.time * rate) > 0;
        p.marker.scaling.set(p.radius * (on ? 1.06 : 0.94), 1, p.radius * (on ? 1.06 : 0.94));
        p.mesh.scaling.setAll(on ? 1.15 : 1);
        if (p.fuse <= 0) {
          this.explode(p.to.add(new Vector3(0, 0.4, 0)), p.radius, p.damage, 0);
          this.remove(i);
        }
        continue;
      }
      p.t += dt / p.duration;
      const k = Math.min(1, p.t);
      const pos = Vector3.Lerp(p.from, p.to, k);
      pos.y += p.arc * 4 * k * (1 - k);
      p.mesh.position.copyFrom(pos);
      p.mesh.rotation.x += dt * 9;
      p.mesh.rotation.z += dt * 6;
      const pulse = 1 + Math.sin(p.t * 30) * 0.08 * k;
      p.marker.scaling.set(p.radius * pulse, 1, p.radius * pulse);
      p.ember -= dt;
      if (p.ember <= 0) {
        p.ember = 0.06;
        g.fx.puff(pos, p.kind === "coal" ? "orange" : "gold", 1, 0.5);
      }
      if (k < 1) continue;
      if (p.kind === "bomb") {
        p.fuse = 1.5;
        p.mesh.position.copyFrom(p.to.add(new Vector3(0, 0.3, 0)));
        p.mesh.rotation.setAll(0);
        sound.land(false);
        continue;
      }
      g.fx.puff(p.to.add(new Vector3(0, 0.3, 0)), "orange", 20, 1.2);
      g.fx.puff(p.to.add(new Vector3(0, 0.3, 0)), "coal", 14, 1);
      sound.coalHit();
      const player = g.player.body.position;
      if (
        Math.hypot(player.x - p.to.x, player.z - p.to.z) < p.radius + 0.3 &&
        Math.abs(player.y - p.to.y) < 2.2
      ) {
        g.player.hurt(p.damage * g.level.damageScale, p.to);
        g.player.burn(2);
      }
      this.remove(i);
    }

    this.updatePucks(dt);
    this.updateOrnaments(dt);

    // Explosions (processed with a tiny delay so chains ripple outward).
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i] as Blast;
      b.delay -= dt;
      if (b.delay > 0) continue;
      this.blasts.splice(i, 1);
      this.detonate(b);
    }
  }

  private updatePucks(dt: number) {
    const g = this.game;
    const player = g.player.body.position;
    for (let i = this.pucks.length - 1; i >= 0; i--) {
      const p = this.pucks[i] as Puck;
      p.life -= dt;
      const step = p.vel.scale(dt);
      const len = step.length();
      const wall = g.physics.raycast(
        p.pos.add(new Vector3(0, 0.15, 0)),
        step.scale(1 / len),
        len + 0.2,
      );
      p.pos.addInPlace(step);
      const floor = g.physics.groundHeightAt(p.pos.x, p.pos.z, p.pos.y + 1);
      p.pos.y = floor;
      p.mesh.position.set(p.pos.x, floor + 0.12, p.pos.z);
      p.mesh.rotation.y += dt * 20;
      if (Math.random() < 0.5) g.fx.puff(p.mesh.position, "ice", 1, 0.4);
      const hitPlayer =
        Math.hypot(player.x - p.pos.x, player.z - p.pos.z) < 0.65 && player.y < floor + 0.55;
      if (hitPlayer) {
        g.player.hurt(p.damage * g.level.damageScale, p.pos);
        sound.coalHit();
      }
      if (hitPlayer || wall < len + 0.2 || p.life <= 0 || floor < g.level.killY) {
        g.fx.puff(p.mesh.position, "ice", 8, 0.7);
        p.mesh.dispose();
        this.pucks.splice(i, 1);
      }
    }
  }

  private updateOrnaments(dt: number) {
    const g = this.game;
    for (let i = this.ornaments.length - 1; i >= 0; i--) {
      const o = this.ornaments[i] as Ornament;
      o.life -= dt;
      o.vel.y -= 16 * dt;
      const step = o.vel.scale(dt);
      const len = step.length();
      const dir = step.scale(1 / len);
      const wall = g.physics.raycast(o.pos, dir, len + 0.3, true);
      const elf = g.enemies.raycast(o.pos, dir, len + 0.5);
      const boss = g.level.boss;
      const bossT = boss?.alive ? boss.raycast(o.pos, dir, len + 0.5) : null;
      o.pos.addInPlace(step);
      o.mesh.position.copyFrom(o.pos);
      o.mesh.rotation.x += dt * 10;
      if (Math.random() < 0.6) g.fx.puff(o.pos, "gold", 1, 0.45);
      const ground = g.physics.groundHeightAt(o.pos.x, o.pos.z, o.pos.y + 0.5);
      if (wall < len + 0.3 || elf || bossT !== null || o.pos.y <= ground + 0.15 || o.life <= 0) {
        const at = o.pos.clone();
        if (o.pos.y < ground + 0.3) at.y = ground + 0.3;
        this.explode(at, 3.6, o.damage, 0, true);
        o.mesh.dispose();
        this.ornaments.splice(i, 1);
      }
    }
  }

  private detonate(b: Blast) {
    const g = this.game;
    sound.explosion();
    g.camRig.shake(Math.max(0.15, 0.6 - Vector3.Distance(b.pos, g.player.body.position) * 0.03));
    g.fx.ring(b.pos, b.radius);
    if (b.friendly) g.level.blastProps(b.pos, b.radius, b.damage);
    g.fx.puff(b.pos, "orange", 30, 1.6);
    g.fx.puff(b.pos, "gold", 20, 1);
    g.fx.sparkle(b.pos, 30);
    const player = g.player.body.position;
    if (
      !b.friendly &&
      Vector3.Distance(player.add(new Vector3(0, 0.8, 0)), b.pos) < b.radius + 0.4
    ) {
      g.player.hurt(b.damage * g.level.damageScale, b.pos);
    }
    for (const e of g.enemies.inRadius(b.pos, b.radius)) {
      g.enemies.hit(e, b.friendly ? b.damage : 6, b.pos, "slam", 10, 0.3);
    }
    const boss = g.level.boss;
    if (
      b.friendly &&
      boss?.alive &&
      Vector3.Distance(boss.center, b.pos) < b.radius + boss.radius
    ) {
      boss.damage(b.damage, "slam", b.pos);
    }
    // Set off other bombs on the ground nearby.
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i] as Projectile;
      if (p.kind === "bomb" && Vector3.Distance(p.mesh.position, b.pos) < b.radius + 0.5) {
        this.explode(p.mesh.position, p.radius, p.damage, 0.15);
        this.remove(i);
      }
    }
  }
}
