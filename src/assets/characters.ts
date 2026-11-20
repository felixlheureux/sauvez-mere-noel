import type { Scene } from "@babylonjs/core";
import { humanoidJoints, type JointName, Rig } from "../anim/Rig";
import type { Materials } from "./Materials";
import { box, cone, cyl, ico, ModelBuilder, sphere, torus } from "./ModelBuilder";

let uid = 0;

function finish(rig: Rig, b: ModelBuilder) {
  for (const [group, mesh] of b.build()) rig.attach(group as JointName, mesh);
  return rig;
}

/** Père Noël — chibi proportions, ~1.6 m tall. */
export function createSanta(scene: Scene, mats: Materials): Rig {
  const name = `santa${uid++}`;
  const rig = new Rig(
    scene,
    name,
    humanoidJoints({
      hips: 0.62,
      legSpread: 0.15,
      chest: 0.06,
      head: 0.62,
      shoulderX: 0.4,
      shoulderY: 0.44,
      hand: 0.46,
      hatTip: [0, 0.74, -0.2],
    }),
    1.6,
  );
  const b = new ModelBuilder(scene, mats, name);

  for (const side of ["legL", "legR"] as const) {
    b.part(side, cyl(0.22, 0.2, 0.4), "red", { pos: [0, -0.2, 0] })
      .part(side, box(0.22, 0.16, 0.32), "black", { pos: [0, -0.55, 0.05] })
      .part(side, cyl(0.25, 0.25, 0.06), "white", { pos: [0, -0.44, 0] });
  }
  b.part("chest", sphere(0.8, 4), "red", { pos: [0, 0.24, 0], scale: [1, 0.95, 0.9] })
    .part("chest", box(0.14, 0.62, 0.06), "white", { pos: [0, 0.26, 0.33] })
    .part("chest", cyl(0.78, 0.78, 0.11, 12), "black", { pos: [0, 0.1, 0], scale: [1, 1, 0.92] })
    .part("chest", box(0.18, 0.14, 0.06), "gold", { pos: [0, 0.1, 0.37] })
    .part("chest", torus(0.42, 0.12, 10), "white", { pos: [0, 0.58, 0] });

  b.part("head", sphere(0.48, 4), "skin", { pos: [0, 0.14, 0] })
    .part("head", ico(0.22, 1), "white", { pos: [0, -0.02, 0.1], scale: [1.15, 1.2, 0.85] })
    .part("head", sphere(0.12, 3), "white", { pos: [-0.07, 0.07, 0.2], scale: [1.3, 0.7, 0.8] })
    .part("head", sphere(0.12, 3), "white", { pos: [0.07, 0.07, 0.2], scale: [1.3, 0.7, 0.8] })
    .part("head", sphere(0.1, 3), "cheek", { pos: [0, 0.12, 0.23] })
    .part("head", sphere(0.065, 2), "black", { pos: [-0.085, 0.2, 0.2] })
    .part("head", sphere(0.065, 2), "black", { pos: [0.085, 0.2, 0.2] })
    .part("head", sphere(0.02, 2), "white", { pos: [-0.075, 0.215, 0.23] })
    .part("head", sphere(0.02, 2), "white", { pos: [0.095, 0.215, 0.23] })
    .part("head", sphere(0.08, 2), "cheek", { pos: [-0.14, 0.12, 0.17] })
    .part("head", sphere(0.08, 2), "cheek", { pos: [0.14, 0.12, 0.17] })
    .part("head", ico(0.08, 1), "white", { pos: [0, 0.27, 0.16], scale: [2.2, 0.6, 0.8] })
    .part("head", torus(0.48, 0.12, 12), "white", { pos: [0, 0.32, 0] })
    .part("head", cone(0.46, 0.55, 8), "red", { pos: [0, 0.56, -0.07], rot: [-22, 0, 0] });
  b.part("hatTip", sphere(0.16, 3), "white");

  for (const side of ["armL", "armR"] as const) {
    b.part(side, cyl(0.2, 0.17, 0.4), "red", { pos: [0, -0.2, 0] })
      .part(side, cyl(0.22, 0.22, 0.08), "white", { pos: [0, -0.38, 0] })
      .part(side, sphere(0.17, 3), "darkGreen", { pos: [0, -0.48, 0] });
  }
  return finish(rig, b);
}

