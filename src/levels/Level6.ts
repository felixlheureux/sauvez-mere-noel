import { Vector3 } from "@babylonjs/core";
import { sound } from "../audio/Sound";
import { mulberry32, randRange } from "../core/math";
import {
  ELF_BASIC,
  ELF_BOMBER,
  ELF_SPRINTER,
  ELF_THROWER,
  type ElfTuning,
  SNOWMAN,
} from "../enemies/Elf";
import { LINES, OBJ, T, WEAPON_NAMES } from "../i18n/fr-QC";
import { MOODS } from "../world/Environment";
import { type Lantern, Level } from "../world/Level";

/** A flat roof: centre, width (x), depth (z) and height. */
export interface Roof {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

// The street runs along z between x = 4 and x = 12 and is flooded with cursed slush.
// Santa's side (west, x = 0) carries sections A and C; the Magasin Général is across.
// Gaps follow the measured jumps (run jump ≈ 4.3 m / 1.5 m up, double jump ≈ 7.7 m / 3.1 m up):
// 2.5–3.5 m with a single jump, 4.5 m needs the double jump, +1.2 m steps are single jumps.
const A1: Roof = { x: 0, z: -52, w: 8, d: 8, h: 7 };
const A2: Roof = { x: 0, z: -41.5, w: 8, d: 8, h: 7.8 }; // gap 2.5, up 0.8
const A3: Roof = { x: 0, z: -31, w: 8, d: 7, h: 7 }; // gap 3, down 0.8
const A4: Roof = { x: 0, z: -20, w: 8, d: 8, h: 7.4 }; // gap 3.5, up 0.4
export const STORE: Roof = { x: 20, z: -10, w: 16, d: 28, h: 7.4 };
const C1: Roof = { x: 0, z: 1, w: 8, d: 8, h: 7.4 };
const C2: Roof = { x: 0, z: 11, w: 8, d: 7, h: 8.6 }; // gap 2.5, up 1.2
const C3: Roof = { x: 0, z: 23, w: 8, d: 8, h: 8.6 }; // gap 4.5: double jump
const C4: Roof = { x: 0, z: 33, w: 8, d: 7, h: 10.8 }; // gap 2.5, up 2.2 (or the vent step)
export const TOWER: Roof = { x: 0, z: 45.5, w: 10, d: 12, h: 10.8 }; // gap 3

/** Every roof you're meant to stand on, in route order. */
export const ROUTE = { A1, A2, A3, A4, STORE, C1, C2, C3, C4, TOWER };
/** The jumps on the way (tests jump each one with the real controls). */
export const JUMPS: { from: Roof; to: Roof; double: boolean }[] = [
  { from: A1, to: A2, double: false },
  { from: A2, to: A3, double: false },
  { from: A3, to: A4, double: false },
  { from: C1, to: C2, double: false },
  { from: C2, to: C3, double: true },
  { from: C4, to: TOWER, double: false },
];
/** Plank bridges over the street: z, and the roof height at both ends. */
export const PLANKS = [
  { z: -19, h: 7.4 },
  { z: 1.5, h: 7.4 },
];
/**
 * The stairwell hut on C3: a step up to C4 that you can run across. It reaches C3's
 * far edge, so it's hop on, keep running, hop off onto C4 (two single jumps).
 */
export const STEP: Roof = { x: 1.5, z: 25.4, w: 3, d: 3.2, h: C3.h + 1.1 };
/** Plexes across the street from sections A and C (throwers perch on their roofs). */
const EAST_ROW: Roof[] = [
  { x: 18, z: -51.5, w: 10, d: 9, h: 9 },
  { x: 18, z: -40, w: 10, d: 8, h: 8.5 },
  { x: 18, z: -30.5, w: 10, d: 7, h: 9.5 },
  { x: 17.5, z: 11.5, w: 9, d: 9, h: 9.5 },
  { x: 17.5, z: 24, w: 9, d: 10, h: 9 },
  { x: 18, z: 39, w: 10, d: 12, h: 11 },
];
const CRATE = new Vector3(0, A2.h, -41.5);
/** Below this you're in the slush. */
const SLUSH_Y = 0.8;

const minZ = (r: Roof) => r.z - r.d / 2;
const maxZ = (r: Roof) => r.z + r.d / 2;

/**
 * Niveau 6 — Les Toits du Village.
 * The village streets are flooded with cursed slush, so Santa crosses over the
 * rooftops to the bell tower: jumps between plexes, plank bridges over the street,
 * a siege on the Magasin Général's roof, and a climb to the clocher.
 */
export class Level6 extends Level {
  readonly id = 6;
  readonly name = "Les Toits du Village";
  readonly mood = MOODS.rooftops;
  override darkness = 6;
  override theme = "reel" as const;
  override arenaRadius = 70;
  override newGun = "icicle" as const;
  private readonly lastSafe = new Vector3();
  private slushTipShown = false;
  private storeLantern: Lantern | null = null;
  private plankLantern: Lantern | null = null;

