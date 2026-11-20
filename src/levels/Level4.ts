import { type Mesh, MeshBuilder, Vector3, VertexBuffer } from "@babylonjs/core";
import { color } from "../assets/Palette";
import { sound } from "../audio/Sound";
import { clamp, mulberry32, randRange, smoothstep } from "../core/math";
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

/** The yard in front of the sugar shack. */
const ARENA = new Vector3(0, 0, 0);
/** The shack: centre, width (x) and depth (z). Its door faces the yard (-z). */
const SHACK = { x: 0, z: 32, w: 20, d: 12, h: 4 };
const FRONT = SHACK.z - SHACK.d / 2;
const BACK = SHACK.z + SHACK.d / 2;
/** The trail through the maple grove winds gently. */
const trailX = (z: number) => 5 * Math.sin(z * 0.06);
const YARD_START = -24;

function terrain(x: number, z: number) {
  // Rolling hills in the grove, flattened along the trail and in the yard.
  const d = Math.abs(x - trailX(z));
  const hills =
    1.2 * Math.sin(x * 0.13 + 0.7) * Math.cos(z * 0.09) + 0.7 * Math.sin(z * 0.05 + x * 0.04);
  const trailFlat = smoothstep(clamp((d - 3) / 6, 0, 1));
  const yard = smoothstep(clamp((z - YARD_START + 8) / 8, 0, 1));
  const climb = Math.max(0, YARD_START - z) * 0.035;
  let h = (hills * (0.25 + 0.75 * trailFlat) + climb) * (1 - yard);
  // Outer walls.
  h += Math.max(0, Math.abs(x) - 30) * 1.2 + Math.max(0, z - 46) * 1.2 + Math.max(0, -z - 80) * 1.2;
  return h;
}

/**
 * Niveau 4 — La Cabane à Sucre.
 * Through a moonlit maple grove to a sugar shack where the elves' réveillon
 * has gone very wrong: syrup spills, boiling cauldrons and ornament bombs.
 */
export class Level4 extends Level {
  readonly id = 4;
  readonly name = "La Cabane à Sucre";
  readonly mood = MOODS.sugarshack;
  override darkness = 4;
  override arenaRadius = 90;
  override newGun = "flamer" as const;
  override theme = "reel" as const;
  private yardCleared = false;
  private doorLantern: Lantern | null = null;
  private cauldronTipShown = false;
  private steamTime = 0;

  build() {
    const g = this.game;
    const p = g.props;
    const rand = mulberry32(44);
    g.physics.terrain = terrain;
    g.env.setMoon(true, "#ffe9c9");
    this.spawnPos = new Vector3(trailX(-76), terrain(trailX(-76), -76), -76);
    this.spawnYaw = 0;

    this.place(this.buildTerrainMesh(), 0, -16, { shadow: false });
    this.place(p.mountains(130, 23), 0, -16, { shadow: false });

    // Checkpoints: start of the grove, yard entrance, the shack's door.
    this.addCheckpoint(trailX(-76), -76, 0);
    this.addCheckpoint(trailX(-22), -21, 0);
    this.addCheckpoint(3, 20, 0);

    this.buildGrove(rand);
    this.buildYard();
    this.buildShack();

    // Pines frame the whole level; the grove itself is maples.
    const pines: [number, number, number][] = [];
    for (let z = -82; z <= 48; z += 4) {
      for (const x of [-29, -25.5, 25.5, 29]) {
        pines.push([
          x + randRange(rand, -1.2, 1.2),
          z + randRange(rand, -1.5, 1.5),
          randRange(rand, 0.9, 1.4),
        ]);
      }
    }
    for (let x = -22; x <= 22; x += 4) {
      pines.push([
        x + randRange(rand, -1, 1),
        42 + randRange(rand, -1, 2),
        randRange(rand, 0.9, 1.3),
      ]);
    }
    this.forest(pines, 9);
  }

