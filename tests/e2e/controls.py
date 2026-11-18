"""Controls panel: same width collapsed/expanded, and no label is clipped or wrapped, even mid-animation."""
import asyncio
from playwright.async_api import async_playwright
from issues import check, gwait, load, results, skip_cutscene, until, URL, READY
SAMPLE = """async () => { const ul = () => [...document.querySelectorAll('ul')].find(u => u.textContent.includes('Marcher'));
  const panel = document.querySelector('ul') ? ul().parentElement : null; const widths = new Set(); let clipped = [];
  const take = () => { widths.add(Math.round(panel.getBoundingClientRect().width)); const u = ul(); if (!u) return;
    for (const li of u.children) { const spans = li.querySelectorAll('span'); const label = spans[spans.length - 1];
      if (label.scrollWidth > label.clientWidth + 1 || label.getClientRects().length > 1 || li.scrollWidth > li.clientWidth + 1) clipped.push(li.textContent); } };
  for (const step of [0, 1]) { panel.click(); for (let i = 0; i < 25; i++) { take(); await new Promise(r => setTimeout(r, 30)); } }
  return {widths: [...widths], clipped: [...new Set(clipped)]}; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"])
        page = await b.new_page(viewport={"width": 1280, "height": 800})
        await page.goto(URL); await until(page, READY)
        await load(page, 2); await skip_cutscene(page, 30); await gwait(page, 1)
        r = await page.evaluate(SAMPLE)
        check("Controls panel keeps one width while opening/closing", len(r["widths"]) == 1, str(r["widths"]))
        check("No control label clipped or wrapped, even mid-animation", not r["clipped"], str(r["clipped"][:3]))
        # The pause menu lists the controls too: no wrapping there either, on a laptop or a small window.
        for vw, vh in ((1280, 800), (1024, 640)):
            await page.set_viewport_size({"width": vw, "height": vh})
            await page.keyboard.press("Escape"); await asyncio.sleep(0.6)
            bad = await page.evaluate("""() => { const card = [...document.querySelectorAll('ul')].find(u => u.textContent.includes('Marcher') && u.closest('[class*=bg-muted]'));
              if (!card) return ['no menu list'];
              return [...card.children].filter(li => { const spans = li.querySelectorAll(':scope > span'); const label = spans[spans.length - 1];
                return label.getClientRects().length > 1 || label.scrollWidth > label.clientWidth + 1 || li.scrollWidth > li.clientWidth + 1 || li.getBoundingClientRect().height > 34; }).map(li => li.textContent); }""")
            await page.screenshot(path=f"out/pause_controls_{vw}.png")
            check(f"Pause menu ({vw}×{vh}): no control label wraps or clips", not bad, str(bad[:3]))
            await page.keyboard.press("Escape"); await asyncio.sleep(0.4)
        await b.close()
    print(f"{sum(ok for _, ok, _ in results)}/{len(results)} passed")
if __name__ == "__main__":
    asyncio.run(main())
