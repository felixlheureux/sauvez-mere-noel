"""Today's fixes: slide candies on the jump arc, free aim on the tube, objectives that count
when you've run past them, title-screen music, and the reworked sound effects."""
import asyncio
from playwright.async_api import async_playwright
from issues import check, gwait, load, results, skip_cutscene, until, URL, READY


async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu", "--autoplay-policy=no-user-gesture-required"])
        page = await br.new_page(viewport={"width": 1280, "height": 720})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(URL); await until(page, READY)

        # Title music starts with the first click on the title screen.
        before = await page.evaluate("() => sound.musicTimer !== null")
        await page.mouse.click(5, 5)
        await gwait(page, 0.5)
        after = await page.evaluate("() => sound.musicTimer !== null")
        check("Title screen: the carol starts on the first click", not before and after, f"before {before}, after {after}")

        # Every reworked sound plays without errors.
        await page.evaluate("""() => {
          for (const f of ['capGun', 'shotgun', 'smg', 'launcher', 'icicle', 'twang', 'zap', 'flame', 'explosion', 'hurt', 'hit', 'splat']) sound[f](); }""")
        await gwait(page, 0.5)

        # Level 3: ride the tube with no input; the ramp candies are on the arc you fly.
        await load(page, 3); await skip_cutscene(page)
        await page.evaluate("() => { game.player.invuln = 1e6; game.player.hp = 1e6; const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        await gwait(page, 0.8)
        await page.evaluate("() => { const z = 98, x = 8 * Math.sin(z * 0.035); game.player.body.position.set(x, game.physics.floorAt(x, z), z); }")
        await until(page, "() => store.getState().riding", 20)
        # Free aim: turn the camera 90° with the mouse; it stays there while you aim.
        await gwait(page, 1)
        await page.evaluate("() => { window.__yaw0 = game.camRig.yaw; game.camRig.look(1.5, 0); }")
        await gwait(page, 1)
        held = await page.evaluate("() => Math.abs(game.camRig.yaw - window.__yaw0)")
        check("Slide: the camera stays where the mouse aimed it (no pull back to the front)", held > 1.3, f"{held:.2f} rad off the run (aimed 1.5)")
        await gwait(page, 3)
        back = await page.evaluate("() => Math.abs(Math.atan2(Math.sin(game.camRig.yaw - Math.atan2(game.player.body.velocity.x, game.player.body.velocity.z)), Math.cos(game.camRig.yaw - Math.atan2(game.player.body.velocity.x, game.player.body.velocity.z))))")
        check("Slide: with the mouse left alone, the camera follows the run again", back < 0.5, f"{back:.2f} rad off the run")
        while await page.evaluate("() => store.getState().riding"):
            await asyncio.sleep(0.3)
        r = await page.evaluate("""() => { const lips = [78, 52, 26, 0, -28];
          const arc = game.level.pickups.filter(p => /^candy/.test(p.mesh.name) && lips.some(l => p.pos.z < l && p.pos.z > l - 8.5 && Math.abs(p.pos.x) < 15));
          return {arc: arc.length, got: arc.filter(p => p.collected).length}; }""")
        check("Slide: riding straight down collects the ramp candies", r["arc"] > 0 and r["got"] >= r["arc"] - 1, str(r))

        # Level 6: jump ahead past the next roof; the objective still moves on.
        await load(page, 6); await skip_cutscene(page, 30)
        await page.evaluate("() => { game.player.invuln = 1e6; game.player.hp = 1e6; }")
        obj = await page.evaluate("async () => (await import('/src/i18n/fr-QC.ts')).OBJ")
        await until(page, f"() => store.getState().objective === {obj['getIcicle']!r}", 30)
        await gwait(page, 0.3)
        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        for _ in range(10): await page.keyboard.press("Enter"); await asyncio.sleep(0.3)
        await until(page, f"() => store.getState().objective === {obj['crossRoofs']!r}", 20)
        # Straight onto A4, skipping A3 (which the script waits on first).
        await page.evaluate("() => { game.player.body.position.set(0, 7.45, -20); game.player.body.velocity.setAll(0); }")
        ok = await until(page, f"() => store.getState().objective === {obj['crossPlank']!r}", 5)
        cur = await page.evaluate("() => store.getState().objective")
        check("Rooftops: skipping a roof still counts it (no walking back)", cur == obj["crossPlank"], cur)

        check("No page errors", not errors, str(errors[:3]))
        await br.close()
    print(f"\n{sum(ok for _, ok, _ in results)}/{len(results)} passed")


if __name__ == "__main__":
    asyncio.run(main())
