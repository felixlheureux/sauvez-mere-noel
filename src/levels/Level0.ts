import { TransformNode, Vector3 } from "@babylonjs/core";
import { CLIPS } from "../anim/clips";
import { createElf, createFouettard, createMereNoel } from "../assets/characters";
import { sound } from "../audio/Sound";
import { mulberry32, randRange } from "../core/math";
import { LINES, OBJ, T, WEAPON_NAMES } from "../i18n/fr-QC";
import { hud } from "../ui/store";
import { MOODS } from "../world/Environment";
import { Level } from "../world/Level";
import type { Npc } from "../world/Npc";

/**
 * Niveau 0 — Le Village du Père Noël.
 * Cute tutorial: jump on gifts, punch a snowman, find the star.
 * Placing the star triggers the twist.
 */
/** Where Santa stands for the star cutscene (in front of the big tree). */
const SANTA_MARK = { x: 0, z: 5.2 };

export class Level0 extends Level {
  readonly id = 0;
  readonly name = "Le Village du Père Noël";
  readonly mood = MOODS.cute;
  override darkness = 0;
  override arenaRadius = 31;
  private mere!: Npc;
  private elves: Npc[] = [];
  private treeTopY = 7.0;
  private starTaken = false;
  private carried: TransformNode | null = null;

