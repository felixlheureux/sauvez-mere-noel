import { Color3, type Scene, StandardMaterial } from "@babylonjs/core";

/**
 * Every model uses one of a handful of shared materials. Colors live in the
 * vertices, so draw calls stay low and the art stays consistent.
 */
export class Materials {
  readonly toon: StandardMaterial;
  readonly unlit: StandardMaterial;
  private readonly glowCache = new Map<string, StandardMaterial>();

  constructor(private readonly scene: Scene) {
    this.toon = new StandardMaterial("toon", scene);
    this.toon.diffuseColor = Color3.White();
    this.toon.specularColor = Color3.Black();
    this.toon.emissiveColor = new Color3(0.07, 0.06, 0.09);
    this.toon.maxSimultaneousLights = 8;

    this.unlit = new StandardMaterial("unlit", scene);
    // With lighting disabled the output is emissive × vertex color.
    this.unlit.disableLighting = true;
    this.unlit.emissiveColor = Color3.White();
    this.unlit.diffuseColor = Color3.Black();
    this.unlit.specularColor = Color3.Black();
  }

  /** Emissive material picked up by the glow layer (eyes, lights, star). */
  glow(c: Color3, strength = 1) {
    const key = `${c.toHexString()}_${strength}`;
    let m = this.glowCache.get(key);
    if (!m) {
      m = new StandardMaterial(`glow_${key}`, this.scene);
      m.disableLighting = true;
      m.diffuseColor = Color3.Black();
      m.specularColor = Color3.Black();
      m.emissiveColor = c.scale(strength);
      this.glowCache.set(key, m);
    }
    return m;
  }
}