/** Mère Noël — rounder, with a bun, glasses and an apron. */
export function createMereNoel(scene: Scene, mats: Materials): Rig {
  const name = `mere${uid++}`;
  const rig = new Rig(
    scene,
    name,
    humanoidJoints({
      hips: 0.55,
      legSpread: 0.12,
      chest: 0.06,
      head: 0.56,
      shoulderX: 0.34,
      shoulderY: 0.4,
      hand: 0.42,
      hatTip: [0, 0.5, -0.12],
    }),
    1.5,
  );
  const b = new ModelBuilder(scene, mats, name);
  for (const side of ["legL", "legR"] as const) {
    b.part(side, cyl(0.14, 0.12, 0.3), "white", { pos: [0, -0.3, 0] }).part(
      side,
      box(0.16, 0.12, 0.24),
      "black",
      { pos: [0, -0.5, 0.04] },
    );
  }
  b.part("hips", cyl(0.8, 0.5, 0.42, 10), "red", { pos: [0, -0.15, 0] })
    .part("hips", cyl(0.84, 0.84, 0.08, 10), "white", { pos: [0, -0.36, 0] })
    .part("chest", sphere(0.62, 4), "red", { pos: [0, 0.2, 0], scale: [1, 1, 0.88] })
    .part("chest", box(0.36, 0.56, 0.05), "white", { pos: [0, 0.08, 0.27] })
    .part("chest", torus(0.36, 0.1, 10), "white", { pos: [0, 0.48, 0] });
  b.part("head", sphere(0.46, 4), "skin", { pos: [0, 0.14, 0] })
    .part("head", sphere(0.5, 4), "grey", { pos: [0, 0.2, -0.04], scale: [1, 0.85, 1] })
    .part("hatTip", sphere(0.2, 3), "grey")
    .part("head", sphere(0.06, 2), "black", { pos: [-0.08, 0.16, 0.2] })
    .part("head", sphere(0.06, 2), "black", { pos: [0.08, 0.16, 0.2] })
    .part("head", torus(0.12, 0.02, 10), "gold", { pos: [-0.08, 0.16, 0.22], rot: [90, 0, 0] })
    .part("head", torus(0.12, 0.02, 10), "gold", { pos: [0.08, 0.16, 0.22], rot: [90, 0, 0] })
    .part("head", sphere(0.07, 2), "cheek", { pos: [0, 0.09, 0.22] })
    .part("head", sphere(0.09, 2), "cheek", { pos: [-0.13, 0.08, 0.16] })
    .part("head", sphere(0.09, 2), "cheek", { pos: [0.13, 0.08, 0.16] })
    .part("head", box(0.08, 0.02, 0.02), "deepRed", { pos: [0, 0.02, 0.22] });
  for (const side of ["armL", "armR"] as const) {
    b.part(side, cyl(0.16, 0.14, 0.36), "red", { pos: [0, -0.18, 0] }).part(
      side,
      sphere(0.13, 3),
      "skin",
      { pos: [0, -0.42, 0] },
    );
  }
  return finish(rig, b);
}

export type ElfLook = "friendly" | "possessed" | "sprinter" | "thrower" | "bomber" | "skater";

