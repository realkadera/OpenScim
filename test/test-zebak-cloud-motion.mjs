import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";
import {createRequire} from "node:module";
import path from "node:path";
import {CloudMotion} from "../client/toa/zebak/cloud-motion.js";
const require = createRequire(import.meta.url);
const {PNG} = require(path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"));

const turn = new CloudMotion();
assert.deepEqual(turn.sample([1,0],[0,0],1,30),[0,0]);
assert.deepEqual(turn.sample([1,0],[0,0],1,59),[116/128,0]);
assert.deepEqual(turn.sample([1,1],[1,0],2,60),[120/128,0]);
assert.deepEqual(turn.sample([1,1],[1,0],2,62),[1,0]);
assert.deepEqual(turn.sample([1,1],[1,0],2,63),[1,4/128]);
assert.deepEqual(turn.sample([0,0],[0,0],0,0),[0,0]);

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage({viewport:{width:1280,height:850}});
  for (const [url, marker, probe] of [
    ["**/engine/SimulationEngine.js*","this.encounter = options.encounter;","if(options.encounter.kind==='zebak')window.engine=this;"],
    ["**/toa/zebak/native.js*","scene.setEncounterRenderConfig(renderConfig);","window.scene=scene;"],
  ]) {
    await page.route(url, async route => {
      const response = await route.fetch();
      const body = await response.text();
      assert.ok(body.includes(marker));
      await route.fulfill({response, body:body.replace(marker,marker+probe)});
    });
  }
  for (const thinned of [false,true]) {
    await page.goto(process.env.TEST_ORIGIN + "/zebak/");
    await page.waitForFunction(() => document.body.innerText.includes("580/580"));
    await page.waitForTimeout(2100);
    await page.mouse.click(640,425);
    const result = await page.evaluate(async thinned => {
      const typeId = thinned ? 11743 : 11742;
      engine.encounter.configureRunStart({blood:true, clouds:thinned});
      engine.encounter.random = () => 0;
      engine.encounter.phases.random = () => 0;
      engine.encounter.autoCount = 5;
      engine.encounter.bloodSpellIndex = 0;
      engine.encounter.attackTick = 0;
      const samples = new Map();
      const manager = scene.npcInstanceManager;
      let count, maxFractionalPositions = 0;
      const deadline = performance.now()+5500;
      while (performance.now()<deadline && maxFractionalPositions<4) {
        await new Promise(requestAnimationFrame);
        const clouds = [...manager.instanceRegistry.values()].filter(m => m.npcTypeId===typeId);
        if (!clouds.length) continue;
        count = clouds.length;
        const cloud = clouds[0];
        const matrix = cloud.instanceMeshCommands[0].modelMatrix;
        const y = matrix[13] - cloud.lastRenderSize / 2;
        if (Math.abs(y-Math.round(y))<0.01) continue;
        const tick = engine.worldState.tick;
        if (!samples.has(tick)) samples.set(tick,new Set());
        samples.get(tick).add(y.toFixed(3));
        maxFractionalPositions = Math.max(maxFractionalPositions,samples.get(tick).size);
      }
      const type = manager.typeRegistry.get(typeId);
      return {count, size:type.size, scale:type.widthScale, walk:type.animationSet.walk.seqId, maxFractionalPositions};
    },thinned);
    assert.equal(result.count,thinned?3:1);
    assert.equal(result.size,thinned?1:2);
    assert.equal(result.scale,thinned?128:230);
    assert.equal(result.walk,8101);
    assert.ok(result.maxFractionalPositions>=4);
    const centers = new Map();
    for (let frame = 0; frame < 18; frame++) {
      const before = await page.evaluate(() => engine.worldState.tick);
      const image = PNG.sync.read(await page.screenshot({clip:{x:170,y:395,width:435,height:96}}));
      const after = await page.evaluate(() => engine.worldState.tick);
      if (before !== after) continue;
      let sumX = 0, count = 0;
      for (let i = 0; i < image.data.length; i += 4) {
        const [r,g,b] = image.data.subarray(i,i+3);
        if (r > 80 && g < r * 0.28 && b < r * 0.28) {
          sumX += (i / 4) % image.width;
          count++;
        }
      }
      if (count < 120) continue;
      if (!centers.has(after)) centers.set(after, new Set());
      centers.get(after).add(Math.round(sumX / count));
      if (centers.get(after).size >= 3) break;
    }
    const pixels = [...centers.values()].find(xs => xs.size >= 3);
    assert.ok(pixels && Math.max(...pixels)-Math.min(...pixels)>=2, "clot pixels did not move within one tick");
    console.log("Rendered clot positions within one tick (crop pixels)", [...pixels]);
    console.log(thinned?"Blood Thinners":"Normal",result);
  }
} finally {
  await browser.close();
}
