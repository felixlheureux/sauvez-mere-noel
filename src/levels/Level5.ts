import { type Mesh, MeshBuilder, Vector3, VertexBuffer } from "@babylonjs/core";
import { color } from "../assets/Palette";
import { rinkSegments } from "../assets/props";
import { sound } from "../audio/Sound";
import { mulberry32, randRange } from "../core/math";
import { ELF_BASIC, ELF_SKATER, type ElfTuning } from "../enemies/Elf";
import { Zamboni } from "../enemies/Zamboni";
import { LINES, OBJ, T, WEAPON_NAMES } from "../i18n/fr-QC";
import { MOODS } from "../world/Environment";
import { Level } from "../world/Level";
import type { Collider } from "../world/Physics";

/** The rink: an ellipse north of the lake. Its gate faces the lake (south). */
const RINK = { cx: 0, cz: 22, rx: 26, rz: 14 };
const GATE_Z = RINK.cz - RINK.rz;
const WATER = -2.2;

interface Circle {
  x: number;
  z: number;
  r: number;
}

/** Snowy patches on the lake: grip, and where the fishing huts stand. */
const SNOW: Circle[] = [
  { x: 0, z: -88, r: 7 },
  { x: -12, z: -70, r: 4 },
  { x: 13, z: -58, r: 4 },
  { x: -14, z: -40, r: 4 },
  { x: 12, z: -26, r: 4 },
  { x: -15, z: -12, r: 4 },
  { x: 0, z: -2, r: 7.5 },
];
/** Phase 2: the rink breaks into these floating slabs. */
const ISLANDS: Circle[] = [
  { x: 0, z: 22, r: 6 },
  { x: 15, z: 22, r: 4 },
  { x: -15, z: 22, r: 4 },
  { x: 7.5, z: 29.8, r: 4 },
  { x: -7.5, z: 29.8, r: 4 },
  { x: 7.5, z: 14.2, r: 4 },
  { x: -7.5, z: 14.2, r: 4 },
  { x: 0, z: 33.2, r: 2.2 },
  { x: 0, z: 10.6, r: 2.2 },
];

// Terrain state (module-level so the physics callback stays cheap).
let phase2 = false;
const holes: Circle[] = [];
/** Phase 2: discs of fresh ice the resurfacer lays over the water. */
const bridges: Circle[] = [];

