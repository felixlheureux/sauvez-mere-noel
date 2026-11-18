import asyncio
from playwright.async_api import async_playwright
from level4 import until, READY, URL
from issues import gwait, load, skip_cutscene
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await b.new_page(viewport={"width":1280,"height":720})
        await page.goto(URL); await until(page, READY)
        await load(page, 1); await skip_cutscene(page)
        r = await page.evaluate("""async () => {
              const g = game, b = g.player.body; b.position.set(-4, 0, -12); b.velocity.setAll(0);
              const log = []; const orig = g.player.update.bind(g.player);
              g.player.update = (dt) => { orig(dt); log.push([+g.time.toFixed(2), +b.position.y.toFixed(2), +b.velocity.y.toFixed(2), g.player.jumpsUsed, g.player.launched, g.input.isHeld('jump'), +dt.toFixed(3)]); };
              const until = async (t) => { const t0 = g.time; while (g.time - t0 < t) await new Promise(r => setTimeout(r, 5)); };
              const key = (type) => window.dispatchEvent(new KeyboardEvent(type, {code: 'Space', key: ' '}));
              await until(0.3); key('keydown'); await until(0.28); key('keyup'); await until(0.02); key('keydown');
              await until(1.2); key('keyup'); g.player.update = orig; return log; }""")
        for row in r: print(row)
        await b.close()
asyncio.run(main())
