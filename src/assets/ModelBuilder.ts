import {
  Color3,
  Color4,
  Mesh,
  MeshBuilder,
  type Scene,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData,
} from "@babylonjs/core";
import type { Materials } from "./Materials";
import { type ColorLike, color } from "./Palette";

export type V3 = readonly [number, number, number];

/** Low-poly shape recipes. Small segment counts give the faceted look. */
export type Shape =
  | { kind: "box"; size: V3 }
  | { kind: "sphere"; d: number; seg?: number }
  | { kind: "ico"; r: number; sub?: number }
  | { kind: "cyl"; top: number; bottom: number; h: number; sides?: number }
  | { kind: "torus"; d: number; t: number; sides?: number; ring?: number }
  | { kind: "lathe"; profile: ReadonlyArray<readonly [number, number]>; sides?: number }
  | { kind: "tube"; path: ReadonlyArray<V3>; r: number; sides?: number; stripe?: ColorLike }
  | { kind: "disc"; r: number; sides?: number }
  | { kind: "prism"; w: number; h: number; d: number };

export const box = (w: number, h: number, d: number): Shape => ({ kind: "box", size: [w, h, d] });
export const sphere = (d: number, seg = 3): Shape => ({ kind: "sphere", d, seg });
export const ico = (r: number, sub = 1): Shape => ({ kind: "ico", r, sub });
export const cyl = (bottom: number, top: number, h: number, sides = 8): Shape => ({
  kind: "cyl",
  top,
  bottom,
  h,
  sides,
});
export const cone = (d: number, h: number, sides = 7): Shape => cyl(d, 0, h, sides);
export const torus = (d: number, t: number, sides = 10, ring = 5): Shape => ({
  kind: "torus",
  d,
  t,
  sides,
  ring,
});
export const lathe = (profile: ReadonlyArray<readonly [number, number]>, sides = 8): Shape => ({
  kind: "lathe",
  profile,
  sides,
});
export const tube = (path: ReadonlyArray<V3>, r: number, stripe?: ColorLike, sides = 6): Shape => ({
  kind: "tube",
  path,
  r,
  sides,
  stripe,
});
export const disc = (r: number, sides = 8): Shape => ({ kind: "disc", r, sides });
/** Triangular prism (gable roof): base `w` wide at y = 0, ridge at y = `h`, `d` deep along z. */
export const prism = (w: number, h: number, d: number): Shape => ({ kind: "prism", w, h, d });

export interface PartOptions {
  pos?: V3;
  /** Rotation in degrees. */
  rot?: V3;
  scale?: V3 | number;
  /** Emissive part (eyes, lights): kept as its own mesh so the glow layer catches it. */
  glow?: boolean;
  glowStrength?: number;
}

const DEG = Math.PI / 180;

/**
 * Collects parts into named groups, then merges each group into one flat-shaded,
 * vertex-colored mesh. Groups become joints for characters, or a single mesh for props.
 */
export class ModelBuilder {
  private readonly groups = new Map<string, { solid: Mesh[]; glow: Map<string, Mesh[]> }>();
  private counter = 0;

  constructor(
    private readonly scene: Scene,
    private readonly materials: Materials,
    private readonly name: string,
  ) {}

  part(group: string, shape: Shape, c: ColorLike, opts: PartOptions = {}) {
    // Glow parts are painted white: their color comes from the emissive material.
    const mesh = this.makeShape(shape, opts.glow ? "white" : c);
    if (opts.pos) mesh.position.set(...opts.pos);
    if (opts.rot) mesh.rotation.set(opts.rot[0] * DEG, opts.rot[1] * DEG, opts.rot[2] * DEG);
    if (opts.scale !== undefined) {
      if (typeof opts.scale === "number") mesh.scaling.setAll(opts.scale);
      else mesh.scaling.set(...opts.scale);
    }
    let g = this.groups.get(group);
    if (!g) {
      g = { solid: [], glow: new Map() };
      this.groups.set(group, g);
    }
    if (opts.glow) {
      const key = `${color(c).toHexString()}|${opts.glowStrength ?? 1}`;
      const list = g.glow.get(key) ?? [];
      list.push(mesh);
      g.glow.set(key, list);
    } else {
      g.solid.push(mesh);
    }
    return this;
  }

  /** Merge every group. Returns group name → mesh (glow meshes are parented to their solid mesh). */
  build(): Map<string, Mesh> {
    const out = new Map<string, Mesh>();
    for (const [groupName, g] of this.groups) {
      const solid = this.merge(`${this.name}_${groupName}`, g.solid);
      const root = solid ?? new Mesh(`${this.name}_${groupName}`, this.scene);
      if (solid) solid.material = this.materials.toon;
      for (const [key, meshes] of g.glow) {
        const [hex, strength] = key.split("|") as [string, string];
        const glowMesh = this.merge(`${this.name}_${groupName}_glow`, meshes, false);
        if (!glowMesh) continue;
        glowMesh.material = this.materials.glow(Color3.FromHexString(hex), Number(strength));
        glowMesh.metadata = { glowHex: hex };
        glowMesh.parent = root;
      }
      out.set(groupName, root);
    }
    this.groups.clear();
    return out;
  }

  /** Convenience: build everything into a single mesh (props). */
  buildSingle(): Mesh {
    const groups = this.build();
    const meshes = [...groups.values()];
    if (meshes.length === 1) return meshes[0] as Mesh;
    const root = new Mesh(this.name, this.scene);
    for (const m of meshes) m.parent = root;
    return root;
  }

  private merge(name: string, meshes: Mesh[], flat = true): Mesh | null {
    if (meshes.length === 0) return null;
    const merged = Mesh.MergeMeshes(meshes, true, true);
    if (!merged) return null;
    merged.name = name;
    if (flat) merged.convertToFlatShadedMesh();
    merged.isPickable = false;
    return merged;
  }