const inside = (c: Circle, x: number, z: number) => (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r;
const inRink = (x: number, z: number, k = 1) =>
  ((x - RINK.cx) / RINK.rx) ** 2 + ((z - RINK.cz) / RINK.rz) ** 2 < k * k;

function terrain(x: number, z: number) {
  // Snowbanks rise along the shores; the lake itself is flat ice.
  let h =
    Math.max(0, Math.abs(x) - 23) * 0.55 +
    Math.max(0, -z - 91) * 0.9 +
    Math.max(0, z - 47) * 0.9 +
    Math.max(0, Math.abs(x) - 31) * 1.5;
  // Snow drifts dotted around the shore.
  h += Math.max(0, 1 - Math.hypot(x + 20, z + 52) / 4) * 1.2;
  h += Math.max(0, 1 - Math.hypot(x - 20, z + 36) / 4) * 1.2;
  // The rink itself is dead flat right up to its boards.
  if (inRink(x, z, 1.03)) h = 0;
  if (h > 0.01) return h;
  for (const c of holes) if (inside(c, x, z)) return WATER;
  if (phase2 && inRink(x, z)) {
    for (const c of ISLANDS) if (inside(c, x, z)) return 0;
    for (const c of bridges) if (inside(c, x, z)) return 0;
    return WATER;
  }
  return 0;
}

interface Crack extends Circle {
  mesh: Mesh;
  hole: Mesh;
  t: number;
  broken: number;
}

/**
 * Niveau 5 — La Patinoire Gelée (Boss 1).
 * Across a frozen lake (momentum, cracking ice, skater elves) to an outdoor rink
 * where a possessed ice resurfacer waits. Halfway through, it smashes the rink
 * into floating islands.
 */
export class Level5 extends Level {
  readonly id = 5;
  readonly name = "La Patinoire Gelée";
  readonly mood = MOODS.rink;
  override darkness = 5;
  override arenaRadius = 110;
  override newGun = "launcher" as const;
  override theme = "anges" as const;
  override killY = -1;
  private zamboni: Zamboni | null = null;
  private cracks: Crack[] = [];
  private crackTipShown = false;
  private splashTipShown = false;
  private readonly lastSafe = new Vector3(0, 0, -86);
  private rinkFloor: Mesh | null = null;
  private islandMeshes: Mesh[] = [];
  private rinkNets: Mesh[] = [];
  private netColliders: Collider[] = [];
  private iceBridge: (Circle & { mesh: Mesh; life: number; cracked: boolean })[] = [];
  private gate: { mesh: Mesh; collider: Collider } | null = null;
  private bossDone: (() => void) | null = null;

  build() {
    const g = this.game;
    const p = g.props;
    phase2 = false;
    holes.length = 0;
    bridges.length = 0;
    const rand = mulberry32(55);
    g.physics.terrain = terrain;
    g.env.setMoon(true, "#e6efff");
    this.spawnPos = new Vector3(0, 0, -86);
    this.spawnYaw = 0;

    this.place(this.buildTerrainMesh(), 0, -22, { shadow: false });
    this.place(p.mountains(140, 7), 0, -20, { shadow: false });
    this.addCheckpoint(0, -86, 0);
    this.addCheckpoint(0, -3, 0);

    this.buildLake(rand);
    this.buildRink();

    // Pines on the shores.
    const pines: [number, number, number][] = [];
    for (let z = -96; z <= 56; z += 3.6) {
      for (const x of [-34, -30, 30, 34]) {
        pines.push([
          x + randRange(rand, -1.4, 1.4),
          z + randRange(rand, -1.2, 1.2),
          randRange(rand, 0.9, 1.5),
        ]);
      }
    }
    for (let x = -26; x <= 26; x += 4) {
      pines.push([
        x + randRange(rand, -1, 1),
        52 + randRange(rand, -1, 2),
        randRange(rand, 1, 1.4),
      ]);
      pines.push([
        x + randRange(rand, -1, 1),
        -95 + randRange(rand, -1, 1),
        randRange(rand, 1, 1.4),
      ]);
    }
    this.forest(pines, 12);
  }

  // ---------- Building ----------

  private buildLake(rand: () => number) {
    const g = this.game;
    const p = g.props;
    // Fishing huts on their snow patches, open side toward the middle of the lake.
    const huts: [number, number, number][] = [
      [-12, -70, 0],
      [13, -58, 1],
      [-14, -40, 2],
      [12, -26, 3],
      [-15, -12, 4],
    ];
    for (const [x, z, c] of huts) this.hut(x, z, x < 0 ? -Math.PI / 2 : Math.PI / 2, c);
    // Crates to climb on the roofs; health up there.
    this.gift(-9.4, -72.2, 1.4, 1.3, 1.4, 1);
    this.health(-12, -70, false, 2.5);
    this.gift(10.4, -24, 1.4, 1.3, 1.4, 3);
    this.health(12, -26, true, 2.5);
    this.candyLine(-13, -71, -11, -69, 2, 3.2);
    // Bell 1: inside a fishing hut.
    this.bell(13.6, 1, -58);

    // Cracking ice along the way.
    const cracks: Circle[] = [
      { x: 0, z: -62, r: 3 },
      { x: -5, z: -49, r: 2.6 },
      { x: 6, z: -37, r: 3 },
      { x: -2, z: -22, r: 2.6 },
      { x: 8, z: -66, r: 2.4 },
      { x: -8, z: -30, r: 2.4 },
    ];
    cracks.forEach((c, i) => {
      const mesh = p.crackedIce(c.r, i + 3);
      this.place(mesh, c.x, c.z, { shadow: false });
      const hole = p.iceHole(c.r, i + 3);
      this.place(hole, c.x, c.z, { y: 0.04, shadow: false });
      hole.setEnabled(false);
      this.cracks.push({ ...c, mesh, hole, t: 0, broken: 0 });
      // Risky candies on the cracks.
      this.candyRing(c.x, c.z, c.r * 0.5, 4, 0.7);
    });

    // Candies across the lake.
    for (let z = -80; z < -6; z += 6) this.candy(Math.sin(z * 0.15) * 6, 0.8, z);
    this.lootGift(-6, -78, 2);
    this.lootGift(18, -44, 4);
    this.lootGift(-19, -24, 1);
    this.buff("speed", 16, -72);
    this.health(-4, -34);
    this.buff("shield", 4, -6);
    this.snowGlobe(0, -44);

    // A few snowmen and nets for decoration.
    this.place(p.hockeyNet(), -6, -60, { rot: 0.4 });
    this.solid(-6, -60.3, 1.8, 1.25, 1.2);
    this.place(p.hockeyNet(), 7, -46, { rot: Math.PI - 0.3 });
    this.solid(7, -45.7, 1.8, 1.25, 1.2);
    for (const [x, z] of [
      [-20, -80],
      [20, -64],
      [-21, -6],
    ] as const) {
      this.place(
        g.protoClone("snowman", () => p.snowman()),
        x,
        z,
        { y: terrain(x, z), rot: rand() * 6 },
      );
      this.solid(x, z, 1.2, 2.2, 1.2, terrain(x, z));
    }

    // The checkpoint lantern by the rink gate.
    const gateLantern = this.lantern(4, -3, () => this.reachCheckpoint(1));
    this.trigger(0, -3, 4, () => this.lightLantern(gateLantern));
  }

  /** A fishing hut: walls with an open front, and a roof you can stand on. */
  private hut(x: number, z: number, rot: number, colorway: number) {
    const p = this.game.props;
    this.place(p.fishingHut(colorway), x, z, { rot });
    // Local boxes (cx, cz, w, d) → world, for 90° rotations.
    const c = Math.round(Math.cos(rot));
    const s = Math.round(Math.sin(rot));
    const box = (lx: number, lz: number, w: number, h: number, d: number, y = 0) => {
      const wx = x + lx * c + lz * s;
      const wz = z - lx * s + lz * c;
      const swap = Math.abs(s) === 1;
      this.solid(wx, wz, swap ? d : w, h, swap ? w : d, y);
    };
    box(0, 1.3, 2.6, 2.2, 0.2);
    box(-1.3, 0, 0.2, 2.2, 2.6);
    box(1.3, 0, 0.2, 2.2, 2.6);
    box(-0.95, -1.3, 0.7, 2.2, 0.2);
    box(0.95, -1.3, 0.7, 2.2, 0.2);
    box(0, 0, 3, 0.3, 3, 2.2);
  }

  private buildRink() {
    const g = this.game;
    const p = g.props;
    const { cx, cz, rx, rz } = RINK;
    this.rinkFloor = p.rinkFloor(rx, rz);
    this.place(this.rinkFloor, cx, cz, { shadow: false });
    const n = 56;
    const gapAngle = -Math.PI / 2;
    const gapHalf = 0.12;
    this.place(p.rinkBoards(rx, rz, n, gapAngle, gapHalf), cx, cz);
    // Board colliders, taller than the boards (the plexiglass).
    for (const seg of rinkSegments(rx, rz, n, gapAngle, gapHalf)) {
      const w = Math.abs(seg.len * Math.cos(seg.theta)) + 0.3;
      const d = Math.abs(seg.len * Math.sin(seg.theta)) + 0.3;
      this.solid(cx + seg.x, cz + seg.z, w, 3.4, d);
    }
    // The gate: open until the fight starts.
    const gateMesh = p.rinkGate(4.6);
    this.place(gateMesh, cx, GATE_Z);
    gateMesh.setEnabled(false);
    const gateCol = this.solid(cx, GATE_Z, 4.6, 3.4, 0.6);
    gateCol.enabled = false;
    this.gate = { mesh: gateMesh, collider: gateCol };

    // Nets at both ends.
    this.rinkNets = [
      this.place(p.hockeyNet(), cx - rx + 3.5, cz, { rot: Math.PI / 2 }),
      this.place(p.hockeyNet(), cx + rx - 3.5, cz, { rot: -Math.PI / 2 }),
    ];
    // Solid while the rink is whole (they sink with the ice in phase 2).
    this.netColliders = [
      this.solid(cx - rx + 3.2, cz, 1.2, 1.25, 1.8),
      this.solid(cx + rx - 3.2, cz, 1.2, 1.25, 1.8),
    ];

    // Bleachers on the north side (walk under them from the east end).
    const bz = cz + rz + 1.6;
    const rows = 5;
    this.place(p.bleachers(20, rows), cx, bz);
    for (let r = 0; r < rows; r++) {
      const top = 0.86 + r * 0.8;
      if (r < 2) this.solid(cx, bz + r * 1.1, 20, top, 1.1);
      else this.solid(cx, bz + r * 1.1, 20, 0.14, 1.1, top - 0.14);
    }
    this.solid(cx - 10, bz + 2.2, 0.3, 5, 5.5);
    // Bell 2: under the bleachers.
    this.bell(cx + 7, 0.9, bz + 3.4);
    this.candyLine(cx + 9.5, bz + 3.3, cx + 3, bz + 3.3, 4);
    // The scoreboard behind them; a gift on the top row helps you up. Bell 3 on top.
    const sz = bz + rows * 1.1 + 0.9;
    this.place(p.scoreboard(), cx, sz);
    this.solid(cx - 2.2, sz, 0.3, 5, 0.3);
    this.solid(cx + 2.2, sz, 0.3, 5, 0.3);
    this.solid(cx, sz, 5.2, 2.2, 0.6, 4.6);
    this.gift(cx + 1.5, bz + 4 * 1.1, 1.2, 1.2, 1, 6, 4.06);
    this.bell(cx, 7.5, sz);
    this.candyLine(cx - 6, bz + 2.2, cx + 6, bz + 2.2, 4, 2.6);

    // Floodlights around the rink.
    for (const [x, z, r] of [
      [-30, 8, Math.PI / 4],
      [30, 8, -Math.PI / 4],
      [-30, 36, (Math.PI * 3) / 4],
      [30, 36, (-Math.PI * 3) / 4],
    ] as const) {
      this.place(
        g.protoClone("flood", () => p.floodlight(9)),
        x,
        z,
        { y: terrain(x, z) - 0.2, rot: r },
      );
    }

    this.exitChimney(10, -6, () => void this.finish());
  }

  private buildTerrainMesh() {
    const g = this.game;
    const ground = MeshBuilder.CreateGround(
      "lakeGround",
      { width: 80, height: 160, subdivisionsX: 80, subdivisionsY: 160, updatable: true },
      g.scene,
    );
    const pos = ground.getVerticesData(VertexBuffer.PositionKind) as Float32Array;
    const colors = new Float32Array((pos.length / 3) * 4);
    const snow = color("snow");
    const shade = color("snowShade");
    const ice = color("ice");
    const rand = mulberry32(9);
    for (let i = 0; i < pos.length / 3; i++) {
      const x = pos[i * 3] as number;
      const z = (pos[i * 3 + 2] as number) - 22;
      const h = Math.max(0, terrain(x, z));
      pos[i * 3 + 1] = h;
      const onSnow = h > 0.05 || SNOW.some((c) => inside(c, x, z));
      const c = onSnow ? (rand() < 0.25 ? shade : snow) : ice;
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

  override walkable(x: number, z: number) {
    return terrain(x, z) > -1;
  }

  override isIcy(pos: Vector3) {
    if (pos.y > 0.35 || pos.y < -0.5) return false;
    if (terrain(pos.x, pos.z) > 0.05) return false;
    return !SNOW.some((c) => inside(c, pos.x, pos.z));
  }

  // ---------- Script ----------

  async run() {
    const g = this.game;
    this.startTime = g.time;
    const cp = this.startCheckpoint;
    if (cp >= 1) {
      for (const l of this.lanterns) this.lightLantern(l, true);
      this.lastSafe.set(0, 0, -3);
    }

    if (cp === 0) {
      g.objective(OBJ.getLauncher, new Vector3(2.5, 0.6, -81));
      g.tip(LINES.level5Intro);
      const crate = g.props.weaponCrate();
      await new Promise<void>((resolve) => {
        this.pickup(
          crate,
          new Vector3(2.5, 0, -81),
          () => {
            g.player.giveGun("launcher");
            sound.launcher();
            g.toast(T.newWeapon, WEAPON_NAMES.launcher);
            resolve();
          },
          1.2,
        );
      });
      g.tip(LINES.level5Launcher);
      g.objective(OBJ.crossLake, new Vector3(0, 1.5, -3));

      await this.reachOrPass(0, -74, 8);
      this.pack(new Vector3(0, 0, -58), [
        [ELF_SKATER, 6],
        [ELF_BASIC, 4],
      ]);
      g.tip(LINES.level5Skaters);
      await this.reachOrPass(0, -52, 9);
      this.pack(new Vector3(-4, 0, -36), [
        [ELF_SKATER, 4],
        [ELF_BASIC, 2],
      ]);
      await this.reachOrPass(0, -38, 9);
      g.tip(LINES.level5Globe);
      this.pack(new Vector3(4, 0, -20), [
        [ELF_SKATER, 4],
        [ELF_BASIC, 2],
      ]);
      await this.reachOrPass(0, -6, 5);
      g.tip(LINES.level5Gate);
    }

    // The rink.
    g.objective(OBJ.reachRink, new Vector3(0, 1, GATE_Z + 3.5));
    this.zamboni = new Zamboni(g, RINK, {
      onPhase2: () => this.breakRink(),
      layIce: (x, z) => this.layIce(x, z),
      onLowHp: () => g.tip(LINES.bossLow),
      onDefeat: () => this.bossDone?.(),
    });
    this.boss = this.zamboni;
    await this.reachOrPass(0, GATE_Z + 3.5, 2.5);
    // Lock the gate behind Santa.
    if (this.gate) {
      this.gate.mesh.setEnabled(true);
      this.gate.collider.enabled = true;
      sound.smash();
    }
    g.cinematic(true);
    g.camRig.cut(new Vector3(0, 7, GATE_Z - 4), new Vector3(RINK.cx + 12, 1.5, RINK.cz), 0);
    await g.wait(0.6);
    sound.horn();
    await g.say(LINES.bossIntro);
    g.cinematic(false);
    g.objective(OBJ.beatZamboni, () =>
      this.zamboni?.alive ? this.zamboni.center.add(new Vector3(0, 2.2, 0)) : null,
    );
    this.zamboni.start();
    g.tip(LINES.bossTip);
    await new Promise<void>((resolve) => {
      this.bossDone = resolve;
    });

    // Victory: the rink freezes over again, the northern lights come out.
    await g.wait(1.5);
    for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, e.body.position, "slam", 2);
    this.restoreRink();
    g.cinematic(true);
    await g.say(LINES.bossDefeat);
    g.cinematic(false);
    g.env.setMood(MOODS.aurora, 4);
    this.showAurora();
    if (this.gate) {
      this.gate.mesh.setEnabled(false);
      this.gate.collider.enabled = false;
    }
    this.boss = null;
    await g.wait(2);
    g.tip(LINES.level5Calm);
    this.openExit();
    g.objective(OBJ.leaveRink, this.exit?.pos);
  }

  /** Phase 2: shatter the rink into islands, with elves on them. */
  private breakRink() {
    const g = this.game;
    const p = g.props;
    phase2 = true;
    this.rinkFloor?.setEnabled(false);
    // The nets go under with the broken ice.
    for (const n of this.rinkNets) n.setEnabled(false);
    for (const c of this.netColliders) c.enabled = false;
    const water = p.water(RINK.rx - 0.2, RINK.rz - 0.2, 21);
    this.place(water, RINK.cx, RINK.cz, { y: 0.04, shadow: false });
    this.islandMeshes.push(water);
    ISLANDS.forEach((c, i) => {
      const m = p.iceIsland(c.r, i + 1);
      this.place(m, c.x, c.z, { y: 0.07, shadow: false });
      this.islandMeshes.push(m);
      // The slabs heave and settle as the rink breaks.
      const tilt = (Math.random() - 0.5) * 0.3;
      void g.tween(1.2, (k) => {
        const e = Math.sin(k * Math.PI * 3) * (1 - k);
        m.rotation.x = tilt * e;
        m.rotation.z = -tilt * e;
      });
      g.fx.puff(new Vector3(c.x + c.r, 0.3, c.z), "ice", 12, 1.4);
      g.fx.puff(new Vector3(c.x - c.r, 0.3, c.z), "sky", 10, 1.2);
    });
    g.tip(LINES.bossPhase2);
    g.tip(LINES.bossPhase2Tip);
    // Santa lands on the nearest island.
    const ppos = g.player.body.position;
    if (inRink(ppos.x, ppos.z)) {
      const isl = this.nearestIsland(ppos);
      if (!inside(isl, ppos.x, ppos.z)) {
        ppos.set(isl.x, 0.6, isl.z);
        g.player.body.velocity.setAll(0);
      }
    }
    // Health and a snow globe on the islands, and 8 elves.
    this.health(15, 22, true, 0);
    this.health(-15, 22, false, 0);
    this.snowGlobe(-7.5, 14.2, 0);
    const spots: [ElfTuning, number, number][] = [
      [ELF_SKATER, 7.5, 29.8],
      [ELF_SKATER, -7.5, 29.8],
      [ELF_SKATER, 7.5, 14.2],
      [ELF_SKATER, 15, 22],
      [ELF_BASIC, -15, 22],
      [ELF_BASIC, 0, 25],
      [ELF_BASIC, 2, 19],
      [ELF_BASIC, -7.5, 30.5],
    ];
    spots.forEach(([tuning, x, z], i) => {
      g.after(1.5 + i * 0.7, () => {
        if (!this.zamboni?.alive) return;
        if (tuning.ranged) {
          // Skaters plant themselves on an island and slapshot from there.
          g.fx.puff(new Vector3(x, 0.6, z), "ice", 20, 1.2);
          const e = g.enemies.spawn(new Vector3(x, 0, z), { tuning, perched: true });
          e.aggro = true;
          e.setState("chase");
        } else {
          g.enemies.spawnFromGift(new Vector3(x, 0, z), tuning);
        }
      });
    });
  }

  /** After the fight the ice knits back together. */
  /** Fresh ice from the resurfacer: a disc you can stand on for a few seconds. */
  private layIce(x: number, z: number) {
    if (!phase2 || !inRink(x, z, 0.98)) return;
    for (const b of this.iceBridge) {
      if (Math.hypot(b.x - x, b.z - z) < 1.1) {
        b.life = Math.max(b.life, 7);
        return;
      }
    }
    if (ISLANDS.some((c) => Math.hypot(c.x - x, c.z - z) < c.r - 1.2)) return;
    const mesh = this.game.props.freshIce(1.9);
    this.place(mesh, x, z, { y: 0.06, shadow: false });
    const b = { x, z, r: 1.9, mesh, life: 7, cracked: false };
    this.iceBridge.push(b);
    bridges.push(b);
  }

  private updateBridges(dt: number) {
    const g = this.game;
    for (let i = this.iceBridge.length - 1; i >= 0; i--) {
      const b = this.iceBridge[i] as (typeof this.iceBridge)[number];
      b.life -= dt;
      if (b.life < 1.5) {
        // Melting: it shudders and sinks a little, then gives way.
        if (!b.cracked) {
          b.cracked = true;
          sound.iceCrack();
        }
        b.mesh.position.y = 0.06 - (1.5 - b.life) * 0.04 + Math.sin(g.time * 40) * 0.015;
      }
      if (b.life <= 0) {
        g.fx.puff(new Vector3(b.x, 0.2, b.z), "ice", 14, 1.2);
        sound.splash();
        b.mesh.dispose();
        this.iceBridge.splice(i, 1);
        const j = bridges.indexOf(b);
        if (j >= 0) bridges.splice(j, 1);
      }
    }
  }

  private restoreRink() {
    const g = this.game;
    phase2 = false;
    for (const b of this.iceBridge) b.mesh.dispose();
    this.iceBridge = [];
    bridges.length = 0;
    for (const m of this.islandMeshes) m.dispose();
    this.islandMeshes = [];
    this.rinkFloor?.setEnabled(true);
    for (const n of this.rinkNets) n.setEnabled(true);
    for (const c of this.netColliders) c.enabled = true;
    sound.freeze();
    g.fx.puff(new Vector3(RINK.cx, 0.5, RINK.cz), "ice", 60, 3);
    g.fx.ring(new Vector3(RINK.cx, 0.2, RINK.cz), 20);
  }

  private showAurora() {
    const g = this.game;
    const p = g.props;
    for (const [x, z, y, hue, rot] of [
      [-10, 110, 34, "mint", 0.1],
      [25, 95, 40, "green", -0.3],
      [-30, 80, 46, "lavender", 0.4],
    ] as const) {
      const a = p.aurora(70, hue);
      this.place(a, x, z, { y, rot, shadow: false });
    }
  }

  private nearestIsland(pos: Vector3) {
    let best = ISLANDS[0] as Circle;
    let bestD = Number.POSITIVE_INFINITY;
    for (const c of ISLANDS) {
      const d = Math.hypot(pos.x - c.x, pos.z - c.z) - c.r;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  private pack(at: Vector3, groups: [ElfTuning, number][]) {
    const g = this.game;
    let n = 0;
    const total = groups.reduce((s, [, c]) => s + c, 0);
    for (const [tuning, count] of groups) {
      for (let i = 0; i < count; i++, n++) {
        const a = (n / total) * Math.PI * 2;
        const x = at.x + Math.cos(a) * 4;
        const z = at.z + Math.sin(a) * 4;
        const elf = g.enemies.spawn(new Vector3(x, 0, z), { tuning });
        elf.aggro = true;
        elf.setState("chase");
      }
    }
    sound.growl();
  }

  protected override onSnowGlobe() {
    this.zamboni?.stun(3);
  }

  // ---------- Runtime ----------

  override tick(dt: number) {
    const g = this.game;
    this.zamboni?.update(dt);
    const player = g.player;
    const ppos = player.body.position;

    // Cracking ice.
    for (const c of this.cracks) {
      const on = c.broken <= 0 && player.body.grounded && inside(c, ppos.x, ppos.z) && ppos.y < 0.3;
      if (c.broken > 0) {
        c.broken -= dt;
        if (c.broken <= 0 && !inside(c, ppos.x, ppos.z)) {
          // Freezes over again.
          const i = holes.indexOf(c);
          if (i >= 0) holes.splice(i, 1);
          c.mesh.setEnabled(true);
          c.hole.setEnabled(false);
          c.t = 0;
        } else if (c.broken <= 0) {
          c.broken = 0.5;
        }
        continue;
      }
      if (on) {
        if (c.t === 0) {
          sound.iceCrack();
          if (!this.crackTipShown) {
            this.crackTipShown = true;
            g.tip(LINES.level5Cracks);
          }
        }
        c.t += dt;
        c.mesh.position.y = Math.sin(g.time * 50) * 0.02;
        if (c.t > 0.5 && c.t - dt <= 0.5) sound.iceCrack();
        if (c.t > 1) {
          c.broken = 5;
          holes.push(c);
          c.mesh.setEnabled(false);
          c.hole.setEnabled(true);
          sound.splash();
          g.fx.puff(new Vector3(c.x, 0.2, c.z), "ice", 30, 1.5);
        }
      } else {
        c.t = Math.max(0, c.t - dt * 0.5);
        c.mesh.position.y = 0;
      }
    }

    // Remember the last safe footing; fall in the water and you climb out there.
    if (
      player.body.grounded &&
      ppos.y > -0.05 &&
      ppos.y < 3 &&
      !this.cracks.some((c) => inside(c, ppos.x, ppos.z))
    ) {
      this.lastSafe.copyFrom(ppos);
    }
    if (ppos.y < -0.9 && !player.dead) {
      sound.splash();
      g.fx.puff(new Vector3(ppos.x, -0.4, ppos.z), "ice", 30, 1.5);
      player.hurt(15, ppos.add(new Vector3(0, -1, 0)));
      let to = this.lastSafe.clone();
      if (phase2 && inRink(to.x, to.z)) {
        const isl = this.nearestIsland(to);
        if (!inside(isl, to.x, to.z)) to = new Vector3(isl.x, 0, isl.z);
      }
      ppos.set(to.x, to.y + 0.3, to.z);
      player.body.velocity.setAll(0);
      if (!this.splashTipShown) {
        this.splashTipShown = true;
        g.tip(LINES.level5Splash);
      }
    }

    this.updateBridges(dt);
    // Mist curls off the open water.
    if (phase2 && Math.random() < dt * 4) {
      const a = Math.random() * Math.PI * 2;
      const x = RINK.cx + Math.cos(a) * RINK.rx * 0.8 * Math.random();
      const z = RINK.cz + Math.sin(a) * RINK.rz * 0.8 * Math.random();
      if (terrain(x, z) < -1) g.fx.puff(new Vector3(x, 0.2, z), "snow", 2, 1.6);
    }
    // Islands bob gently.
    if (phase2) {
      this.islandMeshes.forEach((m, i) => {
        if (i > 0) m.position.y = 0.07 + Math.sin(g.time * 1.3 + i) * 0.025;
      });
    }
  }

  private async finish() {
    const g = this.game;
    // Talk first (Santa standing on the chimney), then down he goes.
    g.player.frozen = true;
    g.cinematic(true);
    await g.say(LINES.level5Done);
    g.cinematic(false);
    await this.diveIntoChimney();
    await g.completeLevel();
  }
}
