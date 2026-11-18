import { type Mesh, TransformNode, Vector3 } from "@babylonjs/core";
import { createFouettard, createMereNoel } from "../assets/characters";
import { sound } from "../audio/Sound";
import {
  ELF_BASIC,
  ELF_BOMBER,
  ELF_SPRINTER,
  ELF_THROWER,
  type ElfTuning,
  NUTCRACKER,
  REINDEER,
  SNOWMAN,
} from "../enemies/Elf";
import { LINES, OBJ, T, WEAPON_NAMES } from "../i18n/fr-QC";
import { MOODS } from "../world/Environment";
import { Level } from "../world/Level";

/**
 * The mountain: giant gifts stacked like a wedding cake, all centred on (0, 0).
 * `s` is the square side, `top` the height of its top surface. The ring of each tier's
 * top left uncovered by the next one up is a terrace (6 → 3.5 m wide).
 */
export const TIERS = [
  { s: 44, top: 6 },
  { s: 32, top: 12 },
  { s: 22, top: 18 },
  { s: 13, top: 24 },
  { s: 6, top: 28 },
];
/** Which face each staircase climbs (to tier i, from the level below): never the same side twice. */
export const STAIR_SIDES = ["south", "east", "north", "west", "south"] as const;
type Side = (typeof STAIR_SIDES)[number];
const STEP = { rise: 1.2, run: 2.2, depth: 1.8 };
/**
 * Tiers with a giant ornament rolling round the outer edge of their terrace: the two widest
 * (6 and 5 m). Throwers perch on the edges of tiers 2 and 3, which stay clear of any ball.
 */
export const BALL_TIERS = [0, 1];
export const BALL = { radius: 0.8, speed: 5, damage: 20 };
const CRATE = new Vector3(6, 0, -27);

/** Unit vectors out of each face, and along it (the direction the stairs climb). */
const OUT: Record<Side, [number, number]> = {
  south: [0, -1],
  east: [1, 0],
  north: [0, 1],
  west: [-1, 0],
};
const ALONG: Record<Side, [number, number]> = {
  south: [1, 0],
  east: [0, 1],
  north: [-1, 0],
  west: [0, -1],
};

/** The steps of the staircase up to tier `i`: centre, size, and top height. */
export function stairSteps(i: number) {
  const tier = TIERS[i] as (typeof TIERS)[number];
  const base = i === 0 ? 0 : (TIERS[i - 1] as (typeof TIERS)[number]).top;
  const side = STAIR_SIDES[i] as Side;
  const [ox, oz] = OUT[side];
  const [ax, az] = ALONG[side];
  const n = Math.ceil((tier.top - base) / STEP.rise) - 1;
  const face = tier.s / 2 + STEP.depth / 2;
  const steps = [];
  for (let k = 1; k <= n; k++) {
    // The flight starts left of the face's middle and climbs along it.
    const along = (k - (n + 1) / 2) * STEP.run;
    steps.push({
      x: ox * face + ax * along,
      z: oz * face + az * along,
      w: Math.abs(ax) > 0 ? STEP.run : STEP.depth,
      d: Math.abs(az) > 0 ? STEP.run : STEP.depth,
      base,
      top: base + k * STEP.rise,
    });
  }
  return steps;
}

/** Which tier's top (terrace) is Santa standing on? −1 = the ground. */
export function tierAt(p: Vector3) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const t = TIERS[i] as (typeof TIERS)[number];
    if (Math.abs(p.x) <= t.s / 2 + 0.4 && Math.abs(p.z) <= t.s / 2 + 0.4 && p.y > t.top - 0.6)
      return i;
  }
  return -1;
}

interface Ball {
  mesh: Mesh;
  /** Distance travelled round the loop. */
  t: number;
  half: number;
  y: number;
}

/**
 * Niveau 9 — La Montagne de Cadeaux.
 * Every stolen gift on Earth stacked into a mountain. Climb it tier by tier through a
 * blizzard — stairs on a different side each time, hordes on every terrace, giant
 * ornaments rolling round the edges — to see Père Fouettard's sleigh carry Mère Noël off.
 */
export class Level9 extends Level {
  readonly id = 9;
  readonly name = "La Montagne de Cadeaux";
  readonly mood = MOODS.blizzard;
  override darkness = 9;
  override theme = "wewish" as const;
  override arenaRadius = 70;
  override newGun = "gatling" as const;
  private readonly balls: Ball[] = [];
  private fallTipShown = false;
  private lastTier = -1;

