import type { Mesh, Scene } from "@babylonjs/core";
import { mulberry32, pick, randRange } from "../core/math";
import type { Materials } from "./Materials";
import {
  box,
  cone,
  cyl,
  disc,
  ico,
  lathe,
  ModelBuilder,
  prism,
  sphere,
  torus,
  tube,
  type V3,
} from "./ModelBuilder";
import type { ColorName } from "./Palette";

export const GIFT_COLORS: ReadonlyArray<readonly [ColorName, ColorName]> = [
  ["red", "gold"],
  ["green", "white"],
  ["sky", "candyPink"],
  ["lavender", "gold"],
  ["mint", "red"],
  ["bubblegum", "white"],
  ["gold", "red"],
];

/** Straight segments approximating an ellipse (shared by the rink mesh and its colliders). */
export function rinkSegments(rx: number, rz: number, n: number, gapAngle: number, gapHalf: number) {
  const out: { x: number; z: number; len: number; deg: number; theta: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    let da = a - gapAngle;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) < gapHalf) continue;
    const tx = -rx * Math.sin(a);
    const tz = rz * Math.cos(a);
    const len = Math.hypot(tx, tz) * ((Math.PI * 2) / n);
    const theta = Math.atan2(-tz, tx);
    out.push({
      x: rx * Math.cos(a),
      z: rz * Math.sin(a),
      len,
      deg: (theta * 180) / Math.PI,
      theta,
    });
  }
  return out;
}

/** Every prop: a low-poly mesh whose origin sits on the floor, centered. */
export class PropFactory {
  constructor(
    private readonly scene: Scene,
    private readonly mats: Materials,
  ) {}

  private b(name: string) {
    return new ModelBuilder(this.scene, this.mats, name);
  }

  gift(w: number, h: number, d: number, colorway = 0): Mesh {
    const [base, ribbon] = GIFT_COLORS[colorway % GIFT_COLORS.length] as [ColorName, ColorName];
    const r = Math.min(w, d) * 0.14;
    return this.b("gift")
      .part("m", box(w, h, d), base, { pos: [0, h / 2, 0] })
      .part("m", box(r, h + 0.01, d + 0.01), ribbon, { pos: [0, h / 2, 0] })
      .part("m", box(w + 0.01, h + 0.01, r), ribbon, { pos: [0, h / 2, 0] })
      .part("m", torus(r * 2.2, r * 0.7, 8), ribbon, {
        pos: [-r * 0.9, h + r * 0.4, 0],
        rot: [90, 0, 60],
      })
      .part("m", torus(r * 2.2, r * 0.7, 8), ribbon, {
        pos: [r * 0.9, h + r * 0.4, 0],
        rot: [90, 0, -60],
      })
      .part("m", sphere(r * 1.2, 2), ribbon, { pos: [0, h + r * 0.3, 0] })
      .buildSingle();
  }

  /** Gift with springs on top: bounce pad. */
  bounceGift(size = 1.4): Mesh {
    const h = size * 0.5;
    const b = this.b("bounceGift")
      .part("m", box(size, h, size), "candyPink", { pos: [0, h / 2, 0] })
      .part("m", box(size * 0.16, h + 0.01, size + 0.01), "white", { pos: [0, h / 2, 0] })
      .part("m", box(size + 0.01, h + 0.01, size * 0.16), "white", { pos: [0, h / 2, 0] });
    for (let i = 0; i < 3; i++) {
      b.part("m", torus(size * 0.5, 0.06, 10), "mint", { pos: [0, h + 0.06 + i * 0.09, 0] });
    }
    b.part("m", cyl(size * 0.8, size * 0.8, 0.08, 10), "mint", { pos: [0, h + 0.32, 0] });
    return b.buildSingle();
  }

