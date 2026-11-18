import {
  type Camera,
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  DynamicTexture,
  GlowLayer,
  HemisphericLight,
  type Mesh,
  MeshBuilder,
  ParticleSystem,
  type Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
  VertexBuffer,
} from "@babylonjs/core";
import { lerp } from "../core/math";

/** Everything that sets the mood of a level. Levels get darker by changing these. */
export interface Mood {
  skyTop: string;
  skyHorizon: string;
  fog: string;
  fogDensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sun: string;
  sunIntensity: number;
  sunDir: [number, number, number];
  saturation: number;
  contrast: number;
  exposure: number;
  vignette: number;
  vignetteColor: string;
  bloom: number;
  snow: number;
  glow: number;
}

export const MOODS = {
  cute: {
    skyTop: "#7fb8ff",
    skyHorizon: "#ffd3e8",
    fog: "#f6dcef",
    fogDensity: 0.012,
    hemiSky: "#fff4fb",
    hemiGround: "#9fb4e6",
    hemiIntensity: 0.85,
    sun: "#fff1d6",
    sunIntensity: 1.6,
    sunDir: [-0.5, -1, 0.35],
    saturation: 20,
    contrast: 1.08,
    exposure: 1.05,
    vignette: 0.25,
    vignetteColor: "#ff9fc8",
    bloom: 0.3,
    snow: 0.6,
    glow: 0.45,
  },
  twisted: {
    skyTop: "#1a0610",
    skyHorizon: "#8a0f1f",
    fog: "#4a0f1a",
    fogDensity: 0.024,
    hemiSky: "#ff6a6a",
    hemiGround: "#2a0a18",
    hemiIntensity: 0.55,
    sun: "#ff3b3b",
    sunIntensity: 1.2,
    sunDir: [0.4, -0.7, -0.5],
    saturation: -10,
    contrast: 1.3,
    exposure: 0.95,
    vignette: 1.2,
    vignetteColor: "#3a0008",
    bloom: 0.4,
    snow: 1,
    glow: 0.55,
  },
  sunset: {
    skyTop: "#3d2a6b",
    skyHorizon: "#ff9a5c",
    fog: "#c97a74",
    fogDensity: 0.016,
    hemiSky: "#ffd2a8",
    hemiGround: "#4b3a6b",
    hemiIntensity: 0.7,
    sun: "#ff9a50",
    sunIntensity: 1.4,
    sunDir: [0.8, -0.45, -0.3],
    saturation: 5,
    contrast: 1.18,
    exposure: 1,
    vignette: 0.7,
    vignetteColor: "#2a0a1a",
    bloom: 0.45,
    snow: 0.7,
    glow: 0.7,
  },
  twilight: {
    skyTop: "#27286a",
    skyHorizon: "#ff9f8f",
    fog: "#a68cb3",
    fogDensity: 0.011,
    hemiSky: "#ffdbe8",
    hemiGround: "#47477a",
    hemiIntensity: 0.62,
    sun: "#ffb48a",
    sunIntensity: 1.05,
    sunDir: [0.6, -0.38, -0.7],
    saturation: 6,
    contrast: 1.15,
    exposure: 1,
    vignette: 0.8,
    vignetteColor: "#2a0a2a",
    bloom: 0.45,
    snow: 0.5,
    glow: 0.65,
  },
  forest: {
    skyTop: "#050817",
    skyHorizon: "#26305a",
    fog: "#1a2142",
    fogDensity: 0.06,
    hemiSky: "#7f96e6",
    hemiGround: "#14122a",
    hemiIntensity: 0.36,
    sun: "#a9c2ff",
    sunIntensity: 0.5,
    sunDir: [0.35, -0.8, 0.45],
    saturation: -12,
    contrast: 1.25,
    exposure: 0.88,
    vignette: 1.1,
    vignetteColor: "#050816",
    bloom: 0.45,
    snow: 0.85,
    glow: 0.85,
  },
  /** Sugar shack at night: moonlit snow, warm firelight glow on the horizon. */
  sugarshack: {
    skyTop: "#0b0a24",
    skyHorizon: "#6b3348",
    fog: "#2d2340",
    fogDensity: 0.03,
    hemiSky: "#9aa6e8",
    hemiGround: "#2a1626",
    hemiIntensity: 0.42,
    sun: "#b9c6ff",
    sunIntensity: 0.55,
    sunDir: [-0.4, -0.75, 0.5],
    saturation: 0,
    contrast: 1.22,
    exposure: 0.92,
    vignette: 1.05,
    vignetteColor: "#1a0610",
    bloom: 0.55,
    snow: 0.45,
    glow: 0.9,
  },
  /** The frozen lake: a clear, cold, starry night. */
  rink: {
    skyTop: "#060a26",
    skyHorizon: "#33508f",
    fog: "#2a3b6b",
    fogDensity: 0.018,
    hemiSky: "#b9d4ff",
    hemiGround: "#1d2448",
    hemiIntensity: 0.55,
    sun: "#cfe0ff",
    sunIntensity: 0.75,
    sunDir: [0.3, -0.7, 0.6],
    saturation: 4,
    contrast: 1.18,
    exposure: 0.95,
    vignette: 0.95,
    vignetteColor: "#060a20",
    bloom: 0.5,
    snow: 0.25,
    glow: 0.85,
  },
  /** Village rooftops at night: cold moonlight above, the cursed slush glowing below. */
  rooftops: {
    skyTop: "#0b0a24",
    skyHorizon: "#7a2346",
    fog: "#3a2240",
    fogDensity: 0.013,
    hemiSky: "#cbbcff",
    hemiGround: "#2a1a3a",
    hemiIntensity: 0.62,
    sun: "#c9bcff",
    sunIntensity: 0.9,
    sunDir: [0.4, -0.8, 0.5],
    saturation: 8,
    contrast: 1.15,
    exposure: 1,
    vignette: 0.85,
    vignetteColor: "#1a0414",
    bloom: 0.55,
    snow: 0.4,
    glow: 0.85,
  },
  /** The toy factory: roofless halls at night, furnace glow and hanging lamps. */
  factory: {
    skyTop: "#07060f",
    skyHorizon: "#5a2a1a",
    fog: "#2a1810",
    fogDensity: 0.012,
    hemiSky: "#ffd2a8",
    hemiGround: "#2a1612",
    hemiIntensity: 0.55,
    sun: "#ffb27a",
    sunIntensity: 0.75,
    sunDir: [0.3, -0.85, 0.4],
    saturation: 6,
    contrast: 1.18,
    exposure: 1,
    vignette: 0.9,
    vignetteColor: "#1a0806",
    bloom: 0.6,
    snow: 0.1,
    glow: 0.9,
  },
  /** Blood moon over the reindeer stables: red fog, burned barns. */
  bloodMoon: {
    skyTop: "#12030a",
    skyHorizon: "#7a0f1c",
    fog: "#3a0a12",
    fogDensity: 0.016,
    hemiSky: "#ffb0a0",
    hemiGround: "#200810",
    hemiIntensity: 0.52,
    sun: "#ff6a5a",
    sunIntensity: 0.85,
    sunDir: [-0.4, -0.75, 0.5],
    saturation: 10,
    contrast: 1.2,
    exposure: 1,
    vignette: 0.95,
    vignetteColor: "#200006",
    bloom: 0.6,
    snow: 0.5,
    glow: 0.9,
  },
  /** A blizzard on the gift mountain: driving snow, violet storm light. */
  blizzard: {
    skyTop: "#0a0d1e",
    skyHorizon: "#4a2a6a",
    fog: "#2c2644",
    fogDensity: 0.017,
    hemiSky: "#d8ccff",
    hemiGround: "#1c1830",
    hemiIntensity: 0.6,
    sun: "#b9a8ff",
    sunIntensity: 0.9,
    sunDir: [0.5, -0.7, 0.45],
    saturation: 4,
    contrast: 1.18,
    exposure: 1,
    vignette: 0.9,
    vignetteColor: "#0c0618",
    bloom: 0.55,
    snow: 1,
    glow: 0.85,
  },
  /** After the boss: northern lights, green glow, calm. */
  aurora: {
    skyTop: "#04161f",
    skyHorizon: "#2fa88a",
    fog: "#1d4a52",
    fogDensity: 0.012,
    hemiSky: "#c8ffe9",
    hemiGround: "#16303a",
    hemiIntensity: 0.62,
    sun: "#b8ffe0",
    sunIntensity: 0.7,
    sunDir: [0.3, -0.7, 0.6],
    saturation: 10,
    contrast: 1.1,
    exposure: 1,
    vignette: 0.7,
    vignetteColor: "#04161a",
    bloom: 0.6,
    snow: 0.15,
    glow: 0.9,
  },
} satisfies Record<string, Mood>;

