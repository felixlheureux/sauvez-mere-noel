import asyncio, json
from playwright.async_api import async_playwright
from issues import gwait, load, until, URL, READY
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await b.new_page(viewport={"width":1280,"height":720})
        await page.goto(URL); await until(page, READY)
        await page.evaluate("""() => { window.__cuts = []; const r = game.camRig; const o = r.cut.bind(r);
          r.cut = (p, t, d, s) => { const t0 = performance.now(); o(p, t, d, s); window.__cuts.push([+(performance.now()-t0).toFixed(1), [p.x,p.y,p.z].map(v=>+v.toFixed(1)), [r.shot.to.pos.x, r.shot.to.pos.y, r.shot.to.pos.z].map(v=>+v.toFixed(1))]); }; }""")
        await load(page, 0); await gwait(page, 1.0)
        await page.screenshot(path="out/start_cam.png")
        print(json.dumps(await page.evaluate("() => window.__cuts")))
        await b.close()
asyncio.run(main())