/** Lutin — ~1 m tall. Possessed elves get grey skin, torn hats and glowing red eyes. */
export function createElf(scene: Scene, mats: Materials, look: ElfLook, seed = 0): Rig {
  const name = `elf${uid++}`;
  const possessed = look !== "friendly";
  const sprinter = look === "sprinter";
  const rig = new Rig(
    scene,
    name,
    humanoidJoints({
      hips: 0.36,
      legSpread: 0.1,
      chest: 0.04,
      head: 0.34,
      shoulderX: 0.24,
      shoulderY: 0.24,
      hand: 0.28,
      hatTip: [0, 0.86, 0],
    }),
    1.0,
  );
  const b = new ModelBuilder(scene, mats, name);
  const skin = possessed ? "possessedSkin" : "skin";
  const skater = look === "skater";
  const suit = sprinter
    ? "coal"
    : skater
      ? "red"
      : seed % 3 === 0
        ? "green"
        : seed % 3 === 1
          ? "darkGreen"
          : "pine";
  const hat = possessed ? "deepRed" : seed % 2 === 0 ? "red" : "green";

  for (const side of ["legL", "legR"] as const) {
    b.part(side, cyl(0.12, 0.1, 0.24), possessed ? "darkGreen" : "white", { pos: [0, -0.12, 0] });
    if (skater) {
      // Hockey skates.
      b.part(side, box(0.14, 0.14, 0.24), "black", { pos: [0, -0.27, 0.03] }).part(
        side,
        box(0.03, 0.05, 0.34),
        "grey",
        { pos: [0, -0.37, 0.03] },
      );
    } else if (sprinter) {
      // Barefoot.
      b.part(side, box(0.12, 0.08, 0.2), skin, { pos: [0, -0.28, 0.04] });
    } else {
      b.part(side, cone(0.13, 0.26, 6), possessed ? "coal" : "red", {
        pos: [0, -0.31, 0.08],
        rot: [80, 0, 0],
      }).part(side, sphere(0.06, 2), "gold", { pos: [0, -0.26, 0.22] });
    }
  }
  if (look === "bomber") {
    // A belt of ornament bombs.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.part("chest", sphere(0.13, 2), i % 2 ? "red" : "gold", {
        pos: [Math.cos(a) * 0.23, 0.06, Math.sin(a) * 0.21],
      });
    }
  }
  if (skater) {
    // Hockey jersey stripes and a number.
    b.part("chest", cyl(0.45, 0.45, 0.05, 10), "white", { pos: [0, 0.24, 0], scale: [1, 1, 0.9] })
      .part("chest", cyl(0.42, 0.42, 0.04, 10), "white", { pos: [0, -0.02, 0], scale: [1, 1, 0.9] })
      .part("chest", box(0.12, 0.14, 0.02), "white", { pos: [0, 0.14, -0.2] });
    // The stick, held low in the right hand.
    b.part("armR", cyl(0.04, 0.04, 1.05, 5), "wood", {
      pos: [0, -0.5, 0.18],
      rot: [-35, 0, 0],
    }).part("armR", box(0.06, 0.08, 0.3), "black", { pos: [0, -0.92, 0.42] });
  }
  if (look === "thrower") {
    // A sack of burning coal on his back.
    b.part("chest", sphere(0.42, 3), "darkBrown", { pos: [0, 0.18, -0.28], scale: [1, 1.1, 0.9] })
      .part("chest", sphere(0.12, 2), "orange", {
        pos: [0.05, 0.4, -0.26],
        glow: true,
        glowStrength: 1.2,
      })
      .part("chest", box(0.06, 0.5, 0.06), "darkBrown", {
        pos: [0.12, 0.2, 0.12],
        rot: [0, 0, 30],
      });
  }
  b.part("chest", sphere(0.44, 3), suit, { pos: [0, 0.14, 0], scale: [1, 1.08, 0.9] })
    .part("chest", cyl(0.42, 0.42, 0.07, 10), "black", { pos: [0, 0.06, 0], scale: [1, 1, 0.9] })
    .part("chest", box(0.09, 0.08, 0.04), "gold", { pos: [0, 0.06, 0.19] })
    .part("chest", cone(0.5, 0.12, 8), "red", { pos: [0, 0.34, 0], rot: [180, 0, 0] });

  b.part("head", sphere(0.46, 4), skin, { pos: [0, 0.18, 0] })
    .part("head", cone(0.12, 0.2, 4), skin, { pos: [-0.24, 0.22, 0], rot: [0, 0, 70] })
    .part("head", cone(0.12, 0.2, 4), skin, { pos: [0.24, 0.22, 0], rot: [0, 0, -70] })
    .part("head", sphere(0.07, 2), possessed ? "grey" : "cheek", { pos: [0, 0.14, 0.23] })
    .part("head", torus(0.44, 0.08, 10), possessed ? "grey" : "white", { pos: [0, 0.34, 0] })
    .part("head", cone(0.42, 0.5, 7), hat, {
      // The base sits on the fur band, centred on the head.
      // (Upright: the spring on the tip gives it life.)
      pos: [0, 0.59, 0],
    });
  if (possessed) {
    b.part("head", sphere(0.09, 2), "eyeRed", {
      pos: [-0.09, 0.22, 0.19],
      glow: true,
      glowStrength: 1.4,
    })
      .part("head", sphere(0.09, 2), "eyeRed", {
        pos: [0.09, 0.22, 0.19],
        glow: true,
        glowStrength: 1.4,
      })
      .part("head", box(0.2, 0.06, 0.04), "black", { pos: [0, 0.06, 0.2] })
      .part("head", box(0.03, 0.04, 0.02), "white", { pos: [-0.05, 0.08, 0.22] })
      .part("head", box(0.03, 0.04, 0.02), "white", { pos: [0.05, 0.08, 0.22] })
      .part("head", box(0.1, 0.03, 0.02), "black", { pos: [-0.09, 0.3, 0.2], rot: [0, 0, -20] })
      .part("head", box(0.1, 0.03, 0.02), "black", { pos: [0.09, 0.3, 0.2], rot: [0, 0, 20] });
  } else {
    b.part("head", sphere(0.085, 2), "black", { pos: [-0.09, 0.22, 0.19] })
      .part("head", sphere(0.085, 2), "black", { pos: [0.09, 0.22, 0.19] })
      .part("head", sphere(0.025, 2), "white", { pos: [-0.075, 0.24, 0.23] })
      .part("head", sphere(0.025, 2), "white", { pos: [0.105, 0.24, 0.23] })
      .part("head", sphere(0.07, 2), "cheek", { pos: [-0.15, 0.12, 0.17] })
      .part("head", sphere(0.07, 2), "cheek", { pos: [0.15, 0.12, 0.17] })
      .part("head", torus(0.08, 0.02, 8), "deepRed", { pos: [0, 0.07, 0.21], rot: [70, 0, 0] });
  }
  b.part("hatTip", sphere(0.1, 2), "gold");
  for (const side of ["armL", "armR"] as const) {
    b.part(side, cyl(0.12, 0.1, 0.24), suit, { pos: [0, -0.12, 0] }).part(
      side,
      sphere(0.1, 2),
      skin,
      {
        pos: [0, -0.28, 0],
      },
    );
  }
  return finish(rig, b);
}

