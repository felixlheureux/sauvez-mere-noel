import asyncio, math
from playwright.async_api import async_playwright
from level4 import until, READY, URL
from level5 import gwait
FALL = """([x, y, z]) => { const g = game, b = g.player.body; g.player.frozen = true;
  b.position.set(x, y, z); b.velocity.setAll(0); b.grounded = false;
  for (let i = 0; i < 60; i++) { b.velocity.y -= 28/60; g.physics.move(b, 1/60); }
  return +b.position.y.toFixed(2); }"""
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await br.new_page(viewport={"width":1024,"height":576})
        await page.goto(URL); await until(page, READY)
        await page.evaluate("() => game.loadLevel(1)")
        await until(page, "() => store.getState().screen === 'playing'")
        await gwait(page, 0.5)
        # stall i=0: a = pi/9
        a = math.pi/9; x = math.cos(a)*13; z = math.sin(a)*13; yaw = math.atan2(-x, -z)
        def local(lx, lz): return [x + lx*math.cos(yaw) + lz*math.sin(yaw), 3.5, z - lx*math.sin(yaw) + lz*math.cos(yaw)]
        for lz in (0.3, 0.9, 1.5, -0.9):
            print("stall local z", lz, "->", await page.evaluate(FALL, local(0, lz)))
        await page.evaluate("() => game.loadLevel(0)")
        await until(page, "() => store.getState().screen === 'playing'")
        await gwait(page, 0.5)
        # workshop at (-17,3) rot pi/2; slope across world z; eave at z offset ~5.55
        for dz in (0, 2, 4, 5.3, 6.0):
            print("workshop dz", dz, "->", await page.evaluate(FALL, [-17, 12, 3 + dz]))
        await br.close()
asyncio.run(main())
