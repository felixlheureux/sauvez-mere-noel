import { type Mesh, MeshBuilder, TransformNode, Vector3 } from "@babylonjs/core";
import { CLIPS } from "../anim/clips";
import { createElf, createMereNoel } from "../assets/characters";
import { sound } from "../audio/Sound";
import {
  ELF_BASIC,
  ELF_BOMBER,
  ELF_SPRINTER,
  ELF_THROWER,
  type Elf,
  type ElfTuning,
  FOUETTARD,
  FOUETTARD_LAST,
  FOUETTARD_RAGE,
  FOUETTARD_SKY,
  MAX_ALIVE,
  NUTCRACKER,
  REINDEER,
  SNOWMAN,
} from "../enemies/Elf";
import { LINES, type Line, OBJ, T, WEAPON_NAMES } from "../i18n/fr-QC";
import { hud } from "../ui/store";
import { MOODS } from "../world/Environment";
import { Level } from "../world/Level";
import type { Npc } from "../world/Npc";
import type { Collider } from "../world/Physics";

// ---------- The square ----------

/** The square: centre and the radius of the ring of burning houses (gap to the south). */
export const SQUARE = { x: 0, z: 0, r: 26 };
/** Where the village ends: the play area's radius, just inside a ring of dead pines. */
const EDGE = 60;
/** The dead giant tree at its centre (1.4× the prop: a ~20 m trunk). */
export const TREE = { x: 0, z: 0, scale: 1.4 };
/** The cage hangs from a branch reaching south, in front of the trunk; `top` is the branch. */
export const CAGE = { x: 0, z: -6, top: 11, hang: 4.6 };
/** Four thick posts: bait the charging Fouettard (phase 2) into them. */
export const PILLARS = [0, 1, 2, 3].map((i) => {
  const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
  return { x: Math.sin(a) * 11, z: Math.cos(a) * 11 };
});
/** Fouettard's perch for phase 3: a branch platform on the side you come from. */
export const PERCH = { x: -3.4, z: -2.2, y: 7 };
/**
 * In phase 3 three ropes hold his platform up, staked to the ground on the side away from
 * the trunk. Cut them all and the platform (and he) comes crashing down.
 */
export const STAKES = [-1, 0, 1].map((k) => {
  const out = Math.atan2(PERCH.x - TREE.x, PERCH.z - TREE.z);
  const a = out + k * 0.9;
  return { x: PERCH.x + Math.sin(a) * 5, z: PERCH.z + Math.cos(a) * 5 };
});
export const STAKE_HP = 15;
const CRATE = new Vector3(0, 0, -49);
/** The ending: the restored tree's height, where its star sits, the feast table, the elves. */
export const ENDING = {
  treeH: 16,
  starY: 14.3,
  table: { x: 0, z: -14 },
  elves: 10,
  /** Santa's mark for the ending (facing the tree and the cage), so every shot is fixed. */
  santa: { x: 0, z: -17 },
};

// ---------- Père Fouettard: four phases ----------

/** His special moves (on top of his phase behaviour). All telegraphed. */
export type Move = "spin" | "coalRain" | "bombs" | "summon";
/** The whip spin: telegraph time, reach, damage. */
export const SPIN = { telegraph: 0.8, radius: 5.5, damage: 20 };

interface Phase {
  tuning: ElfTuning;
  /** Where he is when it starts (perched in the tree for phase 3). */
  at: Vector3;
  perched?: boolean;
  lines: readonly Line[];
  /** Phase 3 ends when his platform comes down (the stakes cut), not on HP. */
  endsWhenPerchFalls?: boolean;
  moves: Move[];
  /** Seconds between special moves. */
  every: number;
  wave: { roster: ElfTuning[]; total: number; maxAlive: number };
}