  christmasTree(height = 4, seed = 1, decorated = true, star = true): Mesh {
    const rand = mulberry32(seed);
    // The trunk runs up into the lowest tier so there's no gap under the branches.
    const b = this.b("tree").part(
      "m",
      cyl(height * 0.08, height * 0.07, height * 0.3, 6),
      "brown",
      {
        pos: [0, height * 0.15, 0],
      },
    );
    const tiers = 3;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers;
      const w = height * (0.62 - t * 0.17);
      const th = height * 0.42;
      b.part("m", cone(w, th, 7), i % 2 === 0 ? "pine" : "pineDark", {
        pos: [0, height * (0.2 + t * 0.26) + th / 2, 0],
        rot: [0, i * 25, 0],
      });
      if (decorated) {
        const count = 7 - i * 2;
        for (let k = 0; k < count; k++) {
          const a = (k / count) * Math.PI * 2 + i;
          const rr = w * 0.42;
          b.part(
            "m",
            sphere(height * 0.05, 2),
            pick(rand, ["red", "gold", "sky", "candyPink", "white"] as const),
            {
              pos: [Math.cos(a) * rr, height * (0.25 + t * 0.26) + 0.1, Math.sin(a) * rr],
            },
          );
        }
      }
    }
    if (decorated && star) {
      // A flat five-pointed star on top.
      const sy = height * 1.04;
      b.part("star", cyl(height * 0.07, height * 0.07, height * 0.03, 5), "gold", {
        pos: [0, sy, 0],
        rot: [90, 0, 0],
        glow: true,
        glowStrength: 1.2,
      });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        b.part("star", cone(height * 0.045, height * 0.07, 4), "gold", {
          pos: [Math.sin(a) * height * 0.06, sy + Math.cos(a) * height * 0.06, 0],
          rot: [0, 0, (-a * 180) / Math.PI],
          scale: [1, 1, 0.5],
          glow: true,
          glowStrength: 1.2,
        });
      }
    }
    return b.buildSingle();
  }

  /** The village's big tree, waiting for its star. */
  bigTree(height = 8): Mesh {
    return this.christmasTree(height, 42, true, false);
  }

  pine(height = 5, seed = 1): Mesh {
    const rand = mulberry32(seed);
    const b = this.b("pine").part("m", cyl(0.3, 0.25, 0.8, 5), "darkBrown", { pos: [0, 0.4, 0] });
    for (let i = 0; i < 4; i++) {
      const w = height * (0.42 - i * 0.08);
      const y = 0.6 + i * height * 0.2;
      b.part("m", cone(w, height * 0.32, 6), "pineDark", {
        pos: [0, y + height * 0.16, 0],
        rot: [0, rand() * 60, 0],
      });
      b.part("m", cone(w * 0.55, height * 0.12, 6), "snow", { pos: [0, y + height * 0.27, 0] });
    }
    return b.buildSingle();
  }

  gingerbreadHouse(w = 4, d = 4, h = 2.6, seed = 1): Mesh {
    const rand = mulberry32(seed);
    const roof = pick(rand, ["candyPink", "white", "mint", "red"] as const);
    const b = this.b("ginger")
      .part("m", box(w, h, d), "ginger", { pos: [0, h / 2, 0] })
      .part("m", box(w + 0.1, 0.12, d + 0.1), "icing", { pos: [0, h, 0] })
      .part("m", box(0.9, 1.4, 0.1), "darkBrown", { pos: [0, 0.7, d / 2 + 0.03] })
      .part("m", sphere(0.12, 2), "gold", { pos: [0.28, 0.7, d / 2 + 0.1] })
      .part("m", box(0.7, 0.18, 0.7), "icing", { pos: [w * 0.25, h + w * 0.36, 0] });
    gable(b, w, d + 0.5, h, roof);
    for (const sx of [-1, 1]) {
      b.part("m", box(0.6, 0.6, 0.08), "warmLight", {
        pos: [sx * w * 0.3, h * 0.6, d / 2 + 0.03],
        glow: true,
        glowStrength: 0.9,
      });
      b.part("m", box(0.75, 0.1, 0.12), "icing", {
        pos: [sx * w * 0.3, h * 0.6 + 0.35, d / 2 + 0.05],
      });
      b.part("m", box(0.08, 0.6, 0.1), "icing", { pos: [sx * w * 0.3, h * 0.6, d / 2 + 0.05] });
      b.part("m", tube(caneLine(h * 0.9), 0.07, "white"), "red", {
        pos: [sx * (w / 2 + 0.05), 0, d / 2 + 0.05],
      });
    }
    for (let i = 0; i < 6; i++) {
      b.part("m", sphere(0.18, 2), pick(rand, ["red", "mint", "gold", "candyPink"] as const), {
        pos: [randRange(rand, -w / 2, w / 2), h + 0.1, d / 2 + 0.06],
      });
    }
    b.part("m", box(0.6, 0.7, 0.6), "brown", { pos: [w * 0.25, h + w * 0.3, 0] });
    return b.buildSingle();
  }

  /** Santa's cottage: red walls, white trim, round windows. */
  cottage(w = 6, d = 5, h = 3.2): Mesh {
    const b = this.b("cottage")
      .part("m", box(w, h, d), "red", { pos: [0, h / 2, 0] })
      .part("m", box(w + 0.3, 0.2, d + 0.3), "white", { pos: [0, 0.1, 0] })
      .part("m", box(1.1, 1.8, 0.12), "darkGreen", { pos: [0, 0.9, d / 2 + 0.04] })
      .part("m", torus(0.5, 0.1, 10), "gold", { pos: [0, 1.4, d / 2 + 0.12], rot: [90, 0, 0] })
      .part("m", box(0.9, 1.6, 0.9), "darkBrown", { pos: [-w * 0.28, h + w * 0.32, 0] })
      .part("m", box(1.0, 0.25, 1.0), "snow", { pos: [-w * 0.28, h + w * 0.32 + 0.85, 0] });
    gable(b, w, d + 0.8, h, "snow");
    for (const sx of [-1, 1]) {
      b.part("m", cyl(0.9, 0.9, 0.1, 10), "warmLight", {
        pos: [sx * w * 0.3, h * 0.55, d / 2 + 0.03],
        rot: [90, 0, 0],
        glow: true,
        glowStrength: 0.9,
      });
      b.part("m", torus(0.95, 0.1, 10), "white", {
        pos: [sx * w * 0.3, h * 0.55, d / 2 + 0.06],
        rot: [90, 0, 0],
      });
    }
    return b.buildSingle();
  }

  /** The workshop: big barn-like hall. */
  workshop(w = 10, d = 7, h = 4.5): Mesh {
    const b = this.b("workshop")
      .part("m", box(w, h, d), "wood", { pos: [0, h / 2, 0] })
      .part("m", box(3, 3.2, 0.15), "darkBrown", { pos: [0, 1.6, d / 2 + 0.05] })
      .part("m", box(0.15, 3.2, 0.2), "gold", { pos: [0, 1.6, d / 2 + 0.12] })
      .part("m", box(w * 0.6, 0.7, 0.12), "white", { pos: [0, h - 0.2, d / 2 + 0.08] });
    gable(b, w, d + 0.6, h, "deepRed", 1.08);
    for (const sx of [-1, 1]) {
      b.part("m", box(1.2, 1.2, 0.1), "warmLight", {
        pos: [sx * w * 0.32, h * 0.5, d / 2 + 0.03],
        glow: true,
        glowStrength: 0.9,
      });
    }
    return b.buildSingle();
  }

  snowman(seed = 1): Mesh {
    const rand = mulberry32(seed);
    const scarf = pick(rand, ["red", "mint", "lavender", "sky"] as const);
    return this.b("snowman")
      .part("m", sphere(1.1, 4), "snow", { pos: [0, 0.5, 0] })
      .part("m", sphere(0.8, 4), "snow", { pos: [0, 1.25, 0] })
      .part("m", sphere(0.56, 4), "snow", { pos: [0, 1.85, 0] })
      .part("m", cone(0.1, 0.32, 5), "carrot", { pos: [0, 1.85, 0.36], rot: [90, 0, 0] })
      .part("m", sphere(0.08, 2), "coal", { pos: [-0.1, 1.95, 0.24] })
      .part("m", sphere(0.08, 2), "coal", { pos: [0.1, 1.95, 0.24] })
      .part("m", sphere(0.07, 2), "coal", { pos: [0, 1.3, 0.38] })
      .part("m", sphere(0.07, 2), "coal", { pos: [0, 1.1, 0.4] })
      .part("m", torus(0.6, 0.14, 10), scarf, { pos: [0, 1.58, 0] })
      .part("m", box(0.16, 0.4, 0.06), scarf, { pos: [0.18, 1.4, 0.3], rot: [10, 0, 10] })
      .part("m", cyl(0.5, 0.5, 0.06, 10), "black", { pos: [0, 2.08, 0] })
      .part("m", cyl(0.34, 0.34, 0.36, 10), "black", { pos: [0, 2.26, 0] })
      .part("m", cyl(0.35, 0.35, 0.07, 10), scarf, { pos: [0, 2.14, 0] })
      .buildSingle();
  }

  candyCane(h = 3): Mesh {
    return this.b("cane")
      .part("m", tube(caneLine(h), h * 0.05, "white", 7), "red")
      .buildSingle();
  }

  lampPost(h = 3.2): Mesh {
    return this.b("lamp")
      .part("m", cyl(0.16, 0.12, h, 6), "black", { pos: [0, h / 2, 0] })
      .part("m", cyl(0.4, 0.4, 0.12, 6), "black", { pos: [0, 0.06, 0] })
      .part("m", box(0.5, 0.6, 0.5), "warmLight", {
        pos: [0, h + 0.3, 0],
        glow: true,
        glowStrength: 1.1,
      })
      .part("m", cone(0.8, 0.4, 4), "black", { pos: [0, h + 0.8, 0], rot: [0, 45, 0] })
      .part("m", torus(0.6, 0.12, 8), "darkGreen", { pos: [0, h - 0.2, 0] })
      .part("m", sphere(0.18, 2), "red", { pos: [0.28, h - 0.35, 0] })
      .buildSingle();
  }

  rock(size = 1, seed = 1): Mesh {
    const rand = mulberry32(seed);
    return this.b("rock")
      .part("m", ico(size, 1), "snowShade", {
        pos: [0, size * 0.35, 0],
        scale: [1 + rand() * 0.4, 0.6 + rand() * 0.3, 1 + rand() * 0.3],
        rot: [0, rand() * 360, 0],
      })
      .buildSingle();
  }

  fence(length = 3): Mesh {
    const b = this.b("fence");
    const posts = Math.max(2, Math.round(length / 1.2) + 1);
    for (let i = 0; i < posts; i++) {
      const x = -length / 2 + (i / (posts - 1)) * length;
      b.part("m", tube(caneLine(1.1), 0.06, "white"), "red", { pos: [x, 0, 0] });
    }
    b.part("m", box(length, 0.1, 0.08), "white", { pos: [0, 0.75, 0] });
    b.part("m", box(length, 0.1, 0.08), "red", { pos: [0, 0.45, 0] });
    return b.buildSingle();
  }

  /** Level exit. Its glow material is swapped when it opens. */
  exitChimney(): Mesh {
    const b = this.b("exit")
      .part("m", box(1.8, 2.2, 1.8), "deepRed", { pos: [0, 1.1, 0] })
      .part("m", box(2.1, 0.35, 2.1), "snow", { pos: [0, 2.3, 0] });
    for (let row = 0; row < 4; row++) {
      for (const sx of [-1, 1]) {
        b.part("m", box(0.6, 0.06, 0.02), "brown", { pos: [sx * 0.4, 0.4 + row * 0.5, 0.91] });
      }
    }
    // A snowy wooden step on the front, so one jump gets you up.
    b.part("m", box(1.3, 0.9, 1.0), "wood", { pos: [0, 0.45, 1.4] }).part(
      "m",
      box(1.4, 0.12, 1.1),
      "snow",
      { pos: [0, 0.95, 1.4] },
    );
    return b.buildSingle();
  }

  bell(): Mesh {
    return this.b("bell")
      .part(
        "m",
        lathe(
          [
            [0, 0.5],
            [0.12, 0.48],
            [0.2, 0.36],
            [0.24, 0.14],
            [0.34, 0.02],
            [0.34, 0],
          ],
          8,
        ),
        "gold",
        { glow: true, glowStrength: 0.9 },
      )
      .part("m", sphere(0.12, 2), "gold", { pos: [0, -0.02, 0] })
      .part("m", torus(0.14, 0.04, 8), "red", { pos: [0, 0.54, 0], rot: [90, 0, 0] })
      .buildSingle();
  }

  /** A proper five-pointed star (flat, facing ±z), glowing gold. */
  starPickup(): Mesh {
    const b = this.b("star").part("m", cyl(0.5, 0.5, 0.2, 5), "gold", {
      rot: [90, 0, 0],
      glow: true,
      glowStrength: 1.4,
    });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.part("m", cone(0.3, 0.5, 4), "gold", {
        pos: [Math.sin(a) * 0.42, Math.cos(a) * 0.42, 0],
        rot: [0, 0, (-a * 180) / Math.PI],
        scale: [1, 1, 0.5],
        glow: true,
        glowStrength: 1.4,
      });
    }
    return b.buildSingle();
  }

  /** Wrapped candy: the trail collectible. */
  candy(colorway = 0): Mesh {
    const c = (["red", "mint", "lavender", "gold", "candyPink"] as const)[
      colorway % 5
    ] as ColorName;
    return this.b("candy")
      .part("m", sphere(0.32, 3), c, { scale: [1.3, 1, 1] })
      .part("m", cone(0.26, 0.2, 5), c, { pos: [0.26, 0, 0], rot: [0, 0, 90] })
      .part("m", cone(0.26, 0.2, 5), c, { pos: [-0.26, 0, 0], rot: [0, 0, -90] })
      .part("m", torus(0.33, 0.05, 8), "white", { rot: [0, 0, 90], scale: [1.3, 1, 1] })
      .buildSingle();
  }

  /** Buff: hot chocolate (speed). */
  hotChocolate(): Mesh {
    return this.b("choco")
      .part("m", cyl(0.42, 0.38, 0.5, 8), "red", { pos: [0, 0.25, 0] })
      .part("m", cyl(0.36, 0.36, 0.04, 8), "darkBrown", { pos: [0, 0.48, 0] })
      .part("m", torus(0.24, 0.07, 8), "red", { pos: [0.24, 0.26, 0], rot: [90, 0, 0] })
      .part("m", sphere(0.3, 3), "white", { pos: [0, 0.56, 0] })
      .part("m", sphere(0.22, 3), "white", { pos: [0.02, 0.68, 0] })
      .part("m", box(0.06, 0.06, 0.06), "candyPink", { pos: [0.05, 0.8, 0] })
      .part("m", box(0.06, 0.06, 0.06), "mint", { pos: [-0.06, 0.72, 0.08] })
      .buildSingle();
  }

  /** Buff: maple taffy on a stick (rage). */
  tire(): Mesh {
    return this.b("tire")
      .part("m", cyl(0.05, 0.05, 0.6, 5), "wood", { pos: [0, 0.3, 0] })
      .part("m", torus(0.34, 0.12, 10), "gold", {
        pos: [0, 0.68, 0],
        rot: [90, 0, 0],
        glow: true,
        glowStrength: 0.5,
      })
      .part("m", torus(0.2, 0.1, 10), "orange", { pos: [0, 0.68, 0.04], rot: [90, 0, 0] })
      .buildSingle();
  }

  /** Buff: wool tuque (shield). */
  tuque(): Mesh {
    const b = this.b("tuque");
    for (let i = 0; i < 4; i++) {
      b.part(
        "m",
        cyl(0.6 - i * 0.12, 0.6 - (i + 1) * 0.12, 0.16, 9),
        i % 2 === 0 ? "sky" : "white",
        {
          pos: [0, 0.16 + i * 0.16, 0],
        },
      );
    }
    return b
      .part("m", torus(0.62, 0.12, 10), "red", { pos: [0, 0.1, 0] })
      .part("m", sphere(0.26, 3), "white", { pos: [0, 0.82, 0] })
      .buildSingle();
  }

  /** The glowing bow that marks a gift you can unwrap. Origin at the gift's top. */
  lootBow(): Mesh {
    return this.b("lootBow")
      .part("m", torus(0.36, 0.09, 10), "gold", {
        pos: [-0.15, 0.12, 0],
        rot: [90, 0, 60],
        glow: true,
        glowStrength: 0.9,
      })
      .part("m", torus(0.36, 0.09, 10), "gold", {
        pos: [0.15, 0.12, 0],
        rot: [90, 0, -60],
        glow: true,
        glowStrength: 0.9,
      })
      .part("m", sphere(0.14, 2), "gold", { pos: [0, 0.06, 0], glow: true, glowStrength: 1.1 })
      .buildSingle();
  }

  sucreCreme(): Mesh {
    return this.b("sucre")
      .part("m", box(0.3, 0.14, 0.3), "cream", { pos: [0, 0.07, 0] })
      .part("m", box(0.22, 0.12, 0.22), "cream", { pos: [0.02, 0.2, 0], rot: [0, 20, 0] })
      .part("m", box(0.24, 0.02, 0.24), "white", { pos: [0.02, 0.27, 0], rot: [0, 20, 0] })
      .buildSingle();
  }

  tourtiere(): Mesh {
    return this.b("tourtiere")
      .part("m", cyl(0.6, 0.5, 0.16, 10), "ginger", { pos: [0, 0.08, 0] })
      .part("m", torus(0.56, 0.08, 10), "gold", { pos: [0, 0.16, 0] })
      .part("m", cyl(0.5, 0.5, 0.04, 10), "orange", { pos: [0, 0.17, 0] })
      .part("m", box(0.2, 0.02, 0.04), "brown", { pos: [0, 0.2, 0] })
      .part("m", box(0.04, 0.02, 0.2), "brown", { pos: [0, 0.2, 0] })
      .buildSingle();
  }

  /** Gold weapon crate with a beam of light. */
  weaponCrate(): Mesh {
    return this.b("crate")
      .part("m", box(1, 0.8, 1), "gold", { pos: [0, 0.4, 0], glow: true, glowStrength: 0.6 })
      .part("m", box(0.18, 0.82, 1.02), "red", { pos: [0, 0.4, 0] })
      .part("m", box(1.02, 0.82, 0.18), "red", { pos: [0, 0.4, 0] })
      .part("m", torus(0.4, 0.12, 8), "red", { pos: [-0.16, 0.86, 0], rot: [90, 0, 60] })
      .part("m", torus(0.4, 0.12, 8), "red", { pos: [0.16, 0.86, 0], rot: [90, 0, -60] })
      .buildSingle();
  }

  /** Enemy spawner: an ominous red gift that bursts open. */
  evilGift(): Mesh {
    return this.b("evilGift")
      .part("m", box(1.1, 1.0, 1.1), "deepRed", { pos: [0, 0.5, 0] })
      .part("m", box(0.18, 1.02, 1.12), "black", { pos: [0, 0.5, 0] })
      .part("m", box(1.12, 1.02, 0.18), "black", { pos: [0, 0.5, 0] })
      .part("m", sphere(0.3, 2), "eyeRed", { pos: [0, 1.05, 0], glow: true, glowStrength: 1.2 })
      .buildSingle();
  }

  marketStall(seed = 1): Mesh {
    const rand = mulberry32(seed);
    const [a, bCol] = pick(rand, [
      ["red", "white"],
      ["darkGreen", "white"],
      ["candyPink", "white"],
      ["sky", "white"],
    ] as const);
    const b = this.b("stall")
      .part("m", box(3, 1, 1.4), "wood", { pos: [0, 0.5, 0.3] })
      .part("m", box(3.1, 0.1, 1.5), "darkBrown", { pos: [0, 1.02, 0.3] })
      .part("m", box(3, 2.4, 0.15), "wood", { pos: [0, 1.2, -0.45] });
    for (const sx of [-1, 1])
      b.part("m", box(0.14, 2.6, 0.14), "darkBrown", { pos: [sx * 1.45, 1.3, 0.95] });
    for (let i = 0; i < 6; i++) {
      b.part("m", box(0.5, 0.12, 1.7), i % 2 === 0 ? a : bCol, {
        pos: [-1.25 + i * 0.5, 2.7, 0.3],
        rot: [-14, 0, 0],
      });
    }
    for (let i = 0; i < 5; i++) {
      b.part(
        "m",
        box(0.3, 0.3, 0.3),
        pick(rand, ["gold", "red", "mint", "lavender", "ginger"] as const),
        {
          pos: [-1.1 + i * 0.55, 1.22, 0.4],
          rot: [0, rand() * 40, 0],
        },
      );
    }
    b.part("m", box(1.2, 0.08, 0.04), "warmLight", {
      pos: [0, 2.35, 0.98],
      glow: true,
      glowStrength: 0.8,
    });
    return b.buildSingle();
  }

  carousel(): Mesh {
    const b = this.b("carousel")
      .part("base", cyl(7, 7.2, 0.5, 14), "white", { pos: [0, 0.25, 0] })
      .part("base", cyl(7.3, 7.3, 0.12, 14), "gold", { pos: [0, 0.5, 0] })
      .part("base", cyl(0.8, 0.8, 4, 8), "gold", { pos: [0, 2.5, 0] })
      .part("top", cone(5.2, 2, 14), "red", { pos: [0, 5.3, 0] })
      .part("top", cyl(8.2, 8.2, 0.4, 14), "white", { pos: [0, 4.1, 0] })
      .part("top", sphere(0.6, 3), "gold", { pos: [0, 6.3, 0], glow: true, glowStrength: 0.8 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * 2.6;
      const z = Math.sin(a) * 2.6;
      const col = (["white", "candyPink", "sky", "mint", "lavender", "gold"] as const)[
        i
      ] as ColorName;
      b.part("ride", cyl(0.1, 0.1, 3.6, 5), "gold", { pos: [x, 2.3, z] })
        .part("ride", box(0.4, 0.5, 1.0), col, {
          pos: [x, 1.6, z],
          rot: [0, (-a * 180) / Math.PI, 0],
        })
        .part("ride", box(0.3, 0.5, 0.3), col, {
          pos: [x + Math.cos(a + Math.PI / 2) * 0.45, 2.0, z + Math.sin(a + Math.PI / 2) * 0.45],
        });
      b.part("top", sphere(0.3, 2), "warmLight", {
        pos: [Math.cos(a) * 3.9, 4.1, Math.sin(a) * 3.9],
        glow: true,
        glowStrength: 1,
      });
    }
    return b.buildSingle();
  }

  church(): Mesh {
    const b = this.b("church").part("m", box(7, 5, 9), "white", { pos: [0, 2.5, 0] });
    gable(b, 7, 9.4, 5, "grey");
    return b
      .part("m", box(2.6, 9, 2.6), "white", { pos: [0, 4.5, 4.4] })
      .part("m", cone(3.2, 5, 4), "grey", { pos: [0, 11.5, 4.4], rot: [0, 45, 0] })
      .part("m", box(0.15, 1.2, 0.15), "gold", { pos: [0, 14.5, 4.4] })
      .part("m", box(0.7, 0.15, 0.15), "gold", { pos: [0, 14.7, 4.4] })
      .part("m", box(1.8, 3, 0.2), "darkBrown", { pos: [0, 1.5, 5.75] })
      .part("m", cyl(1.2, 1.2, 0.1, 10), "warmLight", {
        pos: [0, 7, 5.75],
        rot: [90, 0, 0],
        glow: true,
      })
      .buildSingle();
  }

  /** The black sleigh of the Père Fouettard. */
  darkSleigh(): Mesh {
    return this.b("sleigh")
      .part("m", box(1.8, 0.9, 3.2), "black", { pos: [0, 0.9, 0] })
      .part("m", box(1.9, 1.3, 0.3), "plum", { pos: [0, 1.4, -1.5] })
      .part("m", box(1.6, 0.2, 2.8), "deepRed", { pos: [0, 1.36, 0] })
      .part("m", tube(sleighRunner(), 0.07), "darkGrey", { pos: [-0.8, 0, 0] })
      .part("m", tube(sleighRunner(), 0.07), "darkGrey", { pos: [0.8, 0, 0] })
      .part("m", sphere(0.3, 2), "eyeRed", { pos: [0, 1.2, 1.7], glow: true, glowStrength: 1.5 })
      .buildSingle();
  }

  /** La Grosse Pétoire: candy-striped double-barrel shotgun (barrel along +z). */
  shotgun(): Mesh {
    return this.b("shotgun")
      .part("m", box(0.16, 0.18, 0.4), "wood", { pos: [0, -0.02, -0.05] })
      .part("m", box(0.12, 0.24, 0.16), "darkBrown", { pos: [0, -0.16, -0.12], rot: [-20, 0, 0] })
      .part(
        "m",
        tube(
          [
            [0, 0, 0],
            [0, 0, 0.75],
          ],
          0.05,
          "white",
          6,
        ),
        "red",
        { pos: [-0.055, 0.06, 0.1] },
      )
      .part(
        "m",
        tube(
          [
            [0, 0, 0],
            [0, 0, 0.75],
          ],
          0.05,
          "white",
          6,
        ),
        "red",
        { pos: [0.055, 0.06, 0.1] },
      )
      .part("m", box(0.2, 0.06, 0.1), "gold", { pos: [0, 0.06, 0.82] })
      .part("m", torus(0.12, 0.04, 6), "green", { pos: [0, 0.07, 0.5], rot: [90, 0, 0] })
      .buildSingle();
  }

  /** Forest lantern on a post. `lit` swaps the glass for a glowing one. */
  lantern(lit: boolean): Mesh {
    return this.b(lit ? "lanternOn" : "lanternOff")
      .part("m", cyl(0.14, 0.12, 2.2, 6), "darkBrown", { pos: [0, 1.1, 0] })
      .part("m", box(0.8, 0.08, 0.1), "darkBrown", { pos: [0.3, 2.15, 0] })
      .part("m", box(0.36, 0.44, 0.36), lit ? "warmLight" : "darkGrey", {
        pos: [0.6, 1.72, 0],
        glow: lit,
        glowStrength: 1.1,
      })
      .part("m", cone(0.5, 0.22, 4), "black", { pos: [0.6, 2.05, 0], rot: [0, 45, 0] })
      .part("m", box(0.4, 0.05, 0.4), "black", { pos: [0.6, 1.48, 0] })
      .buildSingle();
  }

  /** The giant dead tree: the forest's landmark, hung with old ornaments. */
  deadTree(seed = 3): Mesh {
    const rand = mulberry32(seed);
    const b = this.b("deadTree").part("m", cyl(2.2, 1.0, 14, 7), "darkBrown", { pos: [0, 7, 0] });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 360 + rand() * 30;
      const y = 5 + i * 1.0;
      const len = 5 - i * 0.35;
      const rad = (a * Math.PI) / 180;
      b.part("m", cyl(0.32, 0.12, len, 5), "darkBrown", {
        pos: [Math.cos(rad) * len * 0.42, y + len * 0.22, Math.sin(rad) * len * 0.42],
        rot: [0, -a, 60],
      });
      const ox = Math.cos(rad) * len * 0.7;
      const oz = Math.sin(rad) * len * 0.7;
      b.part("m", cyl(0.02, 0.02, 1.2, 3), "grey", { pos: [ox, y + len * 0.2 - 0.9, oz] });
      b.part("m", sphere(0.36, 2), pick(rand, ["deepRed", "gold", "plum", "sky"] as const), {
        pos: [ox, y + len * 0.2 - 1.6, oz],
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.part("m", cone(0.8, 2.6, 4), "darkBrown", {
        pos: [Math.cos(a) * 1.3, 0.6, Math.sin(a) * 1.3],
        rot: [Math.sin(a) * 60, 0, -(Math.cos(a) * 60)],
      });
    }
    return b.buildSingle();
  }

  /** The tree-lot cabin: an open shed with cut trees and price tags. */
  treeLotShed(): Mesh {
    const b = this.b("treeLot")
      .part("m", box(6, 0.2, 4), "wood", { pos: [0, 0.1, 0] })
      .part("m", box(6, 3, 0.2), "wood", { pos: [0, 1.5, -1.9] })
      .part("m", box(0.2, 3, 4), "wood", { pos: [-2.9, 1.5, 0] })
      .part("m", box(0.2, 3, 4), "wood", { pos: [2.9, 1.5, 0] })
      .part("m", box(6.6, 0.25, 4.8), "snow", { pos: [0, 3.15, 0.1], rot: [8, 0, 0] })
      .part("m", box(3.4, 0.7, 0.12), "red", { pos: [0, 2.55, 2.05] })
      .part("m", box(3.2, 0.5, 0.14), "white", { pos: [0, 2.55, 2.06] });
    for (let i = 0; i < 4; i++) {
      const x = -2 + i * 1.3;
      b.part("m", cone(0.9, 2.2, 6), "pine", { pos: [x, 1.3, -1.2], rot: [10, 0, 0] });
      b.part("m", box(0.22, 0.14, 0.02), "white", { pos: [x + 0.2, 1.1, -0.75] });
    }
    return b.buildSingle();
  }

  /** The family car, with a tree tied on the roof. */
  familyCar(): Mesh {
    const b = this.b("car")
      .part("m", box(2, 0.7, 4.2), "sky", { pos: [0, 0.65, 0] })
      .part("m", box(1.8, 0.65, 2.2), "sky", { pos: [0, 1.3, -0.3] })
      .part("m", box(1.82, 0.5, 2.0), "ice", { pos: [0, 1.32, -0.3] })
      .part("m", box(2.05, 0.15, 0.5), "darkGrey", { pos: [0, 0.4, 2.1] })
      .part("m", box(2.05, 0.15, 0.5), "darkGrey", { pos: [0, 0.4, -2.1] })
      .part("m", box(0.4, 0.2, 0.06), "warmLight", { pos: [-0.65, 0.75, 2.12], glow: true })
      .part("m", box(0.4, 0.2, 0.06), "warmLight", { pos: [0.65, 0.75, 2.12], glow: true })
      .part("m", cone(1.0, 3.4, 6), "pine", { pos: [0, 1.95, -0.3], rot: [90, 0, 0] })
      .part("m", box(1.9, 0.6, 0.6), "snow", { pos: [0, 1.7, -0.3] });
    for (const [x, z] of [
      [-1, 1.3],
      [1, 1.3],
      [-1, -1.3],
      [1, -1.3],
    ] as const) {
      b.part("m", cyl(0.6, 0.6, 0.3, 8), "black", { pos: [x, 0.3, z], rot: [0, 0, 90] });
    }
    return b.buildSingle();
  }

  /** A log lying along x (bridges, steps). */
  log(length = 4, d = 0.6): Mesh {
    return this.b("log")
      .part("m", cyl(d, d, length, 7), "brown", { rot: [0, 0, 90] })
      .part("m", cyl(d * 0.8, d * 0.8, 0.02, 7), "wood", {
        pos: [length / 2 + 0.01, 0, 0],
        rot: [0, 0, 90],
      })
      .part("m", cyl(d * 0.8, d * 0.8, 0.02, 7), "wood", {
        pos: [-length / 2 - 0.01, 0, 0],
        rot: [0, 0, 90],
      })
      .buildSingle();
  }

  stump(h = 1, d = 1.4): Mesh {
    return this.b("stump")
      .part("m", cyl(d, d * 1.15, h, 7), "brown", { pos: [0, h / 2, 0] })
      .part("m", cyl(d * 0.85, d * 0.85, 0.04, 7), "wood", { pos: [0, h + 0.02, 0] })
      .part("m", cyl(d * 0.9, d * 0.5, 0.2, 7), "snow", { pos: [0, h + 0.1, 0] })
      .buildSingle();
  }

  /** Burning coal (thrown by the Lutin lanceur). */
  coalLump(): Mesh {
    return this.b("coal")
      .part("m", ico(0.2, 0), "coal")
      .part("core", ico(0.13, 0), "orange", { pos: [0.06, 0.06, 0], glow: true, glowStrength: 1.4 })
      .buildSingle();
  }

  /** La Mitraillette à Bonbons: candy SMG with a drum of hard candies (barrel along +z). */
  candySmg(): Mesh {
    return this.b("smg")
      .part("m", box(0.14, 0.18, 0.46), "candyPink", { pos: [0, 0, 0.05] })
      .part("m", box(0.1, 0.22, 0.12), "white", { pos: [0, -0.16, -0.06], rot: [-15, 0, 0] })
      .part("m", cyl(0.26, 0.26, 0.14, 10), "mint", { pos: [0, -0.12, 0.12], rot: [0, 0, 90] })
      .part(
        "m",
        tube(
          [
            [0, 0, 0],
            [0, 0, 0.42],
          ],
          0.045,
          "white",
          6,
        ),
        "red",
        { pos: [0, 0.03, 0.26] },
      )
      .part("m", sphere(0.2, 2), "lavender", { pos: [0, 0.18, 0] })
      .part("m", sphere(0.07, 2), "gold", { pos: [0.06, 0.24, 0.04] })
      .part("m", sphere(0.07, 2), "red", { pos: [-0.05, 0.25, -0.03] })
      .buildSingle();
  }

  /** Snow tube with two handles. */
  snowTube(): Mesh {
    return this.b("tube")
      .part("m", torus(1.5, 0.5, 14, 8), "sky")
      .part("m", torus(1.52, 0.12, 14, 6), "white", { pos: [0, 0.2, 0] })
      .part("m", cyl(1.1, 1.1, 0.08, 12), "darkGrey", { pos: [0, -0.15, 0] })
      .part("m", torus(0.32, 0.06, 6), "red", { pos: [-0.85, 0.22, 0], rot: [0, 0, 90] })
      .part("m", torus(0.32, 0.06, 6), "red", { pos: [0.85, 0.22, 0], rot: [0, 0, 90] })
      .buildSingle();
  }

  /** The ski chalet: A-frame on a deck with stilts. */
  chalet(): Mesh {
    const b = this.b("chalet");
    roofSnow(b, 9.6, 4.6, 7.2, [0, 4.85, -0.5]);
    b.part("m", box(10, 0.4, 8), "wood", { pos: [0, 1.3, 0] })
      .part("m", box(8, 3.4, 6), "brown", { pos: [0, 3.2, -0.5] })
      .part("m", prism(9.6, 4.6, 7.2), "deepRed", { pos: [0, 4.85, -0.5] })
      .part("m", box(3.2, 0.9, 0.12), "white", { pos: [0, 6.0, 3.15] })
      .part("m", box(3.0, 0.6, 0.14), "red", { pos: [0, 6.0, 3.17] })
      .part("m", box(1.4, 2.2, 0.12), "darkBrown", { pos: [0, 2.6, 2.56] })
      .part("m", box(2.4, 0.08, 0.1), "white", { pos: [0, 1.62, 3.95] });
    for (const sx of [-1, 1]) {
      b.part("m", box(1.6, 1.3, 0.1), "warmLight", {
        pos: [sx * 2.6, 3.6, 2.56],
        glow: true,
        glowStrength: 0.9,
      });
      for (const sz of [-1, 1])
        b.part("m", cyl(0.3, 0.3, 1.3, 6), "darkBrown", { pos: [sx * 4.6, 0.55, sz * 3.6] });
    }
    for (let i = 0; i < 6; i++) {
      b.part("m", cyl(0.08, 0.08, 1, 4), "wood", { pos: [-4.5 + i * 1.8, 2.0, 3.9] });
    }
    b.part("m", box(0.8, 2.4, 0.8), "darkGrey", { pos: [2.5, 8, -1.5] });
    return b.buildSingle();
  }

  /** Ski-lift tower. */
  liftTower(h = 7): Mesh {
    return this.b("liftTower")
      .part("m", cyl(0.5, 0.7, h, 6), "grey", { pos: [0, h / 2, 0] })
      .part("m", box(4.6, 0.3, 0.4), "darkGrey", { pos: [0, h, 0] })
      .part("m", cyl(0.5, 0.5, 0.2, 8), "black", { pos: [-1.9, h + 0.2, 0], rot: [90, 0, 0] })
      .part("m", cyl(0.5, 0.5, 0.2, 8), "black", { pos: [1.9, h + 0.2, 0], rot: [90, 0, 0] })
      .part("m", box(1, 0.2, 1), "snow", { pos: [0, h + 0.25, 0] })
      .buildSingle();
  }

  /** A chairlift seat (origin = seat surface). */
  liftChair(colorway = 0): Mesh {
    const c = (["red", "sky", "gold", "mint"] as const)[colorway % 4] as ColorName;
    return this.b("chair")
      .part("m", box(1.6, 0.18, 0.9), c, { pos: [0, -0.09, 0] })
      .part("m", box(1.6, 0.9, 0.15), c, { pos: [0, 0.4, -0.42], rot: [-10, 0, 0] })
      .part("m", cyl(0.07, 0.07, 2.3, 4), "darkGrey", { pos: [0, 1.3, -0.3] })
      .part("m", box(1.7, 0.08, 0.08), "darkGrey", { pos: [0, 0.75, 0.42] })
      .buildSingle();
  }

  /** Lift station: a covered wooden platform. */
  liftStation(): Mesh {
    return this.b("station")
      .part("m", box(5, 1.4, 4), "wood", { pos: [0, 0.7, 0] })
      .part("m", box(0.3, 4, 0.3), "darkBrown", { pos: [-2.2, 3.4, -1.7] })
      .part("m", box(0.3, 4, 0.3), "darkBrown", { pos: [2.2, 3.4, -1.7] })
      .part("m", box(5.6, 0.3, 4.4), "deepRed", { pos: [0, 5.5, 0], rot: [8, 0, 0] })
      .part("m", cyl(1.6, 1.6, 0.4, 10), "darkGrey", { pos: [0, 4.8, 1.2] })
      .buildSingle();
  }

  /** Tall floodlight for the slope. */
  floodlight(h = 8): Mesh {
    return this.b("flood")
      .part("m", cyl(0.25, 0.35, h, 6), "darkGrey", { pos: [0, h / 2, 0] })
      .part("m", box(2, 0.2, 0.3), "darkGrey", { pos: [0, h, 0] })
      .part("m", box(0.6, 0.5, 0.4), "warmLight", {
        pos: [-0.7, h - 0.1, 0.2],
        rot: [20, 0, 0],
        glow: true,
        glowStrength: 0.8,
      })
      .part("m", box(0.6, 0.5, 0.4), "warmLight", {
        pos: [0.7, h - 0.1, 0.2],
        rot: [20, 0, 0],
        glow: true,
        glowStrength: 0.8,
      })
      .buildSingle();
  }

  /** Ornament bomb (Lutin bombardier): a Christmas ball with a lit fuse. */
  ornamentBomb(): Mesh {
    return this.b("bomb")
      .part("m", sphere(0.5, 4), "red")
      .part("m", torus(0.5, 0.06, 12), "gold", { rot: [90, 0, 0] })
      .part("m", cyl(0.16, 0.18, 0.14, 8), "gold", { pos: [0, 0.27, 0] })
      .part("m", cyl(0.03, 0.03, 0.2, 4), "black", { pos: [0, 0.42, 0] })
      .part("spark", sphere(0.12, 2), "warmLight", {
        pos: [0, 0.54, 0],
        glow: true,
        glowStrength: 1.6,
      })
      .buildSingle();
  }

  // ---------- Level 5: La Patinoire ----------

  puck(): Mesh {
    return this.b("puck")
      .part("m", cyl(0.3, 0.3, 0.1, 10), "black")
      .part("m", cyl(0.32, 0.32, 0.02, 10), "eyeRed", {
        pos: [0, 0.06, 0],
        glow: true,
        glowStrength: 0.8,
      })
      .buildSingle();
  }

  /** Santa's ornament shell, fired by the Lance-Boules. */
  ornamentShell(): Mesh {
    return this.b("shell")
      .part("m", sphere(0.42, 3), "gold", { glow: true, glowStrength: 0.7 })
      .part("m", cyl(0.14, 0.16, 0.12, 8), "red", { pos: [0, 0.24, 0] })
      .buildSingle();
  }

  /** Le Lance-Boules: a striped launcher tube with an ornament loaded on top (barrel along +z). */
  ornamentLauncher(): Mesh {
    const b = this.b("launcher")
      .part("m", cyl(0.3, 0.3, 1.0, 10), "green", { pos: [0, 0.02, 0.2], rot: [90, 0, 0] })
      .part("m", cyl(0.36, 0.36, 0.12, 10), "gold", { pos: [0, 0.02, 0.72], rot: [90, 0, 0] })
      .part("m", cyl(0.34, 0.34, 0.1, 10), "red", { pos: [0, 0.02, -0.28], rot: [90, 0, 0] })
      .part("m", box(0.1, 0.24, 0.12), "darkBrown", { pos: [0, -0.2, 0.0], rot: [-15, 0, 0] })
      .part("m", box(0.08, 0.2, 0.1), "darkBrown", { pos: [0, -0.18, 0.36] })
      .part("m", sphere(0.26, 3), "red", { pos: [0, 0.28, 0.1] })
      .part("m", cyl(0.08, 0.1, 0.08, 6), "gold", { pos: [0, 0.42, 0.1] });
    for (let i = 0; i < 3; i++) {
      b.part("m", torus(0.31, 0.04, 10), "white", {
        pos: [0, 0.02, -0.08 + i * 0.25],
        rot: [90, 0, 0],
      });
    }
    return b.buildSingle();
  }

  /** Snow globe power-up: a little village in glass. */
  snowGlobe(): Mesh {
    return this.b("globe")
      .part("m", cyl(0.7, 0.8, 0.25, 10), "darkBrown", { pos: [0, 0.12, 0] })
      .part("m", cyl(0.6, 0.6, 0.06, 10), "gold", { pos: [0, 0.26, 0] })
      .part("m", cone(0.36, 0.5, 6), "pine", { pos: [0.08, 0.5, 0] })
      .part("m", box(0.18, 0.16, 0.18), "red", { pos: [-0.14, 0.36, 0.06] })
      .part("glass", sphere(0.78, 4), "sky", { pos: [0, 0.62, 0], glow: true, glowStrength: 0.35 })
      .buildSingle();
  }

  /** Ice-fishing hut (cabane à pêche): open at the front, roof you can stand on. */
  fishingHut(colorway = 0): Mesh {
    const walls: ColorName =
      (["red", "sky", "gold", "mint", "lavender"] as const)[colorway % 5] ?? "red";
    const b = this.b("hut")
      .part("m", box(2.6, 2.2, 0.15), walls, { pos: [0, 1.1, 1.3] })
      .part("m", box(0.15, 2.2, 2.6), walls, { pos: [-1.3, 1.1, 0] })
      .part("m", box(0.15, 2.2, 2.6), walls, { pos: [1.3, 1.1, 0] })
      .part("m", box(0.7, 2.2, 0.15), walls, { pos: [-0.95, 1.1, -1.3] })
      .part("m", box(0.7, 2.2, 0.15), walls, { pos: [0.95, 1.1, -1.3] })
      .part("m", box(2.9, 0.18, 2.9), "darkBrown", { pos: [0, 2.28, 0] })
      .part("m", box(3, 0.16, 3), "snow", { pos: [0, 2.42, 0] })
      .part("m", cyl(0.2, 0.2, 0.9, 6), "darkGrey", { pos: [0.8, 2.8, 0.8] })
      .part("m", cyl(0.7, 0.7, 0.04, 10), "black", { pos: [0, 0.03, 0.2] })
      .part("m", box(0.5, 0.4, 0.5), "wood", { pos: [-0.8, 0.2, 0.7] })
      .part("m", box(0.4, 0.3, 0.1), "warmLight", {
        pos: [1.37, 1.4, 0.3],
        rot: [0, 90, 0],
        glow: true,
        glowStrength: 0.6,
      });
    return b.buildSingle();
  }

  /** Bleachers: `rows` steps rising toward +z, `w` wide (open underneath on the +x end). */
  bleachers(w = 16, rows = 5): Mesh {
    const b = this.b("bleachers");
    for (let r = 0; r < rows; r++) {
      b.part("m", box(w, 0.12, 1.1), r % 2 ? "sky" : "white", { pos: [0, 0.8 + r * 0.8, r * 1.1] });
      // Solid risers on the low rows; the high rows stand on thin legs (room underneath).
      if (r < 2) {
        b.part("m", box(w, 0.8 + r * 0.8, 0.12), "darkGrey", {
          pos: [0, (0.8 + r * 0.8) / 2, r * 1.1 - 0.5],
        });
      } else {
        b.part("m", box(w, 0.12, 0.12), "darkGrey", { pos: [0, 0.74 + r * 0.8, r * 1.1 - 0.5] });
      }
    }
    b.part("m", box(0.2, rows * 0.8 + 1, rows * 1.1), "darkGrey", {
      pos: [-w / 2, (rows * 0.8 + 1) / 2, (rows - 1) * 0.55],
    });
    for (let r = 2; r < rows; r++) {
      b.part("m", box(0.2, 0.8 + r * 0.8, 0.2), "darkGrey", {
        pos: [w / 2 - 0.1, (0.8 + r * 0.8) / 2, r * 1.1],
      });
    }
    return b.buildSingle();
  }

  /** The rink scoreboard on two posts. */
  scoreboard(): Mesh {
    const b = this.b("scoreboard")
      .part("m", box(0.3, 5, 0.3), "darkGrey", { pos: [-2.2, 2.5, 0] })
      .part("m", box(0.3, 5, 0.3), "darkGrey", { pos: [2.2, 2.5, 0] })
      .part("m", box(5.2, 2, 0.6), "black", { pos: [0, 5.6, 0] })
      .part("m", box(5.3, 0.2, 0.7), "snow", { pos: [0, 6.7, 0] });
    for (const [x, c] of [
      [-1.5, "eyeRed"],
      [1.5, "warmLight"],
    ] as const) {
      b.part("m", box(1.2, 0.9, 0.05), c, { pos: [x, 5.5, -0.32], glow: true, glowStrength: 1 });
    }
    b.part("m", box(1.4, 0.4, 0.05), "mint", {
      pos: [0, 6.1, -0.32],
      glow: true,
      glowStrength: 0.8,
    });
    return b.buildSingle();
  }

  /**
   * Rink boards around an ellipse, as `n` straight segments. Segments whose angle is
   * within `gapHalf` of `gapAngle` are left out (the gate).
   */
  rinkBoards(rx: number, rz: number, n: number, gapAngle: number, gapHalf: number): Mesh {
    const b = this.b("boards");
    for (const seg of rinkSegments(rx, rz, n, gapAngle, gapHalf)) {
      b.part("m", box(seg.len + 0.05, 1.1, 0.25), "white", {
        pos: [seg.x, 0.55, seg.z],
        rot: [0, seg.deg, 0],
      })
        .part("m", box(seg.len + 0.06, 0.25, 0.27), "gold", {
          pos: [seg.x, 0.13, seg.z],
          rot: [0, seg.deg, 0],
        })
        .part("m", box(seg.len + 0.06, 0.1, 0.3), "red", {
          pos: [seg.x, 1.1, seg.z],
          rot: [0, seg.deg, 0],
        });
    }
    return b.buildSingle();
  }

  rinkGate(w = 4.4): Mesh {
    return this.b("gate")
      .part("m", box(w, 1.1, 0.25), "white", { pos: [0, 0.55, 0] })
      .part("m", box(w + 0.02, 0.25, 0.27), "gold", { pos: [0, 0.13, 0] })
      .part("m", box(w + 0.02, 0.1, 0.3), "red", { pos: [0, 1.1, 0] })
      .buildSingle();
  }

  /** The rink's ice with its painted lines (ellipse, top at y = 0). */
  rinkFloor(rx: number, rz: number): Mesh {
    return this.b("rinkFloor")
      .part("m", disc(1, 40), "ice", { pos: [0, 0.015, 0], scale: [rx, 1, rz] })
      .part("m", box(0.4, 0.01, rz * 1.95), "red", { pos: [0, 0.03, 0] })
      .part("m", box(0.4, 0.01, rz * 1.9), "sky", { pos: [-rx * 0.33, 0.03, 0] })
      .part("m", box(0.4, 0.01, rz * 1.9), "sky", { pos: [rx * 0.33, 0.03, 0] })
      .part("m", torus(7, 0.15, 24), "sky", { pos: [0, 0.03, 0], scale: [1, 0.05, 1] })
      .part("m", torus(5, 0.15, 20), "red", {
        pos: [-rx * 0.62, 0.03, -rz * 0.4],
        scale: [1, 0.05, 1],
      })
      .part("m", torus(5, 0.15, 20), "red", {
        pos: [-rx * 0.62, 0.03, rz * 0.4],
        scale: [1, 0.05, 1],
      })
      .part("m", torus(5, 0.15, 20), "red", {
        pos: [rx * 0.62, 0.03, -rz * 0.4],
        scale: [1, 0.05, 1],
      })
      .part("m", torus(5, 0.15, 20), "red", {
        pos: [rx * 0.62, 0.03, rz * 0.4],
        scale: [1, 0.05, 1],
      })
      .buildSingle();
  }

  /** Dark, icy water filling an ellipse (y = 0 is the surface). */
  water(rx: number, rz: number, seed = 1): Mesh {
    // Black-blue lake water under the ice: a dark surface, soft cold shine,
    // and bits of slush floating in it.
    const rand = mulberry32(seed);
    const b = this.b("water")
      .part("m", disc(1, 36), "deepWater", { scale: [rx, 1, rz] })
      .part("m", disc(1, 30), "waterShine", {
        pos: [rx * 0.15, 0.01, -rz * 0.1],
        scale: [rx * 0.55, 1, rz * 0.4],
        glow: true,
        glowStrength: 0.12,
      });
    const n = Math.round(Math.min(40, (rx * rz) / 4));
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 0.92;
      b.part("m", ico(0.12 + rand() * 0.25, 0), rand() < 0.5 ? "white" : "ice", {
        pos: [Math.cos(a) * r * rx, 0.02, Math.sin(a) * r * rz],
        scale: [1, 0.25, 1],
        rot: [0, rand() * 180, 0],
      });
    }
    return b.buildSingle();
  }

  /** A hole broken through the lake ice: water, a jagged rim and floating chunks. */
  iceHole(r: number, seed = 1): Mesh {
    const rand = mulberry32(seed);
    const b = this.b("iceHole")
      .part("m", disc(r, 12), "deepWater", { pos: [0, 0.03, 0] })
      .part("m", disc(r * 0.5, 10), "waterShine", {
        pos: [r * 0.2, 0.04, 0],
        glow: true,
        glowStrength: 0.12,
      });
    // Broken plates of ice tipped up around the edge.
    const rim = Math.round(r * 5);
    for (let i = 0; i < rim; i++) {
      const a = (i / rim) * Math.PI * 2 + rand() * 0.3;
      const deg = (-a * 180) / Math.PI;
      b.part(
        "m",
        box(0.55 + rand() * 0.3, 0.07, 0.35 + rand() * 0.2),
        rand() < 0.5 ? "white" : "ice",
        {
          pos: [Math.cos(a) * (r + 0.05), 0.07, Math.sin(a) * (r + 0.05)],
          rot: [-(18 + rand() * 18), deg + 90, 0],
        },
      );
    }
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      const d = rand() * r * 0.6;
      b.part("m", box(0.5 + rand() * 0.5, 0.12, 0.4 + rand() * 0.4), "ice", {
        pos: [Math.cos(a) * d, 0.06, Math.sin(a) * d],
        rot: [rand() * 10, rand() * 180, rand() * 10],
      });
    }
    return b.buildSingle();
  }

  /** Fresh ice laid by the resurfacer (a bridge segment). Top at y = 0. */
  freshIce(r: number): Mesh {
    return this.b("freshIce")
      .part("m", cyl(r * 2, r * 1.9, 0.3, 10), "ice", { pos: [0, -0.12, 0] })
      .part("m", disc(r * 0.95, 10), "white", {
        pos: [0, 0.035, 0],
        glow: true,
        glowStrength: 0.18,
      })
      .buildSingle();
  }

  /** A patch of cracked lake ice (white fracture lines). */
  crackedIce(r: number, seed = 1): Mesh {
    const rand = mulberry32(seed);
    const b = this.b("cracks").part("m", disc(r, 10), "snowShade", { pos: [0, 0.02, 0] });
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2;
      const len = r * (0.6 + rand() * 0.7);
      b.part("m", box(len, 0.02, 0.07), "white", {
        pos: [Math.cos(a) * len * 0.35, 0.04, Math.sin(a) * len * 0.35],
        rot: [0, (-a * 180) / Math.PI, 0],
      });
    }
    return b.buildSingle();
  }

  /** Hockey net. */
  hockeyNet(): Mesh {
    return this.b("net")
      .part("m", box(1.8, 0.08, 0.08), "red", { pos: [0, 1.2, 0] })
      .part("m", box(0.08, 1.2, 0.08), "red", { pos: [-0.9, 0.6, 0] })
      .part("m", box(0.08, 1.2, 0.08), "red", { pos: [0.9, 0.6, 0] })
      .part("m", box(1.8, 1.2, 0.04), "white", { pos: [0, 0.6, -0.8], rot: [-30, 0, 0] })
      .buildSingle();
  }

  /** An ice spike (Zamboni trail). Origin at the base. */
  iceSpike(): Mesh {
    return this.b("spike")
      .part("m", cone(0.5, 1.2, 5), "ice", { pos: [0, 0.6, 0] })
      .part("m", cone(0.3, 0.7, 4), "white", { pos: [0.22, 0.35, 0.1], rot: [0, 0, -20] })
      .part("m", cone(0.3, 0.8, 4), "ice", { pos: [-0.2, 0.4, -0.1], rot: [10, 0, 22] })
      .buildSingle();
  }

  iceShard(): Mesh {
    return this.b("shard")
      .part("m", cone(0.22, 0.7, 4), "ice", { rot: [90, 0, 0], glow: true, glowStrength: 0.5 })
      .buildSingle();
  }

  /** A floating slab of rink ice (phase 2). Top at y = 0. */
  iceIsland(r: number, seed = 1): Mesh {
    const rand = mulberry32(seed);
    const b = this.b("island")
      .part("m", cyl(r * 2, r * 1.7, 0.9, 9), "ice", { pos: [0, -0.45, 0] })
      .part("m", disc(r * 0.98, 9), "snowShade", { pos: [0, 0.01, 0] });
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      b.part("m", box(r * 0.8, 0.02, 0.06), "white", {
        pos: [Math.cos(a) * r * 0.3, 0.03, Math.sin(a) * r * 0.3],
        rot: [0, rand() * 180, 0],
      });
    }
    return b.buildSingle();
  }

  /**
   * La Surfaceuse Infernale: a possessed ice resurfacer (front = +z).
   * Groups: "body", "lights" (headlights), "beacon", "auger" (spins), "jaw".
   */
  zamboni(): Map<string, Mesh> {
    const b = this.b("zamboni")
      .part("body", box(2.3, 1.3, 4.4), "white", { pos: [0, 1.05, 0] })
      .part("body", box(2.34, 0.3, 4.44), "red", { pos: [0, 0.55, 0] })
      .part("body", box(2.34, 0.14, 4.44), "deepRed", { pos: [0, 1.45, 0] })
      .part("body", box(2.2, 1.0, 2.0), "white", { pos: [0, 2.2, -0.9] })
      .part("body", box(2.25, 0.16, 2.05), "red", { pos: [0, 2.72, -0.9] })
      .part("body", box(1.1, 0.5, 0.9), "darkGrey", { pos: [-0.4, 1.95, 1.2] })
      .part("body", box(0.12, 0.7, 0.12), "darkGrey", { pos: [-0.4, 2.25, 1.65], rot: [-20, 0, 0] })
      .part("body", torus(0.5, 0.08, 10), "black", { pos: [-0.4, 2.58, 1.75], rot: [70, 0, 0] })
      .part("body", box(2.5, 0.25, 0.5), "darkGrey", { pos: [0, 0.4, -2.4] });
    for (const x of [-1.05, 1.05]) {
      for (const z of [-1.4, 1.5]) {
        b.part("body", cyl(0.9, 0.9, 0.4, 10), "black", { pos: [x, 0.45, z], rot: [0, 0, 90] });
        b.part("body", cyl(0.4, 0.4, 0.42, 6), "darkGrey", { pos: [x, 0.45, z], rot: [0, 0, 90] });
      }
    }
    // Possessed touches: red stripes like claw marks, coal on the hopper.
    for (let i = 0; i < 3; i++) {
      b.part("body", box(0.08, 0.7, 0.04), "blood", {
        pos: [1.16, 1.1, -1 + i * 0.35],
        rot: [0, 90, 20],
      });
    }
    // Front scraper with teeth.
    b.part("jaw", box(2.4, 0.3, 0.3), "darkGrey", { pos: [0, 0.35, 2.3] });
    for (let i = 0; i < 7; i++) {
      b.part("jaw", cone(0.2, 0.35, 4), "white", {
        pos: [-1.05 + i * 0.35, 0.35, 2.5],
        rot: [90, 0, 0],
      });
    }
    b.part("lights", sphere(0.32, 2), "warmLight", {
      pos: [-0.8, 1.2, 2.21],
      glow: true,
      glowStrength: 1.2,
    })
      .part("lights", sphere(0.32, 2), "warmLight", {
        pos: [0.8, 1.2, 2.21],
        glow: true,
        glowStrength: 1.2,
      })
      .part("lights", sphere(0.2, 2), "eyeRed", {
        pos: [-0.5, 2.5, 0.15],
        glow: true,
        glowStrength: 1.4,
      })
      .part("lights", sphere(0.2, 2), "eyeRed", {
        pos: [0.5, 2.5, 0.15],
        glow: true,
        glowStrength: 1.4,
      })
      .part("beacon", cyl(0.3, 0.3, 0.3, 8), "orange", {
        pos: [0, 0, 0],
        glow: true,
        glowStrength: 1.3,
      })
      .part("auger", cyl(0.4, 0.4, 2.3, 6), "grey", { rot: [0, 0, 90] });
    for (let i = 0; i < 5; i++) {
      b.part("auger", box(0.06, 0.5, 0.12), "darkGrey", {
        pos: [-0.9 + i * 0.45, 0, 0],
        rot: [i * 40, 0, 0],
      });
    }
    return b.build();
  }

  /** Aurora ribbon: a tall translucent-looking glowing strip (after the boss). */
  aurora(len = 60, hue: ColorName = "mint"): Mesh {
    const b = this.b("aurora");
    for (let i = 0; i < 14; i++) {
      const x = -len / 2 + (i / 13) * len;
      b.part("m", box(len / 13 + 0.4, 6 + Math.sin(i * 1.3) * 2, 0.2), hue, {
        pos: [x, 0, Math.sin(i * 0.7) * 6],
        rot: [0, Math.cos(i * 0.7) * 25, 0],
        glow: true,
        glowStrength: 0.55,
      });
    }
    return b.buildSingle();
  }

  /** Le Lance-Flammes à Sirop: a maple-syrup can with a nozzle (barrel along +z). */
  syrupFlamer(): Mesh {
    return this.b("flamer")
      .part("m", cyl(0.34, 0.34, 0.5, 10), "red", { pos: [0, 0, -0.05], rot: [90, 0, 0] })
      .part("m", cyl(0.35, 0.35, 0.16, 10), "white", { pos: [0, 0, -0.05], rot: [90, 0, 0] })
      .part("m", cyl(0.06, 0.12, 0.5, 6), "darkGrey", { pos: [0, 0.04, 0.4], rot: [90, 0, 0] })
      .part("m", box(0.08, 0.2, 0.1), "black", { pos: [0, -0.2, 0.1] })
      .part("m", sphere(0.08, 2), "orange", { pos: [0, 0.06, 0.68], glow: true, glowStrength: 1.4 })
      .buildSingle();
  }

  /** Big cast-iron syrup cauldron on a fire pit. */
  cauldron(): Mesh {
    const b = this.b("cauldron")
      .part("m", cyl(2.4, 1.8, 1.3, 10), "coal", { pos: [0, 0.95, 0] })
      .part("m", torus(2.4, 0.16, 12), "black", { pos: [0, 1.6, 0] })
      .part("syrup", cyl(2.2, 2.2, 0.05, 10), "orange", {
        pos: [0, 1.5, 0],
        glow: true,
        glowStrength: 0.9,
      });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.part("m", ico(0.3, 0), "darkGrey", { pos: [Math.cos(a) * 1.6, 0.15, Math.sin(a) * 1.6] });
    }
    for (let i = 0; i < 3; i++) {
      b.part("m", cyl(0.2, 0.2, 1.8, 5), "darkBrown", { pos: [0, 0.2, 0], rot: [0, i * 60, 90] });
    }
    b.part("embers", cyl(1.3, 1.6, 0.25, 8), "orange", {
      pos: [0, 0.2, 0],
      glow: true,
      glowStrength: 1.2,
    });
    return b.buildSingle();
  }

  /** A spill of maple syrup (sticky; it burns). */
  syrupPuddle(r = 2): Mesh {
    return this.b("syrup")
      .part("m", disc(r, 10), "ginger", { pos: [0, 0.03, 0] })
      .buildSingle();
  }

  /** Bare winter maple with a sap bucket. */
  maple(seed = 1): Mesh {
    const rand = mulberry32(seed);
    const b = this.b("maple")
      .part("m", cyl(0.62, 0.34, 5.2, 6), "darkBrown", { pos: [0, 2.6, 0] })
      .part("m", cyl(0.9, 0.62, 0.5, 6), "darkBrown", { pos: [0, 0.25, 0] });
    // Bare winter branches reaching up and out, a dusting of snow on each.
    for (let i = 0; i < 5; i++) {
      const a = i * 72 + rand() * 30;
      const rad = (a * Math.PI) / 180;
      const tilt = 28 + rand() * 14;
      const len = 2.4 + rand() * 1.2;
      const y = 3.6 + rand() * 1.4;
      const t = (tilt * Math.PI) / 180;
      const off = Math.sin(t) * len * 0.5;
      b.part("m", cyl(0.2, 0.06, len, 4), "darkBrown", {
        pos: [Math.cos(rad) * off, y + Math.cos(t) * len * 0.5, Math.sin(rad) * off],
        rot: [0, -a, -tilt],
      });
      b.part("m", box(0.22, 0.08, 0.5), "snow", {
        pos: [
          Math.cos(rad) * off * 1.3,
          y + Math.cos(t) * len * 0.62 + 0.1,
          Math.sin(rad) * off * 1.3,
        ],
        rot: [0, -a, 0],
      });
    }
    // Sap bucket with its little roof and spout.
    b.part("m", cyl(0.45, 0.35, 0.5, 8), "grey", { pos: [0, 1.3, 0.48] })
      .part("m", cone(0.6, 0.25, 4), "grey", { pos: [0, 1.66, 0.48], rot: [0, 45, 0] })
      .part("m", cyl(0.05, 0.05, 0.3, 4), "sky", { pos: [0, 1.75, 0.38], rot: [70, 0, 0] });
    return b.buildSingle();
  }

  /** Stack of firewood (solid, climbable). */
  woodpile(w = 3, h = 1.2): Mesh {
    const b = this.b("woodpile");
    const rows = Math.max(1, Math.round(h / 0.4));
    for (let r = 0; r < rows; r++) {
      const n = Math.max(1, Math.round(w / 0.45));
      for (let i = 0; i < n; i++) {
        b.part("m", cyl(0.42, 0.42, 1.2, 6), i % 3 === 0 ? "wood" : "brown", {
          pos: [-w / 2 + 0.22 + i * (w / n), 0.21 + r * 0.4, 0],
          rot: [90, 0, 0],
        });
      }
    }
    b.part("m", box(w + 0.1, 0.12, 1.3), "snow", { pos: [0, rows * 0.4 + 0.03, 0] });
    return b.buildSingle();
  }

  /** Steel sap tank. */
  sapTank(h = 4.5): Mesh {
    return this.b("sapTank")
      .part("m", cyl(3, 3, h, 12), "grey", { pos: [0, h / 2, 0] })
      .part("m", torus(3, 0.1, 12), "darkGrey", { pos: [0, h * 0.3, 0] })
      .part("m", torus(3, 0.1, 12), "darkGrey", { pos: [0, h * 0.7, 0] })
      .part("m", cyl(3.1, 3.1, 0.3, 12), "snow", { pos: [0, h + 0.1, 0] })
      .part("m", cyl(0.2, 0.2, 2, 6), "sky", { pos: [1.4, 1, 1.2], rot: [0, 0, 90] })
      .buildSingle();
  }

  /** A snow trough with maple taffy lines (tire sur la neige). */
  tireTrough(): Mesh {
    const b = this.b("trough")
      .part("m", box(3, 0.6, 1.4), "wood", { pos: [0, 0.3, 0] })
      .part("m", box(2.8, 0.1, 1.2), "snow", { pos: [0, 0.62, 0] });
    for (let i = 0; i < 4; i++) {
      b.part("m", box(0.12, 0.04, 0.9), "gold", {
        pos: [-1 + i * 0.66, 0.68, 0],
        glow: true,
        glowStrength: 0.4,
      });
    }
    return b.buildSingle();
  }

  /**
   * The sugar shack: walls with a front door, a partition between the dining room
   * and the evaporator room, a porch roof, and a smoking chimney.
   */
  cabane(w = 20, d = 12, h = 4): Mesh {
    const b = this.b("cabane");
    const t = 0.4;
    roofSnow(b, w + 1, 4, d + 1.4, [0, h, 0]);
    // Front wall (z = -d/2) with a door gap, back wall, sides.
    b.part("m", box(w / 2 - 1.5, h, t), "wood", { pos: [-(w / 4 + 0.75), h / 2, -d / 2] })
      .part("m", box(w / 2 - 1.5, h, t), "wood", { pos: [w / 4 + 0.75, h / 2, -d / 2] })
      .part("m", box(3, h - 2.8, t), "wood", { pos: [0, h - (h - 2.8) / 2, -d / 2] })
      .part("m", box(w, h, t), "wood", { pos: [0, h / 2, d / 2] })
      .part("m", box(t, h, d), "wood", { pos: [-w / 2, h / 2, 0] })
      .part("m", box(t, h, d), "wood", { pos: [w / 2, h / 2, 0] })
      // Partition at x = 2 with a doorway.
      .part("m", box(t, h, 4), "brown", { pos: [2, h / 2, -d / 2 + 2] })
      .part("m", box(t, h, d - 7), "brown", { pos: [2, h / 2, d / 2 - (d - 7) / 2] })
      .part("m", box(t, h - 2.8, 3), "brown", { pos: [2, h - (h - 2.8) / 2, -d / 2 + 5.5] })
      .part("m", box(w, 0.1, d), "darkBrown", { pos: [0, 0.05, 0] })
      .part("m", prism(w + 1, 4, d + 1.4), "deepRed", { pos: [0, h, 0] })
      // Porch roof on the left of the door.
      .part("m", box(7, 0.25, 3), "deepRed", { pos: [-6.5, 3, -d / 2 - 1.5] })
      .part("m", box(7.2, 0.2, 3.2), "snow", { pos: [-6.5, 3.18, -d / 2 - 1.5] })
      .part("m", cyl(0.2, 0.2, 3, 5), "darkBrown", { pos: [-9.6, 1.5, -d / 2 - 2.8] })
      .part("m", cyl(0.2, 0.2, 3, 5), "darkBrown", { pos: [-3.4, 1.5, -d / 2 - 2.8] })
      // Sign.
      .part("m", box(4.2, 1, 0.15), "white", { pos: [0, h - 0.4, -d / 2 - 0.25] })
      .part("m", box(4, 0.8, 0.16), "red", { pos: [0, h - 0.4, -d / 2 - 0.26] })
      // Steam vent + chimney over the evaporator.
      .part("m", box(3, 1.4, 1.6), "wood", { pos: [6, h + 4, 0] })
      .part("m", prism(3.6, 0.8, 2), "deepRed", { pos: [6, h + 4.7, 0] })
      .part("m", cyl(0.8, 0.8, 3, 8), "darkGrey", { pos: [7, h + 4.5, 3.5] });
    for (const x of [-7, -3, 6]) {
      b.part("m", box(1.4, 1.2, 0.1), "warmLight", {
        pos: [x, 2.2, -d / 2 - 0.22],
        glow: true,
        glowStrength: 0.9,
      });
    }
    return b.buildSingle();
  }

  /** Feast table for the réveillon. */
  feastTable(len = 8): Mesh {
    const b = this.b("table")
      .part("m", box(len, 0.15, 1.6), "wood", { pos: [0, 1, 0] })
      .part("m", box(len - 0.2, 0.04, 1.4), "white", { pos: [0, 1.09, 0] })
      .part("m", box(len - 0.4, 0.12, 0.4), "brown", { pos: [0, 0.5, 1.3] })
      .part("m", box(len - 0.4, 0.12, 0.4), "brown", { pos: [0, 0.5, -1.3] });
    for (const x of [-len / 2 + 0.4, len / 2 - 0.4]) {
      for (const z of [-0.6, 0.6]) b.part("m", box(0.15, 1, 0.15), "brown", { pos: [x, 0.5, z] });
    }
    for (let i = 0; i < 6; i++) {
      b.part("m", cyl(0.5, 0.5, 0.04, 8), "white", {
        pos: [-len / 2 + 0.9 + i * ((len - 1.8) / 5), 1.13, i % 2 ? 0.4 : -0.4],
      });
    }
    b.part("m", cyl(0.12, 0.14, 0.4, 6), "cream", { pos: [-1, 1.3, 0] }).part(
      "m",
      sphere(0.1, 2),
      "warmLight",
      {
        pos: [-1, 1.56, 0],
        glow: true,
      },
    );
    return b.buildSingle();
  }

  /** Ragoût de boulettes in a bowl. */
  ragout(): Mesh {
    return this.b("ragout")
      .part("m", cyl(0.6, 0.36, 0.28, 10), "sky", { pos: [0, 0.14, 0] })
      .part("m", cyl(0.54, 0.54, 0.03, 10), "darkBrown", { pos: [0, 0.27, 0] })
      .part("m", sphere(0.16, 2), "brown", { pos: [0.1, 0.3, 0.05] })
      .part("m", sphere(0.16, 2), "brown", { pos: [-0.12, 0.3, -0.04] })
      .buildSingle();
  }

  /** Bûche de Noël (full heal). */
  buche(): Mesh {
    return this.b("buche")
      .part("m", cyl(0.5, 0.5, 1.1, 8), "darkBrown", { pos: [0, 0.25, 0], rot: [0, 0, 90] })
      .part("m", cyl(0.42, 0.42, 0.02, 8), "cream", { pos: [0.56, 0.25, 0], rot: [0, 0, 90] })
      .part("m", sphere(0.12, 2), "red", { pos: [0.1, 0.52, 0] })
      .part("m", sphere(0.12, 2), "red", { pos: [0.22, 0.52, 0.06] })
      .part("m", box(0.3, 0.02, 0.14), "green", { pos: [0.05, 0.5, 0.1], rot: [0, 30, 0] })
      .part("m", box(0.6, 0.06, 0.6), "white", { pos: [0, 0, 0] })
      .buildSingle();
  }

  /** The evaporator: a long steaming pan on a firebox. */
  evaporator(): Mesh {
    return this.b("evap")
      .part("m", box(6, 0.9, 2.4), "darkGrey", { pos: [0, 0.45, 0] })
      .part("m", box(5.8, 0.4, 2.2), "grey", { pos: [0, 1.1, 0] })
      .part("m", box(5.6, 0.05, 2), "orange", { pos: [0, 1.28, 0], glow: true, glowStrength: 0.6 })
      .part("m", box(1, 0.6, 0.1), "orange", {
        pos: [-2.4, 0.45, -1.22],
        glow: true,
        glowStrength: 1.3,
      })
      .part("m", cyl(0.6, 0.6, 3, 8), "darkGrey", { pos: [2.4, 2.8, 0.8] })
      .buildSingle();
  }

  capGun(): Mesh {
    return this.b("capgun")
      .part("m", box(0.1, 0.14, 0.3), "red", { pos: [0, 0, 0.05] })
      .part("m", cyl(0.07, 0.07, 0.24, 6), "white", { pos: [0, 0.03, 0.28], rot: [90, 0, 0] })
      .part("m", torus(0.075, 0.025, 6), "red", { pos: [0, 0.03, 0.34], rot: [90, 0, 0] })
      .part("m", box(0.08, 0.2, 0.1), "white", { pos: [0, -0.12, -0.04], rot: [-15, 0, 0] })
      .part("m", box(0.02, 0.06, 0.02), "gold", { pos: [0, 0.1, 0.36] })
      .buildSingle();
  }

  // ---------- Rooftops (level 6) ----------

  /**
   * Brick plex with a flat, snowy roof: the rooftop level's platforms. Origin on the
   * street; the roof surface (the snow on it) is at `h`.
   * Rows of windows on every face, some lit.
   */
  plex(w: number, d: number, h: number, seed = 1): Mesh {
    const rand = mulberry32(seed);
    const brick = pick(rand, ["brick", "brickDark", "brick", "ginger"] as const);
    // No two faces share a plane (that flickers, z-fighting): the walls stop under the
    // cornice, and the snow lies on the cornice. The snow's top is exactly `h`, where
    // you stand, so blood pools land on it rather than under it.
    const b = this.b("plex")
      .part("m", box(w, h - 0.32, d), brick, { pos: [0, (h - 0.32) / 2, 0] })
      .part("m", box(w + 0.24, 0.24, d + 0.24), "icing", { pos: [0, h - 0.2, 0] })
      .part("m", box(w - 0.2, 0.08, d - 0.2), "snow", { pos: [0, h - 0.04, 0] });
    for (let y = 1.7; y < h - 1.2; y += 2.5) {
      // [length the windows spread over, depth across to the face, axis they spread along]:
      // the faces at x = ±w/2 run along z (length d); the faces at z = ±d/2 run along x.
      for (const [faceW, faceD, along] of [
        [d, w, "z"],
        [w, d, "x"],
      ] as const) {
        const n = Math.max(1, Math.floor(faceW / 2.4));
        for (const side of [-1, 1]) {
          for (let i = 0; i < n; i++) {
            const t = -faceW / 2 + ((i + 0.5) * faceW) / n;
            const lit = rand() < 0.4;
            const out = side * (faceD / 2 + 0.03);
            b.part(
              "m",
              box(along === "z" ? 0.08 : 0.8, 1.1, along === "z" ? 0.8 : 0.08),
              lit ? "warmLight" : "plum",
              {
                pos: along === "z" ? [out, y, t] : [t, y, out],
                glow: lit,
                glowStrength: 0.7,
              },
            );
          }
        }
      }
    }
    return b.buildSingle();
  }

  /** Wooden water tower on legs; the flat lid (5.2 m up) can be stood on. */
  waterTower(): Mesh {
    const b = this.b("waterTower");
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      b.part("m", cyl(0.18, 0.18, 3.1, 6), "darkBrown", { pos: [x, 1.55, z] });
    }
    return b
      .part("m", box(3, 0.2, 3), "darkBrown", { pos: [0, 3.1, 0] })
      .part("m", cyl(2.6, 2.6, 2, 10), "wood", { pos: [0, 4.2, 0] })
      .part("m", torus(2.62, 0.08, 10), "darkGrey", { pos: [0, 3.7, 0] })
      .part("m", torus(2.62, 0.08, 10), "darkGrey", { pos: [0, 4.7, 0] })
      .part("m", cyl(2.7, 2.7, 0.12, 10), "snow", { pos: [0, 5.2, 0] })
      .buildSingle();
  }

  /** Plank bridge between two roofs, `len` long along local x. */
  plank(len: number): Mesh {
    const b = this.b("plank").part("m", box(len, 0.16, 1.4), "wood", { pos: [0, -0.08, 0] });
    for (let x = -len / 2 + 0.6; x < len / 2; x += 1.2) {
      b.part("m", box(0.12, 0.06, 1.42), "darkBrown", { pos: [x, 0.01, 0] });
    }
    return b.buildSingle();
  }

  /** Rooftop vent box: cover, and a step up to a higher roof. */
  vent(): Mesh {
    return this.b("vent")
      .part("m", box(1.2, 1.1, 1.2), "grey", { pos: [0, 0.55, 0] })
      .part("m", box(1.0, 0.06, 1.0), "darkGrey", { pos: [0, 1.12, 0] })
      .part("m", box(1.25, 0.08, 0.1), "darkGrey", { pos: [0, 0.75, 0.6] })
      .part("m", box(1.25, 0.08, 0.1), "darkGrey", { pos: [0, 0.45, 0.6] })
      .buildSingle();
  }

  /** Brick chimney stack, `h` tall, with a snow cap. */
  chimneyStack(h: number): Mesh {
    return this.b("stack")
      .part("m", box(0.9, h, 0.9), "brickDark", { pos: [0, h / 2, 0] })
      .part("m", box(1.05, 0.2, 1.05), "darkGrey", { pos: [0, h - 0.1, 0] })
      .part("m", box(0.95, 0.08, 0.95), "snow", { pos: [0, h + 0.04, 0] })
      .buildSingle();
  }

  /** Wooden balcony (2 × 3 m) with a railing on its outer side; origin = floor centre. */
  balcony(): Mesh {
    const b = this.b("balcony").part("m", box(2, 0.16, 3), "wood", { pos: [0, -0.08, 0] });
    for (let z = -1.4; z <= 1.41; z += 0.7)
      b.part("m", box(0.08, 0.9, 0.08), "darkBrown", { pos: [-0.95, 0.45, z] });
    return b.part("m", box(0.1, 0.08, 3), "darkBrown", { pos: [-0.95, 0.9, 0] }).buildSingle();
  }

  // ---------- Toy factory (level 7) ----------

  /** A factory wall section (w × h × d), dark brick with a steel cap and high lit windows. */
  factoryWall(w: number, h: number, d: number): Mesh {
    const b = this.b("fwall")
      .part("m", box(w, h - 0.3, d), "brickDark", { pos: [0, (h - 0.3) / 2, 0] })
      .part("m", box(w + 0.1, 0.3, d + 0.1), "steel", { pos: [0, h - 0.15, 0] });
    const long = Math.max(w, d);
    const n = Math.floor(long / 4);
    for (let i = 0; i < n; i++) {
      const t = -long / 2 + (i + 0.5) * (long / n);
      for (const side of [-1, 1]) {
        const out = side * (Math.min(w, d) / 2 + 0.03);
        b.part("m", box(w > d ? 1.6 : 0.08, 1, w > d ? 0.08 : 1.6), "warmLight", {
          pos: w > d ? [t, h - 1.6, out] : [out, h - 1.6, t],
          glow: true,
          glowStrength: 0.6,
        });
      }
    }
    return b.buildSingle();
  }

  /** Flat concrete factory floor (w × d) with painted safety lines every 4 m. */
  floorSlab(w: number, d: number): Mesh {
    const b = this.b("slab").part("m", box(w, 0.1, d), "darkGrey", { pos: [0, -0.05, 0] });
    for (let z = -d / 2 + 4; z < d / 2; z += 4) {
      b.part("m", box(w, 0.02, 0.12), "grey", { pos: [0, 0.005, z] });
    }
    return b.buildSingle();
  }

  /** Corrugated steel roller shutter (w × h), hazard stripe at the bottom. */
  shutter(w: number, h: number): Mesh {
    const b = this.b("shutter").part("m", box(w, h, 0.3), "steel", { pos: [0, h / 2, 0] });
    for (let y = 0.5; y < h; y += 0.5) {
      b.part("m", box(w + 0.02, 0.08, 0.34), "darkGrey", { pos: [0, y, 0] });
    }
    for (let x = -w / 2 + 0.25; x < w / 2; x += 0.5) {
      b.part("m", box(0.25, 0.25, 0.34), x % 1 < 0.5 ? "gold" : "black", { pos: [x, 0.13, 0] });
    }
    return b.buildSingle();
  }

  /** Conveyor frame (`len` along local x, `width` along z); the belt surface is 0.3 m up. */
  conveyor(len: number, width: number): Mesh {
    const b = this.b("conveyor")
      .part("m", box(len, 0.26, width), "darkGrey", { pos: [0, 0.13, 0] })
      .part("m", box(len, 0.04, width - 0.3), "black", { pos: [0, 0.28, 0] });
    for (const side of [-1, 1]) {
      b.part("m", box(len, 0.12, 0.12), "gold", { pos: [0, 0.32, side * (width / 2 - 0.06)] });
    }
    for (const end of [-1, 1]) {
      b.part("m", cyl(0.3, 0.3, width - 0.2, 8), "steel", {
        pos: [(end * len) / 2, 0.15, 0],
        rot: [90, 0, 0],
      });
    }
    return b.buildSingle();
  }

  /** The belt's slats: one mesh, slid along by the level so the belt visibly moves. */
  conveyorTread(len: number, width: number): Mesh {
    const b = this.b("tread");
    for (let x = -len / 2 + 0.5; x <= len / 2 - 0.5; x += 1) {
      b.part("m", box(0.14, 0.04, width - 0.4), "steel", { pos: [x, 0.31, 0] });
    }
    return b.buildSingle();
  }

  /** Grinder trough: a grate frame over a dark pit (`len` along z). The rollers spin separately. */
  grinder(len: number, width: number): Mesh {
    const b = this.b("grinder")
      .part("m", box(width, 0.05, len), "black", { pos: [0, 0.02, 0] })
      .part("m", box(width, 0.12, len), "orange", {
        pos: [0, -0.04, 0],
        glow: true,
        glowStrength: 0.5,
      });
    for (const side of [-1, 1]) {
      b.part("m", box(0.2, 0.3, len), "gold", { pos: [side * (width / 2 - 0.1), 0.15, 0] });
    }
    for (let z = -len / 2; z <= len / 2; z += 1) {
      b.part("m", box(width, 0.31, 0.1), z % 2 === 0 ? "black" : "gold", { pos: [0, 0.15, z] });
    }
    return b.buildSingle();
  }

  /** A row of toothed rollers along z (spun by the level). */
  grinderRoller(len: number): Mesh {
    const b = this.b("roller").part("m", cyl(0.5, 0.5, len, 8), "steel", { rot: [90, 0, 0] });
    for (let z = -len / 2 + 0.5; z < len / 2; z += 1) {
      for (let k = 0; k < 4; k++) {
        b.part("m", box(0.14, 0.7, 0.14), "darkGrey", { pos: [0, 0, z], rot: [0, 0, k * 45] });
      }
    }
    return b.buildSingle();
  }

  /** Stamping press frame: two hazard-striped pillars and a beam, 6.4 m tall (ram spans 3 m). */
  pressFrame(): Mesh {
    const b = this.b("pressFrame").part("m", box(5.6, 0.7, 1.2), "steel", { pos: [0, 6.05, 0] });
    for (const sx of [-1, 1]) {
      b.part("m", box(0.5, 6, 0.5), "steel", { pos: [sx * 2.5, 3, 0] });
      for (let y = 0.3; y < 5.8; y += 0.6) {
        b.part("m", box(0.52, 0.3, 0.52), "gold", { pos: [sx * 2.5, y, 0] });
      }
    }
    b.part("m", sphere(0.3, 2), "eyeRed", { pos: [0, 5.6, 0.62], glow: true, glowStrength: 1.2 });
    return b.buildSingle();
  }

  /** The press's ram: a heavy block with a hazard edge and its piston; origin at the ram's underside. */
  pressRam(): Mesh {
    return this.b("pressRam")
      .part("m", box(3, 1.1, 3), "darkGrey", { pos: [0, 0.55, 0] })
      .part("m", box(3.05, 0.2, 3.05), "gold", { pos: [0, 0.1, 0] })
      .part("m", cyl(0.6, 0.6, 5, 8), "steel", { pos: [0, 3.6, 0] })
      .buildSingle();
  }

  /** La Machine à Jouets: a furnace-bellied toy machine with a funnel, gears and a chute (6 × 5.5 × 6). */
  toyMachine(): Mesh {
    const b = this.b("toyMachine")
      .part("m", box(6, 5.5, 6), "rust", { pos: [0, 2.75, 0] })
      .part("m", box(6.2, 0.3, 6.2), "steel", { pos: [0, 5.5, 0] })
      .part("m", cyl(3.2, 1.2, 1.6, 8), "steel", { pos: [0, 6.4, 0] })
      .part("m", box(2.4, 1.8, 0.1), "orange", {
        pos: [0, 3.4, 3.03],
        glow: true,
        glowStrength: 1.4,
      })
      .part("m", box(2.2, 1.4, 1.4), "black", { pos: [0, 0.7, 3.4] })
      .part("m", box(2.4, 0.15, 1.6), "gold", { pos: [0, 1.45, 3.4] });
    for (const sx of [-1, 1]) {
      b.part("m", torus(1.8, 0.3, 12), "gold", { pos: [sx * 3.05, 3.4, 0], rot: [0, 0, 90] });
      b.part("m", cyl(0.5, 0.5, 0.3, 8), "steel", { pos: [sx * 3.1, 3.4, 0], rot: [0, 0, 90] });
    }
    for (let i = 0; i < 5; i++) {
      b.part("m", sphere(0.22, 2), i % 2 ? "eyeRed" : "gold", {
        pos: [-1.6 + i * 0.8, 4.8, 3.02],
        glow: true,
        glowStrength: 1.3,
      });
    }
    return b.buildSingle();
  }

  /** A pressure valve: a pipe with a big red wheel (2.4 m tall). */
  valve(): Mesh {
    return this.b("valve")
      .part("m", cyl(0.7, 0.7, 2.4, 8), "steel", { pos: [0, 1.2, 0] })
      .part("m", cyl(0.9, 0.9, 0.2, 8), "darkGrey", { pos: [0, 0.1, 0] })
      .part("m", torus(1.1, 0.14, 12), "red", { pos: [0, 2.55, 0] })
      .part("m", box(1.1, 0.1, 0.1), "red", { pos: [0, 2.55, 0] })
      .part("m", box(0.1, 0.1, 1.1), "red", { pos: [0, 2.55, 0] })
      .part("m", cyl(0.4, 0.4, 0.1, 8), "white", { pos: [0, 1.6, 0.36], rot: [90, 0, 0] })
      .part("m", box(0.04, 0.16, 0.02), "eyeRed", { pos: [0, 1.64, 0.42], glow: true })
      .buildSingle();
  }

  /** Steel catwalk (`len` along z, `width` along x), origin at its top surface; railing on +x. */
  catwalk(len: number, width: number): Mesh {
    const b = this.b("catwalk").part("m", box(width, 0.2, len), "darkGrey", { pos: [0, -0.1, 0] });
    for (let z = -len / 2; z <= len / 2; z += 2) {
      b.part("m", box(0.08, 1, 0.08), "steel", { pos: [width / 2 - 0.05, 0.5, z] });
    }
    return b
      .part("m", box(0.08, 0.08, len), "steel", { pos: [width / 2 - 0.05, 1, 0] })
      .buildSingle();
  }

  /** Factory shelf full of half-finished toys. */
  toyShelf(seed = 1): Mesh {
    const rand = mulberry32(seed);
    const b = this.b("shelf");
    for (const sx of [-1, 1]) b.part("m", box(0.1, 3, 0.8), "steel", { pos: [sx * 1.45, 1.5, 0] });
    for (const y of [0.1, 1.1, 2.1, 2.95])
      b.part("m", box(3, 0.08, 0.8), "darkGrey", { pos: [0, y, 0] });
    for (const y of [0.15, 1.15, 2.15]) {
      for (let i = 0; i < 4; i++) {
        const c = pick(rand, ["red", "mint", "gold", "candyPink", "sky", "lavender"] as const);
        const x = -1.1 + i * 0.73;
        if (rand() < 0.5) b.part("m", box(0.45, 0.45, 0.45), c, { pos: [x, y + 0.23, 0] });
        else b.part("m", sphere(0.42, 2), c, { pos: [x, y + 0.21, 0] });
      }
    }
    return b.buildSingle();
  }

  /** A lamp hanging on a chain from 3 m above its shade (origin at the bulb). */
  hangingLamp(): Mesh {
    return this.b("hlamp")
      .part("m", cyl(0.04, 0.04, 3, 4), "darkGrey", { pos: [0, 1.7, 0] })
      .part("m", cone(0.9, 0.4, 8), "steel", { pos: [0, 0.2, 0], rot: [180, 0, 0] })
      .part("m", sphere(0.3, 2), "warmLight", { pos: [0, 0, 0], glow: true, glowStrength: 1.6 })
      .buildSingle();
  }

  /** Guirlande Électrique: a battery pack with a coil of Christmas lights round the barrel. */
  garlandGun(): Mesh {
    const b = this.b("garland")
      .part("m", box(0.14, 0.18, 0.4), "green", { pos: [0, 0, 0] })
      .part("m", box(0.1, 0.22, 0.12), "darkGrey", { pos: [0, -0.16, -0.08], rot: [-15, 0, 0] })
      .part("m", cyl(0.07, 0.07, 0.5, 6), "steel", { pos: [0, 0.03, 0.4], rot: [90, 0, 0] })
      .part("m", box(0.06, 0.06, 0.12), "gold", { pos: [0, 0.03, 0.7] });
    const bulbs = ["red", "gold", "sky", "mint", "candyPink"] as const;
    for (let i = 0; i < 8; i++) {
      const a = i * 1.2;
      b.part("m", sphere(0.06, 2), bulbs[i % bulbs.length] as (typeof bulbs)[number], {
        pos: [Math.cos(a) * 0.1, 0.03 + Math.sin(a) * 0.1, 0.2 + i * 0.06],
        glow: true,
        glowStrength: 1.3,
      });
    }
    return b.buildSingle();
  }

  // ---------- Reindeer stables (level 8) ----------

  /** Ranch fence (`length` along x): split-rail posts and two rails, 1.3 m tall. */
  woodFence(length: number): Mesh {
    const b = this.b("woodFence");
    const posts = Math.max(2, Math.round(length / 2) + 1);
    for (let i = 0; i < posts; i++) {
      b.part("m", box(0.2, 1.4, 0.2), "darkBrown", {
        pos: [-length / 2 + (i / (posts - 1)) * length, 0.7, 0],
      });
    }
    for (const y of [0.55, 1.1]) b.part("m", box(length, 0.14, 0.1), "wood", { pos: [0, y, 0] });
    return b.buildSingle();
  }

  /** A round hay bale (1.4 wide, 1.1 tall) lying on its side. */
  hayBale(): Mesh {
    return this.b("hay")
      .part("m", cyl(1.1, 1.1, 1.4, 10), "gold", { pos: [0, 0.55, 0], rot: [0, 0, 90] })
      .part("m", torus(1.1, 0.04, 10), "carrot", { pos: [0.4, 0.55, 0], rot: [0, 0, 90] })
      .part("m", torus(1.1, 0.04, 10), "carrot", { pos: [-0.4, 0.55, 0], rot: [0, 0, 90] })
      .buildSingle();
  }

  /** Charred barn wall section (w × h × d): dark planks, a few still glowing embers. */
  barnWall(w: number, h: number, d: number, seed = 1): Mesh {
    const rand = mulberry32(seed);
    const b = this.b("barnWall").part("m", box(w, h, d), "darkBrown", { pos: [0, h / 2, 0] });
    // Plank seams and embers run along the wall's length and only just cover its thickness.
    const alongX = w > d;
    const long = Math.max(w, d);
    const thick = Math.min(w, d);
    const size = (along: number, across: number): [number, number] =>
      alongX ? [along, across] : [across, along];
    for (let t = -long / 2 + 0.5; t < long / 2; t += 1) {
      const burnt = rand() < 0.35;
      const [sx, sz] = size(0.12, thick + 0.04);
      b.part("m", box(sx, h + 0.04, sz), burnt ? "coal" : "brown", {
        pos: alongX ? [t, h / 2 + 0.02, 0] : [0, h / 2 + 0.02, t],
      });
      if (burnt && rand() < 0.5) {
        const [ex, ez] = size(0.3, thick + 0.06);
        b.part("m", box(ex, 0.12, ez), "orange", {
          pos: alongX
            ? [t, randRange(rand, 0.5, h - 0.5), 0]
            : [0, randRange(rand, 0.5, h - 0.5), t],
          glow: true,
          glowStrength: 1,
        });
      }
    }
    return b.buildSingle();
  }

  /** A stall's side partition (planks, `d` deep along x, 1.8 tall). */
  stallWall(d: number): Mesh {
    return this.b("stall")
      .part("m", box(d, 1.8, 0.16), "wood", { pos: [0, 0.9, 0] })
      .part("m", box(d, 0.12, 0.2), "darkBrown", { pos: [0, 1.82, 0] })
      .buildSingle();
  }

  /** A post with chains and a padlock: what keeps a captive reindeer in its stall. */
  chainPost(): Mesh {
    const b = this.b("chainPost")
      .part("m", box(0.3, 1.6, 0.3), "darkBrown", { pos: [0, 0.8, 0] })
      .part("m", box(0.34, 0.3, 0.26), "gold", { pos: [0, 0.9, 0.2] });
    for (let i = 0; i < 5; i++) {
      b.part("m", torus(0.16, 0.04, 6), "steel", {
        pos: [0, 1.3 - i * 0.12, 0.2],
        rot: [i % 2 ? 0 : 90, 0, 0],
      });
    }
    return b.buildSingle();
  }

  /** Thick corral post (1.2 × 4 × 1.2): bait a charging reindeer into it. */
  corralPost(): Mesh {
    return this.b("corralPost")
      .part("m", box(1.2, 4, 1.2), "darkBrown", { pos: [0, 2, 0] })
      .part("m", box(1.3, 0.2, 1.3), "coal", { pos: [0, 3.9, 0] })
      .part("m", box(1.25, 0.6, 1.25), "deepRed", { pos: [0, 1.4, 0] })
      .buildSingle();
  }

  /** Arbalète à Cannes: wooden stock, red-and-white bow arms, a cane bolt loaded. */
  crossbow(): Mesh {
    return this.b("crossbow")
      .part("m", box(0.12, 0.14, 0.7), "wood", { pos: [0, 0, 0.15] })
      .part("m", box(0.1, 0.22, 0.12), "darkBrown", { pos: [0, -0.16, -0.12], rot: [-15, 0, 0] })
      .part("m", box(0.9, 0.06, 0.08), "red", { pos: [0, 0.04, 0.45] })
      .part("m", box(0.92, 0.07, 0.04), "white", { pos: [0, 0.04, 0.47] })
      .part("m", cyl(0.04, 0.04, 0.6, 5), "white", { pos: [0, 0.1, 0.3], rot: [90, 0, 0] })
      .part("m", sphere(0.07, 2), "red", { pos: [0, 0.1, 0.62], glow: true, glowStrength: 1 })
      .buildSingle();
  }

  /** The crossbow's bolt: a short candy cane with a glowing, blinking tip (+z forward). */
  caneBolt(): Mesh {
    return this.b("caneBolt")
      .part("m", cyl(0.06, 0.06, 0.6, 5), "white", { pos: [0, 0, -0.1], rot: [90, 0, 0] })
      .part("m", cyl(0.065, 0.065, 0.1, 5), "red", { pos: [0, 0, 0], rot: [90, 0, 0] })
      .part("m", cyl(0.065, 0.065, 0.1, 5), "red", { pos: [0, 0, -0.25], rot: [90, 0, 0] })
      .part("m", sphere(0.14, 2), "orange", { pos: [0, 0, 0.2], glow: true, glowStrength: 1.6 })
      .buildSingle();
  }

  /** Le Rayon de l'Étoile: a candy-cane handle carrying the giant tree's glowing star (+z). */
  starGun(): Mesh {
    const b = this.b("starGun")
      .part("m", cyl(0.06, 0.06, 0.5, 6), "white", { pos: [0, 0, 0.1], rot: [90, 0, 0] })
      .part("m", cyl(0.065, 0.065, 0.1, 6), "red", { pos: [0, 0, 0.2], rot: [90, 0, 0] })
      .part("m", cyl(0.065, 0.065, 0.1, 6), "red", { pos: [0, 0, 0], rot: [90, 0, 0] })
      .part("m", box(0.08, 0.2, 0.1), "gold", { pos: [0, -0.14, -0.05], rot: [-15, 0, 0] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.part("m", cone(0.12, 0.22, 4), "gold", {
        pos: [Math.sin(a) * 0.12, Math.cos(a) * 0.12, 0.45],
        rot: [0, 0, (-a * 180) / Math.PI],
        glow: true,
        glowStrength: 1.6,
      });
    }
    return b
      .part("m", sphere(0.16, 2), "gold", { pos: [0, 0, 0.45], glow: true, glowStrength: 1.8 })
      .buildSingle();
  }

  /** A thick bare branch, `len` long along +z from its origin (the tree's gallows). */
  gallowsBranch(len: number): Mesh {
    return this.b("gallows")
      .part("m", cyl(0.9, 0.5, len, 6), "darkBrown", { pos: [0, 0, len / 2], rot: [90, 0, 0] })
      .part("m", cyl(0.35, 0.2, 2.2, 5), "darkBrown", {
        pos: [0.5, 0.7, len * 0.55],
        rot: [40, 0, -30],
      })
      .buildSingle();
  }

  /** Mère Noël's cage: a round iron birdcage (1.9 wide, 2.6 tall), origin at its floor. */
  cage(): Mesh {
    const b = this.b("cage")
      .part("m", cyl(1.9, 1.9, 0.15, 12), "black", { pos: [0, 0.07, 0] })
      .part("m", cyl(1.9, 1.9, 0.12, 12), "black", { pos: [0, 2.3, 0] })
      .part("m", cone(1.9, 0.5, 12), "black", { pos: [0, 2.6, 0] })
      .part("m", torus(0.3, 0.06, 8), "gold", { pos: [0, 2.95, 0] });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.part("m", cyl(0.06, 0.06, 2.2, 4), "black", {
        pos: [Math.sin(a) * 0.92, 1.2, Math.cos(a) * 0.92],
      });
    }
    return b.buildSingle();
  }

  /** Gatling à Jujubes: six candy barrels round a hub (+z), a gumdrop drum underneath. */
  gatling(): Mesh {
    const b = this.b("gatling")
      .part("m", box(0.2, 0.22, 0.45), "darkGrey", { pos: [0, 0, 0] })
      .part("m", box(0.1, 0.22, 0.12), "black", { pos: [0, -0.18, -0.1], rot: [-15, 0, 0] })
      .part("m", cyl(0.3, 0.3, 0.3, 8), "candyPink", { pos: [0, -0.24, 0.12] })
      .part("m", cyl(0.16, 0.16, 0.08, 8), "gold", { pos: [0, 0, 0.3], rot: [90, 0, 0] })
      .part("m", cyl(0.16, 0.16, 0.08, 8), "gold", { pos: [0, 0, 0.82], rot: [90, 0, 0] });
    const colors = ["red", "mint", "gold", "sky", "candyPink", "white"] as const;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.part("m", cyl(0.05, 0.05, 0.62, 5), colors[i] as (typeof colors)[number], {
        pos: [Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.58],
        rot: [90, 0, 0],
      });
    }
    return b.buildSingle();
  }

  /** Giant rolling ornament (1.6 m), glossy with a gold cap. */
  giantOrnament(seed = 1): Mesh {
    const c = (["red", "sky", "mint", "lavender"] as const)[seed % 4] as ColorName;
    return this.b("giantOrnament")
      .part("m", sphere(1.6, 4), c, { pos: [0, 0, 0] })
      .part("m", torus(1.2, 0.08, 12), "gold", { pos: [0, 0, 0] })
      .part("m", cyl(0.4, 0.4, 0.3, 8), "gold", { pos: [0, 0.82, 0] })
      .buildSingle();
  }

  /** Fusil à Glaçons: candy-striped stock, long ice barrel, a glowing icicle at the tip. */
  icicleRifle(): Mesh {
    return this.b("icicleRifle")
      .part("m", box(0.12, 0.16, 0.5), "red", { pos: [0, 0, -0.05] })
      .part("m", box(0.1, 0.22, 0.12), "white", { pos: [0, -0.16, -0.14], rot: [-15, 0, 0] })
      .part("m", cyl(0.08, 0.08, 0.7, 6), "ice", { pos: [0, 0.03, 0.5], rot: [90, 0, 0] })
      .part("m", torus(0.1, 0.03, 6), "white", { pos: [0, 0.03, 0.3], rot: [90, 0, 0] })
      .part("m", torus(0.1, 0.03, 6), "white", { pos: [0, 0.03, 0.62], rot: [90, 0, 0] })
      .part("m", box(0.05, 0.08, 0.2), "darkGrey", { pos: [0, 0.14, 0.05] })
      .part("m", cone(0.1, 0.22, 5), "ice", {
        pos: [0, 0.03, 0.96],
        rot: [90, 0, 0],
        glow: true,
        glowStrength: 1.2,
      })
      .buildSingle();
  }

  /** Canne Tranchante, held by the handle; blade along local -Y. */
  bladeCane(): Mesh {
    return this.b("bladeCane")
      .part(
        "m",
        tube(
          [
            [0, 0.12, 0],
            [0, -0.9, 0],
            [0, -1.05, 0.08],
            [0, -1.08, 0.2],
            [0, -1.0, 0.3],
          ],
          0.05,
          "white",
          6,
        ),
        "red",
      )
      .buildSingle();
  }

  /** Ground: a low-poly snowy disc with gentle bumps. */
  ground(
    radius: number,
    seed = 1,
    base: ColorName = "snow",
    patches: ColorName = "snowShade",
  ): Mesh {
    const rand = mulberry32(seed);
    const b = this.b("ground").part("m", disc(radius, 40), base);
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * radius * 0.92;
      b.part("m", disc(randRange(rand, 1, 3.5), 6), patches, {
        pos: [Math.cos(a) * r, 0.01, Math.sin(a) * r],
        rot: [0, rand() * 360, 0],
      });
    }
    const m = b.buildSingle();
    m.receiveShadows = true;
    return m;
  }

  /** Cobblestone plaza (market). */
  plaza(radius: number, seed = 1): Mesh {
    const rand = mulberry32(seed);
    const b = this.b("plaza").part("m", disc(radius, 24), "grey", { pos: [0, 0.005, 0] });
    for (let i = 0; i < 60; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * radius * 0.95;
      b.part(
        "m",
        box(randRange(rand, 0.6, 1.2), 0.04, randRange(rand, 0.6, 1.2)),
        pick(rand, ["darkGrey", "grey", "snowShade"] as const),
        {
          pos: [Math.cos(a) * r, 0.02, Math.sin(a) * r],
          rot: [0, rand() * 90, 0],
        },
      );
    }
    const m = b.buildSingle();
    m.receiveShadows = true;
    return m;
  }

  /** Background mountains ring. */
  mountains(radius: number, seed = 1): Mesh {
    const rand = mulberry32(seed);
    const b = this.b("mountains");
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.1;
      const h = randRange(rand, 10, 24);
      const w = randRange(rand, 14, 24);
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      b.part("m", cone(w, h, 5), "lavender", { pos: [x, h / 2 - 1, z], rot: [0, rand() * 70, 0] });
      b.part("m", cone(w * 0.42, h * 0.42, 5), "snow", {
        pos: [x, h - h * 0.21 - 1 + 0.05, z],
        rot: [0, rand() * 70, 0],
      });
    }
    return b.buildSingle();
  }
}

