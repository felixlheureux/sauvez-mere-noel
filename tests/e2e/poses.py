"""Weapon holding: every weapon in every pose (idle, running, in the air, aiming up/down,
cane slash frames) stays above the floor. Screenshots: out/pose_*.png"""
import asyncio
from playwright.async_api import async_playwright
from issues import check, gwait, load, results, until, URL, READY

SETUP = """() => { const g = game, P = g.player; const V = P.body.position.constructor;
  const at = new V(0, g.physics.floorAt(0, -19), -19);
  P.body.position.copyFrom(at); P.body.velocity.setAll(0); P.yaw = 0.5; P.rig.root.position.copyFrom(at); P.rig.root.rotation.y = 0.5;
  P.hasCane = true; for (const id of ['capgun', 'shotgun', 'smg', 'flamer', 'launcher', 'icicle']) P.giveGun(id, false);
  const c = g.canvas; for (const e of document.querySelectorAll('body *')) if (e !== c && !e.contains(c)) e.style.visibility = 'hidden'; }"""
# Camera placed directly (the game is paused, so nothing moves it): front 3/4 and side views.
VIEW = """([dx, dy, dz]) => { const P = game.player, c = game.camRig.camera; const at = P.body.position;
  c.position.set(at.x + dx, at.y + dy, at.z + dz); c.setTarget(at.add(new at.constructor(0, 1.1, 0))); }"""
VIEWS = {"front": [2.0, 1.6, 3.4], "side": [3.8, 1.3, 0.4]}

# Put Santa in a pose by driving the animator directly (the game is paused), then report
# the lowest point of the held weapon relative to the floor, sampled over the pose.
POSE = """async ([weapon, speed, grounded, aim, pitch, clipT]) => {
  const g = game, P = g.player, A = P.anim, l = A.loco;
  P.equip(weapon === 'cane' ? 'fists' : weapon);
  const mesh = weapon === 'cane' ? P.cane : P.guns[weapon];
  mesh.setEnabled(true);
  Object.assign(l, {speed, grounded, vy: grounded ? 0 : 3, aim, aimPitch: pitch,
    hold: weapon === 'cane' ? 'cane' : weapon === 'capgun' ? 'pistol' : 'rifle'});
  const floor = g.physics.floorAt(P.body.position.x, P.body.position.z);
  const lowest = () => { P.rig.root.computeWorldMatrix(true);
    for (const n of [P.rig.joints.body, P.rig.joints.hips, P.rig.joints.chest, P.rig.joints.armR, P.rig.joints.hand, mesh]) n.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(); return mesh.getBoundingInfo().boundingBox.minimumWorld.y - floor; };
  let low = 99;
  if (clipT !== null) { A.play(CLIPS_caneSwing()); A.update(clipT); low = lowest(); }
  else { A.stop(); for (let i = 0; i < 40; i++) { A.update(1 / 30); low = Math.min(low, lowest()); } }
  return +low.toFixed(2); }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"])
        page = await b.new_page(viewport={"width": 1024, "height": 576})
        await page.goto(URL); await until(page, READY)
        await load(page, 1)
        await page.evaluate(SETUP)
        await gwait(page, 0.3)
        # The cane-swing clip, read from the player's own animator the first time Santa swings it.
        await page.evaluate("""() => { const P = game.player; const A = P.anim; const o = A.play.bind(A); let clip = null;
          A.play = (c) => { clip = clip || c; return o(c); }; P.caneSwing(); window.CLIPS_caneSwing = () => clip; A.play = o; game.paused = true; }""")
        await page.evaluate("() => { game.player.yaw = 0; game.player.rig.root.rotation.y = 0; }")
        weapons = ["cane", "capgun", "shotgun", "smg", "flamer", "launcher", "icicle"]
        # aimPitch > 0 lowers the arm (camera looking down).
        poses = {"idle": (0, True, 0, 0), "run": (9, True, 0, 0), "air": (0, False, 0, 0),
                 "aim": (0, True, 1, 0), "aim-down": (0, True, 1, 0.99), "aim-up": (0, True, 1, -0.58)}
        lows = {}
        for w in weapons:
            for name, (speed, grounded, aim, pitch) in poses.items():
                if w == "cane" and aim: continue
                low = await page.evaluate(POSE, [w, speed, grounded, aim, pitch, None])
                lows[(w, name)] = low
                if name in ("idle", "aim", "run", "aim-down"):
                    for v, off in VIEWS.items():
                        await page.evaluate(VIEW, off); await asyncio.sleep(0.1)
                        await page.screenshot(path=f"out/pose_{w}_{name}_{v}.png")
        for t in (0.06, 0.12, 0.2, 0.26, 0.4):
            low = await page.evaluate(POSE, ["cane", 0, True, 0, 0, t])
            lows[("cane", f"slash {t}")] = low
            for v, off in VIEWS.items():
                await page.evaluate(VIEW, off); await asyncio.sleep(0.1)
                await page.screenshot(path=f"out/pose_cane_slash{int(t * 100):02d}_{v}.png")
        for w in weapons:
            mine = {k[1]: v for k, v in lows.items() if k[0] == w}
            check(f"{w}: held above the floor in every pose", min(mine.values()) > 0.05, str(mine))
        check("Cane points up while idle (tip above the hand)", await page.evaluate("""() => { const P = game.player;
          P.equip('fists'); P.anim.stop(); P.anim.loco.speed = 0; P.anim.loco.aim = 0; P.anim.loco.hold = 'cane'; P.anim.update(1/30);
          P.rig.root.computeWorldMatrix(true); for (const n of [P.rig.joints.chest, P.rig.joints.armR, P.rig.joints.hand, P.cane]) n.computeWorldMatrix(true);
          P.cane.refreshBoundingInfo(); return P.cane.getBoundingInfo().boundingBox.maximumWorld.y > P.rig.joints.hand.getAbsolutePosition().y + 0.4; }"""))
        await b.close()
    print(f"{sum(ok for _, ok, _ in results)}/{len(results)} passed")

if __name__ == "__main__":
    asyncio.run(main())
