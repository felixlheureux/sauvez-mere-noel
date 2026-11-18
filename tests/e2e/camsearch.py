import asyncio, json, math
from playwright.async_api import async_playwright
from issues import gwait, load, until, URL, READY
# Test-time authoring aid: which camera spots see every subject point with nothing in between?
CLEAR = """([cam, targets]) => { const V = game.camRig.camera.position.constructor; const R = BABYLON_Ray;
  const SKIP = /sky|moon|aura|ground|water|snow|puff|splat|ring|marker|tracer|mere\\d|santa\\d/i; const c = new V(...cam); const hits = [];
  for (const t of targets) { const tv = new V(...t); const d = tv.subtract(c); const len = d.length(); d.normalize();
    const ray = new R(c, d, len - 0.4);
    const pk = game.scene.pickWithRay(ray, m => m.isEnabled() && m.isVisible && m.getTotalVertices() > 0 && !SKIP.test(m.name), false);
    if (pk && pk.hit) hits.push(pk.pickedMesh.name); }
  return hits; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await b.new_page(viewport={"width":1024,"height":576})
        await page.goto(URL); await until(page, READY)
        await page.evaluate("() => game.loadLevel(0)")
        await until(page, "() => store.getState().screen === 'playing'")
        await gwait(page, 0.5)
        await page.evaluate("() => { window.BABYLON_Ray = game.scene.pickWithRay.length >= 0 && game.scene.createPickingRay(0,0,null,game.camRig.camera).constructor; }")
        async def search(label, center, targets, front_deg, radii=(5, 6.5, 8), heights=(2.4, 3.4)):
            good = []
            for r in radii:
                for deg in range(-90, 91, 10):
                    a = math.radians(front_deg + deg)
                    for h in heights:
                        cam = [center[0] + math.sin(a) * r, h, center[1] + math.cos(a) * r]
                        if not await page.evaluate(CLEAR, [cam, targets]): good.append((abs(deg), r, h, [round(v, 1) for v in cam]))
            good.sort(); print(label, good[:6])
        # Opening: wide on the tree, then ease to Mère Noël on her porch. Check the whole path.
        ends = []
        for r in (7, 8.5, 10):
            for deg in range(-60, 61, 10):
                a = math.radians(deg)
                for h in (3.0, 4.0):
                    cam = [1.5 + math.sin(a) * r, h, 12 - math.cos(a) * r]
                    if not await page.evaluate(CLEAR, [cam, [[1.5, 1.6, 12], [2.6, 1.2, 13.6]]]): ends.append(cam)
        print("ends", ends[:12])
        found = []
        for r in (14, 17):
            for deg in range(0, 360, 20):
                a = math.radians(deg)
                for h in (7, 9):
                    st = [math.sin(a) * r, h, math.cos(a) * r]
                    tg = [[st[j] + (T[j] - st[j]) * 0.7 for j in range(3)] for T in ([0, 4.5, 0], [0, 2, 0], [0, 7, 0], [3, 2, 0], [-3, 2, 0])]
                    if await page.evaluate(CLEAR, [st, tg]): continue
                    found.append((deg, r, h, [round(v, 1) for v in st])); continue
                    for en in ends:
                        ok = True
                        for i in range(1, 11):
                            k = i / 10; k = k * k * (3 - 2 * k)
                            c = [st[j] + (en[j] - st[j]) * k for j in range(3)]
                            t = [0 + 1.5 * k, 3 - 1.4 * k, 12 * k]
                            tt = [c[j] + (t[j] - c[j]) * 0.7 for j in range(3)]
                            if await page.evaluate(CLEAR, [c, [tt]]): ok = False; break
                        if ok: found.append(([round(v, 1) for v in st], [round(v, 1) for v in en])); break
        print("wide starts", found)
        await b.close()
if __name__ == "__main__":
    asyncio.run(main())
