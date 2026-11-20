"""Niveau 10 — Le Village Cauchemar: the star beam, Père Fouettard's four phases (shielded
cutscenes, poise, specials, waves, no "immortal" pause), the cage, and the ending.
Screenshots: out/l10_*.png"""
import asyncio
from playwright.async_api import async_playwright
from issues import check, gwait, load, results, skip_cutscene, until, URL, READY

MOD = "await import('/src/levels/Level10.ts')"
CALM = """const calm = () => { for (const e of g.enemies.elves) if (e.alive && !e.tuning.boss) g.enemies.hit(e, 999, e.body.position, 'bullet', 0);
  g.projectiles.clear(); P.invuln = 0; P.hp = 100; P.frozen = false; P.buffs.rage = 0; P.burnTime = 0; if (store.getState().dialogue) store.setState({dialogue: null}); }; calm();"""
FRAMES = "const frames = (n) => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });"
AIM = """const aim = async (t) => { for (let k = 0; k < 20; k++) { const c = g.camRig.camera.position; const d = t.subtract(c);
  g.camRig.yaw = Math.atan2(d.x, d.z); P.yaw = g.camRig.yaw; g.camRig.pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z)); await frames(3);
  const o = g.camRig.camera.position, f = g.camRig.forward, v = t.subtract(o); const along = v.x * f.x + v.y * f.y + v.z * f.z;
  if (v.subtract(f.scale(along)).length() < 0.05) break; } };"""
