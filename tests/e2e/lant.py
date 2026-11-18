import asyncio
from playwright.async_api import async_playwright
from level4 import until, READY, URL
from level5 import gwait
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await b.new_page(viewport={"width":1024,"height":576})
        await page.goto(URL); await until(page, READY)
        await page.evaluate("() => game.loadLevel(2)")
        await until(page, "() => store.getState().screen === 'playing'")
        await gwait(page, 3)
        r = await page.evaluate("""async () => { const g = game; const e = g.engine;
          const count = () => Object.keys(e._compiledEffects || {}).length;
          const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          await raf2(); let t0 = performance.now(); await raf2(); const base = performance.now() - t0;
          const c0 = count();
          t0 = performance.now(); g.level.lightLantern(g.level.lanterns[0]); await raf2(); const lit = performance.now() - t0;
          const c1 = count();
          t0 = performance.now(); g.level.lightLantern(g.level.lanterns[1]); await raf2(); const lit2 = performance.now() - t0;
          return {base: Math.round(base), lit: Math.round(lit), lit2: Math.round(lit2), effectsBefore: c0, effectsAfter: c1, effectsAfter2: count()}; }""")
        print(r)
        await b.close()
asyncio.run(main())
