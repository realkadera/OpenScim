// The Sanguinesti staff's passive: 1 in 5 that a successful hit deals 8 more damage and heals half of what it dealt
// (WIKI: Sanguinesti staff), with the impact of spot animation 1542. Every combat roll is the same number here, just
// under 1/5 and then 1/5 itself.
import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import {browserOptions} from "../tools/browser.mjs";

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage();
  await page.route("**/engine/SimulationEngine.js*", async route => {
    const response = await route.fetch();
    const marker = "this.encounter = options.encounter;";
    const body = await response.text();
    assert.ok(body.includes(marker));
    await route.fulfill({response, body:body.replace(marker, marker + "window.engine=this;")});
  });
  const run = async (weapon, roll) => {
    await page.goto(process.env.TEST_ORIGIN + "/zebak/");
    await page.waitForFunction(() => window.engine?.objTypeLoader && engine.worldState.actors.has("zebak"));
    return page.evaluate(([weapon, roll]) => {
      const p = engine.player();
      const boss = engine.worldState.actors.get("zebak");
      const events = [];
      const emit = engine.tickEvents.emit.bind(engine.tickEvents);
      engine.tickEvents.emit = event => {events.push(event); return emit(event);};
      p.inventory[0] = {id:weapon};
      engine.queueEquipFromInventory(0,weapon,"weapon");
      engine.advanceTick(p.position);
      p.vitals.hp = p.stats.hitpoints.current = 50;
      engine.teleportPlayer([23,32],p.facing);
      engine.combatRandom = () => roll;
      engine.queueAttackTarget("zebak");
      const bossHp = boss.vitals.hp;
      let healed = 0;
      // The heal is the only thing that raises hitpoints in these few ticks; Zebak may lower them.
      for (let i = 0; i < 8 && boss.vitals.hp === bossHp; i++) {
        const before = p.vitals.hp;
        engine.advanceTick(p.position);
        healed += Math.max(0, p.vitals.hp - before);
      }
      return {weapon:p.equipment.weapon, damage:bossHp - boss.vitals.hp, healed,
        redImpact:JSON.stringify(events).includes('"hitGraphicId":1542')};
    }, [weapon, roll]);
  };
  for (const staff of [22323, 25731]) { // Sanguinesti staff, Holy sanguinesti staff
    const heals = await run(staff, 0.199);
    assert.equal(heals.weapon, staff);
    assert.ok(heals.damage >= 9, `the staff hits, with the 8: ${JSON.stringify(heals)}`);
    assert.equal(heals.healed, Math.floor(heals.damage / 2));
    assert.equal(heals.redImpact, true);
  }
  const noProc = await run(22323, 0.2);
  assert.ok(noProc.damage >= 2);
  // The same roll but for 0.001: the damage without the 8 is the same or one more.
  const extra = (await run(22323, 0.199)).damage - noProc.damage;
  assert.ok(extra === 8 || extra === 7, `8 additional damage: ${extra}`);
  assert.equal(noProc.healed, 0);
  assert.equal(noProc.redImpact, false);
  const trident = await run(12899, 0.199); // Trident of the swamp: no heal
  assert.ok(trident.damage >= 2);
  assert.equal(trident.healed, 0);
} finally {
  await browser.close();
}