/** Père Fouettard — Santa's dark twin. */
export function createFouettard(scene: Scene, mats: Materials): Rig {
  const name = `fouettard${uid++}`;
  const rig = new Rig(
    scene,
    name,
    humanoidJoints({
      hips: 0.8,
      legSpread: 0.16,
      chest: 0.06,
      head: 0.78,
      shoulderX: 0.44,
      shoulderY: 0.58,
      hand: 0.56,
      hatTip: [0, 1.05, -0.1],
    }),
    2.0,
  );
  const b = new ModelBuilder(scene, mats, name);
  for (const side of ["legL", "legR"] as const) {
    b.part(side, cyl(0.2, 0.18, 0.6), "black", { pos: [0, -0.3, 0] }).part(
      side,
      box(0.22, 0.16, 0.36),
      "coal",
      {
        pos: [0, -0.72, 0.06],
      },
    );
  }
  b.part("chest", cyl(0.8, 0.56, 0.9, 8), "plum", { pos: [0, 0.3, 0] })
    .part("chest", cyl(0.84, 0.84, 0.1, 8), "black", { pos: [0, 0.05, 0] })
    .part("chest", box(0.12, 0.8, 0.06), "coal", { pos: [0, 0.32, 0.3] })
    .part("chest", torus(0.5, 0.1, 8), "darkGrey", { pos: [0, 0.74, 0] });
  b.part("head", sphere(0.48, 3), "possessedSkin", { pos: [0, 0.16, 0], scale: [0.9, 1.1, 0.9] })
    .part("head", cone(0.36, 0.5, 5), "darkGrey", { pos: [0, -0.12, 0.12], rot: [190, 0, 0] })
    .part("head", sphere(0.08, 2), "eyeRed", {
      pos: [-0.09, 0.2, 0.2],
      glow: true,
      glowStrength: 1.6,
    })
    .part("head", sphere(0.08, 2), "eyeRed", {
      pos: [0.09, 0.2, 0.2],
      glow: true,
      glowStrength: 1.6,
    })
    .part("head", cone(0.12, 0.34, 5), "coal", { pos: [-0.26, 0.4, 0], rot: [0, 0, 55] })
    .part("head", cone(0.12, 0.34, 5), "coal", { pos: [0.26, 0.4, 0], rot: [0, 0, -55] })
    // The hat sits down over the skull (wider than the head), barely tipped back, on a
    // brim that closes it underneath: no head poking through, nothing to see up inside.
    .part("head", cyl(0.66, 0.66, 0.05, 10), "black", { pos: [0, 0.36, 0] })
    .part("head", cone(0.52, 0.7, 6), "black", { pos: [0, 0.71, -0.05], rot: [-8, 0, 0] });
  b.part("hatTip", sphere(0.16, 2), "darkGrey");
  for (const side of ["armL", "armR"] as const) {
    b.part(side, cyl(0.2, 0.16, 0.52), "plum", { pos: [0, -0.26, 0] }).part(
      side,
      sphere(0.18, 2),
      "coal",
      {
        pos: [0, -0.58, 0],
      },
    );
  }
  return finish(rig, b);
}

