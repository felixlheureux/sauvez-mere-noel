import asyncio, json
from playwright.async_api import async_playwright
from level4 import until, READY, URL
from level5 import gwait
JS = """async ([vx, vz]) => {
  const g = game, b = g.player.body;
  // gift at (-12.6,-9.5) size 1.6 x 1.4 high in Level 1
  b.position.set(-12.6, 1.4, -9.5); b.velocity.setAll(0);
  await new Promise(r => setTimeout(r, 300));
  const track = []; let maxJump = 0; let prev = b.position.clone();
  for (let i = 0; i < 40; i++) {
    b.velocity.x = vx; b.velocity.z = vz;
    g.physics.move(b, 1/60);
    const d = Math.hypot(b.position.x - prev.x, b.position.z - prev.z);
    maxJump = Math.max(maxJump, d); prev = b.position.clone();
    b.velocity.y -= 28/60;
  }
  return {maxJump: +maxJump.toFixed(3), expected: +(Math.hypot(vx,vz)/60).toFixed(3), end: b.position.toString()};
}"""
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await br.new_page(viewport={"width":1024,"height":576})
        await page.goto(URL); await until(page, READY)
        await page.evaluate("() => game.loadLevel(1)")
        await until(page, "() => store.getState().screen === 'playing'")
        await gwait(page, 1)
        await page.evaluate("() => { game.player.frozen = true; }")
        for v in [(5, -0.6), (5, 0.6), (-5, 0.4), (0.5, 5), (0.4, -5), (4, 4), (-4, -4)]:
            print(v, await page.evaluate(JS, list(v)))
        # dash into the rink boards in level 5
        await page.evaluate("() => game.loadLevel(5, 1)")
        await until(page, "() => store.getState().screen === 'playing'")
        await gwait(page, 1)
        r = await page.evaluate("""() => { const g = game, b = g.player.body; g.player.frozen = true;
          b.position.set(0, 0, 9.5); b.velocity.setAll(0);
          // board segment near (26*cos, ...) : run west->east into the east boards at z=22
          b.position.set(22, 0, 22);
          for (let i=0;i<30;i++){ b.velocity.x = 33; b.velocity.z = 0; g.physics.move(b, 1/30); }
          return b.position.toString(); }""")
        print("dash into boards ->", r)
        await br.close()
asyncio.run(main())
