import { type Mesh, Vector3 } from "@babylonjs/core";
import { sound } from "../audio/Sound";
import { smoothstep } from "../core/math";
import type { Elf } from "../enemies/Elf";
import {
  ELF_BASIC,
  ELF_BOMBER,
  ELF_SPRINTER,
  ELF_THROWER,
  type ElfTuning,
  NUTCRACKER,
} from "../enemies/Elf";
import { LINES, OBJ, T, WEAPON_NAMES } from "../i18n/fr-QC";
import { MOODS } from "../world/Environment";
import { type Lantern, Level } from "../world/Level";
import type { Collider } from "../world/Physics";

// Three halls along z, all roofless: the shipping dock (belts and a grinder), the
// assembly line (stamping presses) and the Grand Atelier (the toy machine).
const DOOR_1 = -18;
const DOOR_2 = 14;
const END = 50;
const START = -50;
/** Half-widths: halls 1–2, and the wider Grand Atelier. */
const HALF = 10;
const HALF_3 = 14;
const WALL_H = 9;

/** Cross belts in hall 1 (along x), pushing toward the grinder by the east wall. */
export const BELTS = [-34.5, -28.5, -22.5].map((z) => ({ x: -2, z, len: 16, width: 3 }));
export const BELT_SPEED = 3;
/** The grinder trough: x/z centre and size. */
export const GRINDER = { x: 8, z: -30, w: 4, d: 20 };
/** The assembly-line belt in hall 2 (along z), pushing toward the Grand Atelier. */
export const LINE = { x: 0, z: -2, width: 3.4, len: 28 };
export const LINE_SPEED = 2.5;
/** Stamping presses over the assembly line (z of each ram's centre; rams are 3 × 3). */
export const PRESSES = [-10, -4, 2, 8];
export const PRESS = { period: 2.8, offset: 0.7, half: 1.5, up: 4.4, down: 0.3 };
export const MACHINE = { x: 0, z: 34, w: 6, h: 5.5 };
export const VALVES = [
  { x: -7, z: 34 },
  { x: 7, z: 34 },
  { x: 0, z: 41.5 },
];
/** Valve toughness, in weapon damage: ~4 garland shots, 2 icicles or 2 shotgun blasts. */
export const VALVE_HP = 12;
/** The machine: how often it spits, how many at once, and how many elves it allows alive. */
export const MACHINE_SPAWN = { every: 2.5, batch: 2, maxAlive: 12 };
const CHUTE = new Vector3(0, 0, 28.6);
const CRATE = new Vector3(0, 0, -42);

/**
 * Height of press `i`'s ram underside at time `t`: up, a shaking warning, a fast slam,
 * a short hold, then back up. Pure, so tests can predict every slam.
 */
export function ramBottom(t: number, i: number) {
  const p = (((t + i * PRESS.offset) % PRESS.period) + PRESS.period) % PRESS.period;
  if (p < 1.9) return { y: PRESS.up, warning: p > 1.5, down: false };
  if (p < 2.05)
    return {
      y: PRESS.up + (PRESS.down - PRESS.up) * smoothstep((p - 1.9) / 0.15),
      warning: false,
      down: false,
    };
  if (p < 2.35) return { y: PRESS.down, warning: false, down: true };
  return {
    y: PRESS.down + (PRESS.up - PRESS.down) * smoothstep((p - 2.35) / 0.45),
    warning: false,
    down: false,
  };
}

interface Belt {
  collider: Collider;
  tread: Mesh;
  dir: Vector3;
  speed: number;
  len: number;
  offset: number;
  axis: "x" | "z";
  center: number;
}

interface Press {
  z: number;
  ram: Mesh;
  collider: Collider;
  wasDown: boolean;
}

/**
 * Niveau 7 — La Fabrique de Jouets.
 * Santa's own toy factory, now building monsters: conveyor belts that carry you to a
 * grinder, a line of stamping presses, and the Toy Machine spitting out elves until
 * its three valves are broken.
 */