/** Bonhomme de neige mutant: big, slow, splits into snowballs when it dies. */
export function createMutantSnowman(scene: Scene, mats: Materials): Rig {
  const name = `snowman${uid++}`;
  const rig = new Rig(
    scene,
    name,
    humanoidJoints({
      hips: 0.7,
      legSpread: 0.2,
      chest: 0.5,
      head: 0.75,
      shoulderX: 0.5,
      shoulderY: 0.2,
      hand: 0.7,
      hatTip: [0, 0.65, 0],
    }),
    2.4,
  );
  const b = new ModelBuilder(scene, mats, name);
  b.part("hips", sphere(1.5, 4), "snow", { pos: [0, 0, 0] })
    .part("hips", sphere(0.12, 2), "deepRed", { pos: [0.4, 0.3, 0.6] })
    .part("chest", sphere(1.1, 4), "snow", { pos: [0, 0.1, 0] })
    .part("chest", sphere(0.1, 2), "coal", { pos: [0, 0.25, 0.53] })
    .part("chest", sphere(0.1, 2), "coal", { pos: [0, 0, 0.55] })
    .part("chest", torus(0.8, 0.16, 10), "deepRed", { pos: [0, 0.48, 0] })
    .part("head", sphere(0.8, 4), "snowShade", { pos: [0, 0.2, 0] })
    .part("head", cone(0.16, 0.5, 5), "carrot", { pos: [0, 0.2, 0.55], rot: [90, 0, 0] })
    .part("head", sphere(0.12, 2), "eyeRed", {
      pos: [-0.15, 0.36, 0.33],
      glow: true,
      glowStrength: 1.4,
    })
    .part("head", sphere(0.12, 2), "eyeRed", {
      pos: [0.15, 0.36, 0.33],
      glow: true,
      glowStrength: 1.4,
    });
  for (let i = 0; i < 6; i++) {
    b.part("head", cone(0.07, 0.14, 4), "coal", {
      pos: [-0.2 + i * 0.08, 0.0, 0.36],
      rot: [180, 0, 0],
    });
  }
  b.part("hatTip", cyl(0.5, 0.5, 0.06, 8), "black").part(
    "hatTip",
    cyl(0.34, 0.34, 0.4, 8),
    "black",
    { pos: [0, 0.2, 0] },
  );
  for (const side of ["armL", "armR"] as const) {
    b.part(side, cyl(0.08, 0.06, 0.8, 4), "darkBrown", { pos: [0, -0.4, 0] })
      .part(side, cyl(0.04, 0.03, 0.3, 3), "darkBrown", { pos: [0.08, -0.75, 0], rot: [0, 0, 30] })
      .part(side, cyl(0.04, 0.03, 0.3, 3), "darkBrown", {
        pos: [-0.08, -0.75, 0],
        rot: [0, 0, -30],
      });
  }
  return finish(rig, b);
}

