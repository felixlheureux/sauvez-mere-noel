import { type Mesh, MeshBuilder, Vector3, VertexBuffer } from "@babylonjs/core";
import { color } from "../assets/Palette";
import { sound } from "../audio/Sound";
import { clamp, mulberry32, randRange, smoothstep } from "../core/math";
import { ELF_BASIC, ELF_SPRINTER, type ElfTuning, SNOWMAN } from "../enemies/Elf";
import { LINES, OBJ, T, WEAPON_NAMES } from "../i18n/fr-QC";
import { MOODS } from "../world/Environment";
import { Level } from "../world/Level";

type Seg = readonly [ax: number, az: number, bx: number, bz: number];

/** Walkable corridors through the forest (trees are kept out of these). */
const PATHS: Seg[] = [
  [0, -58, 0, -34], // from the car to the fork
  [0, -34, -10, -26], // west path: short and dangerous
  [-10, -26, -9, -12],
  [-9, -12, -10, -6],
  [0, -34, 13, -30], // east path: longer, more loot
  [13, -30, 18, -17],
  [18, -17, 12, -5],
  [18, -21, 26, -24], // hidden glade
  [-10, -7, 12, -6], // south bank
  [-10, 3, 0, 14], // north side
  [12, 8, 0, 14],
  [0, 14, 0, 34], // up the hill
  [-16, -18, -10, -20], // stump nook
];
const CLEARING = new Vector3(0, 0, 42);
const WEST_BRIDGE_X = -10;
const EAST_BRIDGE_X = 12;

const creekZ = (x: number) => 3 * Math.sin(x * 0.12);

function segDist(x: number, z: number, [ax, az, bx, bz]: Seg) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

function pathDist(x: number, z: number) {
  let d = Number.POSITIVE_INFINITY;
  for (const s of PATHS) d = Math.min(d, segDist(x, z, s));
  return Math.min(d, Math.hypot(x - CLEARING.x, z - CLEARING.z) - 11);
}

/** Rolling hills, a creek ravine and a rise toward the clearing (exact, slow). */
function terrainExact(x: number, z: number) {
  const hills =
    1.3 * Math.sin(x * 0.08) * Math.cos(z * 0.06) +
    0.8 * Math.sin(x * 0.15 + z * 0.05) +
    0.5 * Math.cos(z * 0.12);
  const flat = smoothstep(clamp((pathDist(x, z) - 1) / 6, 0, 1));
  const rise = clamp((z - 8) * 0.14, 0, 4);
  const walls =
    Math.max(0, Math.abs(x) - 27) * 0.7 + Math.max(0, -z - 57) * 0.8 + Math.max(0, z - 54) * 0.8;
  const creek = 2.6 * smoothstep(clamp(1 - Math.abs(z - creekZ(x)) / 4.5, 0, 1));
  return hills * (0.25 + 0.75 * flat) + rise + walls - creek;
}

/** The heightmap is sampled once into a grid; physics reads it with bilinear filtering. */
const GRID = { x0: -64, z0: -76, step: 0.5, nx: 257, nz: 297 };
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

/**
 * Niveau 2 — La Forêt de Sapins Hantés.
 * Where families used to cut their Christmas tree. Fog hides the elves until
 * you light the lanterns; gifts under the trees can be unwrapped for loot.
 */
export class Level2 extends Level {
  readonly id = 2;
  readonly name = "La Forêt de Sapins Hantés";
  readonly mood = MOODS.forest;
  override darkness = 2;
  override arenaRadius = 70;
  override bellsTotal = 3;
  override newGun = "shotgun" as const;
  override theme = "silent" as const;
  private ambient = 3;

