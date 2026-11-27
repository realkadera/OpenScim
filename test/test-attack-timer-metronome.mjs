// The plugin Attack Timer Metronome (client/plugins/attackTimerMetronome.js),
// as RuneLite's draws it, in Yama's fight: listed in the Plugins panel by its
// store; while the player attacks, the ticks to the next attack over his head
// (the weapon's cycle down to 1, the last in its own colour) and the bar
// draining over the cycle, 30 x 5; once he stops, -1 and -2 in the lost tick
// colour, then nothing. Then, with other settings: the count zero-based and the
// high detail bar, 40 x 7, filling. First, without a browser: the settings it
// had as the application's are carried into its own store, once.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";
import { createPluginStore } from "../client/plugins/pluginStore.js";
import { attackTimerMetronomeOptions, carryOverLegacySettings } from "../client/plugins/attackTimerMetronome.js";

// A store of its own and a storage holding the application's old settings `app` (and the store's, `own`).
function carryOver(app, own = null) {
  const items = new Map([["osrs-yama-settings", JSON.stringify(app)], ...(own ? [["openscim.plugin.attackTimerMetronome", own]] : [])]);
  const storage = { getItem: (key) => items.get(key) ?? null };
  const store = createPluginStore("attackTimerMetronome", attackTimerMetronomeOptions);
  return { carried: carryOverLegacySettings(store, storage), ...store.getState() };
}
const old = { attackTimerMetronomeShowBar: true, attackTimerMetronomeShowTicks: false, attackTimerMetronomeFontSize: 24 };
{
  // It was on: as it looked, the old defaults included (bar on, number off, 24), and no late ticks: it drew none.
  const { carried, enabled, settings } = carryOver({ ...old, attackTimerMetronomeEnabled: true });
  assert.deepEqual(
    { carried, enabled, showBar: settings.showBar, showTick: settings.showTick, fontSize: settings.fontSize, showLostTicks: settings.showLostTicks },
    { carried: true, enabled: true, showBar: true, showTick: false, fontSize: 24, showLostTicks: false },
  );
}
{
  // It was on with the number shown: no late ticks either.
  const { settings } = carryOver({ ...old, attackTimerMetronomeEnabled: true, attackTimerMetronomeShowTicks: true });
  assert.deepEqual({ showTick: settings.showTick, showLostTicks: settings.showLostTicks }, { showTick: true, showLostTicks: false });
}
{
  // It was off, with the number switched on and a size of 60: those, the size within RuneLite's 50; the rest RuneLite's,
  // late ticks included (it is RuneLite's when first switched on).
  const { carried, enabled, settings } = carryOver({ ...old, attackTimerMetronomeEnabled: false, attackTimerMetronomeShowTicks: true, attackTimerMetronomeFontSize: 60 });
  assert.deepEqual(
    { carried, enabled, showBar: settings.showBar, showTick: settings.showTick, fontSize: settings.fontSize, showLostTicks: settings.showLostTicks },
    { carried: true, enabled: false, showBar: false, showTick: true, fontSize: 50, showLostTicks: true },
  );
}
// It was off and never changed, or the store has its own already: nothing is carried.
assert.equal(carryOver({ ...old, attackTimerMetronomeEnabled: false }).carried, false);
assert.equal(carryOver({ ...old, attackTimerMetronomeEnabled: true }, JSON.stringify({ enabled: false, settings: {} })).carried, false);
assert.equal(carryOver({}).carried, false);