  /** The grove: maples with sap buckets, syrup spills, woodpiles, the start of the trail. */
  private buildGrove(rand: () => number) {
    const g = this.game;
    const p = g.props;
    const maples: [number, number, number][] = [];
    for (let z = -80; z <= -28; z += 3.2) {
      for (const side of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          const off = randRange(rand, 5.5, 18);
          const x = trailX(z) + side * off;
          if (Math.abs(x) > 23) continue;
          maples.push([x, z + randRange(rand, -1.2, 1.2), randRange(rand, 0.85, 1.2)]);
        }
      }
    }
    this.forest(maples, 41, "maple");

    // Candies along the trail.
    for (let z = -70; z < YARD_START; z += 5) this.candy(trailX(z), terrain(trailX(z), z) + 0.8, z);

    // A syrup spill where the first pack waits.
    this.syrupPatch(trailX(-54), -54, 2.8);
    this.syrupPatch(trailX(-40) - 3, -40, 2);

    // Woodpiles: cover, and perches for the bombardiers.
    for (const [x, z] of [
      [trailX(-34) - 7, -34],
      [trailX(-34) + 7.5, -33],
      [trailX(-60) + 6, -60],
    ] as const) {
      const y = terrain(x, z);
      this.place(
        g.protoClone("woodpile3", () => p.woodpile(3, 1.6)),
        x,
        z,
        { y },
      );
      this.solid(x, z, 3, 1.6, 1.3, y);
    }

    // A taffy trough with sweets on it.
    const tx = trailX(-48) - 6;
    const ty = terrain(tx, -48);
    this.place(
      g.protoClone("trough", () => p.tireTrough()),
      tx,
      -48,
      { y: ty, rot: 0.3 },
    );
    this.solidRotated(tx, -48, 3, 0.7, 1.4, ty, 0.3);
    this.candyLine(tx - 1, -48, tx + 1, -48, 3, 1.3);

    this.lootGift(trailX(-66) + 4, -66, 2);
    this.lootGift(trailX(-44) + 5, -44, 4);
    this.lootGift(trailX(-30) - 4.5, -29, 1);
    this.health(trailX(-38) + 2, -38);
    this.buff("speed", trailX(-58) - 9, -58);