  /** Roofs are this level's floor: props, lanterns and checkpoints sit on top of them. */
  protected override floor(x: number, z: number) {
    return this.game.physics.groundHeightAt(x, z, 50);
  }

  build() {
    const g = this.game;
    const p = g.props;
    const rand = mulberry32(66);
    this.spawnPos = new Vector3(0, A1.h, -54.5);
    this.spawnYaw = 0;
    this.lastSafe.copyFrom(this.spawnPos);

    this.place(p.ground(75, 6, "slush", "plum"), 0, 0, { shadow: false });
    this.place(p.mountains(90, 6), 0, 0, { shadow: false });

    // ---- The route ----
    for (const [i, r] of [A1, A2, A3, A4, C1, C2, C3, C4].entries()) this.building(r, i + 1);
    this.building(STORE, 20);
    this.building(TOWER, 21);
    PLANKS.forEach((pl) => {
      this.place(p.plank(8), 8, pl.z, { y: pl.h });
      this.solid(8, pl.z, 8, 0.16, 1.4, pl.h - 0.16);
    });

    // Rooftop dressing, kept off the middle of each roof so the way across stays clear.
    this.stack(-2.8, -54, 1.4);
    this.vent(2.6, -51);
    this.stack(2.8, -44.2, 1.6);
    this.stack(-2.6, -31, 2.4); // bell on top: a double jump from the roof
    this.vent(-2.6, -18);
    this.stack(2.6, -22.6, 1.4);
    this.vent(-2.6, 3.5);
    this.stack(2.6, 13, 1.6);
    this.place(this.game.props.plex(STEP.w, STEP.d, STEP.h - C3.h, 31), STEP.x, STEP.z, {
      y: C3.h,
    });
    this.solid(STEP.x, STEP.z, STEP.w, STEP.h - C3.h, STEP.d, C3.h);
    this.stack(-2.6, 31.2, 1.8);
    this.stack(-3.6, 41, 1.6);
    // The Magasin Général's roof: cover for the siege, and a water tower in the corner.
    for (const [x, z] of [
      [16, -16],
      [24, -16],
      [16, -3],
    ] as const) {
      this.place(p.vent(), x, z, { y: STORE.h });
      this.solid(x, z, 1.2, 1.1, 1.2, STORE.h);
    }
    this.stack(26.5, -21, 1.6);
    this.place(p.waterTower(), 25, 0.5, { y: STORE.h });
    this.solid(25, 0.5, 2.6, 2.2, 2.6, STORE.h + 3);
    this.bounceGift(21.6, 0.5, 15);
    // A balcony off C3's back wall, two metres down: the third bell.
    this.place(p.balcony(), -5, 23, { y: C3.h - 2 });
    this.solid(-5, 23, 2, 0.16, 3, C3.h - 2.16);

    // ---- The rest of the village (scenery) ----
    // Across the street from sections A and C: where the throwers perch.
    for (const r of EAST_ROW) this.building(r, Math.round(r.z) + 40);
    // Back alley row and the far ends of the street.
    for (let z = -58; z < 58; z += 11) {
      this.building({ x: -15, z, w: 10, d: 10, h: randRange(rand, 8, 13) }, Math.round(z) + 80);
    }
    for (let z = -58; z < 58; z += 12) {
      if (z > -28 && z < 6) continue; // behind the Magasin
      this.building({ x: 34, z, w: 9, d: 11, h: randRange(rand, 8, 12) }, Math.round(z) + 120);
    }
    this.building({ x: 38, z: -10, w: 12, d: 24, h: 9 }, 7);
    // The clocher at the end of the street: the goal you can see from the first roof.
    this.place(p.church(), 0, 66, { rot: Math.PI, scale: 1.8 });
    this.solid(0, 66, 12.6, 13, 16.2);

    // Street lamps light the slush from below.
    for (let z = -50; z <= 50; z += 14) {
      const lamp = g.protoClone("lamp4", () => p.lampPost(4));
      this.place(lamp, 8, z);
      this.solid(8, z, 0.3, 4, 0.3);
      this.pointLight(new Vector3(8, 4.2, z), "#ffb070", 1.6, 13);
    }

    // ---- Collectibles ----
    this.bell(-2.6, A3.h + 2.4 + 0.7, -31);
    this.bell(25, STORE.h + 5.2 + 0.8, 0.5);
    this.bell(-5.2, C3.h - 2 + 0.7, 23);
    // Breadcrumbs along the route, and arcs over every gap to show the jump.
    for (const r of [A1, A2, A3, A4, C1, C2, C3, C4, TOWER]) {
      this.candyLine(r.x, minZ(r) + 1.5, r.x, maxZ(r) - 1.5, 3);
    }
    for (const j of JUMPS) this.candyArc(j.from, j.to);
    this.candyArc({ ...C3, x: STEP.x }, { ...C4, x: STEP.x });
    for (const pl of PLANKS) this.candyLine(5.5, pl.z, 10.5, pl.z, 3, pl.h + 0.7, true);
    this.candyRing(STORE.x, STORE.z, 4, 8);

    // ---- Health and power-ups ----
    this.health(2.4, -29, false);
    this.health(-2.4, -21.5, false);
    this.buff("speed", -2, 20.5);
    this.health(3.2, 41.5, true);

    // ---- Checkpoints: the start, the Magasin's roof, after the siege ----
    this.addCheckpoint(this.spawnPos.x, this.spawnPos.z, 0);
    this.addCheckpoint(14.5, -19, Math.PI / 2);
    this.addCheckpoint(14.5, 1.5, -Math.PI / 2);
    this.storeLantern = this.lantern(13.3, -21.6);
    this.plankLantern = this.lantern(13.3, 3.4);

    this.exitChimney(0, 49, () => void this.finish());
  }

