"""Measures the game's audio output (peak and RMS in dBFS) during a loud fight.
A tap on AudioContext.destination records the real mix the speakers get."""
import asyncio, math
from playwright.async_api import async_playwright
from issues import check, gwait, load, results, skip_cutscene, until, URL, READY
TAP = """(() => { const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = orig.call(this, dest, ...rest);
    if (dest instanceof AudioDestinationNode && !window.__tap) {
      const ctx = dest.context; const a = ctx.createAnalyser(); a.fftSize = 2048; orig.call(this, a);
      const buf = new Float32Array(a.fftSize); window.__tap = {peak: 0, sum: 0, n: 0};
      setInterval(() => { a.getFloatTimeDomainData(buf); let s = 0;
        for (const v of buf) { const x = Math.abs(v); if (x > window.__tap.peak) window.__tap.peak = x; s += v * v; }
        window.__tap.sum += s / buf.length; window.__tap.n++; }, 20); }
    return r; }; })()"""
FIGHT = """async () => { const g = game, P = g.player, V = P.body.position.constructor; P.hp = 1e6;
  for (const id of ['capgun', 'shotgun', 'smg', 'flamer', 'launcher']) P.giveGun(id, false);
  window.__tap.peak = 0; window.__tap.sum = 0; window.__tap.n = 0;
  for (const gun of ['smg', 'shotgun', 'launcher', 'capgun']) {
    for (let i = 0; i < 6; i++) { const a = i; g.enemies.spawn(new V(P.body.position.x + Math.sin(a) * 5, 0, P.body.position.z + Math.cos(a) * 5), {}); }
    for (let i = 0; i < 25; i++) { P.fire(gun); await new Promise(r => setTimeout(r, 80)); }
    for (const e of g.enemies.elves.filter(e => e.alive)) g.enemies.hit(e, 999, P.body.position, 'bullet', 3);
    await new Promise(r => setTimeout(r, 400)); }
  const t = window.__tap; return {peak: t.peak, rms: Math.sqrt(t.sum / Math.max(1, t.n))}; }"""
db = lambda x: 20 * math.log10(max(x, 1e-9))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu", "--autoplay-policy=no-user-gesture-required"])
        page = await b.new_page(viewport={"width": 1024, "height": 576})
        await page.add_init_script(TAP)
        await page.goto(URL); await until(page, READY)
        await page.mouse.click(512, 300)  # a user gesture unlocks the audio
        await load(page, 2); await skip_cutscene(page, 30)
        await until(page, "() => !!window.__tap", 10)
        r = await page.evaluate(FIGHT)
        print(f"fight: peak {db(r['peak']):.1f} dBFS, RMS {db(r['rms']):.1f} dBFS (default volume)")
        check("Never clips (peak below -1 dBFS)", db(r["peak"]) < -1, f"{db(r['peak']):.1f} dBFS")
        check("Comfortable loudness (RMS below -20 dBFS)", db(r["rms"]) < -20, f"{db(r['rms']):.1f} dBFS")
        await b.close()
if __name__ == "__main__":
    asyncio.run(main())
