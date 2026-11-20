"""Enemy steering: elves don't walk off ledges into a deadly fall (slush, grinder), do follow
Santa down a tier, get round obstacles, and the last few stragglers get markers."""
import asyncio
from playwright.async_api import async_playwright
from issues import check, gwait, load, results, skip_cutscene, until, URL, READY

FRAMES = "const frames = (n) => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });"
PRE = """const g = game, P = g.player, b = P.body, V = b.position.constructor; """ + FRAMES + """
  for (const e of g.enemies.elves) if (e.alive) g.enemies.hit(e, 999, e.body.position, 'bullet', 0); g.enemies.clear(); g.projectiles.clear();
  P.invuln = 1e6; P.hp = 1e6; P.frozen = true; if (store.getState().dialogue) store.setState({dialogue: null});
  const chaser = (x, y, z) => { const e = g.enemies.spawn(new V(x, y, z), {}); e.aggro = true; e.setState('chase'); return e; };"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"])
        page = await br.new_page(viewport={"width": 1280, "height": 720})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(URL); await until(page, READY)

        # Level 6: Santa on the next roof; the elf leaps every roof gap on the route and lands.
        await load(page, 6); await skip_cutscene(page, 30)
        from_ = await page.evaluate("async () => (await import('/src/levels/Level6.ts')).JUMPS.map(j => ({f: j.from, t: j.to, double: j.double}))")
        for j in from_:
            f, t = j["f"], j["t"]
            r = await page.evaluate("async ([f, t]) => { " + PRE + """
              const dir = Math.sign((t.z - f.z) || 1), side = Math.abs(t.z - f.z) > Math.abs(t.x - f.x);
              b.position.set(t.x, t.h + 0.05, t.z); b.velocity.setAll(0);
              const sx = side ? f.x : f.x - Math.sign(t.x - f.x) * (f.w / 2 - 1.2), sz = side ? f.z - dir * (f.d / 2 - 1.2) : f.z;
              const e = chaser(sx, f.h + 0.1, sz); let minY = 99, k = 0;
              for (; k < 400; k++) { minY = Math.min(minY, e.body.position.y); if (e.body.grounded && Math.abs(e.body.position.x - t.x) < t.w / 2 && Math.abs(e.body.position.z - t.z) < t.d / 2 && e.body.position.y > t.h - 0.3) break; await frames(1); }
              const p = e.body.position; const on = Math.abs(p.x - t.x) < t.w / 2 && Math.abs(p.z - t.z) < t.d / 2 && p.y > t.h - 0.3;
              return {alive: e.alive, on, minY: +minY.toFixed(2), s: +(k / 60).toFixed(1), gap: +(Math.max(Math.abs(t.z - f.z) - (t.d + f.d) / 2, Math.abs(t.x - f.x) - (t.w + f.w) / 2)).toFixed(1), up: +(t.h - f.h).toFixed(1)}; }""", [f, t])
            check(f"Rooftops: an elf leaps the {r['gap']} m gap (up {r['up']}) to Santa's roof and lands", r["alive"] and r["on"], str(r))

        # ...but with no roof across (Santa down in the street), it stays up.
        r = await page.evaluate("async () => { " + PRE + """
          b.position.set(-6, 0.5, -46.5); b.velocity.setAll(0);
          const e = chaser(0, 7, -51); let minY = 99;
          for (let i = 0; i < 240; i++) { minY = Math.min(minY, e.body.position.y); await frames(1); }
          return {alive: e.alive, minY: +minY.toFixed(2)}; }""")
        check("Rooftops: with Santa in the slush street, the elf doesn't jump off the roof", r["alive"] and r["minY"] > 6.5, str(r))

        # Level 9: Santa a tier below; the elf follows him down.
        await load(page, 9); await skip_cutscene(page, 30)
        r = await page.evaluate("async () => { " + PRE + """
          b.position.set(0, 6.05, -19.5); b.velocity.setAll(0);
          const e = chaser(0, 12, -14.5); let t = 0;
          while (e.body.position.y > 7 && t++ < 400) await frames(1);
          return {alive: e.alive, y: +e.body.position.y.toFixed(2)}; }""")
        check("Gift mountain: an elf follows Santa down a tier (the drop is safe)", r["alive"] and r["y"] < 7, str(r))

        # A wall between them: the elf goes round it.
        await load(page, 10); await skip_cutscene(page, 30)
        r = await page.evaluate("async () => { " + PRE + """
          b.position.set(0, 0, -29); b.velocity.setAll(0);
          const wall = g.physics.addBox(new V(0, 1.5, -35), new V(7, 3, 0.6));
          const e = chaser(0, 0, -41); let t = 0, d = 99;
          while (t++ < 600) { d = Math.hypot(e.body.position.x - b.position.x, e.body.position.z - b.position.z); if (d < 2) break; await frames(1); }
          wall.enabled = false; return {reached: d < 2, d: +d.toFixed(2), seconds: +(t / 60).toFixed(1)}; }""")
        check("An elf with a wall between it and Santa gets round it and reaches him", r["reached"], str(r))

        # Level 7: Santa across the grinder; the elf doesn't walk in.
        await load(page, 7); await skip_cutscene(page, 30)
        r = await page.evaluate("async () => { " + PRE + """
          b.position.set(11.2, 0, -25.5); b.velocity.setAll(0);
          const e = chaser(4.3, 0, -25.5); for (let i = 0; i < 240; i++) await frames(1);
          return {alive: e.alive, x: +e.body.position.x.toFixed(2)}; }""")
        check("Factory: an elf won't walk into the grinder to reach Santa", r["alive"], str(r))

        # Stragglers: markers once the last few have been hard to find for a while.
        await load(page, 1); await skip_cutscene(page, 30)
        r = await page.evaluate("async () => { " + PRE + """
          P.frozen = false; store.setState({pointerLocked: true});
          chaser(-25, 0, 20); chaser(25, 0, 22); await frames(10);
          const before = g.stragglerScreens().length; g.quietTime = 25; await frames(40);
          const marks = [...document.querySelectorAll('.border-t-red-500')].filter(m => parseFloat(getComputedStyle(m.closest('[style]')).opacity) > 0.5).length;
          return {before, after: g.stragglerScreens().length, shown: marks}; }""")
        check("No markers while the fight is fresh", r["before"] == 0, str(r))
        check("After a while with only stragglers left, each gets a red marker", r["after"] == 2 and r["shown"] == 2, str(r))
        await page.screenshot(path="out/steering_markers.png")
        check("No page errors", not errors, str(errors[:3]))
        await br.close()
    print(f"\n{sum(ok for _, ok, _ in results)}/{len(results)} passed")

if __name__ == "__main__":
    asyncio.run(main())
