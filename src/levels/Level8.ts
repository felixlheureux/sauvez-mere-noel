import { Vector3 } from "@babylonjs/core";
import { createReindeer } from "../assets/characters";
import { sound } from "../audio/Sound";
import { pick } from "../core/math";
import type { Elf } from "../enemies/Elf";
import {
  COMETE,
  ELF_BASIC,
  ELF_BOMBER,
  ELF_SPRINTER,
  ELF_THROWER,
  type ElfTuning,
  REINDEER,
} from "../enemies/Elf";
import { LINES, OBJ, T, WEAPON_NAMES } from "../i18n/fr-QC";
import { hud } from "../ui/store";
import { MOODS } from "../world/Environment";
import { Level } from "../world/Level";
import type { Npc } from "../world/Npc";
import type { Collider } from "../world/Physics";

// Three areas along z: the paddock (a fenced snowfield), the burned stable (an aisle
// between stalls), and the corral where Comète waits.
/** The paddock's fence: x half-width, south and north z. Gate at x −3..3 on the north side. */
export const PADDOCK = { half: 20, south: -56, north: -16 };
/** The stable: x half-width, south and north wall z, aisle half-width, wall height. */
export const BARN = { half: 9, south: -14, north: 22, aisle: 2.5, h: 5 };
/** Stall partitions along the barn (z), both sides. */
const PARTITIONS = [-10, -5.5, -1, 3.5, 8, 12.5, 17];
/** The four captive reindeer: stall centre, and the chain post at the stall's front. */
export const CAPTIVES = [
  { x: -6, z: -3.25 },
  { x: 6, z: 1.25 },
  { x: -6, z: 10.25 },
  { x: 6, z: 14.75 },
].map((c) => ({ ...c, postX: Math.sign(c.x) * 3.2 }));
export const CHAIN_HP = 4;
/** The corral: centre, fence radius, and the six thick posts to bait Comète into. */
export const CORRAL = { x: 0, z: 42, r: 15, postR: 8 };
export const POSTS = [0, 1, 2, 3, 4, 5].map((i) => {
  const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
  return { x: CORRAL.x + Math.sin(a) * CORRAL.postR, z: CORRAL.z + Math.cos(a) * CORRAL.postR };
});
const CRATE = new Vector3(0, 0, -45);
/** Where the hordes drop in (paddock corners, the stalls, round the corral). */
const PADDOCK_SPOTS = [
  [12, -22],
  [-10, -24],
  [-8, -34],
  [9, -36],
  [0, -20],
].map(([x, z]) => new Vector3(x, 0, z));
const STALL_SPOTS = [
  [-6, 5.75],
  [6, -3.25],
  [-6, -12],
  [6, 10.25],
  [6, 19.5],
].map(([x, z]) => new Vector3(x, 0, z));
const CORRAL_SPOTS = [
  [-9, 36],
  [9, 36],
  [-9, 48],
  [9, 48],
].map(([x, z]) => new Vector3(x, 0, z));
const PADDOCK_ROSTER: ElfTuning[] = [
  ELF_BASIC,
  ELF_BASIC,
  ELF_SPRINTER,
  ELF_BASIC,
  ELF_THROWER,
  REINDEER,
  ELF_BASIC,
  ELF_SPRINTER,
  ELF_BOMBER,
  ELF_BASIC,
  REINDEER,
];
const STABLE_ROSTER: ElfTuning[] = [
  ELF_BASIC,
  ELF_BASIC,
  ELF_THROWER,
  ELF_SPRINTER,
  ELF_BASIC,
  ELF_BOMBER,
  ELF_SPRINTER,
];
const GATE_HALF = 3;

/**
 * Niveau 8 — Les Écuries des Rennes.
 * Under a blood moon, Santa's reindeer are possessed: they lower their heads and
 * charge. Dodge (Q), bait them into posts and fences to daze them, free the captive
 * ones in the burned stable, then face Comète Démoniaque in the corral.
 */
