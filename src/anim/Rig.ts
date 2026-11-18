import { type AbstractMesh, Color3, type Mesh, type Scene, TransformNode } from "@babylonjs/core";
import type { V3 } from "../assets/ModelBuilder";

export type JointName =
  | "root"
  | "body"
  | "hips"
  | "chest"
  | "head"
  | "hatTip"
  | "armL"
  | "armR"
  | "hand"
  | "legL"
  | "legR";

export interface JointDef {
  name: JointName;
  parent: JointName | null;
  pos: V3;
}

/** Standard humanoid joint layout, scaled per character. */
export function humanoidJoints(o: {
  hips: number;
  legSpread: number;
  chest: number;
  head: number;
  shoulderX: number;
  shoulderY: number;
  hand: number;
  hatTip: V3;
}): JointDef[] {
  return [
    { name: "root", parent: null, pos: [0, 0, 0] },
    { name: "body", parent: "root", pos: [0, 0, 0] },
    { name: "hips", parent: "body", pos: [0, o.hips, 0] },
    { name: "legL", parent: "hips", pos: [-o.legSpread, 0, 0] },
    { name: "legR", parent: "hips", pos: [o.legSpread, 0, 0] },
    { name: "chest", parent: "hips", pos: [0, o.chest, 0] },
    { name: "head", parent: "chest", pos: [0, o.head, 0] },
    { name: "hatTip", parent: "head", pos: o.hatTip },
    { name: "armL", parent: "chest", pos: [-o.shoulderX, o.shoulderY, 0] },
    { name: "armR", parent: "chest", pos: [o.shoulderX, o.shoulderY, 0] },
    { name: "hand", parent: "armR", pos: [0, -o.hand, 0] },
  ];
}

/**
 * A character: a tree of joints with low-poly meshes hanging off them.
 * Animation rotates joints; gore detaches the meshes.
 */
export class Rig {
  readonly root: TransformNode;
  readonly joints = {} as Record<JointName, TransformNode>;
  /** Meshes attached to each joint (solid mesh; glow meshes are its children). */
  readonly parts = new Map<JointName, Mesh>();
  private flashTimer = 0;

  constructor(
    scene: Scene,
    name: string,
    defs: JointDef[],
    readonly height: number,
  ) {
    for (const d of defs) {
      const node = new TransformNode(`${name}_${d.name}`, scene);
      node.position.set(...d.pos);
      if (d.parent) node.parent = this.joints[d.parent];
      this.joints[d.name] = node;
    }
    this.root = this.joints.root;
  }

  attach(joint: JointName, mesh: Mesh) {
    mesh.parent = this.joints[joint];
    this.parts.set(joint, mesh);
  }

  allMeshes(): AbstractMesh[] {
    return this.root.getChildMeshes(false);
  }

  /** White hit flash using Babylon's overlay rendering. */
  flash(duration = 0.08, c = Color3.White()) {
    this.flashTimer = duration;
    for (const m of this.allMeshes()) {
      m.overlayColor = c;
      m.overlayAlpha = 0.85;
      m.renderOverlay = true;
    }
  }

  update(dt: number) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) for (const m of this.allMeshes()) m.renderOverlay = false;
    }
  }

  setEnabled(v: boolean) {
    this.root.setEnabled(v);
  }

  dispose() {
    this.root.dispose(false, false);
  }
}