  build() {
    const g = this.game;
    const p = g.props;
    const rand = mulberry32(21);
    g.physics.terrain = terrain;
    g.physics.boundsCenter.set(0, 0, -2);
    this.spawnPos = new Vector3(0, terrain(0, -54), -54);
    this.spawnYaw = 0;

    this.place(this.buildTerrainMesh(), 0, 0, { shadow: false });
    this.place(p.mountains(110, 13), 0, 0, { shadow: false });
    g.env.setMoon(true, "#dfe8ff");

    // Log bridges over the creek.
    for (const bx of [WEST_BRIDGE_X, EAST_BRIDGE_X]) {
      const cz = creekZ(bx);
      const top = Math.max(terrain(bx, cz - 5.5), terrain(bx, cz + 5.5));
      for (let i = -1; i <= 1; i++) {
        const log = g.protoClone("bridgeLog", () => p.log(11, 0.55));
        log.rotation.y = Math.PI / 2;
        this.place(log, bx + i * 0.56, cz, { y: top - 0.25 });
      }
      this.solid(bx, cz, 1.9, 0.3, 11, top - 0.3);
    }

    // The car, the tree-lot shed and the first lantern.
    this.place(p.familyCar(), 6, -55, { y: terrain(6, -55), rot: 0.25 });
    this.solidRotated(6, -55, 2.4, 1.6, 4.4, terrain(6, -55), 0.25);
    const shedY = terrain(-9.5, -50);
    this.place(p.treeLotShed(), -9.5, -50, { y: shedY, rot: Math.PI / 2 });
    this.solid(-11.4, -50, 0.3, 3, 6, shedY);
    this.solid(-9.5, -52.9, 4, 3, 0.3, shedY);
    this.solid(-9.5, -47.1, 4, 3, 0.3, shedY);
    this.bell(-10.4, shedY + 1, -50);

    // The giant dead tree (landmark) and the hunter's cabin chimney (exit).
    const ty = terrain(CLEARING.x, CLEARING.z + 4);
    this.place(p.deadTree(), CLEARING.x, CLEARING.z + 4, { y: ty - 0.3 });
    this.solid(CLEARING.x, CLEARING.z + 4, 2.4, 14, 2.4, ty);
    const ex = 9;
    const ez = 49;
    this.exitChimney(ex, ez, () => void this.finish());

    // Stump with a bell, reached by stacked logs.
    const sy = terrain(-17, -18);
    this.place(p.stump(3.2, 1.6), -17, -18, { y: sy });
    this.solid(-17, -18, 1.5, 3.2, 1.5, sy);
    [
      [-14.4, -19.2, 0.9],
      [-15.2, -17, 1.8],
      [-16.2, -15.6, 2.6],
    ].forEach(([x, z, h]) => {
      const y = terrain(x as number, z as number);
      const log = g.protoClone("stepLog", () => p.log(1.8, 0.7));
      this.place(log, x as number, z as number, { y: y + (h as number) - 0.35 });
      this.solid(x as number, z as number, 1.8, h as number, 0.9, y);
    });
    this.bell(-17, sy + 3.9, -18);
    // Under the east bridge, on the ice.
    this.bell(
      EAST_BRIDGE_X + 1.6,
      terrain(EAST_BRIDGE_X + 1.6, creekZ(EAST_BRIDGE_X + 1.6)) + 0.9,
      creekZ(EAST_BRIDGE_X + 1.6),
    );

    // Lanterns: the start, the creek (checkpoint 1), the hill (checkpoint 2) + path lights.
    this.addCheckpoint(0, -54, 0);
    this.addCheckpoint(0, -10, 0);
    this.addCheckpoint(2, 20, 0);
    this.lantern(2.4, -50);
    this.lantern(1.6, -9, () => this.reachCheckpoint(1));
    this.lantern(2.6, 22, () => this.reachCheckpoint(2));
    for (const [x, z] of [
      [-11, -29],
      [-7.5, -16],
      [15, -27],
      [16, -12],
      [24, -23],
      [-6, 8],
      [7, 10],
      [-3, 32],
      [-8, 46],
      [7, 44],
    ] as const) {
      this.lantern(x, z);
    }

    // The forest: dense trees everywhere except the paths, creek and clearing.
    const trees: [number, number, number][] = [];
    for (let x = -40; x <= 40; x += 4.2) {
      for (let z = -64; z <= 60; z += 4.2) {
        const tx = x + randRange(rand, -1.6, 1.6);
        const tz = z + randRange(rand, -1.6, 1.6);
        if (pathDist(tx, tz) < 3.6) continue;
        if (Math.abs(tz - creekZ(tx)) < 4.2) continue;
        trees.push([tx, tz, randRange(rand, 0.85, 1.35)]);
      }
    }
    this.forest(trees, 5);

    // Gifts left under trees: unwrap them.
    const lootSpots: [number, number][] = [
      [-3, -44],
      [3.5, -40],
      [-12, -23],
      [11, -29],
      [17, -21],
      [20, -14],
      [27, -26],
      [25, -22],
      [-5, 12],
      [5, 18],
      [-4, 28],
      [6, 38],
    ];
    lootSpots.forEach(([x, z], i) => {
      this.lootGift(x, z, i);
    });

    // Rewards off the main path.
    this.buff("shield", 27.5, -24.5);
    this.health(-9.5, -14);
    this.health(-6, 37, true);
    this.buff("speed", 3, -30);

    // Candy trails along each route.
    this.candyLine(0, -50, 0, -36, 5);
    this.candyLine(-2, -33, -9, -27, 3);
    this.candyLine(-9.5, -24, -9, -13, 4);
    this.candyLine(3, -33, 12, -30, 3);
    this.candyLine(14, -28, 18, -18, 4);
    this.candyLine(18, -21, 25, -23.5, 3);
    this.candyLine(-6, 6, -1, 12, 3);
    this.candyLine(0, 16, 0, 30, 5);
    this.candyRing(CLEARING.x, CLEARING.z, 7, 8);
  }