export class Level7 extends Level {
  readonly id = 7;
  readonly name = "La Fabrique de Jouets";
  readonly mood = MOODS.factory;
  override darkness = 7;
  override theme = "jingle" as const;
  override arenaRadius = 70;
  override newGun = "garland" as const;
  private readonly belts: Belt[] = [];
  private readonly presses: Press[] = [];
  private roller: Mesh | null = null;
  private shutter: { mesh: Mesh; collider: Collider } | null = null;
  private lanterns2: Lantern[] = [];
  private valvesLeft = VALVES.length;
  /** Which valves still stand (the objective's waypoint points at the next one). */
  private readonly valveUp = VALVES.map(() => true);
  private grinderTipShown = false;

  build() {
    const g = this.game;
    const p = g.props;
    this.spawnPos = new Vector3(0, 0, -47);
    this.spawnYaw = 0;

    this.place(p.floorSlab(2 * HALF_3 + 2, END - START + 2), 0, 0, { shadow: false });
    this.walls();

    // ---- Hall 1: the shipping dock ----
    for (const b of BELTS) this.belt(b.x, b.z, b.len, b.width, new Vector3(1, 0, 0), BELT_SPEED);
    this.place(p.grinder(GRINDER.d, GRINDER.w), GRINDER.x, GRINDER.z, { shadow: false });
    this.roller = this.place(p.grinderRoller(GRINDER.d), GRINDER.x, GRINDER.z, {
      y: -0.1,
      shadow: false,
    });
    // A catwalk along the west wall (throwers up there), reached by two gift steps.
    this.place(p.catwalk(28, 3), -8.5, -34, { y: 3.5 });
    this.solid(-8.5, -34, 3, 0.2, 28, 3.3);
    this.gift(-4.4, -44.5, 1.6, 1.2, 1.6, 1);
    this.gift(-6.2, -46.2, 1.6, 2.4, 1.6, 3);
    this.place(p.toyShelf(1), -9.2, -40, { rot: Math.PI / 2 });
    this.solid(-9.2, -40, 0.8, 3, 3);

    // ---- Hall 2: the assembly line ----
    this.belt(LINE.x, LINE.z, LINE.len, LINE.width, new Vector3(0, 0, 1), LINE_SPEED);
    for (const z of PRESSES) this.press(z);
    for (const [x, z, seed] of [
      [-9.2, -14, 2],
      [9.2, -6, 3],
      [-9.2, 2, 4],
      [9.2, 10, 5],
    ] as const) {
      this.place(p.toyShelf(seed), x, z, { rot: Math.PI / 2 });
      this.solid(x, z, 0.8, 3, 3);
    }
    this.gift(-5.5, -8, 1.6, 1.2, 1.6, 2);
    this.gift(5.5, -2, 1.6, 1.2, 1.6, 4);
    this.gift(-5.5, 6, 1.6, 1.2, 1.6, 5);
    this.gift(5.5, 10, 1.6, 1.2, 1.6, 6);
    // The shutter into the Grand Atelier opens once the line is clear.
    const shutter = this.place(p.shutter(4, 4.5), 0, DOOR_2);
    this.shutter = { mesh: shutter, collider: this.solid(0, DOOR_2, 4, 4.5, 0.6) };

    // ---- Hall 3: the Grand Atelier ----
    this.place(p.toyMachine(), MACHINE.x, MACHINE.z, { rot: Math.PI });
    this.solid(MACHINE.x, MACHINE.z, MACHINE.w, MACHINE.h, MACHINE.w);
    this.solid(MACHINE.x, MACHINE.z, 3.2, 1.6, 3.2, MACHINE.h);
    this.solid(CHUTE.x, MACHINE.z - 3.4, 2.2, 1.45, 1.4);
    VALVES.forEach((v, i) => {
      this.breakable(p.valve(), v.x, v.z, 1.4, 2.6, VALVE_HP, () => this.valveBroken(i));
    });
    this.bounceGift(-4.6, 30.6, 16);
    for (const [x, z, c] of [
      [-9, 30, 0],
      [9, 38, 1],
      [-9, 41, 2],
      [9, 27, 3],
    ] as const) {
      this.gift(x, z, 1.8, 1.4, 1.8, c);
    }
    for (const [x, z, seed] of [
      [-13.4, 22, 6],
      [13.4, 22, 7],
      [-13.4, 46, 8],
      [13.4, 46, 9],
    ] as const) {
      this.place(p.toyShelf(seed), x, z, { rot: Math.PI / 2 });
      this.solid(x, z, 0.8, 3, 3);
    }

    // ---- Light: hanging lamps, and the furnace in the machine's belly ----
    for (const [x, z] of [
      [0, -40],
      [0, -26],
      [-5, -8],
      [5, 4],
      [-8, 24],
      [8, 24],
      [-8, 44],
      [8, 44],
    ] as const) {
      this.place(
        g.protoClone("hlamp", () => p.hangingLamp()),
        x,
        z,
        { y: 6.5, shadow: false },
      );
      this.solid(x, z, 0.9, 0.7, 0.9, 6.2);
      this.pointLight(new Vector3(x, 6.3, z), "#ffc890", 1.4, 15);
    }
    this.pointLight(new Vector3(0, 3, MACHINE.z - 4), "#ff7a30", 2.2, 14);

    // ---- Collectibles ----
    this.bell(-8.5, 4.2, -21.5);
    this.bell(0, 1.1, 5);
    this.bell(-2.2, MACHINE.h + 0.8, MACHINE.z - 2.2);
    this.candyLine(0, -45, 0, -38, 3);
    for (let z = -32; z <= -24; z += 6) this.candyLine(-6, z + 0.5, 2, z + 0.5, 3);
    this.candyLine(-8.5, -46, -8.5, -24, 6, 4.2, true);
    this.candyLine(0, -14, 0, 11, 7);
    this.candyLine(-6, -14, -6, 10, 4);
    this.candyRing(MACHINE.x, MACHINE.z, 6.5, 10);

    // ---- Health and power-ups ----
    this.health(-8.5, -38, false, 3.5);
    this.health(6, -14, false);
    this.buff("rage", -10, 24);
    this.health(10, 24, false);
    this.buff("shield", -10, 44);

    // ---- Checkpoints: start, the assembly line, the Grand Atelier ----
    this.addCheckpoint(this.spawnPos.x, this.spawnPos.z, 0);
    this.addCheckpoint(-5, -15, 0);
    this.addCheckpoint(0, 17.5, 0);
    this.lanterns2 = [this.lantern(-3.4, DOOR_1 + 1.4), this.lantern(-3.4, DOOR_2 + 1.4)];

    this.exitChimney(0, 46.5, () => void this.finish());
  }

