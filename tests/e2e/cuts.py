import asyncio
from playwright.async_api import async_playwright
from level4 import until, READY, URL
from level5 import gwait
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await b.new_page(viewport={"width":1024,"height":576})
        logs=[]
        page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        await page.goto(URL); await until(page, READY)
        await page.evaluate("() => game.loadLevel(0)")
        await until(page, "() => store.getState().screen === 'playing'")
        await gwait(page, 0.3)
        await page.evaluate("() => store.setState({dialogue:null})")
        await page.screenshot(path="out/cut1.png")
        await gwait(page, 4)
        await page.evaluate("() => store.setState({dialogue:null})")
        await page.screenshot(path="out/cut2.png")
        print("cam", await page.evaluate("() => game.camRig.camera.position.toString()"))
        for _ in range(10):
            if await page.evaluate("() => store.getState().letterbox"):
                await page.keyboard.press("Enter"); await asyncio.sleep(0.4)
        await gwait(page, 1)
        await page.evaluate("() => { game.level.starTaken = true; game.level.twist(); }")
        for i in range(6):
            await gwait(page, 1.5)
            await page.evaluate("() => store.setState({dialogue:null})")
            await page.screenshot(path=f"out/cut_tw{i}.png")
            if await page.evaluate("() => store.getState().letterbox"):
                await page.keyboard.press("Enter")
        print(logs)
        await b.close()
asyncio.run(main())