  build() {
    const g = this.game;
    const p = g.props;
    this.spawnPos = new Vector3(0, 0, -34);
    this.spawnYaw = 0;
    this.place(p.ground(75, 9), 0, 0, { shadow: false });
    this.place(p.mountains(90, 9), 0, 0, { shadow: false });

    // ---- The mountain: one giant gift per tier, and its staircase ----
    TIERS.forEach((t, i) => {
      const base = i === 0 ? 0 : (TIERS[i - 1] as (typeof TIERS)[number]).top;
      this.gift(0, 0, t.s, t.top - base, t.s, i + 2, base);
      for (const st of stairSteps(i)) {
        this.gift(st.x, st.z, st.w, st.top - st.base, st.d, (i + 4) % 7, st.base);
      }
    });

    // ---- Rolling ornaments round the outer edge of two terraces ----
    for (const i of BALL_TIERS) {
      const t = TIERS[i] as (typeof TIERS)[number];
      const mesh = this.place(p.giantOrnament(i), 0, 0, { y: t.top + BALL.radius });
      this.balls.push({ mesh, t: i * 17, half: t.s / 2 - 1.2, y: t.top + BALL.radius });
    }

    // ---- Around the base: drifts of fallen gifts (cover, and the first bell) ----
    for (const [x, z, w, h, c] of [
      [-14, -28, 2.4, 1.8, 1],
      [15, -26, 2, 1.4, 2],
      [-27, -6, 2.6, 2, 3],
      [26, 8, 2.2, 1.6, 4],
      [-8, 28, 2.4, 1.2, 5],
    ] as const) {
      this.gift(x, z, w, h, w, c);
    }
    this.gift(-19, -31, 2, 1.2, 2, 6);
    this.gift(-19, -31, 1.6, 1.2, 1.6, 0, 1.2);
    this.gift(-19, -31, 1.2, 2.4, 1.2, 3, 2.4);

    // ---- Light: lanterns at the foot of each staircase ----
    TIERS.forEach((_, i) => {
      const s0 = stairSteps(i)[0];
      if (s0) this.pointLight(new Vector3(s0.x, s0.base + 2.5, s0.z), "#ffb07a", 1.6, 14);
    });

    // ---- Collectibles ----
    this.bell(-19, 5.6, -31);
    const t2 = TIERS[2] as (typeof TIERS)[number];
    this.gift(-t2.s / 2 + 1.4, -t2.s / 2 + 1.4, 1.6, 1.6, 1.6, 5, t2.top);
    this.bell(-t2.s / 2 + 1.4, t2.top + 2.4, -t2.s / 2 + 1.4);
    const t3 = TIERS[3] as (typeof TIERS)[number];
    this.gift(t3.s / 2 - 1.2, t3.s / 2 - 1.2, 1.4, 1.4, 1.4, 2, t3.top);
    this.gift(t3.s / 2 - 1.2, t3.s / 2 - 1.2, 1.1, 1.4, 1.1, 6, t3.top + 1.4);
    this.bell(t3.s / 2 - 1.2, t3.top + 3.5, t3.s / 2 - 1.2);
    // Candies up every staircase, and a ring round each terrace.
    TIERS.forEach((t, i) => {
      for (const st of stairSteps(i)) this.candy(st.x, st.top + 0.7, st.z);
      if (i < TIERS.length - 1) {
        const r = (t.s / 2 + (TIERS[i + 1] as (typeof TIERS)[number]).s / 2) / 2;
        for (const [x, z] of [
          [r, r],
          [-r, r],
          [r, -r],
          [-r, -r],
        ] as const) {
          this.candy(x, t.top + 0.7, z);
        }
      }
    });

    // ---- Health and power-ups, one set per terrace ----
    this.health(-10, -27, false);
    this.health(18.5, 18.5, false, TIERS[0]?.top);
    this.buff("rage", -18.5, 18.5, TIERS[0]?.top);
    this.health(13.5, -13.5, true, TIERS[1]?.top);
    this.buff("shield", -13.5, 13.5, TIERS[1]?.top);
    this.health(-8.6, -8.6, false, TIERS[2]?.top);
    this.health(-5, 5, true, TIERS[3]?.top);

    // ---- Checkpoints: the foot, tier 1, tier 3 ----
    this.addCheckpoint(this.spawnPos.x, this.spawnPos.z, 0);
    this.addCheckpoint(0, -(TIERS[0]?.s ?? 0) / 2 + 2.5, 0);
    this.addCheckpoint(0, (TIERS[2]?.s ?? 0) / 2 - 2, Math.PI);

    // In a corner of the summit gift, clear of its bow.
    this.exitChimney(1.6, 1.4, () => void this.finish());
  }

