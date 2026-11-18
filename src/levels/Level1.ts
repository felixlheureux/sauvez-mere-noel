import { type TransformNode, Vector3 } from "@babylonjs/core";
import { sound } from "../audio/Sound";
import { lerp, mulberry32, randRange } from "../core/math";
import { LINES, OBJ, T, WEAPON_NAMES } from "../i18n/fr-QC";
import { MOODS } from "../world/Environment";
import { Level } from "../world/Level";

/**
 * Niveau 1 — La Place du Marché de Noël.
 * Golden sunset, a carousel, market stalls — and three waves of possessed elves.
 */
export class Level1 extends Level {
  readonly id = 1;
  readonly name = "La Place du Marché de Noël";
  readonly mood = MOODS.sunset;
  override darkness = 1;
  // Big enough to reach behind the church (the bell there) and the outer houses.
  override arenaRadius = 36;
  override newGun = "capgun" as const;
  private carouselTop: TransformNode | null = null;
  private spawnPoints: Vector3[] = [];
  private stallRoofs: Vector3[] = [];

  build() {
    const g = this.game;
    const p = g.props;
    const rand = mulberry32(11);
    this.spawnPos = new Vector3(0, 0, -22);
    this.spawnYaw = 0;

    this.place(p.ground(44, 4), 0, 0, { shadow: false });
    this.place(p.plaza(22, 4), 0, 0, { shadow: false });
    this.place(p.mountains(85, 9), 0, 0, { shadow: false });

    // Carousel in the middle: the base is walkable, the ride spins.
    const carousel = this.place(p.carousel(), 0, 0);
    this.solid(0, 0, 6.6, 0.5, 6.6);
    this.solid(0, 0, 1, 4.2, 1);
    // The roof rim is a secret ledge (reach it with the bounce gift).
    this.solid(0, 0, 7, 0.4, 7, 3.9);
    this.solid(0, 0, 3.4, 2, 3.4, 4.3);
    this.bounceGift(0, -6.2, 16.5);
    this.carouselTop = carousel;
    this.spinners.push({ node: carousel, speed: 0.35 });

    // Church at the north end; the exit chimney stands off to the side, clear of its doors.
    this.place(p.church(), 0, 30, { rot: Math.PI });
    this.solid(0, 30, 7, 9, 9);
    this.exitChimney(12, 24, () => void this.finish());

    // Ring of market stalls facing the carousel. Their roofs are a second, safer floor.
    const stalls = 9;
    this.stallRoofs = [];
    for (let i = 0; i < stalls; i++) {
      const a = (i / stalls) * Math.PI * 2 + Math.PI / stalls;
      if (Math.abs(Math.sin(a) - 1) < 0.15 || Math.abs(Math.sin(a) + 1) < 0.15) continue;
      const x = Math.cos(a) * 13;
      const z = Math.sin(a) * 13;
      const yaw = Math.atan2(-x, -z);
      this.place(p.marketStall(i), x, z, { rot: yaw });
      // Counter, back wall, and the striped awning you can stand on — turned
      // with the stall, so the awning's edge is really its edge.
      this.solidRotated(x, z, 3, 1.05, 1.5, 0, yaw, 0, 0.3);
      this.solidRotated(x, z, 3, 2.45, 0.2, 0, yaw, 0, -0.45);
      this.solidRotated(x, z, 3, 0.3, 1.6, 2.5, yaw, 0, 0.3);
      this.stallRoofs.push(new Vector3(x, 2.8, z));
      // Every other stall has a gift behind it to climb up.
      if (i % 2 === 0) {
        const bx = Math.cos(a) * 15;
        const bz = Math.sin(a) * 15;
        this.gift(bx, bz, 1.4, 1.4, 1.4, i, 0, yaw);
      }
    }

    // Gift piles: cover and climbing routes.
    const piles: [number, number][] = [
      [7, -8],
      [-6.8, -6],
      [9, 7],
      [-6.6, 5.8],
      [17, -2],
      [-17, 2],
    ];
    piles.forEach(([x, z], i) => {
      this.gift(x, z, 1.6, 1.2, 1.6, i);
      this.gift(x + 1.4, z + 0.3, 1.1, 0.8, 1.1, i + 2);
      if (i % 2 === 0) this.gift(x + 0.1, z, 1.1, 0.9, 1.1, i + 3, 1.2);
    });

    // Lamps and trees along the ring.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const lamp = g.protoClone("lamp", () => p.lampPost(3.4));
      this.place(lamp, Math.cos(a) * 19, Math.sin(a) * 19);
      this.solid(Math.cos(a) * 19, Math.sin(a) * 19, 0.3, 3.6, 0.3);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      this.place(p.christmasTree(3.4, i + 20), Math.cos(a) * 23, Math.sin(a) * 23);
      this.solid(Math.cos(a) * 23, Math.sin(a) * 23, 1.5, 3.4, 1.5);
    }
    // Outer ring of gingerbread houses + pines.
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.15;
      if (Math.abs(a - Math.PI / 2) < 0.4 || Math.abs(a - (3 * Math.PI) / 2) < 0.4) continue;
      const x = Math.cos(a) * 28;
      const z = Math.sin(a) * 28;
      this.place(p.gingerbreadHouse(4.4, 4, 2.8, i + 30), x, z, { rot: Math.atan2(-x, -z) });
      this.houseSolid(x, z, 4.4, 4, 2.8, Math.atan2(-x, -z));
    }
    const pines: [number, number, number][] = [];
    for (let i = 0; i < 30; i++) {
      const a = rand() * Math.PI * 2;
      const r = randRange(rand, 33, 40);
      pines.push([Math.cos(a) * r, Math.sin(a) * r, randRange(rand, 0.75, 1.25)]);
    }
    this.forest(pines, 4);

    // Bells: on a stall roof, behind the church, on a gift tower.
    this.gift(-12.6, -9.5, 1.6, 1.4, 1.6, 2);
    this.bell(-10.5, 3.4, -8.3);
    this.bell(5.5, 0.9, 36.2);
    this.gift(20, 10, 2, 1.4, 2, 5);
    this.gift(21.5, 12, 1.6, 2.8, 1.6, 6);
    this.bell(21.5, 3.5, 12);

    // Candy trails: entrance → plaza, around the carousel, along the roofs, the secret rim.
    this.candyLine(0, -20, 0, -11, 5);
    this.candyRing(0, 0, 4.6, 12);
    for (const r of this.stallRoofs) this.candy(r.x, r.y + 0.7, r.z);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.candy(Math.cos(a) * 3.4, 4.9, Math.sin(a) * 3.4);
    }
    this.candyLine(5.2, 25.5, 5.4, 34.5, 4);
    this.candyLine(18, 8, 21.5, 12, 3, 1.9);

    // Health on high ground, power-ups to fight over.
    const east = this.stallRoofs.find((r) => r.x > 8) ?? (this.stallRoofs[0] as Vector3);
    const west =
      this.stallRoofs.find((r) => r.x < -8 && r.z > 0) ?? (this.stallRoofs[1] as Vector3);
    this.buff("speed", east.x, east.z, east.y);
    this.health(west.x, west.z, false, west.y);
    this.health(-17, 2, false);
    this.health(17, -2, false);

    // Elves pop out near the carousel and from the outer ring, so you have to keep turning.
    this.spawnPoints = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.spawnPoints.push(new Vector3(Math.cos(a) * 8.5, 0, Math.sin(a) * 8.5));
      this.spawnPoints.push(new Vector3(Math.cos(a + 0.4) * 18, 0, Math.sin(a + 0.4) * 18));
    }
  }

  async run() {
    const g = this.game;
    this.startTime = g.time;
    g.tip(LINES.level1Intro);
    // Gérard's gift at the entrance: the cap gun, the first of a bigger gun every level.
    const cratePos = new Vector3(0, 0, -17.5);
    g.objective(OBJ.getCapgun, cratePos.add(new Vector3(0, 1, 0)));
    await new Promise<void>((resolve) => {
      this.pickup(
        g.props.weaponCrate(),
        cratePos,
        () => {
          g.player.giveGun("capgun");
          sound.pickup();
          g.toast(T.newWeapon, WEAPON_NAMES.capgun);
          resolve();
        },
        1.2,
      );
    });
    await g.wait(1);

    const waves = [4, 6, 9];
    for (let w = 0; w < waves.length; w++) {
      g.objective(OBJ.survive(w + 1, waves.length));
      const count = waves[w] as number;
      const order = [...this.spawnPoints].sort(() => Math.random() - 0.5);
      for (let i = 0; i < count; i++) {
        const sp = order[i % order.length] as Vector3;
        g.enemies.spawnFromGift(
          sp.add(new Vector3(randRange(Math.random, -1, 1), 0, randRange(Math.random, -1, 1))),
        );
        await g.wait(w === 2 ? 0.7 : 0.45);
      }
      if (w === 0) g.tip(LINES.level1Wave);
      while (g.enemies.aliveCount > 0) await g.wait(0.3);
      // Rewards between waves, spread out so you have to go get them.
      if (w === 0) {
        this.health(-14, -14, true);
        this.health(14, 14, true);
        this.buff("rage", 0, -3.2, 4.3);
        g.bark("Une tire sur la neige… sur le toit du carrousel!");
      } else if (w === 1) {
        const roof = this.stallRoofs[3] ?? (this.stallRoofs[0] as Vector3);
        this.buff("shield", roof.x, roof.z, roof.y);
        this.health(0, 18, true);
        this.health(-18, -8, false);
        this.health(18, 8, false);
      }
      await g.wait(1.5);
    }
    this.openExit();
    g.objective(OBJ.enterChimney, this.exit?.pos);
  }

  override tick(dt: number) {
    if (this.carouselTop) {
      // Carousel lights pulse.
      const s = 1 + Math.sin(this.game.time * 3) * 0.01;
      this.carouselTop.scaling.y = lerp(this.carouselTop.scaling.y, s, Math.min(1, dt * 4));
    }
  }

  private async finish() {
    const g = this.game;
    // Talk first (Santa standing on the chimney), then down he goes.
    g.player.frozen = true;
    g.cinematic(true);
    await g.say(LINES.level1Done);
    g.cinematic(false);
    await this.diveIntoChimney();
    await g.completeLevel();
  }
}