export class Level8 extends Level {
  readonly id = 8;
  readonly name = "Les Écuries des Rennes";
  readonly mood = MOODS.bloodMoon;
  override darkness = 8;
  override theme = "silent" as const;
  override arenaRadius = 70;
  override newGun = "crossbow" as const;
  private readonly captives: (Npc | null)[] = [];
  private chainsLeft = CAPTIVES.length;
  /** The corral's gate: open until Comète's fight starts, and again after. */
  private gateColliders: Collider[] = [];
  private comete: Elf | null = null;
  private secondWave = false;

  build() {
    const g = this.game;
    const p = g.props;
    this.spawnPos = new Vector3(0, 0, -51);
    this.spawnYaw = 0;
    this.place(p.ground(75, 8), 0, 0, { shadow: false });
    this.place(p.mountains(90, 8), 0, 0, { shadow: false });

    // ---- The paddock ----
    const { half, south, north } = PADDOCK;
    this.fence(0, south, 2 * half, 0);
    this.fence(-half, (south + north) / 2, north - south, Math.PI / 2);
    this.fence(half, (south + north) / 2, north - south, Math.PI / 2);
    for (const sx of [-1, 1]) {
      const len = half - GATE_HALF;
      this.fence(sx * (GATE_HALF + len / 2), north, len, 0);
    }
    for (const [x, z] of [
      [-9, -40],
      [8, -37],
      [-6, -28],
      [12, -25],
      [-13, -21],
    ] as const) {
      this.hay(x, z);
    }
    for (const [x, z] of [
      [-6, -34],
      [6, -30],
      [0, -23],
    ] as const) {
      this.post(x, z);
    }

    // ---- The stable: charred walls, an aisle, stalls on both sides ----
    const wall = (x: number, z: number, w: number, d: number, seed: number) => {
      this.place(p.barnWall(w, BARN.h, d, seed), x, z);
      this.solid(x, z, w, BARN.h, d);
    };
    const t = 0.5;
    const mid = (BARN.south + BARN.north) / 2;
    const len = BARN.north - BARN.south;
    wall(-BARN.half - t / 2, mid, t, len, 1);
    wall(BARN.half + t / 2, mid, t, len, 2);
    for (const [k, z] of [BARN.south, BARN.north].entries()) {
      for (const sx of [-1, 1]) {
        const w = BARN.half + t - GATE_HALF;
        wall(sx * (GATE_HALF + w / 2), z, w, t, 3 + k * 2 + (sx > 0 ? 1 : 0));
      }
    }
    const stallDepth = BARN.half - BARN.aisle;
    for (const z of PARTITIONS) {
      for (const sx of [-1, 1]) {
        const x = sx * (BARN.aisle + stallDepth / 2);
        this.place(
          g.protoClone("stall", () => p.stallWall(stallDepth)),
          x,
          z,
        );
        this.solid(x, z, stallDepth, 1.8, 0.16);
      }
    }
    CAPTIVES.forEach((c, i) => {
      const rig = createReindeer(g.scene, g.mats, false);
      const npc = this.npc(rig, c.x, c.z, c.x < 0 ? Math.PI / 2 : -Math.PI / 2);
      npc.lookRange = 0;
      this.captives.push(npc);
      // Hitbox as wide as the chains look (0.8 m), not just the thin post.
      this.breakable(p.chainPost(), c.postX, c.z, 0.8, 1.6, CHAIN_HP, () => this.free(i));
    });
    // Hay in the free stalls; two stacked by the entrance hold the stable's bell.
    this.hay(-6.4, -12);
    this.hay(-6.4, -7.75);
    this.place(p.hayBale(), -6.4, -7.75, { y: 1.1 });
    this.solid(-6.4, -7.75, 1.4, 1.1, 1.1, 1.1);
    this.hay(6.4, 5.75);
    this.hay(-6.4, 19.5);

    // ---- The corral ----
    const segs = 18;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const x = CORRAL.x + Math.sin(am) * CORRAL.r;
      const z = CORRAL.z + Math.cos(am) * CORRAL.r;
      const segLen = 2 * CORRAL.r * Math.sin(Math.PI / segs);
      // The segment facing the stable is the gate: open until the fight starts.
      const isGate = Math.abs(Math.cos(am) + 1) < 0.02;
      const rot = -am + Math.PI / 2;
      this.place(
        g.protoClone(`wfence${segLen.toFixed(1)}`, () => p.woodFence(segLen)),
        x,
        z,
        {
          rot,
        },
      );
      const cs = this.solidRotated(x, z, segLen, 1.4, 0.3, 0, rot);
      if (isGate) {
        for (const c of cs) c.enabled = false;
        this.gateColliders = cs;
      }
    }
    for (const pst of POSTS) this.post(pst.x, pst.z);