  /** A plex whose roof is walkable: the mesh, and one solid box from the street to the roof. */
  private building(r: Roof, seed: number) {
    this.place(this.game.props.plex(r.w, r.d, r.h, seed), r.x, r.z);
    this.solid(r.x, r.z, r.w, r.h, r.d);
  }

  private stack(x: number, z: number, h: number) {
    const y = this.floor(x, z);
    this.place(this.game.props.chimneyStack(h), x, z, { y });
    this.solid(x, z, 0.9, h, 0.9, y);
  }

  private vent(x: number, z: number) {
    const y = this.floor(x, z);
    this.place(
      this.game.protoClone("vent", () => this.game.props.vent()),
      x,
      z,
      { y },
    );
    this.solid(x, z, 1.2, 1.1, 1.2, y);
  }

  /** Candies along the arc of a running jump from one roof to the next. */
  private candyArc(from: Roof, to: Roof) {
    const z0 = maxZ(from);
    const z1 = minZ(to);
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const y = from.h + (to.h - from.h) * t + Math.sin(t * Math.PI) * 1.3 + 0.7;
      this.candy(from.x, y, z0 + (z1 - z0) * t);
    }
  }

  // ---------- Script ----------

  async run() {
    const g = this.game;
    this.startTime = g.time;
    g.env.setMoon(true);
    const cp = this.startCheckpoint;

    if (cp === 0) {
      await this.intro();
      g.objective(OBJ.getIcicle, CRATE.add(new Vector3(0, 1, 0)));
      await new Promise<void>((resolve) => {
        this.pickup(
          g.props.weaponCrate(),
          CRATE,
          () => {
            g.player.giveGun("icicle");
            sound.icicle();
            g.toast(T.newWeapon, WEAPON_NAMES.icicle);
            resolve();
          },
          1.2,
        );
      });
      await g.say(LINES.level6Rifle);
      // First targets: two throwers perched across the street.
      for (const [x, z] of [
        [16, -51.5],
        [17.5, -40],
      ] as const) {
        this.perch(ELF_THROWER, x, z);
      }
      g.tip(LINES.level6Throwers);
      g.objective(OBJ.crossRoofs, new Vector3(0, A4.h + 1, A4.z));

      await this.reach(A3);
      this.perch(ELF_THROWER, 17, -30.5);
      await this.reach(A4);
      this.pack(A4, [[ELF_BASIC, 4]]);
      g.tip(LINES.level6Plank);
      g.objective(OBJ.crossPlank, new Vector3(12.5, STORE.h + 1, PLANKS[0]?.z ?? 0));
      await this.reach(STORE);
    }

    if (cp <= 1) {
      if (this.storeLantern) this.lightLantern(this.storeLantern, cp === 1);
      this.reachCheckpoint(1);
      await this.siege();
      if (this.plankLantern) this.lightLantern(this.plankLantern);
      this.reachCheckpoint(2);
      await g.say(LINES.level6StoreClear);
    } else {
      for (const l of [this.storeLantern, this.plankLantern]) if (l) this.lightLantern(l, true);
    }

    g.objective(OBJ.crossBack, new Vector3(4, C1.h + 1, PLANKS[1]?.z ?? 0));
    await this.reach(C1);
    g.tip(LINES.level6Climb);
    g.objective(OBJ.climbTower, new Vector3(0, TOWER.h + 1, TOWER.z));
    await this.reach(C2);
    this.pack(C2, [
      [ELF_SPRINTER, 2],
      [ELF_BASIC, 2],
    ]);
    await this.reach(C3);
    this.perch(ELF_THROWER, 17, 24);
    this.perch(ELF_BOMBER, -1.5, 34.5, C4.h);
    await this.reach(TOWER);

    await g.say(LINES.level6Tower);
    g.objective(OBJ.clearTower);
    this.perch(ELF_THROWER, 18, 39);
    this.pack(TOWER, [
      [ELF_BASIC, 5],
      [ELF_SPRINTER, 4],
    ]);
    await g.wait(1.5);
    await this.allDown();
    this.openExit();
    g.objective(OBJ.enterChimney, this.exit?.pos);
  }

