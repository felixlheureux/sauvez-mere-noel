"""Loading bar: the candy stripes scroll continuously while the bar fills — the stripe
animation never restarts when the progress changes (it used to jump back each step)."""
import asyncio
from playwright.async_api import async_playwright
from issues import check, results, URL

SAMPLE = """() => { const el = document.querySelector('.candy-scroll'); if (!el) return null;
  const a = el.getAnimations()[0]; return {t: a ? a.currentTime : null, w: el.parentElement.getBoundingClientRect().width,
    running: a ? a.playState : null}; }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"])
        page = await b.new_page(viewport={"width": 1280, "height": 720})
        await page.goto(URL)
        samples = []
        for _ in range(200):
            s = await page.evaluate(SAMPLE)
            if s: samples.append(s)
            elif samples: break
            await asyncio.sleep(0.05)
            if len(samples) == 6: await page.screenshot(path="out/loading.png")
        widths = [s["w"] for s in samples]
        times = [s["t"] for s in samples if s["t"] is not None]
        grew = len(set(round(w) for w in widths)) >= 3
        steady = all(t2 >= t1 for t1, t2 in zip(times, times[1:]))
        check("The loading bar fills in steps", grew, f"widths {sorted(set(round(w) for w in widths))}")
        check("…and its stripes keep scrolling without ever restarting", steady and len(times) > 5 and samples[0]["running"] == "running", f"{len(times)} samples, first {times[:3]}, last {times[-2:]}")
        await b.close()
    print(f"{sum(ok for _, ok, _ in results)}/{len(results)} passed")

if __name__ == "__main__":
    asyncio.run(main())