const c3 = (hex: string) => Color3.FromHexString(hex);

export class Environment {
  readonly hemi: HemisphericLight;
  readonly sun: DirectionalLight;
  readonly shadows: ShadowGenerator;
  readonly glow: GlowLayer;
  readonly pipeline: DefaultRenderingPipeline;
  private readonly sky: Mesh;
  private readonly snow: ParticleSystem;
  private current: Mood = { ...MOODS.cute };
  private from: Mood = { ...MOODS.cute };
  private to: Mood = { ...MOODS.cute };
  private blend = 1;
  private blendDuration = 1;
  /** Flicker multiplier for lights (twist cutscene). */
  flicker = 1;
  /** Multiplies the fog density (lanterns clear the fog around them). */
  fogScale = 1;
  private moon: Mesh | null = null;

  constructor(
    private readonly scene: Scene,
    camera: Camera,
    private readonly low = false,
  ) {
    scene.clearColor = new Color4(0.5, 0.6, 0.8, 1);
    scene.ambientColor = new Color3(0.2, 0.2, 0.25);
    scene.fogMode = 2; // FOGMODE_EXP

    this.hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    this.sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.35), scene);
    this.sun.position = new Vector3(20, 40, -20);
    this.sun.shadowMinZ = 1;
    this.sun.shadowMaxZ = 120;
    // Shadows only in a fixed box around Santa (it follows him): sharper, and the
    // shadow pass doesn't have to cover a whole 200 m ski slope.
    this.sun.autoUpdateExtends = false;
    this.sun.shadowFrustumSize = 64;
    this.shadows = new ShadowGenerator(low ? 512 : 2048, this.sun);
    this.shadows.usePercentageCloserFiltering = true;
    this.shadows.bias = 0.0008;
    this.shadows.normalBias = 0.02;
    this.shadows.darkness = 0.35;

    this.glow = new GlowLayer("glow", scene, {
      mainTextureSamples: low ? 1 : 2,
      blurKernelSize: low ? 16 : 48,
      mainTextureRatio: low ? 0.25 : 0.5,
    });
    this.glow.intensity = 0.6;

    this.sky = MeshBuilder.CreateSphere(
      "sky",
      { diameter: 400, segments: 8, sideOrientation: 1 },
      scene,
    );
    const skyMat = new StandardMaterial("skyMat", scene);
    skyMat.disableLighting = true;
    // Unlit: output = emissive × vertex color.
    skyMat.emissiveColor = Color3.White();
    skyMat.diffuseColor = Color3.Black();
    skyMat.specularColor = Color3.Black();
    skyMat.fogEnabled = false;
    skyMat.backFaceCulling = false;
    this.sky.material = skyMat;
    this.sky.infiniteDistance = true;
    this.sky.isPickable = false;
    this.glow.addExcludedMesh(this.sky);

    // No HDR: tone mapping is off and bloom only picks up near-white, so half-float
    // targets would just cost memory bandwidth.
    this.pipeline = new DefaultRenderingPipeline("pipeline", false, scene, [camera]);
    this.pipeline.fxaaEnabled = !low;
    this.pipeline.bloomEnabled = !low;
    this.pipeline.bloomThreshold = 0.85;
    this.pipeline.bloomKernel = 48;
    this.pipeline.imageProcessingEnabled = true;
    const ip = this.pipeline.imageProcessing;
    ip.vignetteEnabled = true;
    ip.colorCurvesEnabled = true;
    ip.toneMappingEnabled = false;

    this.snow = this.createSnow();
    this.apply(this.current);
  }

  addCamera(camera: Camera) {
    this.pipeline.addCamera(camera);
  }

  /** Smoothly switch to a new mood over `duration` seconds (0 = instant). */
  setMood(mood: Mood, duration = 0) {
    this.from = { ...this.current };
    this.to = { ...mood };
    this.blendDuration = Math.max(duration, 0.0001);
    this.blend = duration <= 0 ? 1 : 0;
    if (duration <= 0) {
      this.current = { ...mood };
      this.apply(this.current);
    }
  }

  castShadows(...meshes: Mesh[]) {
    if (this.low) return;
    for (const m of meshes) {
      this.shadows.addShadowCaster(m, true);
    }
  }

  update(dt: number, focus: Vector3) {
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / this.blendDuration);
      this.current = mixMood(this.from, this.to, this.blend);
      this.apply(this.current);
    } else if (this.flicker !== 1) {
      this.apply(this.current);
    }
    this.scene.fogDensity = this.current.fogDensity * this.fogScale;
    if (this.moon?.isEnabled()) {
      const cam = this.scene.activeCamera;
      if (cam)
        this.moon.position.copyFrom(cam.position.add(new Vector3(-0.35, 0.42, 0.84).scale(170)));
    }
    // Keep the shadow camera and snow around the player.
    this.sun.position.set(
      focus.x - this.sun.direction.x * 50,
      focus.y - this.sun.direction.y * 50,
      focus.z - this.sun.direction.z * 50,
    );
    const emitter = this.snow.emitter as Vector3;
    emitter.set(focus.x, focus.y + 14, focus.z);
  }

  /** A big glowing moon (night levels). */
  setMoon(on: boolean, hex = "#eef3ff") {
    if (!this.moon) {
      this.moon = MeshBuilder.CreateSphere("moon", { diameter: 14, segments: 8 }, this.scene);
      const mat = new StandardMaterial("moonMat", this.scene);
      mat.disableLighting = true;
      mat.fogEnabled = false;
      mat.diffuseColor = Color3.Black();
      this.moon.material = mat;
      this.moon.isPickable = false;
    }
    (this.moon.material as StandardMaterial).emissiveColor = Color3.FromHexString(hex);
    this.moon.setEnabled(on);
  }

  private apply(m: Mood) {
    const s = this.scene;
    s.fogColor = c3(m.fog);
    s.fogDensity = m.fogDensity;
    s.clearColor = Color4.FromColor3(c3(m.fog), 1);
    this.hemi.diffuse = c3(m.hemiSky);
    this.hemi.groundColor = c3(m.hemiGround);
    this.hemi.intensity = m.hemiIntensity * this.flicker;
    this.sun.diffuse = c3(m.sun);
    this.sun.intensity = m.sunIntensity * this.flicker;
    this.sun.direction = new Vector3(...m.sunDir).normalize();
    this.paintSky(c3(m.skyTop), c3(m.skyHorizon), c3(m.fog));
    const ip = this.pipeline.imageProcessing;
    ip.contrast = m.contrast;
    ip.exposure = m.exposure;
    ip.vignetteWeight = m.vignette;
    ip.vignetteColor = Color4.FromColor3(c3(m.vignetteColor), 1);
    if (ip.colorCurves) ip.colorCurves.globalSaturation = m.saturation;
    this.pipeline.bloomWeight = m.bloom;
    this.glow.intensity = m.glow;
    this.snow.emitRate = 400 * m.snow;
  }

  private paintSky(top: Color3, horizon: Color3, bottom: Color3) {
    const pos = this.sky.getVerticesData(VertexBuffer.PositionKind);
    if (!pos) return;
    const colors = new Float32Array((pos.length / 3) * 4);
    for (let i = 0; i < pos.length / 3; i++) {
      const y = (pos[i * 3 + 1] ?? 0) / 200;
      const c =
        y > 0
          ? Color3.Lerp(horizon, top, Math.min(1, y * 1.6))
          : Color3.Lerp(horizon, bottom, Math.min(1, -y * 4));
      colors.set([c.r, c.g, c.b, 1], i * 4);
    }
    this.sky.setVerticesData(VertexBuffer.ColorKind, colors);
  }

  private createSnow() {
    const tex = new DynamicTexture("snowflake", { width: 32, height: 32 }, this.scene, false);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.5, "rgba(255,255,255,0.8)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    tex.update();
    tex.hasAlpha = true;

    const ps = new ParticleSystem("snow", 3000, this.scene);
    ps.particleTexture = tex;
    ps.emitter = new Vector3(0, 14, 0);
    ps.minEmitBox = new Vector3(-30, 0, -30);
    ps.maxEmitBox = new Vector3(30, 4, 30);
    ps.color1 = new Color4(1, 1, 1, 0.9);
    ps.color2 = new Color4(0.9, 0.95, 1, 0.7);
    ps.colorDead = new Color4(1, 1, 1, 0);
    ps.minSize = 0.05;
    ps.maxSize = 0.14;
    ps.minLifeTime = 6;
    ps.maxLifeTime = 9;
    ps.emitRate = 300;
    ps.gravity = new Vector3(0, -0.6, 0);
    ps.direction1 = new Vector3(-0.4, -1, -0.2);
    ps.direction2 = new Vector3(0.4, -1, 0.3);
    ps.minEmitPower = 0.4;
    ps.maxEmitPower = 1;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.preWarmCycles = 60;
    ps.start();
    return ps;
  }
}

