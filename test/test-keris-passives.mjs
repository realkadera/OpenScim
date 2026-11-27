import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/engine/SimulationEngine.js*", async route => {
    const response = await route.fetch();
    const marker = "this.encounter = options.encounter;";
    const body = await response.text();
    assert.ok(body.includes(marker));
    await route.fulfill({response, body:body.replace(marker, marker + "window.engine=this;window.weaponStyles=getWeaponCategoryDefinition;")});
  });
  await page.goto(process.env.TEST_ORIGIN + "/zebak/");
  await page.waitForFunction(() => window.engine?.objTypeLoader && engine.worldState.actors.has("zebak"));
  const result = await page.evaluate(() => {
    const p = engine.player();
    const boss = engine.worldState.actors.get("zebak");
    engine.setMechanicsConfig({...engine.mechanicsConfig, infinitePrayer:false});
    const events = [];
    const emit = engine.tickEvents.emit.bind(engine.tickEvents);
    engine.tickEvents.emit = event => {events.push(event); return emit(event);};
    p.inventory[0] = {id:27291};
    p.stats.attack.max = 79;
    engine.queueEquipFromInventory(0,27291,"weapon");
    engine.advanceTick(p.position);
    const rejected = p.equipment.weapon !== 27291 && p.inventory[0].id === 27291;
    p.stats.attack.max = 80;
    engine.queueEquipFromInventory(0,27291,"weapon");
    engine.advanceTick(p.position);
    const styles = weaponStyles(p.equipment.weapon).styles.map(s => [s.name,s.attackType,s.combatStyle]);
    p.selectedAttackStyleIndex = 0;
    boss.vitals.hp = Math.floor(boss.vitals.maxHp/4);
    const threshold = engine.getAdjustedTheoreticalDps();
    boss.vitals.hp--;
    const below = engine.getAdjustedTheoreticalDps();
    const rules = engine.encounterRules;
    engine.encounterRules = {...rules,isTombsOfAmascut:false};
    const outside = engine.getAdjustedTheoreticalDps();
    engine.encounterRules = rules;
    boss.formulaStats.attributes = ["scabarite"];
    const chitin = engine.getAdjustedTheoreticalDps();
    p.prayerState.points = p.stats.prayer.current = 5;
    p.vitals.hp = p.stats.hitpoints.current = 50;
    boss.vitals.hp = 1;
    engine.teleportPlayer([23,32],p.facing);
    engine.combatRandom = () => 0;
    engine.queueAttackTarget("zebak");
    for (let i = 0; i < 10 && boss.vitals.hp > 0; i++) engine.advanceTick(p.position);
    return {rejected,weapon:p.equipment.weapon,styles,stats:engine.lookupItemStats(27291),
      threshold,below,outside,chitin,bossHp:boss.vitals.hp,hp:p.vitals.hp,prayer:p.prayerState.points,
      messages:events.filter(e => e.type==="game_message").flatMap(e => e.segments.map(s => s.text))};
  });
  assert.equal(result.rejected,true);
  assert.equal(result.weapon,27291);
  assert.deepEqual(result.styles,[["Stab","Stab","Accurate"],["Lunge","Stab","Aggressive"],["Pound","Crush","Aggressive"],["Block","Stab","Defensive"]]);
  assert.deepEqual([result.stats.attackStab,result.stats.attackSlash,result.stats.attackCrush,result.stats.attackMagic,result.stats.meleeStrength,result.stats.prayer,result.stats.attackSpeed,result.stats.attackRange],[58,-2,57,2,45,3,4,1]);
  assert.equal(result.threshold.style,"melee_stab");
  assert.ok(result.below.accuracy > result.threshold.accuracy);
  assert.equal(result.outside.accuracy,result.threshold.accuracy);
  assert.equal(result.chitin.profileMaxHit,Math.floor(result.below.baseMaxHit*133/100));
  assert.equal(result.chitin.maxHit,3*result.chitin.profileMaxHit);
  assert.equal(result.chitin.hits[0].procChance,1/51);
  assert.equal(result.bossHp,0);
  assert.equal(result.hp,62);
  assert.equal(result.prayer,0);
  assert.ok(result.messages.some(text => text.includes("creature's chitin")));
  for (const scenario of [
    {inRaid:true, hp:108, prayer:10, finalHp:111, finalPrayer:5},
    {inRaid:true, hp:118, prayer:10, finalHp:118, finalPrayer:5},
    {inRaid:true, hp:50, prayer:4, finalHp:50, finalPrayer:4},
    {inRaid:false, hp:50, prayer:10, finalHp:50, finalPrayer:10},
  ]) {
    await page.reload();
    await page.waitForFunction(() => window.engine?.objTypeLoader && engine.worldState.actors.has("zebak"));
    const actual = await page.evaluate(({inRaid,hp,prayer}) => {
      const player = engine.player();
      const boss = engine.worldState.actors.get("zebak");
      engine.setMechanicsConfig({...engine.mechanicsConfig,infinitePrayer:false});
      engine.encounterRules = {...engine.encounterRules,isTombsOfAmascut:inRaid};
      player.inventory[0] = {id:27291};
      engine.queueEquipFromInventory(0,27291,"weapon");
      engine.advanceTick(player.position);
      engine.teleportPlayer([23,32],player.facing);
      player.stats.hitpoints.max = player.vitals.maxHp = 99;
      player.stats.hitpoints.current = player.vitals.hp = hp;
      player.stats.prayer.current = player.prayerState.points = prayer;
      boss.vitals.hp = 1;
      engine.combatRandom = () => 0;
      engine.queueAttackTarget("zebak");
      for (let tick = 0; tick < 10 && boss.vitals.hp > 0; tick++) engine.advanceTick(player.position);
      return {bossHp:boss.vitals.hp,hp:player.vitals.hp,prayer:player.prayerState.points};
    },scenario);
    assert.deepEqual(actual,{bossHp:0,hp:scenario.finalHp,prayer:scenario.finalPrayer});
  }
  assert.deepEqual(errors,[]);
  console.log("Sun keris loadout, equipment requirement, combat styles, accuracy, chitin critical, kill healing, and prayer passed");
} finally {
  await browser.close();
}
