import asyncio, math
from playwright.async_api import async_playwright
from level4 import until, READY, URL, tp, dialogue
OUT = "out"
async def gwait(page, sec):
    await page.evaluate("t => new Promise(r => { const t0 = game.time; const id = setInterval(() => { if (game.time - t0 >= t) { clearInterval(id); r(); } }, 100); })", sec)
async def gdialogue(page, sec):
    t0 = await page.evaluate("() => game.time")
    while (await page.evaluate("() => game.time")) - t0 < sec:
        if await page.evaluate("() => store.getState().dialogue !== null"):
            await page.keyboard.press("Enter")
        await asyncio.sleep(0.5)
KILL = "() => { const g=game; g.enemies.elves.filter(e=>e.alive && !e.dormant).forEach(e => g.enemies.hit(e, 99, g.player.body.position, 'bullet', 3)); }"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await b.new_page(viewport={"width":1024,"height":576})
        logs=[]
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}") if m.type=="error" else None)
        page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        await page.goto(URL); await until(page, READY)
        await page.evaluate("() => game.loadLevel(5)")
        await until(page, "() => store.getState().screen === 'playing'")
        await asyncio.sleep(3)
        await page.screenshot(path=f"{OUT}/l5a_start.png")
        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        print("launcher", await until(page, "() => store.getState().weapon === 'launcher'", 15))
        await dialogue(page, 6)
        # launcher test on an elf ahead
        r = await page.evaluate("""async () => {
          const g = game; g.camRig.yaw = 0; g.player.yaw = 0; await new Promise(r=>setTimeout(r,400));
          const P = g.player.body.position;
          const f = g.camRig.forward; f.y = 0; f.normalize();
          const e = g.enemies.spawn(P.add(f.scale(9)), {});
          await new Promise(r=>setTimeout(r,300));
          g.player.fire('launcher');
          await new Promise(r=>setTimeout(r,2500));
          return {alive: e.alive, hp: e.hp, playerHp: g.player.hp};
        }""")
        print("launcher hit", r)
        await page.screenshot(path=f"{OUT}/l5b_launch.png")
        # puck test: skater nearby
        r = await page.evaluate("""async () => {
          const g = game; g.player.hp = 100;
          const P = g.player.body.position.clone();
          const { ELF_SKATER } = await import('/src/enemies/Elf.ts');
          const e = g.enemies.spawn(P.add(new P.constructor(0,0,12)), {tuning: ELF_SKATER});
          e.aggro = true; e.setState('chase');
          await new Promise(r=>setTimeout(r,6000));
          return {hp: g.player.hp, kind: e.tuning.kind, alive: e.alive};
        }""")
        print("puck", r)
        await page.screenshot(path=f"{OUT}/l5c_skater.png")
        await page.evaluate(KILL)
        # cracking ice
        await page.evaluate("() => { game.player.hp = 100; }")
        await tp(page, 0, -62, 0)
        await gwait(page, 2.5)
        r = await page.evaluate("() => ({hp: game.player.hp, pos: game.player.body.position.toString(), broken: game.level.cracks[0].broken})")
        print("crack", r)
        await page.screenshot(path=f"{OUT}/l5d_crack.png")
        # walk triggers
        for z in (-74, -52, -38):
            await tp(page, 0, z, 0); await asyncio.sleep(2)
        await page.screenshot(path=f"{OUT}/l5e_lake.png")
        print("lake enemies", await page.evaluate("() => game.enemies.elves.filter(e=>e.alive).map(e=>e.tuning.kind)"))
        for _ in range(3):
            await page.evaluate(KILL); await asyncio.sleep(1)
        await tp(page, 0, -6, 0)
        await asyncio.sleep(2)
        print("cp", await page.evaluate("() => game.level.checkpoint"))
        await dialogue(page, 3)
        await page.evaluate("() => { game.player.hp = 100; }")
        await tp(page, 0, 11.5, 0)
        await asyncio.sleep(2)
        await page.screenshot(path=f"{OUT}/l5f_intro.png")
        await dialogue(page, 8)
        await asyncio.sleep(1)
        print("boss hud", await page.evaluate("() => JSON.stringify(store.getState().boss)"))
        await asyncio.sleep(6)
        await page.screenshot(path=f"{OUT}/l5g_fight.png")
        print("boss state", await page.evaluate("() => ({st: game.level.zamboni.state, pos: game.level.zamboni.pos.toString(), hp: game.player.hp})"))
        # fire launcher at boss
        r = await page.evaluate("""async () => {
          const g = game; const z = g.level.zamboni; const h0 = z.hp;
          for (let i=0;i<4;i++) {
            const P = g.player.body.position; const c = z.center;
            g.camRig.yaw = Math.atan2(c.x-P.x, c.z-P.z); g.player.yaw = g.camRig.yaw;
            await new Promise(r=>setTimeout(r,250));
            g.player.fire('launcher');
            const t0 = g.time; while (g.time - t0 < 1.2) await new Promise(r=>setTimeout(r,100));
          }
          return {h0, h: z.hp, st: z.state};
        }""")
        print("boss dmg launcher", r)
        await page.evaluate("() => { const z = game.level.zamboni; z.damage(z.hp - 129, 'bullet', z.pos); game.player.hp = 100; }")
        await asyncio.sleep(4)
        await dialogue(page, 4)
        await page.screenshot(path=f"{OUT}/l5h_phase2.png")
        print("phase2", await page.evaluate("() => ({phase: game.level.zamboni.phase, st: game.level.zamboni.state, player: game.player.body.position.toString()})"))
        await gwait(page, 6)
        await page.screenshot(path=f"{OUT}/l5i_islands.png")
        print("p2 enemies", await page.evaluate("() => game.enemies.elves.filter(e=>e.alive).map(e=>e.tuning.kind)"), "hp", await page.evaluate("() => game.player.hp"))
        await page.evaluate("() => { game.player.hp = 100; const z = game.level.zamboni; z.damage(999, 'bullet', z.pos); }")
        await asyncio.sleep(3)
        await gdialogue(page, 9)
        print("after", await page.evaluate("() => ({obj: store.getState().objective, exit: game.level.exit.open, boss: store.getState().boss})"))
        await tp(page, 0, 14, 3.14)
        await asyncio.sleep(3)
        await page.screenshot(path=f"{OUT}/l5j_aurora.png")
        await tp(page, 6, 46, 1.57)
        await asyncio.sleep(1)
        print("under bleachers y", await page.evaluate("() => game.player.body.position.y"))
        print("\n".join(logs[-15:]))
        await b.close()
if __name__ == "__main__": asyncio.run(main())