/** Casse-noisette: a tall wooden toy soldier, possessed — red eyes, snapping jaw. */
export function createNutcracker(scene: Scene, mats: Materials): Rig {
  const name = `nutcracker${uid++}`;
  const rig = new Rig(
    scene,
    name,
    humanoidJoints({
      hips: 0.85,
      legSpread: 0.16,
      chest: 0.06,
      head: 0.66,
      shoulderX: 0.36,
      shoulderY: 0.48,
      hand: 0.55,
      hatTip: [0, 0.95, 0.05],
    }),
    1.9,
  );
  const b = new ModelBuilder(scene, mats, name);
  for (const side of ["legL", "legR"] as const) {
    b.part(side, cyl(0.2, 0.18, 0.62, 6), "white", { pos: [0, -0.31, 0] }).part(
      side,
      box(0.22, 0.3, 0.34),
      "black",
      { pos: [0, -0.72, 0.04] },
    );
  }
  b.part("chest", box(0.66, 0.76, 0.44), "red", { pos: [0, 0.32, 0] })
    .part("chest", box(0.68, 0.09, 0.46), "white", { pos: [0, 0.02, 0] })
    .part("chest", box(0.12, 0.6, 0.04), "white", { pos: [0, 0.36, 0.22] });
  for (let i = 0; i < 3; i++) {
    b.part("chest", sphere(0.06, 2), "gold", { pos: [0, 0.18 + i * 0.16, 0.25] });
  }
  for (const sx of [-1, 1]) {
    b.part("chest", box(0.2, 0.06, 0.26), "gold", { pos: [sx * 0.36, 0.68, 0] });
  }
  b.part("head", box(0.44, 0.44, 0.42), "cream", { pos: [0, 0.22, 0] })
    .part("head", box(0.38, 0.14, 0.36), "cream", { pos: [0, -0.04, 0.06] })
    .part("head", box(0.3, 0.05, 0.04), "white", { pos: [0, 0.03, 0.25] })
    .part("head", box(0.34, 0.07, 0.06), "black", { pos: [0, 0.1, 0.23] })
    .part("head", sphere(0.09, 2), "eyeRed", {
      pos: [-0.1, 0.27, 0.21],
      glow: true,
      glowStrength: 1.4,
    })
    .part("head", sphere(0.09, 2), "eyeRed", {
      pos: [0.1, 0.27, 0.21],
      glow: true,
      glowStrength: 1.4,
    })
    .part("head", sphere(0.1, 2), "cheek", { pos: [0, 0.18, 0.23] })
    .part("head", cyl(0.44, 0.48, 0.55, 8), "black", { pos: [0, 0.72, 0] })
    .part("head", box(0.16, 0.16, 0.04), "gold", { pos: [0, 0.68, 0.23] });
  b.part("hatTip", sphere(0.18, 3), "red", { pos: [0, 0.05, 0], scale: [1, 1.4, 1] });
  for (const side of ["armL", "armR"] as const) {
    b.part(side, cyl(0.15, 0.13, 0.5, 6), "red", { pos: [0, -0.25, 0] }).part(
      side,
      sphere(0.17, 2),
      "white",
      { pos: [0, -0.55, 0] },
    );
  }
  return finish(rig, b);
}

/**
 * A reindeer on the humanoid skeleton laid flat: the back legs hang from the hips,
 * the front legs from the chest (the "arms"), so the walk cycle trots on four legs.
 * Possessed: glowing red eyes. (Black nose: no famous red-nosed reindeer here.)
 */
