import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";
import {soloZebakHitpoints, zebakAutoMaxHit} from "../client/toa/zebak/rules.js";
import {zebakDefinition} from "../client/toa/zebak/native.js";

// Published solo observations in the Wiki DPS calculator's TombsOfAmascut.test.ts
// and the path 4, raid 145 HUD in https://youtu.be/mwKeq1tP05Y?t=545.
for (const [raid, path, hp] of [
  [0,0,580], [145,4,1130], [150,0,930], [300,0,1280], [350,2,1570],
  [405,1,1640], [450,3,1920], [500,3,2050], [540,3,2160],
]) assert.equal(soloZebakHitpoints(raid, path), hp);
for (const [raid, path, melee, projectile] of [
  [0,0,38,16], [250,0,76,32], [375,0,95,40], [500,0,95,40],
  [500,1,102,43], [500,4,116,49], [500,5,121,51], [500,6,126,53],
]) {
  assert.equal(zebakAutoMaxHit(true, raid, path), melee);
  assert.equal(zebakAutoMaxHit(false, raid, path), projectile);
}

// The practice menu names the raid level chosen beside the invocations' own toggles "Invocation level".
const raidChoice = zebakDefinition({seedRandom: () => () => 0.5, walkable: () => new Set(), animate() {}})
  .controls.mechanicsToggles.find(toggle => toggle.key === "other");
assert.equal(raidChoice.label, "Invocation level");

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [file, marker, probe] of [
    ["engine/SimulationEngine.js", "this.encounter = options.encounter;",
      "if (this.encounter.kind === 'zebak') window.engine = this;"],
    ["engine/combatFormulas.js", 'import { scaleToaAccuracyRoll } from "/toa/zebak/rules.js";',
      "window.rolls = {subject:getDrainedNpcFormulaStats, defence:getNpcDefenceRoll, attack:getNpcAttackRoll, chance:getSingleRollHitChance, npcChance:getNpcAttackAccuracy};"],
  ]) {
    await page.route("**/" + file + "*", async route => {
      const response = await route.fetch();
      const body = await response.text();
      assert.ok(body.includes(marker));
      await route.fulfill({response, body: body.replace(marker, marker + probe)});
    });
  }
  await page.goto(process.env.TEST_ORIGIN + "/zebak/");
  await page.waitForFunction(() => document.body.innerText.includes("580/580"));
  const result = await page.evaluate(() => {
    const actor = engine.worldState.actors.get("zebak");
    engine.setMechanicsConfig({...engine.mechanicsConfig, path:"3", other:"500"});
    actor.debuffs = {...actor.debuffs, defenceDrain:20};
    const scaled = rolls.subject(actor);
    const unscaled = {...scaled, toaRaidLevel:0};
    const styles = ["melee_crush", "ranged", "magic"];
    return {
      tick:engine.worldState.tick, hp:actor.vitals, speed:actor.combat.attackSpeed,
      defence:scaled.levels.defence,
      rolls:styles.map(style => {
        const baseDefence = rolls.defence(unscaled, style, "standard");
        const baseAttack = rolls.attack(unscaled, style);
        return [rolls.defence(scaled, style, "standard") === baseDefence * 3,
          rolls.npcChance(scaled, unscaled, style) === rolls.chance(baseAttack * 3, baseDefence)];
      }),
    };
  });
  assert.deepEqual(result, {tick:0, hp:{hp:2050, maxHp:2050}, speed:6, defence:50,
    rolls:[[true,true],[true,true],[true,true]]});
  assert.deepEqual(errors, []);
  console.log("Solo HP, damage caps, pre-fight configuration, drained defence and NPC accuracy passed.");
} finally {
  await browser.close();
}
