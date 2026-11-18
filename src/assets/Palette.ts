import { Color3 } from "@babylonjs/core";

/** One shared palette keeps every procedural model consistent. */
export const PALETTE = {
  red: "#e2384d",
  deepRed: "#a3172b",
  white: "#fff7f0",
  snow: "#eef4ff",
  snowShade: "#d6e2f5",
  ice: "#bfe3ff",
  skin: "#ffd0b0",
  cheek: "#ff9fb2",
  black: "#2a2230",
  coal: "#3b3442",
  gold: "#ffc94a",
  green: "#3dbb7a",
  darkGreen: "#1f7a4f",
  pine: "#2f9e6a",
  pineDark: "#217651",
  mint: "#9ff0d2",
  brown: "#8a5a3b",
  darkBrown: "#5e3a26",
  ginger: "#c9813f",
  brick: "#a4483c",
  brickDark: "#6a2b27",
  slush: "#251329",
  steel: "#59606e",
  rust: "#8a4a2a",
  icing: "#fffaf2",
  candyPink: "#ff8fbf",
  bubblegum: "#ffb3d4",
  sky: "#9fd6ff",
  lavender: "#c7b3ff",
  grey: "#9aa3b5",
  darkGrey: "#555066",
  orange: "#ff9a3c",
  carrot: "#ff7a1f",
  wood: "#b07d52",
  cream: "#fff1d6",
  plum: "#4a2a5e",
  possessedSkin: "#a9b79c",
  blood: "#a8001c",
  eyeRed: "#ff2238",
  warmLight: "#ffd88a",
  deepWater: "#0d2036",
  waterShine: "#3f7896",
} as const;

export type ColorName = keyof typeof PALETTE;
export type ColorLike = ColorName | Color3;

const cache = new Map<string, Color3>();

export function color(c: ColorLike): Color3 {
  if (c instanceof Color3) return c;
  let v = cache.get(c);
  if (!v) {
    v = Color3.FromHexString(PALETTE[c]);
    cache.set(c, v);
  }
  return v;
}

/** Same as `color` but in gamma space (for UI / sky). */
export function colorGamma(c: ColorName) {
  return Color3.FromHexString(PALETTE[c]);
}