function mixMood(a: Mood, b: Mood, t: number): Mood {
  const mixHex = (x: string, y: string) => Color3.Lerp(c3(x), c3(y), t).toHexString();
  return {
    skyTop: mixHex(a.skyTop, b.skyTop),
    skyHorizon: mixHex(a.skyHorizon, b.skyHorizon),
    fog: mixHex(a.fog, b.fog),
    fogDensity: lerp(a.fogDensity, b.fogDensity, t),
    hemiSky: mixHex(a.hemiSky, b.hemiSky),
    hemiGround: mixHex(a.hemiGround, b.hemiGround),
    hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, t),
    sun: mixHex(a.sun, b.sun),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    sunDir: [
      lerp(a.sunDir[0], b.sunDir[0], t),
      lerp(a.sunDir[1], b.sunDir[1], t),
      lerp(a.sunDir[2], b.sunDir[2], t),
    ],
    saturation: lerp(a.saturation, b.saturation, t),
    contrast: lerp(a.contrast, b.contrast, t),
    exposure: lerp(a.exposure, b.exposure, t),
    vignette: lerp(a.vignette, b.vignette, t),
    vignetteColor: mixHex(a.vignetteColor, b.vignetteColor),
    bloom: lerp(a.bloom, b.bloom, t),
    snow: lerp(a.snow, b.snow, t),
    glow: lerp(a.glow, b.glow, t),
  };
}
