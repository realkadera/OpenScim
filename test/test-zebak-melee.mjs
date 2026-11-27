import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";
import {acidScene} from "../client/toa/zebak/phases.js";

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/engine/SimulationEngine.js*", async route => {
    const response = await route.fetch(), body = await response.text();
    const marker = "this.encounter = options.encounter;";
    assert.ok(body.includes(marker));
    await route.fulfill({response,body:body.replace(marker, marker + "if(options.encounter.kind==='zebak')window.engine=this;")});
  });
  await page.goto(process.env.TEST_ORIGIN + "/zebak/");
  await page.waitForFunction(() => document.body.innerText.includes("580/580"));
  await page.getByText(/Did you know\?/).first().waitFor({state:"hidden",timeout:45000});
  await page.mouse.click(600,360);
  await page.waitForFunction(() => engine.worldState.tick > 0);
  const result = await page.evaluate(() => {
    const enc = engine.encounter, player = engine.player();
    engine.setMechanicsConfig({...engine.mechanicsConfig,infiniteHealth:true});
    // Fix the roll so boundary checks cannot pass because of a random miss.
    let rolledStyle, accurate = true;
    const npcTurn = enc.processNpcTick.bind(enc);
    enc.processNpcTick = (actor,context) => {
      const result = npcTurn(actor,context);
      if (result.npcAttacks?.length) {
        const [hit] = result.npcAttacks;
        rolledStyle = hit.style;
        hit.accuracySucceeded = accurate;
        hit.rolledDamage = 20;
      }
      return result;
    };
    const place = tile => engine.teleportPlayer(tile,player.facing);
    const tick = () => engine.advanceTick(player.position);
    const launch = from => {
      place(from);
      enc.attackTick = engine.worldState.tick + 1;
      rolledStyle = null;
      tick();
      enc.attackTick = Infinity;
      return rolledStyle;
    };
    const bite = (from,to) => {
      const style = launch(from);
      const queued = engine.worldState.pendingHits.find(h => h.style === "melee");
      const queuedDelay = queued && queued.impactTick - queued.launchTick;
      place(to);
      const before = engine.damageHistory.length;
      tick();
      return {style, queuedDelay, impacts:engine.damageHistory.slice(before).filter(h => h.attackType === "melee").length};
    };
    enc.random = () => 0.9;
    const dodge = [[23,32],[24,32],[25,32],[23,27],[23,37],[24,28],[24,36]].map(to => bite([23,32],to));
    const triggers = [[23,28],[23,36],[23,27],[23,37],[24,32]].map(launch);
    for (let i = 0; i < 12; i++) tick();
    enc.random = () => 0.1;
    accurate = false;
    bite([23,32],[23,32]);
    const before = engine.damageHistory.length;
    tick();
    const origin = [...player.position];
    engine.advanceTick([27,32]);
    const path = player.movementPath.map(p=>[...p]);
    const trail = enc.getSnapshot().state.bloodTrail;
    for (let i = 0; i < 16; i++) tick();
    engine.advanceTick([29,32]);
    return {dodge,triggers,origin,path,trail,after:enc.getSnapshot().state.bloodTrail,
      bleedHits:engine.damageHistory.slice(before).filter(h=>h.source==="Zebak bleed").map(h=>h.effectiveDamage)};
  });
  assert.deepEqual(result.dodge.map(b=>b.impacts),[1,1,0,0,0,1,1]);
  assert.ok(result.dodge.every(b=>b.queuedDelay===1 && b.style==="melee"));
  assert.deepEqual(result.triggers.map(s=>s==="melee"),[true,true,false,false,false]);
  assert.ok(result.path.length>0);
  assert.deepEqual(result.trail,[result.origin,...result.path.slice(0,-1)]);
  assert.equal(result.bleedHits.length,2);
  assert.ok(result.bleedHits.every(hit=>hit>=2 && hit<=10));
  assert.deepEqual(result.after,[]);
  const decals=acidScene().update({state:{encounter:{state:{bloodTrail:result.trail}}}});
  assert.ok(decals.every(d=>d.data.locId>=652 && d.data.locId<=654 && d.data.modelType===22));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
