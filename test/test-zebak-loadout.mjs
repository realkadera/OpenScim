import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/engine/SimulationEngine.js*", async route => {
    const response = await route.fetch();
    const marker = "this.encounter = options.encounter;";
    const code = await response.text();
    assert.ok(code.includes(marker));
    await route.fulfill({ response, body: code.replace(marker,
      marker + 'if (this.encounter.kind === "zebak") window.engine = this;') });
  });
  await page.route("**/engine/playerAttack/plan.js*", async route => {
    const response = await route.fetch();
    const code = await response.text();
    assert.ok(code.includes("function adjustEquipmentStatsForAttack("));
    await route.fulfill({ response, body: code + "\nwindow.effectiveGearStats = adjustEquipmentStatsForAttack;" });
  });
  await page.goto(process.env.TEST_ORIGIN + "/zebak/");
  await page.waitForFunction(() => document.body.innerText.includes("580/580"));
  const gear = { head:21018, cape:21791, amulet:12002, weapon:27275, body:21021,
    legs:21024, hands:31106, boots:31097, ring:28313 };
  const switches = [[27235,"head"], [27238,"body"], [27241,"legs"], [20997,"weapon"],
    [28951,"cape"], [33639,"amulet"], [26235,"hands"], [12926,"weapon"],
    [27291,"weapon"], [27665,"weapon"], [27275,"weapon"]];
  const initial = await page.evaluate(() => {
    const { equipment, inventory, combatSupplies } = engine.player();
    return {equipment, ids:inventory.map(item => item?.id), combatSupplies};
  });
  assert.deepEqual(initial.equipment, gear);
  assert.equal(initial.ids.length, 28);
  assert.deepEqual(initial.ids.slice(0,10), switches.slice(0,10).map(([id]) => id));
  assert.equal(initial.combatSupplies.equippedAmmo.id,11212);
  assert.equal(initial.combatSupplies.blowpipe.id,11230);
  const preview = await page.evaluate(() => {
    const raid = engine.getAdjustedTheoreticalDps();
    const rules = engine.encounterRules;
    try {
      engine.encounterRules = {...rules, isTombsOfAmascut:false};
      return {raid, outside:engine.getAdjustedTheoreticalDps()};
    } finally {
      engine.encounterRules = rules;
    }
  });
  assert.equal(preview.raid.style,"magic");
  assert.ok(preview.raid.baseAttackRoll > preview.outside.baseAttackRoll);
  assert.ok(preview.raid.maxHit >= preview.outside.maxHit);
  const icons = [...new Set([...Object.values(gear), ...initial.ids, 11212, 11230])];
  const decoded = await page.evaluate(async ids => Promise.all(ids.map(async id => {
    const img = new Image();
    img.src = "/assets/items/" + id + ".png";
    await img.decode();
    return img.naturalWidth > 0;
  })), icons);
  assert.ok(decoded.every(Boolean));
  const equipped = await page.evaluate(switches => {
    const player = engine.player();
    return switches.map(([id, slot]) => {
      const index = player.inventory.findIndex(item => item?.id === id);
      engine.queueEquipFromInventory(index, id, slot);
      engine.advanceTick(player.position);
      return player.equipment[slot];
    });
  }, switches);
  assert.deepEqual(equipped, switches.map(([id]) => id));
  const sceptreLevelCheck = await page.evaluate(() => {
    const player = engine.player();
    const slot = player.inventory.findIndex(item => item?.id === 27665);
    const level = player.stats.magic.max;
    try {
      return [69,70].map(magic => {
        player.stats.magic.max = magic;
        engine.queueEquipFromInventory(slot,27665,"weapon");
        engine.advanceTick(player.position);
        return player.equipment.weapon;
      });
    } finally {
      player.stats.magic.max = level;
    }
  });
  assert.deepEqual(sceptreLevelCheck,[27275,27665]);
  const bonuses = await page.evaluate(() => {
    const player = engine.player();
    const stats = {attackMagic:80, magicDamage:30, attackRanged:50, rangedStrength:20};
    const adjusted = (weapon, isTombsOfAmascut, resources) => effectiveGearStats(
      {player:{equipment:{...player.equipment, weapon}}, resources, isTombsOfAmascut}, stats);
    return [
      adjusted(27275,true,{kind:"none"}), adjusted(27275,false,{kind:"none"}),
      ...["equipped","quiver"].map(source => adjusted(20997,true,{kind:"ammo",ammoId:11212,source})),
    ];
  });
  assert.deepEqual(bonuses.map(b => [b.attackMagic,b.magicDamage]), [[320,100],[240,90],[80,30],[80,30]]);
  assert.ok(bonuses.slice(2).every(b => b.attackRanged === 60 && b.rangedStrength === 21));
  assert.deepEqual(errors, []);
  console.log("Verified fresh mage preset, 10 inventory switches, return to Shadow, all item sprites, Shadow and quiver bonuses.");
} finally {
  await browser.close();
}
