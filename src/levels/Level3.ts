import { type Mesh, MeshBuilder, Vector3, VertexBuffer } from "@babylonjs/core";
import { color } from "../assets/Palette";
import { sound } from "../audio/Sound";
import { clamp, mulberry32, randRange, smoothstep } from "../core/math";
import { ELF_BASIC, ELF_SPRINTER, ELF_THROWER, type Elf, type ElfTuning } from "../enemies/Elf";
import { LINES, OBJ, T, WEAPON_NAMES } from "../i18n/fr-QC";
import type { RideTrack } from "../player/Player";
import { MOODS } from "../world/Environment";
import { Level } from "../world/Level";

/*
 * Layout (the slope runs downhill toward -z):
 *   top plateau (chalet, tubes, exit)  z 100…118
 *   the run, 5 ramps                   z 100 → -60   (160 m, ~17 s in the tube)
 *   the basin (arena)                  z < -60
 *   the chairlift (right side, x = 26) bottom z -66 → top z 96: you're carried
 *   all the way back up, so sliding again never means a long walk.
 */
const TOP_Z = 100;
const BOTTOM_Z = -60;
const LIPS = [78, 52, 26, 0, -28];
const ARENA = new Vector3(0, 0, -74);
const LIFT_X = 26;
const LIFT_A = -66;
const LIFT_B = 96;
const LIFT_SPEED = 7;
const SEAT = 2.6;
const START = new Vector3(0, 0, TOP_Z - 2);

const centerX = (z: number) => 8 * Math.sin(z * 0.035);
const slopeX = (z: number) => 8 * 0.035 * Math.cos(z * 0.035);

/** Height along the run (before the side banks). */
function slopeHeight(z: number) {
  if (z >= TOP_Z) return 6 + (TOP_Z - BOTTOM_Z) * 0.24;
  if (z >= BOTTOM_Z) return 6 + (z - BOTTOM_Z) * 0.24;
  return 4 + Math.max(0, z + 68) * 0.25;
}

function terrainExact(x: number, z: number) {
  const d = Math.abs(x - centerX(z));
  let h = slopeHeight(z);
  // A bowl-shaped track with raised banks, and plateaus on both sides.
  const bank = d <= 7 ? 0.04 * d * d : 1.96 + Math.min(3.5, (d - 7) * 1.1);
  const basin = smoothstep(clamp((-58 - z) / 6, 0, 1));
  const top = smoothstep(clamp((z - TOP_Z) / 4, 0, 1));
  h += bank * (1 - Math.max(basin, top) * 0.85);
  // Ramps: rise toward each lip, then a sharp drop.
  for (const lip of LIPS) {
    if (z >= lip && z <= lip + 7 && d < 6) h += 1.6 * (1 - (z - lip) / 7);
  }
  // Outer walls.
  h +=
    Math.max(0, Math.abs(x) - 34) * 1.2 + Math.max(0, z - 118) * 1.2 + Math.max(0, -z - 90) * 1.2;
  return h;
}

/**
 * Height of Santa's feet `dist` metres past a ramp lip, flying at the tube's cruising speed
 * (same launch and gravity as Player: up at 26, down at 26 × 1.6).
 */
function rampArc(lip: number, dist: number) {
  const speed = 9.5;
  const vy = 6.5 + speed * 0.32;
  const t = dist / speed;
  const up = vy / 26;
  const y0 = slopeHeight(lip) + 1.6;
  if (t <= up) return y0 + vy * t - 13 * t * t;
  return y0 + (vy * vy) / 52 - 20.8 * (t - up) ** 2;
}

const GRID = { x0: -44, z0: -96, step: 0.5, nx: 177, nz: 441 };
let heights: Float32Array | null = null;