  /** Outer walls and the two dividing walls with their doorways (x −2..2). */
  private walls() {
    const wall = (x: number, z: number, w: number, d: number) => {
      this.place(this.game.props.factoryWall(w, WALL_H, d), x, z);
      this.solid(x, z, w, WALL_H, d);
    };
    const t = 0.6;
    const mid12 = (START + DOOR_2) / 2;
    const len12 = DOOR_2 - START;
    wall(-HALF - t / 2, mid12, t, len12);
    wall(HALF + t / 2, mid12, t, len12);
    const mid3 = (DOOR_2 + END) / 2;
    wall(-HALF_3 - t / 2, mid3, t, END - DOOR_2);
    wall(HALF_3 + t / 2, mid3, t, END - DOOR_2);
    wall(0, START - t / 2, 2 * HALF + 2 * t, t);
    wall(0, END + t / 2, 2 * HALF_3 + 2 * t, t);
    for (const sx of [-1, 1]) {
      wall(sx * (2 + (HALF - 2) / 2), DOOR_1, HALF - 2, t);
      wall(sx * (2 + (HALF_3 + t - 2) / 2), DOOR_2, HALF_3 + t - 2, t);
    }
  }

  /** A conveyor: frame, a moving tread, and a collider that carries whoever stands on it. */
  private belt(x: number, z: number, len: number, width: number, dir: Vector3, speed: number) {
    const p = this.game.props;
    const alongZ = Math.abs(dir.z) > 0.5;
    const rot = alongZ ? Math.PI / 2 : 0;
    this.place(p.conveyor(len, width), x, z, { rot, shadow: false });
    const tread = this.place(p.conveyorTread(len, width), x, z, { rot, shadow: false });
    const collider = alongZ
      ? this.solid(x, z, width, 0.3, len, 0, { delta: new Vector3(), tag: "belt" })
      : this.solid(x, z, len, 0.3, width, 0, { delta: new Vector3(), tag: "belt" });
    this.belts.push({
      collider,
      tread,
      dir,
      speed,
      len,
      offset: 0,
      axis: alongZ ? "z" : "x",
      center: alongZ ? z : x,
    });
  }

