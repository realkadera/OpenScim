import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage();
  await page.route("**/engine/SimulationEngine.js*", async route => {
    const response = await route.fetch({maxRetries: 3});
    const body = await response.text();
    const marker = "this.encounter = options.encounter;";
    assert.ok(body.includes(marker));
    await route.fulfill({response, body: body.replace(marker, marker + "if (options.encounter.kind === 'zebak') window.engine = this;")});
  });
  await page.goto(process.env.TEST_ORIGIN + "/zebak/");
  await page.waitForFunction(() => document.body.innerText.includes("580/580"));
  await page.mouse.click(600, 360);
  await page.waitForFunction(() => engine.worldState.tick > 0);
  const results = await page.evaluate(() => {
    const enc = engine.encounter;
    const processNpc = enc.processNpcTick.bind(enc);
    let cast = 0;
    enc.processNpcTick = (actor, context) => {
      enc.random = () => cast % 2 ? 0.8 : 0.2;
      const result = processNpc(actor, context);
      for (const hit of result.npcAttacks ?? []) {
        cast++;
        hit.accuracySucceeded = true;
        hit.rolledDamage = 20;
      }
      return result;
    };
    engine.setMechanicsConfig({...engine.mechanicsConfig, infiniteHealth: true});
    enc.configureRunStart({path: 4});
    engine.setBossHp(50);
    // Let the transition animation and the first normal recovery complete.
    for (let i = 0; i < 18; i++) engine.advanceTick(engine.player().position);
    const results = [];
    for (const [quiet, correct] of [[false, true], [true, true], [false, false]]) {
      enc.configureRunStart({path: 4, quiet});
      for (let i = 0; i < 22; i++) {
        const due = engine.worldState.pendingHits.find(hit => hit.targetId === "player" &&
          hit.impactTick === engine.worldState.tick + 1);
        // Flick on the impact tick. Other overlapping missiles may be a different style.
        const magic = due ? (due.style === "magic") === correct : false;
        const prayer = magic ? "ProtectMagic" : "ProtectRange";
        if (engine.player().activePrayer !== prayer) engine.queueProtectionPrayer(prayer);
        const before = engine.damageHistory.length;
        engine.advanceTick(engine.player().position);
        if (due && i > 5) {
          const hit = engine.damageHistory.slice(before).find(entry => entry.attackType === due.style);
          results.push({quiet, correct, style: due.style, launch: due.launchTick,
            impact: due.impactTick, damage: hit?.effectiveDamage, prayed: hit?.prayedCorrectly});
        }
      }
    }
    return results;
  });
  for (const [quiet, correct, expected] of [[false, true, 0], [true, true, 2], [false, false, 20]]) {
    const hits = results.filter(hit => hit.quiet === quiet && hit.correct === correct);
    assert.ok(hits.length >= 7, JSON.stringify(results));
    assert.deepEqual(new Set(hits.map(h => h.style)), new Set(["magic", "range"]));
    assert.ok(hits.every((h, i) => h.damage === expected && h.prayed === correct &&
      h.impact - h.launch === 5 && (!i || h.launch - hits[i-1].launch === 2)), JSON.stringify(hits));
    console.log(hits.length, "path-4 enrage impacts", {quiet, correct, damage: expected});
  }
} finally {
  await browser.close();
}