  /** Low-poly heightmap with vertex colors: snow, darker paths, icy creek banks. */
  private buildTerrainMesh() {
    const g = this.game;
    const ground = MeshBuilder.CreateGround(
      "forestGround",
      { width: 120, height: 140, subdivisions: 70, updatable: true },
      g.scene,
    );
    ground.position.z = -2;
    const pos = ground.getVerticesData(VertexBuffer.PositionKind) as Float32Array;
    const colors = new Float32Array((pos.length / 3) * 4);
    const snow = color("snow");
    const shade = color("snowShade");
    const ice = color("ice");
    const rand = mulberry32(9);
    for (let i = 0; i < pos.length / 3; i++) {
      const x = pos[i * 3] as number;
      const z = (pos[i * 3 + 2] as number) - 2;
      pos[i * 3 + 1] = terrain(x, z);
      const onPath = pathDist(x, z) < 2.2;
      const nearCreek = Math.abs(z - creekZ(x)) < 3;
      const c = nearCreek ? ice : onPath ? shade : rand() < 0.3 ? shade : snow;
      colors.set([c.r, c.g, c.b, 1], i * 4);
    }
    ground.updateVerticesData(VertexBuffer.PositionKind, pos);
    ground.setVerticesData(VertexBuffer.ColorKind, colors);
    ground.convertToFlatShadedMesh();
    ground.material = g.mats.toon;
    ground.receiveShadows = true;
    ground.isPickable = false;
    return ground as Mesh;
  }

  override isIcy(pos: Vector3) {
    return Math.abs(pos.z - creekZ(pos.x)) < 2.2 && pos.y < terrain(pos.x, pos.z) + 0.3;
  }

