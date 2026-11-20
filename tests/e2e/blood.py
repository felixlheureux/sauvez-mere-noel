"""Blood pools are visible wherever enemies die: on every level, no surface (a layer of
snow on a roof, a terrain mesh, a rink) lies just above where the pools are painted."""
import asyncio
from playwright.async_api import async_playwright
from issues import check, load, results, skip_cutscene, until, URL, READY

# For a grid of spots: where Gore.splat() paints a pool (the highest ground there), and
# whether a visible surface sits within 30 cm above it (the pool would be hidden).
AUDIT = """() => { const g = game, sc = g.scene, Ray = sc.activeCamera.getForwardRay().constructor;
  const V = g.player.body.position.constructor; const hidden = []; let spots = 0;
  const visible = (m) => !(m.metadata && m.metadata.noSplat) && m.isEnabled() && m.isVisible && m.visibility > 0 && m.getTotalVertices() > 0
    && m.isDescendantOf(g.levelRoot) && !(m.material && m.material.alpha < 1);
  for (let x = -60; x <= 60; x += 3) for (let z = -100; z <= 100; z += 3) {
    const y = g.physics.groundHeightAt(x, z, 60);
    if (y < -20 || g.level.deadlyGround(x, z, y)) continue;
    spots++;
    // A pool painted where an elf standing here would leave it.
    g.gore.splat(new V(x, y + 0.5, z));
    const pool = g.gore.decals[g.gore.decals.length - 1].inst.position.y;
    const hit = sc.pickWithRay(new Ray(new V(x, pool + 0.3, z), new V(0, -1, 0), 0.3 - 0.003), visible);
    if (hit && hit.hit) hidden.push([x, z, +y.toFixed(2), hit.pickedMesh.name, +(hit.pickedPoint.y - pool).toFixed(3)]);
  }
  return {spots, hidden}; }"""


async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"])
        page = await br.new_page(viewport={"width": 1280, "height": 720})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(URL); await until(page, READY)
        for lvl in range(0, 11):
            await load(page, lvl); await skip_cutscene(page, 30)
            r = await page.evaluate(AUDIT)
            names = sorted({h[3] for h in r["hidden"]})
            # A handful of spots sit under something that really overhangs the ground (a
            # rock's bulge, a fence's bottom rail): hidden there is right. Layers on top of
            # the ground (roof snow, a terrain mesh, a rink) would hide pools by the hundred.
            check(f"Level {lvl}: blood pools are visible on the ground ({r['spots']} spots)", len(r["hidden"]) <= r["spots"] * 0.002,
                  f"{len(r['hidden'])} hidden, under {names[:6]}, e.g. {r['hidden'][:3]}")
        check("No page errors", not errors, str(errors[:3]))
        await br.close()
    print(f"\n{sum(ok for _, ok, _ in results)}/{len(results)} passed")


if __name__ == "__main__":
    asyncio.run(main())