const origin = process.env.TEST_ORIGIN;
const browser = await chromium.launch(browserOptions);
const cyan = "rgb(0, 255, 255)";
const yellow = "rgb(255, 255, 0)";
const red = "rgb(255, 0, 0)";

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  // On, with the bar, and a last tick colour of its own to tell it apart.
  await page.addInitScript(() => {
    localStorage.setItem("openscim.plugin.attackTimerMetronome", JSON.stringify({ enabled: true, settings: { showBar: true, lastColor: "FFFFFF00" } }));
  });
  await page.route("**/engine/SimulationEngine.js*", async (route) => {
    const response = await route.fetch();
    const marker = "this.encounter = options.encounter;";
    const body = await response.text();
    assert.ok(body.includes(marker));
    // Yama's fight's own engine, not another the page makes.
    await route.fulfill({ response, body: body.replace(marker, marker + "if (options.encounter.kind === 'yama_p3') window.engine = this;") });
  });

  await page.goto(origin + "/yama/");
  await page.waitForFunction(() => window.engine, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
  // Listed in the Plugins panel by its store (application.js, PluginStoreEntry).
  assert.ok((await page.getByRole("switch", { name: "Attack Timer Metronome" }).count()) === 1, "one switch in the Plugins panel");

  // What the page draws, tick by tick, from the application's own loop: the
  // number (data-tick-counters) and the bar (data-timerbars). `until` stops at
  // the tick it names.
  const watch = (until) =>
    page.evaluate(async (until) => {
      const seen = new Map();
      // A tick is 600 ms; a minute is the fight standing still.
      const giveUp = performance.now() + 60000;
      while (engine.worldState.tick < until) {
        if (performance.now() > giveUp) throw new Error(`the fight stood at tick ${engine.worldState.tick}, waiting for ${until}`);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const number = [...document.querySelectorAll("[data-tick-counters] span")].map((span) => `${span.textContent} ${span.style.color}`);
        const bar = [...document.querySelectorAll("[data-timerbars] > div")].map((div) => ({
          size: `${div.style.width}x${div.style.height}`,
          fill: parseFloat(div.querySelector('[data-role="fg-clip"]').style.width),
          standard: div.querySelector('[data-role="fg"]').src.startsWith("data:image/svg"),
        }));
        seen.set(engine.worldState.tick, { number, bar });
      }
      return [...seen.values()];
    }, until);

  await page.evaluate(() => engine.setMechanicsConfig({ ...engine.mechanicsConfig, infiniteHealth: true, infinitePrayer: true }));
  // Yama's intro plays out in the application's own loop (ended from here, the loop waits for it and never ticks).
  await page.waitForFunction(() => !engine.getState().introActive && engine.worldState.tick > 0, null, { timeout: 60000 });
  const start = await page.evaluate(() => {
    const yama = engine.worldState.getNpcs().find((npc) => npc.role === "boss");
    engine.injectAction({ type: "attackTarget", targetId: yama.id });
    return { tick: engine.worldState.tick, cycle: engine.getPlayerAttackSpeed("player") };
  });
  const { cycle } = start;
  assert.ok(cycle >= 2, `a weapon of ${cycle} ticks`);

  // Two cycles of attacks: every count from the cycle down to 1, the last in its colour.
  const attacking = await watch(start.tick + 2 * cycle + 2);
  const numbers = new Set(attacking.flatMap((frame) => frame.number));
  const expected = new Set([...Array.from({ length: cycle - 1 }, (_, n) => `${cycle - n} ${cyan}`), `1 ${yellow}`]);
  for (const text of expected) assert.ok(numbers.has(text), `"${text}" drawn: ${[...numbers].join(", ")}`);
  for (const text of numbers) assert.ok(expected.has(text), `nothing else drawn while attacking: "${text}"`);
  // The bar: 30 x 5, RuneLite's colours, full after the attack and empty on its last tick.
  const bars = attacking.flatMap((frame) => frame.bar);
  assert.ok(bars.length > 0 && bars.every((bar) => bar.size === "30pxx5px" && bar.standard), JSON.stringify(bars.slice(0, 3)));
  const fills = new Set(bars.map((bar) => bar.fill));
  assert.ok(fills.has(30) && fills.has(0), [...fills].join(", "));

  // He stops: the attack is late by 1, then 2, then the plugin shows nothing.
  const stop = await page.evaluate(() => {
    engine.injectAction({ type: "attackTarget", targetId: null });
    return engine.getPlayerNextAttackTick("player");
  });
  const late = await watch(stop + 4);
  const lateNumbers = late.flatMap((frame) => frame.number);
  assert.ok(lateNumbers.includes(`-1 ${red}`) && lateNumbers.includes(`-2 ${red}`), lateNumbers.join(", "));
  assert.ok(!lateNumbers.some((text) => text.startsWith("-3")), "no further than the maximum of 2");
  assert.deepEqual(late.at(-1), { number: [], bar: [] });

  // Zero-based, and the high detail bar filling instead of draining.
  await page.evaluate(async () => {
    const { attackTimerMetronomeStore } = await import("/plugins/attackTimerMetronome.js");
    attackTimerMetronomeStore.setSettings({ ...attackTimerMetronomeStore.getState().settings, useZeroBasedTickCount: true, barStyle: "HIGH_DETAIL", barDrains: false });
    const yama = engine.worldState.getNpcs().find((npc) => npc.role === "boss");
    engine.injectAction({ type: "attackTarget", targetId: yama.id });
  });
  const again = await watch((await page.evaluate(() => engine.worldState.tick)) + cycle + 2);
  const zeroBased = new Set(again.flatMap((frame) => frame.number));
  assert.ok(zeroBased.has(`${cycle - 1} ${cyan}`) && zeroBased.has(`0 ${yellow}`) && !zeroBased.has(`${cycle} ${cyan}`), [...zeroBased].join(", "));
  const hdBars = again.flatMap((frame) => frame.bar);
  assert.ok(hdBars.length > 0 && hdBars.every((bar) => bar.size === "40pxx7px" && !bar.standard), JSON.stringify(hdBars.slice(0, 3)));
  const hdFills = new Set(hdBars.map((bar) => bar.fill));
  assert.ok(hdFills.has(0) && hdFills.has(40), [...hdFills].join(", "));

  assert.deepEqual(errors, []);
  console.log(`Attack Timer Metronome counted a ${cycle}-tick weapon down over Yama's fight, showed -1 and -2 once the attacks stopped, and drew both bars`);
} finally {
  await browser.close();
}