  /** Opening: the whole street from above, then Gérard explains. */
  private async intro() {
    const g = this.game;
    const cam = g.camRig;
    g.cinematic(true);
    const from = new Vector3(-7, 17, -70);
    const to = new Vector3(6, 6, -14);
    cam.cut(from, to);
    cam.cut(Vector3.Lerp(from, to, 0.12), to, 6);
    await g.say(LINES.level6Intro);
    g.cinematic(false);
  }

  /** The Magasin Général's roof: three waves climbing over the edges. */
  private async siege() {
    const g = this.game;
    g.tip(LINES.level6Store);
    const waves: [ElfTuning, number][][] = [
      [
        [ELF_BASIC, 6],
        [ELF_SPRINTER, 2],
      ],
      [
        [ELF_BASIC, 5],
        [ELF_BOMBER, 3],
        [ELF_THROWER, 2],
      ],
      [
        [SNOWMAN, 1],
        [ELF_BASIC, 5],
        [ELF_SPRINTER, 4],
        [ELF_BOMBER, 2],
      ],
    ];
    for (let i = 0; i < waves.length; i++) {
      g.objective(OBJ.survive(i + 1, waves.length));
      this.pack(STORE, waves[i] as [ElfTuning, number][], 5.5);
      await g.wait(1.5);
      await this.allDown();
      await g.wait(1);
      if (i === 0) {
        this.buff("shield", 16, -10, STORE.h);
        this.health(24, -10, false, STORE.h);
      } else if (i === 1) {
        this.buff("rage", 20, -20, STORE.h);
        this.health(18, -2, true, STORE.h);
      }
    }
  }

  /** Elves drop onto `roof` in evil gifts, in a ring around its middle. */
  private pack(roof: Roof, groups: [ElfTuning, number][], radius = 2.5) {
    const g = this.game;
    const total = groups.reduce((s, [, c]) => s + c, 0);
    let n = 0;
    for (const [tuning, count] of groups) {
      for (let i = 0; i < count; i++, n++) {
        const a = (n / total) * Math.PI * 2 + 0.4;
        const pos = new Vector3(
          roof.x + Math.cos(a) * Math.min(radius, roof.w / 2 - 1),
          roof.h,
          roof.z + Math.sin(a) * Math.min(radius, roof.d / 2 - 1),
        );
        g.enemies.spawnFromGift(pos, tuning);
      }
    }
    sound.growl();
  }