    // A lantern halfway (decor) and one at the yard gate (checkpoint).
    this.lantern(trailX(-46) + 2.5, -46);
    const gate = this.lantern(trailX(-24) + 2.5, -24, () => this.reachCheckpoint(1));
    this.trigger(trailX(-24), -24, 4, () => this.lightLantern(gate));
  }

  /** The yard: cauldrons, syrup spills, troughs and a sap tank with a bell on top. */
  private buildYard() {
    const g = this.game;
    const p = g.props;
    this.cauldron(-7, -2);
    this.cauldron(8, 3);
    this.candyRing(-7, -2, 2.4, 6, 2.2);
    this.syrupPatch(0, -8, 3);
    this.syrupPatch(-12, 8, 2.6);
    this.syrupPatch(11, -12, 2.4);
    this.syrupPatch(4, 13, 2);

    for (const [x, z, r] of [
      [-15, -10, 0.4],
      [15, -6, -0.3],
    ] as const) {
      this.place(
        g.protoClone("trough", () => p.tireTrough()),
        x,
        z,
        { rot: r },
      );
      this.solidRotated(x, z, 3, 0.7, 1.4, 0, r);
    }
    for (const [x, z] of [
      [4, -12],
      [-5, 9],
      [-16, 16],
    ] as const) {
      this.place(
        g.protoClone("woodpile3s", () => p.woodpile(3, 1.2)),
        x,
        z,
      );
      this.solid(x, z, 3, 1.2, 1.3);
    }

    // The sap tank, climbed by a stair of gifts. Bell on top.
    this.place(p.sapTank(4.5), 15.6, 17);
    this.solid(15.6, 17, 3.1, 4.6, 3.1);
    this.gift(11.4, 13.6, 1.6, 1.3, 1.6, 2);
    this.gift(13.2, 14.8, 1.6, 2.5, 1.6, 5);
    this.gift(13.2, 17, 1.6, 3.7, 1.6, 0);
    this.bell(15.6, 5.7, 17);
    this.candyLine(11.4, 13.6, 13.2, 17, 3, 0.9);

    this.lootGift(-20, -14, 3);
    this.lootGift(21, -16, 1);
    this.lootGift(-22, 18, 5);
    this.health(20, 6);
  }

  /** The sugar shack: dining room on the left, evaporator room on the right. */
  private buildShack() {
    const g = this.game;
    const p = g.props;
    const { x: sx, z: sz, w, h } = SHACK;
    this.place(p.cabane(w, SHACK.d, h), sx, sz);
    const t = 0.4;
    // Walls (the front one has a door in the middle).
    this.solid(sx - 5.75, FRONT, 8.5, h, t);
    this.solid(sx + 5.75, FRONT, 8.5, h, t);
    this.solid(sx, FRONT, 3, h - 2.8, t, 2.8);
    this.solid(sx, BACK, w, h, t);
    this.solid(sx - w / 2, sz, t, h, SHACK.d);
    this.solid(sx + w / 2, sz, t, h, SHACK.d);
    // Partition between the rooms, with a doorway.
    this.solid(sx + 2, FRONT + 2, t, h, 4);
    this.solid(sx + 2, BACK - 2.5, t, h, 5);
    this.solid(sx + 2, FRONT + 5.5, t, h - 2.8, 3, 2.8);
    // The roof volume (keeps everyone inside under it, and off it).
    this.solid(sx, sz, w + 1, 4, SHACK.d + 1.4, h);
    // Porch roof, reached by a woodpile; a bell up there.
    this.solid(sx - 6.5, FRONT - 1.5, 7, 0.4, 3, 2.9);
    this.solid(sx - 9.6, FRONT - 2.8, 0.4, 2.9, 0.4);
    this.solid(sx - 3.4, FRONT - 2.8, 0.4, 2.9, 0.4);
    this.place(
      g.protoClone("woodpile3", () => p.woodpile(3, 1.6)),
      sx - 11.5,
      FRONT - 3.2,
      { rot: Math.PI / 2 },
    );
    this.solid(sx - 11.5, FRONT - 3.2, 1.3, 1.6, 3);
    this.gift(sx - 13.5, FRONT - 5.5, 1.4, 0.8, 1.4, 4);
    this.bell(sx - 5, 4.4, FRONT - 1.5);
    this.candyLine(sx - 8.5, FRONT - 1.5, sx - 6.5, FRONT - 1.5, 2, 0.8);

    // Dining room: two feast tables, food to grab.
    for (const tz of [29.5, 34.5]) {
      this.place(
        g.protoClone("feastTable", () => p.feastTable(8)),
        sx - 4.5,
        tz,
      );
      this.solid(sx - 4.5, tz, 8, 1.15, 1.6);
    }
    this.food("ragout", sx - 6, 29.5, 25);
    this.food("ragout", sx - 2.5, 34.5, 25);
    this.food("buche", sx - 6.5, 34.5, 100);
    this.health(sx - 2, 29.5, true, 1.15);
    this.candyLine(sx - 8, 32, sx - 1, 32, 4);
    this.pointLight(new Vector3(sx - 4, 3.2, sz), "#ffc27a", 1.4, 12);

    // Evaporator room.
    this.place(p.evaporator(), sx + 7, 33, { rot: Math.PI / 2 });
    this.solid(sx + 7, 33, 2.4, 1.3, 6);
    this.bell(sx + 7, 2.7, 33);
    this.place(
      g.protoClone("woodpile2", () => p.woodpile(2.4, 0.8)),
      sx + 3.8,
      36.8,
    );
    this.solid(sx + 3.8, 36.8, 2.4, 0.8, 1.3);
    this.health(sx + 9, 37);
    this.pointLight(new Vector3(sx + 6.5, 3, 33), "#ff9a4a", 1.5, 11);

    // The way out: a chimney in the yard, beside the door.
    this.exitChimney(13, 22, () => void this.finish());
    this.doorLantern = this.lantern(3, 23.5, () => {
      if (this.yardCleared) this.reachCheckpoint(2);
    });
  }

  /** A plate of food on a table. */
  private food(kind: "ragout" | "buche", x: number, z: number, heal: number) {
    const g = this.game;
    const mesh = kind === "ragout" ? g.props.ragout() : g.props.buche();
    this.pickup(
      mesh,
      new Vector3(x, 1.2, z),
      () => {
        g.player.heal(heal);
        sound.heal();
        g.fx.sparkle(new Vector3(x, 1.6, z), 20);
      },
      0.9,
      "heal",
    );
  }

  private buildTerrainMesh() {
    const g = this.game;
    const ground = MeshBuilder.CreateGround(
      "groveGround",
      { width: 72, height: 136, subdivisionsX: 72, subdivisionsY: 136, updatable: true },
      g.scene,
    );
    const pos = ground.getVerticesData(VertexBuffer.PositionKind) as Float32Array;
    const colors = new Float32Array((pos.length / 3) * 4);
    const snow = color("snow");
    const track = color("snowShade");
    const rand = mulberry32(8);
    for (let i = 0; i < pos.length / 3; i++) {
      const x = pos[i * 3] as number;
      const z = (pos[i * 3 + 2] as number) - 16;
      pos[i * 3 + 1] = terrain(x, z);
      const onTrail = z < YARD_START + 2 && Math.abs(x - trailX(z)) < 2.6;
      const onPath = z >= YARD_START && z < FRONT && Math.abs(x) < 2.2;
      const c = onTrail || onPath ? track : rand() < 0.2 ? track : snow;
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

  async run() {
    const g = this.game;
    this.startTime = g.time;
    const cp = this.startCheckpoint;

    if (cp >= 1) {
      for (const l of this.lanterns) if (l.lamp.z < YARD_START + 1) this.lightLantern(l, true);
    }

    if (cp === 0) {
      g.objective(
        OBJ.getFlamer,
        new Vector3(trailX(-70) + 2.5, terrain(trailX(-70) + 2.5, -70) + 0.6, -70),
      );
      g.tip(LINES.level4Intro);
      const crate = g.props.weaponCrate();
      const cx = trailX(-70) + 2.5;
      const cz = -70;
      await new Promise<void>((resolve) => {
        this.pickup(
          crate,
          new Vector3(cx, terrain(cx, cz), cz),
          () => {
            g.player.giveGun("flamer");
            sound.flame();
            g.toast(T.newWeapon, WEAPON_NAMES.flamer);
            resolve();
          },
          1.2,
        );
      });
      g.tip(LINES.level4Flamer);
      g.objective(OBJ.crossGrove, new Vector3(trailX(-24) + 2.5, 1.5, -24));

      // First pack: around the syrup spill.
      await this.reachOrPass(trailX(-62), -62, 7);
      this.spawnPack(new Vector3(trailX(-53), 0, -53), [
        [ELF_BASIC, 3],
        [ELF_SPRINTER, 1],
      ]);
      g.tip(LINES.level4Syrup);

      // Second: bombardiers on the woodpiles.
      await this.reachOrPass(trailX(-44), -44, 7);
      for (const side of [-1, 1]) {
        const x = trailX(-34) + (side < 0 ? -7 : 7.5);
        const z = side < 0 ? -34 : -33;
        const e = g.enemies.spawn(new Vector3(x, terrain(x, z) + 1.7, z), {
          tuning: ELF_BOMBER,
          perched: true,
          yaw: Math.PI,
        });
        e.aggro = true;
      }
      this.spawnPack(new Vector3(trailX(-32), 0, -30), [
        [ELF_BASIC, 2],
        [ELF_SPRINTER, 1],
      ]);
      g.tip(LINES.level4Bombers);

      await this.reachOrPass(trailX(-24), -24, 4);
    }

    if (cp <= 1) {
      g.objective(OBJ.clearYard);
      if (cp === 1) await g.wait(1);
      g.tip(LINES.level4Yard);
      const waves: [ElfTuning, number][][] = [
        [
          [ELF_BASIC, 4],
          [ELF_SPRINTER, 2],
        ],
        [
          [ELF_BOMBER, 2],
          [ELF_BASIC, 3],
          [ELF_THROWER, 1],
        ],
        [
          [ELF_SPRINTER, 3],
          [ELF_BOMBER, 2],
          [ELF_THROWER, 2],
        ],
        [
          [SNOWMAN, 1],
          [ELF_BASIC, 3],
          [ELF_BOMBER, 2],
          [ELF_SPRINTER, 2],
        ],
      ];
      for (let i = 0; i < waves.length; i++) {
        g.objective(OBJ.survive(i + 1, waves.length));
        await this.wave(waves[i] as [ElfTuning, number][]);
        await g.wait(1.2);
        if (i === 0) {
          this.health(-3, 4);
          this.buff("shield", 2, -16);
        } else if (i === 1) {
          // The taffy troughs pay out: rage!
          this.buff("rage", -15, -10, 0.75);
          this.health(15, -6, false, 0.75);
        } else if (i === 2) {
          this.health(0, 6, true);
          this.buff("speed", -10, 14);
        }
      }
      this.yardCleared = true;
      g.tip(LINES.level4YardClear);
      g.objective(OBJ.enterCabane, new Vector3(0, 1.4, FRONT));
      const door = this.doorLantern;
      if (door?.lit) this.reachCheckpoint(2);
      await new Promise<void>((resolve) =>
        this.trigger(0, FRONT - 2, 3, () => {
          if (door) this.lightLantern(door);
          resolve();
        }),
      );
    } else {
      this.yardCleared = true;
      if (this.doorLantern) this.lightLantern(this.doorLantern, true);
    }

    // The réveillon: elves frozen at the tables until Santa walks in.
    const diners = this.spawnDiners();
    g.objective(OBJ.stopFeast, new Vector3(0, 1.4, FRONT + 1.6));
    await new Promise<void>((resolve) => this.trigger(0, FRONT + 1.6, 2.2, resolve));
    g.cinematic(true);
    await g.say(LINES.level4Feast);
    g.cinematic(false);
    g.enemies.wakeAll();
    sound.growl();
    while (diners.some((e) => e.alive)) await g.wait(0.3);

    // The evaporator room.
    g.objective(OBJ.evaporator, new Vector3(SHACK.x + 2, 1.4, FRONT + 5.5));
    await new Promise<void>((resolve) => this.trigger(SHACK.x + 2, FRONT + 5.5, 2.2, resolve));
    g.tip(LINES.level4Evap);
    const evap: [ElfTuning, number, number][] = [
      [SNOWMAN, 4.2, 35.6],
      [ELF_BOMBER, 8.8, 37],
      [ELF_BOMBER, 8.8, 28],
      [ELF_SPRINTER, 4, 28],
      [ELF_SPRINTER, 9, 31],
    ];
    const room = evap.map(([tuning, x, z]) => {
      g.fx.puff(new Vector3(x, 1, z), "white", 20, 1.4);
      const e = g.enemies.spawn(new Vector3(x, 0, z), { tuning, yaw: -Math.PI / 2 });
      e.aggro = true;
      e.setState("chase");
      return e;
    });
    sound.growl();
    while (room.some((e) => e.alive)) await g.wait(0.3);
    await g.wait(0.8);
    this.openExit();
    g.objective(OBJ.exitYard, this.exit?.pos);
  }

  private spawnDiners() {
    const g = this.game;
    const out = [];
    const seats: [ElfTuning, number, number, number][] = [];
    for (const [tz, side] of [
      [29.5, -1],
      [29.5, 1],
      [34.5, -1],
      [34.5, 1],
    ] as const) {
      for (const x of side < 0 ? [-7, -3] : [-5.5]) {
        seats.push([ELF_BASIC, x, tz + side * 1.35, side < 0 ? 0 : Math.PI]);
      }
    }
    seats.push([ELF_SPRINTER, -9.2, 29.5, Math.PI / 2]);
    seats.push([ELF_SPRINTER, -9.2, 34.5, Math.PI / 2]);
    for (const [tuning, x, z, yaw] of seats) {
      out.push(g.enemies.spawn(new Vector3(SHACK.x + x, 0, z), { tuning, yaw, dormant: true }));
    }
    // A thrower standing on the far table.
    out.push(
      g.enemies.spawn(new Vector3(SHACK.x - 7.8, 1.2, 34.5), {
        tuning: ELF_THROWER,
        yaw: Math.PI,
        dormant: true,
        perched: true,
      }),
    );
    return out;
  }

  private spawnPack(at: Vector3, groups: [ElfTuning, number][]) {
    const g = this.game;
    let n = 0;
    const total = groups.reduce((s, [, c]) => s + c, 0);
    for (const [tuning, count] of groups) {
      for (let i = 0; i < count; i++, n++) {
        const a = (n / total) * Math.PI * 2;
        const x = at.x + Math.cos(a) * 3;
        const z = at.z + Math.sin(a) * 3;
        const elf = g.enemies.spawn(new Vector3(x, terrain(x, z), z), { tuning });
        elf.aggro = true;
        elf.setState("chase");
      }
    }
    sound.growl();
  }

  /** Elves burst out of evil gifts around the yard. Resolves when they're all dead. */
  private async wave(groups: [ElfTuning, number][]) {
    const g = this.game;
    let n = 0;
    for (const [tuning, count] of groups) {
      for (let i = 0; i < count; i++, n++) {
        const a = n * 2.4 + 0.5;
        const r = tuning.ranged ? 15 : 11;
        g.enemies.spawnFromGift(
          new Vector3(ARENA.x + Math.cos(a) * r, 0, ARENA.z + Math.sin(a) * r),
          tuning,
        );
        await g.wait(0.35);
      }
    }
    while (
      g.enemies.elves.some((e) => e.alive && !e.perched) ||
      g.enemies.aliveCount > g.enemies.elves.filter((e) => e.alive).length
    ) {
      await g.wait(0.3);
    }
  }

  protected override onCauldronKill() {
    if (this.cauldronTipShown) return;
    this.cauldronTipShown = true;
    this.game.tip(LINES.level4Cauldron);
  }

  override tick(dt: number) {
    this.steamTime -= dt;
    if (this.steamTime <= 0) {
      this.steamTime = 0.25;
      const g = this.game;
      g.fx.puff(new Vector3(SHACK.x + 6 + Math.random(), SHACK.h + 5.2, SHACK.z), "white", 2, 1.6);
      g.fx.puff(new Vector3(SHACK.x + 7, 1.6, 31 + Math.random() * 4), "white", 1, 1);
      g.fx.puff(new Vector3(SHACK.x + 7, SHACK.h + 6.2, SHACK.z + 3.5), "coal", 1, 1.4);
    }
  }

  private async finish() {
    const g = this.game;
    // Talk first (Santa standing on the chimney), then down he goes.
    g.player.frozen = true;
    g.cinematic(true);
    await g.say(LINES.level4Done);
    g.cinematic(false);
    await this.diveIntoChimney();
    await g.completeLevel();
  }
}
