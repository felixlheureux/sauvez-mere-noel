import asyncio, json
from playwright.async_api import async_playwright
from issues import gwait, load, skip_cutscene, until, URL, READY
PROF = """async (sec) => { const g = game; const acc = {}; const wraps = [];
  const wrap = (obj, name, key) => { const o = obj[name]; obj[name] = function(...a){ const t=performance.now(); const r=o.apply(this,a); acc[key]=(acc[key]||0)+performance.now()-t; return r; }; wraps.push(() => obj[name] = o); };
  wrap(g.player,'update','player'); wrap(g.enemies,'update','enemies'); wrap(g.projectiles,'update','proj'); wrap(g.level,'update','level');
  wrap(g.gore,'update','gore'); wrap(g.fx,'update','fx'); wrap(g.camRig,'update','cam'); wrap(g.env,'update','env'); wrap(g.scene,'render','render');
  if (g.level.updateAuras) wrap(g.level,'updateAuras','auras');
  let frames = 0; const ob = g.scene.onAfterRenderObservable.add(() => frames++);
  await new Promise(r => setTimeout(r, sec * 1000));
  wraps.forEach(f => f()); g.scene.onAfterRenderObservable.remove(ob);
  const out = {}; for (const k in acc) out[k] = +(acc[k]/frames).toFixed(2);
  out.frames = frames; out.meshes = g.scene.meshes.length; out.active = g.scene.getActiveMeshes().length;
  out.ps = g.scene.particleSystems.length; out.psActive = g.scene.particleSystems.filter(p => p.isStarted()).length; out.lights = g.scene.lights.length; out.materials = g.scene.materials.length;
  out.drawCalls = g.engine._drawCalls?.current; out.scale = g.engine.getHardwareScalingLevel(); return out; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal","--ignore-gpu-blocklist","--enable-gpu"])
        page = await b.new_page(viewport={"width":1280,"height":720})
        await page.goto(URL); await until(page, READY)
        print("title", json.dumps(await page.evaluate(PROF, 4)))
        for lvl in range(6):
            await load(page, lvl); await skip_cutscene(page); await gwait(page, 1)
            print(lvl, json.dumps(await page.evaluate(PROF, 5)))
        await b.close()
asyncio.run(main())