  private press(z: number) {
    const p = this.game.props;
    this.place(p.pressFrame(), 0, z);
    for (const sx of [-1, 1]) this.solid(sx * 2.5, z, 0.5, 6.4, 0.5);
    const ram = this.place(p.pressRam(), 0, z, { y: PRESS.up });
    const collider = this.solid(0, z, 3, 1.1, 3, PRESS.down, { enabled: false });
    this.presses.push({ z, ram, collider, wasDown: false });
  }

  // ---------- Script ----------

  async run() {
    const g = this.game;
    this.startTime = g.time;
    const cp = this.startCheckpoint;

    if (cp === 0) {
      await this.intro();
      g.objective(OBJ.getGarland, CRATE.add(new Vector3(0, 1, 0)));
      await new Promise<void>((resolve) => {
        this.pickup(
          g.props.weaponCrate(),
          CRATE,
          () => {
            g.player.giveGun("garland");
            sound.zap();
            g.toast(T.newWeapon, WEAPON_NAMES.garland);
            resolve();
          },
          1.2,
        );
      });
      await g.say(LINES.level7Gun);
      this.perch(ELF_THROWER, -8.5, -30, 3.5);
      this.perch(ELF_THROWER, -8.5, -23, 3.5);
      g.tip(LINES.level7Belts);
      g.objective(OBJ.crossBelts, new Vector3(0, 1.5, DOOR_1));
      await this.untilZ(-38);
      this.pack(
        [
          [-5, -31.5],
          [1, -31.5],
          [-2, -25.5],
        ],
        [[ELF_BASIC, 5]],
      );
      await this.untilZ(DOOR_1 + 2);
    }

    if (cp <= 1) {
      this.lightLanterns(1, cp === 1);
      this.reachCheckpoint(1);
      g.tip(LINES.level7Presses);
      g.objective(OBJ.clearAssembly);
      const aisles: [number, number][] = [
        [-6, -12],
        [6, -10],
        [-6, -2],
        [6, 2],
        [-6, 6],
        [6, 9],
      ];
      this.pack(aisles, [
        [ELF_BASIC, 5],
        [ELF_SPRINTER, 3],
      ]);
      await g.wait(1.5);
      await this.allDown();
      g.tip(LINES.level7Nutcracker);
      this.pack(aisles, [
        [NUTCRACKER, 2],
        [ELF_BASIC, 4],
        [ELF_SPRINTER, 1],
        [ELF_THROWER, 1],
      ]);
      await g.wait(1.5);
      await this.allDown();
      await this.openShutter();
      await g.say(LINES.level7AssemblyClear);
      g.objective(OBJ.toWorkshop, new Vector3(0, 1.5, DOOR_2));
      await this.untilZ(DOOR_2 + 2);
    } else {
      this.lightLanterns(1, true);
      void this.openShutter(true);
    }

    this.lightLanterns(2, cp === 2);
    this.reachCheckpoint(2);
    await g.say(LINES.level7Machine);
    g.objective(
      OBJ.breakValves(this.valvesLeft),
      new Vector3(VALVES[0]?.x ?? 0, 2.6, VALVES[0]?.z ?? 0),
    );
    this.pack(
      [
        [-6, 24],
        [6, 24],
        [-4, 22],
        [4, 22],
      ],
      [
        [NUTCRACKER, 2],
        [ELF_BASIC, 3],
        [ELF_SPRINTER, 1],
      ],
    );
    await this.machineRuns();
    sound.explosion();
    g.camRig.shake(0.7);
    for (let i = 0; i < 6; i++) {
      g.fx.puff(new Vector3(MACHINE.x + (i - 2.5), MACHINE.h, MACHINE.z), "coal", 20, 2);
    }
    await g.say(LINES.level7MachineDown);
    g.objective(OBJ.clearWorkshop);
    await this.allDown();
    this.openExit();
    g.objective(OBJ.enterChimney, this.exit?.pos);
  }