export const PHASES: Phase[] = [
  {
    tuning: FOUETTARD,
    at: new Vector3(7, 0, -12),
    lines: LINES.level10Square,
    moves: ["spin", "coalRain", "summon"],
    every: 4.5,
    wave: {
      roster: [ELF_BASIC, ELF_SPRINTER, ELF_BASIC, ELF_THROWER],
      total: 16,
      maxAlive: 8,
    },
  },
  {
    tuning: FOUETTARD_RAGE,
    at: new Vector3(7, 0, -12),
    lines: LINES.level10Charge,
    moves: ["spin", "summon"],
    every: 6,
    wave: {
      roster: [ELF_BOMBER, ELF_BASIC, REINDEER, ELF_SPRINTER, ELF_THROWER],
      total: 14,
      maxAlive: 8,
    },
  },
  {
    tuning: FOUETTARD_SKY,
    at: new Vector3(PERCH.x, PERCH.y, PERCH.z),
    perched: true,
    lines: LINES.level10Sky,
    endsWhenPerchFalls: true,
    moves: ["bombs", "coalRain"],
    every: 4,
    wave: {
      roster: [NUTCRACKER, ELF_BASIC, ELF_SPRINTER, ELF_THROWER, ELF_BOMBER, REINDEER],
      total: 18,
      maxAlive: 10,
    },
  },
  {
    tuning: FOUETTARD_LAST,
    at: new Vector3(-6, 0, -9),
    lines: LINES.level10Last,
    moves: ["spin", "coalRain", "bombs", "summon"],
    every: 3,
    wave: {
      roster: [
        ELF_BASIC,
        ELF_SPRINTER,
        NUTCRACKER,
        ELF_BOMBER,
        REINDEER,
        SNOWMAN,
        ELF_THROWER,
        ELF_BASIC,
      ],
      total: 24,
      maxAlive: 12,
    },
  },
];

const AVENUE_SPOTS = [
  [-6, -44],
  [6, -40],
  [-5, -34],
  [6, -31],
].map(([x, z]) => new Vector3(x as number, 0, z as number));
const SQUARE_SPOTS = [
  [-15, -10],
  [15, -10],
  [-15, 10],
  [15, 10],
  [0, 17],
].map(([x, z]) => new Vector3(x as number, 0, z as number));
const AVENUE_ROSTER: ElfTuning[] = [
  ELF_BASIC,
  ELF_SPRINTER,
  ELF_BASIC,
  NUTCRACKER,
  ELF_BOMBER,
  ELF_BASIC,
  ELF_THROWER,
  REINDEER,
  ELF_SPRINTER,
  SNOWMAN,
];

/**
 * Niveau 10 — Le Village Cauchemar.
 * Home, twisted: an avenue of burning houses, then the square, where Mère Noël hangs in
 * a cage from the dead giant tree and Père Fouettard fights in four phases (the table
 * above). Each phase opens on a cutscene (he can't be hurt during it), brings its own
 * wave, and ends straight into the next. Then Christmas comes back.
 */
export class Level10 extends Level {
  readonly id = 10;
  readonly name = "Le Village Cauchemar";
  readonly mood = MOODS.twisted;
  override darkness = 10;
  override theme = "silent" as const;
  override arenaRadius = EDGE;
  override newGun = "star" as const;
  private fouettard: Elf | null = null;
  private cage: TransformNode | null = null;
  private chain: Mesh | null = null;
  private readonly ropes: (Mesh | null)[] = [];
  private stakesLeft = STAKES.length;
  private mere: Npc | null = null;
  private mereFree = false;
  private deadTree: Mesh | null = null;
  private summoned = 0;
  /** The current phase's kinds of enemy (what he summons). */
  private pool: ElfTuning[] = [ELF_BASIC];
  private perch: Mesh | null = null;
  private perchDown = false;
  private perchCollider: Collider | null = null;
  private gallows: Mesh | null = null;

