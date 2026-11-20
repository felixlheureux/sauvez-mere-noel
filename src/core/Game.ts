import {
  Color3,
  Engine,
  EngineInstrumentation,
  Matrix,
  type Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { Materials } from "../assets/Materials";
import { type ColorName, color } from "../assets/Palette";
import { PropFactory } from "../assets/props";
import { sound } from "../audio/Sound";
import type { Elf } from "../enemies/Elf";
import { EnemyManager } from "../enemies/EnemyManager";
import { Projectiles } from "../enemies/Projectiles";
import { Effects } from "../fx/Effects";
import { GORE_LEVELS, Gore } from "../fx/Gore";
import { BUFF_TEXT, LEVELS_META, LINES, type Line, T } from "../i18n/fr-QC";
import { createLevel, IMPLEMENTED_LEVELS } from "../levels";
import { CameraRig } from "../player/CameraRig";
import { GUN_ORDER, type GunId, Player } from "../player/Player";
import { hud, useStore } from "../ui/store";
import { Environment, MOODS } from "../world/Environment";
import type { Level } from "../world/Level";
import { PhysicsWorld } from "../world/Physics";
import { Input } from "./Input";
import { clamp, pick } from "./math";

/**
 * Guns you own when a level starts. Level 0 gives the candy cane; from Level 1 on,
 * Gérard leaves a new, bigger gun at the start of each level (cap gun, shotgun, …).
 */
/** A point on screen (CSS pixels), its distance, and whether it's in front of the camera. */
export interface ScreenPoint {
  x: number;
  y: number;
  dist: number;
  ahead: boolean;
}

export function gunsAtStart(levelId: number): GunId[] {
  return GUN_ORDER.filter((_, i) => i < levelId - 1);
}

/** `?low` in the URL: half resolution, no shadows or post effects (old laptops, tests). */
export const LOW_QUALITY = new URLSearchParams(window.location.search).has("low");

type Waiter = { until: number; resolve: () => void; gen: number };
type Tween = {
  t: number;
  duration: number;
  fn: (k: number) => void;
  resolve: () => void;
  gen: number;
};

/**
 * Owns the Babylon engine/scene and every system. Runs the frame loop,
 * loads levels and provides the small scripting API levels use
 * (`say`, `wait`, `objective`, …).
 */
export class Game {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly input: Input;
  readonly physics = new PhysicsWorld();
  readonly mats: Materials;
  readonly props: PropFactory;
  readonly camRig: CameraRig;
  readonly env: Environment;
  readonly gore: Gore;
  readonly fx: Effects;
  readonly enemies: EnemyManager;
  readonly projectiles: Projectiles;
  readonly player: Player;
  levelRoot: TransformNode;
  level!: Level;
  /** Game time in seconds (scaled, stops when paused). */
  time = 0;
  private hitstopTimer = 0;
  private paused = false;
  private inTitle = true;
  private waiters: Waiter[] = [];
  private tweens: Tween[] = [];
  private generation = 0;
  private dialogueResolve: (() => void) | null = null;
  private tipTimer = 0;
  private tipQueue: Line[] = [];
  private readonly protos = new Map<string, Mesh>();
  private comboCount = 0;
  private comboTimer = 0;
  private barkCooldown = 0;
  private wasLocked = false;
  private lockLostAt = 0;
  /** Menu closed but the game stays frozen until the mouse is grabbed again. */
  private waitingLock = false;
  private lockGainedAt = 0;
  private ending = false;

  private constructor(readonly canvas: HTMLCanvasElement) {
    this.engine = new Engine(
      canvas,
      true,
      { stencil: true, preserveDrawingBuffer: false, antialias: true },
      true,
    );
    // One rendered pixel per CSS pixel, even on Retina: rendering at 1.5× cost ~10 ms a
    // frame on an M2 (measured by tests/e2e/gpuprof.py) for little visible gain on low-poly art.
    this.renderScale = LOW_QUALITY ? 2 : 1;
    this.engine.setHardwareScalingLevel(this.renderScale);
    this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking = true;
    this.input = new Input(canvas);
    this.mats = new Materials(this.scene);
    this.props = new PropFactory(this.scene, this.mats);
    this.camRig = new CameraRig(this.scene);
    this.env = new Environment(this.scene, this.camRig.camera, LOW_QUALITY);
    this.gore = new Gore(this.scene, this.mats, this.physics);
    this.fx = new Effects(this.scene, this.mats);
    // A fixed pool of point lights, created once and never switched off (only dimmed):
    // changing the number of active lights recompiles every shader and freezes the game.
    for (let i = 0; i < 4; i++) {
      const l = new PointLight(`pool${i}`, new Vector3(0, -500, 0), this.scene);
      l.diffuse = new Color3(1, 0.8, 0.5);
      l.intensity = 0;
      l.range = 1;
      this.lightPool.push(l);
    }
    this.gpuTimer = new EngineInstrumentation(this.engine);
    this.enemies = new EnemyManager(this);
    this.projectiles = new Projectiles(this);
    this.levelRoot = new TransformNode("level", this.scene);
    this.player = new Player(this);
    this.enemies.onKill = (e) => this.onKill(e);
    window.addEventListener("resize", () => this.engine.resize());
    document.addEventListener("pointerlockchange", () => this.onPointerLockChange());
  }

  /** Build everything in small steps so the loading screen can animate. */
  static async create(canvas: HTMLCanvasElement, progress: (p: number, label: string) => void) {
    const steps = T.loadingSteps;
    const tick = async (i: number) => {
      progress(i / (steps.length - 1), steps[i] as string);
      await new Promise((r) => setTimeout(r, 180));
    };
    await tick(0);
    const game = new Game(canvas);
    await tick(1);
    game.applySettings();
    await tick(2);
    game.loadTitle(false);
    await game.warmupShaders();
    await tick(3);
    game.engine.runRenderLoop(() => game.frame());
    await tick(4);
    return game;
  }

  // ---------- Settings / helpers ----------

  applySettings() {
    const s = useStore.getState().settings;
    this.gore.confetti = s.confetti;
    this.input.sensitivity = s.sensitivity;
    this.input.invertY = s.invertY;
    sound.setVolume(s.volume);
    sound.setMusicVolume(s.musicVolume);
    // Turned back on: straight in, not after the rest between carols.
    if (s.music !== sound.musicOn) {
      sound.musicOn = s.music;
      if (s.music) sound.startMusic();
      else sound.stopMusic();
    }
    // GPU timer queries only while the debug overlay is up.
    this.gpuTimer.captureGPUFrameTime = s.debug;
  }

  colorOf(c: ColorName) {
    return color(c);
  }

  /** Clone a cached prop (merging is done once per prop type). */
  protoClone(key: string, make: () => Mesh): Mesh {
    let proto = this.protos.get(key);
    if (!proto) {
      proto = make();
      proto.setEnabled(false);
      this.protos.set(key, proto);
    }
    const m = proto.clone(`${key}_c`, null) as Mesh;
    m.setEnabled(true);
    return m;
  }

  hitstop(t: number) {
    this.hitstopTimer = Math.max(this.hitstopTimer, t);
  }

  // ---------- Level flow ----------

  private disposeLevel() {
    this.generation++;
    this.waiters = [];
    this.tweens = [];
    this.dialogueResolve = null;
    this.tipQueue = [];
    this.enemies.clear();
    this.projectiles.clear();
    this.gore.reset();
    this.physics.clear();
    this.physics.boundsCenter.set(0, 0, 0);
    this.levelRoot.dispose(false, false);
    this.levelRoot = new TransformNode("level", this.scene);
    hud.set({ dialogue: null, letterbox: false, objective: "", titleCard: null });
    this.objectiveTarget = null;
  }

  /**
   * Compile the shaders that combat needs (hit flash, gore instances) while the
   * loading screen is up; otherwise the first hit or kill freezes the game for ~60 ms.
   */
  private async warmupShaders() {
    const at = this.camRig.camera.getTarget();
    const flash = MeshBuilder.CreateBox("warmFlash", { size: 0.1 }, this.scene);
    flash.material = this.mats.toon;
    flash.position.copyFrom(at);
    flash.renderOverlay = true;
    const temps = [flash, ...this.gore.warmupMeshes(at)];
    await this.scene.whenReadyAsync();
    this.scene.render();
    for (const m of temps) m.dispose();
  }

  /** Title screen backdrop: the cute village, orbiting camera. */
  loadTitle(showScreen = true) {
    this.disposeLevel();
    this.inTitle = true;
    this.paused = false;
    this.waitingLock = false;
    // Menus need a free mouse cursor.
    this.input.exitPointerLock();
    this.level = createLevel(0, this);
    this.level.build();
    this.level.built = true;
    this.env.setMood(MOODS.cute);
    this.player.rig.setEnabled(false);
    this.camRig.startOrbit(new Vector3(0, 2, 0), 26, 9, 0.05);
    sound.setDarkness(0);
    sound.stopMusic(true);
    sound.setTheme("jingle");
    this.titleMusic();
    hud.set({ crosshair: false });
    if (showScreen) hud.set({ screen: "title" });
  }

  /**
   * The carol on the title screen. Browsers keep audio off until the first click or key
   * press, so on a fresh page it starts with that.
   */
  private titleMusic() {
    const start = () => {
      if (!this.inTitle || !useStore.getState().settings.music) return;
      sound.unlock();
      sound.startMusic();
    };
    if (sound.ready) start();
    else {
      const first = () => {
        window.removeEventListener("pointerdown", first);
        window.removeEventListener("keydown", first);
        start();
      };
      window.addEventListener("pointerdown", first);
      window.addEventListener("keydown", first);
    }
  }

  /** Save where "Continuer" should pick up. */
  saveResume(levelId: number, checkpoint: number) {
    useStore.getState().setResume(levelId, checkpoint);
  }

  async loadLevel(id: number, checkpoint = 0) {
    if (!IMPLEMENTED_LEVELS.includes(id)) {
      hud.set({ screen: "comingSoon" });
      return;
    }
    sound.unlock();
    await this.fade(1);
    this.disposeLevel();
    this.inTitle = false;
    this.paused = false;
    this.waitingLock = false;
    this.ending = false;
    const level = createLevel(id, this);
    this.level = level;
    this.physics.boundsRadius = level.arenaRadius;
    level.build();
    level.built = true;
    const cp = checkpoint > 0 && level.checkpoints[checkpoint] ? checkpoint : 0;
    level.startCheckpoint = cp;
    level.checkpoint = cp;
    this.env.fogScale = 1;
    this.env.setMoon(false);
    this.saveResume(id, cp);
    this.gore.settings =
      GORE_LEVELS[clamp(Math.floor(level.darkness / 4), 0, GORE_LEVELS.length - 1)] ??
      this.gore.settings;
    this.env.setMood(level.mood);
    const start =
      cp > 0
        ? (level.checkpoints[cp] as { pos: Vector3; yaw: number })
        : { pos: level.spawnPos, yaw: level.spawnYaw };
    this.player.reset(start.pos, start.yaw);
    this.player.frozen = false;
    const guns = gunsAtStart(id);
    if (cp > 0 && level.newGun && !guns.includes(level.newGun)) guns.push(level.newGun);
    this.player.setArsenal(guns);
    this.player.hasCane = id >= 1;
    this.camRig.release();
    this.camRig.yaw = start.yaw;
    this.camRig.pitch = 0.2;
    this.time = 0;
    level.startTime = 0;
    this.quietTime = 0;
    this.comboCount = 0;
    sound.setDarkness(Math.min(1, level.darkness / 10 + (id > 0 ? 0.25 : 0)));
    sound.stopMusic();
    sound.setTheme(level.theme);
    if (useStore.getState().settings.music) sound.startMusic();
    hud.set({
      screen: "playing",
      levelId: id,
      levelName: level.name,
      hp: this.player.hp,
      bells: 0,
      bellsTotal: level.bellsTotal,
      candies: 0,
      candiesTotal: level.candiesTotal,
      controlsTier: id >= 1 ? 1 : 0,
      controlsNew: id === 1,
      showControls: true,
      stats: null,
      boss: null,
      enemiesLeft: 0,
      riding: false,
      titleCard: { num: id, name: level.name },
    });
    this.input.requestPointerLock();
    await this.fade(0);
    window.setTimeout(() => hud.set({ titleCard: null }), 3200);
    const gen = this.generation;
    level.run().catch((err) => {
      if (gen === this.generation) console.error(err);
    });
  }

  /** Try again from the last checkpoint reached. */
  async retryFromCheckpoint() {
    await this.loadLevel(this.level.id, this.level.checkpoint);
  }

  /** Start the level over from the very beginning. */
  async restartLevel() {
    await this.loadLevel(this.level.id, 0);
  }

  quitToTitle() {
    sound.stopMusic();
    this.input.exitPointerLock();
    this.loadTitle();
  }

  pause() {
    if (this.inTitle || this.paused || useStore.getState().screen !== "playing") return;
    this.paused = true;
    hud.set({ screen: "paused" });
    this.input.lockOnKey = false;
    this.input.exitPointerLock();
  }

  /**
   * Close the menu. The game stays frozen until the mouse is locked again: `grabMouse`
   * locks it now (a click: the Resume button). Esc can't, as it isn't a user gesture,
   * so the next key the player presses (or a click) does.
   */
  resume(grabMouse = true) {
    if (!this.paused || this.waitingLock) return;
    hud.set({ screen: "playing" });
    if (this.input.pointerLocked) {
      this.paused = false;
      return;
    }
    this.waitingLock = true;
    this.input.lockOnKey = true;
    if (grabMouse) this.input.requestPointerLock();
  }

  /** Level finished: freeze, show the score card, save progress. */
  async completeLevel() {
    if (this.ending) return;
    this.ending = true;
    const level = this.level;
    this.player.frozen = true;
    const time = this.time - level.startTime;
    const kills = this.enemies.kills;
    // ★ finish · ★ every bell · ★ at least 75% of the candies.
    const candyRatio = level.candiesTotal ? level.candiesFound / level.candiesTotal : 1;
    const stars = 1 + (level.bellsFound >= level.bellsTotal ? 1 : 0) + (candyRatio >= 0.75 ? 1 : 0);
    useStore.getState().completeLevel(level.id, {
      stars,
      bells: level.bellsFound,
      candies: level.candiesFound,
      bestTime: time,
    });
    await this.wait(0.6);
    this.input.exitPointerLock();
    hud.set({
      screen: "levelComplete",
      stats: {
        levelId: level.id,
        kills,
        time,
        bells: level.bellsFound,
        bellsTotal: level.bellsTotal,
        candies: level.candiesFound,
        candiesTotal: level.candiesTotal,
        stars,
      },
      crosshair: false,
    });
  }

  nextLevel() {
    const next = this.level.id + 1;
    // After the last level: the ending.
    if (!LEVELS_META[next]) {
      hud.set({ screen: "ending" });
      return;
    }
    if (useStore.getState().progress.mapUnlocked && next >= 1) {
      hud.set({ screen: "map" });
      return;
    }
    void this.loadLevel(next);
  }

  onPlayerDeath() {
    window.setTimeout(() => {
      if (!this.player.dead) return;
      this.input.exitPointerLock();
      hud.set({ screen: "gameOver", crosshair: false });
    }, 1400);
  }

  // ---------- Script API (used by levels) ----------

  /** Wait `s` seconds of game time. Never resolves if the level is unloaded. */
  wait(s: number) {
    const gen = this.generation;
    return new Promise<void>((resolve) =>
      this.waiters.push({ until: this.time + s, resolve, gen }),
    );
  }

  /**
   * Run `fn` after `s` seconds of game time — never after the level was left or
   * restarted (unlike window.setTimeout, which would fire into the next level).
   */
  after(s: number, fn: () => void) {
    void this.wait(s).then(fn);
  }

  /** Animate something over `duration` seconds; `fn` receives 0→1. */
  tween(duration: number, fn: (k: number) => void) {
    const gen = this.generation;
    return new Promise<void>((resolve) =>
      this.tweens.push({ t: 0, duration: Math.max(duration, 0.0001), fn, resolve, gen }),
    );
  }

  /** Blocking dialogue: one line at a time, player presses Space/click to continue. */
  async say(lines: readonly Line[]) {
    const gen = this.generation;
    this.tipQueue = [];
    this.tipTimer = 0;
    for (const line of lines) {
      if (gen !== this.generation) return new Promise<void>(() => {});
      hud.set({
        dialogue: line,
        dialogueId: hud.get().dialogueId + 1,
        dialogueTyped: false,
        dialogueBlocking: true,
      });
      await new Promise<void>((resolve) => {
        this.dialogueResolve = resolve;
      });
    }
    hud.set({ dialogue: null });
  }

  /** Non-blocking dialogue that plays while you keep moving. */
  tip(lines: readonly Line[]) {
    this.tipQueue.push(...lines);
    if (!hud.get().dialogue) this.nextTip();
  }

  private nextTip() {
    const line = this.tipQueue.shift();
    if (!line) {
      hud.set({ dialogue: null });
      return;
    }
    hud.set({
      dialogue: line,
      dialogueId: hud.get().dialogueId + 1,
      dialogueTyped: false,
      dialogueBlocking: false,
      tipDuration: 1.6 + line.text.length * 0.045,
    });
    this.tipTimer = 1.6 + line.text.length * 0.045;
  }

  /** UI calls this when the dialogue box is clicked. */
  advanceDialogue() {
    if (!this.dialogueResolve) return;
    if (!hud.get().dialogueTyped) {
      hud.set({ dialogueSkip: hud.get().dialogueSkip + 1 });
      return;
    }
    const r = this.dialogueResolve;
    this.dialogueResolve = null;
    sound.ui();
    r();
  }

  bark(text: string) {
    useStore.getState().pushToast({ title: text, kind: "bark" });
  }

  private objectiveTarget: Vector3 | (() => Vector3 | null) | null = null;

  /**
   * Set the objective text. With a `target`, the HUD also shows a waypoint
   * (diamond + distance) on that spot, or an arrow at the screen edge.
   */
  objective(text: string, target: Vector3 | (() => Vector3 | null) | null = null) {
    hud.set({ objective: text });
    this.objectiveTarget = target;
  }

  /** Where the objective waypoint goes on screen (CSS pixels), or null. */
  objectiveScreen(): ScreenPoint | null {
    const t = this.objectiveTarget;
    if (!t || this.inTitle || this.paused || this.player.frozen) return null;
    const p = typeof t === "function" ? t() : t;
    if (!p) return null;
    const dist = Vector3.Distance(p, this.player.body.position);
    if (dist < 2.5) return null;
    return this.toScreen(p, dist);
  }

  /** After this long with only 1–3 enemies left and none killed, they get markers. */
  static readonly STRAGGLER_DELAY = 20;
  private quietTime = 0;

  /** Where the last few enemies are on screen, once they've been hard to find for a while. */
  stragglerScreens(): ScreenPoint[] {
    if (this.quietTime < Game.STRAGGLER_DELAY || this.inTitle || this.paused) return [];
    const ppos = this.player.body.position;
    return this.stragglers().map((e) =>
      this.toScreen(e.center.add(new Vector3(0, 1.2, 0)), Vector3.Distance(e.center, ppos)),
    );
  }

  private stragglers() {
    return this.enemies.elves.filter((e) => e.alive && !e.dormant && !e.tuning.boss);
  }

  /** A world point in CSS pixels, and whether it's in front of the camera. */
  private toScreen(p: Vector3, dist: number): ScreenPoint {
    const cam = this.camRig.camera;
    const w = this.engine.getRenderWidth();
    const h = this.engine.getRenderHeight();
    const sp = Vector3.Project(
      p,
      Matrix.Identity(),
      this.scene.getTransformMatrix(),
      cam.viewport.toGlobal(w, h),
    );
    const ahead = Vector3.Dot(p.subtract(cam.position), cam.getDirection(Vector3.Forward())) > 0;
    const canvas = this.engine.getRenderingCanvas() as HTMLCanvasElement;
    const kx = canvas.clientWidth / w;
    const ky = canvas.clientHeight / h;
    return { x: sp.x * kx, y: sp.y * ky, dist, ahead };
  }

  toast(title: string, body?: string) {
    useStore.getState().pushToast({ title, body, kind: "weapon" });
  }

  /** Cutscene mode: player frozen, letterbox bars. */
  cinematic(on: boolean) {
    this.player.frozen = on;
    hud.set({ letterbox: on, crosshair: on ? false : this.player.weapon !== "fists" });
    if (!on) this.camRig.release();
  }

  async fade(to: 0 | 1, duration = 0.45) {
    hud.set({ fade: to });
    await new Promise((r) => setTimeout(r, duration * 1000));
  }

  updateBells() {
    hud.set({ bells: this.level.bellsFound });
  }

  updateCandies() {
    hud.set({ candies: this.level.candiesFound, candiesTotal: this.level.candiesTotal });
  }

  onBuff(kind: "rage" | "speed" | "shield") {
    sound.powerUp();
    const t = BUFF_TEXT[kind];
    this.toast(t.title, t.body);
    if (kind === "rage") this.camRig.shake(0.2);
  }

  spawnHealPickup(pos: Vector3) {
    this.level.health(pos.x, pos.z, false, this.physics.groundHeightAt(pos.x, pos.z, pos.y + 1));
  }

  /** Elves sometimes drop goodies, so fighting in the open pays off. */
  dropLoot(pos: Vector3) {
    const r = Math.random();
    if (r < 0.14) this.spawnHealPickup(pos);
    else if (r < 0.18) this.level.buff(Math.random() < 0.5 ? "speed" : "rage", pos.x, pos.z);
  }

  /** Enemies dying this close spray blood on the screen (bigger the closer). */
  static readonly SPLAT_RANGE = 4.5;

  private onKill(e: Elf) {
    this.quietTime = 0;
    this.comboCount = this.comboTimer > 0 ? this.comboCount + 1 : 1;
    this.comboTimer = 1.6;
    const now = performance.now();
    hud.set({ combo: this.comboCount, comboAt: now, killAt: now });
    const d = Vector3.Distance(e.center, this.player.body.position);
    if (d < Game.SPLAT_RANGE && !this.gore.confetti) {
      hud.set({ bloodSplat: now, splatSize: 1 - d / Game.SPLAT_RANGE });
    }
    this.barkCooldown -= 1;
    if (this.comboCount >= 3 && this.comboCount % 3 === 0) {
      this.bark(pick(Math.random, LINES.barksCombo));
    } else if (this.barkCooldown <= 0 && Math.random() < 0.3) {
      this.barkCooldown = 3;
      this.bark(pick(Math.random, LINES.barksKill));
    }
  }

  private onPointerLockChange() {
    const locked = this.input.pointerLocked;
    hud.set({ pointerLocked: locked });
    const now = performance.now();
    if (locked && !this.wasLocked) this.lockGainedAt = now;
    if (locked && this.waitingLock) {
      this.waitingLock = false;
      this.paused = false;
    }
    if (this.wasLocked && !locked) {
      this.lockLostAt = now;
      // A lock lost right after it was taken is Chrome bouncing it (the same Esc), not
      // the player asking for the menu.
      if (hud.get().screen === "playing" && now - this.lockGainedAt > 400) this.pause();
    }
    this.wasLocked = locked;
  }

  // ---------- Frame loop ----------

  private frame() {
    // Up to 0.1 s per frame, simulated in steps of at most 1/30 s: a slow machine
    // stays real-time (no slow motion) and nothing tunnels through walls.
    const frameDt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
    const steps = Math.max(1, Math.ceil(frameDt / (1 / 30) - 1e-6));
    const realDt = frameDt;
    const t0 = performance.now();
    this.input.beginFrame(performance.now() / 1000);

    // The Esc that unlocked the mouse already paused: don't let it also un-pause.
    if (this.input.consume("pause", 0.2) && performance.now() - this.lockLostAt > 300) {
      if (this.waitingLock) {
        // Esc again before grabbing the mouse: back to the menu.
        this.waitingLock = false;
        this.input.lockOnKey = false;
        hud.set({ screen: "paused" });
      } else if (this.paused) this.resume(false);
      else this.pause();
    }

    if (!this.paused) {
      // Dialogue advance.
      if (this.dialogueResolve && this.input.consume("skip", 0.25)) this.advanceDialogue();
      // Enter skips the current tip (they also move on by themselves).
      if (!this.dialogueResolve && this.tipTimer > 0 && this.input.consume("next", 0.25)) {
        this.tipTimer = 0.01;
      }
      if (!this.dialogueResolve && this.tipTimer > 0) {
        this.tipTimer -= realDt;
        if (this.tipTimer <= 0) this.nextTip();
      }

      if (this.input.pointerLocked && !this.camRig.scripted && !this.player.frozen) {
        const look = this.input.look();
        this.camRig.look(look.x, look.y);
      }

      for (let step = 0; step < steps; step++) this.simulate(frameDt / steps);
      this.adaptQuality(frameDt);
      this.comboTimer -= realDt;
      if (this.comboTimer <= 0 && this.comboCount > 0) {
        this.comboCount = 0;
        hud.set({ combo: 0 });
      }

      const focus = this.inTitle ? new Vector3(0, 0, 0) : this.player.body.position;
      const running =
        !this.inTitle &&
        this.input.running &&
        Math.hypot(this.player.body.velocity.x, this.player.body.velocity.z) > 5;
      this.camRig.update(realDt, focus, running, this.physics);
      this.env.update(realDt, focus);
      this.hidePlayerIfCameraInside();
    }

    const t1 = performance.now();
    this.scene.render();
    this.input.endFrame();
    this.measure(frameDt, t1 - t0, performance.now() - t1);
  }

  /** Frame stats for the debug overlay (and the perf tests), averaged over half a second. */
  readonly perf = {
    fps: 0,
    worstMs: 0,
    logicMs: 0,
    renderMs: 0,
    gpuMs: 0,
    drawCalls: 0,
    meshes: 0,
    scale: 1,
  };
  private readonly gpuTimer: EngineInstrumentation;
  private perfAcc = { time: 0, frames: 0, worst: 0, logic: 0, render: 0, draws: 0 };

  private measure(frameDt: number, logicMs: number, renderMs: number) {
    const a = this.perfAcc;
    a.time += frameDt;
    a.frames++;
    a.worst = Math.max(a.worst, this.engine.getDeltaTime());
    a.logic += logicMs;
    a.render += renderMs;
    if (a.time < 0.5) return;
    const draws = this.engine._drawCalls.current;
    Object.assign(this.perf, {
      fps: a.frames / a.time,
      worstMs: a.worst,
      logicMs: a.logic / a.frames,
      renderMs: a.render / a.frames,
      gpuMs: this.gpuTimer.gpuFrameTimeCounter.lastSecAverage * 1e-6,
      drawCalls: (draws - a.draws) / a.frames,
      meshes: this.scene.getActiveMeshes().length,
      scale: this.renderScale,
    });
    this.perfAcc = { time: 0, frames: 0, worst: 0, logic: 0, render: 0, draws };
  }

  readonly lightPool: PointLight[] = [];
  renderScale = 1;
  private slowTime = 0;
  private qualityToastShown = false;
  private playerHidden = false;

  /**
   * Smoothness first: if frames stay slow for a few seconds, render at a lower
   * resolution (the main GPU cost) until it's fluid again, up to half resolution.
   */
  private adaptQuality(frameDt: number) {
    if (this.inTitle || this.paused) return;
    if (frameDt > 1 / 28) this.slowTime += frameDt;
    else this.slowTime = Math.max(0, this.slowTime - frameDt * 0.5);
    if (this.slowTime > 4 && this.renderScale < 2) {
      this.slowTime = 0;
      this.renderScale = Math.min(2, this.renderScale * 1.25);
      this.engine.setHardwareScalingLevel(this.renderScale);
      if (!this.qualityToastShown) {
        this.qualityToastShown = true;
        this.toast("Qualité ajustée", "Résolution réduite pour garder le jeu fluide");
      }
    }
  }

  /** When a wall pushes the camera right up to Santa, hide him instead of filling the screen. */
  private hidePlayerIfCameraInside() {
    const head = this.player.body.position.add(new Vector3(0, 1.1, 0));
    const close = !this.inTitle && Vector3.Distance(this.camRig.camera.position, head) < 1.05;
    if (close === this.playerHidden) return;
    this.playerHidden = close;
    for (const m of this.player.rig.root.getChildMeshes(false)) m.isVisible = !close;
  }

  /** One simulation step (the frame loop may run several per rendered frame). */
  private simulate(stepDt: number) {
    let dt = stepDt;
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= stepDt;
      dt = 0;
    }
    this.time += dt;

    for (let i = this.waiters.length - 1; i >= 0; i--) {
      const w = this.waiters[i] as Waiter;
      if (w.gen !== this.generation) {
        this.waiters.splice(i, 1);
      } else if (this.time >= w.until) {
        this.waiters.splice(i, 1);
        w.resolve();
      }
    }

    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i] as Tween;
      if (tw.gen !== this.generation) {
        this.tweens.splice(i, 1);
        continue;
      }
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      tw.fn(tw.t);
      if (tw.t >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }

    if (!this.inTitle && dt > 0) {
      this.player.update(dt);
      this.enemies.update(dt);
      this.projectiles.update(dt);
    }
    if (dt > 0) {
      const left = this.inTitle ? 0 : this.stragglers().length;
      this.quietTime = left > 0 && left <= 3 ? this.quietTime + dt : 0;
      this.level.update(dt);
      this.gore.update(dt);
      this.fx.update(dt);
    }
  }

  /** Names for the map / HUD. */
  static levelName(id: number) {
    return LEVELS_META[id]?.name ?? "";
  }
}
