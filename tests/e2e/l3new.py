import asyncio, math
from playwright.async_api import async_playwright
from level4 import until, READY, URL
from issues import gwait, load, skip_cutscene, check, results
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await b.new_page(viewport={"width":1280,"height":720})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(URL); await until(page, READY)
        await load(page, 3); await skip_cutscene(page)
        await gwait(page, 1)
        await page.screenshot(path="out/l3n_01_top.png")
        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        await gwait(page, 0.8)
        obj = await page.evaluate("() => [store.getState().objective, !!game.objectiveScreen()]")
        check("L3: after the SMG, objective = jump in the tube, with a waypoint", "tube" in obj[0] and obj[1], str(obj))
        await page.evaluate("() => { const z = 98, x = 8 * Math.sin(z * 0.035); game.player.body.position.set(x, game.physics.floorAt(x, z), z); }")
        await until(page, "() => store.getState().riding", 20)
        # Steering: hold D (right) for 1.5 s: Santa faces -z, so his right is world -x.
        x0 = await page.evaluate("() => game.player.body.position.x - 8 * Math.sin(game.player.body.position.z * 0.035)")
        await page.evaluate("() => window.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyD'}))")
        await gwait(page, 1.0)
        x1 = await page.evaluate("() => game.player.body.position.x - 8 * Math.sin(game.player.body.position.z * 0.035)")
        await page.evaluate("() => window.dispatchEvent(new KeyboardEvent('keyup', {code: 'KeyD'}))")
        check("L3: D steers to Santa's right (world -x)", x1 < x0 - 1.5, f"offset {x0:.1f} -> {x1:.1f}")
        await page.screenshot(path="out/l3n_02_slide.png")
        speeds = []
        t0 = await page.evaluate("() => game.time")
        while await page.evaluate("() => store.getState().riding"):
            speeds.append(await page.evaluate("() => Math.hypot(game.player.body.velocity.x, game.player.body.velocity.z)"))
            await asyncio.sleep(0.4)
        t1 = await page.evaluate("() => game.time")
        check("L3: tube speed is calmer (max ≤ 12.5 m/s)", max(speeds) <= 12.5, f"max {max(speeds):.1f}, avg {sum(speeds)/len(speeds):.1f}")
        check("L3: the run is longer (≥ 14 s)", t1 - t0 >= 14, f"{t1 - t0:.1f} s")
        cp = await page.evaluate("() => game.level.checkpoint")
        check("L3: bottom checkpoint saved after the run", cp == 1)
        for _ in range(12):
            await page.evaluate("() => game.enemies.elves.filter(e => e.alive && !e.perched).forEach(e => game.enemies.hit(e, 99, e.body.position, 'bullet', 1))")
            await gwait(page, 1)
            if "cercle" in (await page.evaluate("() => store.getState().objective")): break
        obj = await page.evaluate("() => [store.getState().objective, !!game.objectiveScreen()]")
        check("L3: lift objective is clear (gold circle) with a waypoint", "cercle" in obj[0] and obj[1], str(obj))
        await page.evaluate("() => { game.player.body.position.set(20, game.physics.floorAt(20, -68), -68); game.camRig.yaw = 0.6; }")
        await gwait(page, 0.8)
        await page.screenshot(path="out/l3n_03_bottom_station.png")
        await page.evaluate("() => { game.player.body.position.set(26, game.physics.floorAt(26, -66) + 0.1, -66); game.player.body.velocity.setAll(0); }")
        await gwait(page, 1)
        seated = await page.evaluate("() => game.player.seated")
        check("L3: standing on the pad seats Santa on a chair", seated)
        await gwait(page, 6)
        await page.screenshot(path="out/l3n_04_lift_ride.png")
        z1 = await page.evaluate("() => game.player.body.position.z")
        check("L3: the chair carries Santa up the hill", z1 > -40, f"z {z1:.1f}")
        for _ in range(40):
            await gwait(page, 1)
            if not await page.evaluate("() => game.player.seated"): break
        top = await page.evaluate("() => [game.player.seated, game.player.body.position.z, game.level.checkpoint, store.getState().objective]")
        check("L3: dropped off at the top station, checkpoint saved, exit objective", (not top[0]) and top[1] > 90 and top[2] == 2 and "chemin" in top[3], str(top))
        await gwait(page, 1.5)
        await page.screenshot(path="out/l3n_05_top_station.png")
        # Slide again from the tube rack
        await page.evaluate("() => { const z = 98, x = 8 * Math.sin(z * 0.035); game.player.body.position.set(x, game.physics.floorAt(x, z) + 0.1, z); }")
        r = await until(page, "() => store.getState().riding", 10)
        check("L3: you can slide again from the top", r)
        await page.evaluate("() => { const pl = game.player; pl.body.position.z = -64; }")
        await until(page, "() => !store.getState().riding", 15)
        obj = await page.evaluate("() => store.getState().objective")
        check("L3: after a replay, the objective says to take the lift back", "télésiège" in obj, obj)
        # Station sits in the ground: plinth bottom below the lowest terrain around it
        ok = await page.evaluate("""() => { const ms = game.levelRoot.getChildren(n => n.name === 'plinth', true);
          return ms.map(m => { const bb = m.getBoundingInfo().boundingBox; let lo = 1e9;
            for (const dx of [-2.6, 0, 2.6]) for (const dz of [-2.1, 0, 2.1]) lo = Math.min(lo, game.physics.floorAt(m.position.x + dx, m.position.z + dz));
            return bb.minimumWorld.y < lo; }); }""")
        check("L3: both lift stations are buried in the ground (no gap under)", len(ok) == 2 and all(ok), str(ok))
        check("No page errors", not errors, "; ".join(errors[:3]))
        print(f"\n{sum(1 for r in results if r[1])}/{len(results)} passed")
        await b.close()
asyncio.run(main())
