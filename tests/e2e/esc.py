"""Esc opens and closes the pause menu; in Options, Esc closes only Options (still paused)."""
import asyncio
from playwright.async_api import async_playwright
from issues import check, gwait, load, results, skip_cutscene, until, URL, READY
S = "() => [store.getState().screen, !!document.querySelector('[role=dialog]')]"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"])
        page = await b.new_page(viewport={"width": 1024, "height": 576})
        await page.goto(URL); await until(page, READY)
        await load(page, 2); await skip_cutscene(page, 30); await gwait(page, 0.5)
        async def esc():
            await page.keyboard.press("Escape"); await asyncio.sleep(0.4); return await page.evaluate(S)
        check("Esc opens the pause menu", await esc() == ["paused", False])
        check("Esc closes the pause menu", await esc() == ["playing", False])
        await esc()
        await page.get_by_role("button", name="Options").click(); await asyncio.sleep(0.4)
        check("Esc in Options closes only Options", await esc() == ["paused", False])
        check("…and the next Esc resumes", await esc() == ["playing", False])

        # With a locked mouse (as in a real browser; headless can't lock, so simulate the
        # lock state and the pointerlockchange events Chrome sends).
        await page.evaluate("""() => { const I = game.input; window.__locked = false; window.__grabs = 0;
          Object.defineProperty(I, 'pointerLocked', {get: () => window.__locked, configurable: true});
          I.requestPointerLock = () => { window.__grabs++; }; window.__lock = (v) => { window.__locked = v; document.dispatchEvent(new Event('pointerlockchange')); }; }""")
        await page.evaluate("() => window.__lock(true)"); await asyncio.sleep(0.6)
        await page.evaluate("() => window.__lock(false)"); await asyncio.sleep(0.4)
        check("Locked: the Esc that frees the mouse opens the menu", await page.evaluate(S) == ["paused", False])
        grabs = await page.evaluate("() => window.__grabs")
        check("Esc closes the menu and stays closed (it doesn't grab the mouse back)", await esc() == ["playing", False] and await page.evaluate("() => window.__grabs") == grabs)
        t0 = await page.evaluate("() => game.time"); await asyncio.sleep(0.6); t1 = await page.evaluate("() => game.time")
        check("…and the game stays frozen until the mouse is grabbed again", t1 == t0, f"time {t0:.2f} -> {t1:.2f}")
        await page.keyboard.press("KeyW"); await asyncio.sleep(0.2)
        check("The next key press grabs the mouse", await page.evaluate("() => window.__grabs") > grabs)
        # Chrome bouncing a fresh lock (taken and dropped within a moment) must not reopen it.
        await page.evaluate("() => { window.__lock(true); setTimeout(() => window.__lock(false), 100); }"); await asyncio.sleep(0.6)
        check("A lock dropped right after it's taken doesn't pop the menu back", await page.evaluate(S) == ["playing", False])
        t0 = await page.evaluate("() => game.time"); await asyncio.sleep(0.5); t1 = await page.evaluate("() => game.time")
        check("Once the mouse is grabbed, the game runs again", t1 > t0 + 0.2, f"time {t0:.2f} -> {t1:.2f}")
        await page.evaluate("() => window.__lock(true)"); await asyncio.sleep(0.8)
        await page.evaluate("() => window.__lock(false)"); await asyncio.sleep(0.4)
        check("…but freeing the mouse later still opens the menu", await page.evaluate(S) == ["paused", False])
        await page.get_by_role("button", name="Reprendre").click(); await asyncio.sleep(0.4)
        check("The Reprendre button closes the menu and grabs the mouse", await page.evaluate(S) == ["playing", False] and await page.evaluate("() => window.__grabs") > grabs)
        await b.close()
    print(f"{sum(ok for _, ok, _ in results)}/{len(results)} passed")
if __name__ == "__main__":
    asyncio.run(main())
