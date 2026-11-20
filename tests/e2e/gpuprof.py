"""Real-GPU profile (run on a Mac: headless Chromium uses Metal). Full quality (no ?low),
Retina-sized window, frame rate uncapped so ms/frame is the true cost (Babylon's GPU
timer is unreliable on Metal). For each level: baseline, each suspect switched off
alone, then the baseline again (the difference between the two is the noise).
Usage: python gpuprof.py [levels...]"""
import asyncio, sys
from playwright.async_api import async_playwright
from issues import gwait, load, skip_cutscene, until, READY
URL = "http://localhost:5173/"
TOGGLES = {
    "base": ("", ""),
    "no glow": ("game.env.glow.isEnabled = false", "game.env.glow.isEnabled = true"),
    "no bloom": ("game.env.pipeline.bloomEnabled = false", "game.env.pipeline.bloomEnabled = true"),
    "no postfx": ("game.scene.postProcessesEnabled = false", "game.scene.postProcessesEnabled = true"),
    "no shadows": ("game.scene.shadowsEnabled = false", "game.scene.shadowsEnabled = true"),
    "no particles": ("game.scene.particlesEnabled = false", "game.scene.particlesEnabled = true"),
    "base again": ("", ""),
}
COMBAT = """async (gun) => { const g = game; const P = g.player.body.position; const V = P.constructor;
  const worst = []; const fps = []; const poll = setInterval(() => { worst.push(g.perf.worstMs); fps.push(g.perf.fps); }, 500);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.enemies.spawn(new V(P.x + Math.sin(a) * 6, P.y, P.z + Math.cos(a) * 6), {}); }
  for (let i = 0; i < 40; i++) { g.player.fire(gun); await new Promise(r => setTimeout(r, 100)); }
  for (const e of g.enemies.elves.filter(e => e.alive)) g.enemies.hit(e, 999, P, 'bullet', 3);
  await new Promise(r => setTimeout(r, 3000)); clearInterval(poll);
  return {worst: Math.max(...worst), minFps: Math.min(...fps)}; }"""
GUN = {0: "capgun", 1: "capgun", 2: "shotgun", 3: "smg", 4: "flamer", 5: "launcher", 6: "icicle", 7: "garland", 8: "crossbow", 9: "gatling", 10: "star"}
async def sample(page):
    await gwait(page, 1.6)
    rows = []
    for _ in range(6):
        await asyncio.sleep(0.55)
        rows.append(await page.evaluate("() => ({...game.perf})"))
    return {k: sum(r[k] for r in rows) / len(rows) for k in rows[0]}
async def main():
    # --quick: baseline and combat only (no per-effect toggles).
    quick = "--quick" in sys.argv
    levels = [int(a) for a in sys.argv[1:] if a != "--quick"] or list(range(11))
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu", "--disable-frame-rate-limit", "--disable-gpu-vsync"])
        page = await b.new_page(viewport={"width": 1470, "height": 956}, device_scale_factor=2)
        await page.goto(URL); await until(page, READY)
        print("GPU:", await page.evaluate("() => { const gl = game.engine._gl; const e = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(e.UNMASKED_RENDERER_WEBGL); }"))
        await page.evaluate("() => { store.setState(s => ({settings: {...s.settings, debug: true}})); game.applySettings(); game.adaptQuality = () => {}; }")
        for lvl in levels:
            await load(page, lvl)
            await skip_cutscene(page, 30)
            await page.evaluate("() => { game.player.hp = 1e6; }")
            print(f"\n== Level {lvl}")
            await gwait(page, 3)  # warm-up: shaders, first frames
            for name, (on, off) in TOGGLES.items():
                if quick and name != "base": continue
                if on: await page.evaluate(f"() => {{ {on}; }}")
                r = await sample(page)
                if off: await page.evaluate(f"() => {{ {off}; }}")
                print(f"  {name:13s} {1000 / r['fps']:5.2f} ms/frame ({r['fps']:5.0f} fps)  worst {r['worstMs']:5.1f} ms  logic {r['logicMs']:4.2f}  render(cpu) {r['renderMs']:5.2f}  draws {r['drawCalls']:4.0f}  meshes {r['meshes']:4.0f}")
            c = await page.evaluate(COMBAT, GUN[lvl])
            print(f"  combat ({GUN[lvl]}): min {c['minFps']:.1f} fps, worst frame {c['worst']:.1f} ms")
            await page.screenshot(path=f"out/gpuprof_l{lvl}.png")
        await b.close()
if __name__ == "__main__":
    asyncio.run(main())