  /** An elf that stays put on a rooftop and attacks from there. */
  private perch(tuning: ElfTuning, x: number, z: number, y = this.floor(x, z)) {
    const ppos = this.game.player.body.position;
    const e = this.game.enemies.spawn(new Vector3(x, y, z), {
      tuning,
      perched: true,
      yaw: Math.atan2(ppos.x - x, ppos.z - z),
    });
    e.aggro = true;
  }

  /** Resolves once every elf that isn't perched (and every gift on its way) is dead. */
  private async allDown() {
    const g = this.game;
    while (
      g.enemies.elves.some((e) => e.alive && !e.perched) ||
      g.enemies.aliveCount > g.enemies.elves.filter((e) => e.alive).length
    ) {
      await g.wait(0.3);
    }
  }

  /**
   * Resolves when Santa stands on `roof` (not just above it: the slush is below too), or on
   * any roof further along the route, so skipping ahead never means walking back.
   */
  private async reach(roof: Roof) {
    const g = this.game;
    const route = Object.values(ROUTE);
    const ahead = route.slice(route.indexOf(roof));
    while (!g.player.body.grounded || !ahead.some((r) => this.onRoof(r, g.player.body.position))) {
      await g.wait(0.15);
    }
  }

  private onRoof(r: Roof, p: Vector3) {
    return (
      Math.abs(p.x - r.x) <= r.w / 2 &&
      Math.abs(p.z - r.z) <= r.d / 2 &&
      p.y > r.h - 0.3 &&
      p.y < r.h + 3.5
    );
  }

  // ---------- Per frame: the slush ----------

  override tick(_dt: number) {
    const g = this.game;
    const player = g.player;
    const pos = player.body.position;
    if (player.body.grounded && pos.y > SLUSH_Y + 2) this.lastSafe.copyFrom(pos);
    if (pos.y < SLUSH_Y && !player.dead && !player.kinematic) this.fellInSlush();
    // Elves knocked off a roof don't come back.
    for (const e of g.enemies.elves) {
      if (e.alive && e.body.position.y < SLUSH_Y) {
        g.fx.puff(e.body.position.clone(), "plum", 12, 1.2);
        g.enemies.hit(e, 999, e.body.position, "fire", 0);
      }
    }
    // The slush bubbles.
    if (Math.random() < 0.25) {
      const z = randRange(Math.random, pos.z - 20, pos.z + 20);
      g.fx.puff(new Vector3(randRange(Math.random, 4.5, 11.5), 0.2, z), "plum", 2, 0.9);
    }
  }

  /** The street is all slush: no elf walks off a roof into it on purpose. */
  override deadlyGround(_x: number, _z: number, y: number) {
    return y < SLUSH_Y;
  }

  /** Hurt, and back up onto the last roof you stood on (a step in from its edge). */
  private fellInSlush() {
    const g = this.game;
    const player = g.player;
    const pos = player.body.position;
    sound.splash();
    g.fx.puff(new Vector3(pos.x, 0.4, pos.z), "plum", 30, 1.6);
    player.hurt(15, pos.add(new Vector3(0, -1, 0)));
    const to = this.lastSafe.clone();
    const roof = Object.values(ROUTE).find((r) => this.onRoof(r, to));
    if (roof) {
      // Step back toward the middle so you don't land on the very edge you fell from.
      const dx = roof.x - to.x;
      const dz = roof.z - to.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) {
        const k = Math.min(1.2, d) / d;
        to.x += dx * k;
        to.z += dz * k;
      }
      to.y = roof.h;
    }
    pos.set(to.x, to.y + 0.3, to.z);
    player.body.velocity.setAll(0);
    if (!this.slushTipShown) {
      this.slushTipShown = true;
      g.tip(LINES.level6Slush);
    }
  }

  private async finish() {
    const g = this.game;
    g.player.frozen = true;
    g.cinematic(true);
    await g.say(LINES.level6Done);
    g.cinematic(false);
    await this.diveIntoChimney();
    await g.completeLevel();
  }
}
