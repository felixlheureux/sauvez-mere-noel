"""Niveau 6 — Les Toits du Village. Every jump on the route is made with the real controls
(held keys, Space at the edge, Space again near the top for a double jump).
Screenshots: out/l6_*.png"""
import asyncio
from playwright.async_api import async_playwright
from issues import check, gwait, load, results, skip_cutscene, until, URL, READY

MOD = "await import('/src/levels/Level6.ts')"
KEY = "(type, code) => window.dispatchEvent(new KeyboardEvent(type, {code, bubbles: true}))"
calm_js = "const calm = () => { for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, e.body.position, 'bullet', 0); g.enemies.clear(); g.projectiles.clear(); P.invuln = 1e3; P.frozen = false; if (store.getState().dialogue) store.setState({dialogue: null}); }; calm();"
# Run along `yaw` from `start` and jump at `edge` (distance along yaw), optionally double jump.
JUMP = """async ([start, yaw, edge, double]) => {
  const g = game, P = g.player, b = P.body, V = b.position.constructor; const key = """ + KEY + """;
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const calm = () => { for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, e.body.position, 'bullet', 0); g.enemies.clear(); g.projectiles.clear(); P.invuln = 1e3; P.frozen = false; if (store.getState().dialogue) store.setState({dialogue: null}); };
  calm();
  b.position.set(start[0], start[1] + 0.05, start[2]); b.velocity.setAll(0); P.yaw = yaw; g.camRig.yaw = yaw; g.camRig.pitch = 0.2;
  for (let i = 0; i < 6; i++) await frame(); calm();
  const along = () => (b.position.x - start[0]) * Math.sin(yaw) + (b.position.z - start[2]) * Math.cos(yaw);
  key('keydown', 'KeyW'); key('keydown', 'ShiftLeft');
  let t = 0; while (along() < edge - 0.3 && t++ < 400) { g.camRig.yaw = yaw; await frame(); }
  key('keydown', 'Space'); for (let i = 0; i < 14; i++) await frame(); key('keyup', 'Space');
  if (double) { t = 0; while (b.velocity.y > 1.5 && t++ < 200) await frame(); key('keydown', 'Space'); for (let i = 0; i < 14; i++) await frame(); key('keyup', 'Space'); }
  t = 0; while (t++ < 30) await frame();
  t = 0; while (!b.grounded && t++ < 300) await frame();
  for (let i = 0; i < 12; i++) await frame();
  key('keyup', 'KeyW'); key('keyup', 'ShiftLeft');
  for (let i = 0; i < 20; i++) await frame();
  return b.position.asArray().map(v => +v.toFixed(2)); }"""

