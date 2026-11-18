import type { Vector3 } from "@babylonjs/core";
import { Animator, type Clip } from "../anim/Animator";
import type { Rig } from "../anim/Rig";
import { dampAngle, flatDistance, yawTo } from "../core/math";

/** A friendly character standing around: idles, waves, turns to face Santa. */
export class Npc {
  readonly anim: Animator;
  yaw: number;
  /** Turns to face the player when closer than this. */
  lookRange = 7;
  idleClip: Clip | null = null;
  private walkTo: { pos: Vector3; speed: number; done: () => void } | null = null;

  constructor(
    readonly rig: Rig,
    readonly position: Vector3,
    yaw = 0,
  ) {
    this.yaw = yaw;
    this.anim = new Animator(rig);
    this.anim.loco.runSpeed = 4;
    rig.root.position.copyFrom(position);
    rig.root.rotation.y = yaw;
  }

  setIdle(clip: Clip | null) {
    this.idleClip = clip;
    if (clip) this.anim.play(clip);
    else this.anim.stop();
  }

  moveTo(pos: Vector3, speed = 2.5) {
    return new Promise<void>((resolve) => {
      this.walkTo = { pos, speed, done: resolve };
    });
  }

  update(dt: number, playerPos: Vector3 | null) {
    if (this.walkTo) {
      const w = this.walkTo;
      const d = flatDistance(this.position, w.pos);
      if (d < 0.1) {
        this.walkTo = null;
        this.anim.loco.speed = 0;
        w.done();
      } else {
        const step = Math.min(d, w.speed * dt);
        const a = yawTo(this.position, w.pos);
        this.position.x += Math.sin(a) * step;
        this.position.z += Math.cos(a) * step;
        this.yaw = dampAngle(this.yaw, a, 10, dt);
        this.anim.loco.speed = w.speed;
      }
    } else {
      this.anim.loco.speed = 0;
      if (playerPos && flatDistance(this.position, playerPos) < this.lookRange) {
        this.yaw = dampAngle(this.yaw, yawTo(this.position, playerPos), 4, dt);
      }
    }
    this.rig.root.position.copyFrom(this.position);
    this.rig.root.rotation.y = this.yaw;
    this.anim.update(dt);
    this.rig.update(dt);
  }
}