  async run() {
    const g = this.game;
    this.startTime = g.time;
    const cp = this.startCheckpoint;

    // Lanterns behind the checkpoint are already lit.
    if (cp >= 1) {
      for (const l of this.lanterns) if (l.lamp.z < (cp >= 2 ? 23 : -8)) this.lightLantern(l, true);
    }

    if (cp === 0) {
      g.objective(OBJ.openGift, new Vector3(3.5, terrain(3.5, -51.5) + 0.6, -51.5));
      g.tip(LINES.level2Intro);
      const crate = g.props.weaponCrate();
      const cx = 3.5;
      const cz = -51.5;
      this.pickup(
        crate,
        new Vector3(cx, terrain(cx, cz), cz),
        () => {
          g.player.giveGun("shotgun");
          sound.pump();
          g.toast(T.newWeapon, WEAPON_NAMES.shotgun);
          g.tip(LINES.level2Gun);
          g.objective(OBJ.crossForest, new Vector3(1.6, terrain(1.6, -9) + 1.5, -9));
          g.after(5, () => g.tip(LINES.level2Lantern));
        },
        1.2,
      );

      this.trigger(0, -36, 4, () => g.tip(LINES.level2Fork));
      this.trigger(-1, -44, 4, () => g.tip(LINES.level2Loot));
      // West path: a sprinter pack jumps out of the fog.
      this.trigger(-9.5, -22, 6, () => {
        g.tip(LINES.level2Sprinters);
        this.pack(new Vector3(-9, 0, -11), 3, ELF_SPRINTER);
        this.pack(new Vector3(-8, 0, -31), 2, ELF_SPRINTER);
      });
      // East path: a few slower elves among the loot.
      this.trigger(15.5, -25, 6, () => {
        this.pack(new Vector3(18, 0, -14), 2, ELF_BASIC);
        this.pack(new Vector3(26, 0, -24), 1, ELF_BASIC);
      });
    } else {
      if (cp >= 2)
        g.objective(
          OBJ.reachTree,
          new Vector3(CLEARING.x, terrain(CLEARING.x, CLEARING.z) + 2, CLEARING.z),
        );
      else g.objective(OBJ.crossForest, new Vector3(1.6, terrain(1.6, -9) + 1.5, -9));
    }

    if (cp <= 1) {
      // The creek: a mutant snowman guards the crossing.
      this.trigger(0, -8, 8, () => {
        g.objective(OBJ.lightLanterns, new Vector3(2.6, terrain(2.6, 22) + 1.7, 22));
        this.pack(new Vector3(0, 0, 9), 1, SNOWMAN);
        this.pack(new Vector3(-12, 0, 6), 2, ELF_BASIC);
        this.pack(new Vector3(12, 0, 11), 2, ELF_BASIC);
        g.after(1.5, () => g.tip(LINES.level2Snowman));
      });
      // The hill: sprinters from both sides.
      this.trigger(0, 15, 5, () => {
        g.objective(
          OBJ.reachTree,
          new Vector3(CLEARING.x, terrain(CLEARING.x, CLEARING.z) + 2, CLEARING.z),
        );
        this.pack(new Vector3(-9, 0, 24), 3, ELF_SPRINTER);
        this.pack(new Vector3(9, 0, 26), 3, ELF_SPRINTER);
      });
    }

    // The clearing: the final ambush in two waves.
    await new Promise<void>((resolve) => this.trigger(0, 32, 5, resolve));
    g.tip(LINES.level2Clearing);
    g.objective(OBJ.survivedClearing);
    this.pack(new Vector3(-8, 0, 46), 3, ELF_SPRINTER);
    this.pack(new Vector3(8, 0, 47), 2, ELF_SPRINTER);
    this.pack(new Vector3(0, 0, 50), 3, ELF_BASIC);
    while (g.enemies.aliveCount > 0) await g.wait(0.3);
    await g.wait(1.2);
    this.pack(new Vector3(0, 0, 52), 1, SNOWMAN);
    this.pack(new Vector3(-10, 0, 40), 2, ELF_SPRINTER);
    this.pack(new Vector3(10, 0, 40), 2, ELF_SPRINTER);
    while (g.enemies.aliveCount > 0) await g.wait(0.3);
    await g.wait(0.8);
    this.openExit();
    g.objective(OBJ.enterChimney, this.exit?.pos);
  }

  /** Elves step out of the fog around `at`, already hunting. */
  private pack(at: Vector3, count: number, tuning: ElfTuning) {
    const g = this.game;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = count > 1 ? 1.6 : 0;
      const pos = new Vector3(at.x + Math.cos(a) * r, 0, at.z + Math.sin(a) * r);
      pos.y = terrain(pos.x, pos.z);
      const ppos = g.player.body.position;
      const elf = g.enemies.spawn(pos, { tuning, yaw: Math.atan2(ppos.x - pos.x, ppos.z - pos.z) });
      elf.aggro = true;
      elf.setState("chase");
    }
    if (tuning.kind === "sprinter") sound.giggle();
    else sound.growl();
  }

  override tick(dt: number) {
    // Ambience: clumps of snow falling off branches, an owl now and then.
    this.ambient -= dt;
    if (this.ambient <= 0) {
      this.ambient = 1.2 + Math.random() * 2;
      const ppos = this.game.player.body.position;
      const a = Math.random() * Math.PI * 2;
      const x = ppos.x + Math.cos(a) * randRange(Math.random, 4, 10);
      const z = ppos.z + Math.sin(a) * randRange(Math.random, 4, 10);
      this.game.fx.puff(new Vector3(x, terrain(x, z) + 4.5, z), "snow", 10, 0.8);
      if (Math.random() < 0.15) sound.owl();
      else if (Math.random() < 0.2) sound.creak();
    }
  }

  private async finish() {
    const g = this.game;
    // Talk first (Santa standing on the chimney), then down he goes.
    g.player.frozen = true;
    g.cinematic(true);
    await g.say(LINES.level2Done);
    g.cinematic(false);
    await this.diveIntoChimney();
    await g.completeLevel();
  }
}
