"""Niveau 8 — Les Écuries des Rennes: the reindeer charge (telegraph, hit, dodge, daze),
the crossbow's sticky bolts, freeing the captives, Comète, and the run to the chimney.
Screenshots: out/l8_*.png"""
import asyncio
from playwright.async_api import async_playwright
from issues import check, gwait, load, results, skip_cutscene, until, URL, READY

MOD = "await import('/src/levels/Level8.ts')"
ELF = "await import('/src/enemies/Elf.ts')"
CALM = """const calm = () => { for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, e.body.position, 'bullet', 0);
  g.enemies.clear(); g.projectiles.clear(); P.invuln = 0; P.hp = 100; P.frozen = false; P.buffs.rage = 0; if (store.getState().dialogue) store.setState({dialogue: null}); }; calm();"""
FRAMES = "const frames = (n) => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });"
KEY = "const key = (t, c) => window.dispatchEvent(new KeyboardEvent(t, {code: c, bubbles: true}));"
# Aim the real camera at a point: the camera orbits and eases as yaw/pitch change, so keep
# correcting until its ray really passes within 5 cm of the target.
AIM = """const aim = async (t) => { for (let k = 0; k < 20; k++) { const c = g.camRig.camera.position; const d = t.subtract(c);
  g.camRig.yaw = Math.atan2(d.x, d.z); P.yaw = g.camRig.yaw; g.camRig.pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z)); await frames(3);
  const o = g.camRig.camera.position, f = g.camRig.forward, v = t.subtract(o); const along = v.x * f.x + v.y * f.y + v.z * f.z;
  if (v.subtract(f.scale(along)).length() < 0.05) break; } };"""
