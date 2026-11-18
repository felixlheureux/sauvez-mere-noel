import asyncio
from playwright.async_api import async_playwright
from level4 import until, READY, URL
from level5 import gwait
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await b.new_page(viewport={"width":1024,"height":576})
        logs=[]
        page.on("console", lambda m: logs.append(m.text) if m.type in ("warning","error") else None)
        page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        await page.goto(URL); await until(page, READY)
        for lvl in range(6):
            logs.clear()
            await page.evaluate(f"() => game.loadLevel({lvl})")
            await until(page, "() => store.getState().screen === 'playing'")
            await gwait(page, 0.5)
            issues = await page.evaluate("() => game.level.audit()")
            print(f"=== L{lvl}: {len(issues)} issues")
            for i in issues: print("  ", i)
            for l in logs:
                if "layout" in l or "pageerror" in l or "Error" in l: print("  LOG", l)
        await b.close()
asyncio.run(main())
