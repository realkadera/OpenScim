import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const browser = await chromium.launch(browserOptions);
try {
  for (const fight of ["zebak","yama"]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror",error => errors.push(error.message));
    await page.addInitScript(() => {
      window.soundIds = new WeakMap();
      window.playedSounds = [];
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function(...args) {
        playedSounds.push(soundIds.get(this.buffer));
        return start.apply(this,args);
      };
    });
    await page.route("**/application.js*", async route => {
      const response = await route.fetch();
      const marker = "this.bufferCache.set(h2, h8);";
      const body = await response.text();
      assert.ok(body.includes(marker));
      await route.fulfill({response,body:body.replace(marker,marker + "soundIds.set(h8,h2);")});
    });
    await page.route("**/engine/SimulationEngine.js*", async route => {
      const response = await route.fetch();
      const marker = "this.encounter = options.encounter;";
      const body = await response.text();
      assert.ok(body.includes(marker));
      await route.fulfill({response,body:body.replace(marker,marker + "window.engine = this;")});
    });
    await page.goto(process.env.TEST_ORIGIN + "/" + fight + "/");
    const orb = page.locator('canvas[aria-label="Special Attack"]');
    await orb.first().waitFor();
    await page.locator('.loading-screen').waitFor({state:'hidden'});
    await page.mouse.click(640,425);
    await page.evaluate(() => {
      const player = engine.player();
      engine.setMechanicsConfig({...engine.mechanicsConfig,infiniteHealth:false,infiniteSpecialAttack:false,infinitePrayer:false});
      player.inventory[0] = {id:27291};
      engine.queueEquipFromInventory(0,27291,"weapon");
      engine.advanceTick(player.position);
      window.events = [];
      const emit = engine.tickEvents.emit.bind(engine.tickEvents);
      engine.tickEvents.emit = event => { events.push(event); return emit(event); };
    });
    await page.waitForTimeout(800);
    const scenarios = fight === "zebak" ? [[50,75,"success"],[49,100,"Prayer"],[70,74,"power"]] : [[90,100,"within the Tombs"]];
    for (const [prayer,energy,expectation] of scenarios) {
      const baseHp = await page.evaluate(([prayer,energy]) => {
        const p = engine.player();
        p.prayerState.points = prayer;
        p.specialAttack.energy = energy;
        p.vitals.hp = 33;
        p.runEnergy.energy = 800;
        p.poisonState.poisonVarp = 1000004;
        p.stats.attack.current = p.stats.attack.max - 8;
        p.stats.strength.current = p.stats.strength.max + 4;
        engine.syncVitalsToStats();
        events.length = 0;
        return p.vitals.maxHp;
      },[prayer,energy]);
      // The orb button handles mousedown and clips its hit area to the painted glyph.
      const icon = await orb.first().boundingBox();
      await page.mouse.click(icon.x + icon.width/2,icon.y + icon.height/2);
      await page.waitForFunction(()=>events.some(e=>e.type==="player_special_animation" || e.type==="game_message"));
      const result = await page.evaluate(() => {
        const p = engine.player();

        return {weapon:p.equipment.weapon,energy:p.specialAttack.energy,prayer:p.prayerState.points,hp:p.vitals.hp,
          run:p.runEnergy.energy, poison:p.poisonState.poisonVarp,attack:p.stats.attack,strength:p.stats.strength,
          armed:p.isSpecialAttackActive,events:events.slice()};
      });
      assert.equal(result.weapon,27291);
      assert.equal(result.armed,false);
      if (expectation === "success") {
        assert.equal(result.hp,Math.floor(baseHp*1.2),JSON.stringify(result));
        assert.equal(result.energy,0);
        assert.equal(result.prayer,0);
        assert.equal(result.run,10000);
        assert.equal(result.poison,0);
        assert.equal(result.attack.current,result.attack.max);
        assert.equal(result.strength.current,result.strength.max+4);
        assert.ok(result.events.some(e=>e.type==="player_graphic_applied" && e.spotAnimId===2128));
        assert.ok(result.events.some(e=>e.type==="player_special_animation" && e.sequenceId===9544));
        assert.ok(result.events.some(e=>e.type==="prayer_depleted"));
        await page.waitForFunction(()=>playedSounds.includes(6408),null,{timeout:5000});
        assert.equal(await page.evaluate(()=>playedSounds.filter(id=>id===6408).length),1);
      } else {
        const messages=result.events.filter(e=>e.type==="game_message").flatMap(e=>e.segments.map(s=>s.text));
        assert.ok(messages.some(message=>message.includes(expectation)),JSON.stringify(result));
        assert.equal(result.prayer,prayer);
        assert.equal(result.energy,energy);
        assert.equal(result.hp,33);
      }
      console.log(fight,expectation,result.hp,result.energy,result.prayer);
    }
    assert.deepEqual(errors,[]);
    await page.close();
  }
} finally {
  await browser.close();
}

