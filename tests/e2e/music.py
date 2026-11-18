"""Music comes in waves: two passes of a carol, then a 20–30 s rest (not an endless loop).
Logs every scheduled oscillator start, standing idle in level 0 (no combat SFX)."""
import asyncio
from playwright.async_api import async_playwright
from issues import check, gwait, load, results, skip_cutscene, until, URL, READY
LOG = """(() => { const o = AudioScheduledSourceNode.prototype.start; window.__starts = [];
  AudioScheduledSourceNode.prototype.start = function (when, ...r) {
    if (this instanceof OscillatorNode && this.type === 'sine' && this.frequency.value > 400) window.__starts.push(when || this.context.currentTime);
    return o.call(this, when, ...r); }; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu", "--autoplay-policy=no-user-gesture-required"])
        page = await b.new_page(viewport={"width": 1024, "height": 576})
        await page.add_init_script(LOG)
        await page.goto(URL); await until(page, READY)
        await page.mouse.click(512, 300)  # empty spot: a user gesture unlocks the audio
        await load(page, 0); await skip_cutscene(page, 30)
        await page.evaluate("() => { window.__starts.length = 0; }")
        await asyncio.sleep(70)
        t = sorted(set(round(x, 2) for x in await page.evaluate("() => window.__starts")))
        gaps = [(round(a), round(b - a, 1)) for a, b in zip(t, t[1:]) if b - a > 8]
        print(f"{len(t)} music notes over {t[-1] - t[0]:.0f} s; silent gaps (start, length): {gaps}")
        check("Music rests for 20 s or more between waves", any(g >= 19 for _, g in gaps), str(gaps))
        await b.close()
    print(f"{sum(ok for _, ok, _ in results)}/{len(results)} passed")
if __name__ == "__main__":
    asyncio.run(main())