    // ---- Light: the blood moon, lanterns on the stable and corral ----
    for (const [x, z] of [
      [-4, BARN.south - 0.8],
      [4, BARN.south - 0.8],
      [0, -2],
      [0, 14],
      [-4, BARN.north + 1],
      [10, 42],
      [-10, 42],
    ] as const) {
      this.pointLight(new Vector3(x, 3.5, z), "#ff9a60", 1.5, 13);
    }

    // ---- Collectibles ----
    this.bell(-17, 0.9, -53);
    this.bell(-6.4, 2.2 + 0.8, -7.75);
    this.bell(POSTS[0]?.x ?? 0, 4.8, POSTS[0]?.z ?? 0);
    this.candyLine(0, -48, 0, -40, 4);
    this.candyLine(0, -36, 0, -18, 6);
    this.candyLine(0, BARN.south + 2, 0, BARN.north - 2, 8);
    this.candyRing(CORRAL.x, CORRAL.z, 11, 12);

    // ---- Health and power-ups ----
    this.health(15, -50, false);
    this.health(-15, -30, false);
    this.buff("speed", 15, -20);
    this.health(-6.4, 14.75 - 4.5, false);
    this.buff("shield", 6.4, -7.75);
    this.health(-11, 32, true);
    this.buff("rage", 11, 32);

    // ---- Checkpoints: the paddock, the stable door, the corral gate ----
    this.addCheckpoint(this.spawnPos.x, this.spawnPos.z, 0);
    this.addCheckpoint(0, BARN.south + 2, 0);
    this.addCheckpoint(0, CORRAL.z - CORRAL.r - 2.5, 0);

