"""Niveau 9 — La Montagne de Cadeaux: every staircase climbed with the real controls, the
Gatling's spin-up, falling only one tier, the rolling ornaments, and the climb to the
summit. Screenshots: out/l9_*.png"""
import asyncio
from playwright.async_api import async_playwright
from issues import check, gwait, load, results, skip_cutscene, until, URL, READY

MOD = "await import('/src/levels/Level9.ts')"
CALM = """const calm = () => { for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, e.body.position, 'bullet', 0);
  g.enemies.clear(); g.projectiles.clear(); P.invuln = 1e3; P.hp = 100; P.frozen = false; P.buffs.rage = 0; if (store.getState().dialogue) store.setState({dialogue: null}); }; calm();"""
FRAMES = "const frames = (n) => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });"
KEY = "const key = (t, c) => window.dispatchEvent(new KeyboardEvent(t, {code: c, bubbles: true}));"
PRE = "const g = game, P = g.player, b = P.body, V = b.position.constructor; const M = " + MOD + "; " + FRAMES + KEY + CALM
# Known: the audit compares bounding boxes, and the exit chimney stands on top of the summit gift
# (whose bow pokes above its top), so their boxes overlap even though the meshes don't.
KNOWN = ("gift_6_4_6", )

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"])
        page = await br.new_page(viewport={"width": 1280, "height": 720})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(URL); await until(page, READY)
        await load(page, 9)
        audit = [i for i in await page.evaluate("() => game.level.audit()") if not any(k in i for k in KNOWN)]
        check("Level 9 layout audit clean", audit == [], str(audit))
        owned = await page.evaluate("() => game.player.owned.slice()")
        check("Starts with the eight guns of levels 1–8", len(owned) == 8 and owned[-1] == "crossbow", str(owned))
        await skip_cutscene(page, 30)
        await page.screenshot(path="out/l9_01_foot.png")
        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        await until(page, "() => game.player.owned.includes('gatling')", 10)
        check("The crate gives the Gatling à Jujubes", await page.evaluate("() => game.player.weapon") == "gatling")
        await skip_cutscene(page, 10)

        # ---- Gatling: spin-up, then a torrent; slower while it spins ----
        r = await page.evaluate("async () => { " + PRE + """
          b.position.set(-12, 0, -34); b.velocity.setAll(0); P.yaw = 0; g.camRig.yaw = 0; await frames(10);
          let shots = 0; const o = P.fire.bind(P); P.fire = (id) => { shots++; o(id); };
          const c = g.canvas; c.dispatchEvent(new PointerEvent('pointerdown', {button: 0, buttons: 1, bubbles: true}));
          const t0 = g.time; while (g.time - t0 < 0.4) await frames(1); const early = shots;
          while (g.time - t0 < 1.5) await frames(1); const sustained = (shots - early) / (g.time - t0 - 0.5);
          // Walking while it spins vs not.
          const z0 = b.position.z; key('keydown', 'KeyW'); const t1 = g.time; while (g.time - t1 < 1) await frames(1); const slow = (b.position.z - z0) / (g.time - t1);
          window.dispatchEvent(new PointerEvent('pointerup', {button: 0, buttons: 0, bubbles: true}));
          let t = 0; while (t++ < 60) await frames(1); const z1 = b.position.z; const t2 = g.time; while (g.time - t2 < 1) await frames(1);
          const free = (b.position.z - z1) / (g.time - t2); key('keyup', 'KeyW'); P.fire = o;
          return {early, rate: +sustained.toFixed(1), slow: +slow.toFixed(2), free: +free.toFixed(2)}; }""")
        check("Gatling: no shots during the 0.4 s of spin-up", r["early"] == 0, str(r))
        check("…then the fastest fire of all (≥ 18 shots/s)", r["rate"] >= 18, str(r))
        check("…and Santa walks at half speed while it spins", abs(r["slow"] / r["free"] - 0.5) < 0.08, str(r))

        # ---- Every staircase, with the real controls ----
        CLIMB = "async (i) => { " + PRE + """
          const steps = M.stairSteps(i), side = M.STAIR_SIDES[i]; const out = {south: [0, -1], east: [1, 0], north: [0, 1], west: [-1, 0]}[side];
          const along = {south: [1, 0], east: [0, 1], north: [-1, 0], west: [0, -1]}[side]; const s1 = steps[0];
          const yawAlong = Math.atan2(along[0], along[1]);
          b.position.set(s1.x - along[0] * 3, s1.base + 0.05, s1.z - along[1] * 3); b.velocity.setAll(0); P.yaw = yawAlong; g.camRig.yaw = yawAlong; await frames(8); calm();
          const press = async () => { key('keydown', 'Space'); await frames(14); key('keyup', 'Space'); };
          key('keydown', 'KeyW');
          for (const st of steps) { let t = 0; while (((b.position.x - st.x) * along[0] + (b.position.z - st.z) * along[1]) < -1.6 && t++ < 200) { g.camRig.yaw = yawAlong; await frames(1); } await press(); await frames(6); }
          let t = 0; while (!b.grounded && t++ < 100) await frames(1);
          key('keyup', 'KeyW'); await frames(4);
          // Last hop: inward, onto the tier.
          const yawIn = Math.atan2(-out[0], -out[1]); P.yaw = yawIn; g.camRig.yaw = yawIn; key('keydown', 'KeyW'); await frames(4); await press();
          t = 0; while (t++ < 40) await frames(1); t = 0; while (!b.grounded && t++ < 100) await frames(1); key('keyup', 'KeyW'); await frames(10);
          return {tier: M.tierAt(b.position), pos: b.position.asArray().map(v => +v.toFixed(2))}; }"""
        for i in range(5):
            r = await page.evaluate(CLIMB, i)
            check(f"Staircase {i + 1}: climbed with single jumps onto tier {i + 1}", r["tier"] == i, str(r))

        # ---- Falling costs one tier, not the climb ----
        r = await page.evaluate("async () => { " + PRE + """
          b.position.set(0, 18.05, -9.5); b.velocity.setAll(0); P.yaw = Math.PI; g.camRig.yaw = Math.PI; await frames(8); calm();
          key('keydown', 'KeyW'); let t = 0; while (b.position.y > 17 && t++ < 120) await frames(1); key('keyup', 'KeyW');
          t = 0; while (!b.grounded && t++ < 200) await frames(1); await frames(6); return {tier: M.tierAt(b.position), y: +b.position.y.toFixed(2)}; }""")
        check("Walking off the tier-3 terrace lands on tier 2, one tier down", r["tier"] == 1 and abs(r["y"] - 12) < 0.2, str(r))

        # ---- Rolling ornaments ----
        r = await page.evaluate("async () => { " + PRE + """
          const L = g.level; const ball = L.balls[0]; P.invuln = 0;
          // Stand on the ball's line, a little ahead of it.
          let t = 0; while (t++ < 400) { const m = ball.mesh.position; if (Math.abs(m.z + ball.half) < 0.1 && m.x < -8) break; await frames(1); }
          const m = ball.mesh.position; b.position.set(m.x + 6, ball.y - 0.8 + 0.05, -ball.half); b.velocity.setAll(0); P.hp = 100;
          const e = g.enemies.spawn(new V(m.x + 3, ball.y - 0.8, -ball.half), {}); e.dormant = true;
          t = 0; while (P.hp === 100 && t++ < 200) await frames(1); const elfAlive = e.alive;
          t = 0; while (t++ < 30) await frames(1); t = 0; while (!b.grounded && t++ < 200) await frames(1);
          return {hp: P.hp, tier: M.tierAt(b.position), elfAlive}; }""")
        check("A rolling ornament flattens an elf in its way", r["elfAlive"] is False, str(r))
        check("…and bowls Santa over (20) and off the terrace, one tier down", r["hp"] == 80 and r["tier"] == -1, str(r))

        # ---- The climb, start to summit ----
        await load(page, 9); await skip_cutscene(page, 30)
        m = await page.evaluate("async () => { const M = " + MOD + "; return {tiers: M.TIERS}; }")
        KILL = "() => { const g = game; for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, g.player.body.position, 'bullet', 3); }"
        async def stand(tier, x, z):
            t = m["tiers"][tier]
            await page.evaluate("([x, y, z]) => { const P = game.player; P.hp = 1e6; P.body.position.set(x, y + 0.05, z); P.body.velocity.setAll(0); }", [x, t["top"], z])
            await gwait(page, 0.4); await skip_cutscene(page, 10)
        async def clear(until_js, n=40):
            for _ in range(n):
                await gwait(page, 1.2); await page.evaluate(KILL); await skip_cutscene(page, 4)
                if await page.evaluate(until_js): return True
            return False
        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        await gwait(page, 0.5); await skip_cutscene(page, 10)
        ok = await clear("() => store.getState().objective.includes('palier 1')")
        check("Clearing the foot of the mountain points up the first staircase", ok)
        await stand(0, 0, -19.5); await gwait(page, 0.8)
        check("Tier 1 saves checkpoint 1", await page.evaluate("() => game.level.checkpoint") == 1)
        await page.screenshot(path="out/l9_02_tier1.png")
        for tier, (x, z) in ((0, (0, -19.5)), (1, (13.5, 0)), (2, (0, 9)), (3, (-5, 0))):
            if tier > 0:
                await stand(tier, x, z)
                if tier == 2:
                    check("Tier 3 saves checkpoint 2", await page.evaluate("() => game.level.checkpoint") == 2)
                    await page.screenshot(path="out/l9_03_tier3.png")
            want = "sommet" if tier == 3 else f"palier {tier + 2}"
            ok = await clear(f"() => store.getState().objective.includes('{want}')")
            check(f"Tier {tier + 1}: its horde cleared, the objective points on up", ok, await page.evaluate("() => store.getState().objective"))
        await stand(4, -1.2, -1.6); await gwait(page, 2.5)
        await page.screenshot(path="out/l9_04_summit.png")
        for _ in range(20):
            await page.keyboard.press("Enter"); await gwait(page, 0.6)
            if await page.evaluate("() => !!(game.level.exit && game.level.exit.open)"): break
        check("After the sleigh flies off, the exit chimney opens on the summit", await page.evaluate("() => game.level.exit.open"))
        await page.evaluate("() => { const e = game.level.exit; game.player.body.position.set(e.pos.x, e.pos.y + 0.1, e.pos.z); game.player.body.velocity.setAll(0); }")
        for _ in range(60):
            await asyncio.sleep(0.2)
            if await page.evaluate("() => store.getState().letterbox"): await page.keyboard.press("Enter")
            if await page.evaluate("() => store.getState().screen === 'levelComplete'"): break
        check("The chimney ends the level", await page.evaluate("() => store.getState().screen") == "levelComplete")
        check("No page errors", not errors, str(errors[:3]))
        await br.close()
    print(f"\n{sum(ok for _, ok, _ in results)}/{len(results)} passed")

if __name__ == "__main__":
    asyncio.run(main())
