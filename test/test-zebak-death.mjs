import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage({viewport:{width:1280,height:850}});
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.soundIds = new WeakMap();
    window.deathSounds = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(...args) {
      const id = window.soundIds.get(this.buffer);
      if (window.observingDeath && [5841,5824,5898].includes(id)) window.deathSounds.push(id);
      return start.apply(this,args);
    };
  });
  for (const [path, marker, probe] of [
    ["**/engine/SimulationEngine.js*","this.encounter = options.encounter;","if(options.encounter.kind==='zebak') window.engine=this;"],
    ["**/application.js*","this.bufferCache.set(h2, h8);","window.soundIds.set(h8,h2);"],
    ["**/toa/zebak/native.js*","scene.setEncounterRenderConfig(renderConfig);","window.scene=scene;"],
  ]) {
    await page.route(path, async route => {
      const res = await route.fetch({maxRetries:3});
      const body = await res.text();
      assert.ok(body.includes(marker),marker);
      await route.fulfill({response:res,body:body.replace(marker,marker+probe)});
    });
  }
  await page.goto(process.env.TEST_ORIGIN + "/zebak/");
  await page.waitForFunction(() => document.body.innerText.includes("580/580"));
  await page.getByText(/Did you know\?/).first().waitFor({state:"hidden",timeout:45000});
  await page.mouse.click(640,425);
  await page.waitForFunction(() => engine.worldState.tick > 0);
  await page.evaluate(() => engine.setBossHp(144));
  await page.waitForFunction(() => scene.npcInstanceManager.instanceRegistry.get("primary-npc")?.npcTypeId === 11732);
  const result = await page.evaluate(async () => {
    const cache = new (await import("/assets/player.js")).CacheManager();
    await cache.ensureCache();
    const sequences = [9634,9635].map(id => {
      const seq = cache.animationSystem.loadSeqType(id);
      return {id, duration:seq.skeletalEnd-seq.skeletalStart,sounds:[...(seq.frameSounds ?? [])].map(([frame,sounds])=> [frame,sounds.map(s=>s.id)])};
    });
    window.observingDeath = true;
    const started = engine.worldState.tick;
    engine.setBossHp(0);
    const observed = new Set();
    const deadline = performance.now()+6500;
    let paired = false;
    while (performance.now()<deadline) {
      await new Promise(requestAnimationFrame);
      const poses = scene.getPlayingSequenceFrames();
      for (const pose of poses)
        if ([9634,9635].includes(pose.seqId)) observed.add(pose.seqId);
      if (poses.some(p=>p.seqId===9634) && poses.some(p=>p.seqId===9635)) paired = true;
      if (engine.encounter.getOutcome().phase==="victory") break;
    }
    return {sequences,observed:[...observed],paired,starts:window.deathSounds,
      tailRemoved:!engine.worldState.actors.has("zebak-tail"),outcome:engine.encounter.getOutcome(),started};
  });
  console.log(JSON.stringify(result));
  assert.ok(result.paired, "Head and tail must play their death sequences together");
  assert.deepEqual(result.starts, result.sequences[0].sounds.flatMap(([,ids])=>ids));
  assert.equal(result.outcome.phase,"victory");
  assert.equal(result.outcome.completionTick-result.outcome.decisiveTick,5);
  assert.ok(result.tailRemoved);
  assert.deepEqual(errors,[]);
} finally {
  await browser.close();
}