    this.exitChimney(0, CORRAL.z + CORRAL.r - 3, () => void this.finish());
  }

  private fence(x: number, z: number, length: number, rot: number) {
    const g = this.game;
    this.place(
      g.protoClone(`wfence${length}`, () => g.props.woodFence(length)),
      x,
      z,
      { rot },
    );
    if (rot === 0) this.solid(x, z, length, 1.4, 0.3);
    else this.solid(x, z, 0.3, 1.4, length);
  }

  private hay(x: number, z: number) {
    this.place(
      this.game.protoClone("hay", () => this.game.props.hayBale()),
      x,
      z,
    );
    this.solid(x, z, 1.4, 1.1, 1.1);
  }

  private post(x: number, z: number) {
    this.place(
      this.game.protoClone("corralPost", () => this.game.props.corralPost()),
      x,
      z,
    );
    this.solid(x, z, 1.2, 4, 1.2);
  }

  // ---------- Script ----------

  async run() {
    const g = this.game;
    this.startTime = g.time;
    g.env.setMoon(true);
    const cp = this.startCheckpoint;

    if (cp === 0) {
      await this.intro();
      g.objective(OBJ.getCrossbow, CRATE.add(new Vector3(0, 1, 0)));
      await new Promise<void>((resolve) => {
        this.pickup(
          g.props.weaponCrate(),
          CRATE,
          () => {
            g.player.giveGun("crossbow");
            sound.twang();
            g.toast(T.newWeapon, WEAPON_NAMES.crossbow);
            resolve();
          },
          1.2,
        );
      });
      await g.say(LINES.level8Gun);
      g.objective(OBJ.clearPaddock);
      this.spawnAt([[-12, -24]], [[REINDEER, 1]]);
      this.spawnAt([[8, -30]], [[ELF_BASIC, 4]], true);
      sound.snort();
      await g.wait(1.2);
      await g.say(LINES.level8Charge);
      await this.allDown();
      // Then the paddock fills up: a steady stream, never more than the frame budget allows.
      await this.horde(PADDOCK_SPOTS, PADDOCK_ROSTER, { total: 22, maxAlive: 14 });
      g.objective(OBJ.toBarn, new Vector3(0, 1.5, BARN.south));
      await this.untilZ(BARN.south + 1.5);
    }

    if (cp <= 1) {
      this.reachCheckpoint(1);
      g.tip(LINES.level8Barn);
      g.objective(OBJ.freeReindeer(this.chainsLeft), this.nextChain());
      // Elves keep pouring out of the stalls while you work on the chains.
      const stableHorde = this.horde(STALL_SPOTS, STABLE_ROSTER, {
        total: 26,
        maxAlive: 14,
        every: 1.5,
      });
      let charged = false;
      while (this.chainsLeft > 0) {
        await g.wait(0.3);
        // A possessed reindeer charges down the aisle after the first chain breaks,
        // and another (with sprinters) after the third.
        if (!charged && this.chainsLeft <= 3) {
          charged = true;
          this.spawnAt(
            [
              [0, BARN.north - 2],
              [-6, 19.5],
            ],
            [
              [REINDEER, 1],
              [ELF_BASIC, 4],
            ],
            true,
          );
          sound.snort();
        }
        if (charged && this.chainsLeft === 1 && !this.secondWave) {
          this.secondWave = true;
          this.spawnAt(
            [
              [0, BARN.north - 2],
              [-6, 19.5],
              [6, 19.5],
            ],
            [
              [REINDEER, 1],
              [ELF_SPRINTER, 3],
              [ELF_BASIC, 3],
            ],
            true,
          );
          sound.snort();
        }
      }
      await stableHorde;
      await this.allDown();
      await g.say(LINES.level8BarnClear);
      g.objective(OBJ.toCorral, new Vector3(0, 1.5, CORRAL.z - CORRAL.r));
      await this.untilZ(CORRAL.z - CORRAL.r - 1.5);
    } else {
      for (let i = 0; i < CAPTIVES.length; i++) this.releaseInstantly(i);
    }

    // ---- Comète ----
    this.reachCheckpoint(2);
    await this.untilZ(CORRAL.z - CORRAL.r + 2);
    for (const c of this.gateColliders) c.enabled = true;
    await this.cometeIntro();
    await this.cometeFight();
    await g.say(LINES.level8CometeDown);
    for (const c of this.gateColliders) c.enabled = false;
    this.openExit();
    g.objective(OBJ.enterChimney, this.exit?.pos);
  }

  /** Opening: the paddock under the blood moon, the burned stable beyond. */
  private async intro() {
    const g = this.game;
    g.cinematic(true);
    const from = new Vector3(-7, 8, -60);
    const to = new Vector3(0, 1.5, -24);
    g.camRig.cut(from, to);
    g.camRig.cut(Vector3.Lerp(from, to, 0.12), to, 7);
    await g.say(LINES.level8Intro);
    g.cinematic(false);
  }

  private async cometeIntro() {
    const g = this.game;
    const at = new Vector3(CORRAL.x, 0, CORRAL.z + 7);
    const e = g.enemies.spawn(at, { tuning: COMETE, yaw: Math.PI });
    e.dormant = true;
    this.comete = e;
    g.cinematic(true);
    sound.snort();
    g.camRig.cut(new Vector3(-5, 3.2, CORRAL.z - 4), new Vector3(0, 2.6, CORRAL.z + 7));
    g.camRig.cut(new Vector3(-4, 3, CORRAL.z - 1.5), new Vector3(0, 2.6, CORRAL.z + 7), 4);
    await g.say(LINES.level8Comete);
    g.cinematic(false);
    e.dormant = false;
    e.aggro = true;
    e.setState("chase");
    g.tip(LINES.level8CometeTip);
    g.objective(OBJ.beatComete);
  }

  /** The fight: a health bar, and elves joining in at half health. */
  private async cometeFight() {
    const g = this.game;
    const e = this.comete;
    if (!e) return;
    const max = COMETE.hp;
    let half = false;
    let quarter = false;
    while (e.alive) {
      hud.set({
        boss: { name: "Comète Démoniaque", hp: Math.max(0, e.hp), max, phase: half ? 2 : 1 },
      });
      if (!half && e.hp <= max / 2) {
        half = true;
        g.tip(LINES.level8CometeHalf);
        void this.horde(CORRAL_SPOTS, [ELF_BASIC, ELF_BASIC, ELF_SPRINTER], {
          total: 12,
          maxAlive: 10,
        });
      }
      if (!quarter && e.hp <= max / 4) {
        quarter = true;
        void this.horde(CORRAL_SPOTS, [ELF_BOMBER, ELF_BASIC, ELF_BASIC], {
          total: 9,
          maxAlive: 12,
        });
      }
      await g.wait(0.1);
    }
    hud.set({ boss: null });
    await this.allDown();
  }

  // ---------- Captives ----------

  private nextChain() {
    const i = this.captives.findIndex((c) => c !== null);
    const c = CAPTIVES[i];
    return c ? new Vector3(c.postX, 1.4, c.z) : undefined;
  }

  /** A chain breaks: the reindeer trots out into the aisle and out of the stable. */
  private free(i: number) {
    const g = this.game;
    this.chainsLeft--;
    const npc = this.captives[i];
    // Mark it freed first, so the waypoint moves on to the next chain (not this broken one).
    this.captives[i] = null;
    g.objective(OBJ.freeReindeer(this.chainsLeft), this.nextChain());
    if (!npc) return;
    sound.bell();
    g.bark(pick(Math.random, LINES.barksFreed));
    g.fx.sparkle(npc.position.add(new Vector3(0, 1.5, 0)), 30);
    void npc
      .moveTo(new Vector3(0, 0, npc.position.z), 5)
      .then(() => npc.moveTo(new Vector3(0, 0, BARN.north + 6), 7))
      .then(() => {
        g.fx.sparkle(npc.position.add(new Vector3(0, 1.2, 0)), 30);
        npc.rig.root.dispose();
        this.npcs.splice(this.npcs.indexOf(npc), 1);
      });
  }

  /** Resuming past the stable: the captives are already gone. */
  private releaseInstantly(i: number) {
    const npc = this.captives[i];
    if (!npc) return;
    this.captives[i] = null;
    npc.rig.root.dispose();
    this.npcs.splice(this.npcs.indexOf(npc), 1);
    const c = CAPTIVES[i];
    const b = this.breakables.find((k) => c && k.pos.x === c.postX && k.pos.z === c.z);
    if (b) {
      b.collider.enabled = false;
      b.mesh.dispose();
      this.breakables.splice(this.breakables.indexOf(b), 1);
    }
    this.chainsLeft = 0;
  }

  // ---------- Helpers ----------

  /**
   * Elves (or reindeer) in tight clusters at the given spots — each spot fills up before
   * the next, so an explosion catches several. `gifts` drops elves in evil gifts.
   */
  private spawnAt(spots: [number, number][], groups: [ElfTuning, number][], gifts = false) {
    const g = this.game;
    const ppos = g.player.body.position;
    const total = groups.reduce((s, [, c]) => s + c, 0);
    const per = Math.ceil(total / spots.length);
    let n = 0;
    for (const [tuning, count] of groups) {
      for (let i = 0; i < count; i++, n++) {
        const [cx, cz] = spots[Math.floor(n / per) % spots.length] as [number, number];
        const a = ((n % per) / per) * Math.PI * 2;
        const r = per > 1 ? 1.3 : 0;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        if (gifts && tuning !== REINDEER) {
          g.enemies.spawnFromGift(new Vector3(x, 0, z), tuning);
        } else {
          const e = g.enemies.spawn(new Vector3(x, 0, z), {
            tuning,
            yaw: Math.atan2(ppos.x - x, ppos.z - z),
          });
          e.aggro = true;
          e.setState("chase");
        }
      }
    }
    sound.growl();
  }

  private async allDown() {
    const g = this.game;
    while (
      g.enemies.elves.some((e) => e.alive && !e.perched) ||
      g.enemies.aliveCount > g.enemies.elves.filter((e) => e.alive).length
    ) {
      await g.wait(0.3);
    }
  }

  private async untilZ(z: number) {
    while (this.game.player.body.position.z < z) await this.game.wait(0.15);
  }

  private async finish() {
    const g = this.game;
    g.player.frozen = true;
    g.cinematic(true);
    await g.say(LINES.level8Done);
    g.cinematic(false);
    await this.diveIntoChimney();
    await g.completeLevel();
  }
}