  /** Opening: hall 1 from above Santa's shoulder — the belts and the grinder ahead. */
  private async intro() {
    const g = this.game;
    g.cinematic(true);
    // Inside the hall, against the back wall (z −50), above Santa's head.
    const from = new Vector3(-4, 7, -48.5);
    const to = new Vector3(3, 0.5, -28);
    g.camRig.cut(from, to);
    g.camRig.cut(Vector3.Lerp(from, to, 0.12), to, 6);
    await g.say(LINES.level7Intro);
    g.cinematic(false);
  }

  /** While a valve stands, the machine spits an elf out of its chute every few seconds. */
  private async machineRuns() {
    const g = this.game;
    const order: ElfTuning[] = [ELF_BASIC, ELF_SPRINTER, ELF_BOMBER, ELF_BASIC, NUTCRACKER];
    let n = 0;
    while (this.valvesLeft > 0) {
      await g.wait(MACHINE_SPAWN.every);
      if (this.valvesLeft === 0) break;
      for (let k = 0; k < MACHINE_SPAWN.batch; k++) {
        if (g.enemies.elves.filter((e) => e.alive).length >= MACHINE_SPAWN.maxAlive) break;
        const e = g.enemies.spawn(CHUTE.add(new Vector3((k - 0.5) * 1.2, 0, 0)), {
          tuning: order[n++ % order.length],
          yaw: Math.PI,
        });
        e.aggro = true;
        e.setState("chase");
        e.body.velocity.set((k - 0.5) * 3, 5, -6);
      }
      g.fx.puff(CHUTE.add(new Vector3(0, 0.8, 0)), "coal", 16, 1.2);
      sound.land(true);
    }
  }

  private valveBroken(i: number) {
    const g = this.game;
    this.valvesLeft--;
    const v = VALVES[i];
    if (v) g.fx.puff(new Vector3(v.x, 2.4, v.z), "snow", 40, 2);
    sound.explosion();
    g.camRig.shake(0.3);
    this.valveUp[i] = false;
    const next = VALVES.find((_, k) => this.valveUp[k]);
    g.objective(
      OBJ.breakValves(this.valvesLeft),
      next ? new Vector3(next.x, 2.6, next.z) : undefined,
    );
    if (this.valvesLeft === 1) this.health(10, 44, true);
  }

  private async openShutter(instant = false) {
    const s = this.shutter;
    if (!s?.collider.enabled) return;
    s.collider.enabled = false;
    sound.open();
    if (instant) {
      s.mesh.position.y = 4.4;
      return;
    }
    await this.game.tween(1.2, (k) => {
      s.mesh.position.y = 4.4 * smoothstep(k);
    });
  }

  private lightLanterns(n: number, silent: boolean) {
    const l = this.lanterns2[n - 1];
    if (l) this.lightLantern(l, silent);
  }

  /** Elves drop in evil gifts at the given spots, cycling through them. */
  private pack(spots: [number, number][], groups: [ElfTuning, number][]) {
    let n = 0;
    for (const [tuning, count] of groups) {
      for (let i = 0; i < count; i++, n++) {
        const [x, z] = spots[n % spots.length] as [number, number];
        this.game.enemies.spawnFromGift(new Vector3(x, 0, z), tuning);
      }
    }
    sound.growl();
  }