  /** Roofs aren't involved, but every tier is a floor: stand things on the top surface. */
  protected override floor(x: number, z: number) {
    return this.game.physics.groundHeightAt(x, z, 60);
  }

  // ---------- Script ----------

  async run() {
    const g = this.game;
    this.startTime = g.time;
    const cp = this.startCheckpoint;

    if (cp === 0) {
      await this.intro();
      g.objective(OBJ.getGatling, CRATE.add(new Vector3(0, 1, 0)));
      await new Promise<void>((resolve) => {
        this.pickup(
          g.props.weaponCrate(),
          CRATE,
          () => {
            g.player.giveGun("gatling");
            sound.smg();
            g.toast(T.newWeapon, WEAPON_NAMES.gatling);
            resolve();
          },
          1.2,
        );
      });
      await g.say(LINES.level9Gun);
      g.tip(LINES.level9Stairs);
      await this.fightThenClimb(-1, [ELF_BASIC, ELF_BASIC, ELF_SPRINTER, ELF_THROWER], 14, 10);
    }
    if (cp <= 1) {
      this.reachCheckpoint(1);
      g.tip(LINES.level9Balls);
      await this.fightThenClimb(
        0,
        [ELF_BASIC, ELF_SPRINTER, ELF_BOMBER, ELF_BASIC, ELF_THROWER],
        18,
        12,
      );
      this.perchOn(2, ELF_THROWER, 3);
      await this.fightThenClimb(
        1,
        [ELF_BASIC, NUTCRACKER, ELF_SPRINTER, ELF_BOMBER, ELF_BASIC],
        18,
        12,
      );
    }
    this.reachCheckpoint(2);
    this.perchOn(3, ELF_THROWER, 2);
    await this.fightThenClimb(
      2,
      [ELF_BASIC, REINDEER, ELF_SPRINTER, ELF_BOMBER, ELF_BASIC, SNOWMAN],
      20,
      12,
    );
    await this.fightThenClimb(
      3,
      [ELF_BASIC, NUTCRACKER, ELF_BOMBER, ELF_SPRINTER, ELF_BASIC, NUTCRACKER, ELF_THROWER],
      24,
      14,
    );
    await this.summit();
    this.openExit();
    g.objective(OBJ.enterChimney, this.exit?.pos);
  }

  /**
   * Fight on terrace `tier` (−1 = the ground) until its horde is down, then point at the
   * next staircase and wait for Santa to reach the tier above.
   */
  private async fightThenClimb(tier: number, roster: ElfTuning[], total: number, maxAlive: number) {
    const g = this.game;
    g.objective(tier < 0 ? OBJ.clearFoot : OBJ.clearTier(tier + 1));
    await this.horde(this.terraceSpots(tier), roster, { total, maxAlive, every: 1.3 });
    const next = tier + 1;
    const first = stairSteps(next)[0];
    g.objective(
      next === TIERS.length - 1 ? OBJ.reachSummit : OBJ.climbTier(next + 1),
      first ? new Vector3(first.x, first.top + 1, first.z) : undefined,
    );
    while (tierAt(g.player.body.position) < next || !g.player.body.grounded) await g.wait(0.2);
  }

  /** Drop spots round a terrace (or the ground round the base), away from the staircases. */
  private terraceSpots(tier: number) {
    if (tier < 0) {
      return [
        [-12, -30],
        [12, -32],
        [-28, 0],
        [28, -10],
      ].map(([x, z]) => new Vector3(x as number, 0, z as number));
    }
    const t = TIERS[tier] as (typeof TIERS)[number];
    const inner = (TIERS[tier + 1] as (typeof TIERS)[number]).s / 2;
    const r = (t.s / 2 + inner) / 2;
    return [
      [r, -r],
      [-r, r],
      [r, r],
      [-r, -r],
      [0, -r],
      [r, 0],
    ].map(([x, z]) => new Vector3(x as number, t.top, z as number));
  }

  /** Throwers on the edge of tier `tier`, raining coal on the terrace below. */
  private perchOn(tier: number, tuning: ElfTuning, n: number) {
    const g = this.game;
    const t = TIERS[tier] as (typeof TIERS)[number];
    const e0 = t.s / 2 - 0.8;
    const spots = [
      [e0, -e0],
      [-e0, e0],
      [-e0, -e0],
    ].slice(0, n);
    for (const [x, z] of spots) {
      const e = g.enemies.spawn(new Vector3(x as number, t.top, z as number), {
        tuning,
        perched: true,
      });
      e.aggro = true;
    }
  }

