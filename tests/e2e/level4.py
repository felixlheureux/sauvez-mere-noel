import asyncio
from playwright.async_api import async_playwright
URL = "http://localhost:5173/?low"
OUT = "out"
READY = "() => window.store && store.getState().screen === 'title' && window.game && typeof game.loadLevel === 'function'"
async def until(page, js, timeout=60, step=0.4):
    t = 0
    while t < timeout:
        try:
            if await page.evaluate(js): return True
        except Exception: pass
        await asyncio.sleep(step); t += step
    return False
async def tp(page, x, z, yaw=None):
    await page.evaluate(f"() => {{ const p = game.player.body; p.position.set({x}, game.physics.floorAt({x},{z}) + 0.05, {z}); p.velocity.setAll(0); {'' if yaw is None else f'game.player.yaw={yaw}; game.camRig.yaw={yaw};'} }}")
async def dialogue(page, n=10):
    for _ in range(n):
        if await page.evaluate("() => store.getState().dialogue !== null"):
            await page.keyboard.press("Enter")
        await asyncio.sleep(0.6)
KILL = "() => { const g=game; g.enemies.elves.filter(e=>e.alive && !e.dormant).forEach(e => g.enemies.hit(e, 99, g.player.body.position, 'bullet', 3)); }"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await b.new_page(viewport={"width":1024,"height":576})
        logs=[]
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}") if m.type=="error" else None)
        page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        await page.goto(URL)
        await until(page, READY)
        await page.evaluate("() => game.loadLevel(4)")
        await until(page, "() => store.getState().screen === 'playing'")
        await asyncio.sleep(3)
        await page.screenshot(path=f"{OUT}/l4a_start.png")
        print("weapons start", await page.evaluate("() => JSON.stringify(store.getState().weapons)"))
        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        print("flamer", await until(page, "() => store.getState().weapon === 'flamer'", 15))
        await dialogue(page, 4)
        # flamer test: an elf in front, standing in syrup
        await tp(page, 5*__import__('math').sin(-54*0.06), -60, 0)
        await asyncio.sleep(0.5)
        r = await page.evaluate("""async () => {
          const g = game; const P = g.player.body.position;
          const e = g.enemies.spawn(P.add(new P.constructor(0,0,4)), {});
          g.camRig.yaw = 0; g.player.yaw = 0;
          const hp0 = e.hp;
          for (let i=0;i<20;i++){ g.player.fire('flamer'); await new Promise(r=>setTimeout(r,60)); }
          const lv = g.level;
          return {hp0, hp: e.hp, alive: e.alive, burn: +e.burnTime.toFixed(2), syrupBurning: lv.syrup.map(s=>+s.burning.toFixed(1))};
        }""")
        print("flame", r)
        await page.screenshot(path=f"{OUT}/l4b_flame.png")
        await page.evaluate(KILL)
        # trigger grove packs
        await tp(page, 5*__import__('math').sin(-62*0.06), -62, 0)
        await asyncio.sleep(1.5)
        await tp(page, 5*__import__('math').sin(-44*0.06), -44, 0)
        await asyncio.sleep(3)
        print("grove enemies", await page.evaluate("() => game.enemies.elves.filter(e=>e.alive).map(e=>e.tuning.kind+(e.perched?'*':''))"))
        await page.screenshot(path=f"{OUT}/l4c_grove.png")
        await asyncio.sleep(5)
        print("projectiles", await page.evaluate("() => game.projectiles.list ? game.projectiles.list.length : Object.keys(game.projectiles)"), "hp", await page.evaluate("() => game.player.hp"))
        await page.evaluate(KILL)
        await asyncio.sleep(1)
        await page.evaluate(KILL)
        await tp(page, 5*__import__('math').sin(-24*0.06), -24, 0)
        await until(page, "() => game.level.checkpoint === 1", 10)
        print("cp", await page.evaluate("() => game.level.checkpoint"), "resume", await page.evaluate("() => JSON.stringify(store.getState().progress.resume)"))
        await dialogue(page, 4)
        await tp(page, 0, -14, 0)
        await asyncio.sleep(4)
        await page.screenshot(path=f"{OUT}/l4d_yard.png")
        # cauldron knock-in test
        r = await page.evaluate("""() => {
          const g = game; const e = g.enemies.spawn(new g.player.body.position.constructor(-7, 0, -4.3), {});
          e.knock.set(0, 0, 8);
          return e.alive;
        }""")
        await asyncio.sleep(0.5)
        print("cauldron kill (should be 0 alive cauldron elf)", await page.evaluate("() => game.enemies.elves.filter(e=>e.alive && Math.hypot(e.body.position.x+7, e.body.position.z+2)<3).length"))
        for i in range(40):
            await asyncio.sleep(2.5)
            if i == 3: await page.screenshot(path=f"{OUT}/l4e_wave.png")
            o = await page.evaluate("() => store.getState().objective")
            await page.evaluate(KILL)
            await dialogue(page, 1)
            if o and "cabane" in o: break
        print("objective", await page.evaluate("() => store.getState().objective"), "hp", await page.evaluate("() => game.player.hp"))
        await page.evaluate("() => { game.player.hp = 100; }")
        await tp(page, 0, 22, 0)
        await until(page, "() => game.level.checkpoint === 2", 10)
        print("cp2", await page.evaluate("() => game.level.checkpoint"))
        await asyncio.sleep(1.5)
        await page.screenshot(path=f"{OUT}/l4f_door.png")
        await tp(page, 0, 27.6, 0)
        await asyncio.sleep(1.5)
        await page.screenshot(path=f"{OUT}/l4g_feast.png")
        await dialogue(page, 6)
        await asyncio.sleep(2)
        await page.screenshot(path=f"{OUT}/l4h_feastfight.png")
        for _ in range(4):
            await page.evaluate(KILL); await asyncio.sleep(1.5)
        print("objective", await page.evaluate("() => store.getState().objective"))
        await tp(page, 1.2, 31.5, -1.57)
        await tp(page, 2.8, 31.5, 1.57)
        await asyncio.sleep(2)
        await page.screenshot(path=f"{OUT}/l4i_evap.png")
        for _ in range(4):
            await page.evaluate(KILL); await asyncio.sleep(1.5)
        await dialogue(page, 2)
        print("objective", await page.evaluate("() => store.getState().objective"), "exit open", await page.evaluate("() => game.level.exit.open"))
        print("bells", await page.evaluate("() => [game.level.bellsFound, game.level.bellsTotal]"), "candies", await page.evaluate("() => [game.level.candiesFound, game.level.candiesTotal]"))
        await tp(page, 0, 18, 3.14)
        await asyncio.sleep(2)
        await page.screenshot(path=f"{OUT}/l4j_shack.png")
        await tp(page, -11.5, 20, 0)
        await asyncio.sleep(1)
        print("woodpile floor", await page.evaluate("() => game.physics.groundHeightAt(-11.5, 22.8, 50)"), "porch floor", await page.evaluate("() => game.physics.groundHeightAt(-5, 24.5, 50)"))
        print("\n".join(logs[-15:]))
        await b.close()
if __name__ == "__main__": asyncio.run(main())
