import asyncio, json, sys
from playwright.async_api import async_playwright
from issues import gwait, load, until, URL, READY
HOOK = """() => { window.__cc = {blocked: {}}; const r = game.camRig; const o = r.update.bind(r);
  const R = game.scene.createPickingRay(0, 0, null, r.camera).constructor;
  const SKIP = /sky|moon|aura|ground|water|snow|puff|splat|ring|marker|tracer|santa\\d|mere\\d|fouettard|sleigh|star/i;
  r.update = (...a) => { o(...a); if (!r.shot) return; const c = r.camera.position.clone(); const t = r.camera.getTarget();
    const d = t.subtract(c); const len = d.length(); d.normalize();
    const pk = game.scene.pickWithRay(new R(c, d, len * 0.7), m => m.isEnabled() && m.isVisible && m.getTotalVertices() > 0 && !SKIP.test(m.name), false);
    if (pk && pk.hit) window.__cc.blocked[pk.pickedMesh.name + ' cam@' + [c.x,c.y,c.z].map(v => v.toFixed(0)).join(',')] = 1; }; }"""
async def report(page, label):
    cc = await page.evaluate("() => window.__cc")
    bad = sorted(cc["blocked"])
    print(("PASS" if not bad else "FAIL"), label, "- nothing between camera and subject" if not bad else bad[:12])
    await page.evaluate("() => { window.__cc = {blocked: {}}; }")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await b.new_page(viewport={"width":1024,"height":576})
        await page.goto(URL); await until(page, READY)
        await page.evaluate(HOOK)
        await page.evaluate("() => game.loadLevel(0)")
        await until(page, "() => store.getState().screen === 'playing'")
        for i in range(40):
            await gwait(page, 0.6)
            if i in (1, 3, 6): await page.screenshot(path=f"out/cc_intro{i}.png")
            if not await page.evaluate("() => store.getState().letterbox"): break
            if i % 2: await page.keyboard.press("Enter")
        await report(page, "L0 intro")
        await page.evaluate("() => { game.level.starTaken = true; game.level.twist(); }")
        for i in range(40):
            await gwait(page, 0.8)
            if i in (2, 5, 8): await page.screenshot(path=f"out/cc_twist{i}.png")
            if i > 3 and not await page.evaluate("() => store.getState().letterbox"): break
            if i % 2: await page.keyboard.press("Enter")
        await report(page, "L0 twist")
        await load(page, 5)
        for i in range(30):
            await gwait(page, 0.6)
            if not await page.evaluate("() => store.getState().letterbox"): break
            if i % 2: await page.keyboard.press("Enter")
        await report(page, "L5 intro")
        await load(page, 6)
        for i in range(30):
            await gwait(page, 0.6)
            if i == 1: await page.screenshot(path="out/cc_l6intro.png")
            if not await page.evaluate("() => store.getState().letterbox"): break
            if i % 2: await page.keyboard.press("Enter")
        await report(page, "L6 intro")
        await load(page, 7)
        for i in range(30):
            await gwait(page, 0.6)
            if i == 1: await page.screenshot(path="out/cc_l7intro.png")
            if not await page.evaluate("() => store.getState().letterbox"): break
            if i % 2: await page.keyboard.press("Enter")
        await report(page, "L7 intro")
        await load(page, 8)
        for i in range(30):
            await gwait(page, 0.6)
            if i == 1: await page.screenshot(path="out/cc_l8intro.png")
            if not await page.evaluate("() => store.getState().letterbox"): break
            if i % 2: await page.keyboard.press("Enter")
        await report(page, "L8 intro")
        await load(page, 8, 2)
        await page.evaluate("() => { const P = game.player; P.body.position.set(0, 0.05, 31); P.body.velocity.setAll(0); }")
        for i in range(30):
            await gwait(page, 0.6)
            if i == 2: await page.screenshot(path="out/cc_l8comete.png")
            if i > 3 and not await page.evaluate("() => store.getState().letterbox"): break
            if i % 2: await page.keyboard.press("Enter")
        await report(page, "L8 Comète")
        await load(page, 9)
        for i in range(30):
            await gwait(page, 0.6)
            if i == 1: await page.screenshot(path="out/cc_l9intro.png")
            if not await page.evaluate("() => store.getState().letterbox"): break
            if i % 2: await page.keyboard.press("Enter")
        await report(page, "L9 intro")
        await page.evaluate("() => { const P = game.player; P.body.position.set(-1.2, 28.05, -1.6); P.body.velocity.setAll(0); void game.level.summit(); }")
        for i in range(40):
            await gwait(page, 0.6)
            if i == 4: await page.screenshot(path="out/cc_l9summit.png")
            if i > 4 and not await page.evaluate("() => store.getState().letterbox"): break
            if i % 2 and i > 4: await page.keyboard.press("Enter")
        await report(page, "L9 summit")
        await load(page, 10)
        for i in range(30):
            await gwait(page, 0.6)
            if i == 1: await page.screenshot(path="out/cc_l10intro.png")
            if not await page.evaluate("() => store.getState().letterbox"): break
            if i % 2: await page.keyboard.press("Enter")
        await report(page, "L10 intro")
        await load(page, 10, 1)
        for i in range(30):
            await gwait(page, 0.6)
            if i == 1: await page.screenshot(path="out/cc_l10phase.png")
            if i > 2 and not await page.evaluate("() => store.getState().letterbox"): break
            if i % 2 and i > 2: await page.keyboard.press("Enter")
        await report(page, "L10 phase cutscene")
        # The whole ending, shot by shot.
        # The real flow: the last stand (phase 4) is won, then the defeat and the ending play.
        await load(page, 10, 4)
        for i in range(20):
            await gwait(page, 0.6)
            if i > 2 and not await page.evaluate("() => store.getState().letterbox"): break
            if i % 2 and i > 2: await page.keyboard.press("Enter")
        await page.evaluate("() => { const e = game.enemies.elves.find(e => e.alive && e.tuning.boss); game.enemies.hit(e, 9999, e.body.position, 'bullet', 0); }")
        for i in range(90):
            await gwait(page, 0.5)
            if i % 3 == 0: await page.screenshot(path=f"out/cc_l10end_{i // 3:02d}.png")
            if i > 4 and not await page.evaluate("() => store.getState().letterbox"): break
            if await page.evaluate("() => !!store.getState().dialogue") and i % 3 == 2: await page.keyboard.press("Enter")
        await report(page, "L10 ending")
        await b.close()
asyncio.run(main())