  build() {
    const g = this.game;
    const p = g.props;
    this.spawnPos = new Vector3(0, 0, -55);
    this.spawnYaw = 0;
    this.place(p.ground(75, 10), 0, 0, { shadow: false });
    this.place(p.mountains(90, 10), 0, 0, { shadow: false });

    // ---- The avenue: burning houses on both sides ----
    for (let z = -56; z <= -32; z += 8) {
      for (const sx of [-1, 1]) {
        const x = sx * 13;
        const rot = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
        this.place(p.gingerbreadHouse(5, 5, 3.2, Math.round(z) + (sx > 0 ? 50 : 0)), x, z, { rot });
        this.houseSolid(x, z, 5, 5, 3.2, rot);
        this.pointLight(new Vector3(x - sx * 3, 2.5, z), "#ff6a30", 1.6, 11);
      }
    }

    // ---- The square: a ring of houses, the dead giant tree, four posts ----
    const ring: number[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (Math.abs(Math.cos(a) + 1) < 0.3) continue; // the gap the avenue comes in by
      ring.push(a);
      const x = SQUARE.x + Math.sin(a) * SQUARE.r;
      const z = SQUARE.z + Math.cos(a) * SQUARE.r;
      const rot = Math.atan2(-x, -z);
      this.place(p.gingerbreadHouse(6, 5, 3.4, 70 + i), x, z, { rot });
      this.houseSolid(x, z, 6, 5, 3.4, rot);
    }
    // You can walk between and behind every house. The village's edge is a dense ring of
    // dead pines, and the play area ends right at that tree line (nothing invisible before).
    const pines: [number, number, number][] = [];
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2;
      const r = EDGE + 2 + (k % 3) * 1.6;
      pines.push([Math.sin(a) * r, Math.cos(a) * r, 0.9 + (k % 4) * 0.12]);
    }
    this.forest(pines, 10);
    this.deadTree = this.place(p.deadTree(), TREE.x, TREE.z, { scale: TREE.scale });
    // The trunk, and its roots (a low ring you can't walk through).
    this.solid(TREE.x, TREE.z, 2.6, 20, 2.6);
    this.solid(TREE.x, TREE.z, 5.2, 0.9, 5.2);
    this.gallows = this.place(p.gallowsBranch(Math.abs(CAGE.z - TREE.z) + 0.6), TREE.x, TREE.z, {
      y: CAGE.top,
      rot: Math.PI,
    });
    for (const pl of PILLARS) {
      this.place(
        g.protoClone("corralPost", () => p.corralPost()),
        pl.x,
        pl.z,
      );
      this.solid(pl.x, pl.z, 1.2, 4, 1.2);
      this.pointLight(new Vector3(pl.x, 4.5, pl.z), "#ff5030", 1.4, 10);
    }
    this.perch = this.place(p.plank(3), PERCH.x, PERCH.z, { y: PERCH.y, rot: 0.6 });
    this.perchCollider = this.solid(PERCH.x, PERCH.z, 2.4, 0.2, 1.6, PERCH.y - 0.2);

    // ---- Mère Noël in her cage, hung from the branch (until the very end) ----
    const cage = new TransformNode("cageRig", g.scene);
    cage.parent = g.levelRoot;
    cage.position.set(CAGE.x, CAGE.top - CAGE.hang, CAGE.z);
    p.cage().parent = cage;
    this.cage = cage;
    this.chain = this.cord("cageChain", 0.12, "darkGrey");
    const mere = this.npc(createMereNoel(g.scene, g.mats), CAGE.x, CAGE.z, Math.PI);
    mere.lookRange = 0;
    mere.setIdle(CLIPS.scared);
    this.mere = mere;

    // ---- Collectibles ----
    this.bell(-13, 3.4 + 0.8, -48);
    this.bell(PILLARS[0]?.x ?? 0, 4.8, PILLARS[0]?.z ?? 0);
    this.bell(PERCH.x, PERCH.y + 0.8, PERCH.z);
    this.candyLine(0, -52, 0, -28, 9);
    this.candyRing(0, 0, 15, 14);

    // ---- Health and power-ups ----
    this.health(-7, -46, false);
    this.health(7, -36, false);
    this.buff("rage", 0, -30);
    this.health(-18, 0, true);
    this.health(18, 0, true);
    this.buff("shield", 0, 18);