  private perch(tuning: ElfTuning, x: number, z: number, y: number) {
    const ppos = this.game.player.body.position;
    const e = this.game.enemies.spawn(new Vector3(x, y, z), {
      tuning,
      perched: true,
      yaw: Math.atan2(ppos.x - x, ppos.z - z),
    });
    e.aggro = true;
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

  /** Resolves once Santa is past `z` (walking forward through the halls). */
  private async untilZ(z: number) {
    while (this.game.player.body.position.z < z) await this.game.wait(0.15);
  }

  // ---------- Per frame: belts, grinder, presses ----------

  override tick(dt: number) {
    for (const b of this.belts) {
      b.collider.delta?.copyFrom(b.dir.scale(b.speed * dt));
      // Slide the slats along and wrap every metre, so the belt visibly runs.
      b.offset = (b.offset + b.speed * dt) % 1;
      if (b.axis === "x") b.tread.position.x = b.center + b.offset - 0.5;
      else b.tread.position.z = b.center + b.offset - 0.5;
    }
    if (this.roller) this.roller.rotation.z -= dt * 6;
    this.grinder();
    this.updatePresses();
  }

  private inGrinder(p: Vector3) {
    return (
      Math.abs(p.x - GRINDER.x) < GRINDER.w / 2 &&
      Math.abs(p.z - GRINDER.z) < GRINDER.d / 2 &&
      p.y < 0.6
    );
  }

  /** The grinder spits Santa back out (hurt), and chews up any elf the belts bring it. */
  private grinder() {
    const g = this.game;
    const pl = g.player;
    const pos = pl.body.position;
    if (!pl.dead && this.inGrinder(pos)) {
      sound.grind();
      g.gore.burst(pos.add(new Vector3(0, 0.4, 0)), new Vector3(-1, 0, 0), 20);
      // Thrown up and back, clear over the belt ends (or the belts would carry him back in).
      pl.hurt(20, pos.add(new Vector3(2, 0, 0)), 10, 0.6);
      pl.body.velocity.y = 9;
      if (!this.grinderTipShown) {
        this.grinderTipShown = true;
        g.tip(LINES.level7Grinder);
      }
    }
    for (const e of g.enemies.elves) {
      if (e.alive && this.inGrinder(e.body.position)) {
        sound.grind();
        g.enemies.hit(e, 999, e.body.position.add(new Vector3(0, -1, 0)), "slam", 0);
      }
    }
  }

  private updatePresses() {
    const g = this.game;
    this.presses.forEach((pr, i) => {
      const r = ramBottom(g.time, i);
      pr.ram.position.y = r.y;
      pr.ram.position.x = r.warning ? Math.sin(g.time * 70) * 0.05 : 0;
      pr.collider.enabled = r.down;
      if (r.down && !pr.wasDown) this.slam(pr);
      pr.wasDown = r.down;
    });
  }

  /** The ram hits the belt: anyone under it is crushed (Santa hurt and thrown aside). */
  private slam(pr: Press) {
    const g = this.game;
    const near = Vector3.Distance(g.player.body.position, new Vector3(0, 0, pr.z)) < 14;
    if (near) {
      sound.press();
      g.camRig.shake(0.15);
    }
    const under = (p: Vector3, r: number) =>
      Math.abs(p.x) < PRESS.half + r && Math.abs(p.z - pr.z) < PRESS.half + r && p.y < 1.8;
    const pl = g.player;
    if (!pl.dead && under(pl.body.position, pl.body.radius)) {
      const side = pl.body.position.x <= 0 ? 1 : -1;
      pl.hurt(30, new Vector3(side * 3, pl.body.position.y, pr.z));
    }
    const crushed: Elf[] = g.enemies.elves.filter(
      (e) => e.alive && under(e.body.position, e.tuning.radius),
    );
    for (const e of crushed)
      g.enemies.hit(e, 999, e.body.position.add(new Vector3(0, 2, 0)), "slam", 0);
  }

  private async finish() {
    const g = this.game;
    g.player.frozen = true;
    g.cinematic(true);
    await g.say(LINES.level7Done);
    g.cinematic(false);
    await this.diveIntoChimney();
    await g.completeLevel();
  }
}
