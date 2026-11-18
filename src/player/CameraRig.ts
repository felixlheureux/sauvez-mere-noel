import { type Scene, UniversalCamera, Vector3 } from "@babylonjs/core";
import { clamp, damp, lerp, smoothstep } from "../core/math";
import type { PhysicsWorld } from "../world/Physics";

interface Shot {
  from: { pos: Vector3; target: Vector3 };
  to: { pos: Vector3; target: Vector3 };
  t: number;
  duration: number;
}

/**
 * Over-the-shoulder third-person camera with wall avoidance, shake and FOV kick,
 * plus scripted "shots" for cutscenes.
 */
export class CameraRig {
  readonly camera: UniversalCamera;
  yaw = 0;
  pitch = 0.18;
  distance = 4.4;
  private currentDist = 4.4;
  private trauma = 0;
  private time = 0;
  private fovKick = 0;
  private readonly baseFov = 0.95;
  private shot: Shot | null = null;
  private orbit: { center: Vector3; radius: number; height: number; speed: number } | null = null;
  private readonly smoothedTarget = new Vector3();
  /** Where the camera is looking. Kept here because `camera.getTarget()` only refreshes at render time. */
  private readonly lookAt = new Vector3();

  constructor(scene: Scene) {
    this.camera = new UniversalCamera("cam", new Vector3(0, 3, -6), scene);
    this.camera.minZ = 0.1;
    this.camera.maxZ = 500;
    this.camera.fov = this.baseFov;
    this.camera.inputs.clear();
  }

  get forward() {
    return new Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
  }

  look(dx: number, dy: number) {
    this.yaw += dx;
    this.pitch = clamp(this.pitch + dy, -0.65, 1.1);
  }

  /** Add screen shake (0–1, accumulates). */
  shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  kickFov(amount: number) {
    this.fovKick = Math.max(this.fovKick, amount);
  }

  /** Move the camera to a hand-placed cutscene shot over `duration` seconds. */
  cut(pos: Vector3, target: Vector3, duration = 0) {
    this.orbit = null;
    // Hard cut: jump there right away so a following eased cut starts from here.
    if (duration <= 0) this.place(pos, target);
    const from = { pos: this.camera.position.clone(), target: this.lookAt.clone() };
    this.shot = { from, to: { pos, target }, t: 0, duration: Math.max(duration, 0.0001) };
  }

  /** Slow orbit for the title screen. */
  startOrbit(center: Vector3, radius: number, height: number, speed = 0.08) {
    this.shot = null;
    this.orbit = { center, radius, height, speed };
  }

  /** Return control to the follow camera. */
  release() {
    this.shot = null;
    this.orbit = null;
  }

  get scripted() {
    return this.shot !== null || this.orbit !== null;
  }

  update(dt: number, focus: Vector3, running: boolean, physics: PhysicsWorld) {
    this.time += dt;
    const cam = this.camera;

    if (this.orbit) {
      const o = this.orbit;
      const a = this.time * o.speed;
      this.place(
        new Vector3(
          o.center.x + Math.cos(a) * o.radius,
          o.center.y + o.height,
          o.center.z + Math.sin(a) * o.radius,
        ),
        o.center,
      );
      cam.fov = this.baseFov;
      return;
    }

    if (this.shot) {
      const s = this.shot;
      s.t = Math.min(1, s.t + dt / s.duration);
      const k = smoothstep(s.t);
      this.place(
        Vector3.Lerp(s.from.pos, s.to.pos, k),
        Vector3.Lerp(s.from.target, s.to.target, k),
      );
      this.applyShake(dt);
      return;
    }

    // Follow: aim point over the right shoulder.
    const target = focus.add(new Vector3(0, 1.55, 0));
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    target.addInPlace(right.scale(0.8));
    if (this.smoothedTarget.lengthSquared() === 0) this.smoothedTarget.copyFrom(target);
    this.smoothedTarget.x = damp(this.smoothedTarget.x, target.x, 25, dt);
    this.smoothedTarget.z = damp(this.smoothedTarget.z, target.z, 25, dt);
    this.smoothedTarget.y = damp(this.smoothedTarget.y, target.y, 10, dt);

    const back = this.forward.scale(-1);
    const wanted = this.distance + (running ? 0.4 : 0);
    const hit = physics.raycast(this.smoothedTarget, back, wanted + 0.3) - 0.3;
    const allowed = clamp(hit, 0.8, wanted);
    this.currentDist =
      allowed < this.currentDist ? allowed : damp(this.currentDist, allowed, 4, dt);

    this.place(
      this.smoothedTarget.add(back.scale(this.currentDist)),
      this.smoothedTarget.add(this.forward.scale(10)),
    );

    this.fovKick = damp(this.fovKick, 0, 6, dt);
    cam.fov = damp(cam.fov, this.baseFov + (running ? 0.09 : 0) + this.fovKick, 6, dt);
    this.applyShake(dt);
  }

  private place(pos: Vector3, target: Vector3) {
    this.camera.position.copyFrom(pos);
    this.lookAt.copyFrom(target);
    this.camera.setTarget(target);
  }

  private applyShake(dt: number) {
    if (this.trauma <= 0) return;
    const s = this.trauma * this.trauma * 0.35;
    const t = this.time * 40;
    const cam = this.camera;
    cam.position.x += Math.sin(t * 1.1) * s;
    cam.position.y += Math.sin(t * 1.7 + 1) * s;
    cam.position.z += Math.sin(t * 1.3 + 2) * s * 0.5;
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
  }

  /** Lerp helper used by cutscenes. */
  static mix(a: Vector3, b: Vector3, t: number) {
    return new Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
  }
}
