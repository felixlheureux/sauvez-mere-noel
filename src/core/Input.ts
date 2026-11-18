/**
 * Keyboard + mouse input mapped to game actions.
 * Presses are timestamped so the player controller can use input buffering
 * (e.g. a jump pressed 0.1 s before landing still counts).
 */
export type Action =
  | "jump"
  | "dash"
  | "shoot"
  | "melee"
  | "cane"
  | "pause"
  | "skip"
  | "next"
  | "nextWeapon"
  | "prevWeapon";

const KEY_ACTIONS: Record<string, Action> = {
  Space: "jump",
  KeyQ: "dash",
  KeyF: "cane",
  KeyE: "melee",
  Escape: "pause",
  KeyP: "pause",
  Enter: "next",
};

export class Input {
  private readonly down = new Set<string>();
  private readonly pressedAt = new Map<Action, number>();
  private readonly held = new Set<Action>();
  private mouseDX = 0;
  private mouseDY = 0;
  private now = 0;
  /** Length of the last frame: presses that happened during it always count. */
  private frameDelta = 0;
  /** Number key pressed this frame (1–10), or 0. */
  weaponSlot = 0;
  sensitivity = 1;
  invertY = false;
  enabled = true;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.reset);
    // Pointer events, not mouse events: Babylon calls preventDefault() on pointerdown, and
    // the browser then never sends mousedown/mouseup (so real clicks didn't shoot).
    canvas.addEventListener("pointerdown", this.onPointerButtons);
    window.addEventListener("pointerup", this.onPointerButtons);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("wheel", this.onWheel, { passive: true });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  get pointerLocked() {
    return document.pointerLockElement === this.canvas;
  }

  requestPointerLock() {
    if (this.pointerLocked) return;
    try {
      const p = this.canvas.requestPointerLock() as unknown;
      if (p instanceof Promise) p.catch(() => {});
    } catch {
      /* not allowed yet (needs a user gesture) */
    }
  }

  exitPointerLock() {
    if (this.pointerLocked) document.exitPointerLock();
  }

  /** Call once at the start of every frame. `time` is real (unscaled) seconds. */
  beginFrame(time: number) {
    this.frameDelta = Math.min(0.5, time - this.now);
    this.now = time;
  }

  get time() {
    return this.now;
  }

  /** Call once at the end of every frame. */
  endFrame() {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.weaponSlot = 0;
  }

  isKey(code: string) {
    return this.enabled && this.down.has(code);
  }

  isHeld(action: Action) {
    return this.enabled && this.held.has(action);
  }

  /** True if `action` was pressed within the last `window` seconds (does not consume). */
  peek(action: Action, window = 0.0001) {
    const t = this.pressedAt.get(action);
    return t !== undefined && this.now - t <= Math.max(window, this.frameDelta + 0.001);
  }

  clear(action: Action) {
    this.pressedAt.delete(action);
  }

  /** True if `action` was pressed within the last `window` seconds. Consumes the press. */
  consume(action: Action, window = 0.0001) {
    const t = this.pressedAt.get(action);
    if (t === undefined || this.now - t > Math.max(window, this.frameDelta + 0.001)) return false;
    this.pressedAt.delete(action);
    return true;
  }

  /** Movement axes in [-1, 1]: x = strafe right, y = forward. */
  moveAxis() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    if (this.down.has("KeyW") || this.down.has("ArrowUp")) y += 1;
    if (this.down.has("KeyS") || this.down.has("ArrowDown")) y -= 1;
    if (this.down.has("KeyD") || this.down.has("ArrowRight")) x += 1;
    if (this.down.has("KeyA") || this.down.has("ArrowLeft")) x -= 1;
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  get running() {
    return this.isKey("ShiftLeft") || this.isKey("ShiftRight");
  }

  look() {
    const k = 0.0022 * this.sensitivity;
    return { x: this.mouseDX * k, y: this.mouseDY * k * (this.invertY ? -1 : 1) };
  }

  private press(action: Action) {
    this.pressedAt.set(action, performance.now() / 1000);
    this.held.add(action);
  }

  private release(action: Action) {
    this.held.delete(action);
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    this.down.add(e.code);
    const action = KEY_ACTIONS[e.code];
    if (action) this.press(action);
    // Space and Enter continue cutscene dialogue; Enter alone also skips tips.
    if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") this.press("skip");
    if (e.code === "NumpadEnter") this.press("next");
    const digit = /^Digit(\d)$/.exec(e.code);
    if (digit) {
      const n = Number(digit[1]);
      this.weaponSlot = n === 0 ? 10 : n;
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
    const action = KEY_ACTIONS[e.code];
    if (action) this.release(action);
  };

  /** Left / right button state from the `buttons` bitmask (also covers chorded presses). */
  private mouseButtons = 0;

  private readonly onPointerButtons = (e: PointerEvent) => {
    const was = this.mouseButtons;
    this.mouseButtons = e.buttons;
    const changed = was ^ e.buttons;
    if (changed & 1) {
      if (e.buttons & 1) {
        this.press("shoot");
        this.press("skip");
      } else this.release("shoot");
    }
    if (changed & 2) {
      if (e.buttons & 2) this.press("melee");
      else this.release("melee");
    }
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    // A second button pressed while one is held arrives as a pointermove.
    if (e.buttons !== this.mouseButtons) this.onPointerButtons(e);
    if (!this.pointerLocked) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  private readonly onWheel = (e: WheelEvent) => {
    if (!this.pointerLocked) return;
    this.press(e.deltaY > 0 ? "nextWeapon" : "prevWeapon");
  };

  private readonly reset = () => {
    this.down.clear();
    this.held.clear();
    this.mouseButtons = 0;
  };
}