  build() {
    const g = this.game;
    const p = g.props;
    const rand = mulberry32(3);
    this.spawnPos = new Vector3(0, 0, 10);
    this.spawnYaw = Math.PI;

    this.place(p.ground(42, 2), 0, 0, { shadow: false });
    this.place(p.mountains(80, 5), 0, 0, { shadow: false });

    // The big tree in the middle.
    this.place(p.bigTree(8), 0, 0);
    this.solid(0, 0, 2.6, 8, 2.6);

    // Santa's cottage + workshop.
    this.place(p.cottage(6, 5, 3.2), 0, 17, { rot: Math.PI });
    this.houseSolid(0, 17, 6, 5, 3.2, Math.PI, 0, 1.12, 0.8);
    // The exit goes in first, so random clutter keeps clear of it.
    this.exitChimney(-11, -20, () => void this.finish());
    this.place(p.workshop(10, 7, 4.5), -17, 3, { rot: Math.PI / 2 });
    this.houseSolid(-17, 3, 10, 7, 4.5, Math.PI / 2, 0, 1.08, 0.6);

    // Gingerbread houses around the square.
    const houses: [number, number, number][] = [
      [15, 7, -Math.PI / 2],
      [17, -4, -Math.PI / 2],
      [-14, -11, Math.PI / 3],
      [-4, -20, 0],
      [8, -22, -0.2],
    ];
    houses.forEach(([x, z, rot], i) => {
      this.place(p.gingerbreadHouse(4, 4, 2.6, i + 1), x, z, { rot });
      this.houseSolid(x, z, 4, 4, 2.6, rot);
    });

    // Lamp posts, candy canes, pines, rocks.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const lamp = g.protoClone("lamp", () => p.lampPost(3.2));
      this.place(lamp, Math.cos(a) * 7.5, Math.sin(a) * 7.5);
      this.solid(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0.3, 3.4, 0.3);
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const cane = g.protoClone("cane3", () => p.candyCane(2.4));
      this.place(cane, Math.cos(a) * 4.2, Math.sin(a) * 4.2, { rot: -a });
    }
    // Pines all around, thin-instanced (one draw call per variant).
    const pines: [number, number, number][] = [];
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + rand() * 0.1;
      const r = randRange(rand, 30, 38);
      pines.push([Math.cos(a) * r, Math.sin(a) * r, randRange(rand, 0.75, 1.15)]);
    }
    this.forest(pines, 3);
    for (let i = 0; i < 10; i++) {
      const a = rand() * Math.PI * 2;
      const r = randRange(rand, 20, 28);
      this.rock(Math.cos(a) * r, Math.sin(a) * r, randRange(rand, 0.8, 1.6), i);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const fence = g.protoClone("fence", () => p.fence(4));
      this.place(fence, Math.cos(a) * 31.5, Math.sin(a) * 31.5, { rot: -a + Math.PI / 2 });
    }
    // Small decorated trees.
    for (const [x, z] of [
      [6, 12],
      [-6, 12],
      [-10, -4],
      [11, -1],
    ] as const) {
      this.place(p.christmasTree(2.6, x * 7 + z), x, z);
      this.solid(x, z, 1.2, 2.6, 1.2);
    }

    // Loose gifts everywhere (cute clutter you can hop on).
    for (let i = 0; i < 16; i++) {
      const a = rand() * Math.PI * 2;
      const r = randRange(rand, 9, 24);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.hypot(x - 11, z + 13) < 6) continue;
      const s = randRange(rand, 0.6, 1.1);
      const rot = rand() * Math.PI;
      // Never inside a house, the workshop or another prop.
      if (!this.freeAt(x, z, s * 0.75)) continue;
      this.gift(x, z, s, s * 0.8, s, i, 0, rot);
    }

    // The gift tower with the star (platforming tutorial).
    this.gift(8, -10.5, 2, 0.8, 2, 0);
    this.gift(10.2, -12.4, 2, 1.8, 2, 1);
    this.gift(12.6, -11.0, 1.8, 3.0, 1.8, 2);
    this.bounceGift(9.6, -15.6, 15.5);
    this.gift(13.4, -15.4, 2.6, 4.5, 2.6, 3);
    this.gift(13.4, -15.4, 1.6, 1.2, 1.6, 4, 4.5);
    const star = this.game.props.starPickup();
    this.pickup(star, new Vector3(13.4, 6.4, -15.4), () => this.onStar(), 1.1);

    // Bells.
    this.bell(12.6, 3.6, -11);
    this.bell(-22.5, 0.9, 3);
    this.bounceGift(-5, 11, 14);
    this.gift(-8.5, 12.5, 2, 3, 2, 5);
    this.bell(-8.5, 3.7, 12.5);

    // Snowmen to punch.
    const snowmen: [number, number][] = [
      [-6, -5],
      [-8, -7.5],
      [5, 5],
    ];
    snowmen.forEach(([x, z], i) => {
      this.breakable(p.snowman(i + 2), x, z, 1, 2.2, 3, () => {
        g.spawnHealPickup(new Vector3(x, 0, z));
      });
    });

    // Mère Noël on the porch, friendly elves at their stations.
    this.mere = this.npc(createMereNoel(g.scene, g.mats), 2.6, 13.6, Math.PI);
    this.mere.setIdle(CLIPS.wave);
    const stations: [number, number, number][] = [
      [6.2, -8.6, -0.6],
      [-2.5, 4.5, Math.PI],
      [-4.2, -3.8, -2.2],
      [7.4, -16.8, 0.7],
      [-9, 1, 1.4],
      [3.2, -3.4, 0.4],
      [-2.8, -3.2, -0.4],
    ];
    stations.forEach(([x, z, yaw], i) => {
      const n = this.npc(createElf(g.scene, g.mats, "friendly", i), x, z, yaw);
      n.setIdle(i >= 5 ? CLIPS.cheer : CLIPS.wave);
      this.elves.push(n);
    });

    // Candy trails: each one leads somewhere worth going.
    this.candyLine(0, 7.5, 6, -7, 7); // spawn → the gift tower
    this.candy(8, 1.5, -10.5); // up the steps
    this.candy(10.2, 2.5, -12.4);
    this.candy(12.6, 3.7, -11.6);
    for (let i = 0; i < 4; i++) this.candy(9.6, 1.8 + i * 1.1, -15.6); // bounce column
    this.candyRing(0, 0, 6, 10); // around the big tree
    this.candyLine(-11, -1, -21, 0, 5); // to the workshop's back
    for (let i = 0; i < 3; i++) this.candy(-5, 1.8 + i * 1, 11); // second bounce gift
    this.candyLine(-11, -16, 3, -17.5, 6); // between the southern houses
    this.candyRing(-7, -6.3, 2.6, 6); // around the snowmen

    // A taste of a power-up before the twist: hot chocolate by the dash tip.
    this.buff("speed", -11.5, 0.5);
  }

  async run() {
    const g = this.game;
    const cam = g.camRig;
    this.bellsFound = 0;
    this.startTime = g.time;

    // Opening: two hand-placed shots, each a slow push-in along a clear line of
    // sight (checked by the cutscene test) — the village and its tree, then Mère Noël.
    g.cinematic(true);
    const tree = new Vector3(0, 3, 0);
    const wide = new Vector3(-10.9, 9, -13);
    cam.cut(wide, tree);
    cam.cut(Vector3.Lerp(wide, tree, 0.2), tree, 7);
    await g.say(LINES.intro.slice(0, 1));
    const porch = new Vector3(1.5, 1.6, 12);
    const porchCam = new Vector3(6, 3.2, 6.6);
    cam.cut(porchCam, porch);
    cam.cut(Vector3.Lerp(porchCam, porch, 0.15), porch, 8);
    await g.say(LINES.intro.slice(1));
    g.cinematic(false);
    g.objective(OBJ.findStar, new Vector3(13.4, 6.4, -15.4));

    this.trigger(7, -9, 3.5, () => g.tip(LINES.tipJump));
    this.trigger(8.5, -15.5, 2.8, () => g.tip(LINES.tipBounce));
    this.trigger(-2.5, 4.5, 3, () => g.tip(LINES.tipBells));
    this.trigger(-5, -5, 3.5, () => g.tip(LINES.tipPunch));
    this.trigger(-9, 1, 3, () => g.tip(LINES.tipDash));
    this.trigger(2.6, 13, 3, () => g.tip(LINES.mereNear));
  }

  private onStar() {
    const g = this.game;
    this.starTaken = true;
    sound.pickup();
    g.fx.sparkle(new Vector3(13.4, 6.4, -15.4), 40);
    g.tip(LINES.starFound);
    g.objective(OBJ.bringStar, new Vector3(0, 3, 0));
    // Santa carries the star over his head, so it's obvious what you're holding.
    const carried = g.props.starPickup();
    carried.scaling.setAll(0.7);
    carried.parent = g.player.rig.root;
    carried.position.set(0, 2.5, 0);
    this.carried = carried;
    this.spinners.push({ node: carried, speed: 2 });
    this.trigger(0, 0, 4.6, () => void this.twist());
  }

  /** The star goes on the tree… and everything goes wrong. */
  private async twist() {
    const g = this.game;
    const cam = g.camRig;
    const env = g.env;
    if (!this.starTaken) return;
    g.cinematic(true);
    g.objective("");
    this.carried?.dispose();
    this.carried = null;
    g.player.anim.play(CLIPS.liftUp);

    // The star flies to the top of the tree.
    const star = g.props.starPickup();
    star.parent = g.levelRoot;
    // Cutscene marks: Santa stands in front of the tree, so every shot below is
    // a fixed, hand-placed camera with a clear view (checked by the cutscene test).
    cam.cut(new Vector3(0, 4, 9.5), new Vector3(0, 5, 0));
    const mark = new Vector3(0, g.physics.groundHeightAt(0, SANTA_MARK.z, 10), SANTA_MARK.z);
    g.player.body.position.copyFrom(mark);
    g.player.body.velocity.setAll(0);
    g.player.yaw = Math.PI;
    const from = mark.add(new Vector3(0, 2.4, 0));
    const to = new Vector3(0, this.treeTopY, 0);
    await g.tween(1.4, (k) => {
      star.position.copyFrom(Vector3.Lerp(from, to, k));
      star.position.y += Math.sin(k * Math.PI) * 2;
      // Two full turns, ending face-on to the camera.
      star.rotation.y = k * Math.PI * 4;
    });
    g.fx.sparkle(to, 60);
    sound.bell();
    for (const e of this.elves) e.setIdle(CLIPS.cheer);
    await g.say(LINES.twistPlace);

    // Music cuts. Lights flicker. The sky bleeds.
    sound.stopMusic(true);
    for (let i = 0; i < 7; i++) {
      env.flicker = i % 2 === 0 ? 0.15 : 1;
      sound.flicker();
      await g.wait(0.12 + Math.random() * 0.12);
    }
    env.flicker = 1;
    sound.thunder();
    g.camRig.shake(0.5);
    env.setMood(MOODS.twisted, 3);
    for (const e of this.elves) e.setIdle(CLIPS.scared);
    this.mere.setIdle(CLIPS.scared);

    // The black sleigh arrives.
    const sleigh = new TransformNode("sleighRig", g.scene);
    sleigh.parent = g.levelRoot;
    const sleighMesh = g.props.darkSleigh();
    sleighMesh.parent = sleigh;
    const fouettard = createFouettard(g.scene, g.mats);
    fouettard.root.parent = sleigh;
    fouettard.root.position.set(0, 1.0, -0.6);
    fouettard.root.scaling.setAll(0.9);
    const mereGround = this.mere.position.clone();
    const hover = mereGround.add(new Vector3(0, 3.2, 0));
    const start = new Vector3(-50, 22, 30);
    // Mère Noël and the sleigh above her, from in front of the porch.
    cam.cut(new Vector3(2.6, 3.2, 6.6), new Vector3(2.6, 2.6, 13.6), 2.5);
    await g.tween(3, (k) => {
      const e = 1 - (1 - k) ** 3;
      sleigh.position.copyFrom(Vector3.Lerp(start, hover, e));
      sleigh.rotation.y = Math.atan2(hover.x - start.x, hover.z - start.z) * (1 - e) + Math.PI * e;
      fouettard.root.rotation.y = 0;
    });
    sound.growl();
    await g.say(LINES.twist1);

    // He grabs her.
    sound.scream();
    await g.tween(0.8, (k) => {
      this.mere.position.y = mereGround.y + k * 2.4;
    });
    this.mere.rig.root.parent = sleigh;
    this.npcs.splice(this.npcs.indexOf(this.mere), 1);
    this.mere.rig.root.position.set(0.5, 1.0, 0.6);
    this.mere.rig.root.rotation.y = 0;
    await g.say(LINES.twist2);
    await g.say(LINES.twist3);
    const leave = new Vector3(60, 30, -40);
    void g.tween(3.5, (k) => {
      sleigh.position.copyFrom(Vector3.Lerp(hover, leave, k * k));
      sleigh.rotation.y = Math.atan2(leave.x - hover.x, leave.z - hover.z);
    });
    await g.wait(1.2);

    // The elves turn.
    const ppos = g.player.body.position;
    for (const e of this.elves) {
      const pos = e.position.clone();
      g.fx.puff(pos.add(new Vector3(0, 0.6, 0)), "plum", 20);
      e.rig.dispose();
      const elf = g.enemies.spawn(pos, {
        dormant: true,
        yaw: Math.atan2(ppos.x - pos.x, ppos.z - pos.z),
      });
      elf.anim.play(CLIPS.elfWindup);
    }
    this.npcs.length = 0;
    this.elves = [];
    sound.growl();
    // Behind Santa: the elves around him turn.
    cam.cut(new Vector3(-1.2, 3.4, 11.4), new Vector3(-1.2, 1.2, 4.9), 1);
    await g.wait(0.6);
    await g.say(LINES.twist4);

    // A crate from Gérard.
    const crate = g.props.weaponCrate();
    const cratePos = new Vector3(2.4, 0, SANTA_MARK.z + 0.8);
    cratePos.y = g.physics.groundHeightAt(cratePos.x, cratePos.z, 10);
    cam.cut(new Vector3(1.2, 3.4, 10.6), new Vector3(1.2, 1, 5.6), 0.8);
    this.place(crate, cratePos.x, cratePos.z, { shadow: false });
    await g.tween(0.6, (k) => {
      crate.position.y = cratePos.y + (1 - k) * 18;
    });
    g.camRig.shake(0.3);
    sound.land(true);
    g.fx.puff(cratePos, "white", 30, 1.4);
    await g.say(LINES.crate);
    g.cinematic(false);
    sound.setDarkness(0.3);
    sound.startMusic();
    g.objective(OBJ.grabCrate, cratePos.add(new Vector3(0, 1, 0)));

    this.pickups.push({
      mesh: crate,
      pos: cratePos.clone(),
      radius: 1.2,
      spin: 0,
      bob: 0,
      collected: false,
      onCollect: () => this.armed(),
      aura: this.aura(cratePos.add(new Vector3(0, 0.4, 0)), "gold", { ringSize: 1.4, spread: 1 }),
    });
  }

  private async armed() {
    const g = this.game;
    // Supplies appear around the village: go grab them mid-fight.
    this.health(-12.5, 3, true);
    this.health(8, 7, false);
    this.health(-6, -14, false);
    this.buff("rage", 13.4, -15.4, 5.7);
    this.buff("shield", 0, 21.5);
    // Level 0's weapon is Gérard's candy cane; the guns start at the market.
    g.player.hasCane = true;
    g.player.equip("fists");
    sound.pickup();
    g.toast(T.newWeapon, WEAPON_NAMES.cane);
    hud.set({ controlsTier: 1, controlsNew: true, showControls: true });
    g.tip(LINES.armed);
    g.objective(OBJ.killElves);
    g.enemies.wakeAll();
    while (g.enemies.aliveCount > 0) await g.wait(0.3);
    await g.wait(0.8);
    this.openExit();
    g.objective(OBJ.enterChimney, this.exit?.pos);
    g.tip(LINES.level0Done);
  }

  private async finish() {
    await this.diveIntoChimney();
    await this.game.completeLevel();
  }
}
