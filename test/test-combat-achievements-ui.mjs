// Combat achievements in the page (client/combatAchievements/setup.js, and the victory screen of assets/application.js):
// the Practice menu's Setup lists the Alchemical Hydra's tasks to go for, folded until opened, a box each, kept as
// they are ticked; a
// chosen task's failure is told in the chat; and the victory screen lists how each chosen task went, the failed ones
// with why and the tick. With infinite health and the boss's hitpoints set, the kill does not count. The boss's setup header
// shows its kills, deaths and K/D, and Settings, Interface, Game chat turns it off.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const browser = await chromium.launch(browserOptions);
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.addInitScript(() => localStorage.setItem("osrs-yama-settings", JSON.stringify({ fightStartCountdown: false, pauseWhenUnfocused: false })));
  await page.route("**/engine/SimulationEngine.js*", async (route) => {
    const response = await route.fetch();
    const marker = "this.encounter = options.encounter;";
    const body = await response.text();
    assert.ok(body.includes(marker));
    await route.fulfill({ response, body: body.replace(marker, marker + "window.engine=this;") });
  });
  await page.goto(process.env.TEST_ORIGIN + "/alchemical-hydra/");
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 180000 });

  // The list, under Practice, Setup, Options: the twelve tasks by tier.
  await page.getByRole("button", { name: "Practice" }).first().click();
  await page.getByRole("button", { name: /Options/ }).first().click();
  const list = page.locator('[data-testid="combat-achievements-setup"]').first();
  await list.waitFor();
  // Folded until opened: its header says so, and none of its boxes is showing.
  assert.equal(await list.evaluate((fold) => fold.open), false);
  assert.equal(await list.locator("summary").innerText(), "Tasks to go for");
  assert.equal(await list.locator('[role="checkbox"]:visible').count(), 0);
  await list.locator("summary").click();
  // The application's own checkboxes, as the practice aids' (Infinite Health).
  assert.equal(await list.locator('button.osrs-checkbox[role="checkbox"]').count(), 12);
  for (const name of ["Alcleanical Hydra", "Alchemical Veteran"]) await page.getByRole("checkbox", { name }).first().check();
  assert.match(await list.innerText(), /2 to go for/);
  assert.equal(await list.locator('[data-testid="combat-achievements-record"]').innerText(), "Kills: 0 (0 counted) · Deaths: 0");
  assert.equal(await list.locator(".osrs-checkbox__mark").count(), 2, "a ticked box shows its mark");
  assert.equal(await list.locator("summary").innerText(), "Tasks to go for (2 chosen)");
  assert.equal(await list.evaluate((fold) => fold.open), true, "still open after a box is ticked");
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("openscim.combatAchievements.v1")).selected.alchemical_hydra), ["alcleanical_hydra", "alchemical_veteran"]);
  await page.keyboard.press("Escape");

  // A fight with infinite health, taken to its end by setting the boss's hitpoints.
  await page.evaluate(() => {
    engine.setMechanicsConfig({ ...engine.getMechanicsConfig(), infiniteHealth: true });
    engine.injectAction({ type: "attackTarget", targetId: "alchemical-hydra" });
  });
  // The first hit on the player fails Alcleanical Hydra, and the chat says so.
  await page.getByText("Alcleanical Hydra", { exact: true }).filter({ visible: true }).locator("xpath=..").filter({ hasText: "You have failed" }).first().waitFor({ timeout: 90000 });
  await page.evaluate(() => engine.setBossHp(0));
  const section = page.locator(".victory-modal-ca");
  await section.waitFor({ timeout: 60000 });
  const rows = await section.locator(".victory-modal-ca-row").evaluateAll((items) =>
    items.map((item) => ({
      status: item.querySelector(".victory-modal-ca-status").textContent,
      name: item.querySelector(".victory-modal-ca-name").textContent,
      tick: item.querySelector(".victory-modal-ca-tick").textContent,
      reason: item.querySelector(".victory-modal-ca-reason")?.textContent ?? "",
    })),
  );
  assert.match(await section.locator("h2").textContent(), /^Combat achievements: tasks to go for$/);
  // The kill did not count, said once: the two aids, in the order the tracker saw them (which comes first depends
  // on the ticks between them), and the tick.
  assert.match(await section.locator(".victory-modal-ca-note--not-counted").innerText(), /^This kill did not count: (infinite health, boss hitpoints set|boss hitpoints set, infinite health)\. Tick \d+$/);
  assert.deepEqual(rows.map((row) => [row.status, row.name, row.reason]), [
    ["Failed", "Alchemical Veteran", "The kill did not count."],
    ["Failed", "Alcleanical Hydra", "You took damage."],
  ]);
  assert.ok(rows.every((row) => /^Tick \d+$/.test(row.tick)), JSON.stringify(rows));

  // The kill is among the boss's fights, and did not count.
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("openscim.combatAchievements.v1")).fights.alchemical_hydra), { kills: 1, deaths: 0 });

  // With nothing chosen: every task the fight failed, each with its reason and tick.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("openscim.combatAchievements.v1"));
    localStorage.setItem("openscim.combatAchievements.v1", JSON.stringify({ ...saved, selected: {} }));
  });
  await page.reload();
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 180000 });
  await page.evaluate(() => {
    engine.setMechanicsConfig({ ...engine.getMechanicsConfig(), infiniteHealth: true });
    engine.injectAction({ type: "attackTarget", targetId: "alchemical-hydra" });
  });
  await page.waitForFunction(() => engine.currentTick > 20, null, { timeout: 60000 });
  await page.evaluate(() => engine.setBossHp(0));
  await section.waitFor({ timeout: 60000 });
  assert.match(await section.locator("h2").textContent(), /^Combat achievements$/);
  const all = await section.locator(".victory-modal-ca-row").evaluateAll((items) => items.map((item) => [item.querySelector(".victory-modal-ca-status").textContent, item.querySelector(".victory-modal-ca-name").textContent, item.querySelector(".victory-modal-ca-tick").textContent]));
  assert.ok(all.length > 0 && all.every(([status, , tick]) => status === "Failed" && /^Tick \d+$/.test(tick)), JSON.stringify(all));
  assert.ok(all.some(([, name]) => name === "No Pressure"), "the twisted bow fails No Pressure on the first tick");

  // The boss's setup header: its two kills, no death, and their ratio; Settings, Interface, Game chat turns it off.
  await page.goto(process.env.TEST_ORIGIN + "/");
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 180000 });
  // The menu's items, the menu opened until they show (a click as the page settles can close it again).
  const fromMenu = async (item) => {
    const entry = page.locator("button.controls-toggle-open").filter({ hasText: new RegExp("^" + item + "$"), visible: true }).first();
    for (let tries = 0; tries < 5 && !(await entry.isVisible()); tries++) {
      await page.getByRole("button", { name: "Menu", exact: true }).filter({ visible: true }).first().click();
      await entry.waitFor({ timeout: 2000 }).catch(() => {});
    }
    await entry.click();
  };
  const openSetup = async () => {
    await fromMenu("Encounters");
    await page.getByText("Alchemical Hydra", { exact: true }).filter({ visible: true }).first().click();
    await page.getByRole("button", { name: "Edit setup" }).click();
  };
  await openSetup();
  const record = page.locator('[data-testid="encounter-record"]');
  assert.equal(await record.innerText(), "Kills: 2 · Deaths: 0 · K/D: 2.00");
  // Closed, and the list of encounters behind it.
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.keyboard.press("Escape");
  await fromMenu("Settings");
  await page.getByText("Interface", { exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("checkbox", { name: "Boss kill record" }).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("openscim.combatAchievements.v1")).settings.showRecord), false);
  await page.keyboard.press("Escape");
  await openSetup();
  await page.getByRole("button", { name: "Start Encounter" }).waitFor();
  assert.equal(await record.count(), 0, "the setting hides the header's record");
  assert.deepEqual(errors, []);
  console.log("Combat achievements in the page: the setup's list, the chat's failure, the victory screen's results");
} finally {
  await browser.close();
}
