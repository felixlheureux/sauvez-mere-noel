"""Regression test for every playtest issue Félix reported. Prints PASS/FAIL per check
and saves screenshots for the visual ones (out/iss_*.png)."""
import asyncio, math
from playwright.async_api import async_playwright
from level4 import until, READY, URL

results = []
def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""))

async def gwait(page, sec):
    await page.evaluate("t => new Promise(r => { const t0 = game.time; const id = setInterval(() => { if (game.time - t0 >= t) { clearInterval(id); r(); } }, 50); })", sec)

async def load(page, lvl, cp=0):
    await page.evaluate(f"() => game.loadLevel({lvl}, {cp})")
    await until(page, "() => store.getState().screen === 'playing'")
    await gwait(page, 0.4)

async def skip_cutscene(page, n=15):
    for _ in range(n):
        if await page.evaluate("() => store.getState().letterbox || store.getState().dialogueBlocking && !!store.getState().dialogue"):
            await page.keyboard.press("Enter"); await asyncio.sleep(0.35)
        else:
            break

async def tap(page):
    # A real (trusted) browser click, quick press and release: synthetic events skipped the
    # browser's pointer → mouse event rules and hid a bug where real clicks never shot.
    await page.mouse.move(640, 360)
    await page.mouse.down(); await page.mouse.up()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await b.new_page(viewport={"width":1280,"height":720})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(URL); await until(page, READY)

        # ---------- Level 0 ----------
        await load(page, 0)
        await gwait(page, 0.6)
        await page.screenshot(path="out/iss_01_intro_shot1.png")
        await gwait(page, 3.6)
        await page.screenshot(path="out/iss_02_intro_shot2.png")
        hint = await page.evaluate("() => [...document.querySelectorAll('kbd')].some(k => k.textContent.trim() === 'Entrée' && k.closest('[class*=bottom]'))")
        check("Dialogue shows the Entrée key", hint)
        await skip_cutscene(page)
        await gwait(page, 0.5)
        await page.screenshot(path="out/iss_03_controls_tier0.png")
        m = await page.evaluate("() => game.objectiveScreen()")
        check("Star objective has a waypoint", m is not None, str(m and round(m['dist'])))
        # Rocks are solid
        rocks = await page.evaluate("""() => game.levelRoot.getChildren(n => n.name === 'rock_m', true).map(m => [m.position.x, m.position.z])""")
        tops = []
        for (x, z) in rocks:
            y = await page.evaluate("([x,z]) => game.physics.groundHeightAt(x, z, 50)", [x, z])
            tops.append(y)
        check("Every rock can be stood on", len(rocks) > 0 and all(t > 0.5 for t in tops), f"{len(rocks)} rocks, tops {[round(t,1) for t in tops]}")
        # Climb the gift tower and take the star.
        await page.evaluate("() => { const b = game.player.body; b.position.set(13.4, 5.75, -15.4); b.velocity.setAll(0); }")
        await gwait(page, 0.8)
        st = await page.evaluate("() => ({taken: game.level.starTaken, carried: !!game.level.carried, obj: store.getState().objective, m: game.objectiveScreen()})")
        check("Star picked up and carried over Santa's head", st["taken"] and st["carried"], st["obj"])
        check("Bring-the-star objective points at the tree", st["m"] is not None)
        await page.evaluate("() => { const b = game.player.body; b.position.set(6, 0, 6); b.velocity.setAll(0); game.camRig.yaw = -2.4; }")
        await gwait(page, 0.8)
        await page.screenshot(path="out/iss_04_carry_star.png")
        # Twist → crate → cane
        await page.evaluate("() => { const b = game.player.body; b.position.set(0, 0, 3.5); b.velocity.setAll(0); }")
        for i in range(60):
            await asyncio.sleep(0.4)
            s = await page.evaluate("() => [store.getState().letterbox, store.getState().objective]")
            if s[0]:
                if i in (6, 14): await page.screenshot(path=f"out/iss_05_twist_{i}.png")
                await page.keyboard.press("Enter")
            elif "caisse" in (s[1] or ""):
                break
        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        await gwait(page, 1)
        w = await page.evaluate("() => ({weapon: store.getState().weapon, cane: game.player.hasCane, caneVisible: game.player.cane.isEnabled(), owned: game.player.owned.slice()})")
        check("Level 0 weapon is the candy cane (no gun)", w["weapon"] == "cane" and w["cane"] and w["caneVisible"] and w["owned"] == [], str(w))
        r = await page.evaluate("""async () => { const g = game; const P = g.player.body.position;
          const f = new P.constructor(Math.sin(g.player.yaw), 0, Math.cos(g.player.yaw));
          const e = g.enemies.spawn(P.add(f.scale(1.6)), {}); e.dormant = true; const hp0 = e.hp; return hp0; }""")
        await tap(page)
        await gwait(page, 0.7)
        r2 = await page.evaluate("() => game.enemies.elves.filter(e => e.dormant || !e.alive).map(e => [e.alive, e.hp]).slice(-1)[0]")
        check("Left click swings the cane and hits", r2 is not None and (not r2[0] or r2[1] < r), f"hp {r} -> {r2}")
        await page.screenshot(path="out/iss_06_cane.png")
        await page.evaluate("() => game.enemies.elves.forEach(e => e.alive && game.enemies.hit(e, 99, e.body.position, 'bullet', 1))")
        await gwait(page, 1.5)
        await page.screenshot(path="out/iss_07_controls_tier1.png")

        # Double jump (Level 1, flat ground)
        await load(page, 1)
        await skip_cutscene(page)
        async def jump_height(double):
            # The second press is sent from inside the game loop when Santa nears the
            # top of his first jump (the software renderer is too slow to time it from here).
            return await page.evaluate("""async (double) => {
              const g = game, pl = g.player, b = pl.body; b.position.set(-4, 0, -12); b.velocity.setAll(0);
              const key = (type) => window.dispatchEvent(new KeyboardEvent(type, {code: 'Space', key: ' '}));
              let maxY = 0, pressed = false; const o = pl.update.bind(pl);
              pl.update = (dt) => { o(dt); maxY = Math.max(maxY, b.position.y);
                if (double && !pressed && pl.jumpsUsed === 1 && b.velocity.y < 2.5) { pressed = true; key('keyup'); key('keydown'); } };
              const until = async (t) => { const t0 = g.time; while (g.time - t0 < t) await new Promise(r => setTimeout(r, 5)); };
              await until(0.3); maxY = 0; key('keydown'); await until(1.8); key('keyup'); await until(0.5); pl.update = o; return maxY; }""", double)
        h1 = await jump_height(False)
        h2 = await jump_height(True)
        check("Double jump goes clearly higher", h2 > h1 + 0.9, f"single {h1:.2f} m, double {h2:.2f} m")
        check("Chimney (step 0.95 m, opening 2.4 m) easy to get into", h2 > 2.4 - 0.9 + 0.1 and h1 > 0.95, f"single {h1:.2f}, double {h2:.2f}")

        # Level 1: cane at start, cap gun from Gérard's crate, taps fire
        w = await page.evaluate("() => [store.getState().weapon, game.player.owned.slice()]")
        check("Level 1 starts with the cane, no gun yet", w[0] == "cane" and w[1] == [], str(w))
        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        await gwait(page, 0.6)
        w = await page.evaluate("() => [store.getState().weapon, game.player.owned.slice()]")
        check("Level 1 crate gives the cap gun", w[0] == "capgun", str(w))
        await page.evaluate("() => { window.__shots = 0; const P = game.player; const o = P.fire.bind(P); P.fire = (id) => { window.__shots++; o(id); }; window.__unfire = () => { P.fire = o; }; }")
        for _ in range(3):
            await tap(page)
            await gwait(page, 0.4)
        shots = await page.evaluate("() => { window.__unfire(); return window.__shots; }")
        # Hold left, then press right too (a chorded press arrives as a pointermove): still a melee.
        await page.mouse.down()
        await page.mouse.down(button="right")
        held = await page.evaluate("() => game.input.held.has('melee') || game.input.peek('melee', 0.5)")
        await page.mouse.up(button="right"); await page.mouse.up()
        check("Right click while holding left registers", bool(held))
        check("Real mouse clicks fire the gun (quick taps too)", shots == 3, f"{shots}/3")
        # Stall awning edge
        a = math.pi / 9; x = math.cos(a) * 13; z = math.sin(a) * 13; yaw = math.atan2(-x, -z)
        def loc(lz): return [x + lz * math.sin(yaw), 3.5, z + lz * math.cos(yaw)]
        FALL = """([x, y, z]) => { const g = game, b = g.player.body; b.position.set(x, y, z); b.velocity.setAll(0); b.grounded = false;
          for (let i = 0; i < 60; i++) { b.velocity.y -= 28/60; g.physics.move(b, 1/60); } return b.position.y; }"""
        on = await page.evaluate(FALL, loc(0.4)); off = await page.evaluate(FALL, loc(1.6))
        check("Stall awning: solid on it, no floating past its edge", on > 2.5 and off < 0.2, f"on {on:.2f}, past edge {off:.2f}")
        # Outer gingerbread house roof
        hx, hz = math.cos(0.15) * 28, math.sin(0.15) * 28
        far = await page.evaluate(FALL, [hx + 3.4, 6, hz])
        check("No standing in the air past a house roof", far < 0.3, f"{far:.2f}")
        ex = await page.evaluate("() => [game.level.exit.pos.x, game.level.exit.pos.z]")
        check("Level 1 exit chimney not in front of the church", not (abs(ex[0]) < 4 and 18 < ex[1] < 27), str(ex))

        # Gun balance: time to kill a basic elf, holding the trigger, aimed at it
        await page.evaluate("() => { game.player.setArsenal(['capgun','shotgun','smg','flamer','launcher']); }")
        ttk = {}
        for gun, dist in [("capgun", 7), ("shotgun", 4), ("smg", 9), ("flamer", 4), ("launcher", 9)]:
            t = await page.evaluate("""async ([gun, dist]) => { const g = game, pl = g.player; pl.equip(gun);
              const P = pl.body.position; P.set(-4, 0, -12); pl.body.velocity.setAll(0);
              const e = g.enemies.spawn(new P.constructor(-4, 0, -12 + dist), {}); e.dormant = true;
              await new Promise(r => setTimeout(r, 100));
              // Aim like a player: put the crosshair (camera centre) on the elf.
              const aim = async () => { for (let i = 0; i < 4; i++) { const cam = g.camRig.camera.position; const d = e.center.subtract(cam);
                g.camRig.yaw = Math.atan2(d.x, d.z); g.camRig.pitch = -Math.asin(d.y / d.length()); await new Promise(r => setTimeout(r, 60)); } };
              await aim();
              const t0 = g.time; const canvas = document.getElementById('game');
              canvas.dispatchEvent(new PointerEvent('pointerdown', {button: 0, buttons: 1, bubbles: true}));
              while (e.alive && g.time - t0 < 6) { const cam = g.camRig.camera.position; const d = e.center.subtract(cam);
                g.camRig.yaw = Math.atan2(d.x, d.z); g.camRig.pitch = -Math.asin(d.y / d.length()); await new Promise(r => setTimeout(r, 10)); }
              window.dispatchEvent(new PointerEvent('pointerup', {button: 0, buttons: 0, bubbles: true}));
              const t = g.time - t0; if (e.alive) g.enemies.hit(e, 99, e.body.position, 'bullet', 1); return t; }""", [gun, dist])
            ttk[gun] = round(t, 2)
        limits = {"capgun": 0.9, "shotgun": 1.0, "smg": 0.8, "flamer": 1.3, "launcher": 1.2}
        check("Every gun kills a basic elf quickly", all(ttk[k] <= limits[k] for k in ttk), str(ttk))
        await page.evaluate("() => game.player.setArsenal([])")

        # Arsenal: a new, bigger gun each level
        expected = {2: ["capgun"], 3: ["capgun", "shotgun"], 4: ["capgun", "shotgun", "smg"], 5: ["capgun", "shotgun", "smg", "flamer"]}
        newg = {2: "shotgun", 3: "smg", 4: "flamer", 5: "launcher"}
        for lvl, guns in expected.items():
            await load(page, lvl)
            owned = await page.evaluate("() => game.player.owned.slice()")
            ng = await page.evaluate("() => game.level.newGun")
            check(f"Level {lvl} starts with {guns} and gives {newg[lvl]}", owned == guns and ng == newg[lvl], f"{owned} + {ng}")
            # Lantern lighting causes no shader recompiles
            if lvl == 2:
                await skip_cutscene(page)
                await gwait(page, 2)  # let first-use effects compile before measuring
                # The first lit flame compiles its material once; after that, lighting more
                # lanterns must never recompile (the old freeze came from changing the light count).
                c = await page.evaluate("""async () => { const n = () => Object.keys(game.engine._compiledEffects || {}).length;
                  const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                  game.level.lightLantern(game.level.lanterns[0]); await frames(); const a = n();
                  const before = Object.keys(game.engine._compiledEffects || {});
                  game.level.lightLantern(game.level.lanterns[1]); await frames();
                  return [a, n(), Object.keys(game.engine._compiledEffects || {}).filter(k => !before.includes(k)).map(k => k.split('@')[0])]; }""")
                check("Lighting a lantern recompiles no shaders (no freeze)", c[0] == c[1], str(c))

        # Layout audit on every level
        for lvl in range(6):
            await load(page, lvl)
            issues = await page.evaluate("() => game.level.audit()")
            known = [i for i in issues if not any(k in i for k in ("treeLot", "cabane_m", "bleachers_m"))]
            check(f"Level {lvl} layout audit clean", not known, "; ".join(known[:4]))

        # Drop off a box edge: no sideways teleport
        await load(page, 1)
        jump = await page.evaluate("""() => { const g = game, b = g.player.body; let worst = 0;
          for (const [vx, vz] of [[5,-0.6],[5,0.6],[-5,0.4],[0.5,5],[0.4,-5],[4,4],[-4,-4]]) {
            b.position.set(-6.8, 1.21, -6); b.velocity.setAll(0); let prev = b.position.clone();
            for (let i = 0; i < 40; i++) { b.velocity.x = vx; b.velocity.z = vz; b.velocity.y -= 28/60; g.physics.move(b, 1/60);
              worst = Math.max(worst, Math.hypot(b.position.x - prev.x, b.position.z - prev.z) - Math.hypot(vx, vz)/60); prev = b.position.clone(); } }
          return worst; }""")
        check("Dropping off a box never shoves you sideways", jump < 0.02, f"worst extra jump {jump:.3f} m")

        # Elf hats close-up
        await page.evaluate("""() => { const g = game; store.setState({dialogue: null, showControls: false}); g.player.frozen = true;
          const V = g.player.body.position.constructor; g.player.body.position.set(0, 0, -16);
          for (const [x, yaw] of [[-0.8, Math.PI], [0.8, Math.PI * 0.75]]) { const e = g.enemies.spawn(new V(x, 0, -13.5), {yaw}); e.dormant = true; }
          g.camRig.cut(new V(0.3, 1.5, -16.2), new V(0, 1.0, -13.5), 0); }""")
        await gwait(page, 0.6)
        await page.screenshot(path="out/iss_08_hats_front.png")
        await page.evaluate("() => { const V = game.player.body.position.constructor; game.camRig.cut(new V(-2.2, 1.3, -13.2), new V(0, 1.0, -13.5), 0); }")
        await gwait(page, 0.5)
        await page.screenshot(path="out/iss_09_hats_side.png")

        # Same chimney exit (shrink + drop in) in every level
        for lvl in range(6):
            await load(page, lvl)
            await skip_cutscene(page)
            await page.evaluate("() => { game.player.frozen = false; game.level.openExit(); const e = game.level.exit; game.player.body.position.set(e.pos.x, e.pos.y + 0.1, e.pos.z); game.player.body.velocity.setAll(0); }")
            shrank = False
            drift = 0.0
            for _ in range(60):
                await asyncio.sleep(0.1)
                if await page.evaluate("() => store.getState().letterbox"): await page.keyboard.press("Enter")
                st = await page.evaluate("() => { const P = game.player, e = game.level.exitUsed || game.level.exit.pos; return [P.rig.root.scaling.x, P.rig.root.isEnabled(), Math.hypot(P.body.position.x - e.x, P.body.position.z - e.z)]; }")
                if st[0] < 0.99: drift = max(drift, st[2])
                if st[0] < 0.6: shrank = True
                if not st[1]:
                    shrank = True; break
            check(f"Level {lvl}: Santa shrinks straight down into the chimney", shrank and drift < 0.15, f"sideways drift {drift:.2f} m")

        # Exit: dialogue first (Santa still full size), then the dive
        await load(page, 1)
        await skip_cutscene(page)
        await page.evaluate("() => { game.level.openExit(); const e = game.level.exit; game.player.body.position.set(e.pos.x, e.pos.y + 0.1, e.pos.z); game.player.body.velocity.setAll(0); }")
        await until(page, "() => store.getState().letterbox && !!store.getState().dialogue", 10)
        sc = await page.evaluate("() => game.player.rig.root.scaling.x")
        check("Exit dialogue plays before Santa shrinks", sc > 0.99, f"scale during dialogue {sc:.2f}")
        for _ in range(10):
            if await page.evaluate("() => store.getState().letterbox"):
                await page.keyboard.press("Enter"); await asyncio.sleep(0.4)
        shr = await until(page, "() => game.player.rig.root.scaling.x < 0.6 || !game.player.rig.root.isEnabled()", 8)
        check("…then he shrinks into the chimney", shr)

        # Test mode: Options → level picker
        await page.evaluate("() => { game.loadTitle(true); }")
        await until(page, "() => store.getState().screen === 'title'", 10)
        await page.evaluate("() => store.getState().setSettings({ debug: true })")
        await asyncio.sleep(4)  # let the title's entrance animation settle (slow under SwiftShader)
        diag = await page.evaluate("""() => { const el=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Options'); const r=el.getBoundingClientRect(); const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return [r.x|0, r.y|0, top===el||el.contains(top), top.tagName + '.' + String(top.className).slice(0,60), document.querySelectorAll('div.fixed.inset-0').length]; }""")
        print("options-diag", diag, await page.evaluate("() => !!document.pointerLockElement"))
        await page.get_by_text("Options", exact=True).click(force=True)
        await until(page, "() => !!document.querySelector('[role=dialog]')", 10)
        await asyncio.sleep(1.5)
        await page.screenshot(path="out/iss_10_debug_options.png")
        btn = page.get_by_role("button", name="3 · Glissades")
        has = await btn.count()
        check("Options → Mode test shows a button per level", has > 0)
        if has:
            await btn.first.click()
            ok = await until(page, "() => store.getState().screen === 'playing' && game.level.id === 3 && game.level.startCheckpoint === 0", 15)
            check("Picking '3 · Glissades' starts level 3", ok)
        await page.evaluate("() => store.getState().setSettings({ debug: false })")

        check("No page errors", not errors, "; ".join(errors[:3]))
        print(f"\n{sum(1 for r in results if r[1])}/{len(results)} passed")
        await b.close()
if __name__ == "__main__": asyncio.run(main())