function terrain(x: number, z: number) {
  if (!heights) {
    heights = new Float32Array(GRID.nx * GRID.nz);
    for (let j = 0; j < GRID.nz; j++) {
      for (let i = 0; i < GRID.nx; i++) {
        heights[j * GRID.nx + i] = terrainExact(GRID.x0 + i * GRID.step, GRID.z0 + j * GRID.step);
      }
    }
  }
  const fx = clamp((x - GRID.x0) / GRID.step, 0, GRID.nx - 1.001);
  const fz = clamp((z - GRID.z0) / GRID.step, 0, GRID.nz - 1.001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const h = heights;
  const a = h[j * GRID.nx + i] as number;
  const b = h[j * GRID.nx + i + 1] as number;
  const c = h[(j + 1) * GRID.nx + i] as number;
  const d = h[(j + 1) * GRID.nx + i + 1] as number;
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

/** The chairs ride a steady 2.6 m above the (smoothed) ground. */
const liftHeight = (z: number) =>
  (terrain(LIFT_X, z - 3) + terrain(LIFT_X, z) + terrain(LIFT_X, z + 3)) / 3 + SEAT;

/**
 * Niveau 3 — Les Glissades de la Mort.
 * A long tube run down the hill while coal throwers pelt you, a fight in the
 * basin, then the chairlift carries you back to the top (you just sit and shoot).
 * Tubes at the top let you go down again for the bells and candies you missed.
 */
export class Level3 extends Level {
  readonly id = 3;
  readonly name = "Les Glissades de la Mort";
  readonly mood = MOODS.twilight;
  override darkness = 3;
  override arenaRadius = 120;
  override newGun = "smg" as const;
  override theme = "wewish" as const;
  private decorChairs: { mesh: Mesh; t: number; dir: 1 | -1 }[] = [];
  private tube: Mesh | null = null;
  private firstSlideDone = false;
  private arenaDone = false;
  private riding: { chair: Mesh; t: number } | null = null;
  private afterLift: (() => void) | null = null;

  build() {
    const g = this.game;
    const p = g.props;
    const rand = mulberry32(31);
    heights = null;
    g.physics.terrain = terrain;
    this.spawnPos = new Vector3(0, terrain(0, 108), 108);
    this.spawnYaw = Math.PI;

    this.place(this.buildTerrainMesh(), 0, 11, { shadow: false });
    this.place(p.mountains(150, 17), 0, 11, { shadow: false });

    // Checkpoints: the top, the bottom of the run, the top of the lift.
    this.addCheckpoint(0, 108, Math.PI);
    this.addCheckpoint(0, -64, Math.PI);
    this.addCheckpoint(LIFT_X - 5, LIFT_B + 2, -Math.PI / 2);

    // The chalet on the top plateau, with its exit chimney.
    const cy = terrain(-14, 109);
    this.place(p.chalet(), -14, 109, { y: cy, rot: Math.PI / 2 });
    this.solid(-14.5, 109, 6.2, 9, 8.2, cy);
    this.solid(-13, 109, 8.4, 1.5, 10.4, cy);
    this.exitChimney(12, 112, () => void this.finish());
    // Behind the chalet: a woodpile tower with a bell on top.
    const wy = terrain(-22, 105);
    this.gift(-20.5, 105, 1.6, 1.2, 1.6, 2, wy);
    this.gift(-22, 106.6, 1.6, 2.4, 1.6, 4, wy);
    this.gift(-23.6, 105, 1.4, 3.6, 1.4, 6, wy);
    this.bell(-23.6, wy + 4.3, 105);
    this.health(-8, 104, true);

    // The tube rack at the start: slide as many times as you like.
    for (let i = 0; i < 4; i++) {
      const t = g.protoClone("rackTube", () => p.snowTube());
      this.place(t, START.x + 4.2, START.z + 1.5, {
        y: terrain(START.x + 4, START.z) + 0.3 + i * 0.55,
      });
    }
    this.solid(START.x + 4.2, START.z + 1.5, 1.6, 2.2, 1.6, terrain(START.x + 4, START.z));

    // Floodlights and candy-cane flags along the run.
    for (let z = TOP_Z - 6; z > BOTTOM_Z; z -= 20) {
      for (const side of [-1, 1]) {
        const x = centerX(z) + side * 9.5;
        const light = g.protoClone("flood", () => p.floodlight(8));
        this.place(light, x, z, {
          y: terrain(x, z) - 0.2,
          rot: side > 0 ? -Math.PI / 2 : Math.PI / 2,
        });
      }
    }
    for (const lip of LIPS) {
      for (const side of [-1, 1]) {
        const x = centerX(lip) + side * 6.5;
        const flag = g.protoClone("rampCane", () => p.candyCane(2.6));
        this.place(flag, x, lip, { y: terrain(x, lip) });
      }
    }

    // Racing-line candies, with arcs over each ramp.
    for (let z = TOP_Z - 8; z > BOTTOM_Z + 2; z -= 6) {
      if (LIPS.some((l) => z <= l + 8 && z >= l - 10)) continue;
      const x = centerX(z) + Math.sin(z * 0.2) * 3;
      this.candy(x, terrain(x, z) + 0.9, z);
    }
    // On the arc a tube actually flies at cruising speed (the bells hang off it).
    LIPS.forEach((lip, i) => {
      for (const dz of [-2.5, -5, -7.5]) {
        const z = lip + dz;
        const x = centerX(z);
        if (!(i === 1 && dz === -5)) this.candy(x, rampArc(lip, -dz) + 0.8, z);
      }
    });
    // Bell 1: at the top of the second ramp's jump. Bell 2: off to the left of the
    // fourth ramp's jump (steer before the lip).
    const b1 = (LIPS[1] as number) - 6;
    this.bell(centerX(b1), rampArc(LIPS[1] as number, 6) + 0.8, b1);
    const b2 = (LIPS[3] as number) - 6;
    this.bell(centerX(b2) + 3.6, rampArc(LIPS[3] as number, 6) + 0.8, b2);

    // The basin at the bottom: cover, a warming hut, rewards.
    const hy = terrain(-13, -78);
    this.place(p.gingerbreadHouse(4.5, 4, 2.8, 33), -13, -78, { y: hy, rot: 0.5 });
    this.houseSolid(-13, -78, 4.5, 4, 2.8, 0.5, hy);
    [
      [6, -70],
      [-6, -68],
      [9, -80],
      [-3, -82],
    ].forEach(([x, z], i) => {
      this.gift(x as number, z as number, 1.6, 1.3, 1.6, i, terrain(x as number, z as number));
    });
    this.lootGift(13, -72, 1);
    this.lootGift(-15, -68, 3);
    this.health(15, -82);

    this.buildLift();

    // Forest framing the run (no shadows: it's a lot of trees and they're far).
    const trees: [number, number, number][] = [];
    for (let z = -92; z <= 120; z += 4) {
      for (const x of [-38, -33, -29, 33, 38]) {
        const tx = x + randRange(rand, -1.5, 1.5);
        const tz = z + randRange(rand, -1.5, 1.5);
        if (Math.abs(tx - LIFT_X) < 6) continue;
        trees.push([tx, tz, randRange(rand, 0.9, 1.4)]);
      }
    }
    for (let i = 0; i < 30; i++) {
      const z = randRange(rand, -50, 92);
      const x = centerX(z) - randRange(rand, 13, 24);
      trees.push([x, z, randRange(rand, 0.8, 1.2)]);
    }
    this.forest(trees, 8, "pine", false);
  }

  private buildTerrainMesh() {
    const g = this.game;
    const ground = MeshBuilder.CreateGround(
      "slopeGround",
      { width: 88, height: 214, subdivisionsX: 59, subdivisionsY: 143, updatable: true },
      g.scene,
    );
    const pos = ground.getVerticesData(VertexBuffer.PositionKind) as Float32Array;
    const colors = new Float32Array((pos.length / 3) * 4);
    const snow = color("snow");
    const track = color("snowShade");
    const ice = color("ice");
    const rand = mulberry32(5);
    for (let i = 0; i < pos.length / 3; i++) {
      const x = pos[i * 3] as number;
      const z = (pos[i * 3 + 2] as number) + 11;
      pos[i * 3 + 1] = terrain(x, z);
      const d = Math.abs(x - centerX(z));
      const onRamp = LIPS.some((l) => z >= l - 0.5 && z <= l + 7) && d < 6;
      const onTrack = d < 6.5 && z < TOP_Z + 1 && z > BOTTOM_Z - 2;
      const c = onRamp ? ice : onTrack ? track : rand() < 0.25 ? track : snow;
      colors.set([c.r, c.g, c.b, 1], i * 4);
    }
    ground.updateVerticesData(VertexBuffer.PositionKind, pos);
    ground.setVerticesData(VertexBuffer.ColorKind, colors);
    ground.convertToFlatShadedMesh();
    ground.material = g.mats.toon;
    ground.receiveShadows = true;
    ground.isPickable = false;
    ground.freezeWorldMatrix();
    return ground as Mesh;
  }

  /** A lift station that sits in the ground on a stone plinth, whatever the slope. */
  private station(x: number, z: number) {
    const g = this.game;
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const dx of [-2.5, 0, 2.5]) {
      for (const dz of [-2, 0, 2]) {
        const h = terrain(x + dx, z + dz);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
    }
    const plinth = MeshBuilder.CreateBox(
      "plinth",
      { width: 5.2, depth: 4.2, height: hi - lo + 0.6 },
      g.scene,
    );
    plinth.material = g.mats.toon;
    const grey = color("grey");
    const cols = new Float32Array((plinth.getTotalVertices() || 24) * 4);
    for (let i = 0; i < cols.length; i += 4) cols.set([grey.r, grey.g, grey.b, 1], i);
    plinth.setVerticesData(VertexBuffer.ColorKind, cols);
    this.place(plinth, x, z, { y: lo - 0.6 + (hi - lo + 0.6) / 2 });
    const st = g.props.liftStation();
    this.place(st, x, z, { y: hi - 0.05, rot: Math.PI / 2 });
    this.solid(x, z, 5.2, hi - lo + 1.35, 4.2, lo - 0.6);
    return hi + 1.4;
  }

  private buildLift() {
    const g = this.game;
    const p = g.props;
    // Stations at both ends; the boarding spot is the glowing pad in front of the bottom one.
    this.station(LIFT_X - 4.5, LIFT_A - 1);
    const topDeck = this.station(LIFT_X - 4.5, LIFT_B + 1);
    this.gift(
      LIFT_X - 8,
      LIFT_B + 1,
      1.6,
      Math.max(0.4, topDeck - terrain(LIFT_X - 8, LIFT_B + 1) - 0.7),
      1.6,
      2,
      terrain(LIFT_X - 8, LIFT_B + 1),
    );
    const pad = this.aura(new Vector3(LIFT_X, terrain(LIFT_X, LIFT_A) + 0.1, LIFT_A), "gold", {
      ringSize: 2.2,
      spread: 1.2,
    });
    pad.height = 0.6;
    // Towers along the line.
    for (let z = LIFT_A + 16; z < LIFT_B - 4; z += 18) {
      const ty = terrain(LIFT_X + 1.2, z);
      const tower = g.protoClone("liftTower", () => p.liftTower(7));
      this.place(tower, LIFT_X + 1.2, z, { y: ty });
      this.solid(LIFT_X + 1.2, z, 0.7, 7, 0.7, ty);
    }
    // Candies along the cable: you grab them on the way up.
    for (let z = LIFT_A + 12; z < LIFT_B - 8; z += 14) this.candy(LIFT_X, liftHeight(z) + 0.9, z);

    // Chairs loop up (left cable) and down (right cable). Decoration only:
    // you board by standing on the pad, and a chair picks you up.
    const length = LIFT_B - LIFT_A;
    const count = Math.floor(length / 11);
    for (let i = 0; i < count; i++) {
      const up = g.protoClone(`chair${i % 4}`, () => p.liftChair(i % 4));
      up.parent = g.levelRoot;
      this.decorChairs.push({ mesh: up, t: i / count, dir: 1 });
      const down = g.protoClone(`chair${(i + 2) % 4}`, () => p.liftChair((i + 2) % 4));
      down.parent = g.levelRoot;
      this.decorChairs.push({ mesh: down, t: (i + 0.5) / count, dir: -1 });
    }
    this.updateLift(0);
    // Standing on the pad (any time after the basin is clear) calls a chair.
    this.trigger(LIFT_X, LIFT_A, 2.2, () => this.board(), false);
  }

  private liftPos(t: number) {
    const z = LIFT_A + (LIFT_B - LIFT_A) * t;
    return new Vector3(LIFT_X, liftHeight(z), z);
  }

  private updateLift(dt: number) {
    const step = (LIFT_SPEED * dt) / (LIFT_B - LIFT_A);
    for (const c of this.decorChairs) {
      c.t = (c.t + step * c.dir + 1) % 1;
      const pos = this.liftPos(c.t);
      c.mesh.position.set(pos.x + (c.dir > 0 ? 0 : 2.6), pos.y + (c.dir > 0 ? 0 : 0.2), pos.z);
      // Chairs face the way they travel (backrest behind the rider).
      c.mesh.rotation.y = c.dir > 0 ? 0 : Math.PI;
      const ends = c.t < 0.02 || c.t > 0.98;
      // Never two chairs on top of each other: the empty chair next to Santa's steps aside.
      const nearSanta =
        this.riding !== null && c.dir > 0 && Math.abs(c.t - this.riding.t) * (LIFT_B - LIFT_A) < 8;
      c.mesh.setEnabled(!ends && !nearSanta);
    }
    // Santa's own chair.
    const r = this.riding;
    if (r) {
      r.t = Math.min(1, r.t + step);
      const pos = this.liftPos(r.t);
      r.chair.position.copyFrom(pos);
      if (r.t >= 1) this.arriveTop();
    }
  }

  /** Called when Santa stands on the boarding pad. */
  private board() {
    const g = this.game;
    const pl = g.player;
    if (!this.arenaDone || this.riding || pl.seated || pl.dead) return;
    const chair = g.props.liftChair(1);
    chair.parent = g.levelRoot;
    chair.rotation.y = 0;
    this.riding = { chair, t: 0 };
    this.updateLift(0);
    sound.pickup();
    g.fx.sparkle(chair.position.add(new Vector3(0, 0.5, 0)), 20);
    pl.mount(() =>
      this.riding ? this.riding.chair.position.add(new Vector3(0, -0.05, 0.1)) : pl.body.position,
    );
    g.objective(OBJ.rideLift);
    this.onBoard();
  }

  /** Hook: first ride up gets an ambush. */
  private onBoard: () => void = () => {};

  private arriveTop() {
    const g = this.game;
    const r = this.riding;
    if (!r) return;
    this.riding = null;
    g.player.dismount();
    // Step off onto the top station's deck.
    g.player.body.position.set(LIFT_X - 4.5, terrain(LIFT_X - 4.5, LIFT_B + 1) + 3, LIFT_B + 1);
    r.chair.dispose();
    sound.land(false);
    this.afterLift?.();
  }

  async run() {
    const g = this.game;
    this.startTime = g.time;
    const cp = this.startCheckpoint;

    // The tube at the start: after the first run you can slide down again any time.
    const tz = START.z;
    this.tube = g.props.snowTube();
    this.place(this.tube, centerX(tz), tz, { y: terrain(centerX(tz), tz) + 0.3 });
    this.trigger(
      centerX(tz),
      tz,
      1.8,
      () => {
        if (this.firstSlideDone && !g.player.ride && !g.player.seated) void this.slide(false);
      },
      false,
    );

    if (cp === 0) {
      g.tip(LINES.level3Intro);
      const cx = -5;
      const cz = 104;
      g.objective(OBJ.getSmg, new Vector3(cx, terrain(cx, cz) + 0.6, cz));
      await new Promise<void>((resolve) => {
        this.pickup(
          g.props.weaponCrate(),
          new Vector3(cx, terrain(cx, cz), cz),
          () => {
            g.player.giveGun("smg");
            sound.pickup();
            g.toast(T.newWeapon, WEAPON_NAMES.smg);
            resolve();
          },
          1.2,
        );
      });
      g.objective(OBJ.jumpInTube, new Vector3(centerX(tz), terrain(centerX(tz), tz) + 0.8, tz));
      g.tip(LINES.level3Tube);
      await new Promise<void>((resolve) => this.trigger(centerX(tz), tz, 1.8, resolve));
      await this.slide(true);
    } else {
      this.firstSlideDone = true;
    }

    if (cp <= 1) {
      // The basin at the bottom.
      g.objective(OBJ.clearBottom);
      if (cp === 1) await g.wait(1);
      g.tip(LINES.level3Bottom);
      await this.wave([
        [ELF_BASIC, 4],
        [ELF_SPRINTER, 2],
      ]);
      this.health(-8, -70, true);
      this.buff("rage", 4, -80);
      await g.wait(1.5);
      await this.wave([
        [ELF_THROWER, 2],
        [ELF_SPRINTER, 3],
        [ELF_BASIC, 2],
      ]);
      await g.wait(1);
      this.arenaDone = true;
      // Throwers wait along the lift line for the first ride up.
      let ambushed = false;
      this.onBoard = () => {
        if (ambushed) return;
        ambushed = true;
        g.tip(LINES.level3LiftRide);
        for (const z of [-30, 0, 30, 60]) {
          const x = LIFT_X - 11;
          g.enemies.spawn(new Vector3(x, terrain(x, z), z), { tuning: ELF_THROWER, perched: true });
        }
      };
      g.objective(OBJ.takeLift, new Vector3(LIFT_X, terrain(LIFT_X, LIFT_A) + 1, LIFT_A));
      g.tip(LINES.level3Lift);
      await new Promise<void>((resolve) => {
        this.afterLift = resolve;
      });
      this.reachCheckpoint(2);
    } else {
      this.arenaDone = true;
    }

    // At the top: the exit is open; the tubes are there for another run.
    this.afterLift = () => g.objective(OBJ.enterChimney, this.exit?.pos);
    this.openExit();
    g.objective(OBJ.enterChimney, this.exit?.pos);
    g.tip(LINES.level3Top);
  }

  /** A tube run. The first one has throwers along the slope; it ends in the basin. */
  private async slide(first: boolean) {
    const g = this.game;
    const tube = this.tube as Mesh;
    const p = g.player;
    const tz = START.z;
    g.objective(OBJ.slide);
    p.body.position.set(centerX(tz), terrain(centerX(tz), tz), tz);
    if (first) {
      // Throwers along the run, one every few frames: building eight at once is a hitch.
      const throwers = [
        [84, 1],
        [66, -1],
        [44, 1],
        [30, -1],
        [10, 1],
        [-14, -1],
        [-36, 1],
        [-50, -1],
      ] as const;
      throwers.forEach(([z, side], i) => {
        g.after(i * 0.05, () => {
          const x = centerX(z) + side * 11.5;
          g.enemies.spawn(new Vector3(x, terrain(x, z), z), {
            tuning: ELF_THROWER,
            perched: true,
            yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2,
          });
        });
      });
      g.after(2.5, () => g.tip(LINES.level3CoalTip));
    }
    await new Promise<void>((resolve) => {
      const track: RideTrack = {
        centerX,
        slopeX,
        halfWidth: 6.5,
        lips: LIPS,
        endZ: BOTTOM_Z - 6,
        onEnd: resolve,
      };
      p.startRide(track, tube);
    });
    // Put the tube back at the top for the next run.
    this.place(tube, centerX(tz), tz, { y: terrain(centerX(tz), tz) + 0.3 });
    tube.rotation.setAll(0);
    if (first) {
      this.firstSlideDone = true;
      this.reachCheckpoint(1);
    } else {
      g.objective(OBJ.takeLiftBack, new Vector3(LIFT_X, terrain(LIFT_X, LIFT_A) + 1, LIFT_A));
      this.afterLift = () => g.objective(OBJ.enterChimney, this.exit?.pos);
    }
  }

  /** Elves burst out of evil gifts around the basin. Resolves when they're all dead. */
  private async wave(groups: [ElfTuning, number][]) {
    const g = this.game;
    let n = 0;
    for (const [tuning, count] of groups) {
      for (let i = 0; i < count; i++, n++) {
        const a = n * 2.4;
        const r = tuning.ranged ? 15 : 9;
        g.enemies.spawnFromGift(
          new Vector3(ARENA.x + Math.cos(a) * r, 0, ARENA.z + Math.sin(a) * r),
          tuning,
        );
        await g.wait(0.35);
      }
    }
    const hostile = (e: Elf) => e.alive && !e.perched;
    while (
      g.enemies.elves.some(hostile) ||
      g.enemies.aliveCount > g.enemies.elves.filter((e) => e.alive).length
    ) {
      await g.wait(0.3);
    }
  }

  override tick(dt: number) {
    this.updateLift(dt);
  }

  private async finish() {
    const g = this.game;
    g.player.frozen = true;
    g.cinematic(true);
    await g.say(LINES.level3Done);
    g.cinematic(false);
    await this.diveIntoChimney();
    await g.completeLevel();
  }
}