  /** Opening: the whole mountain through the blizzard. */
  private async intro() {
    const g = this.game;
    g.cinematic(true);
    const from = new Vector3(-22, 12, -62);
    const to = new Vector3(0, 15, 0);
    g.camRig.cut(from, to);
    g.camRig.cut(Vector3.Lerp(from, to, 0.15), to, 7);
    await g.say(LINES.level9Intro);
    g.cinematic(false);
  }

  /** The summit: the black sleigh sweeps past with Mère Noël, off to the village. */
  private async summit() {
    const g = this.game;
    g.cinematic(true);
    g.player.frozen = true;
    const top = (TIERS[TIERS.length - 1] as (typeof TIERS)[number]).top;
    const sleigh = new TransformNode("sleighRig", g.scene);
    sleigh.parent = g.levelRoot;
    g.props.darkSleigh().parent = sleigh;
    const fouettard = createFouettard(g.scene, g.mats);
    fouettard.root.parent = sleigh;
    fouettard.root.position.set(0, 1, -0.6);
    fouettard.root.scaling.setAll(0.9);
    const mere = createMereNoel(g.scene, g.mats);
    mere.root.parent = sleigh;
    mere.root.position.set(0.5, 1, 0.6);
    const from = new Vector3(-50, top + 10, -20);
    const hover = new Vector3(0, top + 7, 9);
    const away = new Vector3(55, top + 18, 70);
    g.camRig.cut(new Vector3(3, top + 2.5, -5), hover);
    await g.tween(2.5, (k) => {
      const e = 1 - (1 - k) ** 3;
      sleigh.position.copyFrom(Vector3.Lerp(from, hover, e));
      sleigh.rotation.y = Math.atan2(hover.x - from.x, hover.z - from.z);
    });
    sound.growl();
    await g.say(LINES.level9Summit);
    void g.tween(3, (k) => {
      sleigh.position.copyFrom(Vector3.Lerp(hover, away, k * k));
      sleigh.rotation.y = Math.atan2(away.x - hover.x, away.z - hover.z);
    });
    await g.wait(1.5);
    await g.say(LINES.level9Done);
    sleigh.dispose();
    g.cinematic(false);
    g.player.frozen = false;
  }

  // ---------- Per frame: rolling ornaments, falls ----------

  override tick(dt: number) {
    const g = this.game;
    const pl = g.player;
    for (const b of this.balls) {
      b.t += BALL.speed * dt;
      const pos = squareLoop(b.t, b.half);
      b.mesh.position.set(pos.x, b.y, pos.z);
      b.mesh.rotation.x += (BALL.speed / BALL.radius) * dt;
      b.mesh.rotation.y = pos.heading;
      const d = Vector3.Distance(pl.body.position.add(new Vector3(0, 0.8, 0)), b.mesh.position);
      if (d < 14 && Math.random() < dt * 3) sound.rumble();
      if (!pl.dead && d < BALL.radius + pl.body.radius + 0.2) {
        // Bowled over, outward: off the terrace, down one tier at most.
        const out = new Vector3(pos.x, 0, pos.z).normalize();
        pl.hurt(BALL.damage, pl.body.position.subtract(out.scale(2)), 11, 0.5);
      }
      for (const e of g.enemies.elves) {
        if (
          e.alive &&
          Vector3.Distance(e.center, b.mesh.position) < BALL.radius + e.tuning.radius
        ) {
          g.enemies.hit(e, 999, b.mesh.position, "slam", 8);
        }
      }
    }
    // Falling a tier: a word from Santa the first time.
    const tier = pl.body.grounded ? tierAt(pl.body.position) : this.lastTier;
    if (pl.body.grounded) {
      if (tier < this.lastTier && !this.fallTipShown && this.lastTier > 0) {
        this.fallTipShown = true;
        g.tip(LINES.level9Fall);
      }
      this.lastTier = tier;
    }
  }

  private async finish() {
    const g = this.game;
    g.player.frozen = true;
    await this.diveIntoChimney();
    await g.completeLevel();
  }
}

/** A point `t` metres round the edge of a square of half-size `h` (and which way it heads). */
function squareLoop(t: number, h: number) {
  const side = 2 * h;
  const k = ((t % (4 * side)) + 4 * side) % (4 * side);
  const leg = Math.floor(k / side);
  const u = k - leg * side - h;
  if (leg === 0) return { x: u, z: -h, heading: Math.PI / 2 };
  if (leg === 1) return { x: h, z: u, heading: 0 };
  if (leg === 2) return { x: -u, z: h, heading: -Math.PI / 2 };
  return { x: -h, z: -u, heading: Math.PI };
}