PRE = "const g = game, P = g.player, b = P.body, V = b.position.constructor; const M = " + MOD + "; " + FRAMES + AIM + CALM
BOSS = "game.enemies.elves.find(e => e.alive && e.tuning.boss)"

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"])
        page = await br.new_page(viewport={"width": 1280, "height": 720})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(URL); await until(page, READY)
        await load(page, 10)
        audit = await page.evaluate("() => game.level.audit()")
        check("Level 10 layout audit clean", audit == [], str(audit))
        owned = await page.evaluate("() => game.player.owned.slice()")
        check("Starts with the nine guns of levels 1–9", len(owned) == 9 and owned[-1] == "gatling", str(owned))
        await skip_cutscene(page, 30)
        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        await until(page, "() => game.player.owned.includes('star')", 10)
        check("The crate gives the Rayon de l'Étoile", await page.evaluate("() => game.player.weapon") == "star")
        await skip_cutscene(page, 10)
        r = await page.evaluate("async () => { " + PRE + """
          b.position.set(0, 0, -52); b.velocity.setAll(0); P.yaw = 0; g.camRig.yaw = 0; g.camRig.pitch = 0.08; await frames(15);
          const o = g.camRig.camera.position.clone(), d = g.camRig.forward;
          const line = [10, 12, 14, 16].map(k => { const q = o.add(d.scale(k)); const e = g.enemies.spawn(new V(q.x, 0, q.z), {}); e.dormant = true; return e; });
          await frames(4); await aim(line[1].center);
          for (let i = 0; i < 14; i++) { P.fireCd = 0; P.fire('star'); await frames(3); }
          return line.map(e => e.alive); }""")
        check("The star beam cuts through a whole line of elves", r == [False, False, False, False], str(r))

        # ---- Into the square: phase 1 ----
        await load(page, 10, 1)
        await gwait(page, 1.2)
        r = await page.evaluate("() => { const e = " + BOSS + "; const hp = e.hp; game.enemies.hit(e, 100, e.body.position, 'bullet', 0); return {cut: store.getState().letterbox, before: hp, after: e.hp}; }")
        check("Phase cutscene: Fouettard can't be hurt while it plays", r["cut"] and r["after"] == r["before"] == 220, str(r))
        await page.screenshot(path="out/l10_01_phase1_cut.png")
        await skip_cutscene(page, 20); await gwait(page, 1)
        r = await page.evaluate("async () => { " + PRE + """
          const e = """ + BOSS + """; b.position.set(e.body.position.x - 12, 0, e.body.position.z - 4); b.velocity.setAll(0); P.invuln = 1e3;
          let thrown = 0; const o = g.projectiles.throwCoal.bind(g.projectiles); g.projectiles.throwCoal = (...a) => { thrown++; return o(...a); };
          const t0 = g.time; while (g.time - t0 < 6) { g.enemies.hit(e, 0.05, b.position, 'bullet', 0.6); await frames(2); }
          g.projectiles.throwCoal = o; return {thrown, alive: e.alive}; }""")
        check("Poise: under constant fire he keeps attacking (no stun-lock)", r["thrown"] >= 3, str(r))
        n = await page.evaluate("() => game.enemies.aliveCount")
        check("Phase 1 brings its wave", n >= 4, f"{n} alive")
        r = await page.evaluate("async () => { " + PRE + """
          const L = g.level, e = """ + BOSS + """; b.position.copyFrom(e.body.position.add(new V(3, 0, 0))); b.velocity.setAll(0); calm();
          await L.special(e, 'spin'); const close = 100 - P.hp;
          P.hp = 100; P.invuln = 0; b.position.copyFrom(e.body.position.add(new V(14, 0, 0))); let thrown = 0;
          const o = g.projectiles.throwCoal.bind(g.projectiles); g.projectiles.throwCoal = (...a) => { thrown++; return o(...a); };
          await L.special(e, 'spin'); g.projectiles.throwCoal = o; return {close, farCoal: thrown}; }""")
        check("Whip spin: telegraphed, then it lashes Santa close by (20)", r["close"] == 20, str(r))
        check("…and from far away he rains coal instead", r["farCoal"] >= 6, str(r))

        # ---- 0 HP: the next phase starts at once (no "immortal" wait) ----
        async def end_phase(expect_phase):
            await page.evaluate("() => { const e = " + BOSS + "; e.stun = 0.5; game.enemies.hit(e, 9999, e.body.position, 'bullet', 0); }")
            ok = await until(page, "() => store.getState().letterbox", 4)
            await skip_cutscene(page, 20); await gwait(page, 0.6)
            bar = await page.evaluate("() => store.getState().boss")
            return ok and bar is not None and bar["phase"] == expect_phase, bar
        ok, bar = await end_phase(2)
        check("At 0 HP, phase 2's cutscene starts right away", ok, str(bar))
        await gwait(page, 2.5)
        check("Phase 2 brings its wave", await page.evaluate("() => game.enemies.aliveCount") >= 3)
        r = await page.evaluate("async () => { " + PRE + """
          const e = """ + BOSS + """; const T = M.TREE; P.invuln = 1e3;
          // Wait until he's over any earlier daze, then put the trunk between him and Santa.
          let w = 0; while ((e.stunned || e.state === 'attack') && w++ < 400) await frames(1);
          e.body.position.set(T.x, 0, T.z - 9); e.body.velocity.setAll(0); e.cooldown = 0; e.setState('chase'); b.position.set(T.x, 0, T.z + 6); b.velocity.setAll(0); await frames(2);
          let minD = 99, dazed = false, t = 0; while (t++ < 400) { minD = Math.min(minD, Math.hypot(e.body.position.x - T.x, e.body.position.z - T.z)); if (e.stunned) { dazed = true; break; } await frames(1); }
          return {minD: +minD.toFixed(2), dazed}; }""")
        check("Charging into the tree, he stops at the trunk and is dazed (no clipping)", r["dazed"] and r["minD"] >= 1.3 + 0.6 - 0.05, str(r))
        r = await page.evaluate("async () => { " + PRE + """
          // Between every two houses round the square there's a way through (no walls).
          const KEY = (t, c) => window.dispatchEvent(new KeyboardEvent(t, {code: c, bubbles: true})); P.invuln = 1e3; const out = [];
          for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * Math.PI * 2; if (Math.abs(Math.cos(a) + 1) < 0.3) continue;
            b.position.set(Math.sin(a) * 16, 0, Math.cos(a) * 16); b.velocity.setAll(0); P.yaw = a; g.camRig.yaw = a; await frames(3);
            KEY('keydown', 'KeyW'); KEY('keydown', 'ShiftLeft'); await frames(220); KEY('keyup', 'KeyW'); KEY('keyup', 'ShiftLeft');
            out.push(+Math.hypot(b.position.x, b.position.z).toFixed(1)); }
          b.position.set(0, 0, -20); return out; }""")
        check("You can walk out between any two houses of the square (no invisible walls)", min(r) > 30, str(r))
        r = await page.evaluate("async () => { " + PRE + """
          const e = """ + BOSS + """; P.invuln = 1e3;
          let w = 0; while ((e.stunned || e.state === 'attack') && w++ < 400) await frames(1);
          // Santa in front of the east house, the boss lined up to charge into it.
          b.position.set(21, 0, 0.5); b.velocity.setAll(0); e.body.position.set(9, 0, 0.5); e.cooldown = 0; e.setState('chase');
          let t = 0, dazed = false, maxY = 0; while (t++ < 400) { maxY = Math.max(maxY, e.body.position.y); if (e.stunned) { dazed = true; break; } await frames(1); }
          b.position.set(0, 0, -20); return {dazed, maxY: +maxY.toFixed(2)}; }""")
        check("Charging into a house, he's stopped on the ground (never on or in it)", r["dazed"] and r["maxY"] < 0.6, str(r))
        # Mid-charge when phase 2 ends: a big push still pending on him.
        await page.evaluate("() => { const e = " + BOSS + "; e.knock.set(14, 0, 9); }")
        ok, bar = await end_phase(3)
        check("At 0 HP, phase 3 (the tree) starts right away", ok, str(bar))
        r = await page.evaluate("""async () => { const e = """ + BOSS + """; const V = e.body.position.constructor;
          const frames = (n) => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
          let w = 0; while (e.dormant && w++ < 1200) await frames(1);
          let minY = 99;
          for (let i = 0; i < 240; i++) {
            if (i % 30 === 0) { game.enemies.hit(e, 5, e.body.position.add(new V(1, 0, 1)), 'bullet', 9); game.projectiles.explode(e.center.add(new V(0.8, 0, 0)), 3, 0, 0.1); }
            minY = Math.min(minY, e.body.position.y); await frames(1);
          }
          return {awake: !e.dormant, perched: e.perched, minY: +minY.toFixed(2)}; }""")
        check("Phase 3: he stays up in his tree (a leftover push, hits and blasts don't knock him off)", r["awake"] and r["perched"] and r["minY"] > 6.5, str(r))
        await page.screenshot(path="out/l10_02_phase3.png")
        r = await page.evaluate("async () => { const e = " + BOSS + "; const hp = e.hp; game.enemies.hit(e, 50, e.body.position, 'bullet', 0); return {perched: e.perched, hp: e.hp, before: hp}; }")
        check("Phase 3: perched in the tree, he can't be hurt", r["perched"] and r["hp"] == r["before"], str(r))
        await page.evaluate("() => { for (const k of [...game.level.breakables]) game.level.blastProps(k.pos.add(new k.pos.constructor(0, 0.8, 0)), 0.5, 99); }")
        await gwait(page, 2.5)
        r = await page.evaluate("() => ({down: game.level.perchDown, mereCaged: !game.level.mereFree})")
        check("Breaking the three stakes brings his platform crashing down", r["down"], str(r))
        check("…while Mère Noël stays in her cage (she's freed only once he's beaten)", r["mereCaged"], str(r))
        await until(page, "() => store.getState().letterbox", 6)
        await skip_cutscene(page, 20); await gwait(page, 0.8)
        bar = await page.evaluate("() => store.getState().boss")
        check("His fall starts phase 4, the last stand", bar is not None and bar["phase"] == 4, str(bar))
        await gwait(page, 2.5)
        check("Phase 4 brings the biggest wave", await page.evaluate("() => game.enemies.aliveCount") >= 5)
        await page.screenshot(path="out/l10_03_phase4.png")

        # ---- The defeat and the ending ----
        await page.evaluate("() => { window.__gibs = 0; const G = game.gore; const o = G.explode.bind(G); G.explode = (...a) => { const r = o(...a); window.__gibs = G.gibs.length; return r; }; const e = " + BOSS + "; game.enemies.hit(e, 9999, e.body.position, 'bullet', 0); }")
        shots = 0
        for _ in range(120):
            await asyncio.sleep(0.25)
            if await page.evaluate("() => store.getState().screen === 'levelComplete'"): break
            if await page.evaluate("() => !!store.getState().dialogue"):
                if shots < 8:
                    await page.screenshot(path=f"out/l10_ending_{shots}.png"); shots += 1
                await page.keyboard.press("Enter")
        r = await page.evaluate("() => ({gibs: window.__gibs, tree: game.level.deadTree && !game.level.deadTree.isEnabled(), mere: game.level.mereFree, screen: store.getState().screen})")
        check("He dies in a massive gore burst", r["gibs"] >= 15, str(r))
        check("The ending plays through: the great Christmas tree is back, Mère Noël is free", r["tree"] and r["mere"] and r["screen"] == "levelComplete", str(r))
        await page.evaluate("() => game.nextLevel()")  # what the score card's "next" button does
        await asyncio.sleep(1)
        await page.screenshot(path="out/l10_04_ending_screen.png")
        check("…then the « Joyeux Noël! » ending screen", await page.evaluate("() => store.getState().screen") == "ending")
        check("No page errors", not errors, str(errors[:3]))
        await br.close()
    print(f"\n{sum(ok for _, ok, _ in results)}/{len(results)} passed")

if __name__ == "__main__":
    asyncio.run(main())