  private makeShape(shape: Shape, c: ColorLike): Mesh {
    const name = `${this.name}_p${this.counter++}`;
    const opts = { updatable: false };
    let mesh: Mesh;
    switch (shape.kind) {
      case "box":
        mesh = MeshBuilder.CreateBox(
          name,
          { width: shape.size[0], height: shape.size[1], depth: shape.size[2], ...opts },
          this.scene,
        );
        break;
      case "sphere":
        mesh = MeshBuilder.CreateSphere(
          name,
          { diameter: shape.d, segments: shape.seg ?? 3 },
          this.scene,
        );
        break;
      case "ico":
        mesh = MeshBuilder.CreateIcoSphere(
          name,
          { radius: shape.r, subdivisions: shape.sub ?? 1, flat: true },
          this.scene,
        );
        break;
      case "cyl":
        mesh = MeshBuilder.CreateCylinder(
          name,
          {
            diameterTop: shape.top,
            diameterBottom: shape.bottom,
            height: shape.h,
            tessellation: shape.sides ?? 8,
          },
          this.scene,
        );
        break;
      case "torus":
        mesh = MeshBuilder.CreateTorus(
          name,
          { diameter: shape.d, thickness: shape.t, tessellation: shape.sides ?? 10 },
          this.scene,
        );
        break;
      case "lathe":
        mesh = MeshBuilder.CreateLathe(
          name,
          {
            shape: shape.profile.map(([x, y]) => new Vector3(x, y, 0)),
            tessellation: shape.sides ?? 8,
            sideOrientation: Mesh.DOUBLESIDE,
          },
          this.scene,
        );
        break;
      case "tube":
        mesh = MeshBuilder.CreateTube(
          name,
          {
            path: shape.path.map((p) => new Vector3(...p)),
            radius: shape.r,
            tessellation: shape.sides ?? 6,
            cap: Mesh.CAP_ALL,
          },
          this.scene,
        );
        break;
      case "prism": {
        const x = shape.w / 2;
        const z = shape.d / 2;
        const y = shape.h;
        mesh = new Mesh(name, this.scene);
        const vd = new VertexData();
        // Front, back, left slope, right slope, bottom.
        vd.positions = [
          -x,
          0,
          z,
          x,
          0,
          z,
          0,
          y,
          z,
          x,
          0,
          -z,
          -x,
          0,
          -z,
          0,
          y,
          -z,
          -x,
          0,
          -z,
          -x,
          0,
          z,
          0,
          y,
          z,
          0,
          y,
          -z,
          x,
          0,
          z,
          x,
          0,
          -z,
          0,
          y,
          -z,
          0,
          y,
          z,
          -x,
          0,
          -z,
          x,
          0,
          -z,
          x,
          0,
          z,
          -x,
          0,
          z,
        ];
        const tris = [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 6, 8, 9, 10, 11, 12, 10, 12, 13, 14, 15, 16, 14, 16, 17,
        ];
        // Both windings: whichever faces outward is drawn, so the winding order can't bite us.
        const flipped: number[] = [];
        for (let i = 0; i < tris.length; i += 3)
          flipped.push(tris[i] as number, tris[i + 2] as number, tris[i + 1] as number);
        vd.indices = [...tris, ...flipped];
        const normals: number[] = [];
        VertexData.ComputeNormals(vd.positions, vd.indices, normals);
        vd.normals = normals;
        // UVs aren't used, but merging needs every mesh to have the same attributes.
        vd.uvs = new Array((vd.positions.length / 3) * 2).fill(0);
        vd.applyToMesh(mesh);
        break;
      }
      case "disc":
        mesh = MeshBuilder.CreateDisc(
          name,
          { radius: shape.r, tessellation: shape.sides ?? 8 },
          this.scene,
        );
        mesh.rotation.x = Math.PI / 2;
        mesh.bakeCurrentTransformIntoVertices();
        break;
    }
    mesh.metadata = { color: c };
    if (shape.kind === "tube" && shape.stripe) {
      paintStripes(mesh, color(c), color(shape.stripe), (shape.sides ?? 6) + 1);
    } else {
      paint(mesh, color(c));
    }
    return mesh;
  }
}

export function paint(mesh: Mesh, c: Color3, alpha = 1) {
  const count = mesh.getTotalVertices();
  const colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b, alpha], i * 4);
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
}

/** Diagonal stripes along a tube → a candy-cane spiral. */
function paintStripes(mesh: Mesh, a: Color3, b: Color3, ringSize: number) {
  const count = mesh.getTotalVertices();
  const colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const ring = Math.floor(i / ringSize);
    const seg = i % ringSize;
    const c = Math.floor((ring + seg * 0.5) / 2) % 2 === 0 ? a : b;
    colors.set([c.r, c.g, c.b, 1], i * 4);
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
}

/** Recolor a whole mesh (used for palette shifts and possession). */
export function tint(mesh: Mesh, c: Color4 | Color3) {
  const data = mesh.getVerticesData(VertexBuffer.ColorKind);
  if (!data) return;
  const col = c instanceof Color4 ? c : new Color4(c.r, c.g, c.b, 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (data[i] ?? 0) * col.r;
    data[i + 1] = (data[i + 1] ?? 0) * col.g;
    data[i + 2] = (data[i + 2] ?? 0) * col.b;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, data);
}

export function emptyNode(name: string, scene: Scene, parent?: TransformNode | null, pos?: V3) {
  const n = new TransformNode(name, scene);
  if (parent) n.parent = parent;
  if (pos) n.position.set(...pos);
  return n;
}
