"""Niveau 7 — La Fabrique de Jouets: belts, grinder, presses, the garland's chain,
valves broken by real shots, and the whole script to the chimney. Screenshots: out/l7_*.png"""
import asyncio
from playwright.async_api import async_playwright
from issues import check, gwait, load, results, skip_cutscene, until, URL, READY

MOD = "await import('/src/levels/Level7.ts')"
CALM = """const calm = () => { for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, e.body.position, 'bullet', 0);
  g.enemies.clear(); g.projectiles.clear(); P.invuln = 0; P.hp = 100; P.frozen = false; if (store.getState().dialogue) store.setState({dialogue: null}); }; calm();"""
FRAMES = "const frames = (n) => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });"
# Aim the real camera at a point (two passes: the camera orbits as yaw/pitch change).
# Aim the real camera at a point: the camera orbits and eases as yaw/pitch change, so keep
# correcting until its ray really passes within 5 cm of the target.
AIM = """const aim = async (t) => { for (let k = 0; k < 20; k++) { const c = g.camRig.camera.position; const d = t.subtract(c);
  g.camRig.yaw = Math.atan2(d.x, d.z); P.yaw = g.camRig.yaw; g.camRig.pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z)); await frames(3);
  const o = g.camRig.camera.position, f = g.camRig.forward, v = t.subtract(o); const along = v.x * f.x + v.y * f.y + v.z * f.z;
  if (v.subtract(f.scale(along)).length() < 0.05) break; } };"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"])
        page = await b.new_page(viewport={"width": 1280, "height": 720})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(URL); await until(page, READY)
        await load(page, 7)
        audit = await page.evaluate("() => game.level.audit()")
        check("Level 7 layout audit clean", audit == [], str(audit))
        owned = await page.evaluate("() => game.player.owned.slice()")
        check("Starts with the six guns of levels 1–6", owned == ["capgun", "shotgun", "smg", "flamer", "launcher", "icicle"], str(owned))
        await skip_cutscene(page, 30)
        await page.screenshot(path="out/l7_01_dock.png")
        m = await page.evaluate(f"async () => {{ const m = {MOD}; return {{belts: m.BELTS, grinder: m.GRINDER, presses: m.PRESSES, press: m.PRESS, valves: m.VALVES, hp: m.VALVE_HP}}; }}")

        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        await until(page, "() => game.player.owned.includes('garland')", 10)
        check("The crate gives the Guirlande Électrique", await page.evaluate("() => game.player.weapon") == "garland")
        await skip_cutscene(page, 10)

        # ---- The garland chains from elf to elf ----
        r = await page.evaluate("async () => { const g = game, P = g.player, b = P.body, V = b.position.constructor; " + FRAMES + CALM + AIM + """
          b.position.set(0, 0, -46); b.velocity.setAll(0); await frames(10);
          const elves = [[0, -40], [1.6, -39], [-1.6, -39], [0, -37.5], [3, -37]].map(([x, z]) => { const e = g.enemies.spawn(new V(x, 0, z), {}); e.dormant = true; return e; });
          await frames(5); await aim(elves[0].center); P.fire('garland'); await frames(10);
          return elves.map(e => e.alive ? +e.hp.toFixed(2) : 'dead'); }""")
        hit = sum(1 for h in r if h == "dead" or h < 3)
        check("One garland shot hits five elves standing close together", hit == 5, str(r))

        # ---- Belts and grinder ----
        bz = m["belts"][0]["z"]
        r = await page.evaluate("async (z) => { const g = game, P = g.player, b = P.body; " + FRAMES + CALM + """
          b.position.set(-7, 0.35, z); b.velocity.setAll(0); await frames(6); const x0 = b.position.x; const t0 = g.time;
          await frames(60); return {moved: +(b.position.x - x0).toFixed(2), t: +(g.time - t0).toFixed(2)}; }""", bz)
        check("A belt carries Santa toward the grinder (~3 m/s)", 2.2 < r["moved"] / r["t"] < 3.6, str(r))
        gr = m["grinder"]
        r = await page.evaluate("async ([x, z]) => { const g = game, P = g.player, b = P.body; " + FRAMES + CALM + """
          b.position.set(x, 0.05, z); b.velocity.setAll(0); await frames(30);
          return {hp: P.hp, x: +b.position.x.toFixed(2)}; }""", [gr["x"], gr["z"] + 6])
        check("The grinder hurts (20) and throws Santa back out", r["hp"] == 80 and r["x"] < gr["x"] - gr["w"] / 2, str(r))
        r = await page.evaluate("async (z) => { const g = game, P = g.player, b = P.body, V = b.position.constructor; " + FRAMES + CALM + """
          b.position.set(-8, 0, -48); b.velocity.setAll(0);
          const e = g.enemies.spawn(new V(3.5, 0.3, z), {}); e.dormant = true; await frames(120); return e.alive; }""", m["belts"][1]["z"])
        check("An elf left on a belt is carried into the grinder and dies", r is False)

        # ---- Presses ----
        pr = m["press"]
        r = await page.evaluate("async ([zs, period, offset]) => { const g = game, P = g.player, b = P.body, V = b.position.constructor; const m = " + MOD + "; " + FRAMES + CALM + """
          // Wait until press 0 is about to slam, then stand under it.
          let t = 0; while (t++ < 400) { const r = m.ramBottom(g.time + 0.12, 0); if (r.down && !m.ramBottom(g.time, 0).down) break; await frames(1); }
          b.position.set(0.2, 0.35, zs[0]); b.velocity.setAll(0); P.invuln = 0;
          const e = g.enemies.spawn(new V(-0.6, 0.35, zs[1]), {}); e.dormant = true;
          await frames(40); const under = {hp: P.hp, x: +b.position.x.toFixed(2)};
          calm(); b.position.set(4.2, 0, zs[0]); b.velocity.setAll(0); await frames(Math.ceil(period * 60) + 10);
          return {under, beside: P.hp}; }""", [m["presses"], pr["period"], pr["offset"]])
        check("A press slamming on Santa hurts (30) and throws him out from under it", r["under"]["hp"] == 70 and abs(r["under"]["x"]) > pr["half"], str(r))
        check("Standing beside the presses is safe", r["beside"] == 100, str(r))
        r = await page.evaluate("async (zs) => { const g = game, P = g.player, b = P.body, V = b.position.constructor; const m = " + MOD + "; " + FRAMES + CALM + """
          b.position.set(6, 0, zs[0]);
          let t = 0; while (t++ < 400) { if (m.ramBottom(g.time + 0.12, 1).down && !m.ramBottom(g.time, 1).down) break; await frames(1); }
          const e = g.enemies.spawn(new V(0, 0.35, zs[1]), {}); e.dormant = true; await frames(30); return e.alive; }""", m["presses"])
        check("An elf under a press gets crushed", r is False)

        # ---- Valves break in a few real shots ----
        r = await page.evaluate("async (vs) => { const g = game, P = g.player, b = P.body, V = b.position.constructor; " + FRAMES + CALM + AIM + """
          const count = async (v, gun, maxShots) => { const L = g.level; const alive = () => L.breakables.some(k => k.pos.x === v.x && k.pos.z === v.z);
            b.position.set(v.x, 0, v.z - 8); b.velocity.setAll(0); await frames(10); P.equip(gun); let n = 0;
            while (alive() && n < maxShots) { await aim(new V(v.x, 1.3, v.z)); P.buffs.rage = 0; P.fireCd = 0; P.fire(gun); n++; await frames(45); } return alive() ? 'unbroken' : n; };
          const icicle = await count(vs[0], 'icicle', 10);
          const garland = await count(vs[1], 'garland', 20);
          const L = g.level; const v3 = vs[2]; let blasts = 0;
          while (L.breakables.some(k => k.pos.x === v3.x && k.pos.z === v3.z) && blasts < 6) { g.projectiles.explode(new V(v3.x, 1.3, v3.z - 1.5), 3.6, 10, 0, true); blasts++; await frames(10); }
          return {icicle, garland, launcherBlasts: blasts}; }""", m["valves"])
        check("A valve takes 2 icicle shots", r["icicle"] == 2, str(r))
        check("A valve takes 4 garland shots", r["garland"] == 4, str(r))
        check("Launcher blasts break valves too (2 blasts)", r["launcherBlasts"] == 2, str(r))

        # ---- The whole script ----
        await load(page, 7); await skip_cutscene(page, 30)
        KILL = "() => { const g = game; for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, g.player.body.position, 'bullet', 3); }"
        async def go(x, z):
            await page.evaluate("([x, z]) => { const P = game.player; P.hp = 1e6; P.body.position.set(x, 0.05, z); P.body.velocity.setAll(0); }", [x, z])
            await gwait(page, 0.4); await skip_cutscene(page, 10)
        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        await gwait(page, 0.5); await skip_cutscene(page, 10)
        await go(-6, -36); await gwait(page, 1.5); await page.evaluate(KILL)
        shut = await page.evaluate("() => game.physics.colliders.filter(c => c.enabled && Math.abs((c.min.z + c.max.z) / 2 - 14) < 0.5 && c.min.x > -2.5 && c.max.x < 2.5).length")
        await go(-6, -14); await gwait(page, 1)
        check("Entering the assembly line saves checkpoint 1", await page.evaluate("() => game.level.checkpoint") == 1)
        await gwait(page, 1.6); await page.screenshot(path="out/l7_02_assembly.png")
        for _ in range(30):
            await gwait(page, 1); await page.evaluate(KILL); await skip_cutscene(page, 4)
            if await page.evaluate("() => store.getState().objective.includes('Grand Atelier')"): break
        shut_after = await page.evaluate("() => game.physics.colliders.filter(c => c.enabled && Math.abs((c.min.z + c.max.z) / 2 - 14) < 0.5 && c.min.x > -2.5 && c.max.x < 2.5).length")
        check("The shutter is closed until the line is clear, then opens", shut == 1 and shut_after == 0, f"{shut} -> {shut_after}")
        await go(0, 17.5); await gwait(page, 1); await skip_cutscene(page, 6)
        check("Entering the Grand Atelier saves checkpoint 2", await page.evaluate("() => game.level.checkpoint") == 2)
        await gwait(page, 7)
        n = await page.evaluate("() => game.enemies.elves.filter(e => e.alive).length + game.enemies.aliveCount")
        check("The machine keeps spitting elves while its valves stand", n >= 6, f"{n} alive")
        await page.screenshot(path="out/l7_03_machine.png")
        await page.evaluate("() => { for (const k of [...game.level.breakables]) { game.level.blastProps(k.pos.add(new k.pos.constructor(0, 1.3, 0)), 1, 99); } }")
        await gwait(page, 1); await skip_cutscene(page, 6)
        for _ in range(20):
            await page.evaluate(KILL); await gwait(page, 1); await skip_cutscene(page, 4)
            if await page.evaluate("() => !!(game.level.exit && game.level.exit.open)"): break
        check("Valves broken + room cleared: the exit chimney opens", await page.evaluate("() => game.level.exit.open"))
        await gwait(page, 3)
        check("No more elves come out once the machine is down", await page.evaluate("() => game.enemies.elves.filter(e => e.alive).length") == 0)
        await page.evaluate("() => { const e = game.level.exit; game.player.body.position.set(e.pos.x, e.pos.y + 0.1, e.pos.z); game.player.body.velocity.setAll(0); }")
        for _ in range(60):
            await asyncio.sleep(0.2)
            if await page.evaluate("() => store.getState().letterbox"): await page.keyboard.press("Enter")
            if await page.evaluate("() => store.getState().screen === 'levelComplete'"): break
        check("The chimney ends the level", await page.evaluate("() => store.getState().screen") == "levelComplete")
        check("No page errors", not errors, str(errors[:3]))
        await b.close()
    print(f"\n{sum(ok for _, ok, _ in results)}/{len(results)} passed")

if __name__ == "__main__":
    asyncio.run(main())