/** Gable roof sitting on the walls, with a small overhang. */
/**
 * Snow on a pitched roof (a prism of `w` × `h` × `d` with its base at `pos`): the same
 * triangle, smaller, lifted so its slopes lie parallel just above the roof's (no gap, no
 * flicker), covering the top `cover` of the roof.
 */
function roofSnow(b: ModelBuilder, w: number, h: number, d: number, pos: V3, cover = 0.55) {
  const slope = Math.atan2(h, w / 2);
  const lift = 0.14 / Math.cos(slope);
  b.part("m", prism(w * cover, h * cover, d + 0.12), "snow", {
    pos: [pos[0], pos[1] + h + lift - h * cover, pos[2]],
  });
}

function gable(b: ModelBuilder, w: number, d: number, wallTop: number, c: ColorName, over = 1.12) {
  const width = w * over + 0.3;
  b.part("m", prism(width, width * 0.5, d), c, { pos: [0, wallTop - 0.05, 0] });
}

/** Candy-cane shape: straight shaft with a hook on top. */
export function caneLine(h: number): V3[] {
  const r = h * 0.12;
  const pts: V3[] = [
    [0, 0, 0],
    [0, h - r, 0],
  ];
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * Math.PI;
    pts.push([r - Math.cos(a) * r, h - r + Math.sin(a) * r, 0]);
  }
  pts.push([2 * r, h - r * 1.6, 0]);
  return pts;
}

function sleighRunner(): V3[] {
  return [
    [0, 0.5, -1.6],
    [0, 0.1, -1.4],
    [0, 0.1, 1.4],
    [0, 0.4, 1.9],
    [0, 0.8, 1.8],
  ];
}