PRE = "const g = game, P = g.player, b = P.body, V = b.position.constructor; const E = " + ELF + "; " + FRAMES + KEY + AIM + CALM

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"])
        page = await br.new_page(viewport={"width": 1280, "height": 720})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(URL); await until(page, READY)
        await load(page, 8)
        audit = await page.evaluate("() => game.level.audit()")
        check("Level 8 layout audit clean", audit == [], str(audit))
        owned = await page.evaluate("() => game.player.owned.slice()")
        check("Starts with the seven guns of levels 1–7", len(owned) == 7 and owned[-1] == "garland", str(owned))
        await skip_cutscene(page, 30)
        await page.screenshot(path="out/l8_01_paddock.png")
        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        await until(page, "() => game.player.owned.includes('crossbow')", 10)
        check("The crate gives the Arbalète à Cannes", await page.evaluate("() => game.player.weapon") == "crossbow")
        await skip_cutscene(page, 10)

        # ---- Crossbow: the bolt sticks, then explodes ----
        r = await page.evaluate("async () => { " + PRE + """
          b.position.set(-12, 0, -50); b.velocity.setAll(0); await frames(8);
          const a = g.enemies.spawn(new V(-12, 0, -43), {}), n = g.enemies.spawn(new V(-10.5, 0, -42.5), {}); a.dormant = n.dormant = true;
          await frames(4); await aim(a.center); P.fire('crossbow'); await frames(6);
          const right = {target: a.alive, neighbour: n.alive, stuck: g.levelRoot.getChildMeshes(false, m => m.name.startsWith('caneBolt')).length};
          await frames(70); return {right, later: {target: a.alive, neighbour: n.alive}}; }""")
        check("Crossbow: right after the shot, the bolt is stuck in the elf and nothing has exploded", r["right"]["target"] and r["right"]["neighbour"] and r["right"]["stuck"] >= 1, str(r))
        check("…0.9 s later it explodes, killing the elf and its neighbour", not r["later"]["target"] and not r["later"]["neighbour"], str(r))

        # ---- The reindeer's charge ----
        CHARGE = "async (dodge) => { " + PRE + """
          b.position.set(0, 0, -40); b.velocity.setAll(0); P.yaw = 0; g.camRig.yaw = 0; await frames(8);
          const e = g.enemies.spawn(new V(0, 0, -30), {tuning: E.REINDEER, yaw: Math.PI}); e.aggro = true; e.setState('chase');
          let t = 0; while (e.state !== 'windup' && t++ < 400) await frames(1);
          const t0 = g.time; const hp0 = P.hp;
          if (dodge) { key('keydown', 'KeyD'); await frames(2); key('keydown', 'KeyQ'); await frames(3); key('keyup', 'KeyQ'); }
          t = 0; while (e.state === 'windup' && t++ < 200) await frames(1); const windup = g.time - t0;
          t = 0; while (e.state === 'attack' && t++ < 200) await frames(1);
          if (dodge) key('keyup', 'KeyD');
          await frames(20); return {windup: +windup.toFixed(2), hpLost: hp0 - P.hp}; }"""
        r = await page.evaluate(CHARGE, False)
        check("A reindeer telegraphs its charge for ~0.85 s (head down, eyes flare)", 0.75 < r["windup"] < 1.0, str(r))
        check("Standing still, the charge hits hard (22)", r["hpLost"] == 22, str(r))
        r = await page.evaluate(CHARGE, True)
        check("Dashing aside (Q) when it lowers its head dodges the charge", r["hpLost"] == 0, str(r))
        r = await page.evaluate("async () => { " + PRE + """
          b.position.set(6, 0, -26.5); b.velocity.setAll(0); await frames(8);
          const e = g.enemies.spawn(new V(6, 0, -38), {tuning: E.REINDEER, yaw: 0}); e.aggro = true; e.setState('chase');
          let t = 0, dazed = false; while (t++ < 400) { if (e.stunned) { dazed = true; break; } await frames(1); }
          return {dazed, hpLost: 100 - P.hp, z: +e.body.position.z.toFixed(2)}; }""")
        check("A reindeer charging into a post (Santa behind it) ends up dazed", r["dazed"] and r["hpLost"] == 0, str(r))
        r = await page.evaluate("async () => { " + PRE + """
          b.position.set(0, 0, -40); b.velocity.setAll(0); P.yaw = 0; g.camRig.yaw = 0; await frames(8);
          const e = g.enemies.spawn(new V(0, 0, -38.6), {tuning: E.COMETE, yaw: Math.PI}); e.dormant = true; await frames(4); e.stun = 3;
          const key2 = key; window.dispatchEvent(new PointerEvent('pointerdown', {button: 2, buttons: 2, bubbles: true}));
          g.canvas.dispatchEvent(new PointerEvent('pointerdown', {button: 2, buttons: 2, bubbles: true}));
          await frames(3); window.dispatchEvent(new PointerEvent('pointerup', {button: 2, buttons: 0, bubbles: true}));
          await frames(30); const hp = e.hp; const alive = e.alive; g.enemies.hit(e, 999, b.position, 'bullet', 0); return {hp, alive}; }""")
        check("A finisher on a dazed Comète takes a chunk (15), not the whole bar", r["alive"] and r["hp"] == 245, str(r))
        r = await page.evaluate("async () => { " + PRE + """
          b.position.set(0, 0, -50); b.velocity.setAll(0); await frames(8); P.equip('crossbow');
          const e = g.enemies.spawn(new V(0, 0, -40), {tuning: E.COMETE, yaw: Math.PI}); e.dormant = true; await frames(4);
          const shoot = async () => { await aim(e.center); P.fireCd = 0; P.fire('crossbow'); await frames(75); };
          const h0 = e.hp; await shoot(); const moving = h0 - e.hp;
          e.stun = 3; const h1 = e.hp; await shoot(); const dazed = h1 - e.hp;
          g.enemies.hit(e, 999, b.position, 'bullet', 0); return {moving: +moving.toFixed(1), dazed: +dazed.toFixed(1)}; }""")
        check("Comète shrugs off most of a bolt while it moves (30%: 4.8)", abs(r["moving"] - 4.8) < 0.3, str(r))
        check("…but takes the full bolt (16) while dazed", abs(r["dazed"] - 16) < 0.3, str(r))

        # ---- A chain post breaks in a few shots and frees its reindeer ----
        m = await page.evaluate(f"async () => {{ const m = {MOD}; return {{captives: m.CAPTIVES, hp: m.CHAIN_HP, barn: m.BARN, corral: m.CORRAL}}; }}")
        c0 = m["captives"][0]
        r = await page.evaluate("async (c) => { " + PRE + """
          // In the aisle, level with the stall, facing it (as a player would).
          b.position.set(-Math.sign(c.postX) * 1.5, 0, c.z); b.velocity.setAll(0); await frames(8); P.equip('capgun');
          const alive = () => g.level.breakables.some(k => k.pos.x === c.postX && k.pos.z === c.z); let n = 0;
          while (alive() && n < 8) { await aim(new V(c.postX, 0.9, c.z)); P.fireCd = 0; P.fire('capgun'); n++; await frames(20); }
          const npcs0 = g.level.npcs.length; await frames(480); return {shots: n, broke: !alive(), npcsLeft: g.level.npcs.length - npcs0}; }""", c0)
        check("A chain post breaks in 3 cap-gun shots", r["broke"] and r["shots"] == 3, str(r))
        check("…and the freed reindeer trots out of the stable", r["npcsLeft"] == -1, str(r))
        wp = await page.evaluate("() => { const t = game.objectiveTarget; return t ? [t.x, t.z] : null; }")
        check("The waypoint moves on from the broken chain to the next one", wp is not None and not (abs(wp[0] - c0["postX"]) < 0.1 and abs(wp[1] - c0["z"]) < 0.1), str(wp))

        # ---- The whole script ----
        await load(page, 8); await skip_cutscene(page, 30)
        KILL = "() => { const g = game; for (const e of g.enemies.elves) if (e.alive && e.tuning.kind !== 'reindeer' || e.alive && !e.tuning.boss) g.enemies.hit(e, 999, g.player.body.position, 'bullet', 3); }"
        async def go(x, z):
            await page.evaluate("([x, z]) => { const P = game.player; P.hp = 1e6; P.body.position.set(x, 0.05, z); P.body.velocity.setAll(0); }", [x, z])
            await gwait(page, 0.4); await skip_cutscene(page, 10)
        await page.evaluate("() => { const c = game.level.pickups.find(p => !p.collected && p.radius === 1.2); game.player.body.position.copyFrom(c.pos); }")
        await page.evaluate("() => { window.__peak = 0; window.__kills0 = game.enemies.kills; window.__peakTimer = setInterval(() => { window.__peak = Math.max(window.__peak, game.enemies.aliveCount); }, 100); }")
        for _ in range(40):
            await gwait(page, 1.2); await page.evaluate(KILL); await skip_cutscene(page, 4)
            if await page.evaluate("() => store.getState().objective.includes('écurie')"): break
        r = await page.evaluate("() => { clearInterval(window.__peakTimer); return {kills: game.enemies.kills - window.__kills0, peak: window.__peak}; }")
        check("The paddock throws 25+ enemies at you, never more than 14 at once", r["kills"] >= 25 and r["peak"] <= 14, str(r))
        await page.screenshot(path="out/l8_02_paddock_fight.png")
        await go(0, m["barn"]["south"] + 2); await gwait(page, 1)
        check("Entering the stable saves checkpoint 1", await page.evaluate("() => game.level.checkpoint") == 1)
        await gwait(page, 1.5); await page.screenshot(path="out/l8_03_barn.png")
        await page.evaluate("() => { for (const k of [...game.level.breakables]) game.level.blastProps(k.pos.add(new k.pos.constructor(0, 0.8, 0)), 0.5, 99); }")
        for _ in range(30):
            await gwait(page, 1); await page.evaluate(KILL); await skip_cutscene(page, 4)
            if await page.evaluate("() => store.getState().objective.includes('corral')"): break
        check("Freeing all four reindeer (and clearing the stable) sends you to the corral", "corral" in await page.evaluate("() => store.getState().objective"))
        cz = m["corral"]["z"] - m["corral"]["r"]
        await go(0, cz - 1); await gwait(page, 0.5)
        check("Reaching the corral gate saves checkpoint 2", await page.evaluate("() => game.level.checkpoint") == 2)
        await go(0, cz + 4)
        await gwait(page, 1.2)
        await page.screenshot(path="out/l8_04_comete_intro.png")
        await skip_cutscene(page, 10); await gwait(page, 1)
        bar = await page.evaluate("() => store.getState().boss")
        check("Comète has a boss health bar", bar is not None and bar["name"] == "Comète Démoniaque", str(bar))
        gate = await page.evaluate("() => game.level.gateColliders.every(c => c.enabled)")
        check("The corral gate closes behind you for the fight", gate)
        await gwait(page, 2); await page.screenshot(path="out/l8_05_comete.png")
        # Dazed, so the hit counts in full (armor only applies while it moves): just past half.
        await page.evaluate("() => { const e = game.enemies.elves.find(e => e.alive && e.tuning.boss); e.stun = 0.5; game.enemies.hit(e, 140, e.body.position, 'bullet', 0); }")
        await gwait(page, 3)
        n = await page.evaluate("() => game.enemies.aliveCount")
        check("At half health, elves come to help Comète", n >= 4, f"{n} alive")
        await page.evaluate("() => { const e = game.enemies.elves.find(e => e.alive && e.tuning.boss); game.enemies.hit(e, 999, e.body.position, 'bullet', 0); }")
        for _ in range(20):
            await gwait(page, 1); await page.evaluate(KILL); await skip_cutscene(page, 4)
            if await page.evaluate("() => !!(game.level.exit && game.level.exit.open)"): break
        check("Comète beaten: bar gone, gate open, exit chimney open", await page.evaluate("() => store.getState().boss === null && game.level.exit.open && game.level.gateColliders.every(c => !c.enabled)"))
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
