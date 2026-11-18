import asyncio, re
from playwright.async_api import async_playwright
from level4 import until, READY, URL
from issues import gwait, load, skip_cutscene
src = open('issues.py').read()
gun_js = re.search(r't = await page.evaluate\("""(.*?)""", \[gun, dist\]\)', src, re.S).group(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await b.new_page(viewport={"width":1280,"height":720})
        await page.goto(URL); await until(page, READY)
        await load(page, 1); await skip_cutscene(page)
        await page.evaluate("() => { game.player.setArsenal(['capgun','shotgun','smg','flamer','launcher']); }")
        for gun, dist in [("capgun", 7), ("shotgun", 4), ("smg", 9), ("flamer", 4), ("launcher", 9)]:
            t = await page.evaluate(gun_js, [gun, dist])
            print(gun, round(t, 2))
        await b.close()
asyncio.run(main())