    // ---- Checkpoints: the avenue, then one before each phase ----
    this.addCheckpoint(this.spawnPos.x, this.spawnPos.z, 0);
    for (let i = 0; i < PHASES.length; i++) this.addCheckpoint(0, -22, 0);
  }

  /** A unit-length cylinder (rope, chain) stretched between two points each frame. */
  private cord(name: string, diameter: number, c: "wood" | "darkGrey") {
    const g = this.game;
    const m = MeshBuilder.CreateCylinder(name, { diameter, height: 1, tessellation: 5 }, g.scene);
    m.material = g.mats.glow(g.colorOf(c), 0.1);
    m.parent = g.levelRoot;
    m.isPickable = false;
    return m;
  }

  // ---------- Script ----------

  async run() {
    const g = this.game;
    this.startTime = g.time;
    const cp = this.startCheckpoint;

    if (cp === 0) {
      await this.intro();
      g.objective(OBJ.getStar, CRATE.add(new Vector3(0, 1, 0)));
      await new Promise<void>((resolve) => {
        this.pickup(
          g.props.weaponCrate(),
          CRATE,
          () => {
            g.player.giveGun("star");
            sound.bell();
            g.toast(T.newWeapon, WEAPON_NAMES.star);
            resolve();
          },
          1.2,
        );
      });
      await g.say(LINES.level10Gun);
      g.objective(OBJ.crossVillage);
      await this.horde(AVENUE_SPOTS, AVENUE_ROSTER, { total: 30, maxAlive: 16 });
      g.objective(OBJ.toSquare, new Vector3(0, 1.5, -22));
      await this.untilZ(-23);
    }
    for (let i = Math.max(0, cp - 1); i < PHASES.length; i++) {
      this.reachCheckpoint(i + 1);
      await this.phase(i);
    }
    await this.defeat();
    await this.ending();
    await g.completeLevel();
  }

  /** Opening: the burning avenue, the dead tree beyond. */
  private async intro() {
    const g = this.game;
    g.cinematic(true);
    const from = new Vector3(-5, 6, -60);
    const to = new Vector3(0, 6, -10);
    g.camRig.cut(from, to);
    g.camRig.cut(Vector3.Lerp(from, to, 0.12), to, 7);
    await g.say(LINES.level10Intro);
    g.cinematic(false);
  }

  /**
   * One phase: a cutscene (he's shielded), then the fight — his health bar, his special
   * moves and the phase's wave — until it ends (0 HP, or the cage down for phase 3).
   */
  private async phase(i: number) {
    const g = this.game;
    const ph = PHASES[i] as Phase;
    const e = this.bossFor(ph);
    await this.phaseCutscene(e, ph, i);
    e.shielded = false;
    e.dormant = false;
    e.aggro = true;
    e.setState("chase");
    this.pool = ph.wave.roster;
    if (ph.endsWhenPerchFalls) {
      this.rigPerch();
      g.objective(OBJ.cutStakes(this.stakesLeft), this.nextStake());
    } else g.objective(i === PHASES.length - 1 ? OBJ.finishFouettard : OBJ.beatFouettard);
    if (i === 0) g.tip(LINES.level10WhipTip);
    const over = () => !e.alive || e.phaseOver;
    void this.horde(SQUARE_SPOTS, ph.wave.roster, { ...ph.wave, every: 2.2, until: over });
    void this.moveset(e, ph, over);
    while (!over()) {
      if (ph.endsWhenPerchFalls && this.perchDown) e.phaseOver = true;
      hud.set({
        boss: {
          name: "Le Père Fouettard",
          hp: ph.endsWhenPerchFalls ? this.stakesLeft : Math.max(0, e.hp),
          max: ph.endsWhenPerchFalls ? STAKES.length : ph.tuning.hp,
          phase: i + 1,
        },
      });
      await g.wait(0.1);
    }
    hud.set({ boss: null });
    // A breather: health for the next round.
    if (i < PHASES.length - 1) {
      this.health(-5, -16, true);
      this.health(5, -16, false);
    }
  }

  /** The one Père Fouettard: spawned for phase 1, retuned in place after that. */
  private bossFor(ph: Phase) {
    const g = this.game;
    const ppos = g.player.body.position;
    const at = ph.at.clone();
    const yaw = Math.atan2(ppos.x - at.x, ppos.z - at.z);
    let e = this.fouettard;
    if (!e?.alive) {
      e = g.enemies.spawn(at, { tuning: ph.tuning, perched: ph.perched, yaw });
      this.fouettard = e;
    } else {
      g.fx.puff(e.center, "coal", 30, 1.6);
      e.retune(ph.tuning);
      e.perched = ph.perched ?? false;
      e.body.position.copyFrom(at);
      e.body.velocity.setAll(0);
      e.yaw = yaw;
      g.fx.puff(at.add(new Vector3(0, 1.2, 0)), "coal", 30, 1.6);
    }
    e.dormant = true;
    e.shielded = true;
    return e;
  }

  /** A hand-placed shot of him and Mère Noël's cage while they talk; the night darkens. */
  private async phaseCutscene(e: Elf, ph: Phase, i: number) {
    const g = this.game;
    g.cinematic(true);
    g.player.frozen = true;
    sound.growl();
    g.camRig.shake(0.4 + i * 0.1);
    e.rig.flash(0.6);
    g.env.fogScale = 1 + i * 0.2;
    sound.setDarkness(Math.min(1, 0.7 + i * 0.1));
    const him = e.body.position.add(new Vector3(0, 2.4, 0));
    const cage = new Vector3(CAGE.x, (this.cage?.position.y ?? 0) + 1.4, CAGE.z);
    const look = Vector3.Lerp(him, cage, 0.4);
    g.camRig.cut(new Vector3(-9, 5.5, -24), look);
    g.camRig.cut(new Vector3(-8, 5, -21.5), look, 4);
    if (i === 0) await g.say(LINES.level10Mere);
    await g.say(ph.lines);
    g.cinematic(false);
    g.player.frozen = false;
  }

  // ---------- His special moves ----------

  private async moveset(e: Elf, ph: Phase, over: () => boolean) {
    const g = this.game;
    let k = 0;
    while (!over()) {
      await g.wait(ph.every);
      if (over() || e.dormant || e.stunned || g.player.dead) continue;
      const move = ph.moves[k++ % ph.moves.length] as Move;
      await this.special(e, move);
    }
  }

  private async special(e: Elf, move: Move): Promise<void> {
    const g = this.game;
    const ppos = g.player.body.position;
    const near = (spread: number) =>
      ppos.add(new Vector3((Math.random() - 0.5) * spread, 0, (Math.random() - 0.5) * spread));
    switch (move) {
      case "spin": {
        // Only worth it close up: he winds up (red flash, ring), then lashes all round.
        if (Vector3.Distance(e.body.position, ppos) > 9) return this.special(e, "coalRain");
        // He plants himself for the wind-up and the lash (a committed, readable attack).
        e.dormant = true;
        sound.growl();
        e.rig.flash(SPIN.telegraph);
        g.fx.ring(e.body.position, SPIN.radius);
        await g.wait(SPIN.telegraph);
        if (!e.alive) return;
        sound.whooshLong();
        g.fx.ring(e.body.position, SPIN.radius);
        g.fx.puff(e.center, "coal", 24, 1.8);
        const d = Vector3.Distance(e.body.position, ppos);
        if (d < SPIN.radius && ppos.y < e.body.position.y + 1.3)
          g.player.hurt(SPIN.damage, e.body.position, 12, 0.4);
        await g.wait(0.3);
        if (!e.phaseOver) e.dormant = false;
        return;
      }
      case "coalRain":
        for (let i = 0; i < 6; i++) {
          g.projectiles.throwCoal(e.center.add(new Vector3(0, 1.5, 0)), near(7), 1.2, 12);
          await g.wait(0.15);
        }
        return;
      case "bombs":
        for (let i = 0; i < 4; i++) {
          g.projectiles.throwBomb(e.center.add(new Vector3(0, 1, 0)), near(6), 1.3, 18);
          await g.wait(0.25);
        }
        return;
      case "summon": {
        if (g.enemies.aliveCount > MAX_ALIVE - 3) return;
        sound.growl();
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          g.enemies.spawnFromGift(
            e.body.position.add(new Vector3(Math.cos(a) * 3, 0, Math.sin(a) * 3)),
            // Reinforcements from this phase's own pool (each phase adds new kinds).
            this.pool[(this.summoned++ + i) % this.pool.length] as ElfTuning,
          );
        }
        return;
      }
    }
  }

  /**
   * At 0 HP in the last phase: he staggers, gasps — and bursts apart, all over the square.
   * The elves still standing vanish in gold (they come back to themselves in the ending).
   */
  private async defeat() {
    const g = this.game;
    const e = this.fouettard;
    hud.set({ boss: null, combo: 0, toasts: [] });
    g.objective("");
    g.enemies.dropPending();
    g.projectiles.clear();
    for (const o of g.enemies.elves) {
      if (!o.alive || o === e) continue;
      g.fx.sparkle(o.center, 20);
      o.rig.setEnabled(false);
      o.setState("dead");
    }
    if (!e) return;
    e.dormant = true;
    e.shielded = true;
    g.cinematic(true);
    g.player.frozen = true;
    e.anim.play(CLIPS.hurt);
    const him = e.body.position.add(new Vector3(0, 1.8, 0));
    g.camRig.cut(him.add(new Vector3(-4.5, 1.2, -5.5)), him);
    g.camRig.cut(him.add(new Vector3(-3.8, 1, -4.6)), him, 3);
    await g.say(LINES.level10Defeat);
    // The burst: his body flies apart, blood everywhere.
    const center = e.center.clone();
    const away = center.subtract(g.player.body.position);
    away.y = 0;
    g.hitstop(0.25);
    g.camRig.shake(0.9);
    sound.explosion();
    sound.splat();
    g.gore.explode(e.rig, away.normalize(), 3, true);
    for (let i = 0; i < 4; i++) {
      g.gore.burst(center.add(new Vector3(0, i * 0.4, 0)), null, 160);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = 1.5 + (i % 4) * 1.4;
      g.gore.splat(center.add(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)), 1.6);
    }
    g.fx.puff(center, "coal", 40, 2.2);
    e.setState("dead");
    this.fouettard = null;
    await g.wait(2.5);
  }

  /**
   * The ending. The star that started it all (placed on the tree in level 0, the night
   * went wrong) goes home: it flies from Santa's hands to the top of the dead tree, and
   * its light washes the nightmare away — the blood, the dead tree, the red sky. The cage
   * comes down, Mère Noël runs to Santa, the elves come back to themselves, and everyone
   * sits down to the réveillon. The camera rises to the star.
   */
  private async ending() {
    const g = this.game;
    const pl = g.player;
    // Cutscene mark: Santa in front of the tree and the cage, so every shot is fixed.
    pl.body.position.set(ENDING.santa.x, 0, ENDING.santa.z);
    pl.body.velocity.setAll(0);
    pl.yaw = Math.atan2(CAGE.x - ENDING.santa.x, CAGE.z - ENDING.santa.z);
    const santa = pl.body.position.clone();
    const mere = this.mere;

    // 1. From her cage: "it's just missing the star". The star rises from Santa's hands.
    const cageAt = new Vector3(CAGE.x, (this.cage?.position.y ?? 0) + 1.3, CAGE.z);
    g.camRig.cut(
      new Vector3(-6, 3.5, -25),
      Vector3.Lerp(cageAt, santa.add(new Vector3(0, 1.4, 0)), 0.5),
    );
    await g.say(LINES.level10Star);
    const star = g.props.starPickup();
    star.parent = g.levelRoot;
    const from = santa.add(new Vector3(0, 2.4, 0));
    const top = new Vector3(TREE.x, ENDING.starY, TREE.z);
    g.camRig.cut(new Vector3(-12, 3, -26), from);
    g.camRig.cut(new Vector3(-13, 6, -28), top, 2.8);
    sound.bell();
    await g.tween(2.8, (k) => {
      star.position.copyFrom(Vector3.Lerp(from, top, k));
      star.position.y += Math.sin(k * Math.PI) * 2;
      star.rotation.y = k * Math.PI * 6;
      if (Math.random() < 0.3) g.fx.sparkle(star.position, 4);
    });

    // 2. The burst of light: the blood is gone, the dead tree grows back into the great
    //    Christmas tree, the sky clears, the music comes back.
    g.fx.sparkle(top, 120);
    g.fx.ring(new Vector3(TREE.x, 0, TREE.z), SQUARE.r);
    sound.open();
    g.camRig.shake(0.35);
    g.gore.reset();
    this.deadTree?.setEnabled(false);
    this.gallows?.setEnabled(false);
    this.perch?.setEnabled(false);
    const tree = this.place(g.props.bigTree(ENDING.treeH), TREE.x, TREE.z, { scale: 0.01 });
    g.env.setMood(MOODS.cute, 3);
    g.env.fogScale = 1;
    sound.setDarkness(0);
    sound.setTheme("jingle");
    sound.startMusic();
    g.camRig.cut(new Vector3(-17, 8, -32), new Vector3(0, 7, 0));
    g.camRig.cut(new Vector3(-15, 8, -28), new Vector3(0, 7, 0), 3.5);
    await g.tween(2.5, (k) => {
      tree.scaling.setAll(0.01 + 0.99 * (1 - (1 - k) ** 3));
    });

    // 3. The cage comes down and opens. Mère Noël runs to Santa.
    const cage = this.cage;
    if (cage) {
      g.camRig.cut(new Vector3(-7, 2.8, CAGE.z - 9), new Vector3(CAGE.x, 1.5, CAGE.z));
      const y0 = cage.position.y;
      await g.tween(1.6, (k) => {
        cage.position.y = y0 * (1 - k * k);
      });
      g.camRig.shake(0.15);
      this.openCage();
    }
    await g.say(LINES.level10Freed);
    if (mere) {
      mere.setIdle(null);
      await mere.moveTo(santa.add(new Vector3(1.3, 0, 0.4)), 4);
      mere.yaw = Math.atan2(santa.x - mere.position.x, santa.z - mere.position.z);
      pl.yaw = Math.atan2(mere.position.x - santa.x, mere.position.z - santa.z);
    }
    const mid = Vector3.Lerp(santa, mere?.position ?? santa, 0.5).add(new Vector3(0, 1.4, 0));
    g.camRig.cut(mid.add(new Vector3(-3.6, 1, -3.4)), mid);
    g.camRig.cut(mid.add(new Vector3(-3, 0.9, -2.8)), mid, 5);
    await g.say(LINES.level10Reunion);

    // 4. The elves come back to themselves, all round the square.
    const elves: Npc[] = [];
    for (let i = 0; i < ENDING.elves; i++) {
      const a = (i / ENDING.elves) * Math.PI * 2 + 0.3;
      const x = Math.sin(a) * 9;
      const z = ENDING.table.z + 1 + Math.cos(a) * 6;
      const elf = this.npc(
        createElf(g.scene, g.mats, "friendly", 200 + i),
        x,
        z,
        Math.atan2(-x, ENDING.table.z - z),
      );
      elf.setIdle(CLIPS.cheer);
      elves.push(elf);
      g.fx.puff(new Vector3(x, 0.6, z), "gold", 16, 1.2);
    }
    sound.bell();
    g.camRig.cut(new Vector3(-12, 5, -30), new Vector3(0, 1.5, ENDING.table.z));
    await g.say(LINES.level10Elves);

    // 5. The réveillon under the great tree.
    const t = ENDING.table;
    this.place(g.props.feastTable(8), t.x, t.z, { shadow: false });
    this.place(g.props.tourtiere(), t.x - 2, t.z, { y: 1.1, shadow: false });
    this.place(g.props.buche(), t.x + 1.5, t.z, { y: 1.1, shadow: false });
    this.place(g.props.tourtiere(), t.x + 3.2, t.z, { y: 1.1, shadow: false });
    pl.body.position.set(t.x - 1.2, 0, t.z - 2);
    pl.yaw = 0;
    if (mere) {
      mere.position.set(t.x + 1.2, 0, t.z - 2);
      mere.yaw = 0;
      mere.setIdle(CLIPS.cheer);
    }
    elves.slice(0, 6).forEach((elf, i) => {
      elf.position.set(t.x - 3 + (i % 3) * 3, 0, t.z + (i < 3 ? 2.2 : -2.6));
      elf.yaw = i < 3 ? Math.PI : 0;
    });
    g.camRig.cut(new Vector3(-9, 4.5, t.z - 11), new Vector3(t.x, 1.4, t.z));
    g.camRig.cut(new Vector3(-7.5, 4, t.z - 9), new Vector3(t.x, 1.4, t.z), 6);
    await g.say(LINES.level10Feast);

    // 6. The camera rises from the table to the star and the night sky.
    g.camRig.cut(new Vector3(0, 3, t.z - 10), new Vector3(t.x, 1.4, t.z));
    g.camRig.cut(new Vector3(0, ENDING.starY + 8, t.z - 22), top, 6);
    await g.wait(6.5);
    // Stays cinematic (no HUD popping back) until the score card covers it.
  }

  // ---------- Phase 3: the ropes holding his perch ----------

  /** He climbs to his platform: three ropes hold it up, staked to the ground. */
  private rigPerch() {
    const p = this.game.props;
    this.stakesLeft = STAKES.length;
    STAKES.forEach((s, i) => {
      this.breakable(p.chainPost(), s.x, s.z, 0.8, 1.6, STAKE_HP, () => this.cutRope(i));
      this.ropes[i] = this.cord(`rope${i}`, 0.08, "wood");
    });
  }

  private nextStake() {
    const i = this.ropes.findIndex((r) => r !== null);
    const s = STAKES[i];
    return s ? new Vector3(s.x, 1.4, s.z) : undefined;
  }

  /** A stake breaks and its rope goes slack; with the last one, the platform falls. */
  private cutRope(i: number) {
    const g = this.game;
    this.stakesLeft--;
    this.ropes[i]?.dispose();
    this.ropes[i] = null;
    g.objective(OBJ.cutStakes(this.stakesLeft), this.nextStake());
    sound.smash();
    const perch = this.perch;
    if (!perch) return;
    if (this.stakesLeft > 0) {
      // It sags a little each time.
      perch.rotation.z += 0.12;
      g.camRig.shake(0.1);
      return;
    }
    if (this.perchCollider) this.perchCollider.enabled = false;
    const y0 = perch.position.y;
    sound.explosion();
    g.camRig.shake(0.4);
    void g
      .tween(0.7, (k) => {
        perch.position.y = y0 * (1 - k * k);
        perch.rotation.z += 0.05;
      })
      .then(() => {
        g.fx.puff(perch.position.add(new Vector3(0, 0.5, 0)), "snow", 40, 2);
        this.perchDown = true;
      });
  }

  /** The cage reaches the ground and opens: Mère Noël steps out. */
  private openCage() {
    const g = this.game;
    if (this.cage) g.fx.sparkle(this.cage.position.add(new Vector3(0, 1.5, 0)), 60);
    this.cage?.dispose();
    this.cage = null;
    this.chain?.dispose();
    this.chain = null;
    this.mereFree = true;
    if (this.mere) {
      this.mere.position.set(CAGE.x, 0, CAGE.z);
      this.mere.lookRange = 40;
    }
  }

  // ---------- Per frame: the cage's chain, the perch's ropes ----------

  override tick(_dt: number) {
    const cage = this.cage;
    if (cage && this.mere && !this.mereFree) {
      this.mere.position.set(CAGE.x, cage.position.y + 0.15, CAGE.z);
    }
    if (cage && this.chain) {
      stretch(
        this.chain,
        new Vector3(CAGE.x, CAGE.top, CAGE.z),
        cage.position.add(new Vector3(0, 2.95, 0)),
      );
    }
    const perch = this.perch;
    this.ropes.forEach((rope, i) => {
      const s = STAKES[i];
      if (rope && s && perch)
        stretch(rope, new Vector3(s.x, 1.5, s.z), perch.position.add(new Vector3(0, -0.05, 0)));
    });
  }

  private async untilZ(z: number) {
    while (this.game.player.body.position.z < z) await this.game.wait(0.15);
  }
}

/** Stretch a unit-height cylinder from `a` to `b`. */
function stretch(m: Mesh, a: Vector3, b: Vector3) {
  const d = b.subtract(a);
  m.position.copyFrom(a.add(d.scale(0.5)));
  m.scaling.y = d.length();
  m.lookAt(b);
  m.rotation.x += Math.PI / 2;
}
