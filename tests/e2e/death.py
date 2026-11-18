"""Santa bursts into gore when he dies, and comes back whole on retry. Screenshots: out/death_*.png"""
import asyncio
from playwright.async_api import async_playwright
from issues import check, gwait, load, results, skip_cutscene, until, URL, READY

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"])
        page = await b.new_page(viewport={"width": 1024, "height": 576})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(URL); await until(page, READY)
        await load(page, 2); await skip_cutscene(page, 30); await gwait(page, 0.5)
        gibs0 = await page.evaluate("() => game.gore.gibs.length")
        await page.evaluate("() => { const P = game.player; P.invuln = 0; P.hurt(999, P.body.position.add(new P.body.position.constructor(0, 0, 2))); }")
        await gwait(page, 0.25)
        await page.screenshot(path="out/death_1_burst.png")
        r = await page.evaluate("() => ({dead: game.player.dead, rigHidden: !game.player.rig.root.isEnabled(), gibs: game.gore.gibs.length})")
        check("Death: Santa's body is replaced by flying gibs", r["dead"] and r["rigHidden"] and r["gibs"] - gibs0 >= 8, str(r))
        await gwait(page, 1.0)
        await page.screenshot(path="out/death_2_after.png")
        await until(page, "() => store.getState().screen === 'gameOver'", 10)
        await page.evaluate("() => game.retryFromCheckpoint()")
        await until(page, "() => store.getState().screen === 'playing'", 10)
        await gwait(page, 0.5)
        r = await page.evaluate("() => ({dead: game.player.dead, rigShown: game.player.rig.root.isEnabled(), hp: game.player.hp})")
        check("Retry: Santa is back in one piece", not r["dead"] and r["rigShown"] and r["hp"] > 0, str(r))
        check("No page errors", not errors, str(errors[:2]))
        await b.close()
    print(f"{sum(ok for _, ok, _ in results)}/{len(results)} passed")

if __name__ == "__main__":
    asyncio.run(main())
