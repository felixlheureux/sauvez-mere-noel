import asyncio
from playwright.async_api import async_playwright
from level4 import until, READY, URL
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await b.new_page(viewport={"width":1280,"height":720})
        await page.goto(URL); await until(page, READY)
        await asyncio.sleep(2)
        await page.evaluate("() => store.getState().setSettings({ debug: true })")
        await page.get_by_text("Options", exact=True).click()
        await asyncio.sleep(1.5)
        await page.screenshot(path="out/iss_10_debug_options.png")
        # Debug mode: one button per level (no checkpoint buttons), the newest included.
        btn = page.get_by_role("button", name="6 · Toits")
        print("buttons", await btn.count())
        await btn.first.click()
        ok = await until(page, "() => store.getState().screen === 'playing' && game.level.id === 6", 20)
        print(("PASS" if ok else "FAIL") + " Options → Mode test → '6 · Toits' starts level 6")
        await b.close()
if __name__ == "__main__":
    asyncio.run(main())