export function createReindeer(scene: Scene, mats: Materials, possessed: boolean): Rig {
  const name = `reindeer${uid++}`;
  const rig = new Rig(
    scene,
    name,
    [
      { name: "root", parent: null, pos: [0, 0, 0] },
      { name: "body", parent: "root", pos: [0, 0, 0] },
      { name: "hips", parent: "body", pos: [0, 0.98, -0.5] },
      { name: "legL", parent: "hips", pos: [-0.26, 0, 0] },
      { name: "legR", parent: "hips", pos: [0.26, 0, 0] },
      { name: "chest", parent: "hips", pos: [0, 0.06, 1.05] },
      { name: "armL", parent: "chest", pos: [-0.26, -0.06, 0.1] },
      { name: "armR", parent: "chest", pos: [0.26, -0.06, 0.1] },
      { name: "hand", parent: "armR", pos: [0, -0.9, 0] },
      { name: "head", parent: "chest", pos: [0, 0.55, 0.45] },
      { name: "hatTip", parent: "head", pos: [0, 0.5, 0] },
    ],
    1.8,
  );
  const fur = possessed ? "darkBrown" : "brown";
  const b = new ModelBuilder(scene, mats, name);
  b.part("hips", box(0.72, 0.68, 1.0), fur, { pos: [0, 0.1, 0.05] })
    .part("hips", sphere(0.26, 2), "cream", { pos: [0, 0.32, -0.48] })
    .part("chest", box(0.78, 0.78, 0.9), fur, { pos: [0, 0.06, -0.08] })
    .part("chest", box(0.56, 0.5, 0.2), "cream", { pos: [0, -0.08, 0.36] })
    .part("chest", box(0.32, 0.62, 0.34), fur, { pos: [0, 0.4, 0.34], rot: [25, 0, 0] });
  b.part("head", box(0.4, 0.42, 0.58), fur, { pos: [0, 0.05, 0.12] })
    .part("head", box(0.3, 0.26, 0.3), "cream", { pos: [0, -0.06, 0.48] })
    .part("head", sphere(0.14, 2), "coal", { pos: [0, -0.02, 0.64] })
    .part("head", box(0.1, 0.22, 0.06), fur, { pos: [-0.26, 0.2, 0], rot: [0, 0, 40] })
    .part("head", box(0.1, 0.22, 0.06), fur, { pos: [0.26, 0.2, 0], rot: [0, 0, -40] })
    .part("head", sphere(0.1, 2), possessed ? "eyeRed" : "black", {
      pos: [-0.17, 0.1, 0.3],
      glow: possessed,
      glowStrength: 1.5,
    })
    .part("head", sphere(0.1, 2), possessed ? "eyeRed" : "black", {
      pos: [0.17, 0.1, 0.3],
      glow: possessed,
      glowStrength: 1.5,
    });
  // Antlers: a main beam and two tines each side.
  for (const sx of [-1, 1]) {
    b.part("head", cyl(0.07, 0.05, 0.7, 4), "cream", {
      pos: [sx * 0.2, 0.5, -0.02],
      rot: [-15, 0, sx * -30],
    })
      .part("head", cyl(0.05, 0.03, 0.35, 4), "cream", {
        pos: [sx * 0.32, 0.62, 0.12],
        rot: [40, 0, sx * -10],
      })
      .part("head", cyl(0.05, 0.03, 0.4, 4), "cream", {
        pos: [sx * 0.44, 0.8, -0.05],
        rot: [-30, 0, sx * -60],
      });
  }
  for (const side of ["legL", "legR", "armL", "armR"] as const) {
    b.part(side, cyl(0.2, 0.14, 0.5, 5), fur, { pos: [0, -0.26, 0] })
      .part(side, cyl(0.11, 0.09, 0.45, 5), fur, { pos: [0, -0.68, 0] })
      .part(side, box(0.16, 0.1, 0.2), "black", { pos: [0, -0.93, 0.03] });
  }
  return finish(rig, b);
}

/** A small evil snowball (what the mutant snowman splits into). */
export function createSnowball(scene: Scene, mats: Materials): Rig {
  const name = `snowball${uid++}`;
  const rig = new Rig(
    scene,
    name,
    humanoidJoints({
      hips: 0.35,
      legSpread: 0.1,
      chest: 0,
      head: 0,
      shoulderX: 0.3,
      shoulderY: 0,
      hand: 0.2,
      hatTip: [0, 0.4, 0],
    }),
    0.7,
  );
  const b = new ModelBuilder(scene, mats, name);
  b.part("head", sphere(0.7, 3), "snow")
    .part("head", sphere(0.1, 2), "eyeRed", {
      pos: [-0.12, 0.08, 0.3],
      glow: true,
      glowStrength: 1.4,
    })
    .part("head", sphere(0.1, 2), "eyeRed", {
      pos: [0.12, 0.08, 0.3],
      glow: true,
      glowStrength: 1.4,
    });
  for (let i = 0; i < 4; i++) {
    b.part("head", cone(0.06, 0.12, 4), "coal", {
      pos: [-0.1 + i * 0.07, -0.1, 0.32],
      rot: [180, 0, 0],
    });
  }
  return finish(rig, b);
}