def on_roof(r, p):
    return abs(p[0] - r["x"]) <= r["w"] / 2 and abs(p[2] - r["z"]) <= r["d"] / 2 and r["h"] - 0.3 < p[1] < r["h"] + 3.5

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"])
        page = await b.new_page(viewport={"width": 1280, "height": 720})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(URL); await until(page, READY)
        await load(page, 6)
        check("Level 6 layout audit clean", await page.evaluate("() => game.level.audit()") == [], str(await page.evaluate("() => game.level.audit()")))
        owned = await page.evaluate("() => game.player.owned.slice()")
        check("Starts with the five guns of levels 1–5", owned == ["capgun", "shotgun", "smg", "flamer", "launcher"], str(owned))
        await skip_cutscene(page, 30)
        await page.screenshot(path="out/l6_01_start.png")
        m = await page.evaluate(f"async () => {{ const m = {MOD}; return {{route: m.ROUTE, jumps: m.JUMPS, planks: m.PLANKS, step: m.STEP}}; }}")
        R = m["route"]

        # ---- The rifle ----
        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        await until(page, "() => game.player.owned.includes('icicle')", 10)
        check("The crate on the second roof gives the Fusil à Glaçons", await page.evaluate("() => game.player.weapon") == "icicle")
        await skip_cutscene(page, 10)
        r = await page.evaluate("""async () => { const g = game, P = g.player, b = P.body, V = b.position.constructor;
          const frame = () => new Promise(r => requestAnimationFrame(r));
          """ + """const calm = () => { for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, e.body.position, 'bullet', 0); g.enemies.clear(); g.projectiles.clear(); P.invuln = 1e3; P.frozen = false; if (store.getState().dialogue) store.setState({dialogue: null}); };   calm();""" + """
          b.position.set(0, 7.85, -45); b.velocity.setAll(0); P.yaw = 0; g.camRig.yaw = 0; g.camRig.pitch = 0.12;
          for (let i = 0; i < 20; i++) await frame();
          // Three elves standing on the camera's line of fire, 2 m apart.
          const o = g.camRig.camera.position.clone(), d = g.camRig.forward;
          const line = [9, 11, 13].map(k => { const p = o.add(d.scale(k)); const e = g.enemies.spawn(new V(p.x, 7.8, p.z), {}); e.dormant = true; return e; });
          for (let i = 0; i < 5; i++) await frame();
          const onRay = line.map(e => +e.center.subtract(o).subtract(d.scale(Vector3Dot(e.center.subtract(o), d))).length().toFixed(2));
          P.fire('icicle'); for (let i = 0; i < 20; i++) await frame();
          return {alive: line.map(e => e.alive), missBy: onRay}; }""".replace("Vector3Dot(e.center.subtract(o), d)", "(e.center.subtract(o).x * d.x + e.center.subtract(o).y * d.y + e.center.subtract(o).z * d.z)"))
        check("One icicle goes through three elves in a row", r["alive"] == [False, False, False], str(r))

        # ---- Every jump on the route, with the real controls ----
        for j in m["jumps"]:
            f, t = j["from"], j["to"]
            start = [f["x"], f["h"], f["z"] + f["d"] / 2 - 3.5]
            pos = await page.evaluate(JUMP, [start, 0, 3.5, j["double"]])
            kind = "double" if j["double"] else "single"
            check(f"Jump z{f['z']}→z{t['z']} ({t['z'] - t['d']/2 - f['z'] - f['d']/2:.1f} m gap, {t['h'] - f['h']:+.1f} m, {kind}) lands on the next roof", on_roof(t, pos), str(pos))
        # The gap that needs a double jump can't be made with a single one.
        j = next(j for j in m["jumps"] if j["double"])
        pos = await page.evaluate(JUMP, [[j["from"]["x"], j["from"]["h"], j["from"]["z"] + j["from"]["d"] / 2 - 3.5], 0, 3.5, False])
        check("…and that gap is too far for a single jump", not on_roof(j["to"], pos), str(pos))
        # C3 → stairwell hut (+1.1) → C4 (+1.1): two single jumps without letting go of W.
        st = m["step"]; C3, C4 = R["C3"], R["C4"]
        pos = await page.evaluate("""async ([x, y, z0, hutStart, hutEnd]) => { const g = game, P = g.player, b = P.body; const key = """ + KEY + """;
          const frame = () => new Promise(r => requestAnimationFrame(r)); """ + calm_js + """
          b.position.set(x, y + 0.05, z0); b.velocity.setAll(0); P.yaw = 0; g.camRig.yaw = 0; for (let i = 0; i < 6; i++) await frame();
          const press = async () => { key('keydown', 'Space'); for (let i = 0; i < 14; i++) await frame(); key('keyup', 'Space'); };
          key('keydown', 'KeyW'); key('keydown', 'ShiftLeft');
          let t = 0; while (b.position.z < hutStart - 0.6 && t++ < 300) await frame(); await press();
          t = 0; while (!(b.grounded && b.position.z < hutEnd) && t++ < 120) await frame();
          const onHut = b.position.y;
          t = 0; while (b.position.z < hutEnd - 0.4 && t++ < 300) await frame(); await press();
          t = 0; while (!b.grounded && t++ < 200) await frame(); for (let i = 0; i < 8; i++) await frame();
          key('keyup', 'KeyW'); key('keyup', 'ShiftLeft'); for (let i = 0; i < 20; i++) await frame();
          return [onHut, ...b.position.asArray().map(v => +v.toFixed(2))]; }""", [st["x"], C3["h"], C3["z"] - 3, st["z"] - st["d"] / 2, st["z"] + st["d"] / 2])
        check("C3: running, a single jump lands on the stairwell hut", abs(pos[0] - st["h"]) < 0.25, str(pos))
        check("…and a second single jump off its edge lands on C4", on_roof(C4, pos[1:]), str(pos))
        # Planks over the street
        for k, pl in enumerate(m["planks"]):
            yaw = 1.5708 if k == 0 else -1.5708
            x0 = 2.0 if k == 0 else 14.0
            pos = await page.evaluate("""async ([x0, y, z, yaw]) => { const g = game, P = g.player, b = P.body; const key = """ + KEY + """;
              const frame = () => new Promise(r => requestAnimationFrame(r)); const calm = () => { for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, e.body.position, 'bullet', 0); g.enemies.clear(); g.projectiles.clear(); P.invuln = 1e3; P.frozen = false; if (store.getState().dialogue) store.setState({dialogue: null}); };
  calm();
              b.position.set(x0, y + 0.05, z); b.velocity.setAll(0); P.yaw = yaw; g.camRig.yaw = yaw; for (let i = 0; i < 6; i++) await frame();
              key('keydown', 'KeyW'); let t = 0; while (t++ < 160) { g.camRig.yaw = yaw; await frame(); } key('keyup', 'KeyW');
              for (let i = 0; i < 10; i++) await frame(); return b.position.asArray().map(v => +v.toFixed(2)); }""", [x0, pl["h"], pl["z"], yaw])
            target = R["STORE"] if k == 0 else R["C1"]
            check(f"Plank {k + 1}: walking across reaches the other roof", on_roof(target, pos), str(pos))

        # ---- The bells can be reached ----
        pos = await page.evaluate("""async () => { const g = game, P = g.player, b = P.body; const key = """ + KEY + """;
          const frame = () => new Promise(r => requestAnimationFrame(r)); const calm = () => { for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, e.body.position, 'bullet', 0); g.enemies.clear(); g.projectiles.clear(); P.invuln = 1e3; P.frozen = false; if (store.getState().dialogue) store.setState({dialogue: null}); };
  calm();
          b.position.set(-2.6, 7.05, -32.2); b.velocity.setAll(0); P.yaw = 0; g.camRig.yaw = 0; for (let i = 0; i < 6; i++) await frame();
          key('keydown', 'Space'); for (let i = 0; i < 14; i++) await frame(); key('keyup', 'Space');
          let t = 0; while (b.velocity.y > 1.5 && t++ < 200) await frame();
          key('keydown', 'Space'); key('keydown', 'KeyW'); for (let i = 0; i < 14; i++) await frame(); key('keyup', 'Space');
          for (let i = 0; i < 8; i++) await frame(); key('keyup', 'KeyW');
          t = 0; while (!b.grounded && t++ < 200) await frame(); for (let i = 0; i < 10; i++) await frame();
          return b.position.asArray().map(v => +v.toFixed(2)); }""")
        check("A3 chimney-stack bell: a double jump lands on the stack", pos[1] > 9.2, str(pos))
        pos = await page.evaluate("""async () => { const g = game, P = g.player, b = P.body; const key = """ + KEY + """;
          const frame = () => new Promise(r => requestAnimationFrame(r)); const calm = () => { for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, e.body.position, 'bullet', 0); g.enemies.clear(); g.projectiles.clear(); P.invuln = 1e3; P.frozen = false; if (store.getState().dialogue) store.setState({dialogue: null}); };
  calm();
          b.position.set(18.2, 7.45, 0.5); b.velocity.setAll(0); P.yaw = 1.5708; g.camRig.yaw = 1.5708; for (let i = 0; i < 6; i++) await frame();
          key('keydown', 'KeyW'); for (let i = 0; i < 12; i++) await frame();
          key('keydown', 'Space'); for (let i = 0; i < 14; i++) await frame(); key('keyup', 'Space');
          let t = 0; while (b.position.y < 12.4 && t++ < 160) { if (b.velocity.y < 2 && b.position.y > 10 && P.jumpsUsed < 2) { key('keydown', 'Space'); for (let i = 0; i < 14; i++) await frame(); key('keyup', 'Space'); } await frame(); }
          t = 0; while (!b.grounded && t++ < 200) await frame(); key('keyup', 'KeyW'); for (let i = 0; i < 10; i++) await frame();
          return b.position.asArray().map(v => +v.toFixed(2)); }""")
        check("Water tower bell: the bounce gift gets you onto the tank", pos[1] > 12.4, str(pos))
        pos = await page.evaluate("""async () => { const g = game, P = g.player, b = P.body; const key = """ + KEY + """;
          const frame = () => new Promise(r => requestAnimationFrame(r)); const calm = () => { for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, e.body.position, 'bullet', 0); g.enemies.clear(); g.projectiles.clear(); P.invuln = 1e3; P.frozen = false; if (store.getState().dialogue) store.setState({dialogue: null}); };
  calm();
          b.position.set(-5, 6.65, 23); b.velocity.setAll(0); P.yaw = 1.5708; g.camRig.yaw = 1.5708; for (let i = 0; i < 6; i++) await frame();
          key('keydown', 'Space'); key('keydown', 'KeyW'); for (let i = 0; i < 14; i++) await frame(); key('keyup', 'Space');
          let t = 0; while (b.velocity.y > 1.5 && t++ < 200) await frame();
          key('keydown', 'Space'); for (let i = 0; i < 14; i++) await frame(); key('keyup', 'Space');
          t = 0; while (t++ < 20) await frame(); t = 0; while (!b.grounded && t++ < 200) await frame(); key('keyup', 'KeyW');
          for (let i = 0; i < 10; i++) await frame(); return b.position.asArray().map(v => +v.toFixed(2)); }""")
        check("Balcony bell: a double jump gets you back up onto C3", on_roof(R["C3"], pos), str(pos))

        # ---- The slush ----
        r = await page.evaluate("""async () => { const g = game, P = g.player, b = P.body; P.hp = 100; P.invuln = 0;
          const frame = () => new Promise(r => requestAnimationFrame(r));
          b.position.set(0, 7.85, -42); b.velocity.setAll(0); for (let i = 0; i < 10; i++) await frame();
          b.position.set(8, 3, -42); b.velocity.setAll(0); let t = 0; while (b.position.y > 2 && t++ < 100) await frame();
          for (let i = 0; i < 10; i++) await frame();
          return {pos: b.position.asArray().map(v => +v.toFixed(2)), hp: P.hp}; }""")
        check("Falling into the slush: back on the roof you came from, 15 HP lost", on_roof(R["A2"], r["pos"]) and r["hp"] == 85, str(r))
        r = await page.evaluate("""async () => { const g = game, V = g.player.body.position.constructor;
          const e = g.enemies.spawn(new V(8, 3, -30), {}); await new Promise(r => setTimeout(r, 1200)); return e.alive; }""")
        check("An elf that falls into the slush dies", r is False)

        # ---- The whole script, start to chimney ----
        await load(page, 6); await skip_cutscene(page, 30)
        KILL = "() => { const g = game; for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, g.player.body.position, 'bullet', 3); }"
        async def stand(roof, dz=0.0):
            await page.evaluate("([x, y, z]) => { const P = game.player; P.hp = 1e6; P.body.position.set(x, y + 0.05, z); P.body.velocity.setAll(0); }", [roof["x"], roof["h"], roof["z"] + dz])
            await gwait(page, 0.5); await skip_cutscene(page, 10)
        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        await gwait(page, 0.5); await skip_cutscene(page, 10)
        for name in ("A3", "A4"):
            await stand(R[name])
        await gwait(page, 2); await page.evaluate(KILL)
        obj = await page.evaluate("() => [store.getState().objective, !!game.objectiveScreen()]")
        check("After A4: objective points across the plank", "planche" in obj[0] and obj[1], str(obj))
        await stand(R["STORE"], -9)
        await gwait(page, 1)
        check("Landing on the Magasin's roof saves checkpoint 1", await page.evaluate("() => game.level.checkpoint") == 1)
        await page.screenshot(path="out/l6_02_store_siege.png")
        for _ in range(40):
            await gwait(page, 1); await page.evaluate(KILL); await skip_cutscene(page, 4)
            if await page.evaluate("() => game.level.checkpoint") >= 2: break
        check("Clearing the three waves saves checkpoint 2", await page.evaluate("() => game.level.checkpoint") == 2)
        for name in ("C1", "C2", "C3", "C4"):
            await stand(R[name]); await page.evaluate(KILL)
        await stand(R["TOWER"], -4)
        for _ in range(20):
            await gwait(page, 1); await page.evaluate(KILL); await skip_cutscene(page, 4)
            if await page.evaluate("() => !!(game.level.exit && game.level.exit.open)"): break
        check("Clearing the bell-tower roof opens the exit chimney", await page.evaluate("() => game.level.exit.open"))
        await page.screenshot(path="out/l6_03_tower.png")
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
